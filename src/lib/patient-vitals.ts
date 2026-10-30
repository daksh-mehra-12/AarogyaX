export interface VitalReadingInput {
  bloodPressure: string; // e.g. "120/80"
  heartRate: number | string; // e.g. 74
  temperature: number | string; // e.g. 37.0 (°C)
}

export type VitalSeverity = "normal" | "elevated" | "critical";

export interface VitalSignAssessment {
  key: "bloodPressure" | "heartRate" | "temperature";
  label: string;
  formattedValue: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  severity: VitalSeverity;
  statusLabel: string;
  clinicalNote: string;
  secondaryMetric?: string;
}

export interface PatientVitalsEvaluation {
  bp: VitalSignAssessment;
  hr: VitalSignAssessment;
  temp: VitalSignAssessment;
  parsedSystolic: number | null;
  parsedDiastolic: number | null;
  parsedHeartRate: number | null;
  parsedTemperature: number | null;
  meanArterialPressure: number | null;
  hasInstability: boolean;
  abnormalCount: number;
  instabilitySummary: string;
}

/**
 * Parses a blood pressure string such as "120/80" or "145 / 92" into systolic and diastolic numbers.
 */
export function parseBloodPressure(raw: string): { systolic: number | null; diastolic: number | null } {
  if (!raw || typeof raw !== "string") {
    return { systolic: null, diastolic: null };
  }
  const trimmed = raw.trim();
  const slashMatch = trimmed.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  if (slashMatch) {
    const sys = Number(slashMatch[1]);
    const dia = Number(slashMatch[2]);
    if (Number.isFinite(sys) && Number.isFinite(dia) && sys > 0 && dia > 0) {
      return { systolic: sys, diastolic: dia };
    }
  }
  const singleMatch = trimmed.match(/^(\d{2,3})$/);
  if (singleMatch) {
    const sys = Number(singleMatch[1]);
    if (Number.isFinite(sys) && sys > 0) {
      return { systolic: sys, diastolic: Math.round(sys * 0.65) };
    }
  }
  return { systolic: null, diastolic: null };
}

/**
 * Evaluates Blood Pressure against normal clinical thresholds (90-129 / 60-84 mmHg).
 */
