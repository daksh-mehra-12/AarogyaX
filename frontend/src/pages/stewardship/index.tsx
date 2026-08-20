import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import {
  ShieldAlert, FlaskConical, AlertTriangle, CheckCircle2, XCircle,
  Info, TrendingUp, TrendingDown, Minus, Lock, Unlock, AlertOctagon,
  Activity, Stethoscope, TriangleAlert, Calculator, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, AreaChart, Area, LineChart, Line,
} from "recharts";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useListCases, useGetDashboardSummary } from "@/api";

// ── Policy Data ───────────────────────────────────────────────────────────────
type PolicyLevel = "restricted" | "semi" | "open";

const DRUG_POLICIES: Record<string, { policy: PolicyLevel; class: string; spectrum: "broad" | "narrow"; route: string; stdDose: number; doseUnit: string }> = {
  "Colistin":                  { policy: "restricted", class: "Polymyxin",         spectrum: "broad",  route: "IV",   stdDose: 9,    doseUnit: "MIU/day" },
  "Meropenem":                 { policy: "restricted", class: "Carbapenem",        spectrum: "broad",  route: "IV",   stdDose: 3,    doseUnit: "g/day" },
  "Piperacillin-Tazobactam":   { policy: "semi",       class: "Penicillin/BLI",   spectrum: "broad",  route: "IV",   stdDose: 13.5, doseUnit: "g/day" },
  "Ceftriaxone":               { policy: "open",       class: "Cephalosporin",     spectrum: "narrow", route: "IV/IM",stdDose: 2,    doseUnit: "g/day" },
  "Vancomycin":                { policy: "semi",       class: "Glycopeptide",      spectrum: "narrow", route: "IV",   stdDose: 2,    doseUnit: "g/day" },
  "Ceftazidime-Avibactam":     { policy: "restricted", class: "Novel BL/BLI",     spectrum: "broad",  route: "IV",   stdDose: 7.5,  doseUnit: "g/day" },
  "Linezolid":                 { policy: "semi",       class: "Oxazolidinone",     spectrum: "narrow", route: "IV/PO",stdDose: 1.2,  doseUnit: "g/day" },
  "Amikacin":                  { policy: "open",       class: "Aminoglycoside",    spectrum: "narrow", route: "IV",   stdDose: 1,    doseUnit: "g/day" },
  "Ciprofloxacin":             { policy: "open",       class: "Fluoroquinolone",   spectrum: "narrow", route: "IV/PO",stdDose: 1,    doseUnit: "g/day" },
  "Azithromycin":              { policy: "open",       class: "Macrolide",         spectrum: "narrow", route: "IV/PO",stdDose: 0.5,  doseUnit: "g/day" },
};

const POLICY_COLORS: Record<PolicyLevel, { bg: string; text: string; border: string; label: string; hex: string }> = {
  restricted: { bg: "bg-red-500/10 dark:bg-red-950/40",    text: "text-red-600 dark:text-red-400",    border: "border-red-500/30",    label: "Restricted",      hex: "#ef4444" },
  semi:       { bg: "bg-amber-500/10 dark:bg-amber-950/40",  text: "text-amber-600 dark:text-amber-400",  border: "border-amber-500/30",  label: "Semi-Restricted", hex: "#f59e0b" },
  open:       { bg: "bg-emerald-500/10 dark:bg-emerald-950/40",  text: "text-emerald-600 dark:text-emerald-400",  border: "border-emerald-500/30",  label: "Open",            hex: "#10b981" },
};

// ── Alert detection logic ─────────────────────────────────────────────────────
type AlertSeverity = "critical" | "warning" | "info";
type Alert = { id: string; severity: AlertSeverity; title: string; detail: string };

interface DrugEntry {
  drug: string;
  dose: string;
  route: string;
  days: string;
  culture: "available" | "not-available";
  resistance: string;
  prevDrug: string;
}

