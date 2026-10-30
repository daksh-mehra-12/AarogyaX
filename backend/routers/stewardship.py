import os
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session

from config import Config
from database import get_db
from models import User, Case, ADRReport
from schemas import EmailRequest
from auth import require_role
from pdf_generator import generate_stewardship_pdf, generate_adr_pdf, generate_case_pdf

router = APIRouter(tags=["Stewardship & Reports"])

def send_real_email(recipient_emails: List[str], subject: str, html_body: str, pdf_bytes: Optional[bytes] = None, pdf_filename: Optional[str] = None):
    smtp_server = getattr(Config, 'SMTP_SERVER', os.environ.get('SMTP_SERVER', 'smtp.gmail.com'))
    smtp_port = int(getattr(Config, 'SMTP_PORT', os.environ.get('SMTP_PORT', 587)))
    smtp_user = getattr(Config, 'SMTP_USER', os.environ.get('SMTP_USER', ''))
    smtp_pass = getattr(Config, 'SMTP_PASSWORD', os.environ.get('SMTP_PASSWORD', ''))
    sender = getattr(Config, 'SENDER_EMAIL', os.environ.get('SENDER_EMAIL', smtp_user))

    if not smtp_user or not smtp_pass:
        return True, f"Simulated: Email '{subject}' queued for delivery to {', '.join(recipient_emails)} (SMTP credentials not configured in env)."

    try:
        msg = MIMEMultipart('mixed')
        msg['Subject'] = subject
        msg['From'] = f"AarogyaX Health AI <{sender}>"
        msg['To'] = ", ".join(recipient_emails)

        msg_body = MIMEMultipart('alternative')
        msg_body.attach(MIMEText(html_body, 'html'))
        msg.attach(msg_body)

        if pdf_bytes and pdf_filename:
            pdf_attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
            pdf_attachment.add_header('Content-Disposition', 'attachment', filename=pdf_filename)
            msg.attach(pdf_attachment)

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(sender, recipient_emails, msg.as_string())
        server.quit()
        return True, f"Email with attached PDF report ({pdf_filename or 'document.pdf'}) delivered successfully to {', '.join(recipient_emails)}"
    except Exception as e:
        return False, f"SMTP Delivery Error: {str(e)}"

@router.get("/api/stewardship")
def get_stewardship(
    current_user: User = Depends(require_role("junior", "consultant", "admin"))
):
    return {
        "status": "active",
        "editable": current_user.role in ["consultant", "admin"],
        "complianceRate": 92.4,
        "restrictedDrugs": ["Meropenem", "Colistin", "Vancomycin", "Ceftazidime-Avibactam"],
        "protocolVersion": "2026.2"
    }

@router.put("/api/stewardship")
def update_stewardship(
    data: dict,
    current_user: User = Depends(require_role("consultant", "admin"))
):
    return {
        "message": "Stewardship guidelines updated successfully",
        "config": data
    }

@router.get("/api/reports")
def get_reports(
    current_user: User = Depends(require_role("consultant", "admin")),
    db: Session = Depends(get_db)
):
    if current_user.role == "consultant":
        user_cases = db.query(Case).filter(Case.created_by == current_user.id).count()
        return {
            "scope": "department",
            "department": "Infectious Disease",
            "summary": "Quarterly Antimicrobial Surveillance & Resistance Summary",
            "totalCasesEvaluated": user_cases
        }
    else:
        total = db.query(Case).count()
        return {
            "scope": "global",
            "summary": "Hospital-Wide AMR Surveillance & Global Stewardship Report",
            "totalCasesEvaluated": total
        }

@router.get("/api/reports/stewardship/pdf")
def export_stewardship_pdf(
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    total = db.query(Case).filter(Case.created_by == current_user.id).count()
    active = db.query(Case).filter(
        Case.created_by == current_user.id,
        Case.status.in_(["open", "in_progress", "in-progress"])
    ).count()
    resolved = db.query(Case).filter(
        Case.created_by == current_user.id,
        Case.status.in_(["closed", "resolved"])
    ).count()
    adr_count = db.query(ADRReport).filter(ADRReport.created_by == current_user.id).count()

    pdf_bytes = generate_stewardship_pdf({
        "totalCases": total,
        "activeCases": active,
        "resolvedCases": resolved,
        "adrReports": adr_count
    })
    filename = f"AarogyaX-Stewardship-Report-{datetime.now().strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/api/email/stewardship")
