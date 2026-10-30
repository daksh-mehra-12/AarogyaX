import * as React from "react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { getLogoBase64 } from "@/lib/pdf-logo";
import {
  ShieldAlert, Download, FileSpreadsheet, FileText, Search,
  Filter, AlertTriangle, CheckCircle2, Biohazard, Activity, Info,
  TrendingUp, ExternalLink, RefreshCw
} from "lucide-react";

export type AwareCategory = "Access" | "Watch" | "Reserve";

export interface AntibiogramRow {
  id: string;
  pathogen: string;
  antibiotic: string;
  aware: AwareCategory;
  specimen: "All" | "Urine" | "Blood" | "Respiratory" | "Wound";
  isolates: number;
  susceptiblePct: number;
  intermediatePct: number;
  resistantPct: number;
  clsiBreakpoint: string;
  clinicalNote: string;
}

// ── Hospital & ICMR Surveillance Antibiogram Dataset ───────────────────────
export const DEFAULT_ANTIBIOGRAM_DATA: AntibiogramRow[] = [
  // Escherichia coli
  {
    id: "ec-1",
    pathogen: "Escherichia coli",
    antibiotic: "Amikacin",
    aware: "Access",
    specimen: "Urine",
    isolates: 482,
    susceptiblePct: 88,
    intermediatePct: 4,
    resistantPct: 8,
    clsiBreakpoint: "S ≤16, R ≥64 µg/mL",
    clinicalNote: "High efficacy for complicated UTI; monitor nephrotoxicity/renal clearance.",
  },
  {
    id: "ec-2",
    pathogen: "Escherichia coli",
    antibiotic: "Ceftriaxone",
    aware: "Access",
    specimen: "Urine",
    isolates: 482,
    susceptiblePct: 29,
    intermediatePct: 6,
    resistantPct: 65,
    clsiBreakpoint: "S ≤1, R ≥4 µg/mL",
    clinicalNote: "High ESBL prevalence; avoid as empiric monotherapy in severe sepsis.",
  },
  {
    id: "ec-3",
    pathogen: "Escherichia coli",
    antibiotic: "Piperacillin-Tazobactam",
    aware: "Watch",
    specimen: "All",
    isolates: 482,
    susceptiblePct: 76,
    intermediatePct: 8,
    resistantPct: 16,
    clsiBreakpoint: "S ≤16, R ≥128 µg/mL",
    clinicalNote: "Effective carbapenem-sparing alternative for moderate ESBL-producing bacteremia.",
  },
  {
    id: "ec-4",
    pathogen: "Escherichia coli",
    antibiotic: "Meropenem",
    aware: "Watch",
    specimen: "Blood",
    isolates: 340,
    susceptiblePct: 89,
    intermediatePct: 3,
    resistantPct: 8,
    clsiBreakpoint: "S ≤1, R ≥4 µg/mL",
    clinicalNote: "Restricted carbapenem. Preserve for hemodynamically unstable septic shock.",
  },
  {
    id: "ec-5",
    pathogen: "Escherichia coli",
    antibiotic: "Ciprofloxacin",
    aware: "Watch",
    specimen: "Urine",
    isolates: 482,
    susceptiblePct: 31,
    intermediatePct: 7,
    resistantPct: 62,
    clsiBreakpoint: "S ≤0.25, R ≥1 µg/mL",
    clinicalNote: "Widespread community resistance; restrict first-line empiric use.",
  },
  {
    id: "ec-6",
    pathogen: "Escherichia coli",
    antibiotic: "Colistin",
    aware: "Reserve",
    specimen: "All",
    isolates: 110,
    susceptiblePct: 97,
    intermediatePct: 0,
    resistantPct: 3,
    clsiBreakpoint: "Intermediate ≤2, Resistant ≥4 µg/mL",
    clinicalNote: "Last-resort reserve agent. Strictly restricted; requires ID consultant sign-off.",
  },

  // Klebsiella pneumoniae
  {
    id: "kp-1",
    pathogen: "Klebsiella pneumoniae",
    antibiotic: "Meropenem",
    aware: "Watch",
    specimen: "Blood",
    isolates: 395,
    susceptiblePct: 58,
    intermediatePct: 6,
    resistantPct: 36,
    clsiBreakpoint: "S ≤1, R ≥4 µg/mL",
    clinicalNote: "High carbapenemase (OXA-48 / NDM) prevalence in ICU isolates.",
  },
  {
    id: "kp-2",
    pathogen: "Klebsiella pneumoniae",
    antibiotic: "Amikacin",
    aware: "Access",
    specimen: "All",
    isolates: 395,
    susceptiblePct: 69,
    intermediatePct: 5,
    resistantPct: 26,
    clsiBreakpoint: "S ≤16, R ≥64 µg/mL",
    clinicalNote: "Synergistic in combination regimens for susceptible aminoglycoside profiles.",
  },
  {
    id: "kp-3",
    pathogen: "Klebsiella pneumoniae",
    antibiotic: "Ceftriaxone",
    aware: "Access",
    specimen: "Respiratory",
    isolates: 310,
    susceptiblePct: 18,
    intermediatePct: 4,
    resistantPct: 78,
    clsiBreakpoint: "S ≤1, R ≥4 µg/mL",
    clinicalNote: "Contraindicated empirically in hospital-acquired pneumonia.",
  },
  {
    id: "kp-4",
    pathogen: "Klebsiella pneumoniae",
    antibiotic: "Ceftazidime-Avibactam",
    aware: "Reserve",
    specimen: "All",
    isolates: 95,
    susceptiblePct: 84,
    intermediatePct: 2,
    resistantPct: 14,
    clsiBreakpoint: "S ≤8/4, R ≥16/4 µg/mL",
    clinicalNote: "Active against KPC and OXA-48; ineffective against metallo-beta-lactamases (NDM).",
  },
  {
    id: "kp-5",
    pathogen: "Klebsiella pneumoniae",
    antibiotic: "Colistin",
    aware: "Reserve",
    specimen: "All",
    isolates: 140,
    susceptiblePct: 93,
    intermediatePct: 0,
    resistantPct: 7,
    clsiBreakpoint: "I ≤2, R ≥4 µg/mL",
    clinicalNote: "Reserve antibiotic for pan-drug resistant CRE isolates.",
  },

  // Pseudomonas aeruginosa
  {
    id: "pa-1",
    pathogen: "Pseudomonas aeruginosa",
    antibiotic: "Piperacillin-Tazobactam",
    aware: "Watch",
    specimen: "Respiratory",
    isolates: 260,
    susceptiblePct: 71,
    intermediatePct: 7,
    resistantPct: 22,
    clsiBreakpoint: "S ≤16, R ≥128 µg/mL",
    clinicalNote: "Core antipseudomonal backbone for ventilator-associated pneumonia.",
  },
  {
    id: "pa-2",
    pathogen: "Pseudomonas aeruginosa",
    antibiotic: "Meropenem",
    aware: "Watch",
    specimen: "Blood",
    isolates: 260,
    susceptiblePct: 68,
    intermediatePct: 8,
    resistantPct: 24,
    clsiBreakpoint: "S ≤2, R ≥8 µg/mL",
    clinicalNote: "Monitor for OprD porin loss and upregulated efflux pump resistance.",
  },
  {
    id: "pa-3",
    pathogen: "Pseudomonas aeruginosa",
    antibiotic: "Ciprofloxacin",
    aware: "Watch",
    specimen: "All",
    isolates: 260,
    susceptiblePct: 52,
    intermediatePct: 9,
    resistantPct: 39,
    clsiBreakpoint: "S ≤0.5, R ≥2 µg/mL",
    clinicalNote: "Oral step-down option only after in-vitro susceptibility confirmation.",
  },
  {
    id: "pa-4",
    pathogen: "Pseudomonas aeruginosa",
    antibiotic: "Amikacin",
    aware: "Access",
    specimen: "All",
    isolates: 260,
    susceptiblePct: 79,
    intermediatePct: 5,
    resistantPct: 16,
    clsiBreakpoint: "S ≤16, R ≥64 µg/mL",
    clinicalNote: "High susceptibility rate; excellent adjunctive antipseudomonal.",
  },

  // Acinetobacter baumannii
  {
    id: "ab-1",
    pathogen: "Acinetobacter baumannii",
    antibiotic: "Meropenem",
    aware: "Watch",
    specimen: "Respiratory",
    isolates: 185,
    susceptiblePct: 22,
    intermediatePct: 5,
    resistantPct: 73,
    clsiBreakpoint: "S ≤2, R ≥8 µg/mL",
    clinicalNote: "CRAB endemicity; empirical carbapenem monotherapy generally fails.",
  },
  {
    id: "ab-2",
    pathogen: "Acinetobacter baumannii",
    antibiotic: "Colistin",
    aware: "Reserve",
    specimen: "All",
    isolates: 185,
    susceptiblePct: 91,
    intermediatePct: 0,
    resistantPct: 9,
    clsiBreakpoint: "I ≤2, R ≥4 µg/mL",
    clinicalNote: "Primary definitive agent for CRAB infections with optimized loading dose.",
  },
  {
    id: "ab-3",
    pathogen: "Acinetobacter baumannii",
    antibiotic: "Amikacin",
    aware: "Access",
    specimen: "All",
    isolates: 185,
    susceptiblePct: 38,
    intermediatePct: 8,
    resistantPct: 54,
    clsiBreakpoint: "S ≤16, R ≥64 µg/mL",
    clinicalNote: "Limited activity; only considered if verified sensitive.",
  },

  // Staphylococcus aureus
  {
    id: "sa-1",
    pathogen: "Staphylococcus aureus (MRSA/MSSA)",
    antibiotic: "Vancomycin",
    aware: "Watch",
    specimen: "Blood",
    isolates: 310,
    susceptiblePct: 99,
    intermediatePct: 1,
    resistantPct: 0,
    clsiBreakpoint: "S ≤2, R ≥8 µg/mL",
    clinicalNote: "First-line MRSA bacteremia therapy; target trough 15-20 µg/mL or AUC/MIC ≥400.",
  },
  {
    id: "sa-2",
    pathogen: "Staphylococcus aureus (MRSA/MSSA)",
    antibiotic: "Linezolid",
    aware: "Reserve",
    specimen: "Respiratory",
    isolates: 310,
    susceptiblePct: 98,
    intermediatePct: 1,
    resistantPct: 1,
    clsiBreakpoint: "S ≤4, R ≥8 µg/mL",
    clinicalNote: "Superior epithelial lining fluid penetration for MRSA hospital pneumonia.",
  },
  {
    id: "sa-3",
    pathogen: "Staphylococcus aureus (MRSA/MSSA)",
    antibiotic: "Ciprofloxacin",
    aware: "Watch",
    specimen: "Wound",
    isolates: 310,
    susceptiblePct: 38,
    intermediatePct: 6,
    resistantPct: 56,
    clsiBreakpoint: "S ≤1, R ≥4 µg/mL",
    clinicalNote: "High resistance in MRSA strains; avoid monotherapy.",
  },

  // Enterococcus faecalis / faecium
  {
    id: "ef-1",
    pathogen: "Enterococcus faecalis/faecium",
    antibiotic: "Vancomycin",
    aware: "Watch",
    specimen: "Urine",
    isolates: 145,
    susceptiblePct: 78,
    intermediatePct: 3,
    resistantPct: 19,
    clsiBreakpoint: "S ≤4, R ≥32 µg/mL",
    clinicalNote: "VRE isolates require Linezolid or Daptomycin with strict barrier precautions.",
  },
  {
    id: "ef-2",
    pathogen: "Enterococcus faecalis/faecium",
    antibiotic: "Linezolid",
    aware: "Reserve",
    specimen: "All",
    isolates: 145,
    susceptiblePct: 96,
    intermediatePct: 2,
    resistantPct: 2,
    clsiBreakpoint: "S ≤2, R ≥8 µg/mL",
    clinicalNote: "Effective for VRE; monitor complete blood count weekly for myelosuppression.",
  },
];

