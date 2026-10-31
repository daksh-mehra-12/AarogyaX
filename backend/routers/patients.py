import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User, Patient, Case, Prediction, ADRReport, AmrRecord, PatientVital
from schemas import PatientCreate, PatientListResponse, PatientVitalCreate
from auth import require_role

router = APIRouter(prefix="/api/patients", tags=["Patients"])

@router.get("", response_model=PatientListResponse)
def get_patients(
    search: Optional[str] = Query(None),
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    query = db.query(Patient).filter(Patient.created_by == current_user.id)
    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            (Patient.name.ilike(s)) | (Patient.patient_id.ilike(s)) | (Patient.region.ilike(s))
        )
    patients = query.order_by(Patient.created_at.desc()).all()
    patient_list = [p.to_dict() for p in patients]
    return {
        "patients": patient_list,
        "total": len(patient_list)
    }

@router.post("", status_code=status.HTTP_201_CREATED)
def create_patient(
    data: PatientCreate,
    current_user: User = Depends(require_role("intern", "junior", "consultant")),
    db: Session = Depends(get_db)
):
    if not data.name or not data.age or not data.gender:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name, age and gender are required"
        )

    patient_id = data.patientId or f"PAT-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:4].upper()}"

    patient = Patient(
        patient_id=patient_id,
        name=data.name.strip(),
        age=int(data.age),
        gender=data.gender.strip(),
        weight=float(data.weight) if data.weight is not None else 60.0,
        region=data.region or "India",
        blood_group=data.bloodGroup or "O+",
        diabetes=bool(data.diabetes),
        ckd=bool(data.ckd),
        pregnancy=bool(data.pregnancy),
        immunocompromised=bool(data.immunocompromised),
        created_by=current_user.id
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient.to_dict()

@router.get("/{patient_id}")
def get_patient(
    patient_id: int,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Strict Per-User Authorization (Phase 6)
    if patient.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to access another user's patient records."
        )

    patient_dict = patient.to_dict()
    cases = db.query(Case).filter(Case.patient_id == patient_id).order_by(Case.created_at.desc()).all()
    patient_dict["cases"] = [c.to_dict() for c in cases]
    
    amr_records = db.query(AmrRecord).filter(AmrRecord.patient_id == patient_id).order_by(AmrRecord.created_at.desc()).all()
    patient_dict["amrRecords"] = [r.to_dict() for r in amr_records]

    adr_reports = db.query(ADRReport).filter(ADRReport.patient_id == patient_id).order_by(ADRReport.created_at.desc()).all()
    patient_dict["adrReports"] = [a.to_dict() for a in adr_reports]

    vitals = db.query(PatientVital).filter(PatientVital.patient_id == patient_id).order_by(PatientVital.created_at.desc()).all()
    patient_dict["vitals"] = [v.to_dict() for v in vitals]
    return patient_dict

@router.get("/{patient_id}/vitals")
def get_patient_vitals(
    patient_id: int,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    if patient.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    vitals = db.query(PatientVital).filter(PatientVital.patient_id == patient_id).order_by(PatientVital.created_at.desc()).all()
    return {"vitals": [v.to_dict() for v in vitals]}

@router.post("/{patient_id}/vitals", status_code=status.HTTP_201_CREATED)
def record_patient_vitals(
    patient_id: int,
    data: PatientVitalCreate,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    if patient.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    bp_str = data.bloodPressure.strip()
    sys_val = data.systolic
    dia_val = data.diastolic
    if (sys_val is None or dia_val is None) and "/" in bp_str:
        parts = bp_str.split("/")
        if len(parts) == 2 and parts[0].strip().isdigit() and parts[1].strip().isdigit():
            sys_val = int(parts[0].strip())
            dia_val = int(parts[1].strip())

    vital = PatientVital(
        patient_id=patient_id,
        blood_pressure=bp_str,
        systolic=sys_val,
        diastolic=dia_val,
        heart_rate=int(data.heartRate),
        temperature=float(data.temperature),
        recorded_by=current_user.id,
    )
    db.add(vital)
    db.commit()
    db.refresh(vital)
    return vital.to_dict()

@router.put("/{patient_id}")
def update_patient(
    patient_id: int,
    data: PatientCreate,
    current_user: User = Depends(require_role("junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    if patient.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot modify another user's patient record."
        )

    if data.name:
        patient.name = data.name.strip()
    if data.age is not None:
        patient.age = int(data.age)
    if data.gender:
        patient.gender = data.gender.strip()
    if data.weight is not None:
        patient.weight = float(data.weight)
    if data.region is not None:
        patient.region = data.region
    if data.bloodGroup is not None:
        patient.blood_group = data.bloodGroup
    if data.diabetes is not None:
        patient.diabetes = bool(data.diabetes)
    if data.ckd is not None:
        patient.ckd = bool(data.ckd)
    if data.pregnancy is not None:
        patient.pregnancy = bool(data.pregnancy)
    if data.immunocompromised is not None:
        patient.immunocompromised = bool(data.immunocompromised)

    db.commit()
    db.refresh(patient)
    return patient.to_dict()

@router.delete("/{patient_id}")
def delete_patient(
    patient_id: int,
    current_user: User = Depends(require_role("junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Strict Per-User Authorization (Phase 6)
    if patient.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot delete another user's patient records."
        )

    # Safe clinical audit preservation policy:
    # Do not silently cascade-delete clinical AMR records; disassociate them so the lab history is preserved.
    amr_records = db.query(AmrRecord).filter(AmrRecord.patient_id == patient_id).all()
    for ar in amr_records:
        ar.patient_id = None
        if not ar.anonymous_patient_id:
            ar.anonymous_patient_id = patient.patient_id

    # Clean up associated cases, predictions, vitals, and ADR reports belonging to this patient
    cases = db.query(Case).filter(Case.patient_id == patient_id).all()
    for c in cases:
        db.query(Prediction).filter(Prediction.case_id == c.id).delete()
    db.query(Case).filter(Case.patient_id == patient_id).delete()
    db.query(ADRReport).filter(ADRReport.patient_id == patient_id).delete()
    db.query(PatientVital).filter(PatientVital.patient_id == patient_id).delete()
    db.delete(patient)
    db.commit()
    return {"message": "Patient deleted successfully"}
