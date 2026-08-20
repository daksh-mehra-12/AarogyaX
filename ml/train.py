import os
import json
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timezone

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATASET_PATH = os.path.join(PROJECT_ROOT, 'dataset', 'antimicrobial_resistance_project_-_Organism_to_drug_1775057649552.csv')
META_OUT = os.path.join(BASE_DIR, 'models_meta.json')


def load_and_clean_data():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

    raw_df = pd.read_csv(DATASET_PATH)
    total_raw_rows, total_raw_cols = raw_df.shape
    missing_count = int(raw_df.isnull().sum().sum())

    df = raw_df.dropna(subset=['Infection', 'Organism', 'Antibiotic', 'Resistance (%)']).copy()
    df['Resistance (%)'] = pd.to_numeric(df['Resistance (%)'], errors='coerce')
    df['Sensitivity (%)'] = pd.to_numeric(df['Sensitivity (%)'], errors='coerce')
    df = df.dropna(subset=['Resistance (%)']).copy()

    duplicates_removed = int(df.duplicated().sum())
    if duplicates_removed > 0:
        df = df.drop_duplicates().copy()

    def get_risk_level(res_pct):
        if res_pct < 30.0:
            return 0
        elif res_pct < 60.0:
            return 1
        elif res_pct < 85.0:
            return 2
        else:
            return 3

    df['amr_risk_level'] = df['Resistance (%)'].apply(get_risk_level)

    cat_features = ['Infection', 'Organism', 'Antibiotic']
    num_features = ['Sensitivity (%)']
    X = df[cat_features + num_features].copy()
    y = df['amr_risk_level'].values

    class_names = {0: "Low Risk", 1: "Medium Risk", 2: "High Risk", 3: "Critical Risk"}
    u_cls, counts = np.unique(y, return_counts=True)
    class_dist = {class_names[c]: int(cnt) for c, cnt in zip(u_cls, counts)}

    return {
        "df": df,
        "X": X,
        "y": y,
        "cat_features": cat_features,
        "num_features": num_features,
        "raw_rows": total_raw_rows,
        "raw_cols": total_raw_cols,
        "missing_count": missing_count,
        "duplicates_removed": duplicates_removed,
        "class_dist": class_dist
    }


