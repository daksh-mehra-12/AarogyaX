import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateCase, useListPatients } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FlaskConical, ShieldAlert, Cpu, User, ChevronsUpDown, Check, Search, History, AlertCircle, Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";

// ── PDF Lab Report Parser ──────────────────────────────────────────────────
async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).href;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return fullText;
}

export type ParsedLabField = { label: string; field: string };

function parseLabReport(text: string): {
  values: Partial<{
    crpValue: number;
    procalcitoninValue: number;
    cbcValue: number;
    organism: string;
    cultureResult: string;
    infectionType: string;
  }>;
  chips: ParsedLabField[];
} {
  const values: ReturnType<typeof parseLabReport>["values"] = {};
  const chips: ParsedLabField[] = [];
  const t = text;

  // ── Clinical context keywords — organism/lab only valid if in clinical context ──
  const clinicalContext = /isolat|culture|sensitiv|susceptib|resistant|mic\b|colony|pathogen|causative|organism found|identified|blood culture|urine culture|sputum|csf culture|wound culture|antibiogram|microbiology/i;

  // ── CRP: "CRP: 45.2" or "C-Reactive Protein 45.2 mg" or "CRP = 45.2" ──
  const crpMatch = t.match(/(?:c[\s\-]?reactive\s+protein|crp)\s*[:\-=|]\s*([0-9]+\.?[0-9]*)/i);
  if (crpMatch) {
    const v = parseFloat(crpMatch[1]);
    if (!isNaN(v) && v >= 0.1 && v <= 500) {
      values.crpValue = v;
      chips.push({ label: `CRP: ${v} mg/L`, field: "crpValue" });
    }
  }

  // ── PCT / Procalcitonin: "PCT: 2.1" or "Procalcitonin 2.1 ng/mL" ──
  const pctMatch = t.match(/(?:procalcitonin|pct)\s*[:\-=|]\s*([0-9]+\.?[0-9]*)/i);
  if (pctMatch) {
    const v = parseFloat(pctMatch[1]);
    if (!isNaN(v) && v >= 0.01 && v <= 100) {
      values.procalcitoninValue = v;
      chips.push({ label: `PCT: ${v} ng/mL`, field: "procalcitoninValue" });
    }
  }

  // ── WBC / CBC Count: "WBC: 14.5", "Total Leukocyte Count: 14500", "TLC: 14.5" ──
  const wbcMatch = t.match(/(?:wbc|wbc\s+count|tlc|total\s+leukocyte\s+count|white\s+blood\s+cells?)\s*[:\-=|]\s*([0-9]+\.?[0-9]*)/i);
  if (wbcMatch) {
    let v = parseFloat(wbcMatch[1]);
    if (!isNaN(v)) {
      if (v >= 1000 && v <= 50000) {
        v = parseFloat((v / 1000).toFixed(1));
      }
      if (v >= 1.0 && v <= 50.0) {
        values.cbcValue = v;
        chips.push({ label: `WBC (CBC): ${v} ×10³/µL`, field: "cbcValue" });
      }
    }
  }

  // ── Culture result ──
  if (/no\s+growth\s+detected|culture\s*[:\-]\s*negative|no\s+organisms\s+isolated/i.test(t)) {
    values.cultureResult = "Negative";
    chips.push({ label: "Culture: Negative", field: "cultureResult" });
  } else if (/culture\s*[:\-]\s*positive|organism\s+isolated|growth\s+detected|heavy\s+growth/i.test(t)) {
    values.cultureResult = "Positive";
    chips.push({ label: "Culture: Positive", field: "cultureResult" });
  } else if (/culture\s*(result)?\s*(is\s+)?(pending|awaited)|awaiting\s+culture/i.test(t)) {
    values.cultureResult = "Pending";
    chips.push({ label: "Culture: Pending", field: "cultureResult" });
  }

  // ── Infection Site ──
  if (/urine\s+culture|urinary\s+tract|uti\b|dysuria/i.test(t)) {
    values.infectionType = "uti";
    chips.push({ label: "Infection: Urinary Tract (UTI)", field: "infectionType" });
  } else if (/sputum|pneumonia|tracheal|bronch|lung|respiratory|vap\b/i.test(t)) {
    values.infectionType = "pneumonia";
    chips.push({ label: "Infection: Pneumonia (VAP)", field: "infectionType" });
  } else if (/blood\s+stream|blood\s+culture|bacteremia|sepsis/i.test(t)) {
    values.infectionType = "sepsis";
    chips.push({ label: "Infection: Bloodstream (Sepsis)", field: "infectionType" });
  } else if (/wound|skin|soft\s+tissue|abscess|pus/i.test(t)) {
    values.infectionType = "skin";
    chips.push({ label: "Infection: Skin & Soft Tissue", field: "infectionType" });
  }

  // ── Organism identification ──
  const organisms: [RegExp, string][] = [
    [/Staphylococcus\s+aureus/i, "Staphylococcus aureus"],
    [/MRSA|methicillin[\s\-]resistant\s+staph/i, "MRSA"],
    [/Escherichia\s+coli|E\.\s*coli\b/i, "Escherichia coli"],
    [/Klebsiella\s+pneumoniae/i, "Klebsiella pneumoniae"],
    [/Pseudomonas\s+aeruginosa/i, "Pseudomonas aeruginosa"],
    [/Acinetobacter\s+baumannii/i, "Acinetobacter baumannii"],
    [/Enterococcus\s+faecalis|Enterococcus\s+faecium/i, "Enterococcus"],
    [/Streptococcus\s+pneumoniae/i, "Streptococcus pneumoniae"],
    [/Candida\s+albicans|Candida\s+auris/i, "Candida"],
    [/Mycobacterium\s+tuberculosis/i, "Mycobacterium tuberculosis"],
    [/Clostridium\s+difficile|C\.\s*diff(?:icile)?/i, "C. difficile"],
    [/Proteus\s+mirabilis/i, "Proteus mirabilis"],
    [/Enterobacter\s+cloacae/i, "Enterobacter"],
    [/Haemophilus\s+influenzae/i, "Haemophilus influenzae"],
    [/Salmonella\s+typhi/i, "Salmonella typhi"],
  ];

  for (const [pattern, orgName] of organisms) {
    const match = pattern.exec(t);
    if (match) {
      const start = Math.max(0, match.index - 200);
      const end = Math.min(t.length, match.index + match[0].length + 200);
      const window = t.slice(start, end);
      if (clinicalContext.test(window)) {
        values.organism = orgName;
        chips.push({ label: `Organism: ${orgName}`, field: "organism" });
        break;
      }
    }
  }

  return { values, chips };
}

