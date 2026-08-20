import os
import sys
from datetime import datetime, timezone

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app import app
from database import db
from models import User, Patient, Case, Prediction, ADRReport
from seed_rbac import seed_rbac_users

def seed_demo_data():
    with app.app_context():
        db.create_all()
        seed_rbac_users()

        consultant = User.query.filter_by(email="consultant@test.com").first()
        jr = User.query.filter_by(email="jr@test.com").first()
        created_by_id = consultant.id if consultant else 1

        if Patient.query.count() == 0:
            patients = [
                Patient(patient_id="PAT-1001", name="Ramesh Sharma", age=62, gender="Male", weight=74.5, region="North Ward", blood_group="O+", diabetes=True, ckd=False, immunocompromised=False),
                Patient(patient_id="PAT-1002", name="Priya Patel", age=34, gender="Female", weight=58.0, region="East Ward", blood_group="A+", diabetes=False, ckd=False, pregnancy=False),
                Patient(patient_id="PAT-1003", name="Anil Kumar", age=71, gender="Male", weight=68.2, region="ICU Block B", blood_group="B+", diabetes=True, ckd=True, immunocompromised=True),
                Patient(patient_id="PAT-1004", name="Sunita Rao", age=49, gender="Female", weight=62.4, region="South Ward", blood_group="AB+", diabetes=False, ckd=False, pregnancy=False),
                Patient(patient_id="PAT-1005", name="Vikram Singh", age=55, gender="Male", weight=80.1, region="West Ward", blood_group="O-", diabetes=True, ckd=False, immunocompromised=False),
            ]
            db.session.add_all(patients)
            db.session.commit()
            print("[+] Seeded 5 patients")

        if Case.query.count() == 0:
            p1 = Patient.query.filter_by(patient_id="PAT-1001").first()
            p2 = Patient.query.filter_by(patient_id="PAT-1002").first()
            p3 = Patient.query.filter_by(patient_id="PAT-1003").first()
            p4 = Patient.query.filter_by(patient_id="PAT-1004").first()

            cases = [
                Case(case_number="CAS-2026-001", patient_id=p1.id, infection_type="uti", severity="severe", icu_status=True, prior_antibiotics=True, prior_antibiotics_list="Ciprofloxacin, Amoxicillin", organism="E. coli", culture_result="Extended-Spectrum Beta-Lactamase (ESBL) Positive", cbc_value=14.5, crp_value=48.2, procalcitonin_value=2.4, status="open", created_by=created_by_id),
                Case(case_number="CAS-2026-002", patient_id=p2.id, infection_type="respiratory", severity="moderate", icu_status=False, prior_antibiotics=False, organism="Klebsiella pneumoniae", culture_result="Gram-negative bacilli isolated", cbc_value=11.2, crp_value=18.5, procalcitonin_value=0.6, status="open", created_by=created_by_id),
                Case(case_number="CAS-2026-003", patient_id=p3.id, infection_type="bloodstream", severity="critical", icu_status=True, prior_antibiotics=True, prior_antibiotics_list="Vancomycin, Meropenem", organism="Staphylococcus aureus", culture_result="Methicillin-Resistant Staphylococcus Aureus (MRSA)", cbc_value=19.8, crp_value=92.4, procalcitonin_value=8.1, status="open", created_by=created_by_id),
                Case(case_number="CAS-2026-004", patient_id=p4.id, infection_type="skin_soft_tissue", severity="mild", icu_status=False, prior_antibiotics=False, organism="Pseudomonas aeruginosa", culture_result="Sensitive to Amikacin", cbc_value=8.9, crp_value=9.1, procalcitonin_value=0.1, status="closed", created_by=created_by_id),
            ]
            db.session.add_all(cases)
            db.session.commit()
            print("[+] Seeded 4 cases")

        if Prediction.query.count() == 0:
            c1 = Case.query.filter_by(case_number="CAS-2026-001").first()
            c2 = Case.query.filter_by(case_number="CAS-2026-002").first()
            c3 = Case.query.filter_by(case_number="CAS-2026-003").first()

            preds = [
                Prediction(case_id=c1.id, resistance_probability=0.84, recommended_drug="Meropenem 1g IV q8h", alternative_drugs="Amikacin, Colistin", resistance_risk="High", confidence=0.92, rationale="High resistance probability for E. coli with prior fluoroquinolone exposure.", dosage="1g IV every 8 hours over 3 hours infusion"),
                Prediction(case_id=c2.id, resistance_probability=0.32, recommended_drug="Ceftriaxone 2g IV q24h", alternative_drugs="Levofloxacin, Piperacillin-Tazobactam", resistance_risk="Low", confidence=0.88, rationale="Moderate severity respiratory infection with low resistance profile.", dosage="2g IV once daily"),
                Prediction(case_id=c3.id, resistance_probability=0.91, recommended_drug="Linezolid 600mg IV q12h", alternative_drugs="Daptomycin, Vancomycin", resistance_risk="High", confidence=0.95, rationale="MRSA strain with high beta-lactam resistance in ICU environment.", dosage="600mg IV every 12 hours"),
            ]
            db.session.add_all(preds)
            db.session.commit()
            print("[+] Seeded 3 predictions")

        if ADRReport.query.count() == 0:
            c1 = Case.query.filter_by(case_number="CAS-2026-001").first()
            p1 = Patient.query.filter_by(patient_id="PAT-1001").first()
            adr = ADRReport(report_number="ADR-2026-01", case_id=c1.id, patient_id=p1.id, drug_name="Vancomycin", reaction_description="Red Man Syndrome with mild hypotension and flushing", severity="Moderate", outcome="Recovered with slowing infusion rate", onset_date="2026-08-18", status="investigating")
            db.session.add(adr)
            db.session.commit()
            print("[+] Seeded 1 ADR report")

if __name__ == "__main__":
    seed_demo_data()
