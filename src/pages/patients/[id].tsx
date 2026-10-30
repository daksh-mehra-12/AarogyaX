import * as React from "react";
import { useRoute, useLocation } from "wouter";
import { useGetPatient, getGetPatientQueryKey } from "@/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ErrorState } from "@/components/ui/error-state";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Activity, AlertTriangle, Calendar, Trash2, ArrowLeft, Loader2,
  Biohazard, Plus, FileDown, Stethoscope, ShieldAlert, Mail
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportPatientHistoryToPdf } from "@/lib/patient-pdf";
import { SendPatientEmailDialog } from "@/components/patients/send-patient-email-dialog";
import { PatientVitalsCard } from "@/components/patients/patient-vitals-card";

export default function PatientDetail() {
  const [match, params] = useRoute("/patients/:id");
  const [, navigate] = useLocation();
  const id = match && params ? parseInt((params as any).id) : 0;
  const [showDelete, setShowDelete] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);
  const [showEmailDialog, setShowEmailDialog] = React.useState(false);
  const { toast } = useToast();

  const { data: patient, isLoading, isError, refetch } = useGetPatient(id, {
    query: { enabled: !!id, queryKey: getGetPatientQueryKey(id) }
  });

  const handleExportPdf = async () => {
    if (!patient) return;
    setIsExportingPdf(true);
    try {
      const { filename } = await exportPatientHistoryToPdf(patient as Record<string, any>);
      toast({
        title: "Patient History PDF Exported",
        description: `Saved full clinical history record as ${filename}.`,
      });
    } catch (e: unknown) {
      toast({
        title: "PDF Export Failed",
        description: e instanceof Error ? e.message : "Could not generate patient PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch(`/api/patients/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete patient");
      }
      toast({ title: "Patient deleted", description: `${patient?.name} disassociated from active directory.` });
      navigate("/patients");
    } catch (e: unknown) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setShowDelete(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Patients Directory", href: "/patients" }, { label: "Patient Detail" }]} />
        <ErrorState title="Patient profile not found" message="The requested patient record could not be located or was deleted." onRetry={refetch} />
      </div>
    );
  }

  const amrRecords: any[] = Array.isArray((patient as any).amrRecords) ? (patient as any).amrRecords : [];
  const clinicalCases: any[] = Array.isArray((patient as any).cases) ? (patient as any).cases : [];
  const adrReports: any[] = Array.isArray((patient as any).adrReports) ? (patient as any).adrReports : [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Patients Directory", href: "/patients" }, { label: patient.name }]} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-5 rounded-lg border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{patient.name}</h1>
            <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">{patient.patientId}</Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Calendar className="h-3.5 w-3.5" /> Registered {new Date(patient.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            data-testid="export-patient-pdf-btn"
            className="gap-1.5 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting PDF...
              </>
            ) : (
              <>
                <FileDown className="h-3.5 w-3.5" /> Export to PDF
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEmailDialog(true)}
            data-testid="send-patient-email-btn"
            className="gap-1.5 text-xs font-bold border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
          >
            <Mail className="h-3.5 w-3.5" /> Send Gmail Alert / Report
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(`/amr/new?patientId=${patient.id}`)}
            className="gap-1.5 text-xs font-bold"
          >
            <Biohazard className="h-3.5 w-3.5" /> Add AMR Record
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/patients")}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* Patient Vitals Component */}
      <PatientVitalsCard patient={patient as Record<string, any>} onVitalsRecorded={refetch} />

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Demographics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-muted-foreground font-medium">Age</p>
                <p className="font-bold text-sm text-foreground mt-0.5 tabular-nums">{patient.age} years</p>
              </div>
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-muted-foreground font-medium">Gender</p>
                <p className="font-bold text-sm text-foreground capitalize mt-0.5">{patient.gender}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-muted-foreground font-medium">Weight</p>
                <p className="font-bold text-sm text-foreground mt-0.5 tabular-nums">{patient.weight ? `${patient.weight} kg` : "N/A"}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-muted-foreground font-medium">Blood Group</p>
                <p className="font-bold text-sm text-foreground mt-0.5">{(patient as any).bloodGroup || "O+"}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/20 border border-border/60 col-span-2">
                <p className="text-muted-foreground font-medium">Region</p>
                <p className="font-bold text-sm text-foreground mt-0.5">{patient.region || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Clinical Risk Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <RiskItem label="Diabetes" active={patient.diabetes} />
            <RiskItem label="Chronic Kidney Disease (CKD)" active={patient.ckd} />
            <RiskItem label="Pregnancy Status" active={patient.pregnancy} />
            <RiskItem label="Immunocompromised" active={patient.immunocompromised} />
          </CardContent>
        </Card>
      </div>

      {/* Associated AMR Records Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Biohazard className="h-4 w-4 text-primary" /> Associated AMR Laboratory Records ({amrRecords.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Antimicrobial resistance tests, susceptibility panels, and AI predictions recorded for {patient.name}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/amr/new?patientId=${patient.id}`)}
            className="text-xs font-semibold gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add AMR Test
          </Button>
        </CardHeader>
        <CardContent className="text-xs">
          {amrRecords.length > 0 ? (
            <div className="space-y-2.5">
              {amrRecords.map((ar: any) => (
                <div
                  key={ar.id}
                  className="p-3.5 rounded-lg border border-border bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-primary">{ar.recordId}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {ar.specimenType?.replace("_", " ")}
                      </Badge>
                      {ar.predictedRisk && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 capitalize">
                          {ar.predictedRisk} Risk
                        </Badge>
                      )}
                      {ar.recommendedDrug && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          Rx: {ar.recommendedDrug}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Pathogen: <strong className="text-foreground italic">{ar.organism}</strong> • Collected: {ar.collectionDate}
                    </p>
                    {Array.isArray(ar.susceptibilities) && ar.susceptibilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {ar.susceptibilities.map((s: any, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted border border-border text-muted-foreground"
                          >
                            {s.antibiotic}: {s.susceptibility}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate("/amr-history")}
                    className="text-xs font-medium self-end sm:self-auto shrink-0"
                  >
                    View in History &rarr;
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground italic border border-dashed rounded-lg">
              No AMR laboratory tests recorded for this patient yet. Click &quot;Add AMR Test&quot; above to create one.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clinical Cases & Pharmacovigilance Summary */}
      {(clinicalCases.length > 0 || adrReports.length > 0) && (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {clinicalCases.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" /> Clinical Case History ({clinicalCases.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {clinicalCases.map((c: any) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg border border-border bg-muted/10 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">#{c.caseNumber}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{c.infectionType}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{c.status}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Organism: {c.organism || "Pending"} {c.prediction?.recommendedDrug ? `• Rx: ${c.prediction.recommendedDrug}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/cases/${c.id}`)} className="text-xs">
                      Open &rarr;
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {adrReports.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" /> Pharmacovigilance / ADR History ({adrReports.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {adrReports.map((adr: any) => (
                  <div
                    key={adr.id}
                    className="p-3 rounded-lg border border-border bg-muted/10 space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{adr.suspectedDrug}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{adr.severity}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {adr.reactionDescription || adr.reactionType} • Outcome: {adr.outcome}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <SendPatientEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        patient={patient}
        amrRecords={amrRecords}
        clinicalCases={clinicalCases}
      />

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-card border border-border rounded-lg text-card-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">Delete Patient Record</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will permanently delete <strong>{patient.name}</strong> and all associated clinical records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Deleting...</> : "Delete Patient"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RiskItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex items-center justify-between p-2.5 border border-border/80 rounded-md bg-muted/20">
      <span className="font-semibold text-foreground text-xs">{label}</span>
      {active ? (
        <Badge variant="outline" className="text-[11px] font-bold text-rose-500 border-rose-500/30 bg-rose-500/10">Positive</Badge>
      ) : (
        <Badge variant="outline" className="text-[11px] font-bold text-emerald-600 border-emerald-500/30 bg-emerald-500/10">Negative</Badge>
      )}
    </div>
  );
}
