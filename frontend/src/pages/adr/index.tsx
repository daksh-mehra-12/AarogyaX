import { Link } from "wouter";
import { useListAdrReports } from "@/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { downloadOfficialPvPIForm } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Download, AlertTriangle } from "lucide-react";

export default function AdrReports() {
  const { data, isLoading, isError, refetch } = useListAdrReports({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleOutcomeChange = async (adrId: number, newOutcome: string) => {
    try {
      const token = localStorage.getItem("aarogya_token");
      const isRecovered = newOutcome === "recovered" || newOutcome === "recovered-sequelae";
      const res = await fetch(`/api/adr/${adrId}`, {
        method: "PUT",
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          outcome: newOutcome,
          status: isRecovered ? "closed" : "pending"
        })
      });
      if (!res.ok) throw new Error("Failed to update ADR status");
      toast({
        title: isRecovered ? "ADR Marked as Recovered & Closed!" : "ADR Status Updated",
        description: isRecovered ? "Status changed to closed." : `Outcome updated to ${newOutcome}.`
      });
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 font-sans text-foreground">
      <Breadcrumbs items={[{ label: "ADR Reporting" }]} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 rounded-lg border border-border shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Adverse Drug Reactions (ADR)</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Pharmacovigilance surveillance and reported drug complications</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadOfficialPvPIForm}
            className="border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
          >
            <Download className="mr-1.5 h-4 w-4" /> Official PvPI Form
          </Button>
          <Button asChild size="sm">
            <Link href="/adr/new">
              <Plus className="mr-1.5 h-4 w-4" /> Report Reaction
            </Link>
          </Button>
        </div>
      </div>

      {isError ? (
        <ErrorState title="Failed to load ADR records" onRetry={refetch} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report No.</TableHead>
              <TableHead>Drug Name</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Onset Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !data?.reports?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8">
                  <EmptyState
                    icon={AlertTriangle}
                    title="No ADR Reports Recorded"
                    description="No adverse drug reaction events have been logged in the pharmacovigilance registry."
                    actionLabel="Submit First ADR Report"
                    onAction={() => window.location.href = "/adr/new"}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{report.reportNumber}</TableCell>
                  <TableCell className="font-bold text-foreground">{report.drugName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      report.severity === 'fatal' ? 'text-xs font-bold bg-zinc-900 text-white border-zinc-900' :
                      report.severity === 'life-threatening' ? 'text-xs font-bold bg-rose-600 text-white border-rose-600' :
                      report.severity === 'severe' ? 'text-xs font-bold text-rose-500 border-rose-500/30 bg-rose-500/10' :
                      report.severity === 'moderate' ? 'text-xs font-bold text-amber-500 border-amber-500/30 bg-amber-500/10' :
                      'text-xs font-bold text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
                    }>
                      {report.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={report.outcome || "unknown"}
                      onValueChange={(val) => handleOutcomeChange(report.id, val)}
                    >
                      <SelectTrigger className={`h-7 w-[145px] text-xs font-semibold border ${
                        report.outcome === "recovered" || report.outcome === "recovered-sequelae"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : report.outcome === "recovering"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : "bg-muted text-foreground border-border"
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recovered" className="text-xs font-medium text-emerald-600">🟢 Recovered (Closed)</SelectItem>
                        <SelectItem value="recovering" className="text-xs font-medium text-amber-600">🟡 Recovering</SelectItem>
                        <SelectItem value="not_recovered" className="text-xs font-medium text-rose-600">🔴 Not Recovered</SelectItem>
                        <SelectItem value="fatal" className="text-xs font-medium text-zinc-900 dark:text-zinc-100">⚫ Fatal</SelectItem>
                        <SelectItem value="unknown" className="text-xs font-medium text-muted-foreground">❓ Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{report.onsetDate ? new Date(report.onsetDate).toLocaleDateString() : 'Unknown'}</TableCell>
                  <TableCell>
                    <Badge variant={report.status === "closed" ? "default" : "secondary"} className={`capitalize text-xs font-semibold ${
                      report.status === "closed" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {report.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                      <Link href={`/adr/${report.id}`}>
                        <FileText className="h-3.5 w-3.5 mr-1" /> View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