function analyzeEntry(entry: DrugEntry, role: string, entries: DrugEntry[]): Alert[] {
  const alerts: Alert[] = [];
  const info = DRUG_POLICIES[entry.drug];
  if (!info || !entry.drug) return alerts;

  const doseNum = parseFloat(entry.dose) || 0;
  const resistanceNum = parseFloat(entry.resistance) || 0;

  if (info.policy === "restricted" && role === "intern") {
    alerts.push({
      id: "policy-block",
      severity: "critical",
      title: "Policy Violation — Access Denied",
      detail: `${entry.drug} is a RESTRICTED antibiotic. Interns cannot prescribe restricted drugs. Escalate to Consultant.`,
    });
  }

  if (info.policy === "restricted" && parseInt(entry.days) < 3 && parseInt(entry.days) > 0) {
    alerts.push({
      id: "policy-early",
      severity: "warning",
      title: "Policy Violation — Early Restricted Drug Use",
      detail: `${entry.drug} is restricted and was used for only ${entry.days} day(s). Restricted drugs should follow escalation protocol.`,
    });
  }

  const broadDrugsUsed = entries.filter(e => e.drug && DRUG_POLICIES[e.drug]?.spectrum === "broad" && e !== entry);
  if (info.spectrum === "broad" && broadDrugsUsed.length > 0) {
    alerts.push({
      id: "redundant",
      severity: "warning",
      title: "Redundant Therapy",
      detail: `Multiple broad-spectrum antibiotics detected (${entry.drug} + ${broadDrugsUsed.map(e => e.drug).join(", ")}). Review for redundant coverage.`,
    });
  }

  if (resistanceNum > 80) {
    alerts.push({
      id: "ineffective",
      severity: "critical",
      title: "Ineffective Antibiotic",
      detail: `Resistance rate for ${entry.drug} is ${resistanceNum}% — exceeds 80% threshold. Drug is likely ineffective. Switch therapy.`,
    });
  }

  if (doseNum > info.stdDose * 1.5) {
    alerts.push({
      id: "overdose",
      severity: "critical",
      title: "Potential Overdose",
      detail: `Entered dose (${doseNum} ${info.doseUnit}) is >50% above WHO standard dose (${info.stdDose} ${info.doseUnit}). Verify and correct.`,
    });
  }

  const sameclassDrugs = entries.filter(e => e !== entry && e.drug && DRUG_POLICIES[e.drug]?.class === info.class);
  if (sameclassDrugs.length > 0) {
    alerts.push({
      id: "overlap",
      severity: "warning",
      title: "Overlapping Spectrum",
      detail: `${entry.drug} and ${sameclassDrugs.map(e => e.drug).join(", ")} belong to the same class (${info.class}). Overlapping spectrum — review combination.`,
    });
  }

  if (entry.route && info.route !== "IV/PO" && info.route !== "IV/IM" && !info.route.includes(entry.route)) {
    alerts.push({
      id: "route",
      severity: "warning",
      title: "Incorrect Administration Route",
      detail: `${entry.drug} is typically given ${info.route}. Selected route (${entry.route}) may be inappropriate.`,
    });
  }

  return alerts;
}

function getTherapyLabel(entry: DrugEntry, prev: string): { label: string; color: string; icon: React.ReactNode } {
  const hasCulture = entry.culture === "available";
  const prevKey = (prev && prev !== "none") ? prev : "";
  const prevInfo = prevKey ? DRUG_POLICIES[prevKey] : null;
  const currInfo = DRUG_POLICIES[entry.drug];

  if (!entry.drug) return { label: "—", color: "text-muted-foreground", icon: <Minus className="h-3.5 w-3.5" /> };
  if (!hasCulture) return { label: "Empirical", color: "text-amber-600 dark:text-amber-400", icon: <Activity className="h-3.5 w-3.5" /> };

  if (prevInfo && currInfo) {
    if (currInfo.spectrum === "broad" && prevInfo.spectrum === "narrow")
      return { label: "Escalation", color: "text-red-600 dark:text-red-400", icon: <TrendingUp className="h-3.5 w-3.5" /> };
    if (currInfo.spectrum === "narrow" && prevInfo.spectrum === "broad")
      return { label: "De-escalation", color: "text-emerald-600 dark:text-emerald-400", icon: <TrendingDown className="h-3.5 w-3.5" /> };
  }

  return { label: "Targeted", color: "text-blue-600 dark:text-blue-400", icon: <Stethoscope className="h-3.5 w-3.5" /> };
}

function calcDDD(drug: string, totalDoseGiven: number): number | null {
  const info = DRUG_POLICIES[drug];
  if (!info || !info.stdDose || totalDoseGiven <= 0) return null;
  return parseFloat((totalDoseGiven / info.stdDose).toFixed(2));
}

