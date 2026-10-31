import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useListPatients, useCreateCase } from "@/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS, AppRole } from "@/lib/access";
import { jsPDF } from "jspdf";
import { getLogoBase64 } from "@/lib/pdf-logo";
import {
  Biohazard,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Search,
  User as UserIcon,
  CheckCircle2,
  FileDown,
  Download,
  Info
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AIResponseViewer } from "@/components/ai-response-viewer";

interface AntibioticSensitivityRow {
  id: string;
  antibiotic: string;
  result: "Resistant (R)" | "Sensitive (S)" | "Intermediate (I)";
  mic: string;
}

const DEPARTMENTS = [
  "General Medicine",
  "ICU / Critical Care",
  "General Surgery",
  "Pediatrics",
  "Urology",
  "Emergency Medicine",
  "Pulmonology",
  "Orthopedics",
  "Oncology",
  "Obstetrics & Gynecology",
  "Nephrology",
  "Cardiology",
];

const INFECTION_TYPES = [
  { value: "uti", label: "Urinary tract (UTI)" },
  { value: "pneumonia", label: "Lower respiratory (Pneumonia)" },
  { value: "sepsis", label: "Bloodstream / Sepsis" },
  { value: "skin", label: "Skin & Soft Tissue" },
  { value: "intra_abdominal", label: "Intra-abdominal" },
  { value: "surgical_site", label: "Surgical site infection" },
  { value: "bone_joint", label: "Bone & Joint" },
  { value: "cns", label: "Central nervous system (Meningitis)" },
  { value: "other", label: "Other" },
];

const ORGANISMS = [
  "Escherichia coli",
  "Klebsiella pneumoniae",
  "Staphylococcus aureus (MRSA/MSSA)",
  "Pseudomonas aeruginosa",
  "Acinetobacter baumannii",
  "Enterococcus faecalis",
  "Enterococcus faecium",
  "Streptococcus pneumoniae",
  "Proteus mirabilis",
  "Serratia marcescens",
  "Citrobacter freundii",
  "Enterobacter cloacae",
  "Candida albicans",
  "Other / Culture Awaited",
];

const ANTIBIOTICS_LIST = [
  "Ciprofloxacin",
  "Meropenem",
  "Amikacin",
  "Colistin",
  "Ceftriaxone",
  "Vancomycin",
  "Piperacillin-Tazobactam",
  "Linezolid",
  "Imipenem",
  "Levofloxacin",
  "Gentamicin",
  "Ampicillin",
  "Cefepime",
  "Cotrimoxazole",
  "Doxycycline",
  "Aztreonam",
  "Tigecycline",
  "Ceftazidime",
  "Polymyxin B",
  "Teicoplanin",
  "Cefoperazone-Sulbactam",
];