export function evaluateBloodPressure(rawBp: string): {
  assessment: VitalSignAssessment;
  systolic: number | null;
  diastolic: number | null;
  map: number | null;
} {
  const { systolic, diastolic } = parseBloodPressure(rawBp);

  if (systolic === null || diastolic === null) {
    return {
      systolic: null,
      diastolic: null,
      map: null,
      assessment: {
        key: "bloodPressure",
        label: "Blood Pressure",
        formattedValue: rawBp.trim() || "—/—",
        unit: "mmHg",
        referenceRange: "90–129 / 60–84 mmHg",
        isAbnormal: false,
        severity: "normal",
        statusLabel: "Awaiting Reading",
        clinicalNote: "Enter systolic/diastolic in mmHg (e.g. 120/80)",
      },
    };
  }

  const map = Math.round((systolic + 2 * diastolic) / 3);
  const formattedValue = `${systolic}/${diastolic}`;
  const secondaryMetric = `MAP ${map} mmHg`;

  if (systolic >= 180 || diastolic >= 120) {
    return {
      systolic,
      diastolic,
      map,
      assessment: {
        key: "bloodPressure",
        label: "Blood Pressure",
        formattedValue,
        unit: "mmHg",
        referenceRange: "90–129 / 60–84 mmHg",
        isAbnormal: true,
        severity: "critical",
        statusLabel: "Hypertensive Crisis",
        clinicalNote: "Critical BP elevation (≥180/120 mmHg) — immediate assessment required",
        secondaryMetric,
      },
    };
  }

  if (systolic < 90 || diastolic < 60) {
    return {
      systolic,
      diastolic,
      map,
      assessment: {
        key: "bloodPressure",
        label: "Blood Pressure",
        formattedValue,
        unit: "mmHg",
        referenceRange: "90–129 / 60–84 mmHg",
        isAbnormal: true,
        severity: "critical",
        statusLabel: "Hypotension Alert",
        clinicalNote: "Below normal perfusion threshold (<90/60 mmHg) — screen for sepsis/shock",
        secondaryMetric,
      },
    };
  }

  if (systolic >= 140 || diastolic >= 90) {
    return {
      systolic,
      diastolic,
      map,
      assessment: {
        key: "bloodPressure",
        label: "Blood Pressure",
        formattedValue,
        unit: "mmHg",
        referenceRange: "90–129 / 60–84 mmHg",
        isAbnormal: true,
        severity: "critical",
        statusLabel: "Stage 2 Hypertension",
        clinicalNote: "Exceeds normal arterial pressure threshold (≥140/90 mmHg)",
        secondaryMetric,
      },
    };
  }

  if (systolic >= 130 || diastolic >= 85) {
    return {
      systolic,
      diastolic,
      map,
      assessment: {
        key: "bloodPressure",
        label: "Blood Pressure",
        formattedValue,
        unit: "mmHg",
        referenceRange: "90–129 / 60–84 mmHg",
        isAbnormal: true,
        severity: "elevated",
        statusLabel: "Stage 1 Hypertension",
        clinicalNote: "Above optimal range (≥130/85 mmHg) — monitor hemodynamic trend",
        secondaryMetric,
      },
    };
  }

  return {
    systolic,
    diastolic,
    map,
    assessment: {
      key: "bloodPressure",
      label: "Blood Pressure",
      formattedValue,
      unit: "mmHg",
      referenceRange: "90–129 / 60–84 mmHg",
      isAbnormal: false,
      severity: "normal",
      statusLabel: "Normotensive",
      clinicalNote: "Within normal adult hemodynamic reference range",
      secondaryMetric,
    },
  };
}

/**
 * Evaluates Heart Rate against normal adult resting clinical thresholds (60-100 bpm).
 */
export function evaluateHeartRate(rawHr: number | string): {
  assessment: VitalSignAssessment;
  heartRate: number | null;
} {
  const num = typeof rawHr === "number" ? rawHr : Number(String(rawHr).trim());
  if (!Number.isFinite(num) || num <= 0 || String(rawHr).trim() === "") {
    return {
      heartRate: null,
      assessment: {
        key: "heartRate",
        label: "Heart Rate",
        formattedValue: "—",
        unit: "bpm",
        referenceRange: "60–100 bpm",
        isAbnormal: false,
        severity: "normal",
        statusLabel: "Awaiting Reading",
        clinicalNote: "Enter resting pulse rate in beats per minute",
      },
    };
  }

  const hr = Math.round(num);

  if (hr >= 120) {
    return {
      heartRate: hr,
      assessment: {
        key: "heartRate",
        label: "Heart Rate",
        formattedValue: String(hr),
        unit: "bpm",
        referenceRange: "60–100 bpm",
        isAbnormal: true,
        severity: "critical",
        statusLabel: "Severe Tachycardia",
        clinicalNote: "Markedly elevated pulse (≥120 bpm) — evaluate SIRS/sepsis or arrhythmia",
      },
    };
  }

  if (hr > 100) {
    return {
      heartRate: hr,
      assessment: {
        key: "heartRate",
        label: "Heart Rate",
        formattedValue: String(hr),
        unit: "bpm",
        referenceRange: "60–100 bpm",
        isAbnormal: true,
        severity: "elevated",
        statusLabel: "Tachycardia",
        clinicalNote: "Exceeds normal resting threshold (>100 bpm)",
      },
    };
  }

  if (hr < 50) {
    return {
      heartRate: hr,
      assessment: {
        key: "heartRate",
        label: "Heart Rate",
        formattedValue: String(hr),
        unit: "bpm",
        referenceRange: "60–100 bpm",
        isAbnormal: true,
        severity: "critical",
        statusLabel: "Severe Bradycardia",
        clinicalNote: "Critically low ventricular rate (<50 bpm)",
      },
    };
  }

  if (hr < 60) {
    return {
      heartRate: hr,
      assessment: {
        key: "heartRate",
        label: "Heart Rate",
        formattedValue: String(hr),
        unit: "bpm",
        referenceRange: "60–100 bpm",
        isAbnormal: true,
        severity: "elevated",
        statusLabel: "Bradycardia",
        clinicalNote: "Below normal resting threshold (<60 bpm)",
      },
    };
  }

  return {
    heartRate: hr,
    assessment: {
      key: "heartRate",
      label: "Heart Rate",
      formattedValue: String(hr),
      unit: "bpm",
      referenceRange: "60–100 bpm",
      isAbnormal: false,
      severity: "normal",
      statusLabel: "Normal Sinus Rate",
      clinicalNote: "Within normal resting cardiac range (60–100 bpm)",
    },
  };
}

