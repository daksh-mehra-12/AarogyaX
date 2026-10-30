import os
import json
import joblib
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
META_PATH = os.path.join(BASE_DIR, 'models_meta.json')
DATASET_PATH = os.path.join(
    PROJECT_ROOT,
    'dataset',
    'antimicrobial_resistance_project_-_Organism_to_drug_1775057649552.csv'
)


def normalize_infection(inf_raw) -> str:
    inf_str = str(inf_raw or '').strip().lower()
    if 'pneumonia' in inf_str or 'vap' in inf_str or 'respiratory' in inf_str or 'sputum' in inf_str:
        return 'Ventilator-Associated Pneumonia'
    elif 'sepsis' in inf_str or 'blood' in inf_str or 'bemia' in inf_str:
        return 'bloodstream infections'
    elif 'uti' in inf_str or 'urinary' in inf_str or 'urine' in inf_str:
        return 'UTI'
    return 'UTI'


def normalize_organism(org_raw) -> str:
    org_str = str(org_raw or '').strip().lower()
    if 'e. coli' in org_str or 'escherichia' in org_str:
        return 'E. coli'
    elif 'klebsiella' in org_str:
        return 'Klebsiella pneumoniae'
    elif 'pseudomonas' in org_str:
        return 'Pseudomonas aeruginosa'
    elif 'acinetobacter' in org_str:
        return 'Acinetobacter baumannii'
    elif 'enterococcus' in org_str:
        return 'Enterococcus spp.'
    elif 'staphylococcus' in org_str:
        return 'Staphylococcus aureus'
    elif 'enterobacter' in org_str:
        return 'Enterobacterales'
    return str(org_raw).strip() if org_raw else 'E. coli'


def normalize_antibiotic(ab_raw) -> str:
    ab_str = str(ab_raw or '').strip()
    if not ab_str:
        return 'Amikacin'
    low = ab_str.lower()
    mapping = {
        'amikacin': 'Amikacin',
        'cefepime': 'Cefepime',
        'cefotaxime': 'Cefotaxime',
        'ceftazidime': 'Ceftazidime',
        'ceftriaxone': 'Ceftriaxone',
        'ciprofloxacin': 'Ciprofloxacin',
        'colistin': 'Colistin',
        'ertapenem': 'Ertapenem',
        'gentamicin': 'Gentamicin',
        'imipenem': 'Imipenem',
        'levofloxacin': 'Levofloxacin',
        'meropenem': 'Meropenem',
        'minocycline': 'Minocycline',
        'piperacillin-tazobactam': 'Piperacillin-Tazobactam',
        'piperacillin/tazobactam': 'Piperacillin-Tazobactam',
        'piperacillin': 'Piperacillin',
        'tetracycline': 'Tetracycline',
        'tobramycin': 'Tobramycin',
        'amoxicillin-clavulanate': 'Amoxicillin-Clavulanate',
        'amoxicillin/clavulanate': 'Amoxicillin-Clavulanate',
        'ampicillin': 'Ampicillin',
        'linezolid': 'Linezolid',
        'nitrofurantoin': 'Nitrofurantoin',
        'vancomycin': 'Vancomycin',
        'fosfomycin': 'Fosfomycin',
        'tigecycline': 'Tigecycline',
        'clindamycin': 'Clindamycin',
        'tmp-smx': 'TMP-SMX',
        'trimethoprim-sulfamethoxazole': 'TMP-SMX',
        'cotrimoxazole': 'TMP-SMX',
        'cefazolin': 'Cefazolin',
        'netilmicin': 'Netilmicin',
    }
    return mapping.get(low, ab_str)


