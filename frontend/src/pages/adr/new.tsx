import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateAdrReport, useListCases, useListPatients } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertOctagon, User, Pill, ClipboardList, UserCheck } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

const formSchema = z.object({
  // Patient Info
  patientInitials: z.string().optional(),
  ageAtEvent: z.string().optional(),
  gender: z.enum(["M", "F", "Other"]).default("M"),
  weight: z.string().optional(),

  // Reaction
  eventStartDate: z.string().optional(),
  eventStopDate: z.string().optional(),
  severity: z.enum(["mild", "moderate", "severe", "life-threatening", "fatal"]),
  reactionDescription: z.string().min(3, "Reaction description is required"),
  labData: z.string().optional(),
  medicalHistory: z.string().optional(),

  // Seriousness flags
  seriousnessDeath: z.boolean().default(false),
  seriousnessLifeThreatening: z.boolean().default(false),
  seriousnessHospitalization: z.boolean().default(false),
  seriousnessDisability: z.boolean().default(false),
  seriousnessCongenital: z.boolean().default(false),
  seriousnessOther: z.boolean().default(false),
  seriousnessNone: z.boolean().default(false),

  // Outcome
  outcome: z.enum(["recovered", "recovering", "not-recovered", "fatal", "recovered-sequelae", "unknown"]).default("unknown"),

  // Medication Info
  drugName: z.string().min(1, "Drug name is required"),
  manufacturer: z.string().optional(),
  batchNo: z.string().optional(),
  dose: z.string().optional(),
  route: z.string().optional(),
  frequency: z.string().optional(),
  drugStartDate: z.string().optional(),
  drugStopDate: z.string().optional(),
  indication: z.string().optional(),
  causalityAssessment: z.enum(["certain", "probable", "possible", "unlikely", "unassessable", "na"]).default("possible"),

  // Action taken
  actionTaken: z.enum(["withdrawn", "dose-increased", "dose-reduced", "dose-not-changed", "not-applicable", "unknown"]).default("withdrawn"),
  reactionReappeared: z.enum(["yes", "no", "unknown"]).default("unknown"),

  // Concomitant medication
  concomitantMeds: z.string().optional(),

  // Reporter
  reporterName: z.string().optional(),
  reporterOccupation: z.string().optional(),
  reporterEmail: z.string().optional(),
  reporterPhone: z.string().optional(),
  reportDate: z.string().optional(),

  // Internal linking
  patientId: z.coerce.number().optional(),
  caseId: z.coerce.number().optional(),
});

