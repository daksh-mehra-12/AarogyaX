import * as React from "react";
import { useState } from "react";
import { useGetMlInfo, useGetMlModels, useListPatients, useListCases, useListAdrReports } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope, Activity, ShieldAlert, Cpu, BarChart2,
  Database, Layers, Zap, User
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export default function AmrPredictorPage() {
  const [activeTab, setActiveTab] = useState<"predict" | "performance" | "dataset">("predict");
  const { data: mlInfo } = useGetMlInfo();
  const { data: modelsData } = useGetMlModels();
  const { data: patientsData } = useListPatients({ limit: 200 });
  const { data: casesData } = useListCases({});
  const { data: adrData } = useListAdrReports({});
  const { toast } = useToast();

  // Clinical Predictor State
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("GradientBoosting");
  const [infectionType, setInfectionType] = useState<string>("uti");
  const [organism, setOrganism] = useState<string>("E. coli");
  const [antibiotic, setAntibiotic] = useState<string>("Amikacin");
  const [severity, setSeverity] = useState<string>("moderate");
  const [icuStatus, setIcuStatus] = useState<boolean>(false);
  const [priorAntibiotics, setPriorAntibiotics] = useState<boolean>(false);
  const [diabetes, setDiabetes] = useState<boolean>(false);
  const [ckd, setCkd] = useState<boolean>(false);
  const [pregnancy, setPregnancy] = useState<boolean>(false);
  const [age, setAge] = useState<number>(55);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<any>(null);

  // Dynamic active model metrics computed based on selectedModel state
  const activeModelMetrics = React.useMemo(() => {
    const modelObj = mlInfo?.all_model_results?.[selectedModel];
    if (modelObj) {
      return {
        accuracy: modelObj.accuracy,
        precision: modelObj.precision,
        recall: modelObj.recall,
        f1_score: modelObj.f1_score,
        roc_auc: modelObj.roc_auc,
        confusion_matrix: modelObj.confusion_matrix || mlInfo?.confusion_matrix,
      };
    }
    return {
      accuracy: mlInfo?.accuracy,
      precision: mlInfo?.precision,
      recall: mlInfo?.recall,
      f1_score: mlInfo?.f1_score,
      roc_auc: mlInfo?.roc_auc,
      confusion_matrix: mlInfo?.confusion_matrix,
    };
  }, [mlInfo, selectedModel]);

  // Live cases AMR risk breakdown calculation for Dataset Insights tab
  const liveRiskDistribution = React.useMemo(() => {
    const cases = casesData?.cases || [];
    let low = 0, medium = 0, high = 0, critical = 0;
    cases.forEach((c: any) => {
      const r = c.prediction?.resistanceRisk || (c.severity === "severe" ? "high" : "medium");
      if (r === "low") low++;
      else if (r === "medium") medium++;
      else if (r === "high") high++;
      else if (r === "critical") critical++;
    });
    return { low, medium, high, critical, total: cases.length };
  }, [casesData]);

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPredicting(true);
    try {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          selectedModel,
          infectionType,
          organism,
          antibiotic,
          severity,
          icuStatus,
          priorAntibiotics,
          diabetes,
          ckd,
          pregnancy,
          age,
          patientId: selectedPatientId ? parseInt(selectedPatientId) : undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || "Failed to connect to ML prediction backend endpoint");
      }

      const data = await res.json();
      setPredictionResult(data.prediction || data);
      toast({
        title: "AMR Prediction Calculated",
        description: `Trained ${data.prediction?.modelName || selectedModel} model prediction completed.`,
      });
    } catch (err: any) {
      toast({
        title: "Prediction Failed",
        description: err?.message || "Error running inference pipeline",
        variant: "destructive",
      });
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-foreground">
      <Breadcrumbs items={[{ label: "AMR Decision Support" }]} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 rounded-lg border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground tracking-tight">AMR Decision Support &amp; Model Intelligence</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              Model: {selectedModel} {activeModelMetrics?.accuracy !== undefined ? `(${(activeModelMetrics.accuracy * 100).toFixed(1)}% Acc)` : ""}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Antimicrobial Resistance Prediction Engine &amp; Project Dataset Analytics</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border text-xs font-medium shrink-0">
          <button
            onClick={() => setActiveTab("predict")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === "predict" ? "bg-card text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Stethoscope className="h-3.5 w-3.5 text-primary" /> AMR Predictor
          </button>

          <button
            onClick={() => setActiveTab("performance")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === "performance" ? "bg-card text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5 text-primary" /> Model Performance
          </button>

          <button
            onClick={() => setActiveTab("dataset")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === "dataset" ? "bg-card text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Database className="h-3.5 w-3.5 text-primary" /> Dataset Insights
          </button>
        </div>
      </div>

      {/* ── TAB 1: AMR CLINICAL PREDICTOR ── */}
      {activeTab === "predict" && (
        <div className="grid gap-6 md:grid-cols-12">
          {/* Patient Parameter Inputs */}
          <Card className="md:col-span-6 bg-card border border-border shadow-sm rounded-lg">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Patient Clinical Parameters
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter infection site, pathogen organism, and patient risk flags for ML inference.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handlePredict} className="space-y-4 text-xs">
                
                {/* Active Model Selector */}
                <div className="space-y-1.5 p-3 rounded-md bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="selectedModel" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-primary" /> Active Machine Learning Model
                    </Label>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                      Dynamic Selection
                    </Badge>
                  </div>
                  <Select value={selectedModel} onValueChange={(val) => {
                    setSelectedModel(val);
                    toast({
                      title: "Model Switched",
                      description: `Active model changed to ${val}.`,
                    });
                  }}>
                    <SelectTrigger id="selectedModel" className="bg-card border-border font-medium text-xs">
                      <SelectValue placeholder="Select algorithm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GradientBoosting">GradientBoosting (Top F1: 100%)</SelectItem>
                      <SelectItem value="RandomForest">RandomForest (97.2% Accuracy)</SelectItem>
                      <SelectItem value="DecisionTree">DecisionTree (100% Accuracy)</SelectItem>
                      <SelectItem value="LogisticRegression">LogisticRegression (88.9% Accuracy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Registered Patient Selector */}
                <div className="space-y-1.5 p-3 rounded-md bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="patientSelect" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" /> Select Registered Patient (Optional)
                    </Label>
                    {selectedPatientId && (
                      <button
                        type="button"
                        onClick={() => setSelectedPatientId("")}
                        className="text-[10px] text-muted-foreground hover:text-primary underline"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>
                  <Select
                    value={selectedPatientId}
                    onValueChange={(val) => {
                      setSelectedPatientId(val);
                      const p = patientsData?.patients?.find((pat: any) => String(pat.id) === val);
                      if (p) {
                        if (p.age) setAge(p.age);
                        setDiabetes(!!p.diabetes);
                        setCkd(!!p.ckd);
                        setPregnancy(!!p.pregnancy);
                        toast({
                          title: "Patient Parameters Auto-filled",
                          description: `Loaded clinical details for ${p.name} (Age: ${p.age}).`,
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="patientSelect" className="bg-card border-border font-medium text-xs">
                      <SelectValue placeholder="Choose a registered patient to auto-fill parameters..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patientsData?.patients?.length ? (
                        patientsData.patients.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name} (Age: {p.age}, {p.gender}) {p.hospitalId ? `— ID: ${p.hospitalId}` : ""}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="_empty" disabled>
                          No registered patients found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="infectionType" className="text-xs">Infection Site</Label>
                    <Select value={infectionType} onValueChange={setInfectionType}>
                      <SelectTrigger id="infectionType">
                        <SelectValue placeholder="Select infection site" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uti">Urinary Tract Infection (UTI)</SelectItem>
                        <SelectItem value="pneumonia">Ventilator-Associated Pneumonia</SelectItem>
                        <SelectItem value="sepsis">Bloodstream Infection (Sepsis)</SelectItem>
                        <SelectItem value="skin">Skin &amp; Soft Tissue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="organism" className="text-xs">Pathogen Organism</Label>
                    <Select value={organism} onValueChange={setOrganism}>
                      <SelectTrigger id="organism">
                        <SelectValue placeholder="Select organism" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="E. coli">Escherichia coli</SelectItem>
                        <SelectItem value="Klebsiella">Klebsiella pneumoniae</SelectItem>
                        <SelectItem value="Pseudomonas">Pseudomonas aeruginosa</SelectItem>
                        <SelectItem value="Acinetobacter">Acinetobacter baumannii</SelectItem>
                        <SelectItem value="Enterococcus">Enterococcus spp.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="antibiotic" className="text-xs">Target Antibiotic</Label>
                    <Select value={antibiotic} onValueChange={setAntibiotic}>
                      <SelectTrigger id="antibiotic">
                        <SelectValue placeholder="Select antibiotic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Amikacin">Amikacin</SelectItem>
                        <SelectItem value="Cefepime">Cefepime</SelectItem>
                        <SelectItem value="Ceftriaxone">Ceftriaxone</SelectItem>
                        <SelectItem value="Ciprofloxacin">Ciprofloxacin</SelectItem>
                        <SelectItem value="Colistin">Colistin</SelectItem>
                        <SelectItem value="Gentamicin">Gentamicin</SelectItem>
                        <SelectItem value="Imipenem">Imipenem</SelectItem>
                        <SelectItem value="Meropenem">Meropenem</SelectItem>
                        <SelectItem value="Piperacillin-Tazobactam">Piperacillin-Tazobactam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="severity" className="text-xs">Clinical Severity</Label>
                    <Select value={severity} onValueChange={setSeverity}>
                      <SelectTrigger id="severity">
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mild">Mild (Outpatient)</SelectItem>
                        <SelectItem value="moderate">Moderate (Inpatient)</SelectItem>
                        <SelectItem value="severe">Severe (ICU Risk)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="age" className="text-xs">Patient Age: {age} years</Label>
                  <Input
                    id="age"
                    type="number"
                    min={0}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="text-xs"
                  />
                </div>

                {/* Risk Checkboxes */}
                <div className="pt-2 grid grid-cols-2 gap-3 border-t border-border">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="icuStatus" checked={icuStatus} onCheckedChange={(c) => setIcuStatus(!!c)} />
                    <label htmlFor="icuStatus" className="text-xs cursor-pointer font-medium">ICU Admission</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="priorAntibiotics" checked={priorAntibiotics} onCheckedChange={(c) => setPriorAntibiotics(!!c)} />
                    <label htmlFor="priorAntibiotics" className="text-xs cursor-pointer font-medium">Prior Antibiotics (&lt;90 days)</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="diabetes" checked={diabetes} onCheckedChange={(c) => setDiabetes(!!c)} />
                    <label htmlFor="diabetes" className="text-xs cursor-pointer font-medium">Diabetes Mellitus</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="ckd" checked={ckd} onCheckedChange={(c) => setCkd(!!c)} />
                    <label htmlFor="ckd" className="text-xs cursor-pointer font-medium">Chronic Kidney Disease</label>
                  </div>
                  <div className="flex items-center space-x-2 col-span-2">
                    <Checkbox id="pregnancy" checked={pregnancy} onCheckedChange={(c) => setPregnancy(!!c)} />
                    <label htmlFor="pregnancy" className="text-xs cursor-pointer font-medium">Pregnancy</label>
                  </div>
                </div>

                <Button type="submit" disabled={isPredicting} className="w-full mt-2 font-semibold">
                  {isPredicting ? (
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4 animate-spin" /> Evaluating {selectedModel} Model...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" /> Calculate AMR Risk ({selectedModel})
                    </span>
                  )}
                </Button>

              </form>
            </CardContent>
          </Card>

          {/* Model Inference Results Output */}
          <Card className="md:col-span-6 bg-card border border-border shadow-sm rounded-lg flex flex-col justify-between">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" /> Trained Model Prediction &amp; Analysis
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Inference output generated from trained scikit-learn pipeline ({predictionResult?.modelName || selectedModel})
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 flex-1">
              {predictionResult ? (
                <div className="space-y-5 text-xs">

                  {/* Prediction Metrics Banner */}
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-muted/40 border border-border">
                    <div>
                      <span className="text-[11px] text-muted-foreground uppercase font-semibold">Model Predicted AMR Risk</span>
                      <div className="flex items-center gap-2 mt-1">
                        <RiskBadge risk={predictionResult.resistanceRisk} />
                        <span className="text-lg font-extrabold text-foreground">
                          {intPct(predictionResult.resistanceProbability)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground uppercase font-semibold">Model Confidence</span>
                      <div className="text-lg font-bold text-primary mt-1">
                        {intPct(predictionResult.confidence)}% Confidence
                      </div>
                    </div>
                  </div>

                  {/* Recommendation Section (Separated) */}
                  <div className="p-4 rounded-lg bg-card border border-border space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Clinical Regimen Recommendation
                    </span>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-foreground">{predictionResult.recommendedDrug}</span>
                      <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                        First-Line Therapy
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Dosage: {predictionResult.dosage}</p>
                    {predictionResult.alternativeDrugs?.length > 0 && (
                      <p className="text-[11px] text-muted-foreground pt-1">
                        Alternatives: {predictionResult.alternativeDrugs.join(", ")}
                      </p>
                    )}
                  </div>

                  {/* XAI Feature Importance */}
                  {predictionResult.featureImportance?.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                        Explainable AI (XAI) Feature Importance
                      </span>
                      <div className="space-y-2">
                        {predictionResult.featureImportance.map((fi: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-2 rounded bg-muted/30 border border-border text-xs">
                            <span className="font-medium text-foreground">{fi.feature}</span>
                            <span className="font-bold text-primary">{fi.impact}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border">
                    {predictionResult.rationale}
                  </p>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
                  <Stethoscope className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p>Select patient parameters and click calculate to execute trained model inference.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 2: MODEL PERFORMANCE PAGE ── */}
      {activeTab === "performance" && (
        <div className="space-y-6">

          {/* Model Selection Header Bar */}
          <div className="p-4 rounded-lg bg-card border border-border shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Evaluating Performance For</p>
              <h3 className="text-lg font-bold text-foreground">{selectedModel} Algorithm</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Switch Model:</span>
              <Select value={selectedModel} onValueChange={(val) => {
                setSelectedModel(val);
                toast({
                  title: "Performance View Updated",
                  description: `Showing metrics & confusion matrix for ${val}.`,
                });
              }}>
                <SelectTrigger className="w-[200px] h-8 text-xs bg-card border-border font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GradientBoosting">GradientBoosting (Top F1)</SelectItem>
                  <SelectItem value="RandomForest">RandomForest</SelectItem>
                  <SelectItem value="DecisionTree">DecisionTree</SelectItem>
                  <SelectItem value="LogisticRegression">LogisticRegression</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Real Metric Tiles for Selected Model */}
          <div className="grid gap-4 md:grid-cols-5">
            <MetricTile
              label="Accuracy"
              value={activeModelMetrics?.accuracy !== undefined ? `${(activeModelMetrics.accuracy * 100).toFixed(2)}%` : "--"}
              sub={`Over ${mlInfo?.test_size ?? "--"} test records`}
              color="blue"
            />
            <MetricTile
              label="Precision"
              value={activeModelMetrics?.precision !== undefined ? `${(activeModelMetrics.precision * 100).toFixed(2)}%` : "--"}
              sub="Weighted precision"
              color="emerald"
            />
            <MetricTile
              label="Recall"
              value={activeModelMetrics?.recall !== undefined ? `${(activeModelMetrics.recall * 100).toFixed(2)}%` : "--"}
              sub="Weighted recall"
              color="emerald"
            />
            <MetricTile
              label="F1 Score"
              value={activeModelMetrics?.f1_score !== undefined ? `${(activeModelMetrics.f1_score * 100).toFixed(2)}%` : "--"}
              sub="Selection metric"
              color="blue"
            />
            <MetricTile
              label="ROC-AUC"
              value={activeModelMetrics?.roc_auc !== undefined ? activeModelMetrics.roc_auc.toFixed(4) : "--"}
              sub="Multi-class OVR"
              color="amber"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-12">
            {/* Confusion Matrix */}
            <Card className="md:col-span-6 bg-card border border-border shadow-sm rounded-lg">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" /> Confusion Matrix ({selectedModel})
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Actual vs. Predicted class distribution for {selectedModel} ({mlInfo?.test_size ?? "--"} holdout test records)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-2 text-left text-muted-foreground font-semibold">Actual \ Pred</th>
                        <th className="p-2 text-foreground font-bold">Low</th>
                        <th className="p-2 text-foreground font-bold">Med</th>
                        <th className="p-2 text-foreground font-bold">High</th>
                        <th className="p-2 text-foreground font-bold">Crit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeModelMetrics?.confusion_matrix || []).map((row: number[], rIdx: number) => {
                        const labels = ["Low Risk", "Medium Risk", "High Risk", "Critical Risk"];
                        return (
                          <tr key={rIdx} className="border-b border-border/50">
                            <td className="p-2 text-left font-semibold text-muted-foreground">{labels[rIdx]}</td>
                            {row.map((val: number, cIdx: number) => (
                              <td
                                key={cIdx}
                                className={`p-2.5 font-bold rounded ${
                                  rIdx === cIdx ? "bg-primary/20 text-primary font-extrabold" : "text-muted-foreground bg-muted/20"
                                }`}
                              >
                                {val}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Model Comparison Table */}
            <Card className="md:col-span-6 bg-card border border-border shadow-sm rounded-lg">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" /> Candidate Algorithm Comparison
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  5-Fold Stratified Cross Validation Results
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3 text-xs">
                  {Object.entries(mlInfo?.all_model_results || {}).map(([mName, metrics]: [string, any]) => {
                    const isSelected = mName === selectedModel;
                    const isTopModel = mName === mlInfo?.selected_algorithm;
                    return (
                      <div key={mName} className={`p-3 rounded-md border flex items-center justify-between transition-colors ${
                        isSelected ? "bg-primary/10 border-primary/40 text-foreground shadow-xs" : "bg-card border-border text-foreground hover:bg-muted/40"
                      }`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{mName}</span>
                            {isSelected && <Badge className="bg-primary text-primary-foreground text-[10px]">ACTIVE INFERENCE</Badge>}
                            {isTopModel && <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px]">TOP F1 SCORE</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            5-Fold CV F1: <strong className="text-foreground">{(metrics.cv_f1_mean * 100).toFixed(1)}%</strong> | Rec: {(metrics.recall * 100).toFixed(1)}% | Prec: {(metrics.precision * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-extrabold text-sm text-primary">{(metrics.accuracy * 100).toFixed(1)}%</span>
                            <p className="text-[11px] text-muted-foreground">F1: {(metrics.f1_score * 100).toFixed(1)}%</p>
                          </div>
                          {!isSelected && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedModel(mName);
                                toast({
                                  title: "Model Selected",
                                  description: `Active model switched to ${mName} for clinical prediction and performance inspection.`,
                                });
                              }}
                              className="text-xs h-7 px-2.5 bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                            >
                              Select Model
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 3: DATASET & SYSTEM INSIGHTS PAGE ── */}
      {activeTab === "dataset" && (
        <div className="space-y-6">

          {/* Live System Database Overview Banner */}
          <div className="p-4 rounded-lg bg-card border border-border shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> System Database &amp; Clinical Records Insights
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time analytics computed dynamically from active hospital patient records and clinical cases
                </p>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                Live DB Analytics
              </Badge>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 pt-1">
              <div className="p-2.5 rounded-md bg-muted/30 border border-border text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Registered Patients</span>
                <div className="text-lg font-extrabold text-foreground mt-0.5">{patientsData?.total || 0}</div>
              </div>
              <div className="p-2.5 rounded-md bg-muted/30 border border-border text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Clinical Cases Logged</span>
                <div className="text-lg font-extrabold text-primary mt-0.5">{casesData?.total || 0}</div>
              </div>
              <div className="p-2.5 rounded-md bg-muted/30 border border-border text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">ADR Reports Filed</span>
                <div className="text-lg font-extrabold text-foreground mt-0.5">{adrData?.total || 0}</div>
              </div>
              <div className="p-2.5 rounded-md bg-muted/30 border border-border text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Evaluated Features</span>
                <div className="text-lg font-extrabold text-foreground mt-0.5">10 Inputs</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricTile label="Total System Cases" value={casesData?.total || 0} sub="Active clinical records" color="blue" />
            <MetricTile label="Total Patients" value={patientsData?.total || 0} sub="Hospital portal profiles" color="emerald" />
            <MetricTile label="ADR Surveillance" value={adrData?.total || 0} sub="Adverse reaction logs" color="emerald" />
            <MetricTile label="Evaluated Parameters" value="10 Parameters" sub="Demographics, lab & flags" color="amber" />
          </div>

          <Card className="bg-card border border-border shadow-sm rounded-lg">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" /> Feature Dictionary &amp; Clinical Parameters
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Evaluated clinical parameters, risk flags, and target AMR class distributions in active database
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">

              {/* Feature Dictionary */}
              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Feature Dictionary &amp; Inference Inputs</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {[
                    { key: "Infection Site", type: "Categorical", desc: "UTI, Pneumonia, Sepsis, Skin/Soft Tissue" },
                    { key: "Pathogen Organism", type: "Categorical", desc: "E. coli, K. pneumoniae, P. aeruginosa, etc." },
                    { key: "Evaluated Antibiotic", type: "Categorical", desc: "Meropenem, Amikacin, Ceftriaxone, Colistin, etc." },
                    { key: "Sensitivity Rate (%)", type: "Numerical", desc: "Local antibiogram sensitivity baseline %" },
                    { key: "Patient Age", type: "Numerical", desc: "Patient age in years" },
                    { key: "ICU Admission Status", type: "Binary Flag", desc: "Inpatient ICU stay vs ward admission" },
                    { key: "Prior Antibiotic History", type: "Binary Flag", desc: "Antibiotic exposure within past 90 days" },
                    { key: "Comorbidities (Diabetes/CKD)", type: "Clinical Flag", desc: "Diabetes Mellitus & Chronic Kidney Disease" },
                    { key: "Pregnancy Status", type: "Clinical Flag", desc: "Pregnancy state considerations" },
                    { key: "Biomarker Panels (CBC/CRP/PCT)", type: "Lab Values", desc: "Inflammatory markers & leucocyte counts" },
                  ].map((f: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded border border-border bg-muted/20 text-xs">
                      <div>
                        <span className="font-semibold text-foreground block">{f.key}</span>
                        <span className="text-[11px] text-muted-foreground">{f.desc}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground border-border shrink-0 ml-2">{f.type}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Cases AMR Class Distribution */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider text-primary">
                    Live System AMR Target Risk Distribution
                  </h4>
                  <span className="text-[11px] text-muted-foreground">Total Database Cases: {liveRiskDistribution.total}</span>
                </div>

                {liveRiskDistribution.total === 0 ? (
                  <div className="p-6 rounded-md border border-dashed border-border bg-muted/20 text-center space-y-2">
                    <Database className="h-6 w-6 text-muted-foreground mx-auto" />
                    <p className="text-xs font-semibold text-foreground">No Clinical Cases Logged in Database Yet</p>
                    <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                      Database is currently clean (0 cases). Register new patients and create clinical cases to populate live risk distribution analytics.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-4 text-xs">
                    <div className="p-3 rounded border border-emerald-500/30 bg-emerald-500/10 text-center space-y-1">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Low Risk</span>
                      <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{liveRiskDistribution.low}</div>
                      <span className="text-[10px] text-muted-foreground">
                        {((liveRiskDistribution.low / liveRiskDistribution.total) * 100).toFixed(1)}% of system cases
                      </span>
                    </div>

                    <div className="p-3 rounded border border-amber-500/30 bg-amber-500/10 text-center space-y-1">
                      <span className="font-semibold text-amber-600 dark:text-amber-400">Medium Risk</span>
                      <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{liveRiskDistribution.medium}</div>
                      <span className="text-[10px] text-muted-foreground">
                        {((liveRiskDistribution.medium / liveRiskDistribution.total) * 100).toFixed(1)}% of system cases
                      </span>
                    </div>

                    <div className="p-3 rounded border border-orange-500/30 bg-orange-500/10 text-center space-y-1">
                      <span className="font-semibold text-orange-600 dark:text-orange-400">High Risk</span>
                      <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{liveRiskDistribution.high}</div>
                      <span className="text-[10px] text-muted-foreground">
                        {((liveRiskDistribution.high / liveRiskDistribution.total) * 100).toFixed(1)}% of system cases
                      </span>
                    </div>

                    <div className="p-3 rounded border border-rose-500/30 bg-rose-500/10 text-center space-y-1">
                      <span className="font-semibold text-rose-600 dark:text-rose-400">Critical Risk</span>
                      <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{liveRiskDistribution.critical}</div>
                      <span className="text-[10px] text-muted-foreground">
                        {((liveRiskDistribution.critical / liveRiskDistribution.total) * 100).toFixed(1)}% of system cases
                      </span>
                    </div>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}

/* ── Metric Tile Component ── */
function MetricTile({ label, value, sub, color }: { label: string; value: any; sub: string; color: "blue" | "emerald" | "amber" }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm text-center">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="text-2xl font-bold text-foreground tracking-tight mt-1">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

/* ── Risk Badge Helper ── */
function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, string> = {
    low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-300",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border-amber-300",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-400 border-orange-300",
    critical: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400 border-red-300",
  };
  return (
    <Badge className={`px-2.5 py-0.5 border capitalize text-xs font-bold ${map[risk] ?? map.medium}`}>
      {risk} Risk
    </Badge>
  );
}

function intPct(val: number) {
  return Math.round((val ?? 0) * 100);
}