export function AmrCaseCollectionForm({ onCancel }: { onCancel?: () => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: patientsData } = useListPatients({ limit: 200 });
  const createCase = useCreateCase();

  const userRole = (user?.role as AppRole) ? ROLE_LABELS[user?.role as AppRole] || user?.role : "Consultant Specialist";
  const userName = user?.name || "Daksh Mehra";

  // Form State - Empty by default until patient is chosen
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [selectedPatientRecord, setSelectedPatientRecord] = useState<any | null>(null);

  // Suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const suggestionBoxRef = useRef<HTMLDivElement>(null);

  const [department, setDepartment] = useState<string>("General Medicine");
  const [infectionType, setInfectionType] = useState<string>("uti");
  const [siteOfInfection, setSiteOfInfection] = useState<string>("Urinary tract");
  const [organism, setOrganism] = useState<string>("Escherichia coli");

  // Checkboxes
  const [icuPatient, setIcuPatient] = useState(false);
  const [hospitalAcquired, setHospitalAcquired] = useState(false);
  const [deviceAssociated, setDeviceAssociated] = useState(false);

  // Sensitivity Dynamic Rows
  const [sensitivityRows, setSensitivityRows] = useState<AntibioticSensitivityRow[]>([
    {
      id: "row-1",
      antibiotic: "Ciprofloxacin",
      result: "Resistant (R)",
      mic: "",
    },
  ]);

  // Bottom fields
  const [previousAntibioticUse, setPreviousAntibioticUse] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [submittedCaseData, setSubmittedCaseData] = useState<any | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // Close suggestion dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionBoxRef.current && !suggestionBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter registered patients by typed query or ID
  const registeredPatients = patientsData?.patients || [];
  const filteredPatients = registeredPatients.filter((p: any) => {
    if (!patientSearchQuery.trim()) return true;
    const q = patientSearchQuery.toLowerCase().trim();
    return (
      p.patientId?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      String(p.id).includes(q)
    );
  });

  // Select patient from suggestion list
  const handleSelectPatient = (p: any) => {
    setPatientId(p.patientId || `PAT-${p.id}`);
    setPatientName(p.name);
    setAge(String(p.age || ""));
    setGender(p.gender || "Male");
    setSelectedPatientRecord(p);
    setShowSuggestions(false);
    setPatientSearchQuery("");

    toast({
      title: "Patient Record Loaded",
      description: `${p.name} (${p.patientId || p.id}) verified & fields auto-filled.`,
    });
  };

  const handleClearSelectedPatient = () => {
    setPatientId("");
    setPatientName("");
    setAge("");
    setGender("");
    setSelectedPatientRecord(null);
    setPatientSearchQuery("");
  };

  const handleAddAntibiotic = () => {
    const nextUnused =
      ANTIBIOTICS_LIST.find(
        (ab) => !sensitivityRows.some((r) => r.antibiotic === ab)
      ) || ANTIBIOTICS_LIST[0];

    setSensitivityRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        antibiotic: nextUnused,
        result: "Resistant (R)",
        mic: "",
      },
    ]);
  };

  const handleRemoveAntibiotic = (id: string) => {
    if (sensitivityRows.length <= 1) return;
    setSensitivityRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (
    id: string,
    field: keyof AntibioticSensitivityRow,
    value: string
  ) => {
    setSensitivityRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // PDF Generator Function - STRICT: Only downloads if patient data is inputted!
  const handleDownloadPDF = async (specificPrediction?: any, specificCaseNumber?: string) => {
    // Validation: Patient data MUST be inputted
    if (!patientId.trim() || !patientName.trim()) {
      toast({
        title: "Patient Data Required",
        description: "Please select a registered patient before downloading the AMR PDF report.",
        variant: "destructive",
      });
      return;
    }

    setIsExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210, M = 14, CW = W - M * 2;
      const logoBase64 = await getLogoBase64();

      // Header Banner
      doc.setFillColor(11, 19, 36);
      doc.rect(0, 0, W, 32, "F");

      // Coral Accent Line
      doc.setFillColor(255, 107, 107);
      doc.rect(0, 32, W, 1.5, "F");

      let titleX = M;
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "JPEG", M, 4.5, 23, 23);
          titleX = M + 28;
        } catch (_) {}
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("AAROGYA X — ANTIMICROBIAL RESISTANCE (AMR) CASE REPORT", titleX, 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(165, 185, 215);
      doc.text("National AMR Surveillance Network Standard (ICMR Ref: https://iamrsn.icmr.org.in/)", titleX, 17);
      doc.text(
        `Case Reference: ${specificCaseNumber || submittedCaseData?.caseNumber || "AMR-" + Date.now().toString().slice(-6)}`,
        titleX,
        22
      );
      doc.text(
        `Reporting Officer: ${userName} (${userRole}) | Generated: ${new Date().toLocaleString("en-IN")}`,
        titleX,
        27
      );

      let y = 40;

      const drawSectionHeader = (title: string, currentY: number) => {
        doc.setFillColor(243, 246, 250);
        doc.rect(M, currentY, CW, 7, "F");
        doc.setFillColor(255, 107, 107);
        doc.rect(M, currentY, 3, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(20, 30, 48);
        doc.text(title, M + 6, currentY + 4.8);
        return currentY + 10;
      };

      // 1. Patient Demographics
      y = drawSectionHeader("1. PATIENT DEMOGRAPHIC INFORMATION", y);
      doc.setFontSize(8.5);
      doc.setTextColor(40, 50, 70);
      doc.setFont("helvetica", "normal");
      doc.text(`• Patient ID: ${patientId}`, M + 4, y);
      doc.text(`• Patient Name: ${patientName}`, M + 70, y);
      doc.text(`• Age: ${age || "N/A"} yrs`, M + 140, y);
      y += 5.5;
      doc.text(`• Gender: ${gender || "N/A"}`, M + 4, y);
      doc.text(`• Reporting Date: ${new Date().toLocaleDateString("en-IN")}`, M + 70, y);
      doc.text(`• System: Aarogya X Clinical Surveillance`, M + 140, y);
      y += 8.5;

      // 2. Clinical Context
      y = drawSectionHeader("2. CLINICAL CONTEXT & INFECTION SPECIFICATION", y);
      doc.setFont("helvetica", "normal");
      doc.text(`• Department: ${department || "General Medicine"}`, M + 4, y);
      doc.text(`• Infection Type: ${infectionType || "UTI"}`, M + 70, y);
      doc.text(`• Site of Infection: ${siteOfInfection || "Not specified"}`, M + 140, y);
      y += 5.5;
      doc.setFont("helvetica", "bold");
      doc.text(`• Isolated Organism: ${organism || "E. coli"}`, M + 4, y);
      doc.setFont("helvetica", "normal");
      y += 5.5;
      const flags = [
        `ICU Patient: ${icuPatient ? "YES" : "NO"}`,
        `Hospital Acquired: ${hospitalAcquired ? "YES" : "NO"}`,
        `Device Associated: ${deviceAssociated ? "YES" : "NO"}`,
      ].join("   |   ");
      doc.text(`• Risk Indicators: ${flags}`, M + 4, y);
      y += 8.5;

      // 3. AST Table
      y = drawSectionHeader("3. ANTIBIOTIC SUSCEPTIBILITY TESTING (AST) PANEL", y);
      doc.setFillColor(20, 30, 48);
      doc.rect(M, y, CW, 6.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("S.No", M + 3, y + 4.5);
      doc.text("Antibiotic / Antimicrobial Agent", M + 18, y + 4.5);
      doc.text("Susceptibility Profile", M + 95, y + 4.5);
      doc.text("MIC (mg/L / Value)", M + 145, y + 4.5);
      y += 6.5;

      sensitivityRows.forEach((row, idx) => {
        const isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
        doc.rect(M, y, CW, 6.5, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(60, 75, 95);
        doc.text(String(idx + 1), M + 3, y + 4.5);
        doc.text(row.antibiotic || "Antibiotic", M + 18, y + 4.5);

        if (row.result.includes("Resistant")) {
          doc.setTextColor(220, 38, 38);
          doc.setFont("helvetica", "bold");
        } else if (row.result.includes("Intermediate")) {
          doc.setTextColor(217, 119, 6);
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(16, 185, 129);
          doc.setFont("helvetica", "bold");
        }
        doc.text(row.result, M + 95, y + 4.5);

        doc.setTextColor(60, 75, 95);
        doc.setFont("helvetica", "normal");
        doc.text(row.mic ? String(row.mic) : "—", M + 145, y + 4.5);
        y += 6.5;
      });
      y += 5;

      // 4. Clinical History & Notes
      y = drawSectionHeader("4. ANTIMICROBIAL HISTORY & CLINICAL OBSERVATIONS", y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(40, 50, 70);
      doc.text(`• Prior Antibiotic Exposure: ${previousAntibioticUse || "None reported"}`, M + 4, y);
      y += 5.5;
      const notes = clinicalNotes
        ? doc.splitTextToSize(`• Clinical Notes: ${clinicalNotes}`, CW - 8)
        : ["• Clinical Notes: No additional complications documented."];
      doc.text(notes, M + 4, y);
      y += notes.length * 4 + 4;

      // 5. AI Decision Support & Stewardship Recommendation
      const activePrediction = specificPrediction || submittedCaseData?.prediction;
      if (activePrediction) {
        y = drawSectionHeader("5. AI ANTIMICROBIAL RESISTANCE INFERENCE & RECOMMENDATIONS", y);
        doc.setFillColor(254, 242, 242);
        doc.roundedRect(M, y, CW, 24, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(185, 28, 28);
        doc.text(
          `PREDICTED RESISTANCE RISK: ${String(activePrediction.resistanceRisk || "Medium").toUpperCase()} (${(
            (activePrediction.resistanceProbability || 0.5) * 100
          ).toFixed(1)}% probability)`,
          M + 5,
          y + 5.5
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(20, 30, 48);
        doc.text(`• Recommended First-Line Agent: ${activePrediction.recommendedDrug || "Meropenem"}`, M + 5, y + 10.5);
        if (activePrediction.dosage) {
          doc.text(`• Dosing Guideline: ${activePrediction.dosage}`, M + 5, y + 15);
        }
        if (activePrediction.alternativeDrugs) {
          const altStr = Array.isArray(activePrediction.alternativeDrugs)
            ? activePrediction.alternativeDrugs.join(", ")
            : activePrediction.alternativeDrugs;
          doc.text(`• Alternative Antibiotic Regimens: ${altStr}`, M + 5, y + 19.5);
        }
        y += 28;
      }

      // Footer
      doc.setFillColor(243, 246, 250);
      doc.rect(M, 270, CW, 15, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(50, 65, 85);
      doc.text("Official Clinical Surveillance Document — Aarogya X AMR Stewardship System", M + 4, 275);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(
        "Complies with ICMR Indian Antimicrobial Resistance Surveillance Network (IAMRSN). Reference: https://iamrsn.icmr.org.in/",
        M + 4,
        280
      );

      const cleanId = (patientId || "AMR").replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `AMR_Report_${cleanId}_${Date.now().toString().slice(-6)}.pdf`;
      doc.save(fileName);

      toast({
        title: "AMR Report PDF Generated",
        description: `Saved report as ${fileName}`,
      });
    } catch (err: any) {
      console.error("PDF generation error:", err);
      toast({
        title: "PDF Generation Failed",
        description: err?.message || "Could not generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Submit and Save Case handler
  const handleSaveCase = async (andDownloadPdf: boolean = false) => {
    if (!patientId.trim() || !patientName.trim()) {
      toast({
        title: "Registered Patient Required",
        description: "Please select a registered patient from suggestions before saving.",
        variant: "destructive",
      });
      return;
    }

    if (!infectionType) {
      toast({
        title: "Infection Type Required",
        description: "Please select an infection type.",
        variant: "destructive",
      });
      return;
    }

    if (!organism) {
      toast({
        title: "Organism Required",
        description: "Please select the identified or suspected pathogen.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        patientId: selectedPatientRecord?.id ? selectedPatientRecord.id : patientId.trim(),
        patientName: patientName.trim(),
        age: age ? parseInt(age) : 45,
        gender: gender || "Male",
        department,
        infectionType,
        siteOfInfection,
        organism,
        icuStatus: icuPatient,
        hospitalAcquired,
        deviceAssociated,
        severity: icuPatient ? "severe" : "moderate",
        antibioticSensitivity: sensitivityRows.map((r) => ({
          antibiotic: r.antibiotic,
          result: r.result,
          mic: r.mic,
        })),
        previousAntibioticUse: previousAntibioticUse.trim(),
        priorAntibiotics: !!previousAntibioticUse.trim(),
        priorAntibioticsList: previousAntibioticUse.trim(),
        clinicalNotes: clinicalNotes.trim(),
      };

      const res = await createCase.mutateAsync({ data: payload });

      // Save to Case History & AMR Records by refreshing queries
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });

      setSubmittedCaseData(res);

      toast({
        title: "Saved to Case History & AMR Records",
        description: `Case ${res.caseNumber || res.id} is now registered in Case History.`,
      });

      if (andDownloadPdf) {
        await handleDownloadPDF(res.prediction, res.caseNumber);
      } else {
        setShowResultModal(true);
      }
    } catch (err: any) {
      console.error("AMR submission error:", err);
      toast({
        title: "Error Saving AMR Record",
        description: err.message || "Failed to record case in database",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    handleClearSelectedPatient();
    setDepartment("General Medicine");
    setInfectionType("uti");
    setSiteOfInfection("Urinary tract");
    setOrganism("Escherichia coli");
    setIcuPatient(false);
    setHospitalAcquired(false);
    setDeviceAssociated(false);
    setSensitivityRows([
      {
        id: "row-1",
        antibiotic: "Ciprofloxacin",
        result: "Resistant (R)",
        mic: "",
      },
    ]);
    setPreviousAntibioticUse("");
    setClinicalNotes("");
    setShowResultModal(false);
    setSubmittedCaseData(null);
  };

  return (
    <div className="w-full bg-black text-slate-100 flex flex-col items-center py-2 sm:py-4 px-2 sm:px-4">
      {/* Hidden button to allow top-bar Export PDF to trigger download */}
      <button
        id="amr-export-pdf-trigger"
        type="button"
        className="hidden"
        onClick={() => handleDownloadPDF()}
      />

      <div className="w-full max-w-4xl">
        {/* ── MAIN AMR FORM CARD (PITCH BLACK OLED BACKGROUND) ── */}
        <div
          className="w-full rounded-2xl sm:rounded-3xl border border-[#1a263d] bg-[#070b14] text-slate-100 shadow-2xl relative overflow-hidden transition-all duration-300"
          style={{
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.95), 0 0 40px 0 rgba(255, 107, 107, 0.04)",
          }}
        >
          {/* Subtle Top Glow Accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff6b6b]/60 to-transparent" />

          <form onSubmit={(e) => { e.preventDefault(); handleSaveCase(false); }} className="p-6 sm:p-10 space-y-7">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#ff6b6b]/10 border border-[#ff6b6b]/20 flex items-center justify-center shrink-0">
                <Biohazard className="h-5 w-5 text-[#ff6b6b]" strokeWidth={2.3} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#ff6b6b]">
                AMR Case Data Collection Form
              </h1>
            </div>

            {/* SECTION 1: PATIENT INFORMATION WITH AUTOCOMPLETE SUGGESTIONS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#8da2c0]">
                  Patient Information
                </h2>
                {selectedPatientRecord && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified Registered Patient: {patientName}
                    <button
                      type="button"
                      onClick={handleClearSelectedPatient}
                      className="text-slate-400 hover:text-white underline ml-1 cursor-pointer text-[11px]"
                    >
                      Change
                    </button>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Patient ID with Searchable Suggestions */}
                <div className="space-y-1.5 relative" ref={suggestionBoxRef}>
                  <label className="text-xs text-[#9fb3cd] font-medium block">
                    Patient ID <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={patientId}
                      onChange={(e) => {
                        setPatientId(e.target.value);
                        setPatientSearchQuery(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Search / select registered patient..."
                      className="w-full h-11 px-3.5 pr-8 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 transition-colors"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Dropdown Suggestions List */}
                  {showSuggestions && (
                    <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl bg-[#0c1322] border border-[#233554] shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-[#1c2c47] bg-[#090f1a] text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                        <span>Select Registered Patient ({filteredPatients.length} available)</span>
                        <span className="text-[10px] text-teal-400">Click to auto-fill</span>
                      </div>
                      {filteredPatients.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          {registeredPatients.length === 0 ? (
                            <>
                              No patients registered yet.
                              <div className="text-[11px] text-teal-400 mt-1">
                                Enter Patient ID, Name &amp; details above to register with this case.
                              </div>
                            </>
                          ) : (
                            <>
                              No registered patient matches "{patientSearchQuery}".
                              <div className="text-[11px] text-teal-400 mt-1">
                                You can enter a new Patient ID &amp; Name to register directly.
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        filteredPatients.map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectPatient(p)}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-[#15233c] border-b border-[#142036]/60 transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
                                <UserIcon className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-white flex items-center gap-2">
                                  <span className="text-teal-400 font-mono">{p.patientId || `PAT-${p.id}`}</span>
                                  <span>— {p.name}</span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Age: {p.age} • Gender: {p.gender} {p.region ? `• Ward: ${p.region}` : ""}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-teal-400 opacity-0 group-hover:opacity-100 font-medium transition-opacity">
                              Select →
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Patient Name - Auto-filled from selected patient */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#9fb3cd] font-medium block">
                    Patient Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Auto-filled on patient select"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 transition-colors"
                  />
                </div>

                {/* Age - Auto-filled from patient */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#9fb3cd] font-medium block">
                    Age <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={125}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Auto-filled on patient select"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 transition-colors"
                  />
                </div>

                {/* Gender - Auto-filled from patient */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#9fb3cd] font-medium block">
                    Gender <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full h-11 px-3.5 pr-9 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 appearance-none cursor-pointer transition-colors"
                    >
                      <option value="" disabled>Select</option>
                      <option value="Male" className="bg-[#0f172a] text-slate-100">Male</option>
                      <option value="Female" className="bg-[#0f172a] text-slate-100">Female</option>
                      <option value="Other" className="bg-[#0f172a] text-slate-100">Other</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: CLINICAL CONTEXT */}
            <div className="space-y-3 pt-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#8da2c0]">
                Clinical Context
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Department * */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#9fb3cd] font-medium block">
                    Department *
                  </label>
                  <div className="relative">
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full h-11 px-3.5 pr-9 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 appearance-none cursor-pointer transition-colors"
                    >
                      <option value="" disabled>Select</option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept} className="bg-[#0f172a] text-slate-100">
                          {dept}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Infection Type * */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#9fb3cd] font-medium block">
                    Infection Type *
                  </label>
                  <div className="relative">
                    <select
                      value={infectionType}
                      onChange={(e) => setInfectionType(e.target.value)}
                      className="w-full h-11 px-3.5 pr-9 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 appearance-none cursor-pointer transition-colors"
                    >
                      <option value="" disabled>Select</option>
                      {INFECTION_TYPES.map((inf) => (
                        <option key={inf.value} value={inf.value} className="bg-[#0f172a] text-slate-100">
                          {inf.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Site of Infection */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#9fb3cd] font-medium block">
                    Site of Infection
                  </label>
                  <input
                    type="text"
                    value={siteOfInfection}
                    onChange={(e) => setSiteOfInfection(e.target.value)}
                    placeholder="e.g. Urinary tract"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 transition-colors"
                  />
                </div>

                {/* Organism * */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#9fb3cd] font-medium block">
                    Organism *
                  </label>
                  <div className="relative">
                    <select
                      value={organism}
                      onChange={(e) => setOrganism(e.target.value)}
                      className="w-full h-11 px-3.5 pr-9 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 appearance-none cursor-pointer transition-colors"
                    >
                      <option value="" disabled>Select</option>
                      {ORGANISMS.map((org) => (
                        <option key={org} value={org} className="bg-[#0f172a] text-slate-100">
                          {org}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Checkboxes Row */}
              <div className="flex flex-wrap items-center gap-6 pt-3">
                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={icuPatient}
                    onChange={(e) => setIcuPatient(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                      icuPatient
                        ? "bg-[#ff6b6b] border-[#ff6b6b] text-white"
                        : "bg-[#0f172a] border-[#293d62] group-hover:border-slate-400"
                    }`}
                  >
                    {icuPatient && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <span className="text-xs sm:text-sm text-slate-300 group-hover:text-white transition-colors">
                    ICU Patient
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={hospitalAcquired}
                    onChange={(e) => setHospitalAcquired(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                      hospitalAcquired
                        ? "bg-[#ff6b6b] border-[#ff6b6b] text-white"
                        : "bg-[#0f172a] border-[#293d62] group-hover:border-slate-400"
                    }`}
                  >
                    {hospitalAcquired && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <span className="text-xs sm:text-sm text-slate-300 group-hover:text-white transition-colors">
                    Hospital Acquired
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={deviceAssociated}
                    onChange={(e) => setDeviceAssociated(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                      deviceAssociated
                        ? "bg-[#ff6b6b] border-[#ff6b6b] text-white"
                        : "bg-[#0f172a] border-[#293d62] group-hover:border-slate-400"
                    }`}
                  >
                    {deviceAssociated && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <span className="text-xs sm:text-sm text-slate-300 group-hover:text-white transition-colors">
                    Device Associated
                  </span>
                </label>
              </div>
            </div>

            {/* SECTION 3: ANTIBIOTIC SENSITIVITY RESULTS * */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#8da2c0]">
                  Antibiotic Sensitivity Results *
                </h2>
                <button
                  type="button"
                  onClick={handleAddAntibiotic}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#121c2e] hover:bg-[#1a2942] border border-[#233552] text-xs font-medium text-slate-200 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-400" />
                  Add Antibiotic
                </button>
              </div>

              {/* Sensitivity Rows */}
              <div className="space-y-3">
                {sensitivityRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-[#090f1d]/80 p-1.5 rounded-xl border border-[#16233b]/80"
                  >
                    {/* Antibiotic Selector */}
                    <div className="sm:col-span-5 relative">
                      <select
                        value={row.antibiotic}
                        onChange={(e) =>
                          handleUpdateRow(row.id, "antibiotic", e.target.value)
                        }
                        className="w-full h-11 px-3.5 pr-9 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 appearance-none cursor-pointer transition-colors"
                      >
                        {ANTIBIOTICS_LIST.map((ab) => (
                          <option key={ab} value={ab} className="bg-[#0f172a] text-slate-100">
                            {ab}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Resistance / Susceptibility Result */}
                    <div className="sm:col-span-4 relative">
                      <select
                        value={row.result}
                        onChange={(e) =>
                          handleUpdateRow(
                            row.id,
                            "result",
                            e.target.value as AntibioticSensitivityRow["result"]
                          )
                        }
                        className="w-full h-11 px-3.5 pr-9 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 appearance-none cursor-pointer transition-colors font-medium"
                      >
                        <option value="Resistant (R)" className="bg-[#0f172a] text-red-400">
                          Resistant (R)
                        </option>
                        <option value="Sensitive (S)" className="bg-[#0f172a] text-emerald-400">
                          Sensitive (S)
                        </option>
                        <option value="Intermediate (I)" className="bg-[#0f172a] text-amber-400">
                          Intermediate (I)
                        </option>
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* MIC Input */}
                    <div className={`relative ${sensitivityRows.length > 1 ? "sm:col-span-2" : "sm:col-span-3"}`}>
                      <input
                        type="text"
                        value={row.mic}
                        onChange={(e) => handleUpdateRow(row.id, "mic", e.target.value)}
                        placeholder="MIC"
                        className="w-full h-11 px-3.5 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 transition-colors"
                      />
                    </div>

                    {/* Delete Row button */}
                    {sensitivityRows.length > 1 && (
                      <div className="sm:col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveAntibiotic(row.id)}
                          className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Remove antibiotic"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 4: PREVIOUS USE & NOTES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Previous Antibiotic Use */}
              <div className="space-y-1.5">
                <label className="text-xs text-[#9fb3cd] font-medium block">
                  Previous Antibiotic Use
                </label>
                <input
                  type="text"
                  value={previousAntibioticUse}
                  onChange={(e) => setPreviousAntibioticUse(e.target.value)}
                  placeholder="e.g. Ciprofloxacin 2 months ago"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 transition-colors"
                />
              </div>

              {/* Clinical Notes */}
              <div className="space-y-1.5">
                <label className="text-xs text-[#9fb3cd] font-medium block">
                  Clinical Notes
                </label>
                <input
                  type="text"
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Additional clinical notes"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]/40 transition-colors"
                />
              </div>
            </div>

            {/* SECTION 5: FOOTER ACTIONS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-start gap-4 pt-5 border-t border-[#16233b]">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-600 text-slate-300 text-sm font-semibold transition-colors hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
              {/* Submit AMR Case Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3 rounded-xl bg-[#ff4d4d] hover:bg-[#ff3b3b] active:scale-[0.98] text-white text-sm font-semibold tracking-wide shadow-lg shadow-red-500/25 transition-all disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    Saving &amp; Analyzing AMR Record...
                  </>
                ) : (
                  <>
                    <Biohazard className="h-4 w-4 text-white" strokeWidth={2.4} />
                    Submit AMR Case
                  </>
                )}
              </button>

              {/* Save & Download PDF Button */}
              <button
                type="button"
                onClick={() => handleSaveCase(true)}
                disabled={isSubmitting || isExportingPdf}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-teal-500/60 hover:border-teal-400 bg-teal-950/40 hover:bg-teal-900/50 text-teal-400 hover:text-teal-300 text-sm font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                title="Save AMR Case to Case History and download PDF"
              >
                {isExportingPdf ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-teal-400" />
                ) : (
                  <FileDown className="h-4 w-4 text-teal-400" />
                )}
                <span>Save &amp; Download PDF</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── REAL-TIME AI PREDICTION RESULTS DIALOG ── */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="max-w-2xl bg-[#070b14] border border-[#1e2e4b] text-slate-100 p-0 overflow-hidden shadow-2xl">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-indigo-950/90 p-6 border-b border-[#1e2e4b]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <Biohazard className="h-5 w-5 text-[#ff6b6b]" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                    AMR Case Saved to Case History
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Case Number: <span className="text-slate-200 font-mono font-medium">{submittedCaseData?.caseNumber || submittedCaseData?.id}</span> • Patient: <span className="text-teal-300 font-medium">{patientName} ({patientId})</span>
                  </DialogDescription>
                </div>
              </div>

              {submittedCaseData?.prediction && (
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                    submittedCaseData.prediction.resistanceRisk?.toLowerCase() === "high" ||
                    submittedCaseData.prediction.resistanceRisk?.toLowerCase() === "critical"
                      ? "bg-red-500/15 border-red-500/40 text-red-400"
                      : submittedCaseData.prediction.resistanceRisk?.toLowerCase() === "medium"
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                      : "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  }`}
                >
                  {submittedCaseData.prediction.resistanceRisk} Risk
                </div>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5 text-sm">
            {submittedCaseData?.prediction ? (
              <>
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#1f2d47]">
                    <div className="text-[11px] text-slate-400 font-medium">Resistance Probability</div>
                    <div className="text-xl font-bold text-[#ff6b6b] mt-0.5">
                      {(submittedCaseData.prediction.resistanceProbability * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#1f2d47]">
                    <div className="text-[11px] text-slate-400 font-medium">AI Model Confidence</div>
                    <div className="text-xl font-bold text-indigo-400 mt-0.5">
                      {(submittedCaseData.prediction.confidence * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-[#0f172a] border border-[#1f2d47]">
                    <div className="text-[11px] text-slate-400 font-medium">Target Pathogen</div>
                    <div className="text-sm font-semibold text-slate-200 mt-1 truncate">
                      {submittedCaseData.organism || organism}
                    </div>
                  </div>
                </div>

                {/* Recommended Antibiotic Therapy */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 to-[#0e1b2e] border border-emerald-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="h-4 w-4" /> Recommended First-Line Therapy
                  </div>
                  <div className="text-base font-bold text-white">
                    {submittedCaseData.prediction.recommendedDrug}
                  </div>
                  {submittedCaseData.prediction.dosage && (
                    <div className="text-xs text-slate-300">
                      <strong>Dosage:</strong> {submittedCaseData.prediction.dosage}
                    </div>
                  )}
                  {submittedCaseData.prediction.alternativeDrugs && (
                    <div className="text-xs text-slate-400 pt-1">
                      <strong>Alternatives:</strong>{" "}
                      {Array.isArray(submittedCaseData.prediction.alternativeDrugs)
                        ? submittedCaseData.prediction.alternativeDrugs.join(", ")
                        : submittedCaseData.prediction.alternativeDrugs}
                    </div>
                  )}
                </div>

                {/* AI Rationale */}
                {submittedCaseData.prediction.rationale && (
                  <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1f2d47] space-y-2">
                    <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-indigo-400" /> Clinical Rationale &amp; Stewardship
                    </div>
                    <AIResponseViewer
                      content={submittedCaseData.prediction.rationale}
                      variant="dark"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1f2d47] text-xs text-slate-300">
                Case registered successfully in Case History &amp; AMR Records.
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#1a273f]">
              <button
                type="button"
                onClick={() => handleDownloadPDF(submittedCaseData?.prediction, submittedCaseData?.caseNumber)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-950/40 hover:bg-teal-900/60 border border-teal-500/50 text-teal-400 hover:text-teal-300 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <Download className="h-4 w-4 text-teal-400" />
                <span>Download Report (PDF)</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2.5 rounded-xl bg-[#121c2e] hover:bg-[#1a2942] border border-[#233552] text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  Log Another AMR Case
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResultModal(false);
                    setLocation("/cases");
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#ff4d4d] hover:bg-[#ff3b3b] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-red-500/20 transition-all cursor-pointer"
                >
                  <span>Go to Case History &amp; AMR Records</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default AmrCaseCollectionForm;