// Direct-search patient selector — always-visible input, no trigger button needed
function PatientCombobox({
  patients,
  value,
  onChange,
}: {
  patients: { id: number; name: string; patientId: string }[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const selected = patients.find(p => String(p.id) === value);

  const showDropdown = focused && !selected;
  const filtered = query.trim()
    ? patients.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.patientId.toLowerCase().includes(query.toLowerCase())
      )
    : patients;

  // Close on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFocused(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (patientId: string) => {
    onChange(patientId);
    setQuery("");
    setFocused(false);
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setFocused(true);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* If patient selected — show pill with clear button */}
      {selected ? (
        <div className="flex h-10 w-full items-center justify-between rounded-md border border-teal-500/60 bg-teal-500/5 px-3 text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-teal-500 shrink-0" />
            <span className="font-medium text-foreground">{selected.name}</span>
            <span className="text-xs text-muted-foreground">({selected.patientId})</span>
          </div>
          <button type="button" onClick={handleClear}
            className="text-muted-foreground hover:text-foreground transition-colors ml-2 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      ) : (
        /* Search input — always directly typeable */
        <div className="flex items-center rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Type patient name or ID to search..."
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Dropdown results */}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {query ? `No patient matching "${query}"` : "No patients found."}
              </div>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelect(String(p.id)); }}
                  className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium flex-1">{p.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.patientId}</span>
                </button>
              ))
            )}
          </div>
          {filtered.length > 0 && (
            <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              {filtered.length} patient{filtered.length !== 1 ? "s" : ""} found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const INFECTION_TYPES = [
  { value: "uti",       label: "UTI",       desc: "Urinary Tract Infection" },
  { value: "pneumonia", label: "Pneumonia", desc: "Lower respiratory tract" },
  { value: "sepsis",    label: "Sepsis",    desc: "Systemic infection" },
  { value: "other",     label: "Other",     desc: "Specify in notes" },
];

const RISK_FACTORS = [
  { key: "icuStatus",              label: "ICU Admission" },
  { key: "hospitalAcquired",       label: "Hospital Acquired" },
  { key: "immunocompromised",      label: "Immunocompromised" },
  { key: "diabetes",               label: "Diabetes Mellitus" },
  { key: "ckd",                    label: "Chronic Kidney Disease" },
  { key: "liverDisease",           label: "Liver Disease / Cirrhosis" },
  { key: "hospitalizationHistory", label: "Recent Hospitalization" },
  { key: "urinaryCatheter",        label: "Urinary Catheter" },
  { key: "mechanicalVentilator",   label: "Mechanical Ventilator (VAP risk)" },
  { key: "centralVenousLine",      label: "Central Venous Line" },
  { key: "recentSurgery",          label: "Recent Surgery (30d)" },
];

const formSchema = z.object({
  patientId: z.coerce.number().min(1, "Patient selection is required"),
  infectionType: z.enum(["uti", "pneumonia", "sepsis", "skin", "bone", "gi", "other"]),
  severity: z.enum(["mild", "moderate", "severe"]),
  // Lab
  approachType: z.string().default("empirical"),
  crpValue: z.coerce.number().optional(),
  procalcitoninValue: z.coerce.number().optional(),
  cbcValue: z.coerce.number().optional(),
  priorAntibiotics: z.boolean().default(false),
  priorAntibioticsList: z.string().optional(),
  antibioticAllergies: z.string().optional(),
  organism: z.string().optional(),
  cultureResult: z.string().optional(),
  // Risk factors
  icuStatus: z.boolean().default(false),
  hospitalAcquired: z.boolean().default(false),
  pregnancy: z.boolean().default(false),
  immunocompromised: z.boolean().default(false),
  diabetes: z.boolean().default(false),
  ckd: z.boolean().default(false),
  liverDisease: z.boolean().default(false),
  hospitalizationHistory: z.boolean().default(false),
  urinaryCatheter: z.boolean().default(false),
  mechanicalVentilator: z.boolean().default(false),
  centralVenousLine: z.boolean().default(false),
  recentSurgery: z.boolean().default(false),
  // Exposure history (MDR prediction core)
  abxExposure: z.enum(["none", "lt30", "30to90"]).default("none"),
  priorHospitalization90d: z.enum(["yes", "no"]).default("no"),
  priorCultureKnown: z.enum(["none", "known"]).default("none"),
  priorCultureOrg: z.string().optional(),
  // Allergy & history
  allergyType: z.enum(["none", "yes"]).default("none"),
  allergyDrug: z.string().optional(),
  notes: z.string().optional(),
});

const SectionHeader = ({ icon: Icon, label, color = "#14b8a6" }: { icon: any; label: string; color?: string }) => (
  <div className="flex items-center gap-2">
    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <h3 className="font-bold text-sm" style={{ color }}>{label}</h3>
  </div>
);

export default function NewCase() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const createCase = useCreateCase();
  const { data: patientsData } = useListPatients({ limit: 1000 });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientId: 0, infectionType: "uti", severity: "mild",
      approachType: "empirical", priorAntibiotics: false,
      icuStatus: false, hospitalAcquired: false, pregnancy: false,
      immunocompromised: false, diabetes: false, ckd: false,
      liverDisease: false, hospitalizationHistory: false,
      urinaryCatheter: false, mechanicalVentilator: false,
      centralVenousLine: false, recentSurgery: false,
      abxExposure: "none", priorHospitalization90d: "no",
      priorCultureKnown: "none", allergyType: "none",
    },
  });

  const allergyTypeWatch = form.watch("allergyType");
  const priorCultureWatch = form.watch("priorCultureKnown");
  const approachWatch = form.watch("approachType");
  const selectedPatientId = form.watch("patientId");

  const selectedPatient = React.useMemo(
    () => patientsData?.patients?.find(p => p.id === Number(selectedPatientId)),
    [patientsData, selectedPatientId]
  );
  const showPregnancy = selectedPatient ? selectedPatient.gender !== "male" : false;

  // Reset pregnancy to false when patient switches to male
  React.useEffect(() => {
    if (!showPregnancy) form.setValue("pregnancy", false);
  }, [showPregnancy]);

  // PDF upload state
  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const [pdfState, setPdfState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [pdfFileName, setPdfFileName] = React.useState<string>("");
  const [pdfChips, setPdfChips] = React.useState<{ label: string; field: string }[]>([]);

  const dismissChip = (field: string) => {
    form.setValue(field as any, undefined);
    setPdfChips(prev => {
      const next = prev.filter(c => c.field !== field);
      if (next.length === 0) setPdfState("idle");
      return next;
    });
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Invalid File Format", description: "Please select a valid PDF clinical lab report.", variant: "destructive" });
      return;
    }
    setPdfFileName(file.name);
    setPdfState("loading");
    setPdfChips([]);
    try {
      const text = await extractTextFromPdf(file);
      if (!text || text.trim().length === 0) {
        setPdfState("error");
        toast({ title: "Empty PDF", description: "Could not read text from PDF. Scanned image PDFs without text layer are not supported.", variant: "destructive" });
        return;
      }

      const { values, chips } = parseLabReport(text);
      if (values.crpValue !== undefined) form.setValue("crpValue", values.crpValue);
      if (values.procalcitoninValue !== undefined) form.setValue("procalcitoninValue", values.procalcitoninValue);
      if (values.cbcValue !== undefined) form.setValue("cbcValue", values.cbcValue);
      if (values.organism) form.setValue("organism", values.organism);
      if (values.cultureResult) form.setValue("cultureResult", values.cultureResult);
      if (values.infectionType) form.setValue("infectionType", values.infectionType as any);

      setPdfChips(chips);
      if (chips.length > 0) {
        setPdfState("done");
        toast({
          title: "Lab PDF Successfully Extracted!",
          description: `Auto-populated ${chips.length} valid clinical field(s) from ${file.name}.`
        });
      } else {
        setPdfState("error");
        toast({
          title: "No Valid Lab Biomarkers Detected",
          description: "No standard lab metrics (CRP, PCT, WBC, Organism) found in this document.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error("PDF Parse error:", err);
      setPdfState("error");
      toast({
        title: "PDF Parsing Error",
        description: err?.message || "Failed to process PDF document.",
        variant: "destructive"
      });
    }
    e.target.value = "";
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const riskFactors = RISK_FACTORS.filter(r => (values as any)[r.key]).map(r => r.label);
    const abxExpLabel = values.abxExposure === "lt30" ? "<30 days" : values.abxExposure === "30to90" ? "30–90 days" : "None";
    const notesWithContext = [
      values.notes,
      values.allergyType === "yes" && values.allergyDrug && `Antibiotic Allergy: ${values.allergyDrug}`,
      values.antibioticAllergies && `Antibiotic History: ${values.antibioticAllergies}`,
      `ABX Exposure: ${abxExpLabel}`,
      values.priorHospitalization90d === "yes" && "Prior Hospitalization (90d): Yes",
      values.priorCultureKnown === "known" && values.priorCultureOrg && `Prior Culture: ${values.priorCultureOrg}`,
      riskFactors.length && `Risk Factors: ${riskFactors.join(", ")}`,
      values.approachType && `Approach: ${values.approachType}`,
    ].filter(Boolean).join(" | ");

    createCase.mutate({
      data: {
        patientId: values.patientId,
        infectionType: values.infectionType === "bone" ? "other" : values.infectionType,
        severity: values.severity,
        icuStatus: values.icuStatus,
        priorAntibiotics: values.priorAntibiotics,
        priorAntibioticsList: values.priorAntibioticsList,
        organism: values.organism,
        cultureResult: values.cultureResult,
        cbcValue: values.cbcValue,
        crpValue: values.crpValue,
        procalcitoninValue: values.procalcitoninValue,
        hospitalizationHistory: values.hospitalizationHistory,
        notes: notesWithContext || undefined,
      }
    }, {
      onSuccess: (res) => {
        toast({ title: "Case created successfully" });
        setLocation(`/cases/${res.id}`);
      },
      onError: (err) => {
        toast({ title: "Error creating case", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <Breadcrumbs items={[{ label: "Case History", href: "/cases" }, { label: "New Clinical Case" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">New Clinical Case</h1>
          <p className="text-sm text-muted-foreground">Log a new infection and initiate AMR assessment</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setLocation("/cases")}>Cancel</Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

          {/* ── Patient + Severity ── */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 pt-5 px-5">
              <SectionHeader icon={User} label="Patient & Severity" />
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="patientId" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Select Patient *</FormLabel>
                  <FormControl>
                    <PatientCombobox
                      patients={patientsData?.patients ?? []}
                      value={field.value ? String(field.value) : ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="severity" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Severity</FormLabel>
                  <div className="flex gap-2">
                    {["mild", "moderate", "severe"].map(v => (
                      <button key={v} type="button" onClick={() => field.onChange(v)}
                        className="flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-all"
                        style={field.value === v ? {
                          background: v === "severe" ? "rgba(239,68,68,0.15)" : v === "moderate" ? "rgba(249,115,22,0.15)" : "rgba(20,184,166,0.15)",
                          borderColor: v === "severe" ? "#ef4444" : v === "moderate" ? "#f97316" : "#14b8a6",
                          color: v === "severe" ? "#ef4444" : v === "moderate" ? "#f97316" : "#14b8a6",
                        } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Infection Type ── */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 pt-5 px-5">
              <SectionHeader icon={ShieldAlert} label="Infection Type" color="#ef4444" />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <FormField control={form.control} name="infectionType" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-0 divide-y divide-border/50">
                      {INFECTION_TYPES.map(opt => (
                        <label key={opt.value}
                          className="flex items-center justify-between py-3.5 px-1 cursor-pointer hover:bg-muted/20 transition-colors rounded">
                          <div>
                            <p className="font-medium text-sm">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          </div>
                          <RadioGroupItem value={opt.value} className="data-[state=checked]:border-teal-500 data-[state=checked]:text-teal-500" />
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Lab & Microbiology ── */}
          <Card className="border-border/50" style={{ borderColor: "rgba(139,92,246,0.3)" }}>
            <CardHeader className="pb-3 pt-5 px-5">
              <SectionHeader icon={FlaskConical} label="Lab & Microbiology" color="#8b5cf6" />
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-5">

              {/* Mode Toggle */}
              <FormField control={form.control} name="approachType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Mode</FormLabel>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    {[
                      { value: "empirical", label: "Empirical", desc: "No culture yet" },
                      { value: "culture-directed", label: "Targeted", desc: "Culture available" },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => field.onChange(opt.value)}
                        className="flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border text-left transition-all"
                        style={field.value === opt.value ? {
                          background: "rgba(139,92,246,0.12)",
                          borderColor: "#8b5cf6",
                          boxShadow: "0 0 0 1px #8b5cf6",
                        } : { borderColor: "hsl(var(--border))" }}>
                        <div className="flex items-center gap-2">
                          <div className="h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
                            style={{ borderColor: field.value === opt.value ? "#8b5cf6" : "#6b7280" }}>
                            {field.value === opt.value && (
                              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#8b5cf6" }} />
                            )}
                          </div>
                          <span className="font-semibold text-sm" style={{ color: field.value === opt.value ? "#a78bfa" : "#d1d5db" }}>
                            {opt.label}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-[22px]">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </FormItem>
              )} />

              {/* PDF Upload */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Upload Lab Report (PDF)</p>
                <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
                <button type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={pdfState === "loading"}
                  className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-dashed text-sm font-medium transition-all"
                  style={{
                    borderColor: pdfState === "done" ? "#10b981" : pdfState === "error" ? "#ef4444" : "rgba(139,92,246,0.5)",
                    background: pdfState === "done" ? "rgba(16,185,129,0.07)" : pdfState === "error" ? "rgba(239,68,68,0.07)" : "rgba(139,92,246,0.05)",
                    color: pdfState === "done" ? "#10b981" : pdfState === "error" ? "#ef4444" : "#a78bfa",
                  }}>
                  {pdfState === "loading" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Reading PDF...</>
                  ) : pdfState === "done" ? (
                    <><CheckCircle2 className="h-4 w-4" /> Auto-filled from: {pdfFileName}</>
                  ) : pdfState === "error" ? (
                    <><FileText className="h-4 w-4" /> No data found — try another PDF</>
                  ) : (
                    <><Upload className="h-4 w-4" /> Upload Lab Report PDF — auto-fills fields below</>
                  )}
                </button>
                {pdfState === "done" && pdfChips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pdfChips.map((chip) => (
                      <span key={chip.field} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                        <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                        {chip.label}
                        <button type="button" onClick={() => dismissChip(chip.field)}
                          className="ml-0.5 rounded-full hover:bg-red-500/20 transition-colors p-0.5"
                          style={{ color: "#6b7280" }}
                          title="Remove this auto-filled value">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Lab values */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="crpValue" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">CRP (mg/L)</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="e.g. 120" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="procalcitoninValue" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Procalcitonin (ng/mL)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="e.g. 2.5" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Targeted-only fields */}
              {approachWatch === "culture-directed" && (
                <div className="grid grid-cols-2 gap-4 p-3 rounded-xl border"
                  style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.04)" }}>
                  <FormField control={form.control} name="organism" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Identified Organism</FormLabel>
                      <FormControl><Input placeholder="e.g. E. coli" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cultureResult" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Culture Status</FormLabel>
                      <FormControl><Input placeholder="Positive / Negative / Pending" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              )}
              {approachWatch === "empirical" && (
                <FormField control={form.control} name="organism" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Suspected Organism (optional)</FormLabel>
                    <FormControl><Input placeholder="e.g. E. coli" {...field} /></FormControl>
                  </FormItem>
                )} />
              )}

            </CardContent>
          </Card>

          {/* ── Clinical Context & Risk Factors ── */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 pt-5 px-5">
              <SectionHeader icon={ShieldAlert} label="Clinical Context & Risk Factors" color="#f59e0b" />
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="p-3 rounded-lg border border-border/40 bg-muted/10 text-xs text-muted-foreground flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                Each selected factor is fed as a feature vector into the ML pathogen prediction and resistance probability models.
              </div>
              <div className="grid grid-cols-2 gap-3">
                {RISK_FACTORS.map(({ key, label }) => (
                  <FormField key={key} control={form.control} name={key as any} render={({ field }) => (
                    <FormItem className="flex items-center gap-3 rounded-lg border border-border/40 px-4 py-3 space-y-0 hover:bg-muted/10 cursor-pointer">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500" />
                      </FormControl>
                      <FormLabel className="text-sm font-medium cursor-pointer w-full">{label}</FormLabel>
                    </FormItem>
                  )} />
                ))}

                {/* Pregnancy — shown only for female / other patients */}
                {showPregnancy && (
                  <FormField control={form.control} name="pregnancy" render={({ field }) => (
                    <FormItem className="flex items-center gap-3 rounded-lg border border-pink-500/30 bg-pink-500/5 px-4 py-3 space-y-0 hover:bg-pink-500/10 cursor-pointer">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500" />
                      </FormControl>
                      <FormLabel className="text-sm font-medium cursor-pointer w-full">Pregnancy</FormLabel>
                    </FormItem>
                  )} />
                )}
              </div>

              {/* Hint when no patient selected */}
              {!selectedPatient && (
                <p className="text-[11px] text-muted-foreground italic">
                  Select a patient above — pregnancy option will appear automatically for female/other patients.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── C. Exposure History (MDR Prediction Core) ── */}
          <Card className="border-border/50" style={{ borderColor: "rgba(251,146,60,0.3)" }}>
            <CardHeader className="pb-3 pt-5 px-5">
              <SectionHeader icon={History} label="C. Exposure History (MDR Prediction Core)" color="#f97316" />
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-5">

              {/* Previous antibiotic use */}
              <FormField control={form.control} name="abxExposure" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Previous Antibiotic Use</FormLabel>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {[
                      { value: "none",   label: "None" },
                      { value: "lt30",   label: "< 30 days" },
                      { value: "30to90", label: "30 – 90 days" },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => field.onChange(opt.value)}
                        className="py-2.5 rounded-lg border text-sm font-medium transition-all"
                        style={field.value === opt.value ? {
                          background: "rgba(249,115,22,0.15)", borderColor: "#f97316", color: "#f97316",
                        } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormItem>
              )} />

              {/* Previous hospitalization */}
              <FormField control={form.control} name="priorHospitalization90d" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Previous Hospitalization (last 90 days)</FormLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }].map(opt => (
                      <button key={opt.value} type="button" onClick={() => field.onChange(opt.value)}
                        className="py-2.5 rounded-lg border text-sm font-medium transition-all"
                        style={field.value === opt.value ? {
                          background: opt.value === "yes" ? "rgba(239,68,68,0.12)" : "rgba(20,184,166,0.12)",
                          borderColor: opt.value === "yes" ? "#ef4444" : "#14b8a6",
                          color: opt.value === "yes" ? "#ef4444" : "#14b8a6",
                        } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormItem>
              )} />

              {/* Prior culture organism */}
              <FormField control={form.control} name="priorCultureKnown" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Prior Culture Organism</FormLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[{ value: "none", label: "None" }, { value: "known", label: "Known (enter below)" }].map(opt => (
                      <button key={opt.value} type="button" onClick={() => field.onChange(opt.value)}
                        className="py-2.5 rounded-lg border text-sm font-medium transition-all"
                        style={field.value === opt.value ? {
                          background: "rgba(249,115,22,0.15)", borderColor: "#f97316", color: "#f97316",
                        } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormItem>
              )} />
              {priorCultureWatch === "known" && (
                <FormField control={form.control} name="priorCultureOrg" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="e.g. Klebsiella pneumoniae, E. coli..." {...field} />
                    </FormControl>
                  </FormItem>
                )} />
              )}

              {/* Devices / Risk sources */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Devices / Risk Sources</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "urinaryCatheter",  label: "Urinary Catheter" },
                    { key: "mechanicalVentilator", label: "Ventilator" },
                    { key: "centralVenousLine", label: "Central Line / IV Device" },
                    { key: "recentSurgery",    label: "Recent Surgery" },
                  ].map(({ key, label }) => (
                    <FormField key={key} control={form.control} name={key as any} render={({ field }) => (
                      <FormItem className="flex items-center gap-3 rounded-lg border border-border/40 px-4 py-3 space-y-0 hover:bg-muted/10 cursor-pointer">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500" />
                        </FormControl>
                        <FormLabel className="text-sm font-medium cursor-pointer w-full">{label}</FormLabel>
                      </FormItem>
                    )} />
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>

          {/* ── D. Allergy & History ── */}
          <Card className="border-border/50" style={{ borderColor: "rgba(239,68,68,0.25)" }}>
            <CardHeader className="pb-3 pt-5 px-5">
              <SectionHeader icon={AlertCircle} label="D. Allergy & History" color="#ef4444" />
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">

              <FormField control={form.control} name="allergyType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Antibiotic Allergy</FormLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[{ value: "none", label: "None" }, { value: "yes", label: "Yes (specify)" }].map(opt => (
                      <button key={opt.value} type="button" onClick={() => field.onChange(opt.value)}
                        className="py-2.5 rounded-lg border text-sm font-medium transition-all"
                        style={field.value === opt.value ? {
                          background: opt.value === "yes" ? "rgba(239,68,68,0.12)" : "rgba(20,184,166,0.12)",
                          borderColor: opt.value === "yes" ? "#ef4444" : "#14b8a6",
                          color: opt.value === "yes" ? "#ef4444" : "#14b8a6",
                        } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormItem>
              )} />

              {allergyTypeWatch === "yes" && (
                <FormField control={form.control} name="allergyDrug" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Drug / Class</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Penicillin, Cephalosporin, Sulfonamides..." {...field} />
                    </FormControl>
                  </FormItem>
                )} />
              )}

            </CardContent>
          </Card>

          {/* ── Notes ── */}
          <Card className="border-border/50">
            <CardContent className="px-5 py-5">
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Clinical Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional clinical context, observations, or instructions..." className="min-h-[80px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── ML Pipeline Preview ── */}
          <div className="rounded-xl border border-teal-500/20 p-5 bg-teal-500/5">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-teal-400" />
              <span className="text-sm font-bold text-teal-400">ML Pipeline Preview</span>
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground mb-5">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />
                <span><strong className="text-foreground">Model 1</strong> — Predicts most likely pathogens with probability scores</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />
                <span><strong className="text-foreground">Model 2</strong> — Estimates per-drug resistance probability (logistic regression)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />
                <span><strong className="text-foreground">Model 3</strong> — Utility maximization selects optimal antibiotic(s)</span>
              </li>
            </ul>
            <div className="flex justify-end">
              <Button type="submit" disabled={createCase.isPending}
                className="bg-teal-500 hover:bg-teal-600 text-black font-bold px-8">
                <Cpu className="mr-2 h-4 w-4" />
                {createCase.isPending ? "Running Analysis..." : "Run ML Analysis"}
              </Button>
            </div>
          </div>

        </form>
      </Form>
    </div>
  );
}
