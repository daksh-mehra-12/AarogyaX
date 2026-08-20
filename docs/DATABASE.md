# Aarogya X — Database Schema & Architecture

Aarogya X uses **SQLite** mapped via **Flask-SQLAlchemy ORM**. The database consists of 5 main tables maintaining relational integrity for clinical decision support, user management, and adverse drug event tracking.

---

## Entity Relationship Summary

```
   +------------------+             +------------------+
   |      users       |             |     patients     |
   +------------------+             +------------------+
   | id (PK)          |             | id (PK)          |
   | email (Unique)   |             | patient_id (UQ)  |
   | role             |             | name, age, gender|
   +--------+---------+             +--------+---------+
            | 1                              | 1
            |                                |
            | created_by                     | patient_id
            v N                              v N
   +---------------------------------------------------+
   |                       cases                       |
   +---------------------------------------------------+
   | id (PK), case_number (UQ), infection_type, severity|
   | icu_status, organism, culture_result, biomarkers  |
   +--------+--------------------------------+---------+
            | 1                              | 1
            | case_id                        | case_id
            v 1 (has-one)                    v N
   +------------------+             +------------------+
   |   predictions    |             |   adr_reports    |
   +------------------+             +------------------+
   | id (PK)          |             | id (PK)          |
   | resistance_risk  |             | report_number    |
   | recommended_drug |             | drug_name        |
   | confidence       |             | reaction, status |
   +------------------+             +------------------+
```

---

## Table Definitions

### 1. `users` Table
Stores user credentials and Role-Based Access Control (RBAC) role attributes.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique User Identifier |
| `name` | VARCHAR(100) | NOT NULL | User's full name |
| `email` | VARCHAR(120) | UNIQUE, NOT NULL | Account login email |
| `password` | VARCHAR(200) | NOT NULL | Werkzeug hashed password digest |
| `role` | VARCHAR(50) | DEFAULT 'intern' | Access role (`intern`, `junior`, `consultant`, `admin`) |
| `created_at` | DATETIME | DEFAULT UTC | Registration timestamp |

---

### 2. `patients` Table
Contains patient demographic profiles and clinical baseline comorbidities.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | Internal DB Identifier |
| `patient_id` | VARCHAR(50) | UNIQUE, NOT NULL | Hospital Record MRN |
| `name` | VARCHAR(100) | NOT NULL | Patient Full Name |
| `age` | INTEGER | NOT NULL | Age in years |
| `gender` | VARCHAR(20) | NOT NULL | Male / Female / Other |
| `weight` | FLOAT | NULLABLE | Body mass in kg |
| `region` | VARCHAR(100) | NULLABLE | Hospital Ward / Department |
| `blood_group` | VARCHAR(10) | NULLABLE | ABO Blood Typing |
| `diabetes` | BOOLEAN | DEFAULT FALSE | Diabetes Mellitus Flag |
| `ckd` | BOOLEAN | DEFAULT FALSE | Chronic Kidney Disease Flag |
| `pregnancy` | BOOLEAN | DEFAULT FALSE | Gestational Status |
| `immunocompromised`| BOOLEAN | DEFAULT FALSE | Immunosuppression Flag |
| `created_at` | DATETIME | DEFAULT UTC | Registration timestamp |

---

### 3. `cases` Table
Tracks active clinical infection episodes, lab biomarkers, and microbiology findings.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | Internal Case ID |
| `case_number` | VARCHAR(50) | UNIQUE, NOT NULL | Clinical Case Reference Number |
| `patient_id` | INTEGER | FOREIGN KEY (`patients.id`) | Related Patient |
| `infection_type` | VARCHAR(50) | NOT NULL | UTI / Respiratory / Bloodstream / Skin |
| `severity` | VARCHAR(20) | NOT NULL | Mild / Moderate / Severe / Critical |
| `icu_status` | BOOLEAN | DEFAULT FALSE | ICU Admission Indicator |
| `prior_antibiotics`| BOOLEAN | DEFAULT FALSE | Prior Antibiotic Exposure |
| `organism` | VARCHAR(100) | NULLABLE | Identified Bacterial Pathogen |
| `culture_result` | TEXT | NULLABLE | Microbiology Sensitivity Findings |
| `cbc_value` | FLOAT | NULLABLE | WBC Count (10^3/uL) |
| `crp_value` | FLOAT | NULLABLE | C-Reactive Protein (mg/L) |
| `procalcitonin_value`| FLOAT | NULLABLE | Procalcitonin Marker (ng/mL) |
| `status` | VARCHAR(20) | DEFAULT 'open' | `open` / `closed` / `archived` |
| `created_by` | INTEGER | FOREIGN KEY (`users.id`) | Creator User ID |

---

### 4. `predictions` Table
Stores machine-learning risk scores and rule-based antimicrobial recommendation outputs.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | Prediction Record ID |
| `case_id` | INTEGER | FOREIGN KEY (`cases.id`) | Linked Infection Case |
| `resistance_probability` | FLOAT | NOT NULL | Computed AMR Probability (0.00 - 1.00) |
| `recommended_drug` | VARCHAR(100)| NOT NULL | First-line Recommended Regimen |
| `alternative_drugs` | VARCHAR(200)| NULLABLE | Second-line Comma-Separated Options |
| `resistance_risk` | VARCHAR(20) | NOT NULL | `Low`, `Medium`, `High`, `Critical` |
| `confidence` | FLOAT | NOT NULL | Inference Confidence Score |
| `rationale` | TEXT | NULLABLE | Clinical Decision Explanation |
| `dosage` | VARCHAR(200)| NULLABLE | Prescribing Dosage & Schedule |

---

### 5. `adr_reports` Table
Logs Adverse Drug Reactions (ADRs) reported during antimicrobial therapy.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | ADR Log ID |
| `report_number` | VARCHAR(50) | UNIQUE, NOT NULL | Official ADR Log Code |
| `case_id` | INTEGER | FOREIGN KEY (`cases.id`) | Associated Case |
| `patient_id` | INTEGER | FOREIGN KEY (`patients.id`) | Affected Patient |
| `drug_name` | VARCHAR(100)| NOT NULL | Suspected Antimicrobial Agent |
| `reaction_description` | TEXT | NOT NULL | Clinical Manifestations |
| `severity` | VARCHAR(20) | NOT NULL | Mild / Moderate / Severe |
| `outcome` | VARCHAR(50) | NOT NULL | Resolution / Sequelae |
| `status` | VARCHAR(20) | DEFAULT 'pending' | `pending` / `investigating` / `resolved` |
