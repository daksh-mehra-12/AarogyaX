import os
import sys
import unittest
import json

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.append(os.path.join(PROJECT_ROOT, 'backend'))

from app import app
from database import db
from models import User, Patient, Case, Prediction

class TestRBAC(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.client = self.app.test_client()

        with self.app.app_context():
            db.create_all()
            from seed_rbac import seed_rbac_users
            seed_rbac_users()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def _login(self, email, password="password123"):
        res = self.client.post('/api/auth/login', json={'email': email, 'password': password})
        self.assertEqual(res.status_code, 200, f"Login failed for {email}")
        data = res.get_json()
        return data['token']

    def _headers(self, token):
        return {'Authorization': f'Bearer {token}'}

    def test_01_seed_users_exist(self):
        with self.app.app_context():
            self.assertIsNotNone(User.query.filter_by(email='intern@test.com').first())
            self.assertIsNotNone(User.query.filter_by(email='jr@test.com').first())
            self.assertIsNotNone(User.query.filter_by(email='consultant@test.com').first())
            self.assertIsNotNone(User.query.filter_by(email='admin@test.com').first())

    def test_02_patient_input_permissions(self):
        intern_token = self._login('intern@test.com')
        jr_token = self._login('jr@test.com')
        consultant_token = self._login('consultant@test.com')
        admin_token = self._login('admin@test.com')

        payload = {'name': 'Test Patient', 'age': 45, 'gender': 'Male'}

        # Intern, JR, Consultant ALLOWED
        res = self.client.post('/api/patients', json=payload, headers=self._headers(intern_token))
        self.assertIn(res.status_code, [200, 201])

        res = self.client.post('/api/patients', json=payload, headers=self._headers(jr_token))
        self.assertIn(res.status_code, [200, 201])

        res = self.client.post('/api/patients', json=payload, headers=self._headers(consultant_token))
        self.assertIn(res.status_code, [200, 201])

        # Admin DENIED (403)
        res = self.client.post('/api/patients', json=payload, headers=self._headers(admin_token))
        self.assertEqual(res.status_code, 403)
        self.assertIn('Forbidden', res.get_json()['error'])

    def test_03_stewardship_permissions(self):
        intern_token = self._login('intern@test.com')
        jr_token = self._login('jr@test.com')
        consultant_token = self._login('consultant@test.com')
        admin_token = self._login('admin@test.com')

        # Intern DENIED (403)
        res = self.client.get('/api/stewardship', headers=self._headers(intern_token))
        self.assertEqual(res.status_code, 403)

        # JR ALLOWED (Read Only)
        res = self.client.get('/api/stewardship', headers=self._headers(jr_token))
        self.assertEqual(res.status_code, 200)

        # JR DENIED from modifying stewardship (403)
        res = self.client.put('/api/stewardship', json={'config': 'new'}, headers=self._headers(jr_token))
        self.assertEqual(res.status_code, 403)

        # Consultant ALLOWED to modify
        res = self.client.put('/api/stewardship', json={'config': 'new'}, headers=self._headers(consultant_token))
        self.assertEqual(res.status_code, 200)

        # Admin ALLOWED
        res = self.client.get('/api/stewardship', headers=self._headers(admin_token))
        self.assertEqual(res.status_code, 200)

    def test_04_reporting_scope(self):
        intern_token = self._login('intern@test.com')
        jr_token = self._login('jr@test.com')
        consultant_token = self._login('consultant@test.com')
        admin_token = self._login('admin@test.com')

        # Intern & JR DENIED (403)
        res = self.client.get('/api/reports', headers=self._headers(intern_token))
        self.assertEqual(res.status_code, 403)

        res = self.client.get('/api/reports', headers=self._headers(jr_token))
        self.assertEqual(res.status_code, 403)

        # Consultant -> Department Scope
        res = self.client.get('/api/reports', headers=self._headers(consultant_token))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['scope'], 'department')

        # Admin -> Global Scope
        res = self.client.get('/api/reports', headers=self._headers(admin_token))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['scope'], 'global')

    def test_05_intern_own_case_isolation(self):
        intern_token = self._login('intern@test.com')
        jr_token = self._login('jr@test.com')

        with self.app.app_context():
            intern_user = User.query.filter_by(email='intern@test.com').first()
            jr_user = User.query.filter_by(email='jr@test.com').first()

            pat = Patient(patient_id="PAT-TEST", name="Test", age=30, gender="F")
            db.session.add(pat)
            db.session.commit()

            c_intern = Case(case_number="CASE-INT", patient_id=pat.id, infection_type="UTI", severity="mild", created_by=intern_user.id)
            c_jr = Case(case_number="CASE-JR", patient_id=pat.id, infection_type="Pneumonia", severity="severe", created_by=jr_user.id)
            db.session.add_all([c_intern, c_jr])
            db.session.commit()
            intern_case_id = c_intern.id
            jr_case_id = c_jr.id

        # Intern GET /api/cases returns ONLY intern's own cases
        res = self.client.get('/api/cases', headers=self._headers(intern_token))
        self.assertEqual(res.status_code, 200)
        cases = res.get_json()['cases']
        self.assertEqual(len(cases), 1)
        self.assertEqual(cases[0]['caseNumber'], "CASE-INT")

        # Intern GET /api/cases/<jr_case_id> returns 403 Forbidden
        res = self.client.get(f'/api/cases/{jr_case_id}', headers=self._headers(intern_token))
        self.assertEqual(res.status_code, 403)

        # JR GET /api/cases returns all cases
        res = self.client.get('/api/cases', headers=self._headers(jr_token))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.get_json()['cases']), 2)

    def test_06_admin_clinical_output_denied(self):
        admin_token = self._login('admin@test.com')
        jr_token = self._login('jr@test.com')

        with self.app.app_context():
            jr_user = User.query.filter_by(email='jr@test.com').first()
            pat = Patient(patient_id="PAT-TEST2", name="Test2", age=50, gender="M")
            db.session.add(pat)
            db.session.commit()
            c = Case(case_number="CASE-OUT", patient_id=pat.id, infection_type="UTI", severity="moderate", created_by=jr_user.id)
            db.session.add(c)
            db.session.commit()
            case_id = c.id

        # Admin attempting to view clinical case output returns 403 Forbidden
        res = self.client.get(f'/api/cases/{case_id}', headers=self._headers(admin_token))
        self.assertEqual(res.status_code, 403)

        # JR viewing clinical output returns 200 OK
        res = self.client.get(f'/api/cases/{case_id}', headers=self._headers(jr_token))
        self.assertEqual(res.status_code, 200)

if __name__ == '__main__':
    unittest.main()
