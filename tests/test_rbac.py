import os
import sys
import unittest
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.insert(0, os.path.join(PROJECT_ROOT, "backend"))

from main import app
from database import SessionLocal
from models import User, Patient, Case, Prediction

class TestRBAC(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def _login(self, email, password="password123"):
        res = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(res.status_code, 200, f"Login failed for {email}")
        return res.json()["token"]

    def _headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_01_seed_users_exist(self):
        db = SessionLocal()
        try:
            self.assertIsNotNone(db.query(User).filter(User.email == "intern@test.com").first())
            self.assertIsNotNone(db.query(User).filter(User.email == "jr@test.com").first())
            self.assertIsNotNone(db.query(User).filter(User.email == "consultant@test.com").first())
            self.assertIsNotNone(db.query(User).filter(User.email == "admin@test.com").first())
        finally:
            db.close()

    def test_02_patient_input_permissions(self):
        intern_token = self._login("intern@test.com")
        jr_token = self._login("jr@test.com")
        consultant_token = self._login("consultant@test.com")
        admin_token = self._login("admin@test.com")

        payload = {"name": "Test Patient", "age": 45, "gender": "Male"}

        # Intern, JR, Consultant ALLOWED
        res = self.client.post("/api/patients", json=payload, headers=self._headers(intern_token))
        self.assertIn(res.status_code, [200, 201])

        res = self.client.post("/api/patients", json=payload, headers=self._headers(jr_token))
        self.assertIn(res.status_code, [200, 201])

        res = self.client.post("/api/patients", json=payload, headers=self._headers(consultant_token))
        self.assertIn(res.status_code, [200, 201])

        # Admin DENIED (403)
        res = self.client.post("/api/patients", json=payload, headers=self._headers(admin_token))
        self.assertEqual(res.status_code, 403)

    def test_03_stewardship_permissions(self):
        intern_token = self._login("intern@test.com")
        jr_token = self._login("jr@test.com")
        consultant_token = self._login("consultant@test.com")
        admin_token = self._login("admin@test.com")

        # Intern DENIED (403)
        res = self.client.get("/api/stewardship", headers=self._headers(intern_token))
        self.assertEqual(res.status_code, 403)

        # JR ALLOWED (Read Only)
        res = self.client.get("/api/stewardship", headers=self._headers(jr_token))
        self.assertEqual(res.status_code, 200)

        # JR DENIED from modifying stewardship (403)
        res = self.client.put("/api/stewardship", json={"config": "new"}, headers=self._headers(jr_token))
        self.assertEqual(res.status_code, 403)

        # Consultant ALLOWED to modify
        res = self.client.put("/api/stewardship", json={"config": "new"}, headers=self._headers(consultant_token))
        self.assertEqual(res.status_code, 200)

        # Admin ALLOWED
        res = self.client.get("/api/stewardship", headers=self._headers(admin_token))
        self.assertEqual(res.status_code, 200)

    def test_04_reporting_scope(self):
        intern_token = self._login("intern@test.com")
        jr_token = self._login("jr@test.com")
        consultant_token = self._login("consultant@test.com")
        admin_token = self._login("admin@test.com")

        # Intern & JR DENIED (403)
        res = self.client.get("/api/reports", headers=self._headers(intern_token))
        self.assertEqual(res.status_code, 403)

        res = self.client.get("/api/reports", headers=self._headers(jr_token))
        self.assertEqual(res.status_code, 403)

        # Consultant -> Department Scope
        res = self.client.get("/api/reports", headers=self._headers(consultant_token))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["scope"], "department")

        # Admin -> Global Scope
        res = self.client.get("/api/reports", headers=self._headers(admin_token))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["scope"], "global")

    def test_05_admin_clinical_output_denied(self):
        admin_token = self._login("admin@test.com")
        jr_token = self._login("jr@test.com")

        # Create a case as JR
        res_c = self.client.post("/api/cases", json={
            "patientName": "JR Clinical Patient",
            "age": 50,
            "gender": "Male",
            "infectionType": "uti",
            "severity": "moderate"
        }, headers=self._headers(jr_token))
        case_id = res_c.json()["id"]

        # Admin attempting to view clinical case output returns 403 Forbidden
        res = self.client.get(f"/api/cases/{case_id}", headers=self._headers(admin_token))
        self.assertEqual(res.status_code, 403)

        # JR viewing clinical output returns 200 OK
        res = self.client.get(f"/api/cases/{case_id}", headers=self._headers(jr_token))
        self.assertEqual(res.status_code, 200)

if __name__ == "__main__":
    unittest.main()
