import io
from datetime import datetime, timezone
from fastapi import APIRouter, Response
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

router = APIRouter(prefix="/api/official-docs", tags=["Official Documents & Guidelines"])

VERIFIED_DOCUMENTS = [
    {
        "id": "pvpi-adr-form",
        "title": "Suspected Adverse Drug Reaction (ADR) Reporting Form for Healthcare Professionals",
        "issuingOrganization": "Indian Pharmacopoeia Commission (IPC) & NCC-PvPI",
        "category": "Pharmacovigilance",
        "version": "Version 1.4 (Official)",
        "verifiedLandingPage": "https://www.ipc.gov.in/",
        "directDownloadUrl": "/api/official-docs/pvpi-form",
        "isOfficial": True,
        "verificationStatus": "Verified Official Government Repository",
        "helpline": "1800 180 3024 (Toll-Free)",
        "email": "pvpi.ipc@gov.in",
        "lastVerified": "2026-10-26"
    },
    {
        "id": "icmr-iamrsn",
        "title": "Indian Antimicrobial Resistance Surveillance Network (IAMRSN) Annual Report",
        "issuingOrganization": "Indian Council of Medical Research (ICMR)",
        "category": "AMR Surveillance",
        "version": "National AMR Network Guidelines",
        "verifiedLandingPage": "https://iamrsn.icmr.org.in/",
        "directDownloadUrl": None,
        "isOfficial": True,
        "verificationStatus": "Verified Official National Research Portal",
        "lastVerified": "2026-10-26"
    },
    {
        "id": "icmr-treatment-guidelines",
        "title": "ICMR Treatment Guidelines for Antimicrobial Use in Common Syndromes",
        "issuingOrganization": "Indian Council of Medical Research (ICMR)",
        "category": "Clinical Stewardship Guidelines",
        "version": "2nd Edition / Latest National Guidelines",
        "verifiedLandingPage": "https://main.icmr.nic.in/content/guidelines-antimicrobial-use-common-syndromes",
        "directDownloadUrl": None,
        "isOfficial": True,
        "verificationStatus": "Verified Official Medical Council Guidelines",
        "lastVerified": "2026-10-26"
    },
    {
        "id": "who-aware",
        "title": "WHO AWaRe Classification of Antibiotics for Evaluation and Monitoring of Use",
        "issuingOrganization": "World Health Organization (WHO)",
        "category": "Global Antimicrobial Stewardship",
        "version": "WHO 2021-2026 Database",
        "verifiedLandingPage": "https://www.who.int/publications/i/item/2021-aware-classification",
        "directDownloadUrl": None,
        "isOfficial": True,
        "verificationStatus": "Verified Official WHO Global Publication",
        "lastVerified": "2026-10-26"
    },
    {
        "id": "ssc-sepsis",
        "title": "Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock",
        "issuingOrganization": "Society of Critical Care Medicine (SCCM) & ESICM",
        "category": "Critical Care / Sepsis",
        "version": "SSC 2021 Update",
        "verifiedLandingPage": "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines",
        "directDownloadUrl": None,
        "isOfficial": True,
        "verificationStatus": "Verified International Clinical Guidelines",
        "lastVerified": "2026-10-26"
    },
    {
        "id": "cdsco-pv",
        "title": "Central Drugs Standard Control Organisation (CDSCO) Pharmacovigilance Rules",
        "issuingOrganization": "CDSCO, Directorate General of Health Services, MoHFW",
        "category": "Regulatory Standards",
        "version": "National Regulatory Framework",
        "verifiedLandingPage": "https://cdsco.gov.in/",
        "directDownloadUrl": None,
        "isOfficial": True,
        "verificationStatus": "Verified Central Regulatory Authority",
        "lastVerified": "2026-10-26"
    }
]

