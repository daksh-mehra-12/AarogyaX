import * as React from "react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useToast } from "@/hooks/use-toast";
import { usePatientQuickLook, PatientNameLink } from "@/components/patient-quick-look-modal";
import {
  Biohazard, Plus, Trash2, Check, Sparkles, ShieldAlert,
  FlaskConical, Cpu, User, Calendar, AlertTriangle, CheckCircle2,
  ArrowRight, Loader2, Info
} from "lucide-react";

interface SusceptibilityRow {
  id: string;
  antibiotic: string;
  susceptibility: "Susceptible (S)" | "Intermediate (I)" | "Resistant (R)" | "Unknown";
  micValue: string;
  diskDiffusionDiameter: string;
}

const COMMON_ORGANISMS = [
  "Escherichia coli",
  "Klebsiella pneumoniae",
  "Pseudomonas aeruginosa",
  "Acinetobacter baumannii",
  "Staphylococcus aureus (MRSA/MSSA)",
  "Enterococcus faecalis",
  "Enterococcus faecium",
  "Streptococcus pneumoniae",
  "Proteus mirabilis",
  "Serratia marcescens",
  "Citrobacter freundii",
  "Enterobacter cloacae",
  "Other Organism"
];

const COMMON_ANTIBIOTICS = [
  "Amikacin",
  "Amoxicillin-Clavulanate",
  "Azithromycin",
  "Cefepime",
  "Ceftriaxone",
  "Ciprofloxacin",
  "Colistin",
  "Doxycycline",
  "Fosfomycin",
  "Levofloxacin",
  "Linezolid",
  "Meropenem",
  "Nitrofurantoin",
  "Piperacillin-Tazobactam",
  "Trimethoprim-Sulfamethoxazole",
  "Vancomycin"
];