# Standard evidence-based adult dosing regimens by antibiotic
_DRUG_DOSAGE_MAP = {
    'Amikacin': '15 mg/kg IV once daily (monitor trough & renal function)',
    'Amoxicillin-Clavulanate': '1.2 g IV 8-hourly or 625 mg PO 8-hourly',
    'Ampicillin': '2 g IV 6-hourly',
    'Cefazolin': '1–2 g IV 8-hourly',
    'Cefepime': '2 g IV 8–12 hourly',
    'Cefotaxime': '1–2 g IV 8-hourly',
    'Ceftazidime': '2 g IV 8-hourly',
    'Ceftriaxone': '1–2 g IV once daily',
    'Ciprofloxacin': '400 mg IV 12-hourly or 500 mg PO twice daily',
    'Clindamycin': '600 mg IV/PO 8-hourly',
    'Colistin': '9 MU IV loading dose, then 4.5 MU IV 12-hourly (Reserve — TDM required)',
    'Ertapenem': '1 g IV once daily',
    'Fosfomycin': '3 g PO single dose (uncomplicated UTI) or q48h x 3 doses',
    'Gentamicin': '5–7 mg/kg IV once daily',
    'Imipenem': '500 mg IV 6-hourly',
    'Levofloxacin': '750 mg IV/PO once daily',
    'Linezolid': '600 mg IV/PO 12-hourly',
    'Meropenem': '1 g IV 8-hourly (2 g IV 8-hourly for severe/CNS/ICU infection)',
    'Minocycline': '200 mg IV/PO loading, then 100 mg 12-hourly',
    'Netilmicin': '4–6 mg/kg IV once daily',
    'Nitrofurantoin': '100 mg PO twice daily for 5–7 days',
    'Piperacillin': '4 g IV 6-hourly',
    'Piperacillin-Tazobactam': '4.5 g IV 6–8 hourly (extended infusion preferred)',
    'TMP-SMX': '160/800 mg (1 DS tablet) PO twice daily or 8–12 mg/kg/day IV',
    'Tetracycline': '500 mg PO 6-hourly',
    'Tigecycline': '100 mg IV loading dose, then 50 mg IV 12-hourly',
    'Tobramycin': '5–7 mg/kg IV once daily',
    'Vancomycin': '15–20 mg/kg IV 8–12 hourly (target AUC/MIC 400–600)',
}

_PREGNANCY_UNSAFE = {
    'Ciprofloxacin', 'Levofloxacin', 'Tetracycline', 'Minocycline', 'Tigecycline',
    'Amikacin', 'Gentamicin', 'Tobramycin', 'Netilmicin', 'Colistin', 'TMP-SMX'
}

_RESERVE_DRUGS = {'Colistin', 'Tigecycline', 'Linezolid'}


def _load_empirical_surveillance_table():
    records = []
    if not os.path.exists(DATASET_PATH):
        return records
    try:
        raw_df = pd.read_csv(DATASET_PATH)
        df = raw_df.dropna(subset=['Infection', 'Organism', 'Antibiotic', 'Resistance (%)']).copy()
        df = df[df['Organism'].astype(str).str.strip().str.lower() != 'organism'].copy()
        for _, row in df.iterrows():
            try:
                sens = float(str(row['Sensitivity (%)']).replace('~', '').replace('%', '').strip())
                res = float(str(row['Resistance (%)']).replace('~', '').replace('%', '').strip())
            except Exception:
                continue
            records.append({
                'infection': normalize_infection(row['Infection']),
                'organism': normalize_organism(row['Organism']),
                'antibiotic': normalize_antibiotic(row['Antibiotic']),
                'sensitivity': sens,
                'resistance': res,
            })
    except Exception:
        pass
    return records


_EMPIRICAL_RECORDS = _load_empirical_surveillance_table()


def get_empirical_surveillance(infection: str, organism: str, antibiotic: str):
    """
    Looks up the exact clinical surveillance Sensitivity (%) and Resistance (%)
    from dataset/antimicrobial_resistance_project_-_Organism_to_drug_1775057649552.csv.
    """
    inf = normalize_infection(infection)
    org = normalize_organism(organism)
    ab = normalize_antibiotic(antibiotic)

    # 1. Exact (Infection, Organism, Antibiotic) match
    for r in _EMPIRICAL_RECORDS:
        if r['infection'] == inf and r['organism'] == org and r['antibiotic'].lower() == ab.lower():
            return r['sensitivity'], r['resistance'], True

    # 2. Match (Organism, Antibiotic) across any infection site
    org_ab_matches = [
        r for r in _EMPIRICAL_RECORDS
        if r['organism'] == org and r['antibiotic'].lower() == ab.lower()
    ]
    if org_ab_matches:
        avg_s = float(np.mean([m['sensitivity'] for m in org_ab_matches]))
        avg_r = float(np.mean([m['resistance'] for m in org_ab_matches]))
        return round(avg_s, 1), round(avg_r, 1), True

    # 3. Match (Infection, Antibiotic) across organisms (e.g. Enterobacterales vs E. coli/Klebsiella)
    inf_ab_matches = [
        r for r in _EMPIRICAL_RECORDS
        if r['infection'] == inf and r['antibiotic'].lower() == ab.lower()
    ]
    if inf_ab_matches:
        avg_s = float(np.mean([m['sensitivity'] for m in inf_ab_matches]))
        avg_r = float(np.mean([m['resistance'] for m in inf_ab_matches]))
        return round(avg_s, 1), round(avg_r, 1), False

    # 4. Match Antibiotic overall mean in dataset
    ab_matches = [r for r in _EMPIRICAL_RECORDS if r['antibiotic'].lower() == ab.lower()]
    if ab_matches:
        avg_s = float(np.mean([m['sensitivity'] for m in ab_matches]))
        avg_r = float(np.mean([m['resistance'] for m in ab_matches]))
        return round(avg_s, 1), round(avg_r, 1), False

    # 5. Match Organism overall mean in dataset
    org_matches = [r for r in _EMPIRICAL_RECORDS if r['organism'] == org]
    if org_matches:
        avg_s = float(np.mean([m['sensitivity'] for m in org_matches]))
        avg_r = float(np.mean([m['resistance'] for m in org_matches]))
        return round(avg_s, 1), round(avg_r, 1), False

    return 50.0, 50.0, False


