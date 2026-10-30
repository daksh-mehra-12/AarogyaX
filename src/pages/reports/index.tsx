import * as React from "react";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  FileText,
  Download,
  Mail,
  FileSpreadsheet,
  Activity,
  CheckCircle2,
  Biohazard,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Users,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { useToast } from "@/hooks/use-toast";
import { getLogoBase64 } from "@/lib/pdf-logo";
import { Link } from "wouter";
import { exportAntibiogramPDF, exportAntibiogramCSV, AntibiogramRow } from "@/components/amr-antibiogram-view";
import { useGmail } from "@/hooks/use-gmail";
import { sendEmailViaGmail } from "@/services/gmail";

export default function Reports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected, user: gmailUser } = useGmail();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // 1. Fetch Real-time Clinical Cases (always fresh, no stale cache)
  const {
    data: casesData,
    isLoading: casesLoading,
    refetch: refetchCases,
  } = useQuery({
    queryKey: ["reports-cases"],
    queryFn: async () => {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch("/api/cases", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { cases: [], total: 0 };
      const data = await res.json();
      return Array.isArray(data) ? { cases: data, total: data.length } : data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // 2. Fetch Real-time ADR Pharmacovigilance Reports
  const {
    data: adrData,
    isLoading: adrLoading,
    refetch: refetchAdr,
  } = useQuery({
    queryKey: ["reports-adr"],
    queryFn: async () => {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch("/api/adr", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { reports: [], total: 0 };
      const data = await res.json();
      return Array.isArray(data) ? { reports: data, total: data.length } : data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // 3. Fetch Real-time Laboratory AMR Records
  const {
    data: amrData,
    isLoading: amrLoading,
    refetch: refetchAmr,
  } = useQuery({
    queryKey: ["reports-amr-records"],
    queryFn: async () => {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch("/api/amr-records?limit=100", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { records: [], total: 0 };
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // 4. Fetch Real-time Patients Count
  const {
    data: patientsData,
    isLoading: patientsLoading,
    refetch: refetchPatients,
  } = useQuery({
    queryKey: ["reports-patients"],
    queryFn: async () => {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch("/api/patients", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { patients: [], total: 0 };
      const data = await res.json();
      return Array.isArray(data) ? { patients: data, total: data.length } : data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Manual refresh handler for instant data synchronization
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchCases(),
        refetchAdr(),
        refetchAmr(),
        refetchPatients(),
        queryClient.invalidateQueries(),
      ]);
      toast({
        title: "Reports Refreshed",
        description: "Synchronized latest clinical cases, AMR tests, and patient data.",
      });
    } catch {
      toast({
        title: "Refresh Error",
        description: "Could not sync data from server.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Compute live real metrics from database
  const casesList: any[] = casesData?.cases || [];
  const adrList: any[] = adrData?.reports || [];
  const amrList: any[] = amrData?.records || [];
  const patientsList: any[] = patientsData?.patients || [];

  const totalPatients = patientsData?.total ?? patientsList.length;
  const totalCases = casesData?.total ?? casesList.length;
  const activeCases = casesList.filter(
    (c: any) => c.status === "open" || c.status === "in-progress" || c.status === "in_progress"
  ).length;
  const resolvedCases = casesList.filter(
    (c: any) => c.status === "resolved" || c.status === "closed"
  ).length;

  const totalAdr = adrData?.total ?? adrList.length;
  const severeAdr = adrList.filter(
    (r: any) =>
      r.severity === "severe" ||
      r.severity === "life-threatening" ||
      r.severity === "fatal" ||
      r.severity === "SEVERE"
  ).length;

  const totalAmrRecords = amrData?.total ?? amrList.length;
  const highRiskAmr = amrList.filter(
    (r: any) => r.predictedRisk === "high" || r.predictedRisk === "critical"
  ).length;

  // Real Antibiogram aggregated strictly from actual database AMR records
  const realAntibiogramData: AntibiogramRow[] = useMemo(() => {
    if (amrList.length === 0) return [];

    // Group by pathogen + antibiotic
    const map = new Map<
      string,
      {
        pathogen: string;
        antibiotic: string;
        specimen: "All" | "Urine" | "Blood" | "Respiratory" | "Wound";
        sensitive: number;
        intermediate: number;
        resistant: number;
        total: number;
      }
    >();

    amrList.forEach((rec: any) => {
      const pathogen = rec.organism || "Unspecified Pathogen";
      let specimenType: "All" | "Urine" | "Blood" | "Respiratory" | "Wound" = "All";
      const s = String(rec.specimenType || "").toLowerCase();
      if (s.includes("urine")) specimenType = "Urine";
      else if (s.includes("blood")) specimenType = "Blood";
      else if (s.includes("respiratory") || s.includes("sputum")) specimenType = "Respiratory";
      else if (s.includes("wound") || s.includes("pus")) specimenType = "Wound";

      const susceptibilities = Array.isArray(rec.susceptibilities) ? rec.susceptibilities : [];

      susceptibilities.forEach((item: any) => {
        const drug = item.antibiotic || "Antibiotic";
        const key = `${pathogen}::${drug}`;

        if (!map.has(key)) {
          map.set(key, {
            pathogen,
            antibiotic: drug,
            specimen: specimenType,
            sensitive: 0,
            intermediate: 0,
            resistant: 0,
            total: 0,
          });
        }

        const entry = map.get(key)!;
        entry.total += 1;
        const status = String(item.susceptibility || "").toLowerCase();
        if (status.includes("sens") || status === "sensitive" || status === "s") {
          entry.sensitive += 1;
        } else if (status.includes("inter") || status === "intermediate" || status === "i") {
          entry.intermediate += 1;
        } else {
          entry.resistant += 1;
        }
      });
    });

    const rows: AntibiogramRow[] = [];
    let idx = 1;
    map.forEach((entry, key) => {
      const sensPct = entry.total > 0 ? Math.round((entry.sensitive / entry.total) * 100) : 0;
      const interPct = entry.total > 0 ? Math.round((entry.intermediate / entry.total) * 100) : 0;
      const resPct = entry.total > 0 ? Math.round((entry.resistant / entry.total) * 100) : 0;

      // Classify AWaRe category
      let aware: "Access" | "Watch" | "Reserve" = "Watch";
      const d = entry.antibiotic.toLowerCase();
      if (d.includes("amoxicillin") || d.includes("ampicillin") || d.includes("amikacin") || d.includes("doxycycline") || d.includes("gentamicin")) {
        aware = "Access";
      } else if (d.includes("colistin") || d.includes("linezolid") || d.includes("polymyxin") || d.includes("daptomycin") || d.includes("avibactam")) {
        aware = "Reserve";
      }

      rows.push({
        id: `real-${idx++}`,
        pathogen: entry.pathogen,
        antibiotic: entry.antibiotic,
        aware,
        specimen: entry.specimen,
        isolates: entry.total,
        susceptiblePct: sensPct,
        intermediatePct: interPct,
        resistantPct: resPct,
        clsiBreakpoint: "Institutional AST Tested",
        clinicalNote:
          resPct >= 40
            ? "Elevated resistance detected in local patient isolates; consult ID stewardship."
            : "High clinical susceptibility in audited hospital isolates.",
      });
    });

    return rows;
  }, [amrList]);

  // Export Real Monthly Stewardship PDF
  const handleExportStewardshipPDF = async () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, M = 14, CW = W - M * 2;
    const logoBase64 = await getLogoBase64();

    // Header Banner
    doc.setFillColor(13, 148, 136); // Teal
    doc.rect(0, 0, W, 28, "F");

    let titleX = M;
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "JPEG", M, 4, 20, 20);
        titleX = M + 24;
      } catch {
        // Fallback
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("AAROGYA X — CLINICAL STEWARDSHIP & AMR SURVEILLANCE", titleX, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Official Clinical Surveillance Report  |  Live Decision Support Database", titleX, 17);
    doc.text(`Report Generated: ${new Date().toLocaleString("en-IN")}`, titleX, 23);
    doc.setTextColor(20, 20, 20);

    let y = 35;

    // Real Metric Boxes
    const box = (label: string, value: string, x: number, boxY: number, colorHex: string) => {
      const r = parseInt(colorHex.slice(1, 3), 16);
      const g = parseInt(colorHex.slice(3, 5), 16);
      const b = parseInt(colorHex.slice(5, 7), 16);
      doc.setFillColor(r, g, b);
      doc.roundedRect(x, boxY, 42, 22, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(value, x + 5, boxY + 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(240, 240, 240);
      doc.text(label, x + 5, boxY + 17);
    };

    box("Total Cases", String(totalCases), M, y, "#0d9488");
    box("Resolved Cases", String(resolvedCases), M + 46, y, "#10b981");
    box("ADR Reports", String(totalAdr), M + 92, y, "#f59e0b");
    box("AMR Lab Tests", String(totalAmrRecords), M + 138, y, "#ef4444");
    y += 28;

    // 1. Clinical Cases Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(13, 148, 136);
    doc.text("1. CLINICAL CASE & INPATIENT SURVEILLANCE AUDIT", M, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text(`• Total Registered Patients: ${totalPatients}`, M + 4, y);
    y += 5;
    doc.text(`• Total Clinical Cases Documented: ${totalCases}`, M + 4, y);
    y += 5;
    const resolvedRate = totalCases > 0 ? Math.round((resolvedCases / totalCases) * 100) : 0;
    doc.text(`• Successfully Resolved Cases: ${resolvedCases} (${resolvedRate}% clinical cure rate)`, M + 4, y);
    y += 5;
    doc.text(`• Active Surveillance Cases: ${activeCases}`, M + 4, y);
    y += 9;

    // 2. AMR Surveillance Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(13, 148, 136);
    doc.text("2. ANTIMICROBIAL RESISTANCE (AMR) LABORATORY FINDINGS", M, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text(`• Total Laboratory Culture Tests: ${totalAmrRecords}`, M + 4, y);
    y += 5;
    doc.text(`• High-Risk Multi-Drug Resistant Organisms: ${highRiskAmr}`, M + 4, y);
    y += 5;

    // List real pathogens from database if any
    if (amrList.length > 0) {
      const organisms = Array.from(new Set(amrList.map((r: any) => r.organism).filter(Boolean)));
      doc.text(`• Audited Pathogens on Record: ${organisms.slice(0, 5).join(", ")}`, M + 4, y);
      y += 5;
    } else {
      doc.text("• Audited Pathogens on Record: No laboratory cultures recorded yet in system", M + 4, y);
      y += 5;
    }
    y += 4;

    // 3. Pharmacovigilance Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(13, 148, 136);
    doc.text("3. PHARMACOVIGILANCE & ADVERSE DRUG REACTIONS (ADR)", M, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text(`• Total Adverse Drug Reaction Reports: ${totalAdr}`, M + 4, y);
    y += 5;
    doc.text(`• Severe / Critical ADR Reactions: ${severeAdr}`, M + 4, y);
    y += 10;

    // Real Stewardship Governance Notice
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(M, y, CW, 24, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(13, 148, 136);
    doc.text("CLINICAL STEWARDSHIP GOVERNANCE & COMPLIANCE DIRECTIVE", M + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    const stmt =
      "All antibiotic prescriptions must align with verified patient microbiology susceptibility data. Reserve antimicrobials (Carbapenems, Colistin, Linezolid) require consultant review within 48 hours to minimize resistance progression.";
    doc.text(doc.splitTextToSize(stmt, CW - 8), M + 4, y + 12);
    y += 32;

    // Page footer
    doc.setDrawColor(200, 200, 200);
    doc.line(M, 280, W - M, 280);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "Aarogya X Healthcare System  |  Confidential Clinical Intelligence  |  Page 1 of 1",
      W / 2,
      285,
      { align: "center" }
    );

    const filename = `AarogyaX-Stewardship-Report-${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);
    toast({
      title: "Real Stewardship PDF Exported",
      description: `Saved live clinical report with ${totalCases} cases and ${totalAmrRecords} AMR tests.`,
    });
  };

  // Export Real ADR CSV
  const handleExportAdrCSV = () => {
    const rows = [
      ["Hospital Network", "Aarogya X Clinical Surveillance System"],
      ["Module", "Adverse Drug Reaction & Pharmacovigilance Surveillance"],
      ["Export Date", new Date().toLocaleString("en-IN")],
      [],
      ["Report No.", "Drug Name", "Severity", "Outcome", "Onset Date", "Status", "Created Date"],
      ...adrList.map((r) => [
        r.reportNumber || r.id,
        r.drugName || r.suspectedDrug || "Unknown",
        r.severity || "Standard",
        r.outcome || "Recovering",
        r.onsetDate ? new Date(r.onsetDate).toLocaleDateString("en-IN") : "",
        r.status || "Submitted",
        new Date(r.createdAt).toLocaleDateString("en-IN"),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AarogyaX-ADR-Summary-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({
      title: "ADR CSV Exported",
      description: `${adrList.length} real pharmacovigilance records exported.`,
    });
  };

  // Export Antibiogram PDF (uses real database AMR records or zero-state notice)
  const handleExportAmrPDF = async () => {
    if (realAntibiogramData.length === 0) {
      toast({
        title: "No Laboratory AMR Records",
        description: "Zero AMR test records currently in database. Exporting zero-state surveillance document.",
      });
    }

    await exportAntibiogramPDF(realAntibiogramData, "All", "All", () => {
      toast({
        title: "AMR Antibiogram PDF Exported",
        description:
          realAntibiogramData.length > 0
            ? `Exported ${realAntibiogramData.length} pathogen susceptibility benchmarks.`
            : "Exported zero-state institutional antibiogram report.",
      });
    });
  };

  // Export Antibiogram CSV
  const handleExportAmrCSV = () => {
    exportAntibiogramCSV(realAntibiogramData, () => {
      toast({
        title: "AMR Antibiogram CSV Exported",
        description: `${realAntibiogramData.length} real pathogen susceptibility records exported.`,
      });
    });
  };

  // Email report dispatch
  const handleSendEmail = async () => {
    const recipient = emailTo.trim();
    if (!recipient || !recipient.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    setEmailSending(true);

    try {
      if (isConnected) {
        // Send via authenticated Gmail
        await sendEmailViaGmail({
          to: recipient,
          subject: `[Aarogya X] Clinical Stewardship & AMR Surveillance Report (${new Date().toLocaleDateString()})`,
          bodyHtml: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0f766e; margin-top: 0;">Aarogya X — Clinical Stewardship Report</h2>
              <p>Attached is the live hospital surveillance report generated from the Aarogya X Platform.</p>
              <div style="background-color: #f8fafc; padding: 14px; border-radius: 6px; margin: 16px 0; border: 1px solid #e2e8f0;">
                <p style="margin: 4px 0;"><strong>Total Evaluated Cases:</strong> ${totalCases}</p>
                <p style="margin: 4px 0;"><strong>Active Clinical Cases:</strong> ${activeCases}</p>
                <p style="margin: 4px 0;"><strong>Resolved Cases:</strong> ${resolvedCases}</p>
                <p style="margin: 4px 0;"><strong>ADR Pharmacovigilance Reports:</strong> ${totalAdr}</p>
                <p style="margin: 4px 0;"><strong>Laboratory AMR Tests:</strong> ${totalAmrRecords}</p>
              </div>
              <p style="font-size: 11px; color: #94a3b8;">Dispatched via authenticated clinician Gmail account (${gmailUser?.email}).</p>
            </div>
          `,
        });
        toast({ title: "Report Sent via Gmail", description: `Successfully delivered to ${recipient}.` });
      } else {
        // Fallback to backend email route
        const response = await fetch("/api/email/stewardship", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("aarogya_token")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ to: recipient }),
        });
        const text = await response.text();
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
        if (!response.ok) throw new Error(data.message ?? data.error ?? "Failed to send email");
        toast({ title: "Report Delivered", description: `Email sent to ${recipient}.` });
      }
      setEmailDialogOpen(false);
    } catch (err: unknown) {
      toast({
        title: "Email Dispatch Failed",
        description: err instanceof Error ? err.message : "Could not send report email",
        variant: "destructive",
      });
    } finally {
      setEmailSending(false);
    }
  };

  const isDataLoading = casesLoading || adrLoading || amrLoading || patientsLoading;

  const stats = [
    { label: "Total Patients", value: totalPatients, icon: Users, color: "#06b6d4" },
    { label: "Clinical Cases", value: totalCases, icon: Activity, color: "#14b8a6" },
    { label: "Resolved Cases", value: resolvedCases, icon: CheckCircle2, color: "#10b981" },
    { label: "ADR Pharmacovigilance", value: totalAdr, icon: ShieldAlert, color: "#f59e0b" },
    { label: "AMR Lab Tests", value: totalAmrRecords, icon: Biohazard, color: "#8b5cf6" },
    { label: "High-Risk Pathogens", value: highRiskAmr, icon: AlertTriangle, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports & Exports" }]} />

      {/* Header and Refresh Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Exports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time clinical surveillance reports, antimicrobial stewardship audits, and exportable datasets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing || isDataLoading}
            data-testid="refresh-reports-btn"
            className="text-xs font-semibold gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh Surveillance Data</span>
          </Button>
        </div>
      </div>

      {/* Live Stats Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3.5 flex items-center gap-2.5">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border"
                style={{ background: `${s.color}15`, borderColor: `${s.color}30` }}
              >
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <div className="overflow-hidden">
                <p className="text-lg font-bold tracking-tight text-foreground tabular-nums">
                  {isDataLoading ? "—" : s.value}
                </p>
                <p className="text-[10.5px] text-muted-foreground truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Export Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Monthly Stewardship Report */}
        <Card className="flex flex-col justify-between">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">Clinical Stewardship Report</h3>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    PDF
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Live PDF report generated from current database records with case counts, patient totals, and stewardship audit directives.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-muted/20 border border-border text-[11px] text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Evaluated Cases:</span>
                <strong className="text-foreground">{totalCases}</strong>
              </div>
              <div className="flex justify-between">
                <span>Clinical Cure Rate:</span>
                <strong className="text-emerald-600">
                  {totalCases > 0 ? `${Math.round((resolvedCases / totalCases) * 100)}%` : "N/A"}
                </strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleExportStewardshipPDF}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export PDF
              </Button>
              <Button size="sm" onClick={() => setEmailDialogOpen(true)}>
                <Mail className="mr-1.5 h-3.5 w-3.5" /> Email Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 2. ADR Pharmacovigilance Summary */}
        <Card className="flex flex-col justify-between">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">ADR Pharmacovigilance Summary</h3>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                    CSV
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Export all logged Adverse Drug Reaction records with clinical severity, outcomes, and suspected pharmaceuticals for pharmacovigilance review.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-muted/20 border border-border text-[11px] text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Logged ADR Reports:</span>
                <strong className="text-foreground">{totalAdr}</strong>
              </div>
              <div className="flex justify-between">
                <span>Critical / Severe Events:</span>
                <strong className="text-rose-500">{severeAdr}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleExportAdrCSV}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 3. AMR Antibiogram & Surveillance Matrix */}
        <Card className="flex flex-col justify-between border-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                <Biohazard className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">AMR Antibiogram & Surveillance</h3>
                  <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30">
                    PDF & CSV
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Compiled antimicrobial resistance susceptibility matrix generated strictly from patient laboratory cultures in the system.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-background/80 border border-border text-[11px] text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Real AMR Laboratory Tests:</span>
                <strong className="text-foreground">{totalAmrRecords}</strong>
              </div>
              <div className="flex justify-between">
                <span>Compiled Pathogen Matrix:</span>
                <strong className="text-primary">
                  {realAntibiogramData.length > 0 ? `${realAntibiogramData.length} drug-pathogen pairs` : "0 (No fake data)"}
                </strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
              <Link
                href="/predict?tab=antibiogram"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                Open Matrix View <ArrowRight className="h-3 w-3" />
              </Link>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportAmrCSV}>
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> CSV
                </Button>
                <Button size="sm" onClick={handleExportAmrPDF}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Report Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md bg-card border border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Mail className="w-4 h-4 text-primary" /> Transmit Clinical Stewardship Report
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isConnected
                ? `Dispatched via your connected Gmail account (${gmailUser?.email})`
                : "Dispatches clinical report to attending medical team."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <Label htmlFor="reportEmailTo" className="text-xs font-semibold">
              Recipient Email Address
            </Label>
            <Input
              id="reportEmailTo"
              placeholder="e.g. doctor@hospital.com, icu@hospital.org"
              value={emailTo}
              className="text-xs h-9"
              onChange={(e) => setEmailTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
            />
            <p className="text-[11px] text-muted-foreground">
              The summary report containing {totalCases} clinical cases and {totalAmrRecords} laboratory AMR tests will be transmitted.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSendEmail} disabled={emailSending}>
              {emailSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5 mr-1.5" /> Send Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
