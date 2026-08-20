import { useState } from "react";
import { useRoute } from "wouter";
import { useGetCase, getGetCaseQueryKey, useUpdateCase, usePredictAmr } from "@/api";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDown, Mail, Activity, AlertTriangle, ShieldAlert, CheckCircle, Clock, TriangleAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ErrorState } from "@/components/ui/error-state";
import { jsPDF } from "jspdf";
import { getLogoBase64 } from "@/lib/pdf-logo";

const DRUG_DOSAGE: Record<string, string> = {
  "Nitrofurantoin":               "100 mg PO twice daily × 5–7 days (modified-release)",
  "Trimethoprim-Sulfamethoxazole":"1 DS tab (160/800 mg) PO twice daily × 3–7 days",
  "Fosfomycin":                   "3 g PO single dose (sachet)",
  "Ciprofloxacin":                "500 mg PO / 400 mg IV twice daily × 7–14 days",
  "Amoxicillin-Clavulanate":      "875/125 mg PO twice daily OR 1.2 g IV 8-hourly",
  "Azithromycin":                 "500 mg PO/IV once daily × 3–5 days",
  "Doxycycline":                  "100 mg PO twice daily × 5–7 days",
  "Levofloxacin":                 "750 mg PO/IV once daily × 5 days",
  "Piperacillin-Tazobactam":      "4.5 g IV 6–8-hourly (extended infusion 4 h preferred)",
  "Meropenem":                    "1 g IV 8-hourly; severe/MDR: 2 g IV 8-hourly",
  "Meropenem + Vancomycin":       "Meropenem 2 g IV 8-hourly + Vancomycin 25–30 mg/kg/day IV (AUC-guided)",
  "Vancomycin":                   "25–30 mg/kg/day IV in 2–3 divided doses (AUC-guided, target 400–600 mg·h/L)",
  "Cefepime":                     "2 g IV 8-hourly × 7–14 days",
  "Flucloxacillin":               "500 mg–1 g PO/IV 6-hourly × 5–10 days",
  "Clindamycin":                  "300–450 mg PO 6-hourly OR 600 mg IV 8-hourly × 7–14 days",
  "Metronidazole":                "400–500 mg PO/IV 8-hourly × 5–10 days",
  "Ceftriaxone":                  "1–2 g IV/IM once daily × 5–14 days",
  "Rifampin":                     "600 mg PO once daily (adjunct, never monotherapy)",
};

function getDosage(drug: string, stored?: string | null): string {
  if (stored) return stored;
  return DRUG_DOSAGE[drug] ?? "Refer to local antibiogram and adjust dose per patient weight/renal function";
}

