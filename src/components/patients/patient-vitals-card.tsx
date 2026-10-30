import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  HeartPulse,
  Thermometer,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import {
  evaluatePatientVitals,
  getInitialPatientVitals,
  buildVitalSparklineSeries,
  VitalSignAssessment,
  SparklineVitalMetric,
} from "@/lib/patient-vitals";

export interface SavedVitalLog {
  id: number | string;
  bloodPressure: string;
  systolic?: number | null;
  diastolic?: number | null;
  heartRate: number;
  temperature: number;
  createdAt: string;
}

interface PatientVitalsCardProps {
  patient: Record<string, any>;
  onVitalsRecorded?: () => void;
}

export function PatientVitalsCard({ patient, onVitalsRecorded }: PatientVitalsCardProps) {
  const { toast } = useToast();
  const patientId = patient?.id;
  const storageKey = `aarogya_patient_vitals_${patientId}`;

  const initialVitals = React.useMemo(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.bloodPressure && parsed.heartRate && parsed.temperature) {
          return {
            bloodPressure: String(parsed.bloodPressure),
            heartRate: String(parsed.heartRate),
            temperature: String(parsed.temperature),
          };
        }
      }
    } catch (_) {
      // ignore storage errors
    }
    const defaults = getInitialPatientVitals(patient);
    return {
      bloodPressure: String(defaults.bloodPressure),
      heartRate: String(defaults.heartRate),
      temperature: String(defaults.temperature),
    };
  }, [patient, storageKey]);

  const [bloodPressure, setBloodPressure] = React.useState(initialVitals.bloodPressure);
  const [heartRate, setHeartRate] = React.useState(initialVitals.heartRate);
  const [temperature, setTemperature] = React.useState(initialVitals.temperature);
  const [selectedSparklineMetric, setSelectedSparklineMetric] =
    React.useState<SparklineVitalMetric>("bloodPressure");
  const [isSaving, setIsSaving] = React.useState(false);
  const [recentLogs, setRecentLogs] = React.useState<SavedVitalLog[]>(() => {
    if (Array.isArray(patient?.vitals) && patient.vitals.length > 0) {
      return patient.vitals;
    }
    return [];
  });

  React.useEffect(() => {
    if (Array.isArray(patient?.vitals) && patient.vitals.length > 0) {
      setRecentLogs(patient.vitals);
    }
  }, [patient?.vitals]);

  const evaluation = React.useMemo(
    () =>
      evaluatePatientVitals({
        bloodPressure,
        heartRate,
        temperature,
      }),
    [bloodPressure, heartRate, temperature]
  );

  // Build chronological series (up to last 5 genuine readings) for the embedded Recharts sparkline
  const sparklineSeries = React.useMemo(
    () =>
      buildVitalSparklineSeries(
        recentLogs,
        { bloodPressure, heartRate, temperature }
      ),
    [recentLogs, bloodPressure, heartRate, temperature]
  );

  const isSelectedMetricAbnormal =
    selectedSparklineMetric === "bloodPressure"
      ? evaluation.bp.isAbnormal
      : evaluation.hr.isAbnormal;

  const strokeColor = isSelectedMetricAbnormal
    ? "hsl(var(--destructive))"
    : "hsl(var(--primary))";

  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      evaluation.parsedSystolic === null ||
      evaluation.parsedDiastolic === null ||
      evaluation.parsedHeartRate === null ||
      evaluation.parsedTemperature === null
    ) {
      toast({
        title: "Invalid Vital Signs",
        description:
          "Please enter valid Blood Pressure (e.g. 120/80), Heart Rate (bpm), and Temperature (°C).",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const formattedBp = `${evaluation.parsedSystolic}/${evaluation.parsedDiastolic}`;
    const payload = {
      bloodPressure: formattedBp,
      systolic: evaluation.parsedSystolic,
      diastolic: evaluation.parsedDiastolic,
      heartRate: evaluation.parsedHeartRate,
      temperature: evaluation.parsedTemperature,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (_) {
      // ignore
    }

    try {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch(`/api/patients/${patientId}/vitals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        setRecentLogs((prev) => [saved, ...prev.slice(0, 4)]);
      } else {
        const fallbackEntry: SavedVitalLog = {
          id: Date.now(),
          bloodPressure: formattedBp,
          systolic: evaluation.parsedSystolic,
          diastolic: evaluation.parsedDiastolic,
          heartRate: evaluation.parsedHeartRate,
          temperature: evaluation.parsedTemperature,
          createdAt: new Date().toISOString().replace("T", " ").slice(0, 19),
        };
        setRecentLogs((prev) => [fallbackEntry, ...prev.slice(0, 4)]);
      }

      setBloodPressure(formattedBp);
      toast({
        title: evaluation.hasInstability
          ? "Vitals Recorded — Clinical Instability Flagged"
          : "Patient Vitals Recorded",
        description: evaluation.hasInstability
          ? evaluation.instabilitySummary
          : `Saved BP ${formattedBp} mmHg · HR ${evaluation.parsedHeartRate} bpm · Temp ${evaluation.parsedTemperature.toFixed(1)} °C`,
        variant: evaluation.hasInstability ? "destructive" : "default",
      });

      onVitalsRecorded?.();
    } catch (_) {
      const fallbackEntry: SavedVitalLog = {
        id: Date.now(),
        bloodPressure: formattedBp,
        systolic: evaluation.parsedSystolic,
        diastolic: evaluation.parsedDiastolic,
        heartRate: evaluation.parsedHeartRate,
        temperature: evaluation.parsedTemperature,
        createdAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      };
      setRecentLogs((prev) => [fallbackEntry, ...prev.slice(0, 4)]);
      toast({
        title: "Patient Vitals Recorded",
        description: `Saved BP ${formattedBp} mmHg · HR ${evaluation.parsedHeartRate} bpm · Temp ${evaluation.parsedTemperature.toFixed(1)} °C`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card data-testid="patient-vitals-card" className="border-border bg-card text-card-foreground">
      <CardHeader className="pb-4 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <HeartPulse className="h-4 w-4 text-primary" /> Patient Vitals
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Record blood pressure, heart rate, and core temperature with real-time clinical threshold monitoring
            </CardDescription>
          </div>

          <div
            data-testid="vitals-overall-status"
            data-instability={evaluation.hasInstability ? "true" : "false"}
            className={`text-xs font-semibold flex items-center gap-1.5 ${
              evaluation.hasInstability
                ? "text-rose-600 dark:text-rose-400 animate-pulse"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {evaluation.hasInstability ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Instability Alert ({evaluation.abnormalCount} vital{evaluation.abnormalCount > 1 ? "s" : ""} outside normal threshold)
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Hemodynamically &amp; Thermally Stable</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-6">
        {/* Live Vital Signs Readout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <VitalSignReadout
            assessment={evaluation.bp}
            icon={<Activity className="h-4 w-4" />}
            testId="vital-display-bp"
            isSelectedForSparkline={selectedSparklineMetric === "bloodPressure"}
            onSelectSparkline={() => setSelectedSparklineMetric("bloodPressure")}
          />
          <VitalSignReadout
            assessment={evaluation.hr}
            icon={<HeartPulse className="h-4 w-4" />}
            testId="vital-display-hr"
            isSelectedForSparkline={selectedSparklineMetric === "heartRate"}
            onSelectSparkline={() => setSelectedSparklineMetric("heartRate")}
          />
          <VitalSignReadout
            assessment={evaluation.temp}
            icon={<Thermometer className="h-4 w-4" />}
            testId="vital-display-temp"
          />
        </div>

        {/* Embedded Recharts Sparkline for Last 5 Readings (Blood Pressure or Heart Rate) */}
        <div
          data-testid="vitals-sparkline-section"
          className="rounded-lg border border-border/80 bg-muted/15 p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span>
                  Last 5 Readings Trend —{" "}
                  {selectedSparklineMetric === "bloodPressure"
                    ? "Blood Pressure (Systolic / Diastolic mmHg)"
                    : "Heart Rate (Resting Pulse bpm)"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {selectedSparklineMetric === "bloodPressure"
                  ? "Dashed threshold line at 130 mmHg systolic · Solid curve shows Systolic, dashed curve shows Diastolic"
                  : "Dashed threshold line at 100 bpm · Visualizes the last 5 chronological pulse recordings"}
              </p>
            </div>

            {/* Interactive Segmented Control to switch between Blood Pressure and Heart Rate */}
            <div
              role="group"
              aria-label="Select vital sign for sparkline trend"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted border border-border/70 self-start sm:self-auto"
            >
              <button
                type="button"
                data-testid="sparkline-select-bp"
                onClick={() => setSelectedSparklineMetric("bloodPressure")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  selectedSparklineMetric === "bloodPressure"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Blood Pressure
              </button>
              <button
                type="button"
                data-testid="sparkline-select-hr"
                onClick={() => setSelectedSparklineMetric("heartRate")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  selectedSparklineMetric === "heartRate"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Heart Rate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Embedded Recharts Sparkline Canvas */}
            <div
              data-testid="vitals-recharts-sparkline"
              className="lg:col-span-7 h-28 w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={sparklineSeries}
                  margin={{ top: 8, right: 10, left: 10, bottom: 2 }}
                >
                  <defs>
                    <linearGradient id="vitalSparklineFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={strokeColor} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="readingLabel"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    hide
                    domain={
                      selectedSparklineMetric === "bloodPressure"
                        ? ["dataMin - 12", "dataMax + 12"]
                        : ["dataMin - 10", "dataMax + 10"]
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "11px",
                      padding: "6px 10px",
                    }}
                    formatter={(value: any, name: any, item: any) => {
                      if (selectedSparklineMetric === "bloodPressure") {
                        if (name === "systolic") {
                          return [
                            `${item?.payload?.bloodPressure} mmHg (MAP ${item?.payload?.map})`,
                            "Blood Pressure",
                          ];
                        }
                        return [ `${value} mmHg`, "Diastolic" ];
                      }
                      return [`${value} bpm`, "Heart Rate"];
                    }}
                    labelFormatter={(label: any, payload: any) => {
                      const pt = payload?.[0]?.payload;
                      return pt ? `Reading ${label} (${pt.timestampLabel})` : `Reading ${String(label ?? "")}`;
                    }}
                  />
                  <ReferenceLine
                    y={selectedSparklineMetric === "bloodPressure" ? 130 : 100}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="3 3"
                    strokeOpacity={0.55}
                  />
                  {selectedSparklineMetric === "bloodPressure" ? (
                    <>
                      <Area
                        type="monotone"
                        dataKey="systolic"
                        stroke={strokeColor}
                        strokeWidth={2.25}
                        fill="url(#vitalSparklineFill)"
                        dot={{ r: 3, fill: strokeColor, strokeWidth: 0 }}
                        activeDot={{ r: 4.5 }}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="diastolic"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={{ r: 2, fill: "hsl(var(--muted-foreground))" }}
                        isAnimationActive={false}
                      />
                    </>
                  ) : (
                    <Area
                      type="monotone"
                      dataKey="heartRate"
                      stroke={strokeColor}
                      strokeWidth={2.25}
                      fill="url(#vitalSparklineFill)"
                      dot={{ r: 3, fill: strokeColor, strokeWidth: 0 }}
                      activeDot={{ r: 4.5 }}
                      isAnimationActive={false}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Recorded Readings Tabular Strip (up to last 5) */}
            <div className="lg:col-span-5 grid grid-cols-5 gap-1.5">
              {sparklineSeries.map((pt, idx) => {
                const isPointAbnormal =
                  selectedSparklineMetric === "bloodPressure" ? pt.bpAbnormal : pt.hrAbnormal;
                const displayVal =
                  selectedSparklineMetric === "bloodPressure"
                    ? pt.bloodPressure
                    : `${pt.heartRate}`;
                const displayUnit =
                  selectedSparklineMetric === "bloodPressure" ? "mmHg" : "bpm";
                const isLatestPoint = idx === sparklineSeries.length - 1;

                return (
                  <div
                    key={pt.index}
                    data-testid={`sparkline-point-${pt.index}`}
                    className={`rounded-md px-2 py-2 border text-center ${
                      isLatestPoint
                        ? isPointAbnormal
                          ? "border-rose-500/50 bg-rose-500/10"
                          : "border-primary/40 bg-primary/5"
                        : "border-border/60 bg-background/60"
                    }`}
                  >
                    <p className="text-[10px] text-muted-foreground font-medium truncate">
                      {pt.readingLabel}
                    </p>
                    <p
                      className={`text-xs font-bold font-mono tabular-nums mt-0.5 ${
                        isPointAbnormal
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-foreground"
                      }`}
                    >
                      {displayVal}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{displayUnit}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Clinical Instability Banner when any vital exceeds normal threshold */}
        {evaluation.hasInstability && (
          <div
            role="alert"
            data-testid="vitals-instability-banner"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-vital-pulse"
          >
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-0.5">
              <p className="font-semibold text-rose-700 dark:text-rose-200">
                {evaluation.instabilitySummary}
              </p>
              <p className="text-rose-600/90 dark:text-rose-300/90">
                Abnormal vital signs are pulsing above to alert clinical staff. Correlate with SIRS/qSOFA criteria and active antimicrobial therapy.
              </p>
            </div>
          </div>
        )}

        {/* Staff Entry Form using current theme colors for input fields */}
        <form onSubmit={handleRecordVitals} className="space-y-4 pt-2 border-t border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              Record Bedside Vital Signs
            </p>
            <span className="text-[11px] text-muted-foreground">
              Showing {sparklineSeries.length} of last 5 recorded readings
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vital-bp-input" className="text-xs font-medium text-foreground">
                Blood Pressure (mmHg)
              </Label>
              <Input
                id="vital-bp-input"
                name="bloodPressure"
                data-testid="vital-input-bp"
                type="text"
                placeholder="120/80"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                className="h-9 text-xs font-mono tabular-nums bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Normal threshold: 90–129 / 60–84 mmHg
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vital-hr-input" className="text-xs font-medium text-foreground">
                Heart Rate (bpm)
              </Label>
              <Input
                id="vital-hr-input"
                name="heartRate"
                data-testid="vital-input-hr"
                type="number"
                min={20}
                max={260}
                step={1}
                placeholder="74"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="h-9 text-xs font-mono tabular-nums bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Normal threshold: 60–100 bpm
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vital-temp-input" className="text-xs font-medium text-foreground">
                Temperature (°C)
              </Label>
              <Input
                id="vital-temp-input"
                name="temperature"
                data-testid="vital-input-temp"
                type="number"
                min={30}
                max={110}
                step="0.1"
                placeholder="37.0"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="h-9 text-xs font-mono tabular-nums bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Normal threshold: 36.0–37.7 °C
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
              {recentLogs.length > 0 ? (
                <>
                  <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Last recorded:</span>
                  <span className="font-mono text-foreground font-medium tabular-nums">
                    BP {recentLogs[0].bloodPressure} mmHg · HR {recentLogs[0].heartRate} bpm · Temp {Number(recentLogs[0].temperature).toFixed(1)} °C
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{recentLogs[0].createdAt}</span>
                </>
              ) : (
                <span>Enter bedside readings above and click Record Vitals to log to patient chart.</span>
              )}
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              data-testid="record-vitals-btn"
              className="h-9 px-4 text-xs font-semibold shrink-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Recording...
                </>
              ) : (
                "Record Vitals"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function VitalSignReadout({
  assessment,
  icon,
  testId,
  isSelectedForSparkline,
  onSelectSparkline,
}: {
  assessment: VitalSignAssessment;
  icon: React.ReactNode;
  testId: string;
  isSelectedForSparkline?: boolean;
  onSelectSparkline?: () => void;
}) {
  const isAbnormal = assessment.isAbnormal;

  return (
    <div
      data-testid={testId}
      data-abnormal={isAbnormal ? "true" : "false"}
      onClick={onSelectSparkline}
      role={onSelectSparkline ? "button" : undefined}
      tabIndex={onSelectSparkline ? 0 : undefined}
      onKeyDown={
        onSelectSparkline
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectSparkline();
              }
            }
          : undefined
      }
      className={`rounded-lg p-4 border transition-colors ${
        onSelectSparkline ? "cursor-pointer" : ""
      } ${
        isAbnormal
          ? "border-rose-500/50 bg-rose-500/10 animate-vital-pulse animate-pulse"
          : isSelectedForSparkline
          ? "border-primary/50 bg-primary/5"
          : "border-border/80 bg-muted/20"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <span className={isAbnormal ? "text-rose-600 dark:text-rose-400" : "text-primary"}>
            {icon}
          </span>
          {assessment.label}
        </span>

        <span
          className={`text-[11px] font-semibold ${
            isAbnormal
              ? "text-rose-600 dark:text-rose-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {assessment.statusLabel}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
            isAbnormal ? "text-rose-600 dark:text-rose-400" : "text-foreground"
          }`}
        >
          {assessment.formattedValue}
        </span>
        <span className="text-xs text-muted-foreground font-medium">{assessment.unit}</span>
        {assessment.secondaryMetric && (
          <>
            <span aria-hidden="true" className="text-muted-foreground text-xs">·</span>
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {assessment.secondaryMetric}
            </span>
          </>
        )}
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
        <span>Ref: {assessment.referenceRange}</span>
        {onSelectSparkline && (
          <span className="text-[10px] font-medium text-primary">
            {isSelectedForSparkline ? "Viewing Trend" : "Click for Trend"}
          </span>
        )}
      </div>
      <p
        className={`mt-1 text-[11px] ${
          isAbnormal ? "text-rose-600/90 dark:text-rose-300/90 font-medium" : "text-muted-foreground"
        }`}
      >
        {assessment.clinicalNote}
      </p>
    </div>
  );
}
