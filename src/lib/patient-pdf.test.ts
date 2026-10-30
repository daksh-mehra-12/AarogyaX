import test from "node:test";
import assert from "node:assert/strict";
import { buildPatientPdfData } from "./patient-pdf";

test("buildPatientPdfData formats complete patient demographics, AMR evaluations, cases, and ADRs", () => {
  const result = buildPatientPdfData({
    id: 7,
    patientId: "PT-0007",
    name: "Aarav Sharma",
    age: 54,
    gender: "Male",
    phone: "+91-9876543210",
    bloodGroup: "O+",
    medicalHistory: "Type 2 Diabetes Mellitus, CKD Stage 2",
    allergies: "Penicillin",
    createdAt: "2026-10-25T10:30:00Z",
    amrRecords: [
      {
        caseId: "AMR-101",
        organism: "Klebsiella pneumoniae",
        sampleType: "Blood",
        infectionType: "BSI",
        resistanceRisk: "High",
        riskScore: 0.84,
        recommendedAntibiotics: ["Meropenem", "Amikacin"],
        avoidAntibiotics: ["Ceftriaxone"],
        rationale: "## Clinical Summary\n**ESBL suspected**",
        createdAt: "2026-10-26T08:00:00Z",
      },
    ],
    cases: [
      {
        id: 12,
        organism: "Klebsiella pneumoniae",
        infectionType: "Bacteremia",
        specimenType: "Blood Culture",
        status: "Active",
        empiricalTherapy: "Meropenem 1g IV q8h",
        createdAt: "2026-10-26T09:00:00Z",
      },
    ],
    adrReports: [
      {
        id: 3,
        suspectedDrug: "Ceftriaxone",
        reactionDescription: "Maculopapular rash",
        severity: "Moderate",
        outcome: "Recovering",
        status: "Under Review",
        createdAt: "2026-10-26T11:00:00Z",
      },
    ],
  });

  assert.equal(result.patientCode, "PT-0007");
  assert.equal(result.patientName, "Aarav Sharma");
  assert.equal(result.age, "54 years");
  assert.equal(result.filename, "AarogyaX-Patient-PT-0007-aarav-sharma.pdf");
  assert.equal(result.amrRecords.length, 1);
  assert.equal(result.amrRecords[0].riskScore, "84%");
  assert.equal(result.amrRecords[0].recommendedAntibiotics, "Meropenem, Amikacin");
  assert.equal(result.clinicalCases.length, 1);
  assert.equal(result.adrReports.length, 1);
  assert.equal(result.adrReports[0].suspectedDrug, "Ceftriaxone");
});

test("buildPatientPdfData safely handles missing optional fields and empty history lists", () => {
  const result = buildPatientPdfData({
    id: 1,
    name: "Meera Nair",
  });

  assert.equal(result.patientCode, "PT-0001");
  assert.equal(result.patientName, "Meera Nair");
  assert.equal(result.amrRecords.length, 0);
  assert.equal(result.clinicalCases.length, 0);
  assert.equal(result.adrReports.length, 0);
  assert.equal(result.allergies, "No known drug allergies (NKDA).");
});
