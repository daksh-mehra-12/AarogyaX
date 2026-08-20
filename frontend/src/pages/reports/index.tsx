import * as React from "react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useListAdrReports, useListCases, useGetDashboardSummary } from "@/api";
import { FileText, Download, Mail, FileSpreadsheet, Activity, TrendingUp, ShieldAlert, CheckCircle2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { useToast } from "@/hooks/use-toast";
import { getLogoBase64 } from "@/lib/pdf-logo";

export default function Reports() {
  const { data: summary } = useGetDashboardSummary();
  const { data: adrData } = useListAdrReports({});
  const { data: casesData } = useListCases({});
  const { toast } = useToast();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const totalCases = summary?.totalCases ?? (casesData?.cases?.length || 0);
  const activeCases = summary?.activeCases ?? (casesData?.cases?.filter(c => c.status === "open" || c.status === "in-progress").length || 0);
  const resolvedCases = summary?.resolvedCases ?? (casesData?.cases?.filter(c => c.status === "resolved" || c.status === "closed").length || 0);
  const totalAdr = adrData?.reports?.length || 0;
  const severeAdr = adrData?.reports?.filter(r => r.severity === "severe" || r.severity === "life-threatening" || r.severity === "fatal").length || 0;

  const handleExportStewardshipPDF = async () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, M = 14, CW = W - M * 2;
    const logoBase64 = await getLogoBase64();

    // Header Banner
    doc.setFillColor(13, 148, 136); // Teal
    doc.rect(0, 0, W, 28, "F");

    let titleX = M;
    if (logoBase64) {
      doc.addImage(logoBase64, "JPEG", M, 4, 20, 20);
      titleX = M + 24;
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("AAROGYA X — CLINICAL STEWARDSHIP REPORT", titleX, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("City General Hospital — Department of Clinical Pharmacology & AMR Surveillance", titleX, 17);
    doc.text(`Report Generated: ${new Date().toLocaleString("en-IN")}`, titleX, 23);
    doc.setTextColor(20, 20, 20);

    let y = 34;

    // Executive Summary Metric Boxes
    const box = (label: string, value: string, x: number, boxY: number, colorHex: string) => {
      const r = parseInt(colorHex.slice(1,3), 16);
      const g = parseInt(colorHex.slice(3,5), 16);
      const b = parseInt(colorHex.slice(5,7), 16);
      doc.setFillColor(r, g, b);
      doc.roundedRect(x, boxY, 42, 22, 2, 2, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(255, 255, 255);
      doc.text(value, x + 6, boxY + 12);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(240, 240, 240);
      doc.text(label, x + 6, boxY + 18);
    };

    box("Total Cases", String(totalCases), M, y, "#0d9488");
    box("Resolved", String(resolvedCases), M + 46, y, "#10b981");
    box("ADR Reports", String(totalAdr), M + 92, y, "#f59e0b");
    box("Severe ADRs", String(severeAdr), M + 138, y, "#ef4444");
    y += 28;

    // Clinical Case Section
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(13, 148, 136);
    doc.text("1. CLINICAL CASE & SURVEILLANCE SUMMARY", M, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(40, 40, 40);
    doc.text(`• Total Clinical Cases Logged: ${totalCases}`, M + 4, y); y += 5;
    doc.text(`• Successfully Resolved Cases: ${resolvedCases} (${totalCases ? Math.round((resolvedCases / totalCases) * 100) : 0}%)`, M + 4, y); y += 5;
    doc.text(`• Active / Open Cases: ${activeCases}`, M + 4, y); y += 10;

    // Pharmacovigilance Section
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(13, 148, 136);
    doc.text("2. PHARMACOVIGILANCE & ADR AUDIT", M, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(40, 40, 40);
    doc.text(`• Total Adverse Drug Reaction Reports: ${totalAdr}`, M + 4, y); y += 5;
    doc.text(`• Critical / Severe Reactions Identified: ${severeAdr}`, M + 4, y); y += 12;

    // Policy & Governance Statement
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(M, y, CW, 24, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(13, 148, 136);
    doc.text("ANTIBIOTIC STEWARDSHIP POLICY & COMPLIANCE STATEMENT", M + 4, y + 6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(60, 60, 60);
    const stmt = "All clinical antibiotic prescriptions must comply with local institutional antibiogram recommendations. Restricted carbapenems and polymyxins require senior consultant review within 48 hours.";
    doc.text(doc.splitTextToSize(stmt, CW - 8), M + 4, y + 12);
    y += 32;

    // Page footer & numbering
    doc.setDrawColor(200, 200, 200);
    doc.line(M, 280, W - M, 280);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
    doc.text("Aarogya X Healthcare System  |  Confidential Clinical Document  |  Page 1 of 1", W / 2, 285, { align: "center" });

    doc.save(`AarogyaX-Stewardship-Report-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Stewardship PDF generated", description: "Official report saved successfully." });
  };

  const handleExportAdrCSV = () => {
    const reports = adrData?.reports || [];
    const rows = [
      ["Hospital", "City General Hospital - Department of Clinical Pharmacology & AMR Surveillance"],
      ["System", "Aarogya X Clinical Decision System"],
      ["Export Date", new Date().toLocaleString("en-IN")],
      [],
      ["Report No.", "Drug Name", "Severity", "Outcome", "Onset Date", "Status", "Created Date"],
      ...reports.map(r => [
        r.reportNumber, r.drugName, r.severity, r.outcome,
        r.onsetDate ? new Date(r.onsetDate).toLocaleDateString("en-IN") : "",
        r.status, new Date(r.createdAt).toLocaleDateString("en-IN"),
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AarogyaX-ADR-Summary-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "ADR CSV exported", description: `${reports.length} records exported to CSV.` });
  };

  const handleEmail = () => {
    setEmailTo("");
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    const recipient = emailTo.trim();
    if (!recipient) {
      toast({ title: "Enter at least one email address", variant: "destructive" }); return;
    }
    setEmailSending(true);
    try {
      const response = await fetch("/api/email/stewardship", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("aarogya_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: recipient }),
      });
      const text = await response.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      if (!response.ok) throw new Error(data.message ?? data.error ?? "Failed to send email");
      toast({ title: "Report emailed successfully", description: `Delivered to: ${recipient}` });
      setEmailDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Email failed", description: err.message ?? "Could not send email", variant: "destructive" });
    } finally {
      setEmailSending(false);
    }
  };

  const stats = [
    { label: "Total Clinical Cases", value: totalCases, icon: Activity, color: "#14b8a6" },
    { label: "Active Open Cases", value: activeCases, icon: Activity, color: "#3b82f6" },
    { label: "Resolved Cases", value: resolvedCases, icon: CheckCircle2, color: "#10b981" },
    { label: "ADR Reports", value: totalAdr, icon: ShieldAlert, color: "#f59e0b" },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports & Exports" }]} />

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md bg-card border border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Mail className="w-4 h-4 text-primary" /> Send Stewardship Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="reportEmailTo" className="text-xs font-semibold">Recipient Email(s)</Label>
            <Input
              id="reportEmailTo"
              placeholder="e.g. doctor@hospital.com, lab@clinic.com"
              value={emailTo}
              className="text-xs h-9"
              onChange={e => setEmailTo(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendEmail()}
            />
            <p className="text-xs text-muted-foreground">Separate multiple emails with commas. The report PDF will be attached.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSendEmail} disabled={emailSending}>
              <Mail className="w-3.5 h-3.5 mr-1.5" />{emailSending ? "Sending…" : "Send Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Exports</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Export clinical surveillance data for stewardship audit and committee review</p>
      </div>

      {/* Stats summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border"
                style={{ background: `${s.color}15`, borderColor: `${s.color}30` }}>
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Export Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Monthly Stewardship Report */}
        <Card className="flex flex-col justify-between">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">Monthly Stewardship Report</h3>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">PDF</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Official PDF report formatted with hospital branding, executive summary, case counts, and policy compliance statement.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleExportStewardshipPDF}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export PDF
              </Button>
              <Button size="sm" onClick={handleEmail}>
                <Mail className="mr-1.5 h-3.5 w-3.5" /> Email Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ADR Summary CSV */}
        <Card className="flex flex-col justify-between">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">ADR Pharmacovigilance Summary</h3>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">CSV</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Export all Adverse Drug Reaction records with hospital metadata for committee review and spreadsheet analysis.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleExportAdrCSV}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
