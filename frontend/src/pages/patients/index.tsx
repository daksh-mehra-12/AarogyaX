import * as React from "react";
import { Link } from "wouter";
import { useListPatients } from "@/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, FileText, Trash2, Users, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Patients() {
  const [search, setSearch] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [deletingName, setDeletingName] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { data, isLoading, isError, refetch } = useListPatients({ search: search || undefined });
  const { toast } = useToast();

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/patients/${deletingId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete patient");
      }
      toast({ title: "Patient deleted", description: `${deletingName} and all associated records have been removed.` });
      setDeletingId(null);
      refetch();
    } catch (e: unknown) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Patients Directory" }]} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Patients Directory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage and search clinical patient records</p>
        </div>
        <Button asChild size="sm" className="h-9 px-4">
          <Link href="/patients/new">
            <Plus className="mr-1.5 h-4 w-4" /> New Patient
          </Link>
        </Button>
      </div>

      <div className="flex items-center max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by patient ID or name..."
          className="pl-9 h-9 text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isError ? (
        <ErrorState title="Failed to load patient records" onRetry={refetch} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Demographics</TableHead>
              <TableHead>Risk Factors</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8">
                  <EmptyState
                    icon={Users}
                    title="No Patients Found"
                    description={search ? "No patient record matches your search query." : "No patients currently registered in the database."}
                    actionLabel={search ? undefined : "Register New Patient"}
                    onAction={() => window.location.href = "/patients/new"}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data?.patients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{patient.patientId}</TableCell>
                  <TableCell className="font-semibold">{patient.name}</TableCell>
                  <TableCell className="text-xs">
                    {patient.age}y, <span className="capitalize">{patient.gender}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {patient.diabetes && <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 bg-amber-500/10">Diabetes</Badge>}
                      {patient.ckd && <Badge variant="outline" className="text-xs text-rose-500 border-rose-500/30 bg-rose-500/10">CKD</Badge>}
                      {patient.pregnancy && <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/30 bg-blue-500/10">Pregnancy</Badge>}
                      {patient.immunocompromised && <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/30 bg-purple-500/10">Immunocomp</Badge>}
                      {!patient.diabetes && !patient.ckd && !patient.pregnancy && !patient.immunocompromised && (
                        <span className="text-xs text-muted-foreground">Standard</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                        <Link href={`/patients/${patient.id}`}>
                          <FileText className="h-3.5 w-3.5 mr-1" /> View
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => { setDeletingId(patient.id); setDeletingName(patient.name); }}
                        title="Delete Patient"
                        aria-label={`Delete ${patient.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent className="bg-card border border-border rounded-lg text-card-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">Delete Patient</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will permanently delete <strong>{deletingName}</strong> and all associated clinical records (cases, predictions, ADR reports). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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