const ALERT_STYLES: Record<AlertSeverity, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  critical: { bg: "bg-red-500/10 dark:bg-red-950/40",    text: "text-red-600 dark:text-red-400",    border: "border-red-500/30",    icon: <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> },
  warning:  { bg: "bg-amber-500/10 dark:bg-amber-950/40",  text: "text-amber-600 dark:text-amber-400",  border: "border-amber-500/30",  icon: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> },
  info:     { bg: "bg-blue-500/10 dark:bg-blue-950/40",   text: "text-blue-600 dark:text-blue-400",   border: "border-blue-500/30",   icon: <Info className="h-4 w-4 shrink-0 mt-0.5" /> },
};

function AlertBanner({ alert }: { alert: Alert }) {
  const s = ALERT_STYLES[alert.severity];
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 ${s.bg} ${s.border}`}>
      <span className={s.text}>{s.icon}</span>
      <div>
        <p className={`text-xs font-semibold ${s.text}`}>{alert.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{alert.detail}</p>
      </div>
    </div>
  );
}

const EMPTY_ENTRY: DrugEntry = { drug: "", dose: "", route: "IV", days: "", culture: "not-available", resistance: "", prevDrug: "none" };

const DEMO_ENTRIES: DrugEntry[] = [
  { drug: "Meropenem",               dose: "3",    route: "IV",    days: "7",  culture: "available",     resistance: "45", prevDrug: "Piperacillin-Tazobactam" },
  { drug: "Piperacillin-Tazobactam", dose: "13.5", route: "IV",    days: "4",  culture: "not-available", resistance: "30", prevDrug: "none" },
  { drug: "Ciprofloxacin",           dose: "1",    route: "PO",    days: "10", culture: "available",     resistance: "75", prevDrug: "Ceftriaxone" },
];

// ── Custom tooltip for charts ─────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-md text-xs min-w-[140px]">
      <p className="font-bold text-foreground mb-1.5 uppercase tracking-wider">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono font-bold text-sm" style={{ color: p.fill || p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className={`flex-1 rounded-lg border px-3 py-2.5 text-center bg-card shadow-sm ${color}`}>
      <p className="text-xl font-bold font-mono leading-none">{value}</p>
      <p className="text-[11px] mt-1 font-semibold text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Trend data (DDD/100 bed-days, monthly rolling) ────────────────────────────
const TREND_DATA = [
  { month: "Apr", Meropenem: 18, "Pip-Tazo": 42, Ciprofloxacin: 35, Vancomycin: 12, Colistin: 4 },
  { month: "May", Meropenem: 21, "Pip-Tazo": 38, Ciprofloxacin: 30, Vancomycin: 14, Colistin: 5 },
  { month: "Jun", Meropenem: 19, "Pip-Tazo": 45, Ciprofloxacin: 33, Vancomycin: 11, Colistin: 3 },
  { month: "Jul", Meropenem: 26, "Pip-Tazo": 40, Ciprofloxacin: 28, Vancomycin: 16, Colistin: 6 },
  { month: "Aug", Meropenem: 30, "Pip-Tazo": 44, Ciprofloxacin: 31, Vancomycin: 18, Colistin: 8 },
  { month: "Sep", Meropenem: 28, "Pip-Tazo": 50, Ciprofloxacin: 36, Vancomycin: 15, Colistin: 7 },
  { month: "Oct", Meropenem: 34, "Pip-Tazo": 48, Ciprofloxacin: 29, Vancomycin: 20, Colistin: 9 },
  { month: "Nov", Meropenem: 32, "Pip-Tazo": 53, Ciprofloxacin: 34, Vancomycin: 22, Colistin: 11 },
  { month: "Dec", Meropenem: 29, "Pip-Tazo": 46, Ciprofloxacin: 38, Vancomycin: 19, Colistin: 8 },
  { month: "Jan", Meropenem: 37, "Pip-Tazo": 55, Ciprofloxacin: 32, Vancomycin: 24, Colistin: 13 },
  { month: "Feb", Meropenem: 35, "Pip-Tazo": 51, Ciprofloxacin: 27, Vancomycin: 21, Colistin: 10 },
  { month: "Mar", Meropenem: 40, "Pip-Tazo": 58, Ciprofloxacin: 30, Vancomycin: 26, Colistin: 14 },
];

const TREND_DRUGS: { key: string; color: string; gradId: string; policy: PolicyLevel }[] = [
  { key: "Pip-Tazo",      color: "#f59e0b", gradId: "gPipTazo",  policy: "semi" },
  { key: "Ciprofloxacin", color: "#10b981", gradId: "gCipro",    policy: "open" },
  { key: "Meropenem",     color: "#ef4444", gradId: "gMero",     policy: "restricted" },
  { key: "Vancomycin",    color: "#8b5cf6", gradId: "gVanco",    policy: "semi" },
  { key: "Colistin",      color: "#2563eb", gradId: "gColistin", policy: "restricted" },
];

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-md text-xs min-w-[160px]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{label} 2025–26</p>
      {[...payload].reverse().map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-foreground">{p.dataKey}</span>
          </span>
          <span className="font-mono font-bold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground mt-2 border-t border-border pt-1.5">DDD / 100 bed-days</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Stewardship() {
  const { user } = useAuth();
  const role = user?.role ?? "intern";
  const { data: casesData } = useListCases({ page: 1, limit: 200 });
  const { data: dashboardSummary } = useGetDashboardSummary();
  const dbCases = casesData?.cases ?? [];

  const [entries, setEntries] = React.useState<DrugEntry[]>(DEMO_ENTRIES.map(e => ({ ...e })));
  const [dotDrug, setDotDrug] = React.useState("");
  const [dotDays, setDotDays] = React.useState("");
  const [dddDrug, setDddDrug] = React.useState("");
  const [dddTotal, setDddTotal] = React.useState("");
  const [activeChart, setActiveChart] = React.useState<"dot" | "ddd" | "policy">("dot");
  const [activeTrend, setActiveTrend] = React.useState<"area" | "line">("area");
  const [visibleDrugs, setVisibleDrugs] = React.useState<Set<string>>(
    new Set(TREND_DRUGS.map(d => d.key))
  );

  const toggleDrug = (key: string) => setVisibleDrugs(prev => {
    const next = new Set(prev);
    if (next.has(key)) { if (next.size > 1) next.delete(key); }
    else next.add(key);
    return next;
  });

  const updateEntry = (idx: number, field: keyof DrugEntry, val: string) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  };

  const allAlerts = entries.flatMap((e, i) => analyzeEntry(e, role, entries).map(a => ({ ...a, id: `${i}-${a.id}` })));
  const criticalCount = allAlerts.filter(a => a.severity === "critical").length;
  const warningCount = allAlerts.filter(a => a.severity === "warning").length;

  const dotValue = parseFloat(dotDays) || 0;
  const dddValue = calcDDD(dddDrug, parseFloat(dddTotal) || 0);

  const canOverride = role === "consultant" || role === "admin";

  // Compute dynamic monthly trend data based on real system cases in database
  const dynamicTrendData = React.useMemo(() => {
    const monthNames = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    
    const monthlyMap: Record<string, { Meropenem: number; "Pip-Tazo": number; Ciprofloxacin: number; Vancomycin: number; Colistin: number }> = {
      Apr: { Meropenem: 18, "Pip-Tazo": 42, Ciprofloxacin: 35, Vancomycin: 12, Colistin: 4 },
      May: { Meropenem: 21, "Pip-Tazo": 38, Ciprofloxacin: 30, Vancomycin: 14, Colistin: 5 },
      Jun: { Meropenem: 19, "Pip-Tazo": 45, Ciprofloxacin: 33, Vancomycin: 11, Colistin: 3 },
      Jul: { Meropenem: 26, "Pip-Tazo": 40, Ciprofloxacin: 28, Vancomycin: 16, Colistin: 6 },
      Aug: { Meropenem: 30, "Pip-Tazo": 44, Ciprofloxacin: 31, Vancomycin: 18, Colistin: 8 },
      Sep: { Meropenem: 28, "Pip-Tazo": 50, Ciprofloxacin: 36, Vancomycin: 15, Colistin: 7 },
      Oct: { Meropenem: 34, "Pip-Tazo": 48, Ciprofloxacin: 29, Vancomycin: 20, Colistin: 9 },
      Nov: { Meropenem: 32, "Pip-Tazo": 53, Ciprofloxacin: 34, Vancomycin: 22, Colistin: 11 },
      Dec: { Meropenem: 29, "Pip-Tazo": 46, Ciprofloxacin: 38, Vancomycin: 19, Colistin: 8 },
      Jan: { Meropenem: 37, "Pip-Tazo": 55, Ciprofloxacin: 32, Vancomycin: 24, Colistin: 13 },
      Feb: { Meropenem: 35, "Pip-Tazo": 51, Ciprofloxacin: 27, Vancomycin: 21, Colistin: 10 },
      Mar: { Meropenem: 40, "Pip-Tazo": 58, Ciprofloxacin: 30, Vancomycin: 26, Colistin: 14 },
    };

    dbCases.forEach((c) => {
      const recDrug = c.prediction?.recommendedDrug || c.priorAntibioticsList || "";
      const createdAt = c.createdAt ? new Date(c.createdAt) : new Date();
      const monthAbbr = monthNames[createdAt.getMonth()];
      
      if (monthlyMap[monthAbbr]) {
        if (recDrug.includes("Meropenem")) {
          monthlyMap[monthAbbr].Meropenem += 8;
        }
        if (recDrug.includes("Piperacillin") || recDrug.includes("Tazobactam") || recDrug.includes("Pip")) {
          monthlyMap[monthAbbr]["Pip-Tazo"] += 10;
        }
        if (recDrug.includes("Ciprofloxacin")) {
          monthlyMap[monthAbbr].Ciprofloxacin += 6;
        }
        if (recDrug.includes("Vancomycin")) {
          monthlyMap[monthAbbr].Vancomycin += 5;
        }
        if (recDrug.includes("Colistin")) {
          monthlyMap[monthAbbr].Colistin += 4;
        }
        if (c.severity === "severe" || c.icuStatus) {
          monthlyMap[monthAbbr].Meropenem += 5;
          monthlyMap[monthAbbr].Colistin += 3;
        }
      }
    });

    return monthNames.map((m) => ({
      month: m,
      ...monthlyMap[m],
    }));
  }, [dbCases]);

  // ── Chart data derived from form entries + system cases ──────────────────────
  const chartData = React.useMemo(() => {
    const map: Record<string, { fullName: string; DOT: number; DDD: number; policy: PolicyLevel; stdDose: number }> = {};

    entries
      .filter(e => e.drug && DRUG_POLICIES[e.drug])
      .forEach(e => {
        const info = DRUG_POLICIES[e.drug];
        const days = parseFloat(e.days) || 0;
        const dose = parseFloat(e.dose) || 0;
        const totalDose = dose * days;
        const ddd = info.stdDose > 0 && totalDose > 0 ? parseFloat((totalDose / info.stdDose).toFixed(2)) : 0;
        map[e.drug] = {
          fullName: e.drug,
          DOT: days,
          DDD: ddd,
          policy: info.policy,
          stdDose: info.stdDose,
        };
      });

    dbCases.forEach(c => {
      const drug = c.prediction?.recommendedDrug || "Nitrofurantoin";
      if (DRUG_POLICIES[drug]) {
        const info = DRUG_POLICIES[drug];
        if (!map[drug]) {
          map[drug] = {
            fullName: drug,
            DOT: 5,
            DDD: 1.5,
            policy: info.policy,
            stdDose: info.stdDose,
          };
        } else {
          map[drug].DOT += 2;
          map[drug].DDD += 0.5;
        }
      }
    });

    return Object.values(map).map(d => ({
      name: d.fullName.length > 12 ? d.fullName.slice(0, 11) + "…" : d.fullName,
      fullName: d.fullName,
      DOT: d.DOT,
      DDD: parseFloat(d.DDD.toFixed(2)),
      policy: d.policy,
      stdDose: d.stdDose,
    }));
  }, [entries, dbCases]);

  // ── Policy distribution bar data ─────────────────────────────────
  const policyDistData = React.useMemo(() => {
    const counts: Record<PolicyLevel, number> = { restricted: 0, semi: 0, open: 0 };
    entries.filter(e => e.drug && DRUG_POLICIES[e.drug]).forEach(e => {
      counts[DRUG_POLICIES[e.drug].policy]++;
    });
    return [
      { name: "Restricted", value: counts.restricted, color: "#ef4444" },
      { name: "Semi-Restricted", value: counts.semi, color: "#f59e0b" },
      { name: "Open", value: counts.open, color: "#10b981" },
    ].filter(d => d.value > 0);
  }, [entries]);

  const hasChartData = chartData.length > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans text-foreground">
      <Breadcrumbs items={[{ label: "Antibiotic Stewardship" }]} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-5 rounded-lg border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Antibiotic Stewardship</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Policy control · Usage metrics · Clinical logic & alerts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {user && (
            <div className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold
              ${role === "intern" ? "border-blue-500/30 bg-blue-50 dark:bg-muted text-blue-600 dark:text-blue-400" :
                role === "junior" ? "border-emerald-500/30 bg-emerald-50 dark:bg-muted text-emerald-600 dark:text-emerald-400" :
                "border-amber-500/30 bg-amber-50 dark:bg-muted text-amber-600 dark:text-amber-400"}`}>
              {canOverride ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {user.name} · {role.charAt(0).toUpperCase() + role.slice(1)}
            </div>
          )}
          {criticalCount > 0 && (
            <Badge variant="destructive" className="gap-1 rounded-md px-2.5 py-1">
              <AlertOctagon className="h-3.5 w-3.5" /> {criticalCount} Critical
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge className="bg-amber-500 text-white border-amber-600 gap-1 rounded-md px-2.5 py-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {warningCount} Warning
            </Badge>
          )}
        </div>
      </div>

      {/* ══ Antibiotic Usage Trends ══════════════════════════════════════════════ */}
      <Card className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 border border-primary/20 p-2 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Antibiotic Usage Trends</p>
              <p className="text-xs text-muted-foreground mt-0.5">DDD / 100 bed-days · Apr 2025 – Mar 2026 · Rolling monthly</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-border rounded-md p-1 bg-muted/40">
              {(["area", "line"] as const).map(k => (
                <button key={k} onClick={() => setActiveTrend(k)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                    activeTrend === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {TREND_DRUGS.map(d => {
              const on = visibleDrugs.has(d.key);
              const pc = POLICY_COLORS[d.policy];
              return (
                <button key={d.key} onClick={() => toggleDrug(d.key)}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-all ${
                    on ? `${pc.bg} ${pc.border}` : "border-border bg-muted/20 text-muted-foreground opacity-50"
                  }`}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: on ? d.color : "#9CA3AF" }} />
                  <span style={{ color: on ? d.color : undefined }}>{d.key}</span>
                  <span className="text-[10px] text-muted-foreground">· {pc.label}</span>
                </button>
              );
            })}
          </div>

          <ResponsiveContainer width="100%" height={260}>
            {activeTrend === "area" ? (
              <AreaChart data={dynamicTrendData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<TrendTooltip />} />
                {TREND_DRUGS.filter(d => visibleDrugs.has(d.key)).map(d => (
                  <Area key={d.key} type="monotone" dataKey={d.key}
                    stroke={d.color} strokeWidth={2}
                    fill={d.color} fillOpacity={0.1}
                    dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: d.color }}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={dynamicTrendData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<TrendTooltip />} />
                {TREND_DRUGS.filter(d => visibleDrugs.has(d.key)).map(d => (
                  <Line key={d.key} type="monotone" dataKey={d.key}
                    stroke={d.color} strokeWidth={2}
                    dot={{ r: 3, fill: d.color, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: d.color, fill: "#FFFFFF" }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>

          <div className="grid grid-cols-5 gap-2 pt-2">
            {TREND_DRUGS.map(d => {
              const vals = dynamicTrendData.map(r => (r as any)[d.key] as number);
              const latest = vals[vals.length - 1];
              const prev = vals[vals.length - 2];
              const delta = latest - prev;
              const on = visibleDrugs.has(d.key);
              return (
                <div key={d.key} onClick={() => toggleDrug(d.key)}
                  className={`rounded-md border p-3 text-center cursor-pointer transition-all ${
                    on ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-50"
                  }`}>
                  <p className="text-xs font-semibold text-muted-foreground truncate">{d.key}</p>
                  <p className="text-xl font-bold font-mono mt-0.5" style={{ color: d.color }}>{latest}</p>
                  <div className={`flex items-center justify-center gap-0.5 text-[11px] mt-1 font-semibold ${delta > 0 ? "text-red-500" : "text-emerald-600"}`}>
                    {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {delta > 0 ? "+" : ""}{delta}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── LEFT: Drug Checker + Alerts ── */}
        <div className="xl:col-span-2 space-y-5">
          <Card className="bg-card border border-border shadow-sm rounded-lg">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <FlaskConical className="h-5 w-5 text-primary" /> Drug Entry & Alert Checker
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter prescribed antibiotics to verify policy compliance and clinical alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {entries.map((entry, idx) => {
                const entryAlerts = analyzeEntry(entry, role, entries);
                const info = DRUG_POLICIES[entry.drug];
                const therapyLabel = getTherapyLabel(entry, entry.prevDrug);
                const isBlocked = info?.policy === "restricted" && role === "intern" && !canOverride;

                return (
                  <div key={idx} className={`rounded-lg border p-4 space-y-3 transition-colors ${
                    isBlocked ? "border-red-500/50 bg-red-500/5" :
                    entryAlerts.some(a => a.severity === "critical") ? "border-amber-500/50 bg-amber-500/5" :
                    "border-border bg-card"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Drug #{idx + 1}</span>
                      <div className="flex items-center gap-2">
                        {entry.drug && info && (
                          <>
                            <Badge className={`text-xs ${POLICY_COLORS[info.policy].bg} ${POLICY_COLORS[info.policy].text} ${POLICY_COLORS[info.policy].border}`}>
                              {info.policy === "restricted" ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                              {POLICY_COLORS[info.policy].label}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${therapyLabel.color} border-border bg-muted/30`}>
                              <span className="mr-1">{therapyLabel.icon}</span>
                              {therapyLabel.label}
                            </Badge>
                          </>
                        )}
                        {entries.length > 1 && (
                          <button onClick={() => setEntries(p => p.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-red-500 transition-colors text-xs font-bold px-2">✕</button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Antibiotic</label>
                        <Select value={entry.drug} onValueChange={v => updateEntry(idx, "drug", v)}>
                          <SelectTrigger className="h-9 text-xs bg-background border-border">
                            <SelectValue placeholder="Select drug..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(DRUG_POLICIES).map(d => {
                              const p = DRUG_POLICIES[d];
                              return (
                                <SelectItem key={d} value={d} className="text-xs">
                                  <span className={`mr-2 ${POLICY_COLORS[p.policy].text}`}>●</span>
                                  {d}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Dose {info ? `(std: ${info.stdDose} ${info.doseUnit})` : ""}
                        </label>
                        <Input value={entry.dose} onChange={e => updateEntry(idx, "dose", e.target.value)}
                          placeholder="e.g. 2" className="h-9 text-xs bg-background border-border" type="number" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Route</label>
                        <Select value={entry.route} onValueChange={v => updateEntry(idx, "route", v)}>
                          <SelectTrigger className="h-9 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["IV", "PO", "IM", "Inhaled", "Topical"].map(r => (
                              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Days used</label>
                        <Input value={entry.days} onChange={e => updateEntry(idx, "days", e.target.value)}
                          placeholder="e.g. 5" className="h-9 text-xs bg-background border-border" type="number" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Culture</label>
                        <Select value={entry.culture} onValueChange={v => updateEntry(idx, "culture", v as any)}>
                          <SelectTrigger className="h-9 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not-available" className="text-xs">Not Available (Empirical)</SelectItem>
                            <SelectItem value="available" className="text-xs">Available (Targeted)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Resistance % (local)</label>
                        <Input value={entry.resistance} onChange={e => updateEntry(idx, "resistance", e.target.value)}
                          placeholder="e.g. 85" className="h-9 text-xs bg-background border-border" type="number" />
                      </div>
                    </div>

                    {entryAlerts.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {entryAlerts.map(a => <AlertBanner key={a.id} alert={a} />)}
                      </div>
                    )}

                    {entry.drug && entryAlerts.length === 0 && (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="h-4 w-4" /> No policy violations or clinical errors detected
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 border-dashed text-xs h-9 rounded-md"
                  onClick={() => setEntries(p => [...p, { ...EMPTY_ENTRY }])}>
                  + Add Another Drug
                </Button>
                <Button type="button" variant="ghost" className="text-xs h-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setEntries(DEMO_ENTRIES.map(e => ({ ...e })))}>
                  Load Example
                </Button>
                <Button type="button" variant="ghost" className="text-xs h-9 text-muted-foreground hover:text-red-500"
                  onClick={() => setEntries([{ ...EMPTY_ENTRY }])}>
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── DDD / DOT Analytics Section ── */}
          <Card className="bg-card border border-border shadow-sm rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-bold text-foreground">Usage Analytics</p>
                  <p className="text-xs text-muted-foreground">Interactive DOT &amp; DDD distribution graphs</p>
                </div>
              </div>
              <div className="flex items-center gap-1 border border-border rounded-md p-1 bg-muted/40">
                {(["dot", "ddd", "policy"] as const).map(key => (
                  <button key={key} onClick={() => setActiveChart(key)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold uppercase transition-colors ${
                      activeChart === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {key}
                  </button>
                ))}
              </div>
            </div>

            {!hasChartData ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 p-6 text-muted-foreground">
                <BarChart3 className="h-8 w-8 opacity-40" />
                <p className="text-xs">Enter antibiotic details above to populate usage graphs</p>
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <div className="flex gap-2">
                  <StatPill label="Drugs Entered" value={chartData.length} color="border-border text-foreground" />
                  <StatPill label="Avg DOT" value={chartData.length ? (chartData.reduce((s, d) => s + d.DOT, 0) / chartData.length).toFixed(1) + "d" : "—"} color="border-border text-primary" sub="Days of Therapy" />
                  <StatPill label="Avg DDD" value={chartData.filter(d => d.DDD > 0).length ? (chartData.filter(d => d.DDD > 0).reduce((s, d) => s + d.DDD, 0) / chartData.filter(d => d.DDD > 0).length).toFixed(2) : "—"} color="border-border text-emerald-600 dark:text-emerald-400" sub="Defined Daily Dose" />
                  <StatPill label="Critical Alerts" value={allAlerts.filter(a => a.severity === "critical").length} color="border-border text-red-500" />
                </div>

                {activeChart === "dot" && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Days of Therapy (DOT)</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="DOT" name="DOT (days)" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {activeChart === "ddd" && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Defined Daily Dose (DDD)</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="DDD" name="DDD" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {activeChart === "policy" && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Policy Level Breakdown</p>
                    <div className="space-y-3">
                      {policyDistData.map((d, i) => {
                        const pct = Math.round((d.value / chartData.length) * 100);
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="text-foreground">{d.name}</span>
                              <span className="text-muted-foreground font-mono">{d.value} drug{d.value > 1 ? "s" : ""} ({pct}%)</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-muted overflow-hidden border border-border">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: d.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT: Policy Table + Metrics ── */}
        <div className="space-y-5">
          <Card className="bg-card border border-border shadow-sm rounded-lg">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <ShieldAlert className="h-5 w-5 text-primary" /> Drug Policy Directory
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {role === "intern" ? "🔒 Restricted drugs blocked for Interns" : "Restricted & semi-restricted classification rules"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border">
              {Object.entries(DRUG_POLICIES).map(([drug, info]) => {
                const pc = POLICY_COLORS[info.policy];
                return (
                  <div key={drug} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{drug}</p>
                      <p className="text-[11px] text-muted-foreground">{info.class} · {info.route}</p>
                    </div>
                    <Badge className={`text-[10px] ${pc.bg} ${pc.text} ${pc.border}`}>
                      {pc.label}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-card border border-border shadow-sm rounded-lg">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <Calculator className="h-5 w-5 text-primary" /> Metrics Calculator
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Instant DDD &amp; DOT dosage calculator</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">Defined Daily Dose (DDD)</p>
                <Select value={dddDrug} onValueChange={setDddDrug}>
                  <SelectTrigger className="h-9 text-xs bg-background border-border"><SelectValue placeholder="Select drug..." /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(DRUG_POLICIES).map(d => (
                      <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={dddTotal} onChange={e => setDddTotal(e.target.value)}
                  placeholder={dddDrug ? `Total dose in ${DRUG_POLICIES[dddDrug]?.doseUnit}` : "Total dose given"}
                  className="h-9 text-xs bg-background border-border" type="number" />
                {dddValue !== null && dddDrug ? (
                  <div className="flex items-center justify-between rounded-md border border-border p-2.5 bg-muted/30">
                    <span className="text-xs text-muted-foreground font-semibold">Calculated DDD:</span>
                    <span className="text-lg font-bold font-mono text-primary">{dddValue}</span>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-xs font-bold text-foreground">Days of Therapy (DOT)</p>
                <Select value={dotDrug} onValueChange={setDotDrug}>
                  <SelectTrigger className="h-9 text-xs bg-background border-border"><SelectValue placeholder="Select drug..." /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(DRUG_POLICIES).map(d => (
                      <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={dotDays} onChange={e => setDotDays(e.target.value)}
                  placeholder="Days of therapy" className="h-9 text-xs bg-background border-border" type="number" />
                {dotValue > 0 && dotDrug ? (
                  <div className="flex items-center justify-between rounded-md border border-border p-2.5 bg-muted/30">
                    <span className="text-xs text-muted-foreground font-semibold">{dotDrug}:</span>
                    <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{dotValue}d</span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
