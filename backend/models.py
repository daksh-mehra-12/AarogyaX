from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship, backref
from database import Base

def get_utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password = Column(String(200), nullable=False)
    role = Column(String(50), default='intern')
    created_at = Column(DateTime, default=get_utc_now)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class Patient(Base):
    __tablename__ = 'patients'
    id = Column(Integer, primary_key=True)
    patient_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    weight = Column(Float, nullable=True)
    region = Column(String(100), nullable=True)
    blood_group = Column(String(10), nullable=True)
    diabetes = Column(Boolean, default=False)
    ckd = Column(Boolean, default=False)
    pregnancy = Column(Boolean, default=False)
    immunocompromised = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

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
            'diabetes': bool(self.diabetes),
            'ckd': bool(self.ckd),
            'pregnancy': bool(self.pregnancy),
            'immunocompromised': bool(self.immunocompromised),
            'createdBy': self.created_by,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class Case(Base):
    __tablename__ = 'cases'
    id = Column(Integer, primary_key=True)
    case_number = Column(String(50), unique=True, nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    infection_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    icu_status = Column(Boolean, default=False)
    prior_antibiotics = Column(Boolean, default=False)
    prior_antibiotics_list = Column(String(200), nullable=True)
    organism = Column(String(100), nullable=True)
    culture_result = Column(Text, nullable=True)
    cbc_value = Column(Float, nullable=True)
    crp_value = Column(Float, nullable=True)
    procalcitonin_value = Column(Float, nullable=True)
    status = Column(String(20), default='open')
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

    patient = relationship('Patient', backref=backref('cases', lazy=True))
    prediction = relationship('Prediction', uselist=False, lazy='select', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'caseNumber': self.case_number,
            'patientId': self.patient_id,
            'infectionType': self.infection_type,
            'severity': self.severity,
            'icuStatus': bool(self.icu_status),
            'priorAntibiotics': bool(self.prior_antibiotics),
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

class Prediction(Base):
    __tablename__ = 'predictions'
    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey('cases.id'), nullable=False)
    resistance_probability = Column(Float, nullable=False)
    recommended_drug = Column(String(100), nullable=False)
    alternative_drugs = Column(String(200), nullable=True)
    resistance_risk = Column(String(20), nullable=False)
    confidence = Column(Float, nullable=False)
    rationale = Column(Text, nullable=True)
    dosage = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

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

class ADRReport(Base):
    __tablename__ = 'adr_reports'
    id = Column(Integer, primary_key=True)
    report_number = Column(String(50), unique=True, nullable=False)
    case_id = Column(Integer, ForeignKey('cases.id'), nullable=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=True)
    drug_name = Column(String(100), nullable=False)
    reaction_description = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)
    outcome = Column(String(50), nullable=False)
    onset_date = Column(String(20), nullable=True)
    status = Column(String(20), default='pending')
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

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
            'createdBy': self.created_by,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class AmrSusceptibility(Base):
    __tablename__ = 'amr_susceptibilities'
    id = Column(Integer, primary_key=True)
    amr_record_id = Column(Integer, ForeignKey('amr_records.id', ondelete='CASCADE'), nullable=False)
    antibiotic = Column(String(100), nullable=False)
    susceptibility = Column(String(30), nullable=False)  # 'Susceptible (S)', 'Intermediate (I)', 'Resistant (R)', 'Unknown'
    mic_value = Column(String(50), nullable=True)        # e.g. '<= 2', '16', '>= 64'
    disk_diffusion_diameter = Column(Float, nullable=True) # in mm, e.g. 18.0
    breakpoints = Column(String(100), nullable=True)     # e.g. 'S <=16, R >=64'
    created_at = Column(DateTime, default=get_utc_now)

    def to_dict(self):
        return {
            'id': self.id,
            'amrRecordId': self.amr_record_id,
            'antibiotic': self.antibiotic,
            'susceptibility': self.susceptibility,
            'micValue': self.mic_value,
            'diskDiffusionDiameter': self.disk_diffusion_diameter,
            'breakpoints': self.breakpoints,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class AmrRecord(Base):
    __tablename__ = 'amr_records'
    id = Column(Integer, primary_key=True)
    record_id = Column(String(50), unique=True, nullable=False)
    sample_id = Column(String(50), nullable=True)
    patient_id = Column(Integer, ForeignKey('patients.id', ondelete='SET NULL'), nullable=True)
    anonymous_patient_id = Column(String(50), nullable=True)
    patient_age = Column(Integer, nullable=True)
    patient_gender = Column(String(20), nullable=True)
    specimen_type = Column(String(50), nullable=False)   # blood, urine, sputum, stool, other
    collection_date = Column(String(20), nullable=False)
    collection_time = Column(String(20), nullable=True)
    infection_origin = Column(String(50), default='unknown') # community-associated, healthcare-associated, unknown
    department = Column(String(100), nullable=True)
    organism = Column(String(100), nullable=False)
    culture_result = Column(String(50), default='positive')
    testing_method = Column(String(100), nullable=True)
    laboratory_standard = Column(String(100), default='CLSI M100 2024')
    laboratory_notes = Column(Text, nullable=True)

    # ML Prediction fields
    has_prediction = Column(Boolean, default=False)
    predicted_risk = Column(String(20), nullable=True)      # low, medium, high, critical
    predicted_probability = Column(Float, nullable=True)
    predicted_confidence = Column(Float, nullable=True)
    recommended_drug = Column(String(100), nullable=True)
    alternative_drugs = Column(String(200), nullable=True)
    dosage_guidance = Column(String(200), nullable=True)
    prediction_rationale = Column(Text, nullable=True)
    prediction_model = Column(String(50), nullable=True)

    # Clinical context
    severity = Column(String(20), default='moderate')
    icu_status = Column(Boolean, default=False)
    prior_antibiotics = Column(Boolean, default=False)

    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

    patient = relationship('Patient', backref=backref('amr_records', lazy=True))
    susceptibilities = relationship('AmrSusceptibility', backref='amr_record', lazy='select', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'recordId': self.record_id,
            'sampleId': self.sample_id,
            'patientId': self.patient_id,
            'anonymousPatientId': self.anonymous_patient_id,
            'patientAge': self.patient_age,
            'patientGender': self.patient_gender,
            'specimenType': self.specimen_type,
            'collectionDate': self.collection_date,
            'collectionTime': self.collection_time,
            'infectionOrigin': self.infection_origin,
            'department': self.department,
            'organism': self.organism,
            'cultureResult': self.culture_result,
            'testingMethod': self.testing_method,
            'laboratoryStandard': self.laboratory_standard,
            'laboratoryNotes': self.laboratory_notes,
            'hasPrediction': bool(self.has_prediction),
            'predictedRisk': self.predicted_risk,
            'predictedProbability': self.predicted_probability,
            'predictedConfidence': self.predicted_confidence,
            'recommendedDrug': self.recommended_drug,
            'alternativeDrugs': self.alternative_drugs.split(',') if self.alternative_drugs else [],
            'dosageGuidance': self.dosage_guidance,
            'predictionRationale': self.prediction_rationale,
            'predictionModel': self.prediction_model,
            'severity': self.severity,
            'icuStatus': bool(self.icu_status),
            'priorAntibiotics': bool(self.prior_antibiotics),
            'createdBy': self.created_by,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updatedAt': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None,
            'patient': self.patient.to_dict() if self.patient else None,
            'susceptibilities': [s.to_dict() for s in self.susceptibilities] if self.susceptibilities else []
        }


class PatientVital(Base):
    __tablename__ = 'patient_vitals'
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    blood_pressure = Column(String(30), nullable=False)
    systolic = Column(Integer, nullable=True)
    diastolic = Column(Integer, nullable=True)
    heart_rate = Column(Integer, nullable=False)
    temperature = Column(Float, nullable=False)
    recorded_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

    def to_dict(self):
        return {
            'id': self.id,
            'patientId': self.patient_id,
            'bloodPressure': self.blood_pressure,
            'systolic': self.systolic,
            'diastolic': self.diastolic,
            'heartRate': self.heart_rate,
            'temperature': self.temperature,
            'recordedBy': self.recorded_by,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
        }
