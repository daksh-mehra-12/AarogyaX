import * as React from "react";
import { useRoute, useLocation } from "wouter";
import { useGetPatient, getGetPatientQueryKey } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ErrorState } from "@/components/ui/error-state";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { User, Activity, AlertTriangle, Calendar, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PatientDetail() {
  const [match, params] = useRoute("/patients/:id");
  const [, navigate] = useLocation();
  const id = match && params ? parseInt((params as any).id) : 0;
  const [showDelete, setShowDelete] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { toast } = useToast();

  const { data: patient, isLoading, isError, refetch } = useGetPatient(id, {
    query: { enabled: !!id, queryKey: getGetPatientQueryKey(id) }
  });

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
      toast({ title: "Patient deleted", description: `${patient?.name} and all associated records removed.` });
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

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Patients Directory", href: "/patients" }, { label: patient.name }]} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-5 rounded-lg border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{patient.name}</h1>
            <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">{patient.patientId}</Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Calendar className="h-3.5 w-3.5" /> Registered {new Date(patient.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Demographics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-muted-foreground font-medium">Age</p>
                <p className="font-bold text-sm text-foreground mt-0.5">{patient.age} years</p>
              </div>
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-muted-foreground font-medium">Gender</p>
                <p className="font-bold text-sm text-foreground capitalize mt-0.5">{patient.gender}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-muted-foreground font-medium">Weight</p>
                <p className="font-bold text-sm text-foreground mt-0.5">{patient.weight ? `${patient.weight} kg` : 'N/A'}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-muted-foreground font-medium">Region</p>
                <p className="font-bold text-sm text-foreground mt-0.5">{patient.region || 'N/A'}</p>
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
