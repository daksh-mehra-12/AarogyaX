import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from database import get_db
from models import User, ADRReport
from schemas import ADRCreate, ADRUpdate, ADRListResponse
from auth import require_role
from pdf_generator import generate_adr_pdf

router = APIRouter(prefix="/api/adr", tags=["ADR Reporting"])

@router.get("", response_model=ADRListResponse)
def get_adr(
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    # Strict per-user isolation: users only see their own ADR reports
    reports = db.query(ADRReport).filter(
        ADRReport.created_by == current_user.id
    ).order_by(ADRReport.created_at.desc()).all()

    report_list = [r.to_dict() for r in reports]
    return {
        "reports": report_list,
        "total": len(report_list)
    }

@router.post("", status_code=status.HTTP_201_CREATED)
def create_adr(
    data: ADRCreate,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    if not data.drugName or not data.reactionDescription or not data.severity or not data.outcome:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="drugName, reactionDescription, severity, and outcome are required"
        )

    report_number = f"ADR-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:4].upper()}"
    norm_outcome = str(data.outcome).lower().replace(" ", "-").replace("_", "-")
    is_recovered = norm_outcome in ["recovered", "recovered-sequelae", "resolved", "closed"]

    report = ADRReport(
        report_number=report_number,
        case_id=data.caseId,
        patient_id=data.patientId,
        drug_name=data.drugName.strip(),
        reaction_description=data.reactionDescription.strip(),
        severity=data.severity,
        outcome=data.outcome,
        onset_date=data.onsetDate or "",
        status="closed" if is_recovered else "pending",
        created_by=current_user.id
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report.to_dict()

@router.get("/{adr_id}")
def get_adr_report(
    adr_id: int,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    report = db.get(ADRReport, adr_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ADR report not found")

    # Strict Per-User Authorization (Phase 6)
    if report.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to view this ADR report."
        )

    return report.to_dict()

@router.put("/{adr_id}")
def update_adr_report(
    adr_id: int,
    data: ADRUpdate,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    report = db.get(ADRReport, adr_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ADR report not found")

    # Strict Per-User Authorization (Phase 6)
    if report.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot modify another user's ADR report."
        )

    if data.outcome is not None:
        report.outcome = data.outcome
        norm = str(data.outcome).lower().replace(" ", "-").replace("_", "-")
        if norm in ["recovered", "recovered-sequelae", "resolved", "closed"]:
            report.status = "closed"
        else:
            report.status = "pending"

    if data.status is not None:
        report.status = data.status

    db.commit()
    db.refresh(report)
    return report.to_dict()

@router.delete("/{adr_id}")
def delete_adr_report(
    adr_id: int,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    report = db.get(ADRReport, adr_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ADR report not found")

    # Strict Per-User Authorization (Phase 6)
    if report.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot delete another user's ADR report."
        )

    rep_num = report.report_number
    db.delete(report)
    db.commit()
    return {"message": f"ADR Report {rep_num} deleted successfully"}

@router.get("/{adr_id}/pdf")
def download_adr_pdf(
    adr_id: int,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    report = db.get(ADRReport, adr_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ADR report not found")

    # Strict Per-User Authorization (Phase 6)
    if report.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot download pharmacovigilance reports belonging to another user."
        )

    pdf_bytes = generate_adr_pdf(report)
    filename = f"AarogyaX-ADR-{report.report_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
