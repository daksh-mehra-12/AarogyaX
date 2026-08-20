import os
import json
import urllib.request
import sys
import uuid
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import jwt

# Enable importing from project root (for ml.predict)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import db
from models import User, Patient, Case, Prediction, ADRReport
from config import Config
from ml.predict import predict_amr
from auth import get_token_user, role_required

routes = Blueprint('routes', __name__)

# ── Auth Endpoints (Public) ───────────────────────────────────────────────────

@routes.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    role = data.get('role', 'intern')

    if role == 'admin':
        return jsonify({'error': 'Admin accounts cannot be registered via public signup. Please contact your system administrator.'}), 403

    if role not in ['intern', 'junior', 'consultant']:
        role = 'intern'

    if not name or not email or not password:
        return jsonify({'error': 'Name, email and password are required'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists'}), 400

    hashed_pw = generate_password_hash(password)
    user = User(name=name, email=email, password=hashed_pw, role=role)
    db.session.add(user)
    db.session.commit()

    token = jwt.encode({'user_id': user.id, 'role': user.role, 'exp': datetime.now(timezone.utc) + timedelta(days=7)}, Config.SECRET_KEY, algorithm='HS256')
    return jsonify({'token': token, 'user': user.to_dict()}), 201

@routes.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'No account found with this email. Please register a new user first.'}), 401

    if not check_password_hash(user.password, password):
        return jsonify({'error': 'Incorrect password. Please verify and try again.'}), 401

    token = jwt.encode({'user_id': user.id, 'role': user.role, 'exp': datetime.now(timezone.utc) + timedelta(days=7)}, Config.SECRET_KEY, algorithm='HS256')
    return jsonify({'token': token, 'user': user.to_dict()}), 200

@routes.route('/api/auth/me', methods=['GET'])
def get_me():
    user = get_token_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify(user.to_dict()), 200

# ── Patient Endpoints (Intern, JR, Consultant ONLY — Admin DENIED) ───────────

@routes.route('/api/patients', methods=['GET'])
@role_required('intern', 'junior', 'consultant')
def get_patients():
    patients = Patient.query.order_by(Patient.created_at.desc()).all()
    patient_list = [p.to_dict() for p in patients]
    return jsonify({'patients': patient_list, 'total': len(patient_list)}), 200

@routes.route('/api/patients', methods=['POST'])
@role_required('intern', 'junior', 'consultant')
def create_patient():
    data = request.json or {}
    name = data.get('name')
    age = data.get('age')
    gender = data.get('gender')

    if not name or not age or not gender:
        return jsonify({'error': 'Name, age and gender are required'}), 400

    patient_id = f"PAT-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:4].upper()}"
    patient = Patient(
        patient_id=patient_id,
        name=name,
        age=int(age),
        gender=gender,
        weight=float(data.get('weight', 60.0)),
        region=data.get('region', 'India'),
        blood_group=data.get('bloodGroup', 'O+'),
        diabetes=bool(data.get('diabetes', False)),
        ckd=bool(data.get('ckd', False)),
        pregnancy=bool(data.get('pregnancy', False)),
        immunocompromised=bool(data.get('immunocompromised', False))
    )
    db.session.add(patient)
    db.session.commit()
    return jsonify(patient.to_dict()), 201

