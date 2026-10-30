import * as React from "react";
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePatientQuickLook, PatientNameLink } from "@/components/patient-quick-look-modal";
import { AIResponseViewer } from "@/components/ai-response-viewer";
import {
  Biohazard, Search, Filter, Plus, FileText, Trash2, Edit3,
  Calendar, Activity, ShieldAlert, CheckCircle2, AlertTriangle,
  RefreshCw, ChevronLeft, ChevronRight, Eye, FlaskConical, Cpu, ExternalLink, Sparkles
} from "lucide-react";

interface AmrSusceptibility {
  id: number;
  antibiotic: string;
  susceptibility: string;
  micValue?: string;
  diskDiffusionDiameter?: number;
  breakpoints?: string;
}

interface AmrRecord {
  id: number;
  recordId: string;
  sampleId?: string;
  patientId?: number;
  anonymousPatientId?: string;
  patientAge?: number;
  patientGender?: string;
  specimenType: string;
  collectionDate: string;
  collectionTime?: string;
  infectionOrigin: string;
  department?: string;
  organism: string;
  cultureResult: string;
  testingMethod?: string;
  laboratoryStandard?: string;
  laboratoryNotes?: string;
  hasPrediction: boolean;
  predictedRisk?: string;
  predictedProbability?: number;
  predictedConfidence?: number;
  recommendedDrug?: string;
  alternativeDrugs?: string[];
  dosageGuidance?: string;
  predictionRationale?: string;
  predictionModel?: string;
  severity?: string;
  icuStatus?: boolean;
  priorAntibiotics?: boolean;
  createdBy: number;
  createdAt: string;
  patient?: any;
  susceptibilities: AmrSusceptibility[];
}

