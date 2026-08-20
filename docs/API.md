# Aarogya X — REST API Documentation

Aarogya X exposes a RESTful HTTP API built using Flask. Authentication is handled via JWT (JSON Web Tokens) passed in the `Authorization: Bearer <token>` header.

---

## Authentication & Role-Based Access Control (RBAC)

### User Roles
1. **`intern`** (Medical Intern): Create and view owned infection cases & patient profiles.
2. **`junior`** (Junior Doctor): Full clinical read/write capabilities across all cases, read-only access to stewardship guidelines.
3. **`consultant`** (Senior Consultant / HOD): Full clinical access, stewardship modification, and departmental report generation.
4. **`admin`** (System Administrator): Global configuration, RBAC management, system analytics, restricted from direct clinical case viewing for patient privacy.

---

## Public Endpoints

### 1. User Login
- **Endpoint**: `POST /api/auth/login`
- **Auth Required**: None (Public)
- **Request Body**:
```json
{
  "email": "consultant@test.com",
  "password": "password123"
}
```
- **Response** (`200 OK`):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 3,
    "name": "Dr. Rajesh Consultant",
    "email": "consultant@test.com",
    "role": "consultant",
    "created_at": "2026-08-20 18:00:00"
  }
}
```

---

### 2. User Registration
- **Endpoint**: `POST /api/auth/register`
- **Auth Required**: None (Public)
- **Security Note**: Public registration only permits roles: `intern`, `junior`, `consultant`. Attempting to register as `admin` yields `403 Forbidden`.
- **Request Body**:
```json
{
  "name": "Dr. Alex Intern",
  "email": "alex@hospital.org",
  "password": "SecurePassword123",
  "role": "intern"
}
```
- **Response** (`201 Created`):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 5,
    "name": "Dr. Alex Intern",
    "email": "alex@hospital.org",
    "role": "intern"
  }
}
```

---

## Patient Management Endpoints

### 3. Get All Patients
- **Endpoint**: `GET /api/patients`
- **Auth Required**: `intern`, `junior`, `consultant`
- **Response** (`200 OK`):
```json
{
  "patients": [
    {
      "id": 1,
      "patientId": "PAT-1001",
      "name": "Ramesh Sharma",
      "age": 62,
      "gender": "Male",
      "weight": 74.5,
      "region": "North Ward",
      "bloodGroup": "O+",
      "diabetes": true,
      "ckd": false,
      "immunocompromised": false
    }
  ]
}
```

### 4. Create Patient
- **Endpoint**: `POST /api/patients`
- **Auth Required**: `intern`, `junior`, `consultant` (Denied for `admin`)
- **Request Body**:
```json
{
  "patientId": "PAT-1006",
  "name": "Meera Joshi",
  "age": 42,
  "gender": "Female",
  "weight": 60.0,
  "region": "West Ward",
  "bloodGroup": "B+",
  "diabetes": false,
  "ckd": false
}
```

---

## Case & AMR Prediction Endpoints

### 5. Create Infection Case
- **Endpoint**: `POST /api/cases`
- **Auth Required**: `intern`, `junior`, `consultant`
- **Request Body**:
```json
{
  "patientId": 1,
  "infectionType": "uti",
  "severity": "severe",
  "icuStatus": true,
  "priorAntibiotics": true,
  "priorAntibioticsList": "Ciprofloxacin",
  "organism": "E. coli",
  "cbcValue": 14.5,
  "crpValue": 48.2
}
```

### 6. Run AMR Risk Prediction
- **Endpoint**: `POST /api/predict`
- **Auth Required**: Any authenticated role
- **Request Body**:
```json
{
  "selectedModel": "GradientBoosting",
  "infectionType": "uti",
  "organism": "E. coli",
  "antibiotic": "Amikacin",
  "severity": "severe",
  "age": 62
}
```
- **Response** (`200 OK`):
```json
{
  "prediction": {
    "modelName": "GradientBoosting",
    "modelAccuracy": 1.0,
    "resistanceProbability": 0.84,
    "resistanceRisk": "High",
    "recommendedDrug": "Meropenem 1g IV q8h",
    "alternativeDrugs": ["Amikacin", "Colistin"],
    "confidence": 0.92,
    "rationale": "High resistance probability for E. coli with prior fluoroquinolone exposure."
  }
}
```

---

## Stewardship & Analytics Endpoints

### 7. Analytics Dashboard Metrics
- **Endpoint**: `GET /api/analytics/dashboard`
- **Auth Required**: `junior`, `consultant`, `admin`

### 8. Stewardship Guidelines
- **Endpoint**: `GET /api/stewardship` (Read: `junior`, `consultant`, `admin`)
- **Endpoint**: `PUT /api/stewardship` (Modify: `consultant`, `admin`)

---

## Reports & Document Generation

### 9. Export PDF Report
- **Endpoint**: `GET /api/reports/pdf/<case_id>`
- **Auth Required**: `junior`, `consultant`
- **Response**: Binary PDF application payload (`Content-Type: application/pdf`)
