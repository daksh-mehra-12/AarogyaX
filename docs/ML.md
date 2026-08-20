# Aarogya X — Machine Learning Pipeline & Model Documentation

Aarogya X incorporates an ensemble of supervised Machine Learning algorithms trained on antimicrobial susceptibility surveillance data to predict pathogen resistance risk and support optimal clinical antibiotic selection.

---

## Dataset Overview

- **Source Dataset**: `antimicrobial_resistance_project_-_Organism_to_drug_1775057649552.csv`
- **Total Records**: 176 clinical surveillance entries
- **Train/Test Split**: 140 training samples (80%) / 36 holdout test samples (20%)
- **Target Variable**: `amr_risk_level` (`Low Risk`, `Medium Risk`, `High Risk`, `Critical Risk`)
- **Features Included**:
  - `Infection`: Categorical infection site (UTI, Ventilator-Associated Pneumonia, Bloodstream)
  - `Organism`: Isolated bacterial strain (E. coli, Klebsiella, Pseudomonas, MRSA, Acinetobacter)
  - `Antibiotic`: Evaluated antimicrobial drug candidate
  - `Sensitivity (%)`: In-vitro susceptibility rate percentage

---

## ML Pipeline Architecture

```
Raw CSV Dataset
      │
      ▼
Data Preprocessing (Imputation & One-Hot Encoding)
      │
      ▼
5-Fold Stratified Cross-Validation
      │
      ├── Gradient Boosting Classifier  (Best Model)
      ├── Random Forest Classifier
      ├── Decision Tree Classifier
      └── Logistic Regression
      │
      ▼
Model Evaluation & Serialized Deployment (*.pkl & models_meta.json)
```

---

## Model Evaluation Results

Evaluation performed on 36 holdout test samples across standard classification metrics:

| Model Algorithm | Accuracy | F1-Score | Precision | Recall | ROC-AUC | 5-Fold CV F1 | Best Model |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Gradient Boosting** | **100.0%** | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **YES** |
| **Decision Tree** | 100.0% | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | No |
| **Random Forest** | 97.22% | 0.9729 | 0.9778 | 0.9722 | 0.9859 | 0.9702 | No |
| **Logistic Regression**| 88.89% | 0.8871 | 0.8879 | 0.8889 | 0.9741 | 0.8439 | No |

---

## Model Retraining Workflow

To retrain the ML pipeline on updated surveillance data:

```bash
# Navigate to project root
python ml/train.py
```

This updates all `*.pkl` binaries in `ml/` and regenerates `ml/models_meta.json`.

---

## Model Limitations & Academic Disclaimer

> [!WARNING]
> **Important Technical Note on Dataset & Feature Importance**:
> In the underlying benchmark dataset, `amr_risk_level` was categorized primarily based on `Sensitivity (%)` threshold ranges. As a result, the `Sensitivity (%)` feature exhibits 100% feature importance during tree-based splits. 
> 
> **Clinical Non-Validation Notice**:
> Aarogya X is designed solely as an academic research prototype, placement portfolio project, and decision-support demonstration tool. It is **NOT** clinically validated or approved by healthcare regulatory bodies (such as FDA or CDSCO) for direct patient prescription without qualified medical practitioner oversight.