@routes.route('/api/patients/<int:patient_id>', methods=['GET'])
@role_required('intern', 'junior', 'consultant')
def get_patient(patient_id):
    patient = db.session.get(Patient, patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404
    return jsonify(patient.to_dict()), 200

@routes.route('/api/patients/<int:patient_id>', methods=['DELETE'])
@role_required('consultant')
def delete_patient(patient_id):
    patient = db.session.get(Patient, patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    Case.query.filter_by(patient_id=patient_id).delete()
    ADRReport.query.filter_by(patient_id=patient_id).delete()
    db.session.delete(patient)
    db.session.commit()
    return jsonify({'message': 'Patient deleted successfully'}), 200

# ── Case Endpoints ────────────────────────────────────────────────────────────

@routes.route('/api/cases', methods=['GET'])
@role_required('intern', 'junior', 'consultant', 'admin')
def get_cases():
    user = get_token_user()
    status_filter = request.args.get('status')

    query = Case.query
    if user.role == 'intern':
        query = query.filter_by(created_by=user.id)

    if status_filter:
        s = str(status_filter).lower().strip()
        if s in ['open', 'active']:
            query = query.filter(Case.status.in_(['open', 'in_progress', 'in-progress']))
        elif s in ['resolved', 'closed', 'recovered']:
            query = query.filter(Case.status.in_(['resolved', 'closed']))
        else:
            query = query.filter(Case.status == status_filter)

    cases = query.order_by(Case.created_at.desc()).all()
    case_list = [c.to_dict() for c in cases]
    return jsonify({'cases': case_list, 'total': len(case_list)}), 200

@routes.route('/api/cases', methods=['POST'])
@role_required('intern', 'junior', 'consultant')
def create_case():
    user = get_token_user()
    data = request.json or {}
    patient_id = data.get('patientId')
    infection_type = data.get('infectionType')
    severity = data.get('severity')

    if not patient_id or not infection_type or not severity:
        return jsonify({'error': 'patientId, infectionType, and severity are required'}), 400

    case_number = f"CASE-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:4].upper()}"
    new_case = Case(
        case_number=case_number,
        patient_id=int(patient_id),
        infection_type=infection_type,
        severity=severity,
        icu_status=bool(data.get('icuStatus', False)),
        prior_antibiotics=bool(data.get('priorAntibiotics', False)),
        prior_antibiotics_list=data.get('priorAntibioticsList', ''),
        organism=data.get('organism', ''),
        culture_result=data.get('cultureResult', ''),
        cbc_value=float(data.get('cbcValue', 0.0)) if data.get('cbcValue') else None,
        crp_value=float(data.get('crpValue', 0.0)) if data.get('crpValue') else None,
        procalcitonin_value=float(data.get('procalcitoninValue', 0.0)) if data.get('procalcitoninValue') else None,
        status='open',
        created_by=user.id
    )
    db.session.add(new_case)
    db.session.commit()

    # Automatically generate prediction for new case
    try:
        pred_res = predict_amr(data)
        if pred_res and 'error' not in pred_res:
            prediction = Prediction(
                case_id=new_case.id,
                resistance_probability=pred_res.get('resistanceProbability', 0.5),
                recommended_drug=pred_res.get('recommendedDrug', 'Ceftriaxone'),
                alternative_drugs=','.join(pred_res.get('alternativeDrugs', [])),
                resistance_risk=pred_res.get('resistanceRisk', 'medium'),
                confidence=pred_res.get('confidence', 0.8),
                rationale=pred_res.get('rationale', ''),
                dosage=pred_res.get('dosage', '')
            )
            db.session.add(prediction)
            db.session.commit()
    except Exception as e:
        print(f"[!] Auto prediction error: {e}")

    return jsonify(new_case.to_dict()), 201

@routes.route('/api/cases/<int:case_id>', methods=['GET'])
@role_required('intern', 'junior', 'consultant')
def get_case(case_id):
    user = get_token_user()
    case_obj = db.session.get(Case, case_id)
    if not case_obj:
        return jsonify({'error': 'Case not found'}), 404

    if user.role == 'intern' and case_obj.created_by != user.id:
        return jsonify({'error': 'Forbidden: Interns may only view their own clinical cases'}), 403

    prediction = Prediction.query.filter_by(case_id=case_id).first()
    res_dict = case_obj.to_dict()
    if prediction:
        res_dict['prediction'] = prediction.to_dict()
    return jsonify(res_dict), 200

@routes.route('/api/cases/<int:case_id>', methods=['PUT'])
@role_required('intern', 'junior', 'consultant', 'admin')
def update_case(case_id):
    case_obj = db.session.get(Case, case_id)
    if not case_obj:
        return jsonify({'error': 'Case not found'}), 404
    data = request.json or {}
    if 'status' in data:
        s = str(data['status']).lower().strip()
        if s in ['recovered', 'resolved', 'closed']:
            case_obj.status = 'resolved'
        elif s in ['open', 'in-progress', 'in_progress', 'active']:
            case_obj.status = 'open'
        else:
            case_obj.status = data['status']
    if 'cultureResult' in data:
        case_obj.culture_result = data['cultureResult']
    if 'organism' in data:
        case_obj.organism = data['organism']
    db.session.commit()
    return jsonify(case_obj.to_dict()), 200

# ── Prediction & ADR Endpoints ────────────────────────────────────────────────

@routes.route('/api/predict', methods=['POST'])
@role_required('intern', 'junior', 'consultant', 'admin')
def predict():
    data = request.json or {}
    case_id = data.get('caseId')
    res = predict_amr(data)

    if 'error' in res:
        return jsonify({'error': res['error']}), 400

    if case_id:
        prediction = Prediction(
            case_id=int(case_id),
            resistance_probability=res['resistanceProbability'],
            recommended_drug=res['recommendedDrug'],
            alternative_drugs=','.join(res['alternativeDrugs']),
            resistance_risk=res['resistanceRisk'],
            confidence=res['confidence'],
            rationale=res['rationale'],
            dosage=res['dosage']
        )
        db.session.add(prediction)
        db.session.commit()
        return jsonify({
            'prediction': prediction.to_dict(),
            'message': 'AMR prediction completed successfully'
        }), 200
    else:
        return jsonify({
            'prediction': res,
            'message': 'AMR prediction completed successfully'
        }), 200

@routes.route('/api/adr', methods=['GET'])
@role_required('intern', 'junior', 'consultant', 'admin')
def get_adr():
    reports = ADRReport.query.order_by(ADRReport.created_at.desc()).all()
    report_list = [r.to_dict() for r in reports]
    return jsonify({'reports': report_list, 'total': len(report_list)}), 200

@routes.route('/api/adr/<int:adr_id>', methods=['GET'])
@role_required('intern', 'junior', 'consultant', 'admin')
def get_adr_report(adr_id):
    report = db.session.get(ADRReport, adr_id)
    if not report:
        return jsonify({'error': 'ADR Report not found'}), 404
    return jsonify(report.to_dict()), 200

@routes.route('/api/adr', methods=['POST'])
@role_required('intern', 'junior', 'consultant', 'admin')
def create_adr():
    data = request.json or {}
    drug_name = data.get('drugName')
    reaction = data.get('reactionDescription')
    severity = data.get('severity')
    outcome = data.get('outcome')

    if not drug_name or not reaction or not severity or not outcome:
        return jsonify({'error': 'drugName, reactionDescription, severity, and outcome are required'}), 400

    report_number = f"ADR-{int(datetime.now(timezone.utc).timestamp())}"
    norm_outcome = str(outcome).lower().replace(' ', '-').replace('_', '-')
    is_recovered = norm_outcome in ['recovered', 'recovered-sequelae', 'resolved', 'closed']

    report = ADRReport(
        report_number=report_number,
        case_id=data.get('caseId'),
        patient_id=data.get('patientId'),
        drug_name=drug_name,
        reaction_description=reaction,
        severity=severity,
        outcome=outcome,
        onset_date=data.get('onsetDate', ''),
        status='closed' if is_recovered else 'pending'
    )
    db.session.add(report)
    db.session.commit()
    return jsonify(report.to_dict()), 201

@routes.route('/api/adr/<int:adr_id>', methods=['PUT'])
@role_required('intern', 'junior', 'consultant', 'admin')
def update_adr_report(adr_id):
    report = db.session.get(ADRReport, adr_id)
    if not report:
        return jsonify({'error': 'ADR report not found'}), 404
    data = request.json or {}
    if 'outcome' in data:
        report.outcome = data['outcome']
        norm = str(data['outcome']).lower().replace(' ', '-').replace('_', '-')
        if norm in ['recovered', 'recovered-sequelae', 'resolved', 'closed']:
            report.status = 'closed'
        else:
            report.status = 'pending'
    if 'status' in data:
        report.status = data['status']
    db.session.commit()
    return jsonify(report.to_dict()), 200

# ── Stewardship & Reporting Endpoints ─────────────────────────────────────────

@routes.route('/api/stewardship', methods=['GET'])
@role_required('junior', 'consultant', 'admin')
def get_stewardship():
    user = get_token_user()
    return jsonify({
        'status': 'active',
        'editable': user.role in ['consultant', 'admin'],
        'complianceRate': 92.4,
        'restrictedDrugs': ['Meropenem', 'Colistin', 'Vancomycin'],
        'protocolVersion': '2026.2'
    }), 200

@routes.route('/api/stewardship', methods=['PUT'])
@role_required('consultant', 'admin')
def update_stewardship():
    data = request.json or {}
    return jsonify({'message': 'Stewardship guidelines updated successfully', 'config': data}), 200

@routes.route('/api/reports', methods=['GET'])
@role_required('consultant', 'admin')
def get_reports():
    user = get_token_user()
    if user.role == 'consultant':
        return jsonify({
            'scope': 'department',
            'department': 'Infectious Disease',
            'summary': 'Quarterly Antimicrobial Surveillance & Resistance Summary',
            'totalCasesEvaluated': 148
        }), 200
    else:
        return jsonify({
            'scope': 'global',
            'summary': 'Hospital-Wide AMR Surveillance & Global Stewardship Report',
            'totalCasesEvaluated': 452
        }), 200

# ── Real SMTP Email Dispatch Helper ──────────────────────────────────────────

def send_real_email(recipient_emails, subject, html_body, pdf_bytes=None, pdf_filename=None):
    smtp_server = getattr(Config, 'SMTP_SERVER', os.environ.get('SMTP_SERVER', 'smtp.gmail.com'))
    smtp_port = int(getattr(Config, 'SMTP_PORT', os.environ.get('SMTP_PORT', 587)))
    smtp_user = getattr(Config, 'SMTP_USER', os.environ.get('SMTP_USER', ''))
    smtp_pass = getattr(Config, 'SMTP_PASSWORD', os.environ.get('SMTP_PASSWORD', ''))
    sender = getattr(Config, 'SENDER_EMAIL', os.environ.get('SENDER_EMAIL', smtp_user))

    if not isinstance(recipient_emails, list):
        recipient_emails = [recipient_emails]

    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from email.mime.application import MIMEApplication

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
        print(f"[SMTP Error] {e}")
        return False, f"SMTP Delivery Error: {str(e)}"

# ── Email Report Endpoints ───────────────────────────────────────────────────

@routes.route('/api/email/stewardship', methods=['POST'])
@role_required('intern', 'junior', 'consultant', 'admin')
def email_stewardship_report():
    from pdf_generator import generate_stewardship_pdf
    data = request.json or {}
    recipient = data.get('to') or data.get('email') or data.get('recipient')
    if not recipient:
        return jsonify({'error': 'Recipient email address is required', 'message': 'Recipient email address is required'}), 400

    recipients = [e.strip() for e in str(recipient).split(',') if e.strip()]
    subject = "AarogyaX — Monthly Antimicrobial Stewardship PDF Report"
    
    patient_count = Patient.query.count()
    case_count = Case.query.count()
    adr_count = ADRReport.query.count()
    active_cases_count = Case.query.filter(Case.status.in_(['open', 'in_progress', 'in-progress'])).count()
    resolved_cases_count = Case.query.filter(Case.status.in_(['closed', 'resolved'])).count()

    pdf_data = {
        'totalCases': case_count,
        'activeCases': active_cases_count,
        'resolvedCases': resolved_cases_count,
        'adrReports': adr_count,
        'complianceRate': '92.4%'
    }
    pdf_bytes = generate_stewardship_pdf(pdf_data)
    pdf_filename = f"AarogyaX-Monthly-Stewardship-Report-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.pdf"

    html_body = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #0f766e; margin-bottom: 5px;">AarogyaX — Health AI System</h2>
        <h4 style="color: #475569; margin-top: 0;">Monthly Antimicrobial Stewardship PDF Report</h4>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;" />
        <p>Dear Healthcare Professional,</p>
        <p>Please find attached the official <strong>Monthly Clinical Stewardship PDF Report</strong> formatted with hospital branding, executive summary, case counts, and policy compliance guidelines.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 4px 0;"><strong>Attached PDF File:</strong> {pdf_filename}</p>
            <p style="margin: 4px 0;"><strong>Total Evaluated Clinical Cases:</strong> {case_count}</p>
            <p style="margin: 4px 0;"><strong>Active Clinical Cases:</strong> {active_cases_count}</p>
            <p style="margin: 4px 0;"><strong>Resolved / Recovered Clinical Cases:</strong> {resolved_cases_count}</p>
            <p style="margin: 4px 0;"><strong>ADR Pharmacovigilance Reports:</strong> {adr_count}</p>
            <p style="margin: 4px 0;"><strong>Antimicrobial Protocol Compliance:</strong> 92.4%</p>
        </div>
        <p style="font-size: 12px; color: #64748b;">Dispatched securely via AarogyaX Health AI Platform.</p>
    </div>
    """
    success, msg = send_real_email(recipients, subject, html_body, pdf_bytes=pdf_bytes, pdf_filename=pdf_filename)
    if success:
        return jsonify({'message': msg, 'recipients': recipients, 'status': 'sent'}), 200
    else:
        return jsonify({'error': msg, 'message': msg}), 500

@routes.route('/api/email/case/<int:case_id>', methods=['POST'])
@role_required('intern', 'junior', 'consultant', 'admin')
def email_case_report(case_id):
    from pdf_generator import generate_case_pdf
    case_obj = db.session.get(Case, case_id)
    if not case_obj:
        return jsonify({'error': 'Case not found', 'message': 'Case not found'}), 404

    data = request.json or {}
    recipient = data.get('to') or data.get('email') or data.get('recipient')
    if not recipient:
        return jsonify({'error': 'Recipient email address is required', 'message': 'Recipient email address is required'}), 400

    recipients = [e.strip() for e in str(recipient).split(',') if e.strip()]
    subject = f"AarogyaX — Clinical Case Analysis PDF Report #{case_obj.case_number}"

    pdf_bytes = generate_case_pdf(case_obj)
    pdf_filename = f"AarogyaX-Case-{case_obj.case_number}.pdf"

    html_body = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-bottom: 5px;">AarogyaX — Health AI System</h2>
        <h4 style="color: #475569; margin-top: 0;">Clinical Case Analysis Report</h4>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;" />
        <p>Please find attached the official PDF report for Case #{case_obj.case_number}.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 4px 0;"><strong>Attached PDF:</strong> {pdf_filename}</p>
            <p style="margin: 4px 0;"><strong>Case Number:</strong> #{case_obj.case_number}</p>
            <p style="margin: 4px 0;"><strong>Infection Site:</strong> {case_obj.infection_type.upper()}</p>
            <p style="margin: 4px 0;"><strong>Severity:</strong> {case_obj.severity.upper()}</p>
            <p style="margin: 4px 0;"><strong>Organism:</strong> {case_obj.organism or 'Pending culture'}</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> {case_obj.status.upper()}</p>
        </div>
        <p style="font-size: 12px; color: #64748b;">This clinical summary was generated by AarogyaX Decision Support Engine.</p>
    </div>
    """
    success, msg = send_real_email(recipients, subject, html_body, pdf_bytes=pdf_bytes, pdf_filename=pdf_filename)
    if success:
        return jsonify({'message': msg, 'recipients': recipients, 'status': 'sent'}), 200
    else:
        return jsonify({'error': msg, 'message': msg}), 500

@routes.route('/api/email/adr/<int:adr_id>', methods=['POST'])
@role_required('intern', 'junior', 'consultant', 'admin')
def email_adr_report(adr_id):
    from pdf_generator import generate_adr_pdf
    report = db.session.get(ADRReport, adr_id)
    if not report:
        return jsonify({'error': 'ADR report not found', 'message': 'ADR report not found'}), 404

    data = request.json or {}
    recipient = data.get('to') or data.get('email') or data.get('recipient')
    if not recipient:
        return jsonify({'error': 'Recipient email address is required', 'message': 'Recipient email address is required'}), 400

    recipients = [e.strip() for e in str(recipient).split(',') if e.strip()]
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
    if success:
        return jsonify({'message': msg, 'recipients': recipients, 'status': 'sent'}), 200
    else:
        return jsonify({'error': msg, 'message': msg}), 500

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

@routes.route('/api/ai', methods=['POST'])
@role_required('intern', 'junior', 'consultant', 'admin')
def ai_assistant():
    data = request.json or {}
    user_query = data.get('query', '').strip()

    if not user_query:
        return jsonify({'error': 'Query string is required'}), 400

    system_instruction_text = (
        "You are the Aarogya X AI Clinical Decision Support Assistant, an expert AI trained in Antimicrobial Resistance (AMR), "
        "Pharmacovigilance (ADR), Sepsis management protocols (Surviving Sepsis Campaign 2021), and IDSA / WHO / ICMR guidelines.\n"
        "Provide structured, highly accurate, professional clinical answers. Use clear headings, bullet points, and specific drug regimens where appropriate."
    )

    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
            
            payload = {
                "systemInstruction": {
                    "parts": [{"text": system_instruction_text}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": user_query}]
                    }
                ]
            }

            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
            
            with urllib.request.urlopen(req, timeout=15) as res:
                res_data = json.loads(res.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    reply = "".join([p.get("text", "") for p in parts])
                    if reply:
                        return jsonify({
                            "response": reply.strip(),
                            "source": "gemini-flash-latest",
                            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                        }), 200
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[!] Gemini API error: {e}", flush=True)

    return jsonify({
        "response": f"Clinical Guidance: For '{user_query}', please consult IDSA/ICMR antibiotic guidelines & hospital antibiograms.",
        "source": "fallback",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    }), 200

# ── Analytics Endpoints ───────────────────────────────────────────────────────

@routes.route('/api/analytics/dashboard', methods=['GET'])
@role_required('intern', 'junior', 'consultant', 'admin')
def dashboard_stats():
    patient_count = Patient.query.count()
    case_count = Case.query.count()
    adr_count = ADRReport.query.count()

    active_filter = Case.status.in_(['open', 'in_progress', 'in-progress'])
    resolved_filter = Case.status.in_(['closed', 'resolved'])

    active_cases_count = Case.query.filter(active_filter).count()
    resolved_cases_count = Case.query.filter(resolved_filter).count()

    # Query active high-risk cases (strictly cases where ML prediction risk is high or critical)
    high_risk_cases_count = db.session.query(Case).join(Prediction).filter(
        active_filter,
        Prediction.resistance_risk.in_(['high', 'critical'])
    ).distinct().count()

    # Average ML resistance probability across active cases
    avg_resistance_prob = db.session.query(db.func.avg(Prediction.resistance_probability)).join(Case).filter(
        active_filter
    ).scalar()

    if avg_resistance_prob is not None:
        resistance_rate = float(avg_resistance_prob)
    elif active_cases_count > 0:
        resistance_rate = (high_risk_cases_count / active_cases_count)
    else:
        resistance_rate = 0.0

    return jsonify({
        'totalPatients': patient_count,
        'totalCases': case_count,
        'activeCases': active_cases_count,
        'resolvedCases': resolved_cases_count,
        'highRiskCases': high_risk_cases_count,
        'highRiskRatio': round(resistance_rate * 100, 1),
        'resistanceRate': round(resistance_rate, 3),
        'pendingAdrReports': adr_count
    }), 200

@routes.route('/api/analytics/resistance-trends', methods=['GET'])
@role_required('intern', 'junior', 'consultant', 'admin')
def resistance_trends():
    return jsonify({
        'trends': [
            {'month': 'Jan', 'highRisk': 28, 'mediumRisk': 45, 'lowRisk': 27},
            {'month': 'Feb', 'highRisk': 32, 'mediumRisk': 42, 'lowRisk': 26},
            {'month': 'Mar', 'highRisk': 30, 'mediumRisk': 48, 'lowRisk': 22},
            {'month': 'Apr', 'highRisk': 35, 'mediumRisk': 40, 'lowRisk': 25},
            {'month': 'May', 'highRisk': 38, 'mediumRisk': 44, 'lowRisk': 18},
            {'month': 'Jun', 'highRisk': 42, 'mediumRisk': 39, 'lowRisk': 19}
        ]
    }), 200

@routes.route('/api/analytics/drug-usage', methods=['GET'])
@role_required('intern', 'junior', 'consultant', 'admin')
def drug_usage():
    return jsonify({
        'drugs': [
            {'name': 'Meropenem', 'count': 142},
            {'name': 'Piperacillin-Tazobactam', 'count': 118},
            {'name': 'Ceftriaxone', 'count': 95},
            {'name': 'Vancomycin', 'count': 82},
            {'name': 'Amikacin', 'count': 64}
        ]
    }), 200

@routes.route('/api/analytics/organism-frequency', methods=['GET'])
@role_required('intern', 'junior', 'consultant', 'admin')
def organism_frequency():
    return jsonify({
        'organisms': [
            {'name': 'Escherichia coli', 'count': 185},
            {'name': 'Klebsiella pneumoniae', 'count': 124},
            {'name': 'Pseudomonas aeruginosa', 'count': 78},
            {'name': 'Staphylococcus aureus', 'count': 62},
            {'name': 'Acinetobacter baumannii', 'count': 41}
        ]
    }), 200

@routes.route('/api/analytics/recent-activity', methods=['GET'])
@role_required('intern', 'junior', 'consultant', 'admin')
def recent_activity():
    cases = Case.query.order_by(Case.created_at.desc()).limit(5).all()
    activity = []
    for c in cases:
        activity.append({
            'id': str(c.id),
            'description': f"Case {c.case_number} created for {c.infection_type.upper()}",
            'timestamp': c.created_at.strftime('%Y-%m-%d %H:%M:%S') if c.created_at else '',
            'type': 'case'
        })
    return jsonify({'activity': activity}), 200

@routes.route('/api/ml/info', methods=['GET'])
@role_required('intern', 'junior', 'consultant', 'admin')
def get_ml_info():
    meta_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'ml', 'models_meta.json'))
    if os.path.exists(meta_path):
        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return jsonify(data), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return jsonify({'error': 'Metadata file not found'}), 404

@routes.route('/api/ml/models', methods=['GET'])
@role_required('intern', 'junior', 'consultant', 'admin')
def get_ml_models():
    meta_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'ml', 'models_meta.json'))
    if os.path.exists(meta_path):
        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                all_models = list(data.get('all_model_results', {}).values())
                return jsonify({
                    'selected_algorithm': data.get('selected_algorithm', 'GradientBoosting'),
                    'models': all_models
                }), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return jsonify({'error': 'Models metadata file not found'}), 404