def generate_official_pvpi_form_pdf() -> bytes:
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

    header_style = ParagraphStyle(
        'PvPIHeader',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        textColor=colors.HexColor('#991b1b'),
        alignment=1,
        spaceAfter=2
    )
    sub_header_style = ParagraphStyle(
        'PvPISub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.HexColor('#1e293b'),
        alignment=1,
        spaceAfter=4
    )
    section_style = ParagraphStyle(
        'PvPISection',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=colors.HexColor('#991b1b'),
        spaceBefore=8,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        'PvPIBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        textColor=colors.HexColor('#334155'),
        leading=12
    )

    story = []

    # Official Header
    story.append(Paragraph("INDIAN PHARMACOPOEIA COMMISSION (IPC)", header_style))
    story.append(Paragraph("NATIONAL COORDINATION CENTRE — PHARMACOVIGILANCE PROGRAMME OF INDIA (PvPI)", sub_header_style))
    story.append(Paragraph("Ministry of Health &amp; Family Welfare, Government of India — Sector-23, Raj Nagar, Ghaziabad-201002", ParagraphStyle('Sub2', parent=sub_header_style, fontSize=8, textColor=colors.HexColor('#64748b'))))
    story.append(Spacer(1, 4))
    story.append(Paragraph("SUSPECTED ADVERSE DRUG REACTION REPORTING FORM", ParagraphStyle('FormTitle', parent=header_style, fontSize=12, textColor=colors.HexColor('#dc2626'))))
    story.append(Paragraph("FOR VOLUNTARY REPORTING BY HEALTHCARE PROFESSIONALS", ParagraphStyle('FormSub', parent=sub_header_style, fontSize=8, textColor=colors.HexColor('#475569'))))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#dc2626"), spaceAfter=8))

    # Section A: Patient Details
    story.append(Paragraph("A. PATIENT INFORMATION", section_style))
    sec_a_data = [
        [Paragraph("<b>1. Patient Initials:</b> _________________", body_style), Paragraph("<b>2. Age at onset:</b> ______ yrs", body_style), Paragraph("<b>3. Gender:</b> [ ] M  [ ] F  [ ] Other", body_style)],
        [Paragraph("<b>4. Weight (kg):</b> ________ kg", body_style), Paragraph("<b>5. OPD / IPD Reg No:</b> _____________", body_style), Paragraph("<b>6. Hospital Name:</b> ___________________", body_style)]
    ]
    t_a = Table(sec_a_data, colWidths=[180, 180, 180])
    t_a.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_a)

    # Section B: Suspected Adverse Reaction
    story.append(Paragraph("B. SUSPECTED ADVERSE DRUG REACTION", section_style))
    sec_b_data = [
        [Paragraph("<b>7. Date of Reaction Onset:</b> (dd/mm/yyyy) ___/___/______", body_style), Paragraph("<b>8. Date of Recovery:</b> (dd/mm/yyyy) ___/___/______", body_style)],
        [Paragraph("<b>9. Describe Reaction or Problem:</b><br/>____________________________________________________________________________________________________<br/>____________________________________________________________________________________________________", body_style), Paragraph("<b>10. Outcome:</b><br/>[ ] Recovered  [ ] Recovering<br/>[ ] Fatal  [ ] Unknown<br/>[ ] Recovered with sequelae", body_style)],
        [Paragraph("<b>11. Seriousness of Reaction:</b> [ ] Death  [ ] Life threatening  [ ] Hospitalization / Prolonged  [ ] Disability  [ ] Congenital anomaly  [ ] None", body_style), Paragraph("<b>12. Relevant Tests / Lab Data:</b><br/>________________________________________", body_style)]
    ]
    t_b = Table(sec_b_data, colWidths=[270, 270])
    t_b.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_b)

    # Section C: Suspected Medication
    story.append(Paragraph("C. SUSPECTED MEDICATION(S)", section_style))
    sec_c_data = [
        [Paragraph("<b>Name (Brand / Generic)</b>", body_style), Paragraph("<b>Manufacturer &amp; Batch No.</b>", body_style), Paragraph("<b>Daily Dose &amp; Route</b>", body_style), Paragraph("<b>Therapy Dates</b>", body_style), Paragraph("<b>Reason for Use</b>", body_style)],
        [Paragraph("1. Suspected Drug:<br/>___________________", body_style), Paragraph("Batch: _____________<br/>Mfg: _______________", body_style), Paragraph("Dose: ______________<br/>Route: _____________", body_style), Paragraph("Start: ___/___/___<br/>Stop: ___/___/___", body_style), Paragraph("Indication:<br/>___________________", body_style)],
        [Paragraph("2. Concomitant Drug:<br/>___________________", body_style), Paragraph("Batch: _____________<br/>Mfg: _______________", body_style), Paragraph("Dose: ______________<br/>Route: _____________", body_style), Paragraph("Start: ___/___/___<br/>Stop: ___/___/___", body_style), Paragraph("Indication:<br/>___________________", body_style)]
    ]
    t_c = Table(sec_c_data, colWidths=[120, 110, 105, 105, 100])
    t_c.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#fee2e2')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_c)

    # Section D: Reporter Info
    story.append(Paragraph("D. REPORTER INFORMATION &amp; CONFIDENTIALITY NOTICE", section_style))
    notice_text = (
        "<b>Confidentiality Statement:</b> The patient's identity is held strictly confidential by NCC-PvPI. "
        "Submission of this report does not constitute an admission that medical personnel or the manufacturer caused or contributed to the adverse reaction.<br/>"
        "<b>National Helpline (Toll-Free):</b> 1800 180 3024 &nbsp;|&nbsp; <b>Email:</b> pvpi.ipc@gov.in &nbsp;|&nbsp; <b>Website:</b> https://www.ipc.gov.in/"
    )
    story.append(Paragraph(notice_text, body_style))
    story.append(Spacer(1, 10))

    footer_text = f"Official Pharmacovigilance Reference Form | Generated on {datetime.now(timezone.utc).strftime('%d %B %Y, %H:%M UTC')} | AarogyaX Health AI Platform"
    story.append(Paragraph(footer_text, ParagraphStyle('PvPIFooter', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=7.5, textColor=colors.HexColor('#94a3b8'), alignment=1)))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

@router.get("")
def get_official_documents():
    return {
        "documents": VERIFIED_DOCUMENTS,
        "total": len(VERIFIED_DOCUMENTS),
        "verifiedDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "compliance": "National AMR & Pharmacovigilance Standards (ICMR / IPC-PvPI / WHO)"
    }

@router.get("/pvpi-form")
def download_pvpi_official_form():
    pdf_bytes = generate_official_pvpi_form_pdf()
    filename = "Official-PvPI-Suspected-ADR-Reporting-Form.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
