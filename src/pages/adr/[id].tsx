import { useRoute } from "wouter";
import { useGetAdrReport, getGetAdrReportQueryKey } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDown, AlertOctagon, Calendar, User, Activity, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { downloadOfficialPvPIForm } from "@/lib/utils";
import { jsPDF } from "jspdf";
import { getLogoBase64 } from "@/lib/pdf-logo";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ErrorState } from "@/components/ui/error-state";


export default function AdrDetail() {
  const [match, params] = useRoute("/adr/:id");
  const id = match && params ? parseInt((params as any).id) : 0;
  const { toast } = useToast();

  const { data: report, isLoading } = useGetAdrReport(id, {
    query: { enabled: !!id, queryKey: getGetAdrReportQueryKey(id) },
  });

  const handleDownload = async () => {
    if (!report) return;
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210, M = 14, CW = W - M * 2;
      const logoBase64 = await getLogoBase64();

      // ── Helpers ──────────────────────────────────────────────────────────
      const hex = (h: string) => {
        const r = parseInt(h.slice(1, 3), 16);
        const g = parseInt(h.slice(3, 5), 16);
        const b = parseInt(h.slice(5, 7), 16);
        return [r, g, b] as [number, number, number];
      };
      const TEAL = "#0d9488", RED = "#dc2626", AMBER = "#d97706", PURPLE = "#7c3aed";

      let y = 32;

      const sectionBanner = (title: string, color: string) => {
        doc.setFillColor(...hex(color));
        doc.rect(M, y, CW, 7, "F");
        doc.setFillColor(255, 255, 255);
        doc.rect(M, y, 2.5, 7, "F");
        doc.setTextColor(255, 255, 255);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(title.toUpperCase(), M + 5, y + 4.8);
        doc.setTextColor(20, 20, 20);
        y += 9;
      };

      const fieldRow = (pairs: [string, string | null | undefined][]) => {
        const colW = CW / pairs.length;
        const startY = y;
        pairs.forEach(([label, value], i) => {
          const x = M + i * colW;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(100, 100, 100);
          doc.text(label.toUpperCase(), x, startY + 3);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(20, 20, 20);
          doc.text(value || "—", x, startY + 8);
        });
        y += 14;
      };

      const multilineField = (label: string, value: string | null | undefined) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        doc.text(label.toUpperCase(), M, y + 3);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(value || "—", CW);
        doc.text(lines, M, y + 8);
        y += 7 + lines.length * 4.5;
      };

      // ── Header Banner ────────────────────────────────────────────────────
      doc.setFillColor(...hex(RED));
      doc.rect(0, 0, 210, 26, "F");
      
      let titleX = M;
      if (logoBase64) {
        doc.addImage(logoBase64, "JPEG", M, 3, 20, 20);
        titleX = M + 24;
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("SUSPECTED ADVERSE DRUG REACTION REPORTING FORM", titleX, 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text("Pharmacovigilance Programme of India (PvPI)  |  Aarogya X Clinical System", titleX, 16);
      doc.text("PvPI — National Coordination Centre (ICMR, Ghaziabad-201002)", titleX, 21);
      doc.setTextColor(20, 20, 20);
      y = 30;

      // ── Meta Row ─────────────────────────────────────────────────────────
      doc.setFillColor(245, 245, 245);
      doc.rect(M, y, CW, 10, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(20, 20, 20);
      doc.text(`Report No.: ${report.reportNumber}`, M + 2, y + 6.5);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, M + 80, y + 6.5);
      doc.text(`Severity: ${report.severity.toUpperCase()}`, M + 145, y + 6.5);
      y += 14;

      // ── A. Patient Information ────────────────────────────────────────────
      sectionBanner("A. Patient Information", TEAL);
      fieldRow([
        ["Linked Patient ID", report.patientId ? `#${report.patientId}` : null],
        ["Linked Case ID", report.caseId ? `#${report.caseId}` : null],
        ["Report Status", report.status],
      ]);

      // ── B. Suspected Adverse Reaction ────────────────────────────────────
      sectionBanner("B. Suspected Adverse Reaction", RED);
      fieldRow([
        ["Drug Implicated", report.drugName],
        ["Reaction Start Date", report.onsetDate ? new Date(report.onsetDate).toLocaleDateString("en-IN") : null],
      ]);
      fieldRow([
        ["Severity", report.severity.toUpperCase()],
        ["Outcome", report.outcome?.replace(/-/g, " ").toUpperCase()],
        ["Report Date", new Date(report.createdAt).toLocaleDateString("en-IN")],
      ]);
      multilineField("7. Describe Event / Reaction with Treatment Details", report.reactionDescription);

      // ── C. Medication Details ─────────────────────────────────────────────
      sectionBanner("C. Suspected Medication Details", AMBER);
      fieldRow([
        ["Suspected Drug", report.drugName],
        ["Report Created", new Date(report.createdAt).toLocaleString("en-IN")],
      ]);

      // ── D. Report Information ─────────────────────────────────────────────
      sectionBanner("D. Report Information", PURPLE);
      fieldRow([
        ["Report Number", report.reportNumber],
        ["Status", report.status],
        ["Last Updated", new Date((report as any).updatedAt || report.createdAt).toLocaleDateString("en-IN")],
      ]);

      // ── Advice / Confidentiality Box ──────────────────────────────────────
      y += 2;
      doc.setDrawColor(...hex(RED));
      doc.setFillColor(255, 242, 242);
      doc.roundedRect(M, y, CW, 28, 2, 2, "FD");
      doc.setFillColor(...hex(RED));
      doc.rect(M, y, 2.5, 28, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...hex(RED));
      doc.text("CONFIDENTIALITY NOTICE", M + 5, y + 5.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(50, 50, 50);
      const confText = "The patient's identity is held in strict confidence and protected to the fullest extent. Submission does not constitute an admission that medical personnel or manufacturer caused or contributed to the reaction. Submission of an ADR report does not have any legal implication on the reporter.";
      const confLines = doc.splitTextToSize(confText, CW - 8);
      doc.text(confLines, M + 5, y + 11);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...hex(RED));
      doc.text("NCC-PvPI Helpline (Toll Free): 1800 180 3024  |  pvpi.ipc@gov.in  |  www.ipc.nic.in", M + 5, y + 24.5);

      // ── Footer ────────────────────────────────────────────────────────────
      const pageH = doc.internal.pageSize.height;
      doc.setDrawColor(200, 200, 200);
      doc.line(M, pageH - 10, W - M, pageH - 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(130, 130, 130);
      doc.text("Generated by Aarogya X — AMR & ADR Decision Support System  |  Confidential — For Clinical Use Only", W / 2, pageH - 5, { align: "center" });

      // ── Save ──────────────────────────────────────────────────────────────
      const filename = `aarogya-adr-${report.reportNumber}.pdf`;
      doc.save(filename);
      toast({ title: "PDF Downloaded", description: filename });
    } catch (e) {
      console.error(e);
      toast({ title: "Download failed", description: "Please try again.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="space-y-4 p-8"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: "ADR Reporting", href: "/adr" }, { label: "ADR Report Detail" }]} />
        <ErrorState title="ADR report not found" message="The requested adverse drug reaction report could not be located." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Breadcrumbs items={[{ label: "ADR Reporting", href: "/adr" }, { label: report.reportNumber }]} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-2">
              <AlertOctagon className="h-8 w-8" /> {report.reportNumber}
            </h1>
            <Badge variant="secondary" className="capitalize">{report.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Reported on {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleDownload} className="border-border text-foreground hover:bg-accent rounded-md">
            <FileDown className="mr-2 h-4 w-4 text-primary" /> Download Report PDF
          </Button>
          <Button variant="outline" onClick={downloadOfficialPvPIForm} className="border-rose-500/50 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-md">
            <FileDown className="mr-2 h-4 w-4" /> Official PvPI Form
          </Button>

          <a
            href="http://www.ipc.gov.in"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="border-teal-500/50 text-teal-600 hover:bg-teal-500/10 hover:text-teal-500">
              <ExternalLink className="mr-2 h-4 w-4" /> Refer to Website
            </Button>
          </a>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-xl">Reaction Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Suspected Drug</span>
              <span className="text-2xl font-bold">{report.drugName}</span>
            </div>

            <div className="flex gap-4">
              <div>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Severity</span>
                <Badge className={`text-sm py-1 ${
                  report.severity === "fatal" ? "bg-zinc-900 hover:bg-zinc-900 text-white" :
                  report.severity === "life-threatening" ? "bg-red-600 hover:bg-red-600 text-white" :
                  report.severity === "severe" ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" :
                  report.severity === "moderate" ? "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20" :
                  "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
                }`}>
                  {report.severity.toUpperCase()}
                </Badge>
              </div>
              <div>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Outcome</span>
                <Badge variant="outline" className="text-sm py-1 capitalize">
                  {report.outcome.replace("-", " ")}
                </Badge>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Clinical Description
            </span>
            <p className="text-foreground leading-relaxed bg-muted/30 p-4 rounded-lg border">
              {report.reactionDescription}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-6">
            {report.patientId && (
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Linked Patient</span>
                  <span className="font-medium font-mono">ID: {report.patientId}</span>
                </div>
              </div>
            )}
            {report.caseId && (
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Linked Case</span>
                  <span className="font-medium font-mono">ID: {report.caseId}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