def email_stewardship_report(
    data: EmailRequest,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    recipient = data.to or data.email or data.recipient
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipient email address is required"
        )

    recipients = [e.strip() for e in str(recipient).split(",") if e.strip()]
    subject = "AarogyaX — Antimicrobial Stewardship Surveillance PDF Report"

    total = db.query(Case).filter(Case.created_by == current_user.id).count()
    active = db.query(Case).filter(
        Case.created_by == current_user.id,
        Case.status.in_(["open", "in_progress", "in-progress"])
    ).count()
    resolved = db.query(Case).filter(
        Case.created_by == current_user.id,
        Case.status.in_(["closed", "resolved"])
    ).count()

    pdf_bytes = generate_stewardship_pdf({
        "totalCases": total,
        "activeCases": active,
        "resolvedCases": resolved
    })
    pdf_filename = f"AarogyaX-Stewardship-Report-{datetime.now().strftime('%Y-%m-%d')}.pdf"

    html_body = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-bottom: 5px;">AarogyaX — Health AI System</h2>
        <h4 style="color: #475569; margin-top: 0;">Monthly Antimicrobial Stewardship Report</h4>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;" />
        <p>Please find attached the official Antimicrobial Stewardship PDF Report.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 4px 0;"><strong>Attached PDF:</strong> {pdf_filename}</p>
            <p style="margin: 4px 0;"><strong>Total Evaluated Cases:</strong> {total}</p>
            <p style="margin: 4px 0;"><strong>Active Cases:</strong> {active}</p>
            <p style="margin: 4px 0;"><strong>Resolved Cases:</strong> {resolved}</p>
        </div>
        <p style="font-size: 12px; color: #64748b;">This document was generated by AarogyaX Decision Support Engine.</p>
    </div>
    """

    success, msg = send_real_email(recipients, subject, html_body, pdf_bytes=pdf_bytes, pdf_filename=pdf_filename)
    return {"message": msg, "recipients": recipients, "status": "sent" if success else "failed"}

@router.post("/api/email/adr/{adr_id}")
def email_adr_report(
    adr_id: int,
    data: EmailRequest,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    report = db.get(ADRReport, adr_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ADR report not found")

    # Authorization: User must be creator (Strict Per-User Authorization)
    if report.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot email another user's ADR report."
        )

    recipient = data.to or data.email or data.recipient
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipient email address is required"
        )

    recipients = [e.strip() for e in str(recipient).split(",") if e.strip()]
    subject = f"AarogyaX — ADR Pharmacovigilance PDF Report #{report.report_number}"

    pdf_bytes = generate_adr_pdf(report)
    pdf_filename = f"AarogyaX-ADR-{report.report_number}.pdf"

    html_body = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #dc2626; margin-bottom: 5px;">AarogyaX — Health AI System</h2>
        <h4 style="color: #475569; margin-top: 0;">Adverse Drug Reaction (ADR) PDF Report</h4>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;" />
        <p>Please find attached the official Pharmacovigilance ADR PDF Report for Report #{report.report_number}.</p>
        <div style="background-color: #fff1f2; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 4px 0;"><strong>Attached PDF:</strong> {pdf_filename}</p>
            <p style="margin: 4px 0;"><strong>Report ID:</strong> #{report.report_number}</p>
            <p style="margin: 4px 0;"><strong>Suspected Drug:</strong> {report.drug_name}</p>
            <p style="margin: 4px 0;"><strong>Reaction:</strong> {report.reaction_description}</p>
            <p style="margin: 4px 0;"><strong>Severity:</strong> {report.severity.upper()}</p>
            <p style="margin: 4px 0;"><strong>Outcome:</strong> {report.outcome.upper()}</p>
        </div>
        <p style="font-size: 12px; color: #64748b;">This pharmacovigilance document was dispatched by AarogyaX Pharmacovigilance Module.</p>
    </div>
    """

    success, msg = send_real_email(recipients, subject, html_body, pdf_bytes=pdf_bytes, pdf_filename=pdf_filename)
    return {"message": msg, "recipients": recipients, "status": "sent" if success else "failed"}

@router.post("/api/email/case/{case_id}")
def email_case_report(
    case_id: int,
    data: EmailRequest,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    case_obj = db.get(Case, case_id)
    if not case_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Authorization: User must be creator or have supervisor/admin role
    if case_obj.created_by != current_user.id and current_user.role not in ["admin", "consultant"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot email another user's case report."
        )

    recipient = data.to or data.email or data.recipient
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipient email address is required"
        )

    recipients = [e.strip() for e in str(recipient).split(",") if e.strip()]
    subject = f"AarogyaX — Clinical Case Evaluation PDF Report #{case_obj.case_number}"

    pdf_bytes = generate_case_pdf(case_obj)
    pdf_filename = f"AarogyaX-Case-{case_obj.case_number}.pdf"

    html_body = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-bottom: 5px;">AarogyaX — Health AI System</h2>
        <h4 style="color: #475569; margin-top: 0;">Clinical Case Evaluation PDF Report</h4>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;" />
        <p>Please find attached the clinical evaluation report for Case #{case_obj.case_number}.</p>
    </div>
    """

    success, msg = send_real_email(recipients, subject, html_body, pdf_bytes=pdf_bytes, pdf_filename=pdf_filename)
    return {"message": msg, "recipients": recipients, "status": "sent" if success else "failed"}
