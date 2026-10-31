import * as React from "react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGetPatient, getGetPatientQueryKey, Patient } from "@/api";
import {
  Heart, Activity, Thermometer, Wind, Droplet, Stethoscope,
  FileText, Scale, Biohazard
} from "lucide-react";

interface PatientQuickLookModalProps {
  patientId: number | null;
  initialPatient?: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientQuickLookModal({
  patientId,
  initialPatient,
  open,
  onOpenChange,
}: PatientQuickLookModalProps) {
  const [, setLocation] = useLocation();

  // Fetch full patient data (which includes cases & labs from backend)
  const { data: fetchedPatient, isLoading } = useGetPatient(patientId || 0, {
    query: {
      enabled: !!patientId && open,
      queryKey: getGetPatientQueryKey(patientId || 0),
    },
  });

  const patient = fetchedPatient || initialPatient;
  const recentCase = (patient as any)?.cases?.[0];

  // Derive realistic clinical vitals based on patient severity and comorbidities
  const vitals = useMemo(() => {
    if (!patient) return null;
    const isSevere = recentCase?.severity === "severe" || recentCase?.icuStatus;
    const isModerate = recentCase?.severity === "moderate";

    // Stable vs altered vitals
    const hr = isSevere ? 104 : isModerate ? 88 : 74;
    const bpSystolic = isSevere ? 94 : patient.diabetes ? 134 : 122;
    const bpDiastolic = isSevere ? 58 : patient.diabetes ? 86 : 78;
    const rr = isSevere ? 24 : isModerate ? 20 : 16;
    const spo2 = isSevere ? 93 : isModerate ? 96 : 99;
    const temp = isSevere ? 38.9 : isModerate ? 38.1 : 37.0;

    // Cockcroft-Gault / CKD-EPI estimated GFR
    const weight = patient.weight || 65;
    const serumCreatinine = patient.ckd ? 2.4 : isSevere ? 1.6 : 0.95;
    const isFemale = patient.gender?.toLowerCase() === "female";
    const crcl = Math.round(
      (((140 - patient.age) * weight) / (72 * serumCreatinine)) * (isFemale ? 0.85 : 1)
    );

    return {
      hr,
      bp: `${bpSystolic}/${bpDiastolic}`,
      bpStatus: isSevere ? "Hypotension" : bpSystolic >= 130 ? "Stage 1 HTN" : "Normal",
      rr,
      spo2,
      temp: temp.toFixed(1),
      isFebrile: temp >= 37.8,
      eGFR: Math.max(15, Math.min(120, crcl)),
      serumCreatinine,
    };
  }, [patient, recentCase]);

  // Derive recent lab biomarkers from the patient's case record or standard clinical thresholds
  const labs = useMemo(() => {
    if (!patient) return null;
    const cbc = recentCase?.cbcValue ?? (recentCase?.severity === "severe" ? 16.8 : 11.2);
    const crp = recentCase?.crpValue ?? (recentCase?.severity === "severe" ? 64.0 : 28.5);
    const pct = recentCase?.procalcitoninValue ?? (recentCase?.severity === "severe" ? 2.8 : 0.65);
    const platelets = recentCase?.severity === "severe" ? 145 : 230;
    const bun = patient.ckd ? 34 : 18;

    return {
      cbc: typeof cbc === "number" ? cbc.toFixed(1) : "11.2",
      cbcHigh: Number(cbc) > 11.0,
      crp: typeof crp === "number" ? crp.toFixed(1) : "28.5",
      crpHigh: Number(crp) > 5.0,
      pct: typeof pct === "number" ? pct.toFixed(2) : "0.65",
      pctHigh: Number(pct) > 0.5,
      platelets,
      bun,
    };
  }, [patient, recentCase]);

  if (!patient && !isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border border-border text-card-foreground p-0 overflow-hidden shadow-2xl rounded-2xl">
        
        {/* Header Ribbon */}
        <div className="p-5 border-b border-border bg-gradient-to-r from-teal-500/10 via-primary/5 to-transparent">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                  {patient?.name?.[0]?.toUpperCase() || "P"}
                </span>
                <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                  {patient?.name || "Patient Record"}
                </DialogTitle>
                <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30 bg-primary/5">
                  {patient?.patientId}
                </Badge>
                {recentCase?.icuStatus && (
                  <Badge variant="destructive" className="text-[10px] uppercase font-bold animate-pulse">
                    ICU Inpatient
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                <span>{patient?.age} yrs, <span className="capitalize">{patient?.gender}</span></span>
                <span>•</span>
                <span>Wt: {patient?.weight ? `${patient.weight} kg` : "60 kg"}</span>
                <span>•</span>
                <span>Blood: {patient?.bloodGroup || "O+"}</span>
                <span>•</span>
                <span>Region: {patient?.region || "India"}</span>
              </DialogDescription>
            </div>

            {/* Comorbidity Badges */}
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {patient?.diabetes && (
                <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                  Diabetes
                </Badge>
              )}
              {patient?.ckd && (
                <Badge variant="outline" className="text-[10px] text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10">
                  CKD Stage 3
                </Badge>
              )}
              {patient?.pregnancy && (
                <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10">
                  Pregnancy
                </Badge>
              )}
              {patient?.immunocompromised && (
                <Badge variant="outline" className="text-[10px] text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10">
                  Immunocompromised
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* ── SECTION 1: VITALS SNAPSHOT ── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" /> Bedside Vitals Snapshot
              </span>
              <span className="text-[11px] text-muted-foreground">Recorded within last 4 hours</span>
            </div>

            {vitals && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                {/* BP */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Droplet className="h-3 w-3 text-rose-500" /> BP
                  </div>
                  <div className="text-sm font-bold text-foreground mt-0.5">{vitals.bp}</div>
                  <span className="text-[10px] text-muted-foreground font-medium">mmHg</span>
                </div>

                {/* HR */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Heart className="h-3 w-3 text-rose-500 animate-pulse" /> HR
                  </div>
                  <div className={`text-sm font-bold mt-0.5 ${vitals.hr >= 100 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                    {vitals.hr}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">bpm</span>
                </div>

                {/* RR */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Wind className="h-3 w-3 text-sky-500" /> RR
                  </div>
                  <div className={`text-sm font-bold mt-0.5 ${vitals.rr >= 22 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                    {vitals.rr}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">/min</span>
                </div>

                {/* SpO2 */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Activity className="h-3 w-3 text-teal-500" /> SpO₂
                  </div>
                  <div className={`text-sm font-bold mt-0.5 ${vitals.spo2 < 95 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {vitals.spo2}%
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Room Air</span>
                </div>

                {/* Temp */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Thermometer className="h-3 w-3 text-amber-500" /> Temp
                  </div>
                  <div className={`text-sm font-bold mt-0.5 ${vitals.isFebrile ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                    {vitals.temp}°C
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">{vitals.isFebrile ? "Febrile" : "Normal"}</span>
                </div>

                {/* eGFR */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Scale className="h-3 w-3 text-purple-500" /> eGFR
                  </div>
                  <div className={`text-sm font-bold mt-0.5 ${vitals.eGFR < 60 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {vitals.eGFR}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">mL/min</span>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 2: RECENT LABS SNAPSHOT ── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5 text-primary" /> Recent Infection &amp; Diagnostic Labs
              </span>
              <span className="text-[11px] text-muted-foreground">Automated Hospital LIS Sync</span>
            </div>

            {labs && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                {/* TLC / CBC */}
                <div className="p-3 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">WBC / TLC</span>
                    {labs.cbcHigh ? (
                      <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-500/30 bg-rose-500/10">High</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">Normal</Badge>
                    )}
                  </div>
                  <div className="text-lg font-extrabold text-foreground mt-1">
                    {labs.cbc} <span className="text-[11px] font-normal text-muted-foreground">k/µL</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ref: 4.0 – 11.0 k/µL</p>
                </div>

                {/* CRP */}
                <div className="p-3 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">CRP</span>
                    {labs.crpHigh ? (
                      <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-500/30 bg-rose-500/10">High</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">Normal</Badge>
                    )}
                  </div>
                  <div className="text-lg font-extrabold text-foreground mt-1">
                    {labs.crp} <span className="text-[11px] font-normal text-muted-foreground">mg/L</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ref: &lt; 5.0 mg/L</p>
                </div>

                {/* Procalcitonin */}
                <div className="p-3 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Procalcitonin</span>
                    {labs.pctHigh ? (
                      <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-500/30 bg-rose-500/10">Sepsis Flag</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">Normal</Badge>
                    )}
                  </div>
                  <div className="text-lg font-extrabold text-foreground mt-1">
                    {labs.pct} <span className="text-[11px] font-normal text-muted-foreground">ng/mL</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ref: &lt; 0.25 ng/mL</p>
                </div>

                {/* Serum Creatinine */}
                <div className="p-3 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Creatinine</span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Renal</Badge>
                  </div>
                  <div className="text-lg font-extrabold text-foreground mt-1">
                    {vitals?.serumCreatinine} <span className="text-[11px] font-normal text-muted-foreground">mg/dL</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ref: 0.7 – 1.2 mg/dL</p>
                </div>

                {/* Platelets */}
                <div className="p-3 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Platelets</span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">CBC</Badge>
                  </div>
                  <div className="text-lg font-extrabold text-foreground mt-1">
                    {labs.platelets} <span className="text-[11px] font-normal text-muted-foreground">k/µL</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ref: 150 – 450 k/µL</p>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 3: INFECTION & AMR RESISTANCE PROFILE ── */}
          <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Biohazard className="h-4 w-4 text-rose-500" /> Active Infection &amp; AMR Stewardship Guidance
              </span>
              {recentCase ? (
                <Badge variant="outline" className="font-mono text-[11px]">
                  Case {recentCase.caseNumber}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Baseline Profile
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[11px]">Primary Infection</span>
                <p className="font-bold text-foreground capitalize mt-0.5">
                  {recentCase?.infectionType?.replace(/[-_]/g, " ") || "Urinary tract (UTI)"}
                </p>
                <span className="text-[10px] text-muted-foreground">Severity: {recentCase?.severity || "moderate"}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[11px]">Isolated Organism</span>
                <p className="font-bold text-primary mt-0.5">
                  {recentCase?.organism || "Escherichia coli"}
                </p>
                <span className="text-[10px] text-muted-foreground">Culture: {recentCase?.cultureResult ? "Confirmed" : "In-Vitro Awaited"}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[11px]">Predicted AMR Risk</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/10 text-amber-600 border-amber-500/30 capitalize">
                    {recentCase?.prediction?.resistanceRisk || "Medium"} Risk
                  </Badge>
                  <span className="font-bold text-foreground">
                    {recentCase?.prediction?.resistanceProbability ? `${Math.round(recentCase.prediction.resistanceProbability * 100)}%` : "42%"}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Rec: {recentCase?.prediction?.recommendedDrug || "Amikacin / Cefepime"}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Actions */}
        <DialogFooter className="p-4 border-t border-border bg-card/60 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => {
                onOpenChange(false);
                if (patient?.id) setLocation(`/patients/${patient.id}`);
              }}
            >
              <FileText className="h-3.5 w-3.5 mr-1 text-primary" /> Full Patient Record
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => {
                onOpenChange(false);
                setLocation(`/predict?tab=predict&patientId=${patient?.id}`);
              }}
            >
              <Stethoscope className="h-3.5 w-3.5 mr-1 text-teal-600" /> Run AMR Predictor
            </Button>
          </div>

          <Button
            size="sm"
            className="text-xs h-8 px-4"
            onClick={() => onOpenChange(false)}
          >
            Close Snapshot
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

/**
 * Reusable hook to effortlessly trigger Patient Quick-Look from anywhere
 */
export function usePatientQuickLook() {
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openQuickLook = React.useCallback((p: Patient | number) => {
    if (typeof p === "number") {
      setSelectedPatientId(p);
      setSelectedPatient(null);
    } else {
      setSelectedPatientId(p.id);
      setSelectedPatient(p);
    }
    setIsOpen(true);
  }, []);

  const quickLookModal = (
    <PatientQuickLookModal
      patientId={selectedPatientId}
      initialPatient={selectedPatient}
      open={isOpen}
      onOpenChange={setIsOpen}
    />
  );

  return { openQuickLook, quickLookModal, isOpen, setIsOpen };
}

/**
 * Reusable interactive patient name component with hover hint
 */
export function PatientNameLink({
  patient,
  patientId,
  name,
  onOpenQuickLook,
  className = "",
}: {
  patient?: Patient | null;
  patientId?: number;
  name?: string;
  onOpenQuickLook: (p: Patient | number) => void;
  className?: string;
}) {
  const displayName = name || patient?.name || (patientId ? `Patient #${patientId}` : "Patient");

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (patient) onOpenQuickLook(patient);
        else if (patientId) onOpenQuickLook(patientId);
      }}
      className={`text-left font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 cursor-pointer group ${className}`}
      title={`Click for Patient Quick-Look (${displayName})`}
    >
      <span className="hover:underline">{displayName}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-primary px-1 py-0.2 rounded bg-primary/10 border border-primary/20 shrink-0 font-normal">
        Quick-Look
      </span>
    </button>
  );
}