export default function NewAmrRecordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openQuickLook, quickLookModal } = usePatientQuickLook();

  // Read URL query parameters for ?patientId=XX
  const searchParams = new URLSearchParams(window.location.search);
  const preselectedPatientId = searchParams.get("patientId");

  // Fetch list of registered patients for selection
  const { data: patientsData } = useQuery<{ patients: any[] }>({
    queryKey: ["patients-list-dropdown"],
    queryFn: async () => {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch("/api/patients", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) return { patients: [] };
      return res.json();
    }
  });

  // Section A: Patient & Sample State
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || "");
  const [anonymousPatientId, setAnonymousPatientId] = useState<string>("");
  const [patientAge, setPatientAge] = useState<number | "">(45);
  const [patientGender, setPatientGender] = useState<string>("male");
  const [specimenType, setSpecimenType] = useState<string>("blood");
  const [collectionDate, setCollectionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [collectionTime, setCollectionTime] = useState<string>("10:00");
  const [infectionOrigin, setInfectionOrigin] = useState<string>("community-associated");
  const [department, setDepartment] = useState<string>("General Medicine");

  // Section B: Microbiology & Susceptibility
  const [organism, setOrganism] = useState<string>("Escherichia coli");
  const [cultureResult, setCultureResult] = useState<string>("positive");
  const [testingMethod, setTestingMethod] = useState<string>("Automated VITEK 2");
  const [laboratoryStandard, setLaboratoryStandard] = useState<string>("CLSI M100 2024");
  const [laboratoryNotes, setLaboratoryNotes] = useState<string>("");

  const [susceptibilities, setSusceptibilities] = useState<SusceptibilityRow[]>([
    {
      id: "1",
      antibiotic: "Amikacin",
      susceptibility: "Susceptible (S)",
      micValue: "<= 2",
      diskDiffusionDiameter: "22"
    },
    {
      id: "2",
      antibiotic: "Ciprofloxacin",
      susceptibility: "Resistant (R)",
      micValue: ">= 4",
      diskDiffusionDiameter: "11"
    }
  ]);

  // Section C: AI Prediction Integration
  const [runPrediction, setRunPrediction] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState<string>("GradientBoosting");
  const [severity, setSeverity] = useState<string>("moderate");
  const [icuStatus, setIcuStatus] = useState<boolean>(false);
  const [priorAntibiotics, setPriorAntibiotics] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Selected Patient Details Object
  const selectedPatient = React.useMemo(() => {
    if (!selectedPatientId || !patientsData?.patients) return null;
    return patientsData.patients.find(p => String(p.id) === String(selectedPatientId));
  }, [selectedPatientId, patientsData]);

  // Handle adding antibiotic row
  const addSusceptibilityRow = () => {
    setSusceptibilities(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        antibiotic: COMMON_ANTIBIOTICS[prev.length % COMMON_ANTIBIOTICS.length] || "Nitrofurantoin",
        susceptibility: "Susceptible (S)",
        micValue: "",
        diskDiffusionDiameter: ""
      }
    ]);
  };

  const removeSusceptibilityRow = (id: string) => {
    if (susceptibilities.length <= 1) {
      toast({ title: "At least one susceptibility entry is recommended" });
      return;
    }
    setSusceptibilities(prev => prev.filter(r => r.id !== id));
  };

  const updateSusceptibilityRow = (id: string, field: keyof SusceptibilityRow, val: any) => {
    setSusceptibilities(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  // Submit AMR Record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("aarogya_token");
      const payload = {
        patientId: selectedPatientId ? parseInt(selectedPatientId) : null,
        anonymousPatientId: selectedPatientId ? null : anonymousPatientId || `ANON-${Date.now().toString().slice(-4)}`,
        patientAge: selectedPatient ? selectedPatient.age : (patientAge !== "" ? Number(patientAge) : 45),
        patientGender: selectedPatient ? selectedPatient.gender : patientGender,
        specimenType,
        collectionDate,
        collectionTime,
        infectionOrigin,
        department,
        organism,
        cultureResult,
        testingMethod,
        laboratoryStandard,
        laboratoryNotes,
        susceptibilities: susceptibilities.map(s => ({
          antibiotic: s.antibiotic,
          susceptibility: s.susceptibility,
          micValue: s.micValue ? `${s.micValue} µg/mL` : undefined,
          diskDiffusionDiameter: s.diskDiffusionDiameter ? Number(s.diskDiffusionDiameter) : undefined
        })),
        runPrediction,
        selectedModel,
        severity,
        icuStatus,
        priorAntibiotics
      };

      const res = await fetch("/api/amr-records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to save AMR record");
      }

      const data = await res.json();
      toast({
        title: "AMR Laboratory Record Saved!",
        description: `Record ${data.record.recordId} persisted successfully in AMR History.`
      });

      queryClient.invalidateQueries({ queryKey: ["amr-records"] });
      setLocation("/amr-history");
    } catch (err: any) {
      toast({
        title: "Submission Error",
        description: err.message || "Could not save AMR laboratory record",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans pb-10">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "AMR History", href: "/amr-history" },
          { label: "Add AMR Record" }
        ]}
      />

      {/* Header Banner */}
      <div className="bg-card p-5 rounded-xl border border-border shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Biohazard className="h-6 w-6 text-primary" />
            New AMR Laboratory Record Entry
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Separate laboratory test entry linking microbiology results, specimen context, and AI risk prediction
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION A — PATIENT & SAMPLE INFORMATION */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="bg-muted/20 border-b border-border p-4">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Section A — Patient &amp; Sample Information
            </CardTitle>
            <CardDescription className="text-xs">
              Link this laboratory test to a registered patient or record a standalone sample.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            {/* Registered Patient Selection Dropdown */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Select Registered Patient (Optional)</Label>
              <Select value={selectedPatientId} onValueChange={(val) => setSelectedPatientId(val)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="-- Select Registered Patient --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- Standalone Sample (No Registered Patient Linked) --</SelectItem>
                  {patientsData?.patients?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.patientId}) — {p.age}y {p.gender}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* If Patient Selected: Display Prefilled Confirmation Card */}
            {selectedPatient ? (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Linked Patient Details (Prefilled from Patient Record):
                  </span>
                  <PatientNameLink patient={selectedPatient} onOpenQuickLook={openQuickLook} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <div><strong>Age / Sex:</strong> {selectedPatient.age}y / {selectedPatient.gender}</div>
                  <div><strong>Blood Group:</strong> {selectedPatient.bloodGroup || "O+"}</div>
                  <div><strong>Weight:</strong> {selectedPatient.weight ? `${selectedPatient.weight} kg` : "N/A"}</div>
                  <div><strong>Comorbidities:</strong> {selectedPatient.diabetes ? "Diabetes, " : ""}{selectedPatient.ckd ? "CKD, " : ""}{(!selectedPatient.diabetes && !selectedPatient.ckd) ? "None" : ""}</div>
                </div>
              </div>
            ) : (
              /* Standalone Sample Fields */
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground">Anonymous Sample Barcode / ID</Label>
                  <Input
                    placeholder="e.g. SMP-SURV-1029"
                    value={anonymousPatientId}
                    onChange={(e) => setAnonymousPatientId(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground">Patient Age</Label>
                  <Input
                    type="number"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value ? Number(e.target.value) : "")}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground">Patient Sex / Gender</Label>
                  <Select value={patientGender} onValueChange={setPatientGender}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Specimen Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Specimen / Sample Type</Label>
                <Select value={specimenType} onValueChange={setSpecimenType}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blood">Blood</SelectItem>
                    <SelectItem value="urine">Urine</SelectItem>
                    <SelectItem value="sputum">Sputum / Endotracheal Aspirate</SelectItem>
                    <SelectItem value="stool">Stool / Stool Swab</SelectItem>
                    <SelectItem value="wound_swab">Wound / Pus Swab</SelectItem>
                    <SelectItem value="csf">CSF / Body Fluid</SelectItem>
                    <SelectItem value="other">Other Specimen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Collection Date</Label>
                <Input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Infection Origin</Label>
                <Select value={infectionOrigin} onValueChange={setInfectionOrigin}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="community-associated">Community-Associated</SelectItem>
                    <SelectItem value="healthcare-associated">Healthcare-Associated / Hospital</SelectItem>
                    <SelectItem value="unknown">Unknown / Unspecified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION B — MICROBIOLOGY & LABORATORY DATA */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="bg-muted/20 border-b border-border p-4">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              Section B — Microbiology &amp; Laboratory Data
            </CardTitle>
            <CardDescription className="text-xs">
              Microorganism culture results, testing methods, and organism-antimicrobial susceptibility panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Identified Microorganism</Label>
                <Select value={organism} onValueChange={setOrganism}>
                  <SelectTrigger className="h-9 text-xs font-medium italic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_ORGANISMS.map((org) => (
                      <SelectItem key={org} value={org} className="italic text-xs">
                        {org}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Culture Status</Label>
                <Select value={cultureResult} onValueChange={setCultureResult}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Culture Positive (Isolate Identified)</SelectItem>
                    <SelectItem value="negative">Culture Negative (No Growth)</SelectItem>
                    <SelectItem value="mixed">Mixed Growth</SelectItem>
                    <SelectItem value="pending">Culture Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Testing Standard</Label>
                <Select value={laboratoryStandard} onValueChange={setLaboratoryStandard}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLSI M100 2024">CLSI M100 2024</SelectItem>
                    <SelectItem value="EUCAST v14.0">EUCAST v14.0</SelectItem>
                    <SelectItem value="ICMR Surveillance Guideline">ICMR Surveillance Guideline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dynamic Antimicrobial Susceptibility Table */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  Antimicrobial Susceptibility Testing Panel
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSusceptibilityRow}
                  className="h-7 text-xs font-semibold gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Antibiotic
                </Button>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold">Antibiotic / Antimicrobial</TableHead>
                      <TableHead className="text-[10px] font-bold">Category Result</TableHead>
                      <TableHead className="text-[10px] font-bold">MIC (µg/mL)</TableHead>
                      <TableHead className="text-[10px] font-bold">Zone (mm)</TableHead>
                      <TableHead className="text-[10px] font-bold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {susceptibilities.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="p-2">
                          <Select
                            value={row.antibiotic}
                            onValueChange={(val) => updateSusceptibilityRow(row.id, "antibiotic", val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMON_ANTIBIOTICS.map((ab) => (
                                <SelectItem key={ab} value={ab} className="text-xs">
                                  {ab}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell className="p-2">
                          <Select
                            value={row.susceptibility}
                            onValueChange={(val: any) => updateSusceptibilityRow(row.id, "susceptibility", val)}
                          >
                            <SelectTrigger className="h-8 text-xs font-semibold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Susceptible (S)" className="text-emerald-600 font-semibold">Susceptible (S)</SelectItem>
                              <SelectItem value="Intermediate (I)" className="text-amber-600 font-semibold">Intermediate (I)</SelectItem>
                              <SelectItem value="Resistant (R)" className="text-rose-600 font-semibold">Resistant (R)</SelectItem>
                              <SelectItem value="Unknown">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell className="p-2">
                          <Input
                            placeholder="e.g. <= 2"
                            value={row.micValue}
                            onChange={(e) => updateSusceptibilityRow(row.id, "micValue", e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </TableCell>

                        <TableCell className="p-2">
                          <Input
                            type="number"
                            placeholder="e.g. 22"
                            value={row.diskDiffusionDiameter}
                            onChange={(e) => updateSusceptibilityRow(row.id, "diskDiffusionDiameter", e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </TableCell>

                        <TableCell className="p-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSusceptibilityRow(row.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Microbiology / Laboratory Notes</Label>
              <Textarea
                placeholder="Enter relevant clinical notes, isolate characteristics, or CLSI remarks..."
                value={laboratoryNotes}
                onChange={(e) => setLaboratoryNotes(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* SECTION C — AMR ANALYSIS AND PREDICTION */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="bg-muted/20 border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  Section C — AI AMR Resistance Prediction Integration
                </CardTitle>
                <CardDescription className="text-xs">
                  Optionally run trained Machine Learning models on sample parameters to infer resistance risk level.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="run-pred"
                  checked={runPrediction}
                  onCheckedChange={(checked) => setRunPrediction(!!checked)}
                />
                <label htmlFor="run-pred" className="text-xs font-bold text-foreground cursor-pointer">
                  Execute AI Prediction
                </label>
              </div>
            </div>
          </CardHeader>

          {runPrediction && (
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Select Trained ML Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GradientBoosting">Gradient Boosting (97.3% Acc)</SelectItem>
                      <SelectItem value="RandomForest">Random Forest (97.3% Acc)</SelectItem>
                      <SelectItem value="DecisionTree">Decision Tree (97.3% Acc)</SelectItem>
                      <SelectItem value="LogisticRegression">Logistic Regression (86.5% Acc)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Clinical Infection Severity</Label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mild">Mild (Outpatient / Low Risk)</SelectItem>
                      <SelectItem value="moderate">Moderate (Inpatient Ward)</SelectItem>
                      <SelectItem value="severe">Severe (High AMR Probability)</SelectItem>
                      <SelectItem value="critical">Critical (ICU / Sepsis Risk)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 pt-5 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="icu-check"
                      checked={icuStatus}
                      onCheckedChange={(c) => setIcuStatus(!!c)}
                    />
                    <label htmlFor="icu-check" className="text-xs text-foreground font-medium cursor-pointer">
                      ICU Admission
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="prior-ab"
                      checked={priorAntibiotics}
                      onCheckedChange={(c) => setPriorAntibiotics(!!c)}
                    />
                    <label htmlFor="prior-ab" className="text-xs text-foreground font-medium cursor-pointer">
                      Prior Antibiotics (&lt;30d)
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span>
                  The model generates predicted AMR risk probability and evidence-based stewardship recommendations which will be stored alongside actual laboratory susceptibility entries.
                </span>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Submission Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/amr-history")}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="text-xs font-bold gap-2 px-6"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving AMR Record...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Save AMR Laboratory Record
              </>
            )}
          </Button>
        </div>
      </form>

      {quickLookModal}
    </div>
  );
}
