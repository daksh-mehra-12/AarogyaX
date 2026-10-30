import os
import sys
import unittest
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.insert(0, os.path.join(PROJECT_ROOT, "backend"))

from main import app
from database import SessionLocal
from models import User, Patient, Case, Prediction, ADRReport

class TestCrossUserSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        # Register User A
        res_a = cls.client.post("/api/auth/register", json={
            "name": "Dr. User Alpha",
            "email": "user_a_sec@hospital.test",
            "password": "Password123!",
            "role": "consultant"
        })
        if res_a.status_code == 201:
            cls.token_a = res_a.json()["token"]
            cls.user_a_id = res_a.json()["user"]["id"]
        else:
            # Login if exists
            res_a = cls.client.post("/api/auth/login", json={
                "email": "user_a_sec@hospital.test",
                "password": "Password123!"
            })
            cls.token_a = res_a.json()["token"]
            cls.user_a_id = res_a.json()["user"]["id"]

        # Register User B
        res_b = cls.client.post("/api/auth/register", json={
            "name": "Dr. User Bravo",
            "email": "user_b_sec@hospital.test",
            "password": "Password123!",
            "role": "consultant"
        })
        if res_b.status_code == 201:
            cls.token_b = res_b.json()["token"]
            cls.user_b_id = res_b.json()["user"]["id"]
        else:
            res_b = cls.client.post("/api/auth/login", json={
                "email": "user_b_sec@hospital.test",
                "password": "Password123!"
            })
            cls.token_b = res_b.json()["token"]
            cls.user_b_id = res_b.json()["user"]["id"]

        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

    def test_01_user_can_create_and_access_own_records(self):
        # User A creates patient
        res_p = self.client.post("/api/patients", json={
            "name": "Alpha Patient",
            "age": 42,
            "gender": "Female",
            "diabetes": True
        }, headers=self.headers_a)
        self.assertEqual(res_p.status_code, 201)
        pat_a_id = res_p.json()["id"]

        # User A creates case
        res_c = self.client.post("/api/cases", json={
            "patientId": pat_a_id,
            "infectionType": "pneumonia",
            "severity": "moderate",
            "organism": "Klebsiella pneumoniae"
        }, headers=self.headers_a)
        self.assertEqual(res_c.status_code, 201)
        case_a_id = res_c.json()["id"]

        # User A creates ADR report
        res_adr = self.client.post("/api/adr", json={
            "drugName": "Meropenem",
            "reactionDescription": "Severe drug rash and pruritus",
            "severity": "moderate",
            "outcome": "recovering",
            "caseId": case_a_id,
            "patientId": pat_a_id
        }, headers=self.headers_a)
        self.assertEqual(res_adr.status_code, 201)
        adr_a_id = res_adr.json()["id"]

        # User A can access own records
        get_p = self.client.get(f"/api/patients/{pat_a_id}", headers=self.headers_a)
        self.assertEqual(get_p.status_code, 200)
        self.assertEqual(get_p.json()["name"], "Alpha Patient")

        get_c = self.client.get(f"/api/cases/{case_a_id}", headers=self.headers_a)
        self.assertEqual(get_c.status_code, 200)

        get_adr = self.client.get(f"/api/adr/{adr_a_id}", headers=self.headers_a)
        self.assertEqual(get_adr.status_code, 200)

    def test_02_cross_user_isolation_read_denied(self):
        # User A creates a confidential case
        res_c = self.client.post("/api/cases", json={
            "patientName": "Confidential Alpha",
            "age": 55,
            "gender": "Male",
            "infectionType": "uti",
            "severity": "severe",
            "organism": "Escherichia coli"
        }, headers=self.headers_a)
        self.assertEqual(res_c.status_code, 201)
        case_a_id = res_c.json()["id"]
        pat_a_id = res_c.json()["patientId"]

        # User B attempts to read User A's case by direct ID -> MUST return 403 Forbidden
        res_b_case = self.client.get(f"/api/cases/{case_a_id}", headers=self.headers_b)
        self.assertEqual(res_b_case.status_code, 403, "User B should be denied access to User A's case")

        # User B attempts to read User A's patient by direct ID -> MUST return 403 Forbidden
        res_b_pat = self.client.get(f"/api/patients/{pat_a_id}", headers=self.headers_b)
        self.assertEqual(res_b_pat.status_code, 403, "User B should be denied access to User A's patient")

    def test_03_cross_user_isolation_update_and_delete_denied(self):
        # User A creates a case
        res_c = self.client.post("/api/cases", json={
            "patientName": "Protected Alpha",
            "age": 30,
            "gender": "Female",
            "infectionType": "uti",
            "severity": "mild"
        }, headers=self.headers_a)
        case_a_id = res_c.json()["id"]
        pat_a_id = res_c.json()["patientId"]

        # User B attempts to modify User A's case -> MUST return 403
        res_mod = self.client.put(f"/api/cases/{case_a_id}", json={"status": "resolved"}, headers=self.headers_b)
        self.assertEqual(res_mod.status_code, 403, "User B must not modify User A's case")

        # User B attempts to delete User A's case -> MUST return 403
        res_del_case = self.client.delete(f"/api/cases/{case_a_id}", headers=self.headers_b)
        self.assertEqual(res_del_case.status_code, 403, "User B must not delete User A's case")

        # User B attempts to delete User A's patient -> MUST return 403
        res_del_pat = self.client.delete(f"/api/patients/{pat_a_id}", headers=self.headers_b)
        self.assertEqual(res_del_pat.status_code, 403, "User B must not delete User A's patient")

    def test_04_cross_user_pdf_download_and_email_denied(self):
        # User A creates case and ADR
        res_c = self.client.post("/api/cases", json={
            "patientName": "Download Test Alpha",
            "age": 60,
            "gender": "Male",
            "infectionType": "bacteremia",
            "severity": "severe"
        }, headers=self.headers_a)
        case_a_id = res_c.json()["id"]

        res_adr = self.client.post("/api/adr", json={
            "drugName": "Vancomycin",
            "reactionDescription": "Red Man Syndrome during infusion",
            "severity": "severe",
            "outcome": "recovered",
            "caseId": case_a_id
        }, headers=self.headers_a)
        adr_a_id = res_adr.json()["id"]

        # User B attempts to download User A's case PDF -> MUST return 403
        res_pdf_case = self.client.get(f"/api/cases/{case_a_id}/pdf", headers=self.headers_b)
        self.assertEqual(res_pdf_case.status_code, 403, "User B must not download User A's case PDF")

        # User B attempts to download User A's ADR PDF -> MUST return 403
        res_pdf_adr = self.client.get(f"/api/adr/{adr_a_id}/pdf", headers=self.headers_b)
        self.assertEqual(res_pdf_adr.status_code, 403, "User B must not download User A's ADR PDF")

        # User B attempts to trigger email dispatch for User A's ADR report -> MUST return 403
        res_email = self.client.post(f"/api/email/adr/{adr_a_id}", json={"to": "external@test.com"}, headers=self.headers_b)
        self.assertEqual(res_email.status_code, 403, "User B must not email User A's report")

    def test_05_list_endpoints_never_leak_other_user_records(self):
        # User A list cases -> all cases must have created_by == user_a_id
        cases_a = self.client.get("/api/cases", headers=self.headers_a).json()["cases"]
        for c in cases_a:
            self.assertEqual(c["createdBy"], self.user_a_id)

        # User B list cases -> all cases must have created_by == user_b_id
        cases_b = self.client.get("/api/cases", headers=self.headers_b).json()["cases"]
        for c in cases_b:
            self.assertEqual(c["createdBy"], self.user_b_id)

        # User A list patients -> none belonging to User B
        pats_a = self.client.get("/api/patients", headers=self.headers_a).json()["patients"]
        for p in pats_a:
            self.assertEqual(p["createdBy"], self.user_a_id)

    def test_06_unauthenticated_requests_denied(self):
        # Direct requests without token -> 401 Unauthorized
        self.assertEqual(self.client.get("/api/patients").status_code, 401)
        self.assertEqual(self.client.get("/api/cases").status_code, 401)
        self.assertEqual(self.client.get("/api/adr").status_code, 401)
        self.assertEqual(self.client.get("/api/analytics/dashboard").status_code, 401)

if __name__ == "__main__":
    unittest.main()
