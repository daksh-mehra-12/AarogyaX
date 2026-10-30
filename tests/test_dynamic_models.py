import os
import sys
import unittest
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.insert(0, os.path.join(PROJECT_ROOT, "backend"))

from main import app

class TestDynamicModels(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        res = self.client.post("/api/auth/login", json={"email": "intern@test.com", "password": "password123"})
        self.assertEqual(res.status_code, 200)
        self.token = res.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_dynamic_model_predictions(self):
        models = ["GradientBoosting", "RandomForest", "DecisionTree", "LogisticRegression"]
        for m in models:
            payload = {
                "selectedModel": m,
                "infectionType": "uti",
                "organism": "E. coli",
                "antibiotic": "Amikacin",
                "severity": "moderate",
                "age": 50
            }
            res = self.client.post("/api/predict", json=payload, headers=self.headers)
            self.assertEqual(res.status_code, 200, f"Prediction failed for model {m}: {res.text}")
            data = res.json()
            pred = data.get("prediction") or data
            self.assertEqual(pred["modelName"], m, f"Model name mismatch for {m}")
            self.assertIn("recommendedDrug", pred)
            self.assertIn("resistanceRisk", pred)
            print(f"[+] Prediction successful for model: {m} (Accuracy: {pred['modelAccuracy']*100:.1f}%)")

if __name__ == "__main__":
    unittest.main()