/**
 * Evaluates Core Temperature against normal clinical thresholds (36.0-37.7 °C).
 * Automatically converts Fahrenheit (> 45) to Celsius if entered in °F.
 */
export function evaluateTemperature(rawTemp: number | string): {
  assessment: VitalSignAssessment;
  temperature: number | null;
} {
  const num = typeof rawTemp === "number" ? rawTemp : Number(String(rawTemp).trim());
  if (!Number.isFinite(num) || num <= 0 || String(rawTemp).trim() === "") {
    return {
      temperature: null,
      assessment: {
        key: "temperature",
        label: "Temperature",
        formattedValue: "—",
        unit: "°C",
        referenceRange: "36.0–37.7 °C",
        isAbnormal: false,
        severity: "normal",
        statusLabel: "Awaiting Reading",
        clinicalNote: "Enter core body temperature in °C",
      },
    };
  }

  // Convert Fahrenheit to Celsius if clinician entered > 45 (e.g. 98.6 or 101.5)
  const tempC = num > 45 ? Number((((num - 32) * 5) / 9).toFixed(1)) : Number(num.toFixed(1));
  const tempF = ((tempC * 9) / 5 + 32).toFixed(1);
  const secondaryMetric = `${tempF} °F`;

  if (tempC >= 38.5) {
    return {
      temperature: tempC,
      assessment: {
        key: "temperature",
        label: "Temperature",
        formattedValue: tempC.toFixed(1),
        unit: "°C",
        referenceRange: "36.0–37.7 °C",
        isAbnormal: true,
        severity: "critical",
        statusLabel: "High Fever (Pyrexia)",
        clinicalNote: "Significant febrile response (≥38.5 °C) — correlate with blood cultures/AMR",
        secondaryMetric,
      },
    };
  }

  if (tempC >= 37.8) {
    return {
      temperature: tempC,
      assessment: {
        key: "temperature",
        label: "Temperature",
        formattedValue: tempC.toFixed(1),
        unit: "°C",
        referenceRange: "36.0–37.7 °C",
        isAbnormal: true,
        severity: "elevated",
        statusLabel: "Febrile",
        clinicalNote: "Exceeds normal core temperature threshold (≥37.8 °C)",
        secondaryMetric,
      },
    };
  }

  if (tempC < 36.0) {
    return {
      temperature: tempC,
      assessment: {
        key: "temperature",
        label: "Temperature",
        formattedValue: tempC.toFixed(1),
        unit: "°C",
        referenceRange: "36.0–37.7 °C",
        isAbnormal: true,
        severity: "critical",
        statusLabel: "Hypothermia",
        clinicalNote: "Below normal core temperature (<36.0 °C) — evaluate systemic response",
        secondaryMetric,
      },
    };
  }

  return {
    temperature: tempC,
    assessment: {
      key: "temperature",
      label: "Temperature",
      formattedValue: tempC.toFixed(1),
      unit: "°C",
      referenceRange: "36.0–37.7 °C",
      isAbnormal: false,
      severity: "normal",
      statusLabel: "Afebrile (Normothermic)",
      clinicalNote: "Within normal thermoregulatory range (36.0–37.7 °C)",
      secondaryMetric,
    },
  };
}

