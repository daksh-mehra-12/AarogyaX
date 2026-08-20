from database import db
from datetime import datetime, timezone

def get_utc_now():
    return datetime.now(timezone.utc)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), default='intern')
    created_at = db.Column(db.DateTime, default=get_utc_now)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class Patient(db.Model):
    __tablename__ = 'patients'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.String(20), nullable=False)
    weight = db.Column(db.Float, nullable=True)
    region = db.Column(db.String(100), nullable=True)
    blood_group = db.Column(db.String(10), nullable=True)
    diabetes = db.Column(db.Boolean, default=False)
    ckd = db.Column(db.Boolean, default=False)
    pregnancy = db.Column(db.Boolean, default=False)
    immunocompromised = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=get_utc_now)

    def to_dict(self):
        return {
            'id': self.id,
            'patientId': self.patient_id,
            'name': self.name,
            'age': self.age,
            'gender': self.gender,
            'weight': self.weight,
            'region': self.region,
            'bloodGroup': self.blood_group,
            'diabetes': self.diabetes,
            'ckd': self.ckd,
            'pregnancy': self.pregnancy,
            'immunocompromised': self.immunocompromised,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class Case(db.Model):
    __tablename__ = 'cases'
    id = db.Column(db.Integer, primary_key=True)
    case_number = db.Column(db.String(50), unique=True, nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    infection_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    icu_status = db.Column(db.Boolean, default=False)
    prior_antibiotics = db.Column(db.Boolean, default=False)
    prior_antibiotics_list = db.Column(db.String(200), nullable=True)
    organism = db.Column(db.String(100), nullable=True)
    culture_result = db.Column(db.Text, nullable=True)
    cbc_value = db.Column(db.Float, nullable=True)
    crp_value = db.Column(db.Float, nullable=True)
    procalcitonin_value = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(20), default='open')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=get_utc_now)

    patient = db.relationship('Patient', backref=db.backref('cases', lazy=True))
    prediction = db.relationship('Prediction', uselist=False, lazy='select', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'caseNumber': self.case_number,
            'patientId': self.patient_id,
            'infectionType': self.infection_type,
            'severity': self.severity,
            'icuStatus': self.icu_status,
            'priorAntibiotics': self.prior_antibiotics,
            'priorAntibioticsList': self.prior_antibiotics_list,
            'organism': self.organism,
            'cultureResult': self.culture_result,
            'cbcValue': self.cbc_value,
            'crpValue': self.crp_value,
            'procalcitoninValue': self.procalcitonin_value,
            'status': self.status,
            'createdBy': self.created_by,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'patient': self.patient.to_dict() if self.patient else None,
            'prediction': self.prediction.to_dict() if self.prediction else None
        }

class Prediction(db.Model):
    __tablename__ = 'predictions'
    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    resistance_probability = db.Column(db.Float, nullable=False)
    recommended_drug = db.Column(db.String(100), nullable=False)
    alternative_drugs = db.Column(db.String(200), nullable=True)
    resistance_risk = db.Column(db.String(20), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    rationale = db.Column(db.Text, nullable=True)
    dosage = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=get_utc_now)

    def to_dict(self):
        return {
            'id': self.id,
            'caseId': self.case_id,
            'resistanceProbability': self.resistance_probability,
            'recommendedDrug': self.recommended_drug,
            'alternativeDrugs': self.alternative_drugs.split(',') if self.alternative_drugs else [],
            'resistanceRisk': self.resistance_risk,
            'confidence': self.confidence,
            'rationale': self.rationale,
            'dosage': self.dosage,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class ADRReport(db.Model):
    __tablename__ = 'adr_reports'
    id = db.Column(db.Integer, primary_key=True)
    report_number = db.Column(db.String(50), unique=True, nullable=False)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=True)
    drug_name = db.Column(db.String(100), nullable=False)
    reaction_description = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    outcome = db.Column(db.String(50), nullable=False)
    onset_date = db.Column(db.String(20), nullable=True)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=get_utc_now)

    def to_dict(self):
        return {
            'id': self.id,
            'reportNumber': self.report_number,
            'caseId': self.case_id,
            'patientId': self.patient_id,
            'drugName': self.drug_name,
            'reactionDescription': self.reaction_description,
            'severity': self.severity,
            'outcome': self.outcome,
            'onsetDate': self.onset_date,
            'status': self.status,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }
