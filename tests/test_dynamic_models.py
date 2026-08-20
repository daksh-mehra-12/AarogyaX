import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.append(os.path.join(PROJECT_ROOT, 'backend'))

from app import app

class TestDynamicModels(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
        # Get intern token
        res = self.client.post('/api/auth/login', json={'email': 'intern@test.com', 'password': 'password123'})
        self.token = res.get_json()['token']
        self.headers = {'Authorization': f'Bearer {self.token}'}

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
            res = self.client.post('/api/predict', json=payload, headers=self.headers)
            self.assertEqual(res.status_code, 200, f"Prediction failed for model {m}")
            data = res.get_json()
            pred = data.get('prediction') or data
            self.assertEqual(pred['modelName'], m, f"Model name mismatch for {m}")
            self.assertIn('recommendedDrug', pred)
            print(f"[+] Prediction successful for model: {m} (Model Accuracy: {pred['modelAccuracy']*100:.1f}%)")

if __name__ == '__main__':
    unittest.main()
