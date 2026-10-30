import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBloodPressure,
  evaluateBloodPressure,
  evaluateHeartRate,
  evaluateTemperature,
  evaluatePatientVitals,
  getInitialPatientVitals,
  buildVitalSparklineSeries,
} from "./patient-vitals";

test("parseBloodPressure parses standard systolic/diastolic strings and rejects invalid values", () => {
  assert.deepEqual(parseBloodPressure("120/80"), { systolic: 120, diastolic: 80 });
  assert.deepEqual(parseBloodPressure(" 145 / 92 "), { systolic: 145, diastolic: 92 });
  assert.deepEqual(parseBloodPressure("invalid"), { systolic: null, diastolic: null });
});

test("evaluateBloodPressure flags hypertension and hypotension outside 90-129 / 60-84 mmHg", () => {
  const normal = evaluateBloodPressure("120/78");
  assert.equal(normal.assessment.isAbnormal, false);
  assert.equal(normal.assessment.statusLabel, "Normotensive");
  assert.equal(normal.map, 92);

  const stage1 = evaluateBloodPressure("134/86");
  assert.equal(stage1.assessment.isAbnormal, true);
  assert.equal(stage1.assessment.severity, "elevated");
  assert.equal(stage1.assessment.statusLabel, "Stage 1 Hypertension");

  const stage2 = evaluateBloodPressure("152/96");
  assert.equal(stage2.assessment.isAbnormal, true);
  assert.equal(stage2.assessment.severity, "critical");
  assert.equal(stage2.assessment.statusLabel, "Stage 2 Hypertension");

  const low = evaluateBloodPressure("86/54");
  assert.equal(low.assessment.isAbnormal, true);
  assert.equal(low.assessment.severity, "critical");
  assert.equal(low.assessment.statusLabel, "Hypotension Alert");
});

test("evaluateHeartRate flags tachycardia (>100 bpm) and bradycardia (<60 bpm)", () => {
  const normal = evaluateHeartRate(74);
  assert.equal(normal.assessment.isAbnormal, false);
  assert.equal(normal.assessment.statusLabel, "Normal Sinus Rate");

  const tachy = evaluateHeartRate(112);
  assert.equal(tachy.assessment.isAbnormal, true);
  assert.equal(tachy.assessment.statusLabel, "Tachycardia");

  const severeTachy = evaluateHeartRate(128);
  assert.equal(severeTachy.assessment.isAbnormal, true);
  assert.equal(severeTachy.assessment.severity, "critical");
  assert.equal(severeTachy.assessment.statusLabel, "Severe Tachycardia");

  const brady = evaluateHeartRate(54);
  assert.equal(brady.assessment.isAbnormal, true);
  assert.equal(brady.assessment.statusLabel, "Bradycardia");
});

test("evaluateTemperature flags fever (>=37.8 °C) and hypothermia (<36.0 °C)", () => {
  const normal = evaluateTemperature(36.9);
  assert.equal(normal.assessment.isAbnormal, false);
  assert.equal(normal.assessment.statusLabel, "Afebrile (Normothermic)");

  const fever = evaluateTemperature(38.2);
  assert.equal(fever.assessment.isAbnormal, true);
  assert.equal(fever.assessment.statusLabel, "Febrile");

  const highFever = evaluateTemperature(39.1);
  assert.equal(highFever.assessment.isAbnormal, true);
  assert.equal(highFever.assessment.severity, "critical");
  assert.equal(highFever.assessment.statusLabel, "High Fever (Pyrexia)");

  const hypo = evaluateTemperature(35.4);
  assert.equal(hypo.assessment.isAbnormal, true);
  assert.equal(hypo.assessment.statusLabel, "Hypothermia");
});

test("evaluatePatientVitals aggregates abnormal vitals and reports clinical instability", () => {
  const stable = evaluatePatientVitals({
    bloodPressure: "118/76",
    heartRate: 72,
    temperature: 36.8,
  });
  assert.equal(stable.hasInstability, false);
  assert.equal(stable.abnormalCount, 0);

  const unstable = evaluatePatientVitals({
    bloodPressure: "148/94",
    heartRate: 114,
    temperature: 38.7,
  });
  assert.equal(unstable.hasInstability, true);
  assert.equal(unstable.abnormalCount, 3);
  assert.ok(unstable.instabilitySummary.includes("Clinical Instability Detected"));
});

test("getInitialPatientVitals prioritizes saved vitals and falls back to clinical context", () => {
  const withSaved = getInitialPatientVitals({
    vitals: [{ bloodPressure: "142/90", heartRate: 104, temperature: 38.4 }],
  });
  assert.deepEqual(withSaved, {
    bloodPressure: "142/90",
    heartRate: 104,
    temperature: 38.4,
  });

  const standard = getInitialPatientVitals({ diabetes: false, cases: [] });
  assert.deepEqual(standard, {
    bloodPressure: "120/78",
    heartRate: 74,
    temperature: 36.8,
  });
});

test("buildVitalSparklineSeries returns chronological genuine readings up to last 5 and flags abnormal points", () => {
  const logs = [
    { bloodPressure: "148/94", heartRate: 112, temperature: 38.4, createdAt: "2026-10-30 10:00:00" },
    { bloodPressure: "136/86", heartRate: 98, temperature: 37.6, createdAt: "2026-10-30 08:00:00" },
    { bloodPressure: "128/82", heartRate: 88, temperature: 37.2, createdAt: "2026-10-30 06:00:00" },
    { bloodPressure: "122/78", heartRate: 78, temperature: 36.9, createdAt: "2026-10-30 04:00:00" },
  ];
  const series = buildVitalSparklineSeries(
    logs,
    { bloodPressure: "154/96", heartRate: 118, temperature: 38.9 }
  );
  assert.equal(series.length, 5);
  assert.equal(series[0].readingLabel, "#1");
  assert.equal(series[0].systolic, 122);
  assert.equal(series[4].readingLabel, "Latest");
  assert.equal(series[4].systolic, 154);
  assert.equal(series[4].diastolic, 96);
  assert.equal(series[4].heartRate, 118);
  assert.equal(series[4].bpAbnormal, true);
  assert.equal(series[4].hrAbnormal, true);
});

