import * as React from "react";
import { useState } from "react";
import { useGetDashboardSummary, useGetRecentActivity, useListPatients } from "@/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Activity, AlertTriangle, ShieldAlert, Plus, UserPlus, TrendingUp, X, Loader2, Search, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary, isError: isErrorSummary, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: isLoadingActivity, isError: isErrorActivity, refetch: refetchActivity } = useGetRecentActivity();
  const { toast } = useToast();

  const [showPatients, setShowPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: patientsData, isLoading: isLoadingPatients, refetch: refetchPatients } = useListPatients(
    { page: 1, limit: 200, search: patientSearch || undefined },
    { query: { enabled: showPatients } as any }
  );

  const patients = patientsData?.patients ?? [];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch(`/api/patients/${deleteTarget.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete patient");
      }
      toast({ title: "Patient removed", description: `${deleteTarget.name} and associated records deleted.` });
      refetchPatients();
      refetchSummary();
    } catch (e: unknown) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 font-sans text-foreground">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 rounded-lg border border-border shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Clinical Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Hospital management overview and clinical decision statistics</p>
        </div>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <Link href="/patients/new" className="flex-1 sm:flex-initial">
            <Button variant="outline" size="sm" className="w-full flex items-center justify-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> New Patient
            </Button>
          </Link>
          <Link href="/cases/new" className="flex-1 sm:flex-initial">
            <Button size="sm" className="w-full flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> New Clinical Case
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Statistics Cards ── */}
      {isErrorSummary ? (
        <ErrorState title="Failed to load dashboard summary" onRetry={refetchSummary} />
      ) : isLoadingSummary ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        </div>
      ) : summary && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            title="Active Cases"
            value={summary.activeCases}
            subtitle="Current active open cases"
            icon={Activity}
            color="blue"
          />
          <MetricCard
            title="Resolved Cases"
            value={summary.resolvedCases ?? 0}
            subtitle="Recovered & closed cases"
            icon={CheckCircle2}
            color="emerald"
          />
          <MetricCard
            title="High Risk Cases"
            value={summary.highRiskCases ?? 0}
            subtitle="Active AMR resistance cases"
            icon={ShieldAlert}
            color="red"
          />
          <MetricCard
            title="Resistance Rate"
            value={`${(summary.resistanceRate !== undefined ? summary.resistanceRate * 100 : (summary.highRiskRatio || 0)).toFixed(1)}%`}
            subtitle="Surveillance average"
            icon={AlertTriangle}
            color="amber"
          />
          <MetricCard
            title="Total Patients"
            value={summary.totalPatients}
            subtitle="Click to view & manage"
            icon={Users}
            color="emerald"
            onClick={() => setShowPatients(true)}
            clickable
          />
        </div>
      )}

      {/* ── Main Activity & Trends Row ── */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Recent Activity */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-semibold text-foreground">Recent Activity</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Latest actions performed in the system</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex-1">
            {isErrorActivity ? (
              <ErrorState title="Failed to load activity feed" onRetry={refetchActivity} />
            ) : isLoadingActivity ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
              </div>
            ) : activity?.activity?.length ? (
              <div className="space-y-2.5">
                {activity.activity.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 rounded-md p-3 border border-border/80 bg-muted/20 hover:bg-muted/50 transition-colors">
                    <div className="h-2 w-2 rounded-full mt-1.5 shrink-0 bg-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-snug">{act.description}</p>
                      <p className="text-[11px] mt-0.5 text-muted-foreground">
                        {act.timestamp ? new Date(act.timestamp).toLocaleString() : "Recent"}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {act.type}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Activity}
                title="No Recent Activity"
                description="Activity logs will automatically populate when clinical cases, predictions, or reports are submitted."
              />
            )}
          </CardContent>
        </Card>

        {/* Top Infection Types */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Top Infection Types
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Most common clinical presentations</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex-1">
            {isLoadingSummary ? (
              <Skeleton className="h-44 w-full rounded-md" />
            ) : summary?.topInfectionTypes?.length ? (
              <div className="space-y-4">
                {summary.topInfectionTypes.map((item) => {
                  const pct = Math.max(5, (item.count / (summary.totalCases || 1)) * 100);
                  return (
                    <div key={item.type} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold capitalize text-foreground">{item.type.replace("-", " ")}</span>
                        <span className="font-bold text-primary">{item.count} cases</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No Infection Data"
                description="Clinical infection metrics will be generated once patient cases are filed."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Patient Directory Dialog ── */}
      <Dialog open={showPatients} onOpenChange={setShowPatients}>
        <DialogContent className="max-w-lg bg-card border border-border rounded-lg text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Registered Patient Directory
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Search and review patient profiles stored in the system.
            </DialogDescription>
          </DialogHeader>

          {/* Search bar inside dialog */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              className="pl-8 text-xs h-8"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto space-y-2 mt-2 pr-1">
            {isLoadingPatients ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
              </div>
            ) : patients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No Patients Found"
                description={patientSearch ? "No records match your search filter." : "No patients currently registered."}
              />
            ) : (
              patients.map(p => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-border bg-muted/20 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.patientId} • {p.age}y • <span className="capitalize">{p.gender}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/patients/${p.id}`} onClick={() => setShowPatients(false)}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2">View</Button>
                    </Link>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                      onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                      title="Delete Patient"
                      aria-label={`Delete ${p.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border border-border rounded-lg text-card-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">Delete Patient</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong> and all associated clinical records? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Deleting...</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Metric Card Component ── */
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
  onClick,
  clickable,
}: {
  title: string;
  value: any;
  subtitle: string;
  icon: any;
  color?: "blue" | "emerald" | "amber" | "red";
  onClick?: () => void;
  clickable?: boolean;
}) {
  const iconColor = {
    blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20",
  }[color];

  return (
    <div
      className={`bg-card border border-border rounded-lg p-4 shadow-xs transition-all duration-200 hover:border-primary/40 ${
        clickable ? "cursor-pointer hover:bg-accent/40" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
        <div className={`h-8 w-8 rounded-md border flex items-center justify-center ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground tracking-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{subtitle}</div>
    </div>
  );
}
