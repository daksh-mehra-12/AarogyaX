import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_stewardship_pdf(data=None):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        textColor=colors.HexColor('#0f766e'),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'SubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.HexColor('#475569'),
        spaceAfter=12
    )
    section_heading = ParagraphStyle(
        'SecHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor('#0f766e'),
        spaceBefore=10,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        textColor=colors.HexColor('#334155'),
        leading=13
    )

    story = []

    # Header
    story.append(Paragraph("AAROGYA X — MONTHLY CLINICAL STEWARDSHIP REPORT", title_style))
    story.append(Paragraph("City General Hospital — Department of Clinical Pharmacology & AMR Surveillance", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f766e"), spaceAfter=14))

    # Executive Summary
    story.append(Paragraph("Executive Summary", section_heading))
    summary_text = (
        "This monthly antimicrobial stewardship surveillance report summarizes institutional antibiotic utilization, "
        "pathogen resistance patterns, and compliance with clinical restriction protocols. All data are synchronized "
        "in real-time from the AarogyaX Decision Support Engine."
    )
    story.append(Paragraph(summary_text, body_style))
    story.append(Spacer(1, 10))

    # Surveillance Metrics Table
    story.append(Paragraph("Surveillance & Compliance Metrics", section_heading))
    total_cases = str(data.get('totalCases', 0)) if data else "0"
    active_cases = str(data.get('activeCases', 0)) if data else "0"
    resolved_cases = str(data.get('resolvedCases', 0)) if data else "0"
    adr_reports = str(data.get('adrReports', 0)) if data else "0"
    compliance = str(data.get('complianceRate', '92.4%')) if data else "92.4%"

    table_data = [
        [Paragraph("<b>Metric Parameter</b>", body_style), Paragraph("<b>Surveillance Value</b>", body_style), Paragraph("<b>Status Target</b>", body_style)],
        [Paragraph("Total Clinical Cases Evaluated", body_style), Paragraph(total_cases, body_style), Paragraph("Historical Total", body_style)],
        [Paragraph("Active Surveillance Cases", body_style), Paragraph(active_cases, body_style), Paragraph("Inpatient Active", body_style)],
        [Paragraph("Resolved / Recovered Cases", body_style), Paragraph(resolved_cases, body_style), Paragraph("Target > 85%", body_style)],
        [Paragraph("ADR Pharmacovigilance Logs", body_style), Paragraph(adr_reports, body_style), Paragraph("Surveillance Logs", body_style)],
        [Paragraph("Antimicrobial Protocol Compliance", body_style), Paragraph(compliance, body_style), Paragraph("Target > 90%", body_style)]
    ]

    t = Table(table_data, colWidths=[200, 170, 170])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0f766e')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))

    # Policy Statement
    story.append(Paragraph("Policy Compliance & Restricted Antibiotic Guidelines", section_heading))
    policy_text = (
        "<b>Restricted Antibiotics Protocol (2026.2):</b> High-level reserve antimicrobials (Meropenem, Colistin, "
        "Vancomycin, Linezolid) require prior consultation with the Infectious Disease Stewardship Committee. "
        "De-escalation to narrow-spectrum therapy is mandatory within 48 hours upon receipt of culture sensitivity results."
    )
    story.append(Paragraph(policy_text, body_style))
    story.append(Spacer(1, 20))

    # Footer
    footer_text = f"Report Generated on {datetime.now(timezone.utc).strftime('%d %B %Y, %H:%M UTC')} | AarogyaX Health AI Platform"
    story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=8, textColor=colors.HexColor('#94a3b8'), alignment=1)))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def generate_case_pdf(case_obj):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=16, textColor=colors.HexColor('#2563eb'), spaceAfter=4)
    subtitle_style = ParagraphStyle('SubTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor('#475569'), spaceAfter=12)
    section_heading = ParagraphStyle('SecHeading', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor('#2563eb'), spaceBefore=10, spaceAfter=6)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontName='Helvetica', fontSize=9.5, textColor=colors.HexColor('#334155'), leading=13)

    story = []

    case_dict = case_obj.to_dict() if hasattr(case_obj, 'to_dict') else case_obj
    case_num = case_dict.get('caseNumber', '')
    patient = case_dict.get('patient', {}) or {}

    story.append(Paragraph(f"AAROGYA X — CLINICAL CASE REPORT #{case_num}", title_style))
    story.append(Paragraph("Antimicrobial Decision Support & AI Patient Evaluation Record", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=14))

    # Patient & Case Details
    story.append(Paragraph("Patient Clinical Details", section_heading))
    details = [
        [Paragraph("<b>Patient Name:</b>", body_style), Paragraph(patient.get('name', 'N/A'), body_style), Paragraph("<b>Age / Gender:</b>", body_style), Paragraph(f"{patient.get('age', 'N/A')} yrs / {patient.get('gender', 'N/A')}", body_style)],
        [Paragraph("<b>Infection Site:</b>", body_style), Paragraph(str(case_dict.get('infectionType', 'N/A')).upper(), body_style), Paragraph("<b>Severity:</b>", body_style), Paragraph(str(case_dict.get('severity', 'N/A')).upper(), body_style)],
        [Paragraph("<b>Organism:</b>", body_style), Paragraph(case_dict.get('organism') or 'Pending culture', body_style), Paragraph("<b>Case Status:</b>", body_style), Paragraph(str(case_dict.get('status', 'N/A')).upper(), body_style)]
    ]
    t_details = Table(details, colWidths=[130, 140, 130, 140])
    t_details.setStyle(TableStyle([
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(t_details)
    story.append(Spacer(1, 14))

    # AI Prediction & Recommendation
    prediction = case_dict.get('prediction')
    if prediction:
        story.append(Paragraph("AMR AI Risk & Clinical Regimen Recommendation", section_heading))
        pred_data = [
            [Paragraph("<b>Recommended Antibiotic:</b>", body_style), Paragraph(f"<b>{prediction.get('recommendedDrug', 'N/A')}</b>", body_style)],
            [Paragraph("<b>Resistance Risk Level:</b>", body_style), Paragraph(str(prediction.get('resistanceRisk', 'N/A')).upper(), body_style)],
            [Paragraph("<b>Resistance Probability:</b>", body_style), Paragraph(f"{round((prediction.get('resistanceProbability', 0) * 100), 1)}%", body_style)],
            [Paragraph("<b>Dosage Regimen:</b>", body_style), Paragraph(prediction.get('dosage', 'Standard therapeutic dose'), body_style)],
            [Paragraph("<b>AI Clinical Rationale:</b>", body_style), Paragraph(prediction.get('rationale', 'N/A'), body_style)]
        ]
        t_pred = Table(pred_data, colWidths=[180, 360])
        t_pred.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f8fafc')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ]))
        story.append(t_pred)

    story.append(Spacer(1, 20))
    footer_text = f"Report Generated on {datetime.now(timezone.utc).strftime('%d %B %Y, %H:%M UTC')} | AarogyaX Decision Support"
    story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=8, textColor=colors.HexColor('#94a3b8'), alignment=1)))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def generate_adr_pdf(report_obj):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=16, textColor=colors.HexColor('#dc2626'), spaceAfter=4)
    subtitle_style = ParagraphStyle('SubTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor('#475569'), spaceAfter=12)
    section_heading = ParagraphStyle('SecHeading', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor('#dc2626'), spaceBefore=10, spaceAfter=6)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontName='Helvetica', fontSize=9.5, textColor=colors.HexColor('#334155'), leading=13)

    story = []

    report_dict = report_obj.to_dict() if hasattr(report_obj, 'to_dict') else report_obj
    rep_num = report_dict.get('reportNumber', '')

    story.append(Paragraph(f"AAROGYA X — PHARMACOVIGILANCE ADR REPORT #{rep_num}", title_style))
    story.append(Paragraph("Adverse Drug Reaction Surveillance & NCC-PvPI Reporting System", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#dc2626"), spaceAfter=14))

    # Details
    story.append(Paragraph("Reaction & Suspected Drug Information", section_heading))
    table_data = [
        [Paragraph("<b>Report Number:</b>", body_style), Paragraph(rep_num, body_style)],
        [Paragraph("<b>Suspected Drug Name:</b>", body_style), Paragraph(f"<b>{report_dict.get('drugName', 'N/A')}</b>", body_style)],
        [Paragraph("<b>Reaction Description:</b>", body_style), Paragraph(report_dict.get('reactionDescription', 'N/A'), body_style)],
        [Paragraph("<b>Reaction Severity:</b>", body_style), Paragraph(str(report_dict.get('severity', 'N/A')).upper(), body_style)],
        [Paragraph("<b>Clinical Outcome:</b>", body_style), Paragraph(str(report_dict.get('outcome', 'N/A')).upper(), body_style)],
        [Paragraph("<b>Report Status:</b>", body_style), Paragraph(str(report_dict.get('status', 'N/A')).upper(), body_style)],
    ]
    t = Table(table_data, colWidths=[160, 380])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#fff1f2')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#fca5a5')),
    ]))
    story.append(t)
    story.append(Spacer(1, 20))

    footer_text = f"NCC-PvPI Helpline (Toll Free): 1800 180 3024 | Generated on {datetime.now(timezone.utc).strftime('%d %B %Y, %H:%M UTC')}"
    story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=8, textColor=colors.HexColor('#94a3b8'), alignment=1)))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
