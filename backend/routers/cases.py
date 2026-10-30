import sys
import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from database import get_db
from models import User, Patient, Case, Prediction
from schemas import CaseCreate, CaseUpdate, CaseListResponse
from auth import require_role
from ml.predict import predict_amr
from pdf_generator import generate_case_pdf

router = APIRouter(prefix="/api/cases", tags=["Cases"])

@router.get("", response_model=CaseListResponse)
def get_cases(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    # Strict per-user isolation: users only see their own cases
    query = db.query(Case).filter(Case.created_by == current_user.id)

    if status_filter:
        s = str(status_filter).lower().strip()
        if s in ["open", "active"]:
            query = query.filter(Case.status.in_(["open", "in_progress", "in-progress"]))
        elif s in ["resolved", "closed", "recovered"]:
            query = query.filter(Case.status.in_(["resolved", "closed"]))
        else:
            query = query.filter(Case.status == status_filter)

    cases = query.order_by(Case.created_at.desc()).all()
    case_list = [c.to_dict() for c in cases]
    return {
        "cases": case_list,
        "total": len(case_list)
    }

@router.post("", status_code=status.HTTP_201_CREATED)
def create_case(
    data: CaseCreate,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    raw_patient_id = data.patientId
    infection_type = data.infectionType or "uti"
    severity = data.severity

    # Resolve or create Patient scoped to current_user
    resolved_patient = None
    if raw_patient_id is not None:
        try:
            if isinstance(raw_patient_id, int) or (isinstance(raw_patient_id, str) and raw_patient_id.isdigit()):
                candidate = db.get(Patient, int(raw_patient_id))
                if candidate and candidate.created_by == current_user.id:
                    resolved_patient = candidate
        except Exception:
            resolved_patient = None

        if not resolved_patient and str(raw_patient_id).strip():
            candidate = db.query(Patient).filter(
                Patient.patient_id == str(raw_patient_id).strip(),
                Patient.created_by == current_user.id
            ).first()
            if candidate:
                resolved_patient = candidate

    if not resolved_patient:
        # Create a new patient automatically from form inputs, owned by current_user
        p_code = str(raw_patient_id).strip() if (raw_patient_id and str(raw_patient_id).strip()) else f"PT-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:4].upper()}"
        p_name = data.patientName or f"Patient {p_code}"
        p_age = int(data.age) if data.age else 45
        p_gender = data.gender or "Male"
        if p_gender not in ["Male", "Female", "Other"]:
            p_gender = "Male"

        resolved_patient = Patient(
            patient_id=p_code,
            name=p_name,
            age=p_age,
            gender=p_gender,
            diabetes=bool(data.diabetes),
            ckd=bool(data.ckd),
            pregnancy=bool(data.pregnancy),
            immunocompromised=bool(data.immunocompromised),
            created_by=current_user.id
        )
        db.add(resolved_patient)
        db.commit()
        db.refresh(resolved_patient)

    # Determine severity
    if not severity:
        severity = "severe" if data.icuStatus else "moderate"

    # Build sensitivity & clinical context details
    culture_parts = []
    if data.cultureResult:
        culture_parts.append(str(data.cultureResult))

    abx_sensitivity = data.antibioticSensitivity
    first_drug = None
    if isinstance(abx_sensitivity, list) and len(abx_sensitivity) > 0:
        sens_lines = []
        for row in abx_sensitivity:
            if isinstance(row, dict) and row.get("antibiotic"):
                drug = row.get("antibiotic")
                res = row.get("result", "Tested")
                mic = row.get("mic", "")
                mic_str = f" [MIC: {mic}]" if mic else ""
                sens_lines.append(f"{drug}: {res}{mic_str}")
                if not first_drug:
                    first_drug = drug
        if sens_lines:
            culture_parts.append("Sensitivity: " + "; ".join(sens_lines))

    if data.siteOfInfection:
        culture_parts.append(f"Site: {data.siteOfInfection}")
    if data.department:
        culture_parts.append(f"Dept: {data.department}")
    if data.deviceAssociated:
        culture_parts.append("Device Associated: Yes")
    if data.clinicalNotes:
        culture_parts.append(f"Notes: {data.clinicalNotes}")

    culture_result_final = " | ".join(culture_parts) if culture_parts else None

    # Handle prior antibiotics
    prior_abx_text = data.previousAntibioticUse or data.priorAntibioticsList or ""
    prior_abx_flag = bool(data.priorAntibiotics or prior_abx_text)

    case_number = f"CASE-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:4].upper()}"
    new_case = Case(
        case_number=case_number,
        patient_id=resolved_patient.id,
        infection_type=infection_type,
        severity=severity,
        icu_status=bool(data.icuStatus),
        prior_antibiotics=prior_abx_flag,
        prior_antibiotics_list=prior_abx_text[:200] if prior_abx_text else "",
        organism=data.organism or "",
        culture_result=culture_result_final,
        cbc_value=float(data.cbcValue) if data.cbcValue is not None else None,
        crp_value=float(data.crpValue) if data.crpValue is not None else None,
        procalcitonin_value=float(data.procalcitoninValue) if data.procalcitoninValue is not None else None,
        status="open",
        created_by=current_user.id
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    # Automatically generate prediction for new case
    prediction_record = None
    try:
        pred_dict = {
            "infectionType": infection_type,
            "organism": new_case.organism or "E. coli",
            "antibiotic": first_drug or "Amikacin",
            "severity": severity,
            "icuStatus": new_case.icu_status,
            "priorAntibiotics": prior_abx_flag,
            "pregnancy": bool(data.pregnancy or (resolved_patient.pregnancy if resolved_patient else False)),
            "ckd": bool(data.ckd or (resolved_patient.ckd if resolved_patient else False)),
            "antibioticSensitivity": abx_sensitivity if isinstance(abx_sensitivity, list) else [],
            "selectedModel": data.selectedModel or "GradientBoosting"
        }
        pred_res = predict_amr(pred_dict)
        if pred_res and "error" not in pred_res:
            prediction_record = Prediction(
                case_id=new_case.id,
                resistance_probability=pred_res.get("resistanceProbability", 0.5),
                recommended_drug=pred_res.get("recommendedDrug", "Ceftriaxone"),
                alternative_drugs=",".join(pred_res.get("alternativeDrugs", [])),
                resistance_risk=pred_res.get("resistanceRisk", "medium"),
                confidence=pred_res.get("confidence", 0.8),
                rationale=pred_res.get("rationale", ""),
                dosage=pred_res.get("dosage", "")
            )
            db.add(prediction_record)
            db.commit()
            db.refresh(prediction_record)
    except Exception as e:
        print(f"[!] Auto prediction error: {e}")

    result_dict = new_case.to_dict()
    if prediction_record:
        result_dict["prediction"] = prediction_record.to_dict()
    return result_dict

@router.get("/{case_id}")
def get_case(
    case_id: int,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    # RBAC constraint: Admins cannot view clinical case output details
    if current_user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Administrators cannot view clinical case details"
        )

    case_obj = db.get(Case, case_id)
    if not case_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Strict Per-User Authorization (Phase 6):
    # Users can only view their own cases (Interns, JRs, Consultants)
    if case_obj.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to view this clinical case."
        )

    return case_obj.to_dict()

@router.put("/{case_id}")
def update_case(
    case_id: int,
    data: CaseUpdate,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    case_obj = db.get(Case, case_id)
    if not case_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Strict Per-User Authorization (Phase 6)
    if case_obj.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot modify another user's clinical cases."
        )

    if data.status is not None:
        s = str(data.status).lower().strip()
        if s in ["recovered", "resolved", "closed"]:
            case_obj.status = "resolved"
        elif s in ["open", "in-progress", "in_progress", "active"]:
            case_obj.status = "open"
        else:
            case_obj.status = data.status

    if data.cultureResult is not None:
        case_obj.culture_result = data.cultureResult
    if data.organism is not None:
        case_obj.organism = data.organism

    db.commit()
    db.refresh(case_obj)
    return case_obj.to_dict()

@router.delete("/{case_id}")
def delete_case(
    case_id: int,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    case_obj = db.get(Case, case_id)
    if not case_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Strict Per-User Authorization (Phase 6)
    if case_obj.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot delete another user's clinical cases."
        )

    case_number = case_obj.case_number
    db.query(Prediction).filter(Prediction.case_id == case_id).delete()
    db.delete(case_obj)
    db.commit()
    return {"message": f"Case {case_number} deleted successfully"}

@router.get("/{case_id}/pdf")
def download_case_pdf(
    case_id: int,
    current_user: User = Depends(require_role("intern", "junior", "consultant")),
    db: Session = Depends(get_db)
):
    case_obj = db.get(Case, case_id)
    if not case_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Strict Per-User Authorization (Phase 6)
    if case_obj.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot download clinical reports of another user."
        )

    pdf_bytes = generate_case_pdf(case_obj)
    filename = f"AarogyaX-Case-{case_obj.case_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
