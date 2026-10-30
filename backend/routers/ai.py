import os
import json
import urllib.request
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from models import User
from auth import require_role

router = APIRouter(tags=["AI Clinical Assistant"])

class AIQueryRequest(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None
    prompt: Optional[str] = None

def generate_clinical_ai_response(query: str) -> str:
    q = query.lower().strip()

    # Greetings / Identity
    if any(w in q for w in ["hello", "hi", "hey", "who are you", "what is aarogya x", "introduce", "namaste"]):
        return (
            "### Aarogya X — AI Clinical Decision Support Assistant\n\n"
            "Hello! I am your **AI Clinical Assistant**, trained on antimicrobial resistance (AMR), "
            "pharmacovigilance (ADR), and evidence-based clinical protocols including:\n\n"
            "- **ICMR (Indian Council of Medical Research)** — National AMR Surveillance Network (IAMRSN)\n"
            "- **IDSA / ATS Guidelines** — Sepsis, Pneumonia, UTI, and Bacteremia management\n"
            "- **WHO AWaRe Classification** — Access, Watch, and Reserve antimicrobial stewardship\n"
            "- **PvPI** — Pharmacovigilance Programme of India for Adverse Drug Reactions\n\n"
            "#### How Can I Assist You Today?\n"
            "- **Antibiotic Selection & Dosing:** Empiric and culture-directed regimens\n"
            "- **Resistant Pathogen Protocols:** MRSA, CRE/NDM, ESBL, MDR Pseudomonas, Acinetobacter\n"
            "- **Critical Care & Sepsis:** Surviving Sepsis 1-hour bundle & vasopressor support\n"
            "- **Biomarker Interpretation:** Procalcitonin (PCT), CRP, and Lactate clearance\n"
            "- **Pharmacovigilance (ADR):** Causality assessment, Red Man syndrome, SJS/TEN"
        )

    # Sepsis / Septic shock / 1-hour bundle
    if any(w in q for w in ["sepsis", "septic shock", "1-hour bundle", "hour bundle", "surviving sepsis", "ssc"]):
        return (
            "### Sepsis Management Protocol — Surviving Sepsis Campaign (SSC 2021 / ICMR)\n\n"
            "#### 1. Immediate 1-Hour Bundle Actions\n"
            "1. **Measure Serum Lactate:** Remeasure within 2-4 hours if initial lactate > 2 mmol/L. If ≥ 4 mmol/L, trigger emergency resuscitation.\n"
            "2. **Blood Cultures × 2 Sets:** Obtain peripheral blood cultures (and central line if present) **prior to antibiotic initiation** without delaying treatment beyond 45 mins.\n"
            "3. **Broad-Spectrum IV Antimicrobials:** Administer within 1 hour of recognition.\n"
            "4. **Rapid Fluid Resuscitation:** Administer **30 mL/kg IV balanced crystalloids** (e.g., Plasmalyte or Ringer's Lactate) for hypotension or lactate ≥ 4 mmol/L.\n"
            "5. **Vasopressor Support:** If Mean Arterial Pressure (MAP) < 65 mmHg post-fluid challenge, initiate **Norepinephrine** (first-line) titrated to MAP ≥ 65 mmHg. Add Vasopressin (0.03 units/min) if refractory.\n\n"
            "#### 2. Empiric Antimicrobial Regimens\n"
            "- **Community-Acquired Sepsis:** Piperacillin-Tazobactam 4.5g IV Q6h (extended 3h infusion) OR Ceftriaxone 2g IV Q24h + Azithromycin 500mg IV.\n"
            "- **Hospital-Acquired / ICU Sepsis:** Meropenem 1g-2g IV Q8h (extended 3h infusion) + Vancomycin 25-30 mg/kg loading dose (or Linezolid 600mg IV Q12h).\n"
            "- **Suspected Intra-Abdominal Sepsis:** Meropenem 1g IV Q8h OR Piperacillin-Tazobactam 4.5g IV Q6h + Metronidazole 500mg IV Q8h.\n\n"
            "#### 3. Stewardship & De-escalation\n"
            "- Reassess clinical response, procalcitonin, and culture results at **48-72 hours** to narrow or discontinue antibiotics."
        )

    # MRSA
    if any(w in q for w in ["mrsa", "methicillin", "staphylococcus aureus", "staph aureus"]):
        return (
            "### MRSA (Methicillin-Resistant Staphylococcus aureus) Clinical Protocol\n\n"
            "#### 1. Bacteremia & Infective Endocarditis\n"
            "- **First-Line:** **Vancomycin IV** — Loading dose: 25-30 mg/kg actual body weight (max 3g). Maintenance: 15-20 mg/kg Q8-12h targeting an **AUC24/MIC ratio of 400-600 mg·h/L**.\n"
            "- **Alternative (or if Vancomycin MIC > 1.5 mg/L):** **Daptomycin 8-10 mg/kg IV once daily** *(Note: Inactivated by pulmonary surfactant; contraindicated in pneumonia)*.\n"
            "- **Duration:** Uncomplicated bacteremia → minimum 14 days; Complicated/Endocarditis → 4-6 weeks from first negative blood culture.\n\n"
            "#### 2. MRSA Hospital-Acquired / Ventilator-Associated Pneumonia\n"
            "- **Linezolid 600 mg IV/PO Q12h** (Preferred over Vancomycin in necrotizing pneumonia due to superior epithelial lining fluid penetration and suppression of PVL toxin), OR\n"
            "- **Vancomycin IV** with strict AUC/MIC therapeutic drug monitoring.\n\n"
            "#### 3. Skin & Soft Tissue Infections (SSTI)\n"
            "- **Outpatient / Mild:** TMP-SMX (Co-trimoxazole) 2 Double Strength tablets BD OR Doxycycline 100 mg BD × 5-7 days.\n"
            "- **Severe / Inpatient:** Vancomycin IV or Daptomycin IV.\n\n"
            "#### 4. ICMR Indian Surveillance Note\n"
            "- ~40-50% of hospital S. aureus isolates in India exhibit methicillin resistance. D-zone testing is mandatory to rule out inducible Clindamycin resistance."
        )

    # CRE / Carbapenem resistance / Klebsiella
    if any(w in q for w in ["cre", "carbapenem", "klebsiella", "kpc", "ndm", "oxa"]):
        return (
            "### Carbapenem-Resistant Enterobacteriaceae (CRE) & Klebsiella Guidelines\n\n"
            "#### 1. Mechanism-Based Treatment\n"
            "- **KPC-producing CRE:**\n"
            "  - **Ceftazidime-Avibactam** 2.5g IV Q8h (infuse over 2h) — First-line choice.\n"
            "  - Alternative: Meropenem-Vaborbactam 4g IV Q8h.\n"
            "- **Metallo-Beta-Lactamase (NDM-1, VIM — High prevalence in India):**\n"
            "  - **Ceftazidime-Avibactam 2.5g Q8h PLUS Aztreonam 2g Q8h IV** (Avibactam inhibits serine beta-lactamases while Aztreonam remains stable against MBL).\n"
            "  - Alternative: Cefiderocol (if available) OR Polymyxin B / Colistin based combinations.\n"
            "- **OXA-48-like producing CRE:**\n"
            "  - Ceftazidime-Avibactam 2.5g IV Q8h monotherapy.\n\n"
            "#### 2. Colistin-Based Combination Regimens (Reserve)\n"
            "- **Colistin Loading Dose:** 9 million IU (MIU) IV once.\n"
            "- **Colistin Maintenance:** 4.5 MIU IV Q12h (adjust for renal impairment).\n"
            "- **Combination Partner:** Colistin + High-dose Meropenem (2g IV Q8h over 3-hour infusion) OR Colistin + Tigecycline.\n\n"
            "#### 3. Infection Control Measures\n"
            "- Immediate contact isolation, dedicated nursing staff, and strict hand hygiene. Surveillance rectal screening for exposed contacts."
        )

    # Pneumonia / CAP / HAP / VAP
    if ("klebsiella" not in q) and any(w in q for w in ["pneumonia", "cap", "hap", "vap", "respiratory infection", "chest infection"]):
        return (
            "### Pneumonia Management Guidelines (IDSA/ATS & ICMR)\n\n"
            "#### 1. Community-Acquired Pneumonia (CAP)\n"
            "- **Outpatient (Healthy, no comorbidities):**\n"
            "  - Amoxicillin 1g PO TDS × 5 days, OR Doxycycline 100mg PO BD × 5 days.\n"
            "- **Outpatient (Comorbidities: Diabetes, CKD, COPD, Heart Failure):**\n"
            "  - Amoxicillin-Clavulanate 875/125mg PO BD + Azithromycin 500mg PO OD × 5 days, OR\n"
            "  - Respiratory Fluoroquinolone: Levofloxacin 750mg PO OD × 5 days.\n"
            "- **Inpatient (Non-Severe, General Ward):**\n"
            "  - Ceftriaxone 1g-2g IV OD + Azithromycin 500mg IV/PO OD, OR Ampicillin-Sulbactam 3g IV Q6h + Macrolide.\n"
            "- **Inpatient (Severe / ICU):**\n"
            "  - Ceftriaxone 2g IV OD + Azithromycin 500mg IV, OR Piperacillin-Tazobactam 4.5g IV Q6h + Levofloxacin 750mg IV.\n"
            "  - If MRSA risk factors present: Add Vancomycin IV or Linezolid 600mg IV Q12h.\n\n"
            "#### 2. Hospital-Acquired (HAP) & Ventilator-Associated Pneumonia (VAP)\n"
            "- Cover **Pseudomonas aeruginosa** and **MRSA**:\n"
            "  - Cefepime 2g IV Q8h (extended infusion) OR Piperacillin-Tazobactam 4.5g IV Q6h OR Meropenem 1g IV Q8h\n"
            "  - PLUS Vancomycin IV or Linezolid 600mg Q12h.\n\n"
            "#### 3. Treatment Duration\n"
            "- Clinical stability achieved: Minimum 5 days for CAP; 7 days for HAP/VAP based on procalcitonin de-escalation."
        )

    # Vancomycin Dosing
    if any(w in q for w in ["vancomycin", "vanco", "trough", "auc"]):
        return (
            "### Vancomycin AUC-Guided Dosing & Therapeutic Drug Monitoring (ASHP/IDSA)\n\n"
            "#### 1. Weight-Based Dosing Protocol\n"
            "- **Loading Dose (All serious infections):** **25-30 mg/kg actual body weight** (max 3000 mg), infused at ≤ 1000 mg/hr to prevent Red Man Syndrome.\n"
            "- **Maintenance Dose (Normal eGFR ≥ 60 mL/min):** **15-20 mg/kg IV Q8-12h** (typically 1250mg - 1500mg Q12h).\n\n"
            "#### 2. Renal Adjustments (CKD & Hemodialysis)\n"
            "- **eGFR 30-49 mL/min:** 15 mg/kg IV Q24h.\n"
            "- **eGFR 15-29 mL/min (e.g. 70kg patient with eGFR 30):**\n"
            "  - Loading Dose: 1750 mg IV once.\n"
            "  - Maintenance: 1000 mg IV Q24-36h; monitor pre-dose levels before 3rd dose.\n"
            "- **Hemodialysis (Intermittent):** 15-20 mg/kg loading dose, then 500-1000 mg post-dialysis session based on serum levels.\n\n"
            "#### 3. Therapeutic Target & Safety\n"
            "- **Target AUC24 / MIC:** **400 - 600 mg·h/L** (assumes MIC ≤ 1 mg/L).\n"
            "- **Trough Monitoring:** If AUC software is unavailable, target trough **15-20 mcg/mL** for bacteremia/endocarditis/pneumonia; 10-15 mcg/mL for uncomplicated infections.\n"
            "- **Nephrotoxicity Risk:** Discontinue concurrent Piperacillin-Tazobactam if acute kidney injury develops (synergistic nephrotoxicity; consider switching to Cefepime)."
        )

    # UTI
    if any(w in q for w in ["uti", "urinary", "cystitis", "pyelonephritis", "cauti"]):
        return (
            "### Urinary Tract Infection (UTI) Clinical Guidelines (IDSA & ICMR)\n\n"
            "#### 1. Uncomplicated Cystitis (Non-pregnant Female)\n"
            "- **First-Line Choices:**\n"
            "  1. **Nitrofurantoin Monohydrate:** 100 mg PO BD with meals × 5 days (Avoid if eGFR < 30 mL/min).\n"
            "  2. **Fosfomycin Tromethamine:** 3g single-dose oral sachet dissolved in water.\n"
            "  3. **TMP-SMX (Co-trimoxazole):** 160/800 mg (1 DS tablet) PO BD × 3 days (Only if local resistance < 20%).\n"
            "- **Stewardship Warning:** Avoid empiric Fluoroquinolones (Ciprofloxacin/Levofloxacin) for uncomplicated cystitis due to high resistance (>70% in India) and toxicity risks.\n\n"
            "#### 2. Pyelonephritis & Complicated UTI\n"
            "- **Outpatient:** Ciprofloxacin 500mg PO BD × 7 days (if local resistance < 10%), OR Ceftriaxone 1g IV once then oral stepdown.\n"
            "- **Inpatient:** Ceftriaxone 1g-2g IV OD, OR Piperacillin-Tazobactam 4.5g IV Q6h (if ESBL/Pseudomonas suspected).\n\n"
            "#### 3. Catheter-Associated UTI (CAUTI)\n"
            "- Remove or exchange indwelling catheter before starting targeted therapy.\n"
            "- Treat only symptomatic patients (fever, dysuria, suprapubic tenderness). Do not treat asymptomatic bacteriuria."
        )

    # General clinical assistant fallback
    return (
        "### Aarogya X Clinical Guidance Summary\n\n"
        "#### 1. Clinical Evaluation Protocol\n"
        "- Assess disease severity, hemodynamic stability, and organ dysfunction using **qSOFA / SOFA** for sepsis risk, **CURB-65** for pneumonia, or **APACHE II** for ICU triage.\n"
        "- Always obtain appropriate microbiological cultures (blood, urine, sputum, aspirate) **prior to initiating antimicrobial therapy**.\n\n"
        "#### 2. Empiric Antimicrobial Recommendation\n"
        "- **Mild-to-Moderate Infection:** Targeted oral or parenteral agent based on suspected anatomical site.\n"
        "- **Severe / Hospital-Acquired Infection:** Broad-spectrum antipseudomonal beta-lactam (e.g., Piperacillin-Tazobactam 4.5g Q6h or Meropenem 1g Q8h) with MRSA coverage (Vancomycin or Linezolid) if risk factors exist.\n\n"
        "#### 3. Pharmacokinetic & Pharmacodynamic (PK/PD) Optimization\n"
        "- **Beta-Lactams:** Utilize **extended infusions (3-4 hours)** or continuous infusion to maximize time above MIC (%T > MIC ≥ 50-70%).\n"
        "- **Aminoglycosides / Vancomycin:** Implement therapeutic drug monitoring with renal function assessments.\n\n"
        "#### 4. Antimicrobial Stewardship Rules\n"
        "- Re-evaluate clinical culture & AST results at **48-72 hours** for de-escalation to narrow-spectrum monotherapy.\n"
        "- Transition from IV to oral therapy once hemodynamically stable with functioning gastrointestinal absorption.\n\n"
        "*Reference: ICMR National Treatment Guidelines for Antimicrobial Use in Infectious Diseases & IDSA Clinical Practice Guidelines.*"
    )

@router.post("/api/ai")
@router.post("/api/ai/chat")
def ai_assistant(
    data: AIQueryRequest,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin"))
):
    user_query = (data.query or data.message or data.prompt or "").strip()
    if not user_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query string is required"
        )

    system_instruction_text = (
        "You are the Aarogya X AI Clinical Decision Support Assistant, an expert AI trained in Antimicrobial Resistance (AMR), "
        "Pharmacovigilance (ADR), Sepsis management protocols (Surviving Sepsis Campaign 2021), and IDSA / WHO / ICMR guidelines.\n"
        "Provide structured, highly accurate, professional clinical answers. Use clear headings, bullet points, and specific drug regimens where appropriate."
    )

    active_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
    if active_key:
        for model in ["gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={active_key}"
                payload = {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": f"{system_instruction_text}\n\nClinical Query: {user_query}"}]
                        }
                    ]
                }
                req_data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=10) as res:
                    res_data = json.loads(res.read().decode("utf-8"))
                    candidates = res_data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        reply = "".join([p.get("text", "") for p in parts])
                        if reply and len(reply.strip()) > 30:
                            return {
                                "response": reply.strip(),
                                "source": f"gemini-{model}",
                                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                            }
            except Exception as e:
                print(f"[!] Gemini {model} attempt: {e}")
                continue

    clinical_reply = generate_clinical_ai_response(user_query)
    return {
        "response": clinical_reply,
        "source": "clinical-intelligence-engine",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    }
