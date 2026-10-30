import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encodeBase64Url,
  buildRfc2822Email,
  generateHealthAlertHtml,
  generatePatientSummaryHtml,
  GMAIL_SCOPES,
} from "./gmail";

describe("Gmail Service Logic", () => {
  it("includes mandatory Gmail scopes", () => {
    assert.ok(GMAIL_SCOPES.includes("https://mail.google.com/"));
    assert.ok(GMAIL_SCOPES.includes("https://www.googleapis.com/auth/gmail.send"));
    assert.ok(GMAIL_SCOPES.includes("https://www.googleapis.com/auth/gmail.compose"));
  });

  it("encodes string to RFC 4648 base64url without plus, slash, or padding", () => {
    const raw = "Patient Alert: High risk MRSA resistance detected!";
    const encoded = encodeBase64Url(raw);
    assert.ok(typeof encoded === "string");
    assert.ok(!encoded.includes("+"), "Should not contain +");
    assert.ok(!encoded.includes("/"), "Should not contain /");
    assert.ok(!encoded.endsWith("="), "Should not contain = padding");
  });

  it("handles UTF-8 characters properly in base64url encoding", () => {
    const specialStr = "Dr. Mehta: Aarogya X — Critical Alert ⚡️ & 💉";
    const encoded = encodeBase64Url(specialStr);
    assert.ok(encoded.length > 0);
  });

  it("builds a valid RFC 2822 email format", () => {
    const email = buildRfc2822Email({
      to: "physician@hospital.org",
      subject: "Urgent Patient Health Alert",
      bodyHtml: "<p>Critical antibiotic sensitivity update.</p>",
      fromName: "Dr. Sharma",
      fromEmail: "sharma@aarogya.health",
    });

    assert.ok(email.includes("To: physician@hospital.org"));
    assert.ok(email.includes('From: "Dr. Sharma" <sharma@aarogya.health>'));
    assert.ok(email.includes("Subject: =?UTF-8?B?"));
    assert.ok(email.includes("multipart/alternative"));
    assert.ok(email.includes("<p>Critical antibiotic sensitivity update.</p>"));
  });

  it("generates health alert HTML with patient details and critical findings", () => {
    const html = generateHealthAlertHtml({
      patient: {
        name: "Aarav Sharma",
        patientId: "PAT-0091",
        age: 45,
        gender: "Male",
        region: "North Delhi",
      },
      alertTitle: "Critical AMR Resistance Detected",
      alertLevel: "CRITICAL",
      findings: [
        "Pathogen: Klebsiella pneumoniae (ESBL-producing)",
        "Resistant to: Ciprofloxacin, Ceftriaxone",
        "Susceptible to: Meropenem",
      ],
      recommendedAction: "Switch immediately to IV Meropenem 1g TID and isolate contact.",
      doctorNotes: "Consultant infectious disease review pending.",
    });

    assert.ok(html.includes("Aarav Sharma"));
    assert.ok(html.includes("PAT-0091"));
    assert.ok(html.includes("CRITICAL ALERT"));
    assert.ok(html.includes("Klebsiella pneumoniae"));
    assert.ok(html.includes("IV Meropenem"));
    assert.ok(html.includes("Consultant infectious disease review pending"));
  });

  it("generates patient summary HTML report", () => {
    const html = generatePatientSummaryHtml({
      patient: {
        name: "Sunita Patel",
        patientId: "PAT-1042",
        age: 52,
        gender: "Female",
        weight: 64,
        bloodGroup: "B+",
        diabetes: true,
        ckd: false,
      },
      amrRecords: [
        {
          recordId: "AMR-992",
          organism: "Pseudomonas aeruginosa",
          specimenType: "blood",
          predictedRisk: "high",
          recommendedDrug: "Colistin",
        },
      ],
      clinicalCases: [
        {
          id: 1,
          caseNumber: "CASE-441",
          infectionType: "sepsis",
          organism: "Pseudomonas",
          status: "in-treatment",
        },
      ],
      doctorNotes: "Patient stable on current supportive care regimen.",
    });

    assert.ok(html.includes("Sunita Patel"));
    assert.ok(html.includes("PAT-1042"));
    assert.ok(html.includes("Pseudomonas aeruginosa"));
    assert.ok(html.includes("Colistin"));
    assert.ok(html.includes("CASE-441"));
    assert.ok(html.includes("Patient stable on current supportive care regimen."));
  });
});
