import os
import sys
import unittest
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.insert(0, os.path.join(PROJECT_ROOT, "backend"))

from main import app
from database import SessionLocal
from models import User, Patient, AmrRecord, AmrSusceptibility

class TestAMRModule(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        # Login/Register User A (Dr. Alice - Junior)
        res_a = cls.client.post("/api/auth/register", json={
            "name": "Dr. Alice AMR",
            "email": "alice_amr@hospital.test",
            "password": "Password123!",
            "role": "junior"
        })
        if res_a.status_code == 201:
            cls.token_a = res_a.json()["token"]
            cls.user_a_id = res_a.json()["user"]["id"]
        else:
            res_a = cls.client.post("/api/auth/login", json={
                "email": "alice_amr@hospital.test",
                "password": "Password123!"
            })
            cls.token_a = res_a.json()["token"]
            cls.user_a_id = res_a.json()["user"]["id"]

        # Login/Register User B (Dr. Bob - Junior)
        res_b = cls.client.post("/api/auth/register", json={
            "name": "Dr. Bob AMR",
            "email": "bob_amr@hospital.test",
            "password": "Password123!",
            "role": "junior"
        })
        if res_b.status_code == 201:
            cls.token_b = res_b.json()["token"]
            cls.user_b_id = res_b.json()["user"]["id"]
        else:
            res_b = cls.client.post("/api/auth/login", json={
                "email": "bob_amr@hospital.test",
                "password": "Password123!"
            })
            cls.token_b = res_b.json()["token"]
            cls.user_b_id = res_b.json()["user"]["id"]

        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

    def test_01_patient_registration_separate_from_amr(self):
        """Verify patient registration contains patient demographic information only"""
        payload = {
            "name": "Suresh Patel",
            "age": 52,
            "gender": "male",
            "weight": 70.0,
            "region": "Rajasthan",
            "bloodGroup": "B+",
            "diabetes": True,
            "ckd": False
        }
        res = self.client.post("/api/patients", json=payload, headers=self.headers_a)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["name"], "Suresh Patel")
        self.assertEqual(data["age"], 52)
        # Ensure no AMR laboratory susceptibility keys exist on patient profile
        self.assertNotIn("susceptibility", data)
        self.assertNotIn("organism", data)
        self.assertNotIn("antibiotic", data)
        self.__class__.patient_a_id = data["id"]

    def test_02_create_amr_record_linked_to_patient(self):
        """Submit structured AMR record linked to registered patient with multiple susceptibility entries"""
        amr_payload = {
            "patientId": self.patient_a_id,
            "specimenType": "urine",
            "collectionDate": "2026-10-26",
            "collectionTime": "09:30",
            "infectionOrigin": "community-associated",
            "department": "Urology",
            "organism": "Escherichia coli",
            "cultureResult": "positive",
            "testingMethod": "Automated VITEK 2",
            "laboratoryStandard": "CLSI M100 2024",
            "laboratoryNotes": "Significant bacteriuria >10^5 CFU/mL isolated.",
            "susceptibilities": [
                {
                    "antibiotic": "Nitrofurantoin",
                    "susceptibility": "Susceptible (S)",
                    "micValue": "<= 16 µg/mL",
                    "diskDiffusionDiameter": 22.0,
                    "breakpoints": "S <=32, R >=128"
                },
                {
                    "antibiotic": "Ciprofloxacin",
                    "susceptibility": "Resistant (R)",
                    "micValue": ">= 4 µg/mL",
                    "diskDiffusionDiameter": 11.0,
                    "breakpoints": "S <=0.25, R >=1"
                },
                {
                    "antibiotic": "Amikacin",
                    "susceptibility": "Susceptible (S)",
                    "micValue": "<= 2 µg/mL",
                    "diskDiffusionDiameter": 24.0,
                    "breakpoints": "S <=16, R >=64"
                }
            ],
            "runPrediction": True,
            "selectedModel": "GradientBoosting",
            "severity": "moderate"
        }
        res = self.client.post("/api/amr-records", json=amr_payload, headers=self.headers_a)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        rec = data["record"]
        self.assertTrue(rec["recordId"].startswith("AMR-2026-"))
        self.assertEqual(rec["patientId"], self.patient_a_id)
        self.assertEqual(rec["organism"], "Escherichia coli")
        self.assertEqual(len(rec["susceptibilities"]), 3)
        self.assertTrue(rec["hasPrediction"])
        self.assertIsNotNone(rec["predictedRisk"])
        self.assertIsNotNone(rec["recommendedDrug"])
        self.__class__.amr_rec_id = rec["id"]

    def test_03_create_standalone_amr_record_without_patient(self):
        """Submit standalone AMR record for anonymous or external sample without patient duplication"""
        standalone_payload = {
            "anonymousPatientId": "ANON-SURV-901",
            "patientAge": 38,
            "patientGender": "female",
            "specimenType": "blood",
            "collectionDate": "2026-10-25",
            "infectionOrigin": "healthcare-associated",
            "department": "ICU / Critical Care",
            "organism": "Klebsiella pneumoniae",
            "cultureResult": "positive",
            "testingMethod": "Broth Microdilution",
            "laboratoryStandard": "EUCAST v14.0",
            "susceptibilities": [
                {
                    "antibiotic": "Meropenem",
                    "susceptibility": "Intermediate (I)",
                    "micValue": "4 µg/mL",
                    "breakpoints": "S <=2, R >=8"
                },
                {
                    "antibiotic": "Colistin",
                    "susceptibility": "Susceptible (S)",
                    "micValue": "<= 1 µg/mL",
                    "breakpoints": "I <=2, R >=4"
                }
            ],
            "runPrediction": False
        }
        res = self.client.post("/api/amr-records", json=standalone_payload, headers=self.headers_a)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        rec = data["record"]
        self.assertIsNone(rec["patientId"])
        self.assertEqual(rec["anonymousPatientId"], "ANON-SURV-901")
        self.assertEqual(rec["organism"], "Klebsiella pneumoniae")
        self.assertEqual(len(rec["susceptibilities"]), 2)

    def test_04_amr_history_listing_and_filtering(self):
        """Verify AMR History returns saved records from database with search, filter, and pagination"""
        # List all records for User A
        res = self.client.get("/api/amr-records", headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["total"], 2)
        self.assertIn("records", data)
        self.assertIn("pages", data)

        # Search by organism
        res_search = self.client.get("/api/amr-records?search=Escherichia", headers=self.headers_a)
        self.assertEqual(res_search.status_code, 200)
        search_data = res_search.json()
        self.assertTrue(all("coli" in r["organism"].lower() for r in search_data["records"]))

        # Filter by specimen
        res_specimen = self.client.get("/api/amr-records?specimen=urine", headers=self.headers_a)
        self.assertEqual(res_specimen.status_code, 200)
        spec_data = res_specimen.json()
        self.assertTrue(all(r["specimenType"] == "urine" for r in spec_data["records"]))

        # Filter by linked patient
        res_pat = self.client.get(f"/api/amr-records?patientId={self.patient_a_id}", headers=self.headers_a)
        self.assertEqual(res_pat.status_code, 200)
        pat_data = res_pat.json()
        self.assertTrue(all(r["patientId"] == self.patient_a_id for r in pat_data["records"]))

    def test_05_get_amr_record_details(self):
        """Retrieve single AMR record with full laboratory results, susceptibilities, and linked patient"""
        res = self.client.get(f"/api/amr-records/{self.amr_rec_id}", headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        rec = res.json()
        self.assertEqual(rec["id"], self.amr_rec_id)
        self.assertEqual(rec["patient"]["name"], "Suresh Patel")
        self.assertEqual(len(rec["susceptibilities"]), 3)
        self.assertEqual(rec["testingMethod"], "Automated VITEK 2")

    def test_06_update_amr_record(self):
        """Update AMR record laboratory notes and susceptibility entries"""
        update_payload = {
            "laboratoryNotes": "Updated by microbiologist: Extended incubation confirmed sensitivity.",
            "susceptibilities": [
                {
                    "antibiotic": "Amikacin",
                    "susceptibility": "Susceptible (S)",
                    "micValue": "<= 1 µg/mL"
                }
            ]
        }
        res = self.client.put(f"/api/amr-records/{self.amr_rec_id}", json=update_payload, headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        updated = res.json()["record"]
        self.assertIn("Extended incubation", updated["laboratoryNotes"])
        self.assertEqual(len(updated["susceptibilities"]), 1)

    def test_07_cross_user_isolation(self):
        """Verify strict authorization: User B cannot access, modify, or delete User A's AMR records or link to User A's patient"""
        # User B attempts to view User A's AMR record
        res_get = self.client.get(f"/api/amr-records/{self.amr_rec_id}", headers=self.headers_b)
        self.assertEqual(res_get.status_code, 403)

        # User B attempts to attach an AMR record to User A's patient
        illegal_create = {
            "patientId": self.patient_a_id,
            "specimenType": "blood",
            "collectionDate": "2026-10-26",
            "organism": "Pseudomonas aeruginosa",
            "susceptibilities": []
        }
        res_illegal = self.client.post("/api/amr-records", json=illegal_create, headers=self.headers_b)
        self.assertEqual(res_illegal.status_code, 403)

        # User B attempts to update User A's AMR record
        res_put = self.client.put(f"/api/amr-records/{self.amr_rec_id}", json={"department": "Hacked"}, headers=self.headers_b)
        self.assertEqual(res_put.status_code, 403)

        # User B attempts to delete User A's AMR record
        res_del = self.client.delete(f"/api/amr-records/{self.amr_rec_id}", headers=self.headers_b)
        self.assertEqual(res_del.status_code, 403)

        # User B's list should NOT contain User A's records
        res_list_b = self.client.get("/api/amr-records", headers=self.headers_b)
        self.assertEqual(res_list_b.status_code, 200)
        rec_ids_b = [r["id"] for r in res_list_b.json()["records"]]
        self.assertNotIn(self.amr_rec_id, rec_ids_b)

    def test_08_safe_patient_deletion_preserves_amr_records(self):
        """Deleting a patient safely disassociates AMR records rather than silently wiping clinical history"""
        # Create temporary patient with AMR record
        p_res = self.client.post("/api/patients", json={
            "name": "Audit Test Patient",
            "age": 60,
            "gender": "female"
        }, headers=self.headers_a)
        self.assertEqual(p_res.status_code, 201)
        temp_p_id = p_res.json()["id"]

        a_res = self.client.post("/api/amr-records", json={
            "patientId": temp_p_id,
            "specimenType": "sputum",
            "collectionDate": "2026-10-26",
            "organism": "Streptococcus pneumoniae"
        }, headers=self.headers_a)
        self.assertEqual(a_res.status_code, 201)
        temp_amr_id = a_res.json()["record"]["id"]

        # Delete patient
        del_res = self.client.delete(f"/api/patients/{temp_p_id}", headers=self.headers_a)
        self.assertEqual(del_res.status_code, 200)

        # Verify AMR record still exists with patient_id set to None
        check_amr = self.client.get(f"/api/amr-records/{temp_amr_id}", headers=self.headers_a)
        self.assertEqual(check_amr.status_code, 200)
        self.assertIsNone(check_amr.json()["patientId"])

if __name__ == "__main__":
    unittest.main()