def get_candidate_antibiotics_for_pathogen(infection: str, organism: str):
    """
    Returns all candidate antibiotics and their empirical sensitivity/resistance
    from the clinical CSV dataset for the given (Infection, Organism).
    """
    inf = normalize_infection(infection)
    org = normalize_organism(organism)

    exact = [r for r in _EMPIRICAL_RECORDS if r['infection'] == inf and r['organism'] == org]
    if exact:
        return exact

    # Fallback to same organism across all infection sites, or Enterobacterales for Gram-negative VAP
    by_org = [r for r in _EMPIRICAL_RECORDS if r['organism'] == org]
    if by_org:
        seen = {}
        for r in by_org:
            seen[r['antibiotic']] = r
        return list(seen.values())

    by_inf = [r for r in _EMPIRICAL_RECORDS if r['infection'] == inf]
    if by_inf:
        seen = {}
        for r in by_inf:
            seen[r['antibiotic']] = r
        return list(seen.values())

    return _EMPIRICAL_RECORDS[:10]


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


def reload_models():
    global _LOADED_MODELS, _METADATA
    _LOADED_MODELS = {}
    for name, fpath in _MODEL_FILES.items():
        p = load_model_payload(fpath)
        if p:
            _LOADED_MODELS[name] = p
    _METADATA = load_metadata()


def _infer_single(pipeline, inf_type: str, organism: str, antibiotic: str, sensitivity: float):
    input_df = pd.DataFrame([{
        'Infection': inf_type,
        'Organism': organism,
        'Antibiotic': antibiotic,
        'Sensitivity (%)': float(sensitivity)
    }])
    clf = pipeline.named_steps.get('classifier') if hasattr(pipeline, 'named_steps') else None
    if clf is not None and not hasattr(clf, 'multi_class'):
        setattr(clf, 'multi_class', 'auto')
    pred_res = pipeline.predict(input_df)
    predicted_class_idx = int(pred_res[0])
    prob_res = pipeline.predict_proba(input_df)[0]
    probabilities = [float(p) for p in prob_res]
    return predicted_class_idx, probabilities


