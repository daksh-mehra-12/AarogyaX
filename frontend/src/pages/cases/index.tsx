import * as React from "react";
import { Link } from "wouter";
import { useListCases, getListCasesQueryKey } from "@/api";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, AlertTriangle, Search, Filter, X, Loader2, History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Cases() {
  const [status, setStatus] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: number; caseNumber: string } | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deletedIds, setDeletedIds] = React.useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useListCases({ status: status !== "all" ? status : undefined });

  const filtered = React.useMemo(() => {
    if (!data?.cases) return [];
    const q = search.toLowerCase().trim();
    const cases = data.cases.filter(c => !deletedIds.has(c.id!));
    if (!q) return cases;
    return cases.filter(c =>
      c.caseNumber?.toLowerCase().includes(q) ||
      c.patient?.name?.toLowerCase().includes(q) ||
      c.infectionType?.toLowerCase().includes(q) ||
      String(c.patientId).includes(q)
    );
  }, [data, search, deletedIds]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeletedIds(prev => new Set([...prev, deleteTarget.id]));
    try {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch(`/api/cases/${deleteTarget.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to delete case");
      toast({ title: "Case deleted", description: `Case ${deleteTarget.caseNumber} removed.` });
      queryClient.invalidateQueries({ queryKey: getListCasesQueryKey() });
    } catch {
      setDeletedIds(prev => { const s = new Set(prev); s.delete(deleteTarget.id); return s; });
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Case History" }]} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Case History & AMR Records</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Review clinical recommendations, risk factors, and patient outcomes</p>
        </div>
        <Button asChild size="sm" className="h-9 px-4">
          <Link href="/cases/new">
            <Plus className="mr-1.5 h-4 w-4" /> New Case
          </Link>
        </Button>
      </div>

      {/* Search + Filter controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-xs"
            placeholder="Search patient, case number, or infection..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] h-9 text-xs gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Status Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorState title="Failed to load case history" onRetry={refetch} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case Number</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Infection Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>AMR Risk</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4, 5].map(i => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8">
                  <EmptyState
                    icon={History}
                    title="No Cases Found"
                    description={search || status !== "all" ? "No clinical cases match your active filters." : "No clinical cases logged in system yet."}
                    actionLabel={search || status !== "all" ? undefined : "Log New Case"}
                    onAction={() => window.location.href = "/cases/new"}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{c.caseNumber}</TableCell>
                  <TableCell className="font-semibold">{c.patient?.name || `Patient #${c.patientId}`}</TableCell>
                  <TableCell className="capitalize text-xs">{c.infectionType?.replace("-", " ")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      c.severity === "severe" ? "text-xs font-bold text-rose-500 border-rose-500/30 bg-rose-500/10" :
                      c.severity === "moderate" ? "text-xs font-bold text-amber-500 border-amber-500/30 bg-amber-500/10" :
                      "text-xs font-bold text-blue-500 border-blue-500/30 bg-blue-500/10"
                    }>
                      {c.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={c.status === "resolved" || c.status === "closed" ? "resolved" : "open"}
                      onValueChange={async (newStatus) => {
                        try {
                          const token = localStorage.getItem("aarogya_token");
                          const isRecovered = newStatus === "resolved";
                          const res = await fetch(`/api/cases/${c.id}`, {
                            method: "PUT",
                            headers: {
                              "Authorization": token ? `Bearer ${token}` : "",
                              "Content-Type": "application/json"
                            },
                            body: JSON.stringify({ status: isRecovered ? "resolved" : "open" })
                          });
                          if (!res.ok) throw new Error("Failed to update status");
                          toast({
                            title: isRecovered ? "Patient Recovered & Resolved!" : "Case Marked Active",
                            description: isRecovered ? "Active count decreased. Patient moved to Recovered Cases." : "Case marked active in-treatment."
                          });
                          queryClient.invalidateQueries();
                        } catch (err: any) {
                          toast({ title: "Status update failed", description: err.message, variant: "destructive" });
                        }
                      }}
                    >
                      <SelectTrigger className={`h-7 w-[130px] text-xs font-semibold border ${
                        c.status === "resolved" || c.status === "closed" 
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                          : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open" className="text-xs font-medium text-blue-600">🔵 Active</SelectItem>
                        <SelectItem value="resolved" className="text-xs font-medium text-emerald-600">🟢 Recovered</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {c.prediction ? (
                      <Badge variant="outline" className={
                        c.prediction.resistanceRisk === "critical" ? "text-xs font-bold bg-rose-500/10 text-rose-500 border-rose-500/30" :
                        c.prediction.resistanceRisk === "high" ? "text-xs font-bold bg-amber-500/10 text-amber-500 border-amber-500/30" :
                        c.prediction.resistanceRisk === "medium" ? "text-xs font-bold bg-yellow-500/10 text-yellow-600 border-yellow-500/30" :
                        "text-xs font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      }>
                        {c.prediction.resistanceRisk}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" /> Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                        <Link href={`/cases/${c.id}`}>
                          <FileText className="h-3.5 w-3.5 mr-1" /> View
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget({ id: c.id!, caseNumber: c.caseNumber! })}
                        title="Delete Case"
                        aria-label={`Delete case ${c.caseNumber}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Confirm Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border border-border rounded-lg text-card-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground flex items-center gap-2 text-destructive">
              <X className="h-4 w-4" /> Delete Case Record
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete case <strong>{deleteTarget?.caseNumber}</strong>? All associated predictions will also be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Deleting...</> : "Delete Case"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