/**
 * Evaluates all three patient vital signs and returns a unified clinical instability assessment.
 */
export function evaluatePatientVitals(input: VitalReadingInput): PatientVitalsEvaluation {
  const bpRes = evaluateBloodPressure(input.bloodPressure);
  const hrRes = evaluateHeartRate(input.heartRate);
  const tempRes = evaluateTemperature(input.temperature);

  const abnormalAssessments = [bpRes.assessment, hrRes.assessment, tempRes.assessment].filter(
    (a) => a.isAbnormal
  );

  const hasInstability = abnormalAssessments.length > 0;
  const instabilitySummary = hasInstability
    ? `Clinical Instability Detected: ${abnormalAssessments
        .map((a) => `${a.label} (${a.statusLabel}: ${a.formattedValue} ${a.unit})`)
        .join(" · ")}`
    : "All recorded vital signs are within normal clinical thresholds.";

  return {
    bp: bpRes.assessment,
    hr: hrRes.assessment,
    temp: tempRes.assessment,
    parsedSystolic: bpRes.systolic,
    parsedDiastolic: bpRes.diastolic,
    parsedHeartRate: hrRes.heartRate,
    parsedTemperature: tempRes.temperature,
    meanArterialPressure: bpRes.map,
    hasInstability,
    abnormalCount: abnormalAssessments.length,
    instabilitySummary,
  };
}

/**
 * Derives initial default vital signs for a patient based on clinical history or saved vitals.
 */
export function getInitialPatientVitals(patient: Record<string, any> | null | undefined): VitalReadingInput {
  const savedList = Array.isArray(patient?.vitals) ? patient.vitals : [];
  if (savedList.length > 0) {
    const latest = savedList[0];
    return {
      bloodPressure: latest.bloodPressure || `${latest.systolic || 120}/${latest.diastolic || 80}`,
      heartRate: latest.heartRate ?? 74,
      temperature: latest.temperature ?? 37.0,
    };
  }

  const recentCase = Array.isArray(patient?.cases) ? patient.cases[0] : null;
  const isSevere = recentCase?.severity === "severe" || recentCase?.icuStatus;
  const isModerate = recentCase?.severity === "moderate";

  if (isSevere) {
    return {
      bloodPressure: "94/58",
      heartRate: 108,
      temperature: 38.6,
    };
  }

  if (isModerate || patient?.diabetes) {
    return {
      bloodPressure: patient?.diabetes ? "136/86" : "124/80",
      heartRate: isModerate ? 92 : 76,
      temperature: isModerate ? 37.9 : 37.0,
    };
  }

  return {
    bloodPressure: "120/78",
    heartRate: 74,
    temperature: 36.8,
  };
}

export type SparklineVitalMetric = "bloodPressure" | "heartRate";

export interface VitalSparklinePoint {
  index: number; // 1..5 (oldest to newest)
  readingLabel: string; // e.g. "T-4", "T-3", "T-2", "T-1", "Latest"
  timestampLabel: string;
  bloodPressure: string;
  systolic: number;
  diastolic: number;
  map: number;
  heartRate: number;
  temperature: number;
  bpAbnormal: boolean;
  hrAbnormal: boolean;
}

/**
 * Builds a chronological series of up to the last 5 genuine recorded readings (oldest to latest)
 * for the embedded Recharts sparkline. Does not fabricate synthetic historical offset points.
 */