export default function AmrHistoryPage() {
  const [location, setLocation] = useLocation();
  const { openQuickLook, quickLookModal } = usePatientQuickLook();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Search, Filter, Pagination state
  const [search, setSearch] = useState("");
  const [specimenFilter, setSpecimenFilter] = useState("all");
  const [organismFilter, setOrganismFilter] = useState("all");
  const [suscFilter, setSuscFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 10;

  // Selected Record Modal & Delete State
  const [selectedRecord, setSelectedRecord] = useState<AmrRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AmrRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch AMR Records from backend
  const queryKey = ["amr-records", page, search, specimenFilter, organismFilter, suscFilter];
  const { data, isLoading, isError, refetch } = useQuery<{
    records: AmrRecord[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>({
    queryKey,
    queryFn: async () => {
      const token = localStorage.getItem("aarogya_token");
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
        ...(specimenFilter !== "all" ? { specimen: specimenFilter } : {}),
        ...(organismFilter !== "all" ? { organism: organismFilter } : {}),
        ...(suscFilter !== "all" ? { susceptibility: suscFilter } : {}),
      });

      const res = await fetch(`/api/amr-records?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error("Failed to load AMR records from server");
      }
      return res.json();
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch(`/api/amr-records/${deleteTarget.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to delete AMR record");
      }

      toast({
        title: "AMR Record Deleted",
        description: `Record ${deleteTarget.recordId} removed from persistent store.`,
      });

      setDeleteTarget(null);
      setDetailModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["amr-records"] });
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.message || "Could not delete AMR record",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "AMR History" }]} />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 rounded-xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Biohazard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                AMR Laboratory History &amp; Surveillance
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary border-primary/30">
                  {data?.total ?? 0} Records Persisted
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saved Antimicrobial Resistance laboratory tests, susceptibility profiles, and AI predictions
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => setLocation("/amr/new")}
          className="gap-1.5 font-semibold text-xs h-9 px-4 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add AMR Record</span>
        </Button>
      </div>

      {/* Search & Filters Controls */}
      <Card className="border border-border shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by AMR ID, Sample, Organism..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 text-xs h-9"
              />
            </div>

            {/* Specimen Filter */}
            <Select value={specimenFilter} onValueChange={(val) => { setSpecimenFilter(val); setPage(1); }}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Specimen Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specimens</SelectItem>
                <SelectItem value="blood">Blood</SelectItem>
                <SelectItem value="urine">Urine</SelectItem>
                <SelectItem value="sputum">Sputum / Respiratory</SelectItem>
                <SelectItem value="stool">Stool / Stool Swab</SelectItem>
                <SelectItem value="wound_swab">Wound / Pus Swab</SelectItem>
                <SelectItem value="csf">CSF / Fluid</SelectItem>
                <SelectItem value="other">Other Specimen</SelectItem>
              </SelectContent>
            </Select>

            {/* Organism Filter */}
            <Select value={organismFilter} onValueChange={(val) => { setOrganismFilter(val); setPage(1); }}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Organism" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organisms</SelectItem>
                <SelectItem value="Escherichia coli">Escherichia coli</SelectItem>
                <SelectItem value="Klebsiella">Klebsiella spp.</SelectItem>
                <SelectItem value="Pseudomonas">Pseudomonas aeruginosa</SelectItem>
                <SelectItem value="Acinetobacter">Acinetobacter baumannii</SelectItem>
                <SelectItem value="Staphylococcus">Staphylococcus aureus</SelectItem>
                <SelectItem value="Enterococcus">Enterococcus spp.</SelectItem>
              </SelectContent>
            </Select>

            {/* Susceptibility Filter */}
            <Select value={suscFilter} onValueChange={(val) => { setSuscFilter(val); setPage(1); }}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Susceptibility Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="Susceptible">Susceptible (S)</SelectItem>
                <SelectItem value="Intermediate">Intermediate (I)</SelectItem>
                <SelectItem value="Resistant">Resistant (R)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Content */}
      <Card className="border border-border shadow-xs">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 text-center">
              <ErrorState
                title="Failed to Load AMR Records"
                message="Could not retrieve persistent AMR laboratory records from the server."
                onRetry={refetch}
              />
            </div>
          ) : !data?.records?.length ? (
            <div className="p-10 text-center">
              <EmptyState
                icon={Biohazard}
                title="No AMR Records Found"
                description={
                  search || specimenFilter !== "all" || organismFilter !== "all" || suscFilter !== "all"
                    ? "No saved laboratory test matches your active filters or search term."
                    : "No persistent AMR records recorded yet. Create your first AMR record now."
                }
                actionLabel="Add AMR Record"
                onAction={() => setLocation("/amr/new")}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold text-xs">Record &amp; Sample ID</TableHead>
                  <TableHead className="font-semibold text-xs">Patient / Sample Profile</TableHead>
                  <TableHead className="font-semibold text-xs">Specimen &amp; Collection</TableHead>
                  <TableHead className="font-semibold text-xs">Organism Identified</TableHead>
                  <TableHead className="font-semibold text-xs">Lab Susceptibility Results</TableHead>
                  <TableHead className="font-semibold text-xs">AI Resistance Risk</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.records ?? []).map((record) => {
                  const primarySusc = record.susceptibilities?.[0];
                  return (
                    <TableRow key={record.id} className="hover:bg-accent/40 transition-colors">
                      {/* Record & Sample ID */}
                      <TableCell className="align-middle">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-primary">{record.recordId}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{record.sampleId || "SMP-N/A"}</span>
                        </div>
                      </TableCell>

                      {/* Patient / Sample Profile */}
                      <TableCell className="align-middle text-xs">
                        {record.patient ? (
                          <PatientNameLink patient={record.patient} onOpenQuickLook={openQuickLook} />
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{record.anonymousPatientId || "Anonymous Sample"}</span>
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {record.patientAge ? `${record.patientAge}y` : "Age N/A"} • {record.patientGender || "Sex N/A"}
                            </span>
                          </div>
                        )}
                      </TableCell>

                      {/* Specimen & Collection Date */}
                      <TableCell className="align-middle text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold capitalize text-foreground flex items-center gap-1">
                            <FlaskConical className="h-3 w-3 text-primary shrink-0" />
                            {record.specimenType.replace("_", " ")}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {record.collectionDate}
                          </span>
                        </div>
                      </TableCell>

                      {/* Organism Identified */}
                      <TableCell className="align-middle text-xs font-medium italic text-foreground">
                        {record.organism}
                      </TableCell>

                      {/* Lab Susceptibility Results */}
                      <TableCell className="align-middle text-xs">
                        {record.susceptibilities && record.susceptibilities.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {record.susceptibilities.slice(0, 2).map((s, idx) => {
                              const isResistant = s.susceptibility.includes("Resistant") || s.susceptibility.includes("(R)");
                              const isSensitive = s.susceptibility.includes("Susceptible") || s.susceptibility.includes("(S)");
                              return (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className={`text-[10px] font-semibold px-1.5 py-0.2 ${
                                    isResistant
                                      ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                                      : isSensitive
                                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                      : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                  }`}
                                >
                                  {s.antibiotic}: {s.susceptibility.split(" ")[0]}
                                </Badge>
                              );
                            })}
                            {record.susceptibilities.length > 2 && (
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                +{record.susceptibilities.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No lab sensitivities</span>
                        )}
                      </TableCell>

                      {/* AI Resistance Risk */}
                      <TableCell className="align-middle text-xs">
                        {record.hasPrediction && record.predictedRisk ? (
                          <Badge
                            variant="outline"
                            className={`text-xs font-bold px-2 py-0.5 capitalize ${
                              record.predictedRisk === "critical"
                                ? "bg-rose-500/15 text-rose-600 border-rose-500/40"
                                : record.predictedRisk === "high"
                                ? "bg-orange-500/15 text-orange-600 border-orange-500/40"
                                : record.predictedRisk === "medium"
                                ? "bg-amber-500/15 text-amber-600 border-amber-500/40"
                                : "bg-emerald-500/15 text-emerald-600 border-emerald-500/40"
                            }`}
                          >
                            <Cpu className="h-3 w-3 mr-1 shrink-0" />
                            {record.predictedRisk} Risk
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Lab Only</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="align-middle text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRecord(record);
                              setDetailModalOpen(true);
                            }}
                            className="h-8 text-xs font-semibold"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(record)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete AMR Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination Footer */}
        {data && data.pages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing Page <strong>{data.page}</strong> of <strong>{data.pages}</strong> ({data.total} total records)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 text-xs"
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detailed Record Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground border border-border">
          {selectedRecord && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 pr-6">
                  <div>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                      <Biohazard className="h-5 w-5 text-primary" />
                      AMR Laboratory Record: {selectedRecord.recordId}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Sample Barcode: {selectedRecord.sampleId || "N/A"} • Collected: {selectedRecord.collectionDate}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 text-xs">
                {/* Linked Patient / Sample Info */}
                <Card className="bg-muted/20 border-border">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Patient &amp; Sample Identifiers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Patient Name</span>
                      <span className="font-semibold text-foreground">
                        {selectedRecord.patient ? selectedRecord.patient.name : selectedRecord.anonymousPatientId || "Anonymous"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Age / Sex</span>
                      <span className="font-semibold text-foreground capitalize">
                        {selectedRecord.patientAge || selectedRecord.patient?.age || "N/A"}y / {selectedRecord.patientGender || selectedRecord.patient?.gender || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Specimen Type</span>
                      <span className="font-semibold text-foreground capitalize">
                        {selectedRecord.specimenType.replace("_", " ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Infection Origin</span>
                      <span className="font-semibold text-foreground capitalize">
                        {selectedRecord.infectionOrigin}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Laboratory Microbiology Results */}
                <div className="space-y-2">
                  <h3 className="font-bold text-foreground flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    Microbiology &amp; Antibiogram Susceptibility Matrix
                  </h3>
                  <div className="p-3 rounded-lg bg-card border border-border space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-b border-border pb-2.5">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Identified Microorganism</span>
                        <span className="font-bold italic text-sm text-primary">{selectedRecord.organism}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Culture Result</span>
                        <span className="font-semibold text-foreground capitalize">{selectedRecord.cultureResult}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Testing Standard / Method</span>
                        <span className="font-semibold text-foreground">{selectedRecord.laboratoryStandard} ({selectedRecord.testingMethod || "VITEK 2"})</span>
                      </div>
                    </div>

                    {/* Susceptibilities Table */}
                    <div>
                      <span className="font-semibold text-foreground block mb-2 text-[11px]">Tested Antimicrobial Panel:</span>
                      {selectedRecord.susceptibilities && selectedRecord.susceptibilities.length > 0 ? (
                        <div className="border border-border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/40">
                              <TableRow>
                                <TableHead className="text-[10px] font-bold">Antibiotic / Antimicrobial</TableHead>
                                <TableHead className="text-[10px] font-bold">Susceptibility Category</TableHead>
                                <TableHead className="text-[10px] font-bold">MIC Value</TableHead>
                                <TableHead className="text-[10px] font-bold">Zone Diameter (mm)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedRecord.susceptibilities.map((s, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-semibold text-xs text-foreground">{s.antibiotic}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] font-bold ${
                                        s.susceptibility.includes("(R)") || s.susceptibility.includes("Resistant")
                                          ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                                          : s.susceptibility.includes("(S)") || s.susceptibility.includes("Susceptible")
                                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                          : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                      }`}
                                    >
                                      {s.susceptibility}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{s.micValue || "—"}</TableCell>
                                  <TableCell className="font-mono text-xs">{s.diskDiffusionDiameter ? `${s.diskDiffusionDiameter} mm` : "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No susceptibility rows recorded.</p>
                      )}
                    </div>

                    {selectedRecord.laboratoryNotes && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-muted-foreground block text-[10px] font-semibold">Laboratory Clinical Notes:</span>
                        <p className="text-xs text-foreground mt-0.5 bg-muted/20 p-2 rounded border border-border/50">
                          {selectedRecord.laboratoryNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Resistance Prediction Section (Clearly Distinguished from Lab Results!) */}
                {selectedRecord.hasPrediction ? (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Cpu className="h-4 w-4" /> AI Machine Learning Prediction Output
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                        Model: {selectedRecord.predictionModel || "GradientBoosting"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card/80 p-3 rounded-lg border border-border/60">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Predicted Risk Level</span>
                        <span className="font-bold capitalize text-primary text-sm">{selectedRecord.predictedRisk} Risk</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Resistance Probability</span>
                        <span className="font-mono font-bold text-foreground text-sm">
                          {selectedRecord.predictedProbability !== undefined ? `${(selectedRecord.predictedProbability * 100).toFixed(1)}%` : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Model Confidence</span>
                        <span className="font-mono font-bold text-foreground text-sm">
                          {selectedRecord.predictedConfidence !== undefined ? `${(selectedRecord.predictedConfidence * 100).toFixed(1)}%` : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Recommended Drug</span>
                        <span className="font-bold text-emerald-600 text-sm">{selectedRecord.recommendedDrug || "N/A"}</span>
                      </div>
                    </div>

                    {selectedRecord.predictionRationale && (
                      <div className="bg-card/50 p-3 rounded border border-border/50">
                        <AIResponseViewer content={selectedRecord.predictionRationale} variant="compact" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>AI resistance prediction inference was not executed for this laboratory entry.</span>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-4">
                <Button variant="outline" size="sm" onClick={() => setDetailModalOpen(false)}>
                  Close Details
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border border-border rounded-lg text-card-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">Delete AMR Record</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete AMR record <strong>{deleteTarget?.recordId}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete AMR Record"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {quickLookModal}
    </div>
  );
}
