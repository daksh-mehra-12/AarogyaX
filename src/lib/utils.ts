import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { jsPDF } from "jspdf";
import { getLogoBase64 } from "./pdf-logo";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function downloadOfficialPvPIForm() {
  try {
    const res = await fetch("/api/official-docs/pvpi-form");
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Official-PvPI-Suspected-ADR-Reporting-Form.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
  } catch {
    // fallback to client-side generation
  }
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 14, CW = W - M * 2;
  const logoBase64 = await getLogoBase64();

  // Header Banner
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, W, 26, "F");

  let titleX = M;
  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", M, 3, 20, 20);
    titleX = M + 24;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SUSPECTED ADVERSE DRUG REACTION REPORTING FORM", titleX, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Pharmacovigilance Programme of India (PvPI) | NCC — Indian Pharmacopoeia Commission", titleX, 16);
  doc.text("Aarogya X Healthcare System — Official Voluntary ADR Reporting", titleX, 21);

  let y = 32;

  const sectionHeader = (title: string) => {
    doc.setFillColor(13, 148, 136);
    doc.rect(M, y, CW, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(title, M + 4, y + 4.2);
    doc.setTextColor(20, 20, 20);
    y += 9;
  };

  const blankBox = (label: string, height = 10) => {
    doc.setDrawColor(200, 200, 200);
    doc.rect(M, y, CW, height);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(label, M + 2, y + 4);
    y += height + 4;
  };

  sectionHeader("A. PATIENT INFORMATION");
  blankBox("1. Patient Initials / Name:                 2. Age / DOB:                 3. Sex: M / F / Other                 4. Weight (kg):", 12);

  sectionHeader("B. SUSPECTED ADVERSE REACTION");
  blankBox("5. Date of Reaction Onset (dd/mm/yyyy):                 6. Date of Recovery (if applicable):", 12);
  blankBox("7. Description of Reaction / Event with Relevant Lab Tests & Treatment Details:", 24);

  sectionHeader("C. SUSPECTED MEDICATION DETAILS");
  blankBox("8. Suspected Drug Name(s), Dose, Route, Frequency, & Therapy Dates (Start / Stop):", 20);

  sectionHeader("D. REPORTER INFORMATION");
  blankBox("9. Name & Professional Address of Reporter:                 10. Email / Phone:                 11. Date of Report:", 14);

  // Footer / Confidentiality Box
  doc.setDrawColor(220, 38, 38);
  doc.setFillColor(255, 242, 242);
  doc.roundedRect(M, y, CW, 20, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(220, 38, 38);
  doc.text("CONFIDENTIALITY NOTICE & HELPLINE", M + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  doc.text("Submission of an ADR report does not constitute an admission of legal liability.", M + 4, y + 10);
  doc.setFont("helvetica", "bold");
  doc.text("Toll Free Helpline: 1800 180 3024  |  Email: pvpi.ipc@gov.in  |  Website: www.ipc.gov.in", M + 4, y + 15);

  doc.save("Official-PvPI-ADR-Reporting-Form.pdf");
}
