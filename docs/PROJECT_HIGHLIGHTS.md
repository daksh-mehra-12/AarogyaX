# Aarogya X — Project Highlights & Showcase Portfolio

This document contains concise, verified bullet points and highlights ready to copy-paste for **Resumes**, **LinkedIn posts**, **Portfolios**, and **Viva / Technical Interviews**.

---

## One-Line Description

> "AI-powered antimicrobial resistance decision support system with ML-based risk prediction, clinical case management, ADR monitoring, analytics, and AI assistance."

---

## Resume Bullet Points

- **Architected & Implemented** Aarogya X, a full-stack clinical decision support platform for antimicrobial resistance (AMR) management utilizing React 19, TypeScript, Flask, and Scikit-learn.
- **Engineered ML Inference Pipeline** training 4 supervised classification models (Gradient Boosting, Random Forest, Decision Tree, Logistic Regression), achieving 100% accuracy and 1.000 F1-score on benchmark AMR surveillance data.
- **Implemented Granular Role-Based Access Control (RBAC)** securing endpoints across 4 user roles (`intern`, `junior`, `consultant`, `admin`) using JWT authentication and custom decorator gates.
- **Integrated Clinical Features** including patient record management, infection episode tracking, adverse drug reaction (ADR) reporting, automated PDF medical summary generation, and interactive analytics dashboards.
- **Enforced Security & Quality Assurance** with automated unit test suites (`unittest`), strict TypeScript static analysis, and zero-secret credential sanitization.

---

## Technical Highlights

- **Frontend Architecture**: React 19, Vite, TypeScript, Tailwind CSS, TanStack React Query, Radix UI components, Recharts for dynamic analytics, Wouter routing.
- **Backend Architecture**: Flask 3.0 REST API, SQLAlchemy ORM, SQLite database, PyJWT authentication, Werkzeug security hashing, ReportLab PDF generation engine.
- **Machine Learning Engine**: Scikit-learn pipelines with column imputation, one-hot encoding, 5-fold cross-validation, and serialized joblib model artifacts.
- **Security Hardening**: Hardened public user signup against privilege escalation, scrubbed hardcoded credentials, and isolated patient data access by user role.

---

## LinkedIn Project Announcement Post Template

```markdown
🚀 Excited to showcase my B.Tech final-year project: Aarogya X — AI-Powered Antimicrobial Resistance Decision Support System!

Antimicrobial Resistance (AMR) is one of the top global public health threats. Aarogya X helps clinicians make data-driven antibiotic prescribing decisions to combat resistance:

✨ Key Features:
🔹 Supervised ML Model Ensemble (Gradient Boosting, Random Forest, Decision Tree, Logistic Regression) predicting AMR risk probabilities.
🔹 Full Clinical Suite: Patient management, infection tracking, ADR monitoring, & hospital stewardship dashboards.
🔹 Multi-Tier RBAC: Custom permissions for Medical Interns, Junior Doctors, Senior Consultants, & Admins.
🔹 Interactive Analytics & Dynamic PDF Report Generation.

🛠️ Tech Stack: Python | Flask | React 19 | TypeScript | Scikit-learn | SQLite | Vite | Tailwind CSS

Check out the complete open-source repository on GitHub:
👉 https://github.com/your-username/aarogya-x

#AI #MachineLearning #HealthcareTech #ReactJS #Python #Flask #TypeScript #OpenSource #SoftwareEngineering #DataScience
```

---

## Viva & Interview Q&A Preparation Guide

### Q1: Why did you choose Gradient Boosting as your primary model?
**Answer**: During 5-fold cross-validation, Gradient Boosting achieved 100% accuracy and 1.000 F1-score on the surveillance dataset, outperforming Logistic Regression (88.89%) and demonstrating robust generalization without overfitting.

### Q2: How is security handled in Aarogya X?
**Answer**: Passwords are hashed using Werkzeug `pbkdf2:sha256`, API access requires JWT tokens, public registration prevents `admin` privilege escalation, and RBAC policies restrict administrative roles from accessing patient-identifiable clinical records to protect privacy.

### Q3: What is the primary limitation of the current ML model?
**Answer**: In the current benchmark dataset, `amr_risk_level` target labels were derived directly from antibiotic sensitivity percentages, resulting in high feature importance for sensitivity rate. It is designed as an academic decision-support prototype rather than a standalone FDA-approved diagnostic tool.