export function buildVitalSparklineSeries(
  recentLogs: Array<{
    bloodPressure?: string;
    systolic?: number | null;
    diastolic?: number | null;
    heartRate?: number | string;
    temperature?: number | string;
    createdAt?: string;
  }> = [],
  currentReading?: VitalReadingInput
): VitalSparklinePoint[] {
  const normalizedLogs: Array<{
    bloodPressure: string;
    systolic: number;
    diastolic: number;
    heartRate: number;
    temperature: number;
    timestampLabel: string;
  }> = [];

  for (const log of recentLogs) {
    const bpParsed = parseBloodPressure(
      log.bloodPressure || `${log.systolic ?? ""}/${log.diastolic ?? ""}`
    );
    const hrNum = Number(log.heartRate);
    const tempNum = Number(log.temperature);
    if (
      bpParsed.systolic === null ||
      bpParsed.diastolic === null ||
      !Number.isFinite(hrNum) ||
      hrNum <= 0
    ) {
      continue;
    }
    const sys = bpParsed.systolic;
    const dia = bpParsed.diastolic;
    const hr = Math.round(hrNum);
    const temp = Number.isFinite(tempNum) && tempNum > 0 ? Number(tempNum.toFixed(1)) : 36.8;
    const timeStr = log.createdAt
      ? log.createdAt.split(" ")[1]?.slice(0, 5) || log.createdAt.slice(0, 10)
      : "Recorded";

    normalizedLogs.push({
      bloodPressure: `${sys}/${dia}`,
      systolic: sys,
      diastolic: dia,
      heartRate: hr,
      temperature: temp,
      timestampLabel: timeStr,
    });
  }

  // If currentReading is valid and differs from the most recent saved reading, include it as the live reading
  if (currentReading) {
    const bpParsed = parseBloodPressure(currentReading.bloodPressure);
    const hrNum = Number(currentReading.heartRate);
    const tempNum = Number(currentReading.temperature);

    if (
      bpParsed.systolic !== null &&
      bpParsed.diastolic !== null &&
      Number.isFinite(hrNum) &&
      hrNum > 0
    ) {
      const sys = bpParsed.systolic;
      const dia = bpParsed.diastolic;
      const hr = Math.round(hrNum);
      const temp =
        Number.isFinite(tempNum) && tempNum > 0
          ? tempNum > 45
            ? Number((((tempNum - 32) * 5) / 9).toFixed(1))
            : Number(tempNum.toFixed(1))
          : 36.8;

      const latestFormattedBp = `${sys}/${dia}`;
      const topMatchesCurrent =
        normalizedLogs.length > 0 &&
        normalizedLogs[0].bloodPressure === latestFormattedBp &&
        normalizedLogs[0].heartRate === hr &&
        Math.abs(normalizedLogs[0].temperature - temp) < 0.05;

      if (!topMatchesCurrent) {
        normalizedLogs.unshift({
          bloodPressure: latestFormattedBp,
          systolic: sys,
          diastolic: dia,
          heartRate: hr,
          temperature: temp,
          timestampLabel: "Current",
        });
      }
    }
  }

  // Take up to the most recent 5 genuine readings and reverse to chronological order (oldest -> newest)
  const lastFiveChronological = normalizedLogs.slice(0, 5).reverse();
  const totalPoints = lastFiveChronological.length;

  return lastFiveChronological.map((item, idx) => {
    const bpEval = evaluateBloodPressure(item.bloodPressure);
    const hrEval = evaluateHeartRate(item.heartRate);
    const isLatest = idx === totalPoints - 1;
    return {
      index: idx + 1,
      readingLabel: isLatest ? "Latest" : `#${idx + 1}`,
      timestampLabel: item.timestampLabel,
      bloodPressure: item.bloodPressure,
      systolic: item.systolic,
      diastolic: item.diastolic,
      map: Math.round((item.systolic + 2 * item.diastolic) / 3),
      heartRate: item.heartRate,
      temperature: item.temperature,
      bpAbnormal: bpEval.assessment.isAbnormal,
      hrAbnormal: hrEval.assessment.isAbnormal,
    };
  });
}


