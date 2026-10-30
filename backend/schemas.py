from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

# ── Auth Schemas ─────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "intern"

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: Optional[str] = None

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

# ── Patient Schemas ──────────────────────────────────────────────────────────
class PatientCreate(BaseModel):
    patientId: Optional[str] = None
    name: str
    age: int
    gender: str
    weight: Optional[float] = 60.0
    region: Optional[str] = "India"
    bloodGroup: Optional[str] = "O+"
    diabetes: Optional[bool] = False
    ckd: Optional[bool] = False
    pregnancy: Optional[bool] = False
    immunocompromised: Optional[bool] = False

class PatientResponse(BaseModel):
    id: int
    patientId: str
    name: str
    age: int
    gender: str
    weight: Optional[float] = None
    region: Optional[str] = None
    bloodGroup: Optional[str] = None
    diabetes: bool = False
    ckd: bool = False
    pregnancy: bool = False
    immunocompromised: bool = False
    createdBy: Optional[int] = None
    createdAt: Optional[str] = None

class PatientListResponse(BaseModel):
    patients: List[Dict[str, Any]]
    total: int

class PatientVitalCreate(BaseModel):
    bloodPressure: str
    systolic: Optional[int] = None
    diastolic: Optional[int] = None
    heartRate: int
    temperature: float

# ── Case Schemas ─────────────────────────────────────────────────────────────
class CaseCreate(BaseModel):
    patientId: Optional[Any] = None
    patientName: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    diabetes: Optional[bool] = False
    ckd: Optional[bool] = False
    pregnancy: Optional[bool] = False
    immunocompromised: Optional[bool] = False
    infectionType: str = "uti"
    severity: Optional[str] = None
    icuStatus: Optional[bool] = False
    priorAntibiotics: Optional[bool] = False
    previousAntibioticUse: Optional[str] = None
    priorAntibioticsList: Optional[str] = None
    organism: Optional[str] = None
    cultureResult: Optional[str] = None
    antibioticSensitivity: Optional[List[Dict[str, Any]]] = None
    siteOfInfection: Optional[str] = None
    department: Optional[str] = None
    deviceAssociated: Optional[bool] = False
    clinicalNotes: Optional[str] = None
    cbcValue: Optional[float] = None
    crpValue: Optional[float] = None
    procalcitoninValue: Optional[float] = None
    selectedModel: Optional[str] = "GradientBoosting"

class CaseUpdate(BaseModel):
    status: Optional[str] = None
    cultureResult: Optional[str] = None
    organism: Optional[str] = None

class CaseListResponse(BaseModel):
    cases: List[Dict[str, Any]]
    total: int

# ── Prediction Schemas ───────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    infectionType: Optional[str] = "UTI"
    organism: Optional[str] = "E. coli"
    antibiotic: Optional[str] = "Amikacin"
    sensitivity: Optional[Any] = None
    selectedModel: Optional[str] = "GradientBoosting"
    modelName: Optional[str] = None
    icuStatus: Optional[bool] = False
    pregnancy: Optional[bool] = False
    priorAntibiotics: Optional[bool] = False
    severity: Optional[str] = "mild"
    caseId: Optional[int] = None

# ── ADR Schemas ──────────────────────────────────────────────────────────────
class ADRCreate(BaseModel):
    drugName: str
    reactionDescription: str
    severity: str
    outcome: str
    onsetDate: Optional[str] = ""
    batchNo: Optional[str] = None
    patientId: Optional[int] = None
    caseId: Optional[int] = None

class ADRUpdate(BaseModel):
    outcome: Optional[str] = None
    status: Optional[str] = None

class ADRListResponse(BaseModel):
    reports: List[Dict[str, Any]]
    total: int

# ── AI Assistant Schemas ─────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None
    prompt: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    source: str
    timestamp: str

# ── Email Schemas ────────────────────────────────────────────────────────────
class EmailRequest(BaseModel):
    to: Optional[str] = None
    email: Optional[str] = None
    recipient: Optional[str] = None

# ── AMR Module Schemas ───────────────────────────────────────────────────────
class AmrSusceptibilityItem(BaseModel):
    id: Optional[int] = None
    antibiotic: str
    susceptibility: str = "Susceptible (S)"  # Susceptible (S), Intermediate (I), Resistant (R), Unknown
    micValue: Optional[str] = None
    diskDiffusionDiameter: Optional[float] = None
    breakpoints: Optional[str] = None

class AmrRecordCreate(BaseModel):
    patientId: Optional[int] = None
    anonymousPatientId: Optional[str] = None
    patientAge: Optional[int] = None
    patientGender: Optional[str] = None
    specimenType: str = "blood"
    collectionDate: str
    collectionTime: Optional[str] = None
    infectionOrigin: Optional[str] = "unknown"
    department: Optional[str] = None
    organism: str = "Escherichia coli"
    cultureResult: Optional[str] = "positive"
    testingMethod: Optional[str] = "Automated VITEK 2"
    laboratoryStandard: Optional[str] = "CLSI M100 2024"
    laboratoryNotes: Optional[str] = None
    susceptibilities: Optional[List[AmrSusceptibilityItem]] = []
    runPrediction: Optional[bool] = False
    selectedModel: Optional[str] = "GradientBoosting"
    severity: Optional[str] = "moderate"
    icuStatus: Optional[bool] = False
    priorAntibiotics: Optional[bool] = False

class AmrRecordUpdate(BaseModel):
    specimenType: Optional[str] = None
    collectionDate: Optional[str] = None
    collectionTime: Optional[str] = None
    infectionOrigin: Optional[str] = None
    department: Optional[str] = None
    organism: Optional[str] = None
    cultureResult: Optional[str] = None
    testingMethod: Optional[str] = None
    laboratoryStandard: Optional[str] = None
    laboratoryNotes: Optional[str] = None
    susceptibilities: Optional[List[AmrSusceptibilityItem]] = None
    severity: Optional[str] = None
    icuStatus: Optional[bool] = None
    priorAntibiotics: Optional[bool] = None

class AmrHistoryResponse(BaseModel):
    records: List[Dict[str, Any]]
    total: int
    page: int
    limit: int
    pages: int