const SectionHeader = ({ icon: Icon, label, color = "#14b8a6" }: { icon: any; label: string; color?: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <h3 className="font-bold text-sm uppercase tracking-wider" style={{ color }}>{label}</h3>
    <div className="flex-1 h-px" style={{ background: `${color}33` }} />
  </div>
);

export default function NewAdrReport() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const createReport = useCreateAdrReport();
  const { data: casesData } = useListCases({ page: 1, limit: 200 });
  const { data: patientsData } = useListPatients({ page: 1, limit: 200 });
  const allCases = casesData?.cases ?? [];
  const allPatients = patientsData?.patients ?? [];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gender: "M", severity: "moderate", outcome: "unknown",
      causalityAssessment: "possible", actionTaken: "withdrawn",
      reactionReappeared: "unknown",
      eventStartDate: new Date().toISOString().split("T")[0],
      reportDate: new Date().toISOString().split("T")[0],
      seriousnessDeath: false, seriousnessLifeThreatening: false,
      seriousnessHospitalization: false, seriousnessDisability: false,
      seriousnessCongenital: false, seriousnessOther: false, seriousnessNone: false,
    },
  });

  const selectedPatientId = form.watch("patientId");

  const availableCases = selectedPatientId
    ? allCases.filter(c => Number(c.patientId) === Number(selectedPatientId))
    : allCases;

  const handleSelectPatient = (pIdStr: string) => {
    if (pIdStr === "none") {
      form.setValue("patientId", undefined);
      form.setValue("caseId", undefined);
      return;
    }
    const pId = Number(pIdStr);
    form.setValue("patientId", pId);

    const p = allPatients.find(item => item.id === pId);
    if (p) {
      const names = p.name.trim().split(/\s+/);
      const initials = names.map(n => n[0].toUpperCase() + ".").join("");
      form.setValue("patientInitials", initials);
      form.setValue("ageAtEvent", `${p.age} yrs`);

      const g = (p.gender || "").toUpperCase();
      if (g.startsWith("M")) form.setValue("gender", "M");
      else if (g.startsWith("F")) form.setValue("gender", "F");
      else form.setValue("gender", "Other");

      if (p.weight) {
        form.setValue("weight", String(p.weight));
      }

      // Filter cases belonging strictly to this patient
      const patientCases = allCases.filter(c => Number(c.patientId) === pId);
      if (patientCases.length === 1) {
        handleSelectCase(String(patientCases[0].id));
      } else {
        form.setValue("caseId", undefined);
      }

      toast({
        title: "Patient Details Auto-Filled",
        description: `Loaded details & ${patientCases.length} case(s) for ${p.name}.`,
      });
    }
  };

  const handleSelectCase = (cIdStr: string) => {
    if (cIdStr === "none") {
      form.setValue("caseId", undefined);
      return;
    }
    const cId = Number(cIdStr);
    form.setValue("caseId", cId);

    const c = allCases.find(item => item.id === cId);
    if (c) {
      if (c.patientId) {
        handleSelectPatient(String(c.patientId));
      }
      if (c.organism) {
        form.setValue("drugName", c.organism ? `${c.organism} Therapy` : "");
      }
      if (c.infectionType) {
        form.setValue("indication", c.infectionType.toUpperCase());
      }
      toast({
        title: "Case Details Linked",
        description: `Linked Case #${c.caseNumber}.`,
      });
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlPatientId = searchParams.get("patientId");
    const urlCaseId = searchParams.get("caseId");

    if (urlPatientId && allPatients.length > 0) {
      handleSelectPatient(urlPatientId);
    }
    if (urlCaseId && allCases.length > 0) {
      handleSelectCase(urlCaseId);
    }
  }, [allPatients.length, allCases.length]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Build a comprehensive description from all extra fields
    const seriousnessFlags = [
      values.seriousnessDeath && "Death",
      values.seriousnessLifeThreatening && "Life Threatening",
      values.seriousnessHospitalization && "Hospitalization",
      values.seriousnessDisability && "Disability",
      values.seriousnessCongenital && "Congenital Anomaly",
      values.seriousnessOther && "Other Medically Important",
      values.seriousnessNone && "None",
    ].filter(Boolean).join(", ");

    const fullDescription = [
      values.reactionDescription,
      values.labData && `Lab Data: ${values.labData}`,
      values.medicalHistory && `Medical History: ${values.medicalHistory}`,
      seriousnessFlags && `Seriousness: ${seriousnessFlags}`,
      values.concomitantMeds && `Concomitant Medications: ${values.concomitantMeds}`,
      values.indication && `Drug Indication: ${values.indication}`,
      values.frequency && `Dosing: ${values.dose || ""} ${values.route || ""} ${values.frequency}`,
      values.actionTaken && `Action Taken: ${values.actionTaken}`,
      values.reactionReappeared !== "unknown" && `Reaction Reappeared: ${values.reactionReappeared}`,
      values.reporterName && `Reporter: ${values.reporterName} (${values.reporterOccupation || ""})`,
    ].filter(Boolean).join(" | ");

    createReport.mutate({
      data: {
        drugName: values.drugName,
        reactionDescription: fullDescription,
        severity: values.severity,
        outcome: values.outcome,
        onsetDate: values.eventStartDate || new Date().toISOString().split("T")[0],
        batchNo: values.batchNo,
        patientId: values.patientId,
        caseId: values.caseId,
      }
    }, {
      onSuccess: (res) => {
        toast({ title: "ADR Report submitted successfully" });
        setLocation(`/adr/${res.id}`);
      },
      onError: (err) => {
        toast({ title: "Submission failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const checkboxItem = (name: any, label: string) => (
    <FormField key={name} control={form.control} name={name} render={({ field }) => (
      <FormItem className="flex items-center gap-2 space-y-0">
        <FormControl>
          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
        </FormControl>
        <FormLabel className="text-sm font-normal cursor-pointer">{label}</FormLabel>
      </FormItem>
    )} />
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <Breadcrumbs items={[{ label: "ADR Reporting", href: "/adr" }, { label: "New ADR Report" }]} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: "#ef4444" }}>
            <AlertOctagon className="h-6 w-6" /> Suspected ADR Reporting Form
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            For voluntary reporting of Adverse Drug Reactions by Healthcare Professionals
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground border rounded-lg px-3 py-2">
          <div className="font-semibold">PvPI — Pharmacovigilance Programme of India</div>
          <div>National Coordination Centre · ICMR</div>
          <a
            href="http://www.ipc.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-teal-400 hover:text-teal-300 hover:underline transition-colors font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            www.ipc.gov.in
          </a>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

          {/* ── A: Patient Information ── */}
          <Card className="border-border/50 shadow-xs">
            <CardHeader className="pb-3 pt-5 px-6">
              <SectionHeader icon={User} label="A. Patient Information & System Database Lookup" />
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              {/* Top System Patient & Case Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 rounded-lg bg-teal-500/5 border border-teal-500/20">
                <FormField control={form.control} name="patientId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-teal-500" /> Select Registered Patient (Auto-Fills Form)
                    </FormLabel>
                    <Select
                      onValueChange={(val) => handleSelectPatient(val)}
                      value={field.value ? String(field.value) : "none"}
                    >
                      <FormControl><SelectTrigger className="bg-card text-xs font-medium"><SelectValue placeholder="Select patient from system database…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">— Select Registered Patient —</SelectItem>
                        {allPatients.map(p => (
                          <SelectItem key={p.id} value={String(p.id)} className="text-xs font-medium">
                            {p.name} (ID: {p.patientId} · {p.age} yrs · {p.gender})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="caseId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5 text-teal-500" /> Select Clinical Case {selectedPatientId ? `(${availableCases.length} for Patient)` : "(Optional Link)"}
                    </FormLabel>
                    <Select
                      onValueChange={(val) => handleSelectCase(val)}
                      value={field.value ? String(field.value) : "none"}
                    >
                      <FormControl><SelectTrigger className="bg-card text-xs font-medium"><SelectValue placeholder={selectedPatientId ? "Select patient clinical case…" : "Select clinical case…"} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">
                          {selectedPatientId
                            ? `— Select Patient Case (${availableCases.length} available) —`
                            : "— Select Clinical Case —"}
                        </SelectItem>
                        {availableCases.length === 0 ? (
                          <SelectItem value="no_cases" disabled className="text-xs italic text-muted-foreground">
                            No clinical cases found for selected patient
                          </SelectItem>
                        ) : (
                          availableCases.map(c => (
                            <SelectItem key={c.id} value={String(c.id)} className="text-xs font-medium">
                              {c.caseNumber} — {c.infectionType} ({c.severity})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              {/* Auto-filled / Manual Fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                <FormField control={form.control} name="patientInitials" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Patient Initials</FormLabel>
                    <FormControl><Input placeholder="e.g. R.K." {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="ageAtEvent" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Age at Event / DOB</FormLabel>
                    <FormControl><Input placeholder="e.g. 45 yrs" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="weight" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Weight (kg)</FormLabel>
                    <FormControl><Input placeholder="e.g. 68" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* ── B: Suspected Adverse Reaction ── */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 pt-5 px-6">
              <SectionHeader icon={AlertOctagon} label="B. Suspected Adverse Reaction" color="#ef4444" />
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="eventStartDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Reaction Start Date *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="eventStopDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Reaction Stop Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="severity" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Severity *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="mild">Mild</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
                        <SelectItem value="life-threatening">Life Threatening</SelectItem>
                        <SelectItem value="fatal">Fatal</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="reactionDescription" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Describe Event / Reaction (with treatment details) *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the clinical presentation, timing, and management..." className="min-h-[90px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="labData" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Relevant Lab / Test Data</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. LFT elevated, Creatinine 2.1 mg/dL..." className="min-h-[70px]" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="medicalHistory" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Relevant Medical / Medication History</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Allergies, pregnancy, smoking, alcohol, hepatic/renal dysfunction, past surgery..." className="min-h-[70px]" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Seriousness */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Seriousness of Reaction</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                  {checkboxItem("seriousnessNone", "Not Serious")}
                  {checkboxItem("seriousnessDeath", "Death")}
                  {checkboxItem("seriousnessLifeThreatening", "Life Threatening")}
                  {checkboxItem("seriousnessHospitalization", "Hospitalization / Prolonged")}
                  {checkboxItem("seriousnessDisability", "Disability")}
                  {checkboxItem("seriousnessCongenital", "Congenital Anomaly")}
                  {checkboxItem("seriousnessOther", "Other Medically Important")}
                </div>
              </div>

              {/* Outcome */}
              <FormField control={form.control} name="outcome" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Outcome *</FormLabel>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { value: "recovered", label: "Recovered" },
                      { value: "recovering", label: "Recovering" },
                      { value: "not-recovered", label: "Not Recovered" },
                      { value: "fatal", label: "Fatal" },
                      { value: "recovered-sequelae", label: "Recovered w/ Sequelae" },
                      { value: "unknown", label: "Unknown" },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => field.onChange(opt.value)}
                        className="text-xs px-2 py-2 rounded-lg border transition-all font-medium"
                        style={field.value === opt.value ? {
                          background: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.5)", color: "#ef4444"
                        } : {
                          background: "transparent", borderColor: "rgba(255,255,255,0.1)", color: "inherit"
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── C: Suspected Medication ── */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 pt-5 px-6">
              <SectionHeader icon={Pill} label="C. Suspected Medication" color="#f59e0b" />
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField control={form.control} name="drugName" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-xs">Drug Name (Brand / Generic) *</FormLabel>
                    <FormControl><Input placeholder="e.g. Vancomycin / Amoxicillin" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="manufacturer" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Manufacturer</FormLabel>
                    <FormControl><Input placeholder="e.g. Cipla" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="batchNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Batch / Lot No.</FormLabel>
                    <FormControl><Input placeholder="e.g. B2024X" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <FormField control={form.control} name="dose" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Dose</FormLabel>
                    <FormControl><Input placeholder="e.g. 500mg" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="route" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Route</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Route" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="oral">Oral</SelectItem>
                        <SelectItem value="iv">IV</SelectItem>
                        <SelectItem value="im">IM</SelectItem>
                        <SelectItem value="sc">SC</SelectItem>
                        <SelectItem value="topical">Topical</SelectItem>
                        <SelectItem value="inhaled">Inhaled</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="frequency" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Frequency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Freq." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="od">OD (Once Daily)</SelectItem>
                        <SelectItem value="bd">BD (Twice Daily)</SelectItem>
                        <SelectItem value="tds">TDS (Thrice Daily)</SelectItem>
                        <SelectItem value="qid">QID</SelectItem>
                        <SelectItem value="sos">SOS</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="drugStartDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Therapy Start</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="drugStopDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Therapy Stop</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="indication" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Indication</FormLabel>
                    <FormControl><Input placeholder="e.g. UTI, Pneumonia" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="causalityAssessment" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Causality Assessment (WHO-UMC)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="certain">Certain</SelectItem>
                        <SelectItem value="probable">Probable</SelectItem>
                        <SelectItem value="possible">Possible</SelectItem>
                        <SelectItem value="unlikely">Unlikely</SelectItem>
                        <SelectItem value="unassessable">Unassessable / Unclassifiable</SelectItem>
                        <SelectItem value="na">Not Applicable</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <FormField control={form.control} name="actionTaken" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Action Taken</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="withdrawn">Drug Withdrawn</SelectItem>
                        <SelectItem value="dose-increased">Dose Increased</SelectItem>
                        <SelectItem value="dose-reduced">Dose Reduced</SelectItem>
                        <SelectItem value="dose-not-changed">Dose Not Changed</SelectItem>
                        <SelectItem value="not-applicable">Not Applicable</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="reactionReappeared" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Reaction Reappeared After Reintroduction?</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="unknown">Effect Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="concomitantMeds" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Concomitant Medications (incl. self-medication & herbal)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Other medications taken concurrently (name, dose, dates, indication)..." className="min-h-[60px]" {...field} />
                  </FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── D: Reporter Details ── */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 pt-5 px-6">
              <SectionHeader icon={UserCheck} label="D. Reporter Details" color="#8b5cf6" />
            </CardHeader>
            <CardContent className="px-6 pb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField control={form.control} name="reporterName" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="text-xs">Name &amp; Professional Address</FormLabel>
                  <FormControl><Input placeholder="Dr. Name, Hospital, City" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="reporterOccupation" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Occupation</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="physician">Physician</SelectItem>
                      <SelectItem value="pharmacist">Pharmacist</SelectItem>
                      <SelectItem value="nurse">Nurse</SelectItem>
                      <SelectItem value="dentist">Dentist</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="reportDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Date of Report</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="reporterEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Email</FormLabel>
                  <FormControl><Input placeholder="email@hospital.com" type="email" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="reporterPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Phone (with STD code)</FormLabel>
                  <FormControl><Input placeholder="e.g. 0120-2783400" {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="text-[10px] text-muted-foreground text-center px-4 leading-relaxed border rounded-lg p-3 bg-muted/10 space-y-1">
            <p>
              <strong>Confidentiality:</strong> The patient's identity is held in strict confidence and protected to the fullest extent.
              Submission does not constitute an admission that medical personnel or manufacturer caused the reaction.
            </p>
            <p>
              Report to NCC-PvPI: pvpi.ipc@gov.in &nbsp;|&nbsp; Helpline: 1800 180 3024 &nbsp;|&nbsp;
              <a
                href="http://www.ipc.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-400 hover:text-teal-300 hover:underline font-medium transition-colors"
              >
                www.ipc.gov.in
              </a>
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setLocation("/adr")}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={createReport.isPending} className="px-8">
              {createReport.isPending ? "Submitting..." : "Submit ADR Report"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