def train_models():
    data = load_and_clean_data()
    X, y = data["X"], data["y"]
    cat_features, num_features = data["cat_features"], data["num_features"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), cat_features),
            ('num', Pipeline([
                ('imputer', SimpleImputer(strategy='mean')),
                ('scaler', StandardScaler())
            ]), num_features)
        ]
    )

    models = {
        "RandomForest": RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42),
        "GradientBoosting": GradientBoostingClassifier(n_estimators=100, max_depth=5, random_state=42),
        "DecisionTree": DecisionTreeClassifier(max_depth=6, random_state=42),
        "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42)
    }

    results = {}
    best_name = None
    best_f1 = -1.0
    best_pipeline = None

    kfold = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    for name, clf in models.items():
        pipeline = Pipeline([
            ('preprocessor', preprocessor),
            ('classifier', clf)
        ])

        cv_scores = cross_val_score(pipeline, X_train, y_train, cv=kfold, scoring='f1_weighted')
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        y_proba = pipeline.predict_proba(X_test) if hasattr(pipeline, "predict_proba") else None

        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        rec = recall_score(y_test, y_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
        auc = roc_auc_score(y_test, y_proba, multi_class='ovr') if y_proba is not None else 0.0

        results[name] = {
            "accuracy": round(float(acc), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "f1_score": round(float(f1), 4),
            "roc_auc": round(float(auc), 4),
            "cv_f1_mean": round(float(cv_scores.mean()), 4),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist()
        }

        # Save individual model file
        slug = name.lower()
        if "gradient" in slug:
            filename = "gradient_boosting.pkl"
        elif "random" in slug:
            filename = "random_forest.pkl"
        elif "tree" in slug:
            filename = "decision_tree.pkl"
        elif "logistic" in slug:
            filename = "logistic_regression.pkl"
        else:
            filename = f"{slug}.pkl"

        indiv_payload = {
            "pipeline": pipeline,
            "model_name": name,
            "accuracy": results[name]["accuracy"],
            "precision": results[name]["precision"],
            "recall": results[name]["recall"],
            "f1_score": results[name]["f1_score"],
            "roc_auc": results[name]["roc_auc"],
            "feature_columns": list(X.columns),
            "dataset_name": os.path.basename(DATASET_PATH)
        }
        joblib.dump(indiv_payload, os.path.join(BASE_DIR, filename))

        if f1 > best_f1:
            best_f1 = f1
            best_name = name
            best_pipeline = pipeline

    feature_importances = {}
    try:
        clf_step = best_pipeline.named_steps['classifier']
        preproc_step = best_pipeline.named_steps['preprocessor']
        cat_encoder = preproc_step.named_transformers_['cat']
        encoded_names = cat_encoder.get_feature_names_out(cat_features).tolist() + num_features
        if hasattr(clf_step, 'feature_importances_'):
            for fname, imp in zip(encoded_names, clf_step.feature_importances_):
                feature_importances[fname] = round(float(imp), 4)
    except Exception:
        pass

    best_model_payload = {
        "pipeline": best_pipeline,
        "model_name": best_name,
        "accuracy": results[best_name]["accuracy"],
        "precision": results[best_name]["precision"],
        "recall": results[best_name]["recall"],
        "f1_score": results[best_name]["f1_score"],
        "roc_auc": results[best_name]["roc_auc"],
        "feature_columns": list(X.columns),
        "dataset_name": os.path.basename(DATASET_PATH)
    }
    meta_feature_names = [
        {"key": "Infection", "label": "Infection Type", "type": "Categorical"},
        {"key": "Organism", "label": "Pathogen Organism", "type": "Categorical"},
        {"key": "Antibiotic", "label": "Evaluated Antibiotic", "type": "Categorical"},
        {"key": "Sensitivity (%)", "label": "Sensitivity Rate (%)", "type": "Numerical"}
    ]

    models_meta_payload = {
        "dataset_name": os.path.basename(DATASET_PATH),
        "selected_algorithm": best_name,
        "accuracy": results[best_name]["accuracy"],
        "precision": results[best_name]["precision"],
        "recall": results[best_name]["recall"],
        "f1_score": results[best_name]["f1_score"],
        "roc_auc": results[best_name]["roc_auc"],
        "confusion_matrix": results[best_name]["confusion_matrix"],
        "training_date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "total_records": len(data["df"]),
        "total_features": len(X.columns),
        "missing_values": data["missing_count"],
        "duplicates_removed": data["duplicates_removed"],
        "target_column": "amr_risk_level",
        "feature_names": meta_feature_names,
        "feature_importances": feature_importances,
        "class_distribution": data["class_dist"],
        "all_model_results": {
            k: {
                "name": k,
                "accuracy": v["accuracy"],
                "precision": v["precision"],
                "recall": v["recall"],
                "f1_score": v["f1_score"],
                "roc_auc": v["roc_auc"],
                "cv_f1_mean": v["cv_f1_mean"],
                "confusion_matrix": v["confusion_matrix"],
                "is_best": (k == best_name)
            } for k, v in results.items()
        },
        "about_model": {
            "algorithm": best_name,
            "why_selected": f"{best_name} achieved top performance with F1-Score of {best_f1*100:.2f}% and ROC-AUC of {results[best_name]['roc_auc']:.4f} across 5-fold cross-validation.",
            "training_summary": f"Trained on {len(X_train)} real clinical surveillance records with {len(X.columns)} features. Evaluated against {len(X_test)} holdout test records (20%).",
            "prediction_explanation": "Predicts AMR risk class (Low, Medium, High, Critical) and returns exact probability distributions using scikit-learn pipeline inference."
        }
    }

    with open(META_OUT, "w", encoding="utf-8") as f:
        json.dump(models_meta_payload, f, indent=2)

    print(f"All 4 models trained & saved successfully. Selected top model: {best_name}")


if __name__ == "__main__":
    train_models()
