import os
import json
import joblib
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(__file__)
META_PATH = os.path.join(BASE_DIR, 'models_meta.json')


def load_model_payload(path):
    if os.path.exists(path):
        return joblib.load(path)
    return None


def load_metadata():
    if os.path.exists(META_PATH):
        with open(META_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


_MODEL_FILES = {
    "GradientBoosting": os.path.join(BASE_DIR, "gradient_boosting.pkl"),
    "RandomForest": os.path.join(BASE_DIR, "random_forest.pkl"),
    "DecisionTree": os.path.join(BASE_DIR, "decision_tree.pkl"),
    "LogisticRegression": os.path.join(BASE_DIR, "logistic_regression.pkl")
}

_LOADED_MODELS = {}
for name, fpath in _MODEL_FILES.items():
    p = load_model_payload(fpath)
    if p:
        _LOADED_MODELS[name] = p

_METADATA = load_metadata()


def normalize_infection(inf_raw):
    inf_str = str(inf_raw or '').strip().lower()
    if 'pneumonia' in inf_str or 'vap' in inf_str:
        return 'Ventilator-Associated Pneumonia'
    elif 'sepsis' in inf_str or 'blood' in inf_str or 'bemia' in inf_str:
        return 'bloodstream infections'
    elif 'uti' in inf_str or 'urinary' in inf_str:
        return 'UTI'
    return inf_raw.strip() if inf_raw else 'UTI'


def normalize_organism(org_raw):
    org_str = str(org_raw or '').strip().lower()
    if 'e. coli' in org_str or 'escherichia' in org_str:
        return 'E. coli'
    elif 'klebsiella' in org_str:
        return 'Klebsiella'
    elif 'pseudomonas' in org_str:
        return 'Pseudomonas'
    elif 'acinetobacter' in org_str:
        return 'Acinetobacter'
    elif 'enterococcus' in org_str:
        return 'Enterococcus'
    elif 'staphylococcus' in org_str:
        return 'Staphylococcus aureus'
    return org_raw.strip() if org_raw else 'E. coli'


def normalize_antibiotic(ab_raw):
    ab_str = str(ab_raw or '').strip()
    return ab_str if ab_str else 'Amikacin'


def predict_amr(data):
    raw_inf = data.get('infectionType', 'UTI')
    raw_org = data.get('organism', 'E. coli')
    raw_ab = data.get('antibiotic', 'Amikacin')
    raw_sens = data.get('sensitivity', None)
    req_model = data.get('selectedModel') or data.get('modelName') or 'GradientBoosting'

    icu = bool(data.get('icuStatus', False))
    pregnancy = bool(data.get('pregnancy', False))
    prior_ab = bool(data.get('priorAntibiotics', False))
    severity = str(data.get('severity', 'mild')).strip().lower()

    inf_type = normalize_infection(raw_inf)
    organism = normalize_organism(raw_org)
    antibiotic = normalize_antibiotic(raw_ab)

    if raw_sens is not None and str(raw_sens).strip() != '':
        sensitivity = float(raw_sens)
    else:
        # Dynamically infer realistic clinical sensitivity baseline from patient severity & ICU flags
        if severity == 'mild' and not icu and not prior_ab:
            sensitivity = 88.0  # -> Low Risk
        elif severity == 'moderate' or (severity == 'mild' and prior_ab):
            sensitivity = 62.0  # -> Medium Risk
        elif severity == 'severe' and not icu:
            sensitivity = 28.0  # -> High Risk
        elif icu or severity == 'critical':
            sensitivity = 8.0   # -> Critical Risk
        else:
            sensitivity = 75.0  # -> Low/Medium Risk

    input_df = pd.DataFrame([{
        'Infection': inf_type,
        'Organism': organism,
        'Antibiotic': antibiotic,
        'Sensitivity (%)': sensitivity
    }])

    # Retrieve selected model payload directly
    payload = _LOADED_MODELS.get(req_model) or _LOADED_MODELS.get('GradientBoosting')

    if not payload or "pipeline" not in payload:
        return {"error": f"Selected ML model '{req_model}' is unavailable or failed to load."}

    pipeline = payload["pipeline"]
    model_name = payload.get("model_name", req_model)
    overall_accuracy = payload.get("accuracy", 1.0)

    try:
        pred_res = pipeline.predict(input_df)
        predicted_class_idx = int(pred_res[0])
        prob_res = pipeline.predict_proba(input_df)[0]
        probabilities = [float(p) for p in prob_res]
    except Exception as exc:
        return {"error": f"ML pipeline execution failed for model '{model_name}': {str(exc)}"}

    risk_levels = ['low', 'medium', 'high', 'critical']
    predicted_risk_level = risk_levels[min(predicted_class_idx, len(risk_levels) - 1)]

    # Actual model confidence for predicted class
    confidence = round(float(probabilities[predicted_class_idx]), 4)
    # Real resistance probability (non-low risk probability)
    resistance_probability = round(float(1.0 - probabilities[0]), 4)

    feature_impacts = [
        {"feature": f"Infection Type ({inf_type})", "impact": "Primary Site"},
        {"feature": f"Organism ({organism})", "impact": "Pathogen Target"},
        {"feature": f"Antibiotic ({antibiotic})", "impact": "Regimen Spectrum"},
        {"feature": "Clinical Sensitivity Data", "impact": "Surveillance Metric" if not np.isnan(sensitivity) else "Imputed Mean"}
    ]

    # Rule-Based Clinical Recommendation Protocol
    recommended = 'Nitrofurantoin'
    alternatives = ['Fosfomycin', 'Ciprofloxacin']
    dosage = '100 mg PO twice daily for 5-7 days'

    if 'Pneumonia' in inf_type:
        recommended = 'Piperacillin-Tazobactam'
        alternatives = ['Meropenem', 'Levofloxacin']
        dosage = '4.5 g IV 6-8 hourly'
    elif 'bloodstream' in inf_type or icu:
        recommended = 'Meropenem'
        alternatives = ['Piperacillin-Tazobactam', 'Vancomycin']
        dosage = '1 g IV 8-hourly'
    elif pregnancy:
        recommended = 'Amoxicillin-Clavulanate'
        alternatives = ['Ceftriaxone', 'Fosfomycin']
        dosage = '1.2 g IV 8-hourly'
    elif predicted_risk_level == 'critical':
        recommended = 'Meropenem'
        alternatives = ['Colistin', 'Vancomycin']
        dosage = '2 g IV 8-hourly'

    rationale = (
        f"ML Risk Inference: Trained {model_name} model predicted {predicted_risk_level.upper()} AMR risk "
        f"with {int(confidence * 100)}% model confidence (Overall Test Accuracy: {int(overall_accuracy * 100)}%). "
        f"Rule-Based Regimen: {recommended} ({dosage}) recommended as first-line therapy."
    )

    return {
        'recommendedDrug': recommended,
        'alternativeDrugs': alternatives,
        'resistanceProbability': resistance_probability,
        'resistanceRisk': predicted_risk_level,
        'confidence': confidence,
        'rationale': rationale,
        'dosage': dosage,
        'modelAccuracy': overall_accuracy,
        'modelName': model_name,
        'featureImportance': feature_impacts,
        'classProbabilities': {
            'low': round(probabilities[0], 4) if len(probabilities) > 0 else 0.0,
            'medium': round(probabilities[1], 4) if len(probabilities) > 1 else 0.0,
            'high': round(probabilities[2], 4) if len(probabilities) > 2 else 0.0,
            'critical': round(probabilities[3], 4) if len(probabilities) > 3 else 0.0,
        }
    }