export default function CaseDetail() {
  const [match, params] = useRoute("/cases/:id");
  const id = match && params ? parseInt((params as any).id) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  
  const { data: clinicalCase, isLoading } = useGetCase(id, { 
    query: { enabled: !!id, queryKey: getGetCaseQueryKey(id) } 
  });

  const updateCase = useUpdateCase();
  const predictAmr = usePredictAmr();

  const handleStatusChange = (newStatus: string) => {
    if (!id) return;
    const isRecovered = newStatus === "resolved" || newStatus === "closed" || newStatus === "recovered";
    const targetStatus = isRecovered ? "resolved" : "open";

    updateCase.mutate(
      { id, data: { status: targetStatus as any } },
      {
        onSuccess: () => {
          toast({
            title: isRecovered ? "Patient Marked as Recovered!" : "Case Marked as Active In-Treatment",
            description: isRecovered 
              ? "Active case count decreased. Patient moved to Recovered & Resolved Cases." 
              : "Updated case status to Active In-Treatment."
          });
          queryClient.invalidateQueries();
        },
        onError: (err: any) => toast({ title: "Failed to update status", description: err.message, variant: "destructive" })
      }
    );
  };

  const handleDownloadPdf = async () => {
    if (!clinicalCase) return;
    toast({ title: "Generating report…", description: "Please wait" });
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210, M = 14, CW = W - M * 2;
      const logoBase64 = await getLogoBase64();

      // Header Banner
      doc.setFillColor(37, 99, 235); // Blue
      doc.rect(0, 0, W, 28, "F");

      let titleX = M;
      if (logoBase64) {
        doc.addImage(logoBase64, "JPEG", M, 4, 20, 20);
        titleX = M + 24;
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("AAROGYA X — CLINICAL CASE REPORT", titleX, 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Case #${clinicalCase.caseNumber}  |  Patient ID: ${clinicalCase.patient?.patientId || "N/A"}`, titleX, 17);
      doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, titleX, 23);

      let y = 34;

      // Status Box
      doc.setFillColor(245, 247, 250);
      doc.rect(M, y, CW, 12, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
      doc.text(`Infection Type: ${clinicalCase.infectionType.toUpperCase()}`, M + 4, y + 8);
      doc.text(`Status: ${clinicalCase.status.toUpperCase()}`, M + 110, y + 8);
      y += 18;

      // Clinical Context
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(37, 99, 235);
      doc.text("CLINICAL DETAILS", M, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(50, 50, 50);
      doc.text(`• Organism: ${clinicalCase.organism || "Pending culture / Unspecified"}`, M + 4, y); y += 5;
      doc.text(`• Culture Result: ${clinicalCase.cultureResult || "Not uploaded"}`, M + 4, y); y += 5;
      if (clinicalCase.clinicalNotes) {
        doc.text(`• Clinical Notes: ${clinicalCase.clinicalNotes}`, M + 4, y); y += 8;
      } else {
        y += 3;
      }

      // Prediction details
      if (clinicalCase.prediction) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(37, 99, 235);
        doc.text("AMR AI PREDICTION & RECOMMENDATIONS", M, y); y += 6;
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(50, 50, 50);
        doc.text(`• Recommended Antibiotic: ${clinicalCase.prediction.recommendedDrug}`, M + 4, y); y += 5;
        doc.text(`• Dosage: ${getDosage(clinicalCase.prediction.recommendedDrug, (clinicalCase.prediction as any).dosage)}`, M + 4, y); y += 5;
        doc.text(`• Resistance Risk: ${clinicalCase.prediction.resistanceRisk?.toUpperCase() || "MEDIUM"} (${Math.round((clinicalCase.prediction.resistanceProbability || 0) * 100)}%)`, M + 4, y); y += 5;
        if ((clinicalCase.prediction as any).rationale) {
          const lines = doc.splitTextToSize(`• AI Rationale: ${(clinicalCase.prediction as any).rationale}`, CW - 8);
          doc.text(lines, M + 4, y); y += lines.length * 4.5;
        }
      }

      // Footer
      const pageH = doc.internal.pageSize.height;
      doc.setDrawColor(200, 200, 200);
      doc.line(M, pageH - 10, W - M, pageH - 10);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
      doc.text("Aarogya X Decision Support System  |  Confidential Clinical Document", W / 2, pageH - 5, { align: "center" });

      const filename = `AarogyaX-Case-${clinicalCase.caseNumber}.pdf`;
      doc.save(filename);
      toast({ title: "Report downloaded", description: filename });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message ?? "Could not generate PDF", variant: "destructive" });
    }
  };

  const handleEmailReport = () => {
    setEmailTo("");
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    const recipient = emailTo.trim();
    if (!recipient) {
      toast({ title: "Enter at least one email address", variant: "destructive" }); return;
    }
    console.log("[AarogyaX] Sending case email to:", recipient);
    setEmailSending(true);
    try {
      const body = JSON.stringify({ to: recipient });
      console.log("[AarogyaX] Request body:", body);
      const response = await fetch(`/api/email/case/${id}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("aarogya_token")}`,
          "Content-Type": "application/json",
        },
        body,
      });
      const text = await response.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      if (!response.ok) throw new Error(data.message ?? data.error ?? "Failed to send email");
      toast({ title: "Report sent!", description: `Email delivered to: ${recipient}` });
      setEmailDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Email failed", description: err.message ?? "Could not send email", variant: "destructive" });
    } finally {
      setEmailSending(false);
    }
  };

  const handleGeneratePrediction = () => {
    if (!clinicalCase) return;
    predictAmr.mutate({
      data: {
        caseId: id,
        infectionType: clinicalCase.infectionType,
        severity: clinicalCase.severity,
        icuStatus: clinicalCase.icuStatus,
        priorAntibiotics: clinicalCase.priorAntibiotics,
        organism: clinicalCase.organism,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Prediction generated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetCaseQueryKey(id) });
      },
      onError: (err) => toast({ title: "Prediction failed", description: err.message, variant: "destructive" })
    });
  };

  if (isLoading) {
    return <div className="space-y-4 p-8"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!clinicalCase) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Case History", href: "/cases" }, { label: "Case Detail" }]} />
        <ErrorState title="Case record not found" message="The requested clinical case could not be located." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Case History", href: "/cases" }, { label: `Case ${clinicalCase.caseNumber}` }]} />

      {/* Email recipient dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" /> Send Report via Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="emailTo">Recipient Email(s)</Label>
            <Input
              id="emailTo"
              placeholder="e.g. doctor@hospital.com, lab@clinic.com"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendEmail()}
            />
            <p className="text-xs text-muted-foreground">Separate multiple emails with commas. The case PDF will be attached.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={emailSending}>
              <Mail className="w-4 h-4 mr-2" />{emailSending ? "Sending…" : "Send Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Case {clinicalCase.caseNumber}</h1>
            <Badge
              variant={clinicalCase.status === "resolved" || clinicalCase.status === "closed" ? "default" : "secondary"}
              className={`capitalize text-xs font-bold px-2.5 py-1 ${
                clinicalCase.status === "resolved" || clinicalCase.status === "closed"
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 text-white"
              }`}
            >
              {clinicalCase.status === "resolved" || clinicalCase.status === "closed" ? "Recovered" : "Active"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">Patient ID: {clinicalCase.patient?.patientId}</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={clinicalCase.status === "resolved" || clinicalCase.status === "closed" ? "resolved" : "open"}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className={`w-[155px] font-semibold text-xs border ${
              clinicalCase.status === "resolved" || clinicalCase.status === "closed"
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                : "bg-blue-500/10 text-blue-600 border-blue-500/30"
            }`}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open" className="text-xs font-medium text-blue-600">🔵 Active</SelectItem>
              <SelectItem value="resolved" className="text-xs font-medium text-emerald-600">🟢 Recovered</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleDownloadPdf}>
            <FileDown className="mr-2 h-4 w-4" /> Export Report
          </Button>
          <Button variant="outline" onClick={handleEmailReport}>
            <Mail className="mr-2 h-4 w-4" /> Email Report
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-8 space-y-6">
          <Card>
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" /> 
                AMR Prediction & Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {clinicalCase.prediction ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-primary">{clinicalCase.prediction.recommendedDrug}</h3>
                      <p className="text-sm text-muted-foreground mt-1">Primary Recommendation</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={`text-lg py-1 ${
                        clinicalCase.prediction.resistanceRisk === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        clinicalCase.prediction.resistanceRisk === 'high' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                        clinicalCase.prediction.resistanceRisk === 'medium' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                        'bg-green-500/10 text-green-500 border-green-500/20'
                      }`}>
                        {clinicalCase.prediction.resistanceRisk.toUpperCase()} RISK
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-2">
                        {(clinicalCase.prediction.resistanceProbability * 100).toFixed(1)}% Resistance Probability
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-primary mb-0.5">RECOMMENDED DOSAGE</p>
                      <p className="text-sm font-medium">{getDosage(clinicalCase.prediction.recommendedDrug, (clinicalCase.prediction as any).dosage)}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Adjust per renal function, weight, and local antibiogram</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-y py-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Confidence Score</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${clinicalCase.prediction.confidence * 100}%` }} />
                        </div>
                        <span className="font-mono text-sm">{(clinicalCase.prediction.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Alternative Options</span>
                      <p className="font-medium mt-1">
                        {clinicalCase.prediction.alternativeDrugs?.join(", ") || "None recommended"}
                      </p>
                    </div>
                  </div>

                  {/* ML Model Accuracy Badge */}
                  {(clinicalCase.prediction as any).modelAccuracy ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                      <svg className="h-4 w-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>
                      <span className="text-xs text-muted-foreground">ML Model</span>
                      <span className="text-xs font-bold text-primary ml-auto">
                        {((clinicalCase.prediction as any).modelAccuracy * 100).toFixed(1)}% CV Accuracy
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                        {(clinicalCase.prediction as any).modelName || "GradientBoosting Classifier"}
                      </Badge>
                    </div>
                  ) : null}

                  {/* Drug Rankings Table */}
                  {(clinicalCase.prediction as any).drugRankings?.length > 0 && (
                    <div>
                      <span className="text-sm font-semibold flex items-center gap-1 mb-2">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
                        Drug Rankings (from surveillance data)
                      </span>
                      <div className="rounded-lg border overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Drug</th>
                              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Sensitivity</th>
                              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Resistance</th>
                              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {((clinicalCase.prediction as any).drugRankings as Array<{drug:string;score:number;sensitivity:number;resistance:number;stewardship:string;warnings:string[]}>).map((r, i) => (
                              <tr key={r.drug} className={`border-t ${i === 0 ? "bg-primary/5" : ""}`}>
                                <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                                <td className="px-3 py-2 font-medium">
                                  {r.drug}
                                  {r.stewardship && <span className="ml-1 text-[10px] text-muted-foreground">({r.stewardship})</span>}
                                  {r.warnings?.[0] && <p className="text-[10px] text-orange-500 mt-0.5">{r.warnings[0]}</p>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`font-mono font-bold ${r.sensitivity >= 60 ? "text-green-600" : r.sensitivity >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                                    {r.sensitivity.toFixed(0)}%
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`font-mono ${r.resistance >= 70 ? "text-red-500" : "text-muted-foreground"}`}>
                                    {r.resistance.toFixed(0)}%
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex items-center gap-1 justify-center">
                                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(r.score, 100)}%` }} />
                                    </div>
                                    <span className="font-mono text-muted-foreground">{r.score.toFixed(0)}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Clinical warnings */}
                  {(clinicalCase.prediction as any).clinicalWarnings?.length > 0 && (
                    <div className="space-y-1">
                      {((clinicalCase.prediction as any).clinicalWarnings as string[]).map((w, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs px-3 py-1.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-600">
                          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          {w}
                        </div>
                      ))}
                    </div>
                  )}

                  {clinicalCase.prediction.rationale && (
                    <div>
                      <span className="text-sm font-semibold flex items-center gap-1">
                        <Activity className="h-4 w-4" /> Clinical Rationale
                      </span>
                      <p className="text-sm text-muted-foreground mt-2 p-3 bg-muted/50 rounded-md leading-relaxed">
                        {clinicalCase.prediction.rationale}
                      </p>
                    </div>
                  )}

                  {/* Clinical Disclaimer */}
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5">
                    <TriangleAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-400 mb-0.5">CLINICAL DISCLAIMER</p>
                      <p className="text-[11px] text-amber-300/80 leading-relaxed">
                        This tool provides <strong className="text-amber-300">clinical decision support</strong> and does <strong className="text-amber-300">not replace physician judgment</strong>. Final treatment decisions remain the sole responsibility of the treating clinician.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">No Prediction Generated</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1">
                      Run the AI assessment model to evaluate resistance risk and get treatment recommendations.
                    </p>
                  </div>
                  <Button onClick={handleGeneratePrediction} disabled={predictAmr.isPending}>
                    {predictAmr.isPending ? "Analyzing..." : "Generate AI Prediction"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Clinical Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="p-3 bg-muted/30 rounded-md border">
                  <span className="text-muted-foreground block mb-1">Infection Type</span>
                  <span className="font-medium capitalize">{clinicalCase.infectionType}</span>
                </div>
                <div className="p-3 bg-muted/30 rounded-md border">
                  <span className="text-muted-foreground block mb-1">Severity</span>
                  <span className="font-medium capitalize">{clinicalCase.severity}</span>
                </div>
                <div className="p-3 bg-muted/30 rounded-md border">
                  <span className="text-muted-foreground block mb-1">Organism</span>
                  <span className="font-medium italic">{clinicalCase.organism || 'Unknown'}</span>
                </div>
                <div className="p-3 bg-muted/30 rounded-md border">
                  <span className="text-muted-foreground block mb-1">Culture</span>
                  <span className="font-medium">{clinicalCase.cultureResult || 'Pending'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Patient Summary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              {clinicalCase.patient && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{clinicalCase.patient.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Age/Gender</span>
                    <span className="font-medium capitalize">{clinicalCase.patient.age}y / {clinicalCase.patient.gender}</span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <span className="text-muted-foreground block mb-2">Risk Factors</span>
                    <div className="flex flex-wrap gap-1">
                      {clinicalCase.patient.diabetes && <Badge variant="secondary" className="text-xs">Diabetes</Badge>}
                      {clinicalCase.patient.ckd && <Badge variant="secondary" className="text-xs">CKD</Badge>}
                      {clinicalCase.patient.immunocompromised && <Badge variant="secondary" className="text-xs">Immunocompromised</Badge>}
                      {(!clinicalCase.patient.diabetes && !clinicalCase.patient.ckd && !clinicalCase.patient.immunocompromised) && 
                        <span className="text-xs text-muted-foreground">None identified</span>}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Lab Values</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3 font-mono">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground font-sans">WBC</span>
                <span>{clinicalCase.cbcValue !== undefined ? `${clinicalCase.cbcValue} 10^9/L` : '-'}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground font-sans">CRP</span>
                <span className={clinicalCase.crpValue && clinicalCase.crpValue > 10 ? "text-orange-500" : ""}>
                  {clinicalCase.crpValue !== undefined ? `${clinicalCase.crpValue} mg/L` : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2">
                <span className="text-muted-foreground font-sans">Procalcitonin</span>
                <span className={clinicalCase.procalcitoninValue && clinicalCase.procalcitoninValue > 0.5 ? "text-red-500" : ""}>
                  {clinicalCase.procalcitoninValue !== undefined ? `${clinicalCase.procalcitoninValue} ng/mL` : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