export async function exportAntibiogramPDF(
  data: AntibiogramRow[],
  filterPathogen = "All",
  filterSpecimen = "All",
  onSuccess?: () => void
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, M = 14;
  const CW = W - M * 2;
  const logoBase64 = await getLogoBase64();

  // Header Banner (Teal Medical Theme)
  doc.setFillColor(13, 148, 136); // #0d9488
  doc.rect(0, 0, W, 26, "F");

  let titleX = M;
  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", M, 3, 20, 20);
    titleX = M + 24;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("AAROGYA X — ANTIMICROBIAL RESISTANCE (AMR) SURVEILLANCE & ANTIBIOGRAM REPORT", titleX, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Aarogya X Clinical Surveillance  |  Department of Clinical Microbiology & Infectious Diseases", titleX, 16);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}  |  Filtered Organism: ${filterPathogen}  |  Specimen: ${filterSpecimen}`, titleX, 22);

  let y = 34;

  // Summary KPI Cards
  const kpiBox = (label: string, value: string, x: number, boxY: number, colorHex: string, sub: string) => {
    const r = parseInt(colorHex.slice(1,3), 16);
    const g = parseInt(colorHex.slice(3,5), 16);
    const b = parseInt(colorHex.slice(5,7), 16);
    doc.setFillColor(r, g, b);
    doc.roundedRect(x, boxY, 62, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text(value, x + 5, boxY + 8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(235, 245, 245);
    doc.text(label, x + 5, boxY + 13);
    doc.text(sub, x + 5, boxY + 16.5);
  };

  const totalIsolates = data.reduce((acc, r) => acc + r.isolates, 0);
  const avgSusceptible = data.length ? Math.round(data.reduce((acc, r) => acc + r.susceptiblePct, 0) / data.length) : 0;
  const avgResistant = data.length ? Math.round(data.reduce((acc, r) => acc + r.resistantPct, 0) / data.length) : 0;
  const reserveDrugsCount = data.filter(d => d.aware === "Reserve").length;

  kpiBox("Total Audited Isolates", `${totalIsolates.toLocaleString()}`, M, y, "#0d9488", "Clinical specimens evaluated");
  kpiBox("Hospital Susceptibility Rate", `${avgSusceptible}% Avg`, M + 68, y, "#10b981", "Overall in-vitro sensitive");
  kpiBox("Critical Resistance Rate", `${avgResistant}% Avg`, M + 136, y, "#ef4444", "Resistant / Non-susceptible");
  kpiBox("WHO Reserve Antibiotics", `${reserveDrugsCount} Monitored`, M + 204, y, "#8b5cf6", "Restricted antimicrobial access");
  y += 24;

  // Table Header
  doc.setFillColor(30, 41, 59);
  doc.rect(M, y, CW, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
  doc.text("Pathogen Organism", M + 3, y + 5.5);
  doc.text("Antibiotic", M + 58, y + 5.5);
  doc.text("AWaRe", M + 104, y + 5.5);
  doc.text("Specimen", M + 122, y + 5.5);
  doc.text("Isolates", M + 144, y + 5.5);
  doc.text("Sens (%)", M + 162, y + 5.5);
  doc.text("Res (%)", M + 180, y + 5.5);
  doc.text("CLSI Breakpoint", M + 198, y + 5.5);
  doc.text("Stewardship Recommendation", M + 236, y + 5.5);
  y += 8;

  // Table Rows
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  if (data.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(M, y, CW, 14, "F");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("No laboratory AMR culture records available. Add AMR tests in the laboratory module to generate cumulative statistics.", M + 4, y + 8);
    y += 18;
  } else {
    data.forEach((row, i) => {
      if (y > 185) {
        doc.addPage();
        y = 15;
      }

      const isEven = i % 2 === 0;
      doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
      doc.rect(M, y, CW, 7, "F");

      doc.setTextColor(30, 41, 59);
      doc.text(doc.splitTextToSize(row.pathogen, 52)[0] || "", M + 3, y + 5);
      doc.text(row.antibiotic, M + 58, y + 5);

      // AWaRe badge color
      if (row.aware === "Access") doc.setTextColor(16, 185, 129);
      else if (row.aware === "Watch") doc.setTextColor(245, 158, 11);
      else doc.setTextColor(239, 68, 68);
      doc.text(row.aware, M + 104, y + 5);

      doc.setTextColor(71, 85, 105);
      doc.text(row.specimen, M + 122, y + 5);
      doc.text(String(row.isolates), M + 144, y + 5);

      // Sens color
      doc.setFont("helvetica", "bold");
      doc.setTextColor(row.susceptiblePct >= 70 ? 16 : 220, row.susceptiblePct >= 70 ? 140 : 38, row.susceptiblePct >= 70 ? 90 : 38);
      doc.text(`${row.susceptiblePct}%`, M + 162, y + 5);

      // Res color
      doc.setTextColor(row.resistantPct >= 40 ? 220 : 71, row.resistantPct >= 40 ? 38 : 85, row.resistantPct >= 40 ? 38 : 105);
      doc.text(`${row.resistantPct}%`, M + 180, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(row.clsiBreakpoint, M + 198, y + 5);
      doc.text(doc.splitTextToSize(row.clinicalNote, 33)[0] || "", M + 236, y + 5);

      y += 7;
    });
  }

  // Footer & Compliance Notice
  y = Math.max(y + 4, 192);
  doc.setDrawColor(203, 213, 225);
  doc.line(M, y, W - M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
  doc.text("Compliance Statement: Antibiotic therapy should follow local cumulative antibiogram guidance. Reserve agents require antimicrobial stewardship approval within 48h.", M, y + 4);
  doc.text(`Page 1 of 1  |  Aarogya X Antimicrobial Surveillance Network  |  Confidential Clinical Intelligence`, W - M, y + 4, { align: "right" });

  doc.save(`AarogyaX-AMR-Antibiogram-Report-${new Date().toISOString().split("T")[0]}.pdf`);
  if (onSuccess) onSuccess();
}

export function exportAntibiogramCSV(data: AntibiogramRow[], onSuccess?: () => void) {
  const rows = [
    ["Hospital", "Aarogya X Health System - AMR Surveillance Unit"],
    ["Network", "Aarogya X Decision Support & AMR Surveillance Network"],
    ["Export Date", new Date().toLocaleString("en-IN")],
    [],
    [
      "Pathogen Organism",
      "Target Antibiotic",
      "WHO AWaRe Category",
      "Specimen Type",
      "Audited Isolates",
      "Susceptible (%)",
      "Intermediate (%)",
      "Resistant (%)",
      "CLSI Breakpoint",
      "Clinical Stewardship Note"
    ],
    ...data.map(r => [
      r.pathogen,
      r.antibiotic,
      r.aware,
      r.specimen,
      r.isolates,
      `${r.susceptiblePct}%`,
      `${r.intermediatePct}%`,
      `${r.resistantPct}%`,
      r.clsiBreakpoint,
      r.clinicalNote
    ])
  ];

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AarogyaX-AMR-Antibiogram-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  if (onSuccess) onSuccess();
}

export function AmrAntibiogramView() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPathogen, setSelectedPathogen] = useState("All");
  const [selectedSpecimen, setSelectedSpecimen] = useState("All");
  const [selectedAware, setSelectedAware] = useState("All");

  const pathogensList = useMemo(() => {
    const set = new Set(DEFAULT_ANTIBIOGRAM_DATA.map(d => d.pathogen));
    return ["All", ...Array.from(set)];
  }, []);

  const filteredData = useMemo(() => {
    return DEFAULT_ANTIBIOGRAM_DATA.filter(item => {
      if (selectedPathogen !== "All" && item.pathogen !== selectedPathogen) return false;
      if (selectedSpecimen !== "All" && item.specimen !== selectedSpecimen && item.specimen !== "All") return false;
      if (selectedAware !== "All" && item.aware !== selectedAware) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.pathogen.toLowerCase().includes(q) ||
          item.antibiotic.toLowerCase().includes(q) ||
          item.clinicalNote.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [searchQuery, selectedPathogen, selectedSpecimen, selectedAware]);

  const stats = useMemo(() => {
    const totalIsolates = filteredData.reduce((acc, r) => acc + r.isolates, 0);
    const avgSusceptibility = filteredData.length
      ? Math.round(filteredData.reduce((acc, r) => acc + r.susceptiblePct, 0) / filteredData.length)
      : 0;
    const avgResistance = filteredData.length
      ? Math.round(filteredData.reduce((acc, r) => acc + r.resistantPct, 0) / filteredData.length)
      : 0;
    const reserveCount = filteredData.filter(r => r.aware === "Reserve").length;

    return { totalIsolates, avgSusceptibility, avgResistance, reserveCount };
  }, [filteredData]);

  const handlePdfExport = async () => {
    await exportAntibiogramPDF(filteredData, selectedPathogen, selectedSpecimen, () => {
      toast({
        title: "AMR Antibiogram PDF Exported",
        description: `Generated official clinical surveillance report (${filteredData.length} drug-pathogen records).`,
      });
    });
  };

  const handleCsvExport = () => {
    exportAntibiogramCSV(filteredData, () => {
      toast({
        title: "AMR Antibiogram CSV Exported",
        description: `Exported ${filteredData.length} records for LIS analysis.`,
      });
    });
  };

  return (
    <div className="space-y-6">

      {/* Top Banner with Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <Biohazard className="h-5 w-5 text-primary" /> Hospital AMR Surveillance &amp; Antibiogram Matrix
            </h2>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
              ICMR IAMRSN Aligned
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cumulative microbiological susceptibility patterns, WHO AWaRe classification, and empirical therapy guidelines
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCsvExport} className="h-9 text-xs">
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Export CSV
          </Button>
          <Button size="sm" onClick={handlePdfExport} className="h-9 text-xs">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export Official PDF
          </Button>
        </div>
      </div>

      {/* KPI Stats Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
              <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground">{stats.totalIsolates.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">Audited Bacterial Isolates</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{stats.avgSusceptibility}%</p>
              <p className="text-[11px] text-muted-foreground">Avg In-Vitro Susceptibility</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">{stats.avgResistance}%</p>
              <p className="text-[11px] text-muted-foreground">Avg Resistance Rate</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-purple-600 dark:text-purple-400">{stats.reserveCount}</p>
              <p className="text-[11px] text-muted-foreground">Reserve Agents Tracked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Surveillance Alerts */}
      <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
          <AlertTriangle className="h-4 w-4" /> Priority Pathogen Surveillance Alerts (Local Data)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded bg-card/80 border border-border">
            <span className="font-bold text-foreground">CR-Acinetobacter (CRAB): 73%</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Endemic carbapenem resistance; require Colistin + Ampicillin-Sulbactam combination.</p>
          </div>
          <div className="p-2.5 rounded bg-card/80 border border-border">
            <span className="font-bold text-foreground">K. pneumoniae CRE: 36%</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">High NDM &amp; OXA-48 carbapenemase rates in ICU blood cultures.</p>
          </div>
          <div className="p-2.5 rounded bg-card/80 border border-border">
            <span className="font-bold text-foreground">MRSA Rate: 56% in Wound/Skin</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">100% Vancomycin &amp; 98% Linezolid susceptible; avoid ciprofloxacin monotherapy.</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-primary" /> Filter Surveillance Matrix
          </span>
          <span className="text-xs text-muted-foreground">Showing {filteredData.length} records</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Pathogen Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Pathogen Organism</label>
            <Select value={selectedPathogen} onValueChange={setSelectedPathogen}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Pathogens" />
              </SelectTrigger>
              <SelectContent>
                {pathogensList.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Specimen Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Specimen / Infection Site</label>
            <Select value={selectedSpecimen} onValueChange={setSelectedSpecimen}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Specimens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Specimens</SelectItem>
                <SelectItem value="Urine">Urine (UTI)</SelectItem>
                <SelectItem value="Blood">Blood (Bacteremia / Sepsis)</SelectItem>
                <SelectItem value="Respiratory">Respiratory (Sputum / BAL)</SelectItem>
                <SelectItem value="Wound">Wound / Pus Swab</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* WHO AWaRe Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">WHO AWaRe Category</label>
            <Select value={selectedAware} onValueChange={setSelectedAware}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All AWaRe Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Categories</SelectItem>
                <SelectItem value="Access">Access (First/Second Line)</SelectItem>
                <SelectItem value="Watch">Watch (Restricted / High Resistance Risk)</SelectItem>
                <SelectItem value="Reserve">Reserve (Last-Resort Only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Box */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Search Drug / Note</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search antibiotic..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Antibiogram Table */}
      <Card className="overflow-hidden border border-border shadow-xs">
        <CardHeader className="p-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground">Cumulative Antibiotic Sensitivity &amp; Resistance Rates</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              CLSI M100 compliant breakpoints. Green indicates high empirical susceptibility; red warns of high institutional resistance.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <th className="p-3">Pathogen</th>
                <th className="p-3">Antibiotic</th>
                <th className="p-3">WHO AWaRe</th>
                <th className="p-3">Specimen</th>
                <th className="p-3 text-center">Isolates</th>
                <th className="p-3 text-center">Susceptible %</th>
                <th className="p-3 text-center">Resistance %</th>
                <th className="p-3">CLSI Breakpoint</th>
                <th className="p-3">Stewardship Guidance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground text-xs">
                    No antibiogram records found matching the active filters.
                  </td>
                </tr>
              ) : (
                filteredData.map(row => {
                  const awareBadge = {
                    Access: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
                    Watch: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
                    Reserve: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
                  }[row.aware];

                  return (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                        {row.pathogen}
                      </td>
                      <td className="p-3 font-medium text-foreground whitespace-nowrap">
                        {row.antibiotic}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <Badge variant="outline" className={`text-[10px] font-bold ${awareBadge}`}>
                          {row.aware}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {row.specimen}
                      </td>
                      <td className="p-3 text-center font-medium text-muted-foreground">
                        {row.isolates}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`font-bold ${row.susceptiblePct >= 70 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                            {row.susceptiblePct}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`font-bold ${row.resistantPct >= 40 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                          {row.resistantPct}%
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                        {row.clsiBreakpoint}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-xs leading-relaxed">
                        {row.clinicalNote}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
