import { jsPDF } from "jspdf";
import { getLogoBase64 } from "./pdf-logo";

export interface PatientPdfData {
  patientCode: string;
  patientName: string;
  age: string;
  gender: string;
  phone?: string;
  email?: string;
  address?: string;
  weight: string;
  region: string;
  bloodGroup: string;
  diabetes: boolean;
  ckd: boolean;
  pregnancy: boolean;
  immunocompromised: boolean;
  medicalHistory: string;
  allergies: string;
  registeredDate: string;
  filename: string;
  amrRecords: Array<{
    caseId: string;
    organism: string;
    sampleType: string;
    infectionType: string;
    resistanceRisk: string;
    riskScore: string;
    recommendedAntibiotics: string;
    avoidAntibiotics: string;
    susceptibilitiesSummary?: string;
    rationale: string;
    createdAt: string;
  }>;
  clinicalCases: Array<{
    id: string;
    organism: string;
    infectionType: string;
    specimenType: string;
    status: string;
    empiricalTherapy: string;
    createdAt: string;
  }>;
  adrReports: Array<{
    id: string;
    suspectedDrug: string;
    reactionDescription: string;
    severity: string;
    outcome: string;
    status: string;
    createdAt: string;
  }>;
}

export function buildPatientPdfData(rawPatient: Record<string, any>): PatientPdfData {
  const id = rawPatient?.id ?? "0";
  const patientCode = String(rawPatient?.patientId || `PT-${String(id).padStart(4, "0")}`);
  const patientName = String(rawPatient?.name || "Unknown Patient").trim();
  const safeSlug =
    patientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "patient";

  const formatDate = (val: unknown): string => {
    if (!val) return "N/A";
    const d = new Date(String(val));
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toISOString().split("T")[0];
  };

  const toListString = (val: unknown): string => {
    if (Array.isArray(val)) return val.filter(Boolean).join(", ") || "None specified";
    if (typeof val === "string" && val.trim()) return val.trim();
    return "None specified";
  };

  // Map AMR Records (handles real backend AMR records + legacy shape)
  const rawAmr = Array.isArray(rawPatient?.amrRecords) ? rawPatient.amrRecords : [];
  const amrRecords = rawAmr.map((rec: Record<string, any>, idx: number) => {
    const caseId = String(rec?.recordId || rec?.caseId || `AMR-${idx + 1}`);
    const organism = String(rec?.organism || "Unspecified Organism");
    const sampleType = String(rec?.specimenType || rec?.sampleType || "Clinical Sample").replace("_", " ");
    const infectionType = String(rec?.infectionType || "Infection");
    const resistanceRisk = String(rec?.predictedRisk || rec?.resistanceRisk || "Standard");

    // Format risk score
    let riskScore = "N/A";
    if (rec?.riskScore !== undefined && rec?.riskScore !== null) {
      const num = Number(rec.riskScore);
      riskScore = `${Math.round(num <= 1 ? num * 100 : num)}%`;
    }

    // Recommended antibiotics
    let recommendedAntibiotics = "Monitoring / Standard care";
    if (rec?.recommendedDrug) {
      recommendedAntibiotics = String(rec.recommendedDrug);
    } else if (rec?.recommendedAntibiotics) {
      recommendedAntibiotics = toListString(rec.recommendedAntibiotics);
    }

    // Avoid / resistant antibiotics
    let avoidAntibiotics = "None flagged";
    if (Array.isArray(rec?.susceptibilities) && rec.susceptibilities.length > 0) {
      const resistantList = rec.susceptibilities
        .filter((s: any) => s.susceptibility === "Resistant")
        .map((s: any) => s.antibiotic);
      if (resistantList.length > 0) {
        avoidAntibiotics = resistantList.join(", ");
      }
    } else if (rec?.avoidAntibiotics) {
      avoidAntibiotics = toListString(rec.avoidAntibiotics);
    }

    // Susceptibilities summary
    let susceptibilitiesSummary: string | undefined;
    if (Array.isArray(rec?.susceptibilities) && rec.susceptibilities.length > 0) {
      susceptibilitiesSummary = rec.susceptibilities
        .map((s: any) => `${s.antibiotic}: ${s.susceptibility}`)
        .join(" | ");
    }

    const rationale = String(rec?.rationale || "Microbiological culture and sensitivity profile on record.").replace(
      /[#*_`]/g,
      ""
    );
    const createdAt = formatDate(rec?.collectionDate || rec?.createdAt);

    return {
      caseId,
      organism,
      sampleType,
      infectionType,
      resistanceRisk,
      riskScore,
      recommendedAntibiotics,
      avoidAntibiotics,
      susceptibilitiesSummary,
      rationale,
      createdAt,
    };
  });

  const rawCases = Array.isArray(rawPatient?.cases) ? rawPatient.cases : [];
  const clinicalCases = rawCases.map((c: Record<string, any>, idx: number) => ({
    id: String(c?.caseNumber || c?.id || idx + 1),
    organism: String(c?.organism || "Pending culture"),
    infectionType: String(c?.infectionType || "Clinical").toUpperCase(),
    specimenType: String(c?.specimenType || "Standard").replace("_", " "),
    status: String(c?.status || "Active").toUpperCase(),
    empiricalTherapy: String(c?.prediction?.recommendedDrug || c?.empiricalTherapy || "Standard protocol"),
    createdAt: formatDate(c?.createdAt),
  }));

  const rawAdr = Array.isArray(rawPatient?.adrReports) ? rawPatient.adrReports : [];
  const adrReports = rawAdr.map((a: Record<string, any>, idx: number) => ({
    id: String(a?.reportNumber || a?.id || idx + 1),
    suspectedDrug: String(a?.suspectedDrug || a?.drugName || "Unspecified Drug"),
    reactionDescription: String(a?.reactionDescription || a?.reactionType || "Adverse reaction logged"),
    severity: String(a?.severity || "Moderate").toUpperCase(),
    outcome: String(a?.outcome || "Recovering"),
    status: String(a?.status || "Submitted"),
    createdAt: formatDate(a?.createdAt),
  }));

  const diabetes = Boolean(rawPatient?.diabetes);
  const ckd = Boolean(rawPatient?.ckd);
  const pregnancy = Boolean(rawPatient?.pregnancy);
  const immunocompromised = Boolean(rawPatient?.immunocompromised);

  // Compute realistic medical history from risk factors if not explicitly provided
  let medicalHistory = rawPatient?.medicalHistory;
  if (!medicalHistory) {
    const risks = [];
    if (diabetes) risks.push("Type 2 Diabetes Mellitus");
    if (ckd) risks.push("Chronic Kidney Disease (CKD)");
    if (pregnancy) risks.push("Active Pregnancy");
    if (immunocompromised) risks.push("Immunocompromised State");

    medicalHistory =
      risks.length > 0
        ? risks.join(", ")
        : "No chronic comorbid risk factors documented.";
  }

  const allergies = String(rawPatient?.allergies || "No known drug allergies (NKDA).");

  return {
    patientCode,
    patientName,
    age: rawPatient?.age !== undefined && rawPatient?.age !== null ? `${rawPatient.age} years` : "N/A",
    gender: String(rawPatient?.gender || "Unspecified"),
    weight: rawPatient?.weight ? `${rawPatient.weight} kg` : "N/A",
    region: String(rawPatient?.region || "General"),
    bloodGroup: String(rawPatient?.bloodGroup || "O+"),
    diabetes,
    ckd,
    pregnancy,
    immunocompromised,
    medicalHistory,
    allergies,
    registeredDate: formatDate(rawPatient?.createdAt),
    filename: `AarogyaX-Patient-${patientCode}-${safeSlug}.pdf`,
    amrRecords,
    clinicalCases,
    adrReports,
  };
}

export async function exportPatientHistoryToPdf(
  rawPatient: Record<string, any>
): Promise<{ filename: string; data: PatientPdfData }> {
  const data = buildPatientPdfData(rawPatient);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 18) {
      doc.addPage();
      y = 16;
    }
  };

  // Top Header Banner
  doc.setFillColor(13, 148, 136); // Teal
  doc.rect(0, 0, pageWidth, 28, "F");

  const logoBase64 = await getLogoBase64();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "JPEG", margin, 5, 18, 18);
    } catch {
      // Fallback
    }
  }

  const titleX = logoBase64 ? margin + 22 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("AAROGYA X — OFFICIAL PATIENT CLINICAL DOSSIER", titleX, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Patient ID: ${data.patientCode}  |  Generated: ${new Date().toLocaleString("en-IN")}  |  Antimicrobial Surveillance`,
    titleX,
    19
  );

  y = 35;

  // Section Helper
  const drawSectionHeader = (title: string) => {
    ensureSpace(14);
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(153, 246, 228);
    doc.roundedRect(margin, y, contentWidth, 7.5, 1.5, 1.5, "FD");
    doc.setTextColor(15, 118, 110);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(title.toUpperCase(), margin + 3, y + 5.2);
    y += 11;
  };

  // 1. Demographics & Clinical Profile
  drawSectionHeader("1. Patient Demographics & Baseline Clinical Data");

  const drawRow = (l1: string, v1: string, l2: string, v2: string) => {
    ensureSpace(6.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${l1}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(v1, margin + 30, y);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(`${l2}:`, margin + contentWidth / 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(v2, margin + contentWidth / 2 + 30, y);
    y += 6;
  };

  drawRow("Full Name", data.patientName, "Record ID", data.patientCode);
  drawRow("Age / Gender", `${data.age} / ${data.gender}`, "Weight", data.weight);
  drawRow("Blood Group", data.bloodGroup, "Region / Ward", data.region);
  drawRow("Registered Date", data.registeredDate, "Surveillance Node", "Aarogya X Network");

  // Clinical Risk Matrix Row
  ensureSpace(14);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 10, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text("Clinical Risk Factors:", margin + 3, y + 6.5);

  const riskBadges = [
    `Diabetes: ${data.diabetes ? "POSITIVE" : "Negative"}`,
    `CKD: ${data.ckd ? "POSITIVE" : "Negative"}`,
    `Pregnancy: ${data.pregnancy ? "POSITIVE" : "Negative"}`,
    `Immunocompromised: ${data.immunocompromised ? "POSITIVE" : "Negative"}`,
  ].join("   |   ");

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(riskBadges, margin + 42, y + 6.5);
  y += 14;

  ensureSpace(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Comorbidities & Clinical Notes:", margin, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const medLines = doc.splitTextToSize(data.medicalHistory, contentWidth);
  doc.text(medLines, margin, y);
  y += medLines.length * 4.5 + 4;

  // 2. AMR Surveillance History
  drawSectionHeader(`2. Antimicrobial Resistance (AMR) Laboratory Records (${data.amrRecords.length})`);
  if (data.amrRecords.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("No AMR laboratory records recorded for this patient yet.", margin, y);
    y += 8;
  } else {
    data.amrRecords.forEach((rec, index) => {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `${index + 1}. [${rec.caseId}] Pathogen: ${rec.organism} — Risk: ${rec.resistanceRisk.toUpperCase()} (${rec.riskScore}) | Date: ${rec.createdAt}`,
        margin,
        y
      );
      y += 4.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`• Specimen: ${rec.sampleType} | Recommended Regimen: ${rec.recommendedAntibiotics}`, margin + 3, y);
      y += 4.2;
      doc.text(`• Resistant Markers / Avoid: ${rec.avoidAntibiotics}`, margin + 3, y);
      y += 4.2;

      if (rec.susceptibilitiesSummary) {
        doc.text(`• Susceptibility Panel: ${rec.susceptibilitiesSummary}`, margin + 3, y);
        y += 4.2;
      }
      y += 3;
    });
  }

  // 3. Clinical Cases
  if (data.clinicalCases.length > 0) {
    drawSectionHeader(`3. Hospital Clinical Cases (${data.clinicalCases.length})`);
    data.clinicalCases.forEach((c) => {
      ensureSpace(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`• Case #${c.id}: ${c.infectionType} (${c.specimenType}) — Status: ${c.status}`, margin + 3, y);
      y += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`  Pathogen: ${c.organism} | Targeted Therapy: ${c.empiricalTherapy} | Logged: ${c.createdAt}`, margin + 3, y);
      y += 5.5;
    });
  }

  // 4. Pharmacovigilance / ADRs
  if (data.adrReports.length > 0) {
    drawSectionHeader(`4. Pharmacovigilance Adverse Drug Reactions (${data.adrReports.length})`);
    data.adrReports.forEach((adr) => {
      ensureSpace(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(185, 28, 28);
      doc.text(`• ADR #${adr.id} — Suspected Drug: ${adr.suspectedDrug} (${adr.severity})`, margin + 3, y);
      y += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`  Reaction: ${adr.reactionDescription} | Outcome: ${adr.outcome} | Date: ${adr.createdAt}`, margin + 3, y);
      y += 5.5;
    });
  }

  // Footer & Page Numbers
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Aarogya X Healthcare System  |  Patient Record: ${data.patientCode}  |  Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  doc.save(data.filename);
  return { filename: data.filename, data };
}