def predict_amr(data):
    raw_inf = data.get('infectionType', 'UTI')
    raw_org = data.get('organism', 'E. coli')
    raw_ab = data.get('antibiotic', 'Amikacin')
    raw_sens = data.get('sensitivity', None)
    req_model = data.get('selectedModel') or data.get('modelName') or 'GradientBoosting'

    icu = bool(data.get('icuStatus', False))
    pregnancy = bool(data.get('pregnancy', False))
    ckd = bool(data.get('ckd', False))
    prior_ab = bool(data.get('priorAntibiotics', False))
    severity = str(data.get('severity', 'moderate')).strip().lower()

    inf_type = normalize_infection(raw_inf)
    organism = normalize_organism(raw_org)
    antibiotic = normalize_antibiotic(raw_ab)

    # Parse any lab susceptibility results provided with the case / AMR record
    lab_susc_map = {}
    raw_susc_list = data.get('susceptibilities') or data.get('antibioticSensitivity') or []
    if isinstance(raw_susc_list, list):
        for item in raw_susc_list:
            if isinstance(item, dict):
                ab_name = normalize_antibiotic(item.get('antibiotic'))
                res_val = str(item.get('susceptibility') or item.get('result') or '').strip().lower()
                if ab_name and res_val:
                    lab_susc_map[ab_name.lower()] = res_val

    emp_sens, emp_res, is_exact_empirical = get_empirical_surveillance(inf_type, organism, antibiotic)

    if raw_sens is not None and str(raw_sens).strip() != '':
        sensitivity = float(raw_sens)
        sens_source = "Measured Lab Sensitivity (%)"
    else:
        # Ground sensitivity in the real clinical dataset's empirical surveillance rate
        # and adjust for confirmed lab susceptibility or ICU/prior-antibiotic exposure
        sensitivity = emp_sens
        ab_lab = lab_susc_map.get(antibiotic.lower(), '')
        if ab_lab.startswith('r'):
            sensitivity = min(sensitivity, 14.0)
            sens_source = f"Confirmed Resistant on Lab Panel (Dataset Baseline: {emp_sens}%)"
        elif ab_lab.startswith('i'):
            sensitivity = min(max(sensitivity, 32.0), 52.0)
            sens_source = f"Intermediate on Lab Panel (Dataset Baseline: {emp_sens}%)"
        elif ab_lab.startswith('s'):
            sensitivity = max(sensitivity, 72.0)
            sens_source = f"Confirmed Susceptible on Lab Panel (Dataset Baseline: {emp_sens}%)"
        else:
            # Apply clinically realistic host risk modifiers (ICU / prior antibiotics / severe sepsis)
            penalty = 0.0
            if icu or severity == 'critical':
                penalty += 8.0
            elif severity == 'severe':
                penalty += 4.0
            if prior_ab:
                penalty += 5.0
            sensitivity = round(max(1.0, min(99.5, emp_sens - penalty)), 1)
            sens_source = (
                f"Clinical Dataset Surveillance ({emp_sens}% sensitivity / {emp_res}% resistance)"
                if penalty == 0
                else f"Dataset Surveillance ({emp_sens}%) adjusted for host severity/exposure (-{penalty}%)"
            )

    payload = _LOADED_MODELS.get(req_model) or _LOADED_MODELS.get('GradientBoosting')
    if not payload or "pipeline" not in payload:
        return {"error": f"Selected ML model '{req_model}' is unavailable or failed to load."}

    pipeline = payload["pipeline"]
    model_name = payload.get("model_name", req_model)
    overall_accuracy = payload.get("accuracy", 1.0)

    try:
        predicted_class_idx, probabilities = _infer_single(
            pipeline, inf_type, organism, antibiotic, sensitivity
        )
    except Exception as exc:
        if req_model != 'GradientBoosting' and 'GradientBoosting' in _LOADED_MODELS:
            fb = _LOADED_MODELS['GradientBoosting']['pipeline']
            predicted_class_idx, probabilities = _infer_single(
                fb, inf_type, organism, antibiotic, sensitivity
            )
        else:
            return {"error": f"ML pipeline execution failed for model '{model_name}': {str(exc)}"}

    risk_levels = ['low', 'medium', 'high', 'critical']
    predicted_risk_level = risk_levels[min(predicted_class_idx, len(risk_levels) - 1)]

    confidence = round(float(probabilities[predicted_class_idx]), 4)
    # Genuine resistance probability combining ML non-low-risk probability and empirical dataset resistance
    ml_res_prob = float(1.0 - probabilities[0])
    empirical_res_prob = round((100.0 - sensitivity) / 100.0, 4)
    resistance_probability = round(0.65 * ml_res_prob + 0.35 * empirical_res_prob, 4)

    # Evaluate all candidate antibiotics from the real clinical dataset for this (Infection, Organism)
    candidates = get_candidate_antibiotics_for_pathogen(inf_type, organism)
    ranked_drugs = []
    for cand in candidates:
        cand_ab = cand['antibiotic']
        cand_sens = float(cand['sensitivity'])
        cand_res = float(cand['resistance'])

        cand_lab = lab_susc_map.get(cand_ab.lower(), '')
        if cand_lab.startswith('r'):
            # Do not recommend a drug that tested Resistant on the patient's own lab panel
            continue

        if pregnancy and cand_ab in _PREGNANCY_UNSAFE:
            continue

        adj_sens = cand_sens
        if cand_lab.startswith('s'):
            adj_sens = max(cand_sens, 80.0)

        try:
            c_idx, c_probs = _infer_single(pipeline, inf_type, organism, cand_ab, adj_sens)
            c_low_prob = float(c_probs[0]) if len(c_probs) > 0 else (adj_sens / 100.0)
        except Exception:
            c_low_prob = adj_sens / 100.0

        # Apply WHO AWaRe clinical stewardship hierarchy:
        # Access antibiotics with >=75% empirical sensitivity are preferred first-line for non-ICU infections;
        # Reserve antibiotics (Colistin, Tigecycline, Linezolid) are restricted to ICU/critical or pan-resistant isolates.
        stewardship_group = (
            'Reserve'
            if cand_ab in _RESERVE_DRUGS
            else (
                'Watch'
                if cand_ab in (
                    'Meropenem', 'Imipenem', 'Ertapenem', 'Piperacillin-Tazobactam',
                    'Vancomycin', 'Cefepime', 'Ceftazidime', 'Ceftriaxone',
                    'Cefotaxime', 'Ciprofloxacin', 'Levofloxacin'
                )
                else 'Access'
            )
        )

        if stewardship_group == 'Reserve':
            stewardship_adj = -45.0 if (not icu and severity not in ('severe', 'critical')) else -15.0
        elif stewardship_group == 'Access' and adj_sens >= 60.0 and not icu and severity in ('mild', 'moderate'):
            stewardship_adj = 12.0
        elif stewardship_group == 'Watch' and adj_sens >= 65.0 and not icu and severity in ('mild', 'moderate'):
            stewardship_adj = 4.0
        else:
            stewardship_adj = 0.0

        if cand_lab.startswith('s'):
            stewardship_adj += 15.0

        composite_score = round(adj_sens + (c_low_prob * 20.0) + stewardship_adj, 2)

        warnings = []
        if ckd and cand_ab in ('Amikacin', 'Gentamicin', 'Tobramycin', 'Netilmicin', 'Colistin', 'Vancomycin'):
            warnings.append("Renal dose adjustment & therapeutic drug monitoring required in CKD")
        if cand_ab in _RESERVE_DRUGS:
            warnings.append("WHO Reserve group — restrict to confirmed MDR/XDR infections")

        ranked_drugs.append({
            'drug': cand_ab,
            'score': min(99, max(10, int(round(adj_sens)))),
            'compositeScore': composite_score,
            'sensitivity': round(adj_sens, 1),
            'resistance': round(cand_res, 1),
            'stewardship': stewardship_group,
            'warnings': warnings,
        })

    ranked_drugs.sort(key=lambda x: x['compositeScore'], reverse=True)

    if ranked_drugs:
        recommended = ranked_drugs[0]['drug']
        rec_sens = ranked_drugs[0]['sensitivity']
        alternatives = [d['drug'] for d in ranked_drugs[1:4]]
    else:
        recommended = 'Meropenem' if icu else 'Amoxicillin-Clavulanate'
        rec_sens = emp_sens
        alternatives = ['Piperacillin-Tazobactam', 'Ceftriaxone']

    if not alternatives:
        alternatives = ['Meropenem', 'Piperacillin-Tazobactam'] if recommended != 'Meropenem' else ['Colistin', 'Tigecycline']

    dosage = _DRUG_DOSAGE_MAP.get(recommended, 'Standard weight- and renal-adjusted IV/PO dosing')
    if ckd and recommended in ('Amikacin', 'Gentamicin', 'Tobramycin', 'Meropenem', 'Imipenem', 'Vancomycin', 'Colistin'):
        dosage = f"{dosage} (Adjust interval for eGFR/CKD)"

    feature_impacts = [
        {"feature": f"Infection Site ({inf_type})", "impact": "Primary Anatomical Site"},
        {"feature": f"Pathogen ({organism})", "impact": "Target Organism Profile"},
        {"feature": f"Evaluated Drug ({antibiotic})", "impact": f"Empirical Resistance: {round(100.0 - sensitivity, 1)}%"},
        {"feature": "Surveillance Sensitivity", "impact": sens_source}
    ]

    rationale = (
        f"ML Risk Inference ({model_name}): Predicted {predicted_risk_level.upper()} resistance risk for "
        f"{organism} against {antibiotic} in {inf_type} (Surveillance Sensitivity: {sensitivity}%, "
        f"Model Confidence: {round(confidence * 100, 1)}%, Holdout Test Accuracy: {round(overall_accuracy * 100, 1)}%). "
        f"Dataset-Driven Regimen: {recommended} ({rec_sens}% empirical susceptibility; {dosage}) is ranked #1 "
        f"among {len(ranked_drugs)} evaluated agents for {organism}."
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
        'empiricalSensitivity': sensitivity,
        'empiricalResistance': round(100.0 - sensitivity, 1),
        'featureImportance': feature_impacts,
        'drugRankings': ranked_drugs[:6],
        'classProbabilities': {
            'low': round(probabilities[0], 4) if len(probabilities) > 0 else 0.0,
            'medium': round(probabilities[1], 4) if len(probabilities) > 1 else 0.0,
            'high': round(probabilities[2], 4) if len(probabilities) > 2 else 0.0,
            'critical': round(probabilities[3], 4) if len(probabilities) > 3 else 0.0,
        }
    }
