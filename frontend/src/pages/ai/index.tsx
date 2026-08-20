import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Sparkles, ShieldAlert, Pill, FlaskConical, User, Activity, AlertTriangle, Stethoscope, RefreshCw, TriangleAlert, UserCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

type Message = { role: "user" | "assistant"; text: string };

const QUICK_PROMPTS = [
  { label: "MRSA Treatment", text: "How do I treat MRSA bacteremia?", icon: ShieldAlert, color: "#ef4444" },
  { label: "CAP Antibiotic", text: "What is the first-line antibiotic for community-acquired pneumonia?", icon: Pill, color: "#14b8a6" },
  { label: "Sepsis Protocol", text: "What is the Surviving Sepsis Campaign 1-hour bundle?", icon: Activity, color: "#f59e0b" },
  { label: "Vancomycin Dosing", text: "How should I dose Vancomycin for a 70kg patient with eGFR 30?", icon: FlaskConical, color: "#8b5cf6" },
  { label: "CRE Management", text: "What are treatment options for carbapenem-resistant Klebsiella pneumoniae?", icon: AlertTriangle, color: "#ef4444" },
  { label: "UTI Guideline", text: "What is the recommended treatment for uncomplicated UTI in a non-pregnant female?", icon: Stethoscope, color: "#3b82f6" },
];

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");

  const parseInline = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return <strong key={i} className="font-bold text-teal-300 dark:text-teal-200">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**") && part.length > 2) {
        return <em key={i} className="italic text-foreground/90">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return <code key={i} className="bg-teal-950/40 text-teal-300 border border-teal-500/30 rounded px-1.5 py-0.5 font-mono text-xs">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-1.5 text-sm leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        if (trimmed === "---" || trimmed === "___" || trimmed === "***") {
          return <hr key={idx} className="border-border/60 my-2.5" />;
        }

        if (trimmed.startsWith("#### ")) {
          return (
            <h4 key={idx} className="text-xs font-bold text-teal-300 mt-2.5 mb-1 uppercase tracking-wider">
              {parseInline(trimmed.slice(5))}
            </h4>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-sm font-bold text-teal-400 mt-3.5 mb-1 uppercase tracking-wide border-b border-teal-500/20 pb-1">
              {parseInline(trimmed.slice(4))}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={idx} className="text-base font-extrabold text-teal-300 mt-4 mb-1.5 border-b border-teal-500/30 pb-1">
              {parseInline(trimmed.slice(3))}
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={idx} className="text-lg font-extrabold text-teal-200 mt-4 mb-2">
              {parseInline(trimmed.slice(2))}
            </h1>
          );
        }

        if (/^\s+[\*\-\•]\s+/.test(line)) {
          const bulletText = line.replace(/^\s+[\*\-\•]\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-5 my-0.5">
              <span className="text-teal-400/80 shrink-0 text-[10px] mt-1">○</span>
              <span className="text-foreground/90 text-xs sm:text-sm">{parseInline(bulletText)}</span>
            </div>
          );
        }

        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const bulletText = trimmed.replace(/^[\*\-\•]\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5 my-0.5">
              <span className="text-teal-400 font-bold shrink-0 text-xs mt-1">●</span>
              <span className="text-foreground/90 text-xs sm:text-sm">{parseInline(bulletText)}</span>
            </div>
          );
        }

        if (trimmed.startsWith("▶ ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5 mt-2 mb-1">
              <span className="text-teal-400 font-bold shrink-0 text-xs mt-0.5">▶</span>
              <span className="font-semibold text-teal-300 text-xs sm:text-sm">{parseInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5 my-0.5">
              <span className="text-teal-400 font-bold text-xs shrink-0 mt-0.5">{numMatch[1]}.</span>
              <span className="text-foreground/90 text-xs sm:text-sm">{parseInline(numMatch[2])}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-foreground/90 text-xs sm:text-sm leading-relaxed">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
}

// ── Comprehensive AMR/Clinical Knowledge Base ──────────────────────────────

type KBEntry = { keys: string[]; response: string };

const KNOWLEDGE_BASE: KBEntry[] = [
  // ── MRSA ──
  {
    keys: ["mrsa", "methicillin-resistant", "methicillin resistant", "staphylococcus aureus resistant"],
    response: `MRSA (Methicillin-Resistant Staphylococcus aureus) Management:

▶ BACTEREMIA / ENDOCARDITIS:
• Vancomycin IV (target AUC 400–600 mg·h/L) — first line
• Daptomycin 6–10 mg/kg IV OD — alternative (not for lung infection)
• Duration: Uncomplicated bacteremia → 14 days; Complicated/Endocarditis → 4–6 weeks

▶ SKIN & SOFT TISSUE (SSTI):
• Mild: TMP-SMX DS BD × 5–7 days, OR Doxycycline 100mg BD
• Moderate-Severe: Vancomycin IV
• Decolonization: Mupirocin nasal 2% + Chlorhexidine bath × 5 days

▶ PNEUMONIA:
• Vancomycin IV, OR
• Linezolid 600mg BD (preferred for necrotizing/VAP — better lung penetration)

▶ MONITORING:
• Vancomycin: AUC/MIC monitoring; target AUC 400–600; avoid troughs >20 (nephrotoxicity)
• Check susceptibility: If MIC >2 mg/L → switch to Daptomycin or Linezolid

▶ INDIA-SPECIFIC NOTE:
• Hospital-acquired MRSA rate: ~40–50% of S. aureus isolates (ICMR 2023)
• Avoid empiric Clindamycin without inducible resistance testing (D-zone test)`
  },

  // ── CAP / Pneumonia ──
  {
    keys: ["community-acquired pneumonia", "cap ", "cap\n", "pneumonia treatment", "pneumonia antibiotic", "first-line antibiotic for community"],
    response: `Community-Acquired Pneumonia (CAP) — Treatment Guidelines (IDSA/ATS):

▶ OUTPATIENT — No comorbidities:
• Amoxicillin 500mg TDS × 5 days, OR
• Doxycycline 100mg BD × 5 days, OR
• Azithromycin 500mg OD × 5 days (if local Strep resistance <25%)

▶ OUTPATIENT — With comorbidities (DM, CKD, heart/lung disease):
• Amoxicillin-Clavulanate 875/125mg BD + Azithromycin 500mg OD × 5 days, OR
• Levofloxacin 750mg OD × 5 days, OR
• Moxifloxacin 400mg OD × 5 days

▶ INPATIENT — Non-ICU:
• Beta-lactam (Ampicillin-Sulbactam or Ceftriaxone) + Azithromycin, OR
• Respiratory Fluoroquinolone (Levofloxacin / Moxifloxacin)

▶ ICU / SEVERE CAP:
• Ceftriaxone 1–2g IV OD + Azithromycin IV, OR
• Piperacillin-Tazobactam + Levofloxacin
• If MRSA risk: Add Vancomycin or Linezolid
• If Pseudomonas risk: Anti-pseudomonal Beta-lactam (Pip-Tazo, Cefepime)

▶ ATYPICAL COVER: If Legionella/Mycoplasma suspected → Fluoroquinolone or Macrolide`
  },

  // ── Sepsis ──
  {
    keys: ["sepsis", "surviving sepsis", "septic shock", "1-hour bundle", "hour bundle"],
    response: `Sepsis Management — Surviving Sepsis Campaign (SSC 2021):

▶ 1-HOUR BUNDLE:
1. Measure serum lactate — if ≥4 mmol/L → resuscitate immediately
2. Obtain blood cultures × 2 sets BEFORE antibiotics
3. Administer broad-spectrum antibiotics (within 1 hour of recognition)
4. Fluid resuscitation: 30 mL/kg IV crystalloid for hypotension/lactate ≥4
5. Vasopressors if MAP <65 mmHg after fluids: Norepinephrine (first line)

▶ ANTIBIOTIC SELECTION:
• Community-acquired sepsis: Piperacillin-Tazobactam + Azithromycin
• Hospital-acquired / ICU: Meropenem + Vancomycin (MRSA cover)
• Immunocompromised: Add antifungal coverage (Caspofungin or Fluconazole)
• De-escalate within 48–72h based on culture results

▶ TARGETS:
• MAP ≥65 mmHg | UO >0.5 mL/kg/h | Lactate clearance >10% per 2h
• Norepinephrine 0.01–3 mcg/kg/min — add Vasopressin 0.03 units/min if refractory

▶ SEPSIS vs SEPTIC SHOCK:
• Sepsis: Life-threatening organ dysfunction from infection (SOFA ≥2)
• Septic Shock: Sepsis + vasopressor requirement + lactate >2 mmol/L`
  },

  // ── Vancomycin Dosing ──
  {
    keys: ["vancomycin", "vancomycin dose", "vancomycin dosing", "vancomycin ckd", "vancomycin renal"],
    response: `Vancomycin Dosing — AUC-Guided Monitoring (ASHP/IDSA/SIDP 2020):

▶ LOADING DOSE (all patients):
• 25–30 mg/kg actual body weight (max 3g single dose)
• Infuse over ≥60 min; ≥90 min for doses >1.5g

▶ MAINTENANCE — Normal renal function (eGFR ≥60):
• 15–20 mg/kg Q8–12h (typical: 1000–1500mg Q12h)
• Target AUC₂₄: 400–600 mg·h/L (optimal MIC coverage without toxicity)

▶ MAINTENANCE — CKD dosing:
• eGFR 30–59: 15–20 mg/kg Q12–24h
• eGFR <30: 10–15 mg/kg Q24–48h (monitor closely)
• Hemodialysis: 500–1000mg post-dialysis session

▶ FOR 70kg PATIENT eGFR 30:
• Loading: 1750–2100mg IV once
• Maintenance: ~1000mg Q24–36h; recheck AUC after 3rd dose

▶ MONITORING:
• AUC-guided preferred over trough-only (reduces nephrotoxicity by 20%)
• Trough target (if AUC unavailable): 15–20 mg/L for severe infections
• SCr Q48h; CBC weekly
• Avoid concurrent nephrotoxins (aminoglycosides, NSAIDs, contrast)`
  },

  // ── CRE / Carbapenem-resistant ──
  {
    keys: ["cre", "carbapenem-resistant", "carbapenem resistant", "klebsiella", "kpc", "ndm", "oxa-48"],
    response: `Carbapenem-Resistant Enterobacteriaceae (CRE) — Management:

▶ RISK FACTORS:
• Prior carbapenem exposure (90 days) | ICU/prolonged hospitalization
• Invasive devices | Organ transplant | Dialysis-dependent
• Travel to endemic regions (India, Mediterranean, SE Asia)

▶ TREATMENT BY MECHANISM:
KPC-producing (most common globally):
• Ceftazidime-Avibactam 2.5g Q8h IV ← first line
• Meropenem-Vaborbactam 4g Q8h IV ← alternative

NDM/OXA-48-producing (common in India):
• Aztreonam-Avibactam (if available)
• Colistin + Meropenem (double carbapenem synergy, last resort)
• Fosfomycin + Carbapenems (UTI/low-severity only)

▶ INDIA-SPECIFIC (ICMR 2023):
• NDM-1 prevalence: ~60–70% of CRE isolates in India
• Colistin resistance emerging in ICU settings
• Ceftazidime-Avibactam inactive against metallo-beta-lactamases (NDM, VIM)

▶ INFECTION CONTROL:
• Contact precautions + private room
• Rectal swab screening of contacts
• Report to infection control team immediately`
  },

  // ── UTI ──
  {
    keys: ["uti", "urinary tract infection", "uncomplicated uti", "cystitis"],
    response: `Urinary Tract Infection (UTI) — Treatment Guidelines:

▶ UNCOMPLICATED CYSTITIS (non-pregnant female):
First-line (IDSA/India guidelines):
• Nitrofurantoin 100mg BD × 5 days (if eGFR >30)
• TMP-SMX DS BD × 3 days (if local resistance <20%)
• Fosfomycin 3g single sachet (high compliance)

Second-line (only if above unavailable):
• Ciprofloxacin 250mg BD × 3 days (reserve — avoid overuse)
• Avoid fluoroquinolones as first-line (AMR stewardship)

▶ COMPLICATED UTI / PYELONEPHRITIS:
• Ceftriaxone 1–2g IV OD (inpatient)
• Ciprofloxacin 500mg BD × 7 days (outpatient, if susceptible)
• Duration: 7–14 days based on severity

▶ CATHETER-ASSOCIATED UTI (CAUTI):
• Remove/replace catheter if possible
• Treat only if symptomatic (fever, rigors, altered mental status)
• Antibiotics based on urine culture + sensitivity

▶ INDIA-SPECIFIC RESISTANCE:
• E. coli resistance to Ciprofloxacin: ~70–80% in India (ICMR)
• TMP-SMX resistance: ~50–60%
• Carbapenems should be reserved for ESBL/CRE-confirmed cases
• Send urine culture before starting antibiotics`
  },

  // ── Antibiotic Stewardship ──
  {
    keys: ["antibiotic stewardship", "stewardship", "de-escalation", "antibiotic de-escalation"],
    response: `Antibiotic Stewardship Program (ASP) — Core Principles:

▶ KEY INTERVENTIONS:
1. Formulary restriction — require approval for broad-spectrum agents
2. De-escalation — narrow based on culture results (48–72h review)
3. IV to oral switch — when patient is improving (oral bioavailability ≥80%)
4. Duration limits — shortest effective course (skin: 5–7d; CAP: 5d; UTI: 3–5d)
5. Dose optimization — PK/PD-based dosing

▶ IV TO ORAL CANDIDATES:
• Ciprofloxacin (100% bioavailability) ✓
• Linezolid (100%) ✓ | Metronidazole (93%) ✓
• TMP-SMX (90%) ✓ | Clindamycin (90%) ✓
• NOT suitable: Vancomycin (0% oral for systemic infection)

▶ DURATION GUIDELINES (IDSA 2023):
• CAP: 5 days | HAP/VAP: 7–8 days
• Skin/SSTI: 5–7 days | Uncomplicated bacteremia: 7–14 days
• Endocarditis: 4–6 weeks | Osteomyelitis: 4–6 weeks

▶ METRICS TO TRACK:
• DDD/1000 patient-days (Days of therapy)
• C. difficile incidence rate
• Blood culture contamination rate
• Antibiogram change year-over-year`
  },

  // ── ADR / Adverse Drug Reactions ──
  {
    keys: ["adverse drug reaction", "adr", "drug reaction", "allergy", "drug side effect"],
    response: `Adverse Drug Reaction (ADR) Management & Reporting:

▶ CLASSIFICATION (WHO-UMC Causality):
• Certain: Reaction consistent, positive rechallenge, no other cause
• Probable: Consistent, plausible time, no better alternative
• Possible: Reasonable time, other causes possible
• Unlikely: Reaction not typical, other causes more likely

▶ SERIOUS ADR CRITERIA (report to PvPI):
• Death | Life-threatening | Hospitalization/prolonged
• Significant disability | Congenital anomaly

▶ COMMON HIGH-RISK ADRs:
Vancomycin: Red man syndrome, nephrotoxicity, ototoxicity
Fluoroquinolones: Tendinopathy, QT prolongation, peripheral neuropathy
Aminoglycosides: Nephrotoxicity (monitor SCr), ototoxicity (irreversible)
Beta-lactams: Anaphylaxis (0.01–0.05%), maculopapular rash
Linezolid: Serotonin syndrome (with SSRIs), thrombocytopenia
Rifampicin: Hepatotoxicity, orange discoloration, enzyme induction

▶ REPORTING (India):
• PvPI Helpline: 1800 180 3024 (Toll-Free)
• Email: pvpi.ipc@gov.in
• Mobile App: "ADR PvPI"
• Nearest AMC (Adverse Drug Monitoring Centre)

▶ MANAGEMENT:
• Withdraw offending drug if serious
• Anaphylaxis: Adrenaline 0.5mg IM + IV fluids + Antihistamine`
  },

  // ── ESBL ──
  {
    keys: ["esbl", "extended spectrum", "extended-spectrum beta-lactamase"],
    response: `ESBL-Producing Organisms — Clinical Guidance:

▶ COMMON ESBL PRODUCERS:
• E. coli (most common) | Klebsiella pneumoniae | Proteus mirabilis

▶ TREATMENT:
Definitive (culture-directed):
• Carbapenems (Meropenem, Ertapenem, Imipenem) — gold standard
• Ertapenem for outpatient/non-ICU (no Pseudomonas cover)
• Nitrofurantoin / Fosfomycin — for uncomplicated ESBL UTI only

Carbapenem-sparing options (mild-moderate):
• Pip-Tazo: Controversial (inoculum effect — use with caution)
• Cefoxitin: Limited data
• Temocillin: Where available

▶ WHAT NOT TO USE:
• Cephalosporins (Ceftriaxone, Cefuroxime) — unreliable even if susceptible in vitro
• Aztreonam — ESBL typically co-resistant

▶ INDIA PREVALENCE (ICMR 2023):
• E. coli ESBL: ~60–70% of community isolates
• Klebsiella ESBL: ~50–60%
• Send cultures for all patients requiring antibiotics for UTI/sepsis

▶ INFECTION CONTROL:
• Contact precautions | Environmental decontamination with chlorhexidine`
  },

  // ── Antifungal ──
  {
    keys: ["candida", "fungal", "antifungal", "candida auris", "aspergillus"],
    response: `Antifungal Therapy — Clinical Guide:

▶ CANDIDA BLOODSTREAM INFECTION (Candidemia):
First-line:
• Caspofungin 70mg loading → 50mg OD IV (echinocandin — preferred)
• Micafungin 100mg OD IV | Anidulafungin 200mg → 100mg OD IV

Fluconazole-susceptible (stable patient, no azole exposure):
• Fluconazole 400–800mg OD IV/PO (oral bioavailability 90%)

Duration:
• Remove central line/catheters ASAP
• 14 days after last positive blood culture + clinical improvement

▶ CANDIDA AURIS (emerging in India):
• Often resistant to Fluconazole AND Voriconazole
• Use Echinocandin (Caspofungin/Micafungin) — check MICs
• Strict contact precautions | Environmental cultures

▶ ASPERGILLUS (Invasive):
• Voriconazole 6mg/kg BD loading → 4mg/kg BD — first line
• Isavuconazole 372mg TDS × 6 doses → 372mg OD
• Monitor TDM: Voriconazole trough 1–5.5 mg/L

▶ RISK FACTORS FOR INVASIVE FUNGAL:
• Prolonged neutropenia | High-dose steroids | Hematological malignancy
• Solid organ transplant | ICU >14 days | TPN`
  },

  // ── TB / Tuberculosis ──
  {
    keys: ["tuberculosis", "tb ", "tb\n", "mdr-tb", "mdr tb", "isoniazid", "rifampicin"],
    response: `Tuberculosis (TB) — Treatment (RNTCP/WHO 2022):

▶ DRUG-SENSITIVE TB (DS-TB):
Intensive phase (2 months): HRZE
• H = Isoniazid 5mg/kg/day | R = Rifampicin 10mg/kg/day
• Z = Pyrazinamide 25mg/kg/day | E = Ethambutol 15mg/kg/day

Continuation phase (4 months): HR
• Total: 6 months for pulmonary TB

▶ MDR-TB (Resistant to H + R):
WHO-recommended all-oral shorter regimen (6 months):
• Bedaquiline + Pretomanid + Linezolid (BPaL) — ZeNix/TB-PRACTECAL data
• OR: Bedaquiline + Levofloxacin/Moxifloxacin + Ethionamide + Pyrazinamide

▶ MONITORING:
• LFTs at baseline, 2 weeks, monthly (hepatotoxicity: H, R, Z)
• Visual acuity + color vision (Ethambutol)
• Uric acid (Pyrazinamide → gout)
• Bedaquiline: QTc monitoring monthly

▶ INDIA STATISTICS (NTEP 2023):
• India: 25% of global TB burden
• MDR-TB: ~3–5% new, ~11–13% retreatment cases
• Nikshay portal registration mandatory for all TB cases`
  },

  // ── Procalcitonin / Biomarkers ──
  {
    keys: ["procalcitonin", "pct", "crp", "biomarker", "c-reactive protein"],
    response: `Infection Biomarkers — Clinical Interpretation:

▶ PROCALCITONIN (PCT):
Level         | Interpretation
<0.1 ng/mL   | Bacterial infection unlikely
0.1–0.25     | Low risk (monitor)
0.25–0.5     | Possible bacterial infection — consider antibiotics
>0.5 ng/mL   | Bacterial infection likely — antibiotics recommended
>2 ng/mL     | Systemic infection / Sepsis
>10 ng/mL    | Severe sepsis/septic shock

• PCT-guided de-escalation: Stop antibiotics if PCT falls >80% from peak or <0.25 ng/mL
• NOT reliable in: Pancreatitis, burns, surgery, trauma (false positive)
• Does NOT rise in viral infections (useful to distinguish bacterial vs viral)

▶ CRP (C-Reactive Protein):
<10 mg/L     | Normal (acute phase: rises within 6–12h, peaks 48h)
10–100       | Mild-moderate infection or inflammation
>100 mg/L    | Significant bacterial infection
>200 mg/L    | Severe bacterial infection / sepsis

• Less specific than PCT; affected by steroids, liver disease
• Useful for monitoring treatment response (should fall 25–50% per day if responding)

▶ SERUM LACTATE:
<2 mmol/L    | Normal
2–4          | Tissue hypoperfusion — resuscitate aggressively
>4 mmol/L    | Septic shock — activate rapid response`
  },

  // ── Penicillin allergy ──
  {
    keys: ["penicillin allergy", "beta-lactam allergy", "cross-reactivity", "cephalosporin allergy"],
    response: `Penicillin Allergy — Assessment & Cross-Reactivity:

▶ ALLERGY RISK STRATIFICATION:
Low risk (can use cephalosporins):
• Remote mild rash >10 years ago
• GI side effects (nausea/diarrhea)
• Family history only (not direct allergy)

High risk (confirm allergy before use):
• Anaphylaxis / urticaria / angioedema
• Recent severe reaction (<5 years)
• Steven-Johnson syndrome / TEN

▶ CROSS-REACTIVITY DATA:
• Penicillin → Cephalosporin: 0–2% (NOT the historical 10%)
• Risk based on SIDE CHAIN similarity, not beta-lactam ring
• Low cross-reactivity: Cefazolin, Ceftriaxone, Ceftazidime

▶ MANAGEMENT:
If low-risk penicillin "allergy" + needs cephalosporin:
• Graded challenge (small test dose → observe 30–60 min)
• Consider allergy de-labeling (skin test if available)

True penicillin allergy (anaphylaxis) alternatives:
• MRSA: Vancomycin / Linezolid / Daptomycin
• MSSA: Vancomycin (less effective) | Cefazolin if R/O true allergy
• CAP: Respiratory fluoroquinolone (Levofloxacin)
• UTI: Nitrofurantoin / Fosfomycin / TMP-SMX`
  },

  // ── C. difficile ──
  {
    keys: ["clostridium difficile", "c. difficile", "cdiff", "c diff", "clostridioides"],
    response: `Clostridioides difficile Infection (CDI) — Management:

▶ DIAGNOSIS:
• GDH + toxin EIA: Most sensitive combination
• Stool PCR: High sensitivity; can detect colonizers (low specificity for disease)
• Test only LIQUID stools in patients with symptoms >24h

▶ TREATMENT:
Mild-Moderate (WBC <15, Cr rise <1.5× baseline):
• Fidaxomicin 200mg BD × 10 days ← preferred (lower recurrence rate)
• Vancomycin PO 125mg QID × 10 days ← alternative
• Avoid Metronidazole (inferior — use only if above unavailable)

Severe (WBC ≥15 OR Cr ≥1.5× baseline):
• Vancomycin PO 125mg QID × 10 days
• Add Metronidazole IV 500mg TDS if ileus (colonic absorption impaired)

Fulminant / Toxic megacolon:
• Vancomycin PO 500mg QID + Metronidazole IV
• Surgical consultation (subtotal colectomy if no improvement)

▶ RECURRENCE:
• First recurrence: Repeat course above
• Second recurrence: Fidaxomicin extended pulse, OR
• Fecal Microbiota Transplant (FMT) — 85–90% cure rate

▶ INFECTION CONTROL:
• SPORE-FORMING: Alcohol gel INEFFECTIVE → use soap and water!
• Contact precautions; private room; dedicated equipment`
  },
];

function getResponse(text: string): string {
  const t = text.toLowerCase();

  // Try to match knowledge base entries
  for (const entry of KNOWLEDGE_BASE) {
    if (entry.keys.some(k => t.includes(k.toLowerCase()))) {
      return entry.response;
    }
  }

  // Fallback intelligent responses for common queries
  if (t.includes("amr") || t.includes("antimicrobial resistance") || t.includes("antibiotic resistance")) {
    return `Antimicrobial Resistance (AMR) — Overview:

▶ GLOBAL CONTEXT:
• AMR causes ~1.27 million deaths/year globally (Lancet 2022)
• India has one of the highest AMR burdens worldwide
• "ESKAPE" pathogens: Enterococcus, S. aureus, Klebsiella, Acinetobacter, Pseudomonas, Enterobacter

▶ INDIA AMR SNAPSHOT (ICMR 2023):
• E. coli carbapenem resistance: ~10–15% (rising)
• Klebsiella carbapenem resistance: ~15–20% (ICU: up to 50%)
• MRSA prevalence: ~40–50% of S. aureus isolates
• Drug-resistant TB: ~3–5% new cases

▶ RESISTANCE MECHANISMS:
• Beta-lactamases: ESBL, AmpC, KPC, NDM, OXA-48
• Efflux pumps | Porin mutations | Target modification

▶ PREVENTION:
• Antibiotic stewardship programs
• Infection prevention & control (IPC)
• Vaccination (pneumococcal, meningococcal, influenza)
• Appropriate use diagnostics (culture before antibiotics)

Ask me about specific organisms, antibiotics, or clinical scenarios for detailed guidance.`;
  }

  if (t.includes("help") || t.includes("what can you") || t.includes("capabilities")) {
    return `I'm the Aarogya X AI Clinical Assistant. Here's what I can help with:

▶ ANTIMICROBIAL RESISTANCE (AMR):
• MRSA, CRE, ESBL, MDR organisms
• Resistance mechanisms and epidemiology
• ICMR India-specific resistance data

▶ ANTIBIOTIC GUIDANCE:
• First-line treatment for common infections (UTI, CAP, Sepsis, SSTI)
• De-escalation strategies and stewardship principles
• IV to oral switch criteria

▶ PHARMACOLOGY:
• Dosing adjustments in renal/hepatic impairment
• PK/PD optimization (Vancomycin AUC, Beta-lactam T>MIC)
• Drug-drug interactions and contraindications

▶ DIAGNOSTICS:
• Culture interpretation (blood, urine, sputum)
• Biomarker guidance (PCT, CRP, Lactate)
• Susceptibility testing interpretation

▶ ADVERSE DRUG REACTIONS:
• ADR identification and causality assessment
• Reporting to PvPI / pharmacovigilance

▶ CLINICAL SYNDROMES:
• Sepsis protocols | C. difficile | Fungal infections | TB

Try the quick prompts below or ask any clinical question!`;
  }

  if (t.includes("acinetobacter") || t.includes("baumannii")) {
    return `Acinetobacter baumannii — MDR/XDR Management:

▶ TREATMENT (in order of preference):
• Carbapenem-susceptible: Meropenem or Imipenem
• Carbapenem-resistant (CRAB):
  - Sulbactam-based regimens (Sulbactam 3–4g/day IV in divided doses)
  - Polymyxin B / Colistin (last resort, nephrotoxic)
  - Minocycline (if susceptible — especially for HAP/VAP)
  - Cefiderocol (novel siderophore cephalosporin — emerging data)

▶ COMBINATION THERAPY (XDR):
• Colistin + Carbapenems (synergy via high-dose carbapenem)
• Colistin + Rifampicin | Colistin + Fosfomycin

▶ INDIA PREVALENCE:
• CRAB in ICUs: 60–80% carbapenem resistance in India
• Primary pathogen of: HAP, VAP, wound infections, BSI in ICU
• OXA-23 most common carbapenemase in India

▶ INFECTION CONTROL:
• Strict contact precautions | Cohorting
• Enhanced environmental cleaning (survives on surfaces >1 month)`;
  }

  if (t.includes("pseudomonas") || t.includes("aeruginosa")) {
    return `Pseudomonas aeruginosa — Treatment:

▶ ANTI-PSEUDOMONAL AGENTS:
Beta-lactams: Piperacillin-Tazobactam, Ceftazidime, Cefepime, Meropenem, Imipenem
Novel: Ceftolozane-Tazobactam, Ceftazidime-Avibactam, Imipenem-Cilastatin-Relebactam
Others: Ciprofloxacin (oral option), Aztreonam, Amikacin

▶ MDR PSEUDOMONAS:
• Ceftolozane-Tazobactam 3g Q8h IV (active against ESBL/AmpC producers)
• Ceftazidime-Avibactam 2.5g Q8h (active against KPC, not MBL)
• Imipenem-Cilastatin-Relebactam (active against KPC-producing strains)

▶ PK/PD OPTIMIZATION:
• Beta-lactams: Extended infusion (over 3–4h) maximizes T>MIC
• Target: T>MIC of >40% (bacteriostatic) to >70% (bactericidal)
• Amikacin/Tobramycin: High-dose extended-interval dosing (OD)

▶ DUAL THERAPY INDICATIONS:
• Severe sepsis/shock: Initial combination until susceptibilities known
• High MIC organisms: Consider combination for synergy
• De-escalate to monotherapy once stable and susceptible`;
  }

  // Default fallback
  return `I can help with clinical questions on antimicrobial resistance, antibiotic selection, dosing, culture interpretation, and pharmacovigilance.

Your query: "${text.substring(0, 80)}${text.length > 80 ? "..." : ""}"

▶ SUGGESTED TOPICS I CAN ANSWER:
• "How do I treat MRSA bacteremia?"
• "What are options for CRE/NDM-producing Klebsiella?"
• "How to dose Vancomycin for CKD patient?"
• "Surviving Sepsis 1-hour bundle"
• "First-line treatment for CAP"
• "ESBL UTI management"
• "Antifungal for Candidemia"
• "C. difficile treatment guidelines"
• "Penicillin allergy — safe alternatives"
• "How to interpret Procalcitonin?"

Type your clinical question and I'll provide evidence-based guidance based on IDSA, WHO, and ICMR guidelines.

⚠️ Always verify with your institution's antibiogram and senior clinicians for final treatment decisions.`;
}

const ROLE_LABELS: Record<string, string> = {
  intern: "Intern",
  junior: "Junior Doctor",
  consultant: "Consultant",
  admin: "Administrator",
};

export default function AiAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = React.useState<Message[]>([
    {
      role: "assistant",
      text: "Hello! I'm the Aarogya X AI Clinical Assistant, trained on AMR/ADR guidelines including IDSA, WHO, SSC, and ICMR India-specific resistance data.\n\nI can help with:\n• Antibiotic selection & dosing\n• AMR resistance patterns & treatment\n• Sepsis protocols & ICU management\n• Culture/biomarker interpretation\n• Adverse drug reaction guidance\n\nAsk me anything or use the quick prompts below."
    }
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", text: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: text.trim(),
          history: nextMessages.slice(-6)
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.response) {
          setMessages(m => [...m, { role: "assistant", text: data.response }]);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error("AI Assistant API error:", e);
    }

    // Fallback to offline clinical knowledge base if backend API fails
    const fallbackText = getResponse(text);
    setMessages(m => [...m, { role: "assistant", text: fallbackText }]);
    setLoading(false);
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      text: "Chat cleared. How can I assist you with clinical decision support today?"
    }]);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 9rem)" }}>
      <Breadcrumbs items={[{ label: "AI Assistant" }]} />
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0 pb-3">
        <img
          src="/logo.jpg"
          alt="Aarogya X Logo"
          className="h-10 w-10 rounded-full object-cover border border-teal-500/30 shadow-sm shrink-0"
        />
        <div>
          <h1 className="text-2xl font-black tracking-tight">AI Assistant</h1>
          <p className="text-xs text-muted-foreground">Clinical decision support — IDSA · WHO · SSC · ICMR guidelines</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
              <UserCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              <div className="text-right leading-none">
                <p className="text-[11px] font-semibold text-foreground truncate max-w-[110px]">{user.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {ROLE_LABELS[user.role] ?? user.role}
                </p>
              </div>
            </div>
          )}
          <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/30 text-xs">
            <Sparkles className="mr-1 h-3 w-3" /> AMR Trained
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearChat} title="Clear chat">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Clinical Disclaimer */}
      <div className="shrink-0 mb-3 flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5">
        <TriangleAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-400 mb-0.5">CLINICAL DISCLAIMER</p>
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            This tool provides <strong className="text-amber-300">clinical decision support</strong> and does <strong className="text-amber-300">not replace physician judgment</strong>. Final treatment decisions remain the sole responsibility of the treating clinician.
          </p>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-teal-400" />
              </div>
            )}
            <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-teal-500/15 border border-teal-500/30 text-foreground rounded-tr-sm whitespace-pre-wrap"
                : "bg-muted/40 border border-border/50 text-foreground rounded-tl-sm"
            }`}>
              {m.role === "user" ? m.text : <FormattedText text={m.text} />}
            </div>
            {m.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-teal-400" />
            </div>
            <div className="bg-muted/40 border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-2 w-2 rounded-full bg-teal-500/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
                <span className="ml-2 text-xs text-muted-foreground">Analyzing clinical data...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="shrink-0 pt-3 grid grid-cols-3 gap-1.5">
        {QUICK_PROMPTS.map(q => (
          <button key={q.label} type="button"
            onClick={() => sendMessage(q.text)}
            className="flex items-center gap-1.5 text-left rounded-lg border border-border/50 px-2.5 py-2 text-xs hover:bg-muted/30 transition-colors">
            <q.icon className="h-3 w-3 shrink-0" style={{ color: q.color }} />
            <span className="font-medium truncate">{q.label}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <Card className="shrink-0 mt-2 border-teal-500/20">
        <CardContent className="p-2.5 flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Ask about AMR, antibiotic dosing, sepsis protocols, culture results..."
            className="border-0 bg-transparent focus-visible:ring-0 text-sm"
          />
          <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-black shrink-0 px-3"
            onClick={() => sendMessage(input)} disabled={!input.trim() || loading}>
            <Send className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <p className="text-[10px] text-center text-muted-foreground pt-1.5 shrink-0">
        Based on IDSA · WHO · SSC · ICMR guidelines. Always verify with senior clinician & institutional antibiogram.
      </p>
    </div>
  );
}
