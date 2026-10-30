import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
  signOut,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App safely (singleton)
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);

export const GMAIL_SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.addons.current.action.compose",
  "https://www.googleapis.com/auth/gmail.addons.current.message.action",
  "https://www.googleapis.com/auth/gmail.addons.current.message.metadata",
  "https://www.googleapis.com/auth/gmail.addons.current.message.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.insert",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
];

const googleProvider = new GoogleAuthProvider();
GMAIL_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});
googleProvider.setCustomParameters({
  prompt: "consent",
  access_type: "offline",
});

// CRITICAL SECURITY CONSTRAINT: In-memory token storage only.
// NEVER persist access tokens to localStorage or sessionStorage.
let inMemoryAccessToken: string | null = null;
let inMemoryGoogleUser: FirebaseUser | null = null;
let isSigningIn = false;

// Subscriptions for auth state changes in UI
type AuthListener = (user: FirebaseUser | null, token: string | null) => void;
const listeners = new Set<AuthListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(inMemoryGoogleUser, inMemoryAccessToken);
    } catch (e) {
      console.error("Error in Gmail auth listener", e);
    }
  });
}

export function subscribeGmailAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  // Immediately notify of current state
  listener(inMemoryGoogleUser, inMemoryAccessToken);
  return () => {
    listeners.delete(listener);
  };
}

// Monitor Firebase Auth state
onAuthStateChanged(firebaseAuth, (user) => {
  inMemoryGoogleUser = user;
  if (!user) {
    inMemoryAccessToken = null;
  }
  notifyListeners();
});

export async function connectGmail(): Promise<{ user: FirebaseUser; token: string } | null> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Unable to obtain Google OAuth access token. Please verify permissions.");
    }
    inMemoryAccessToken = credential.accessToken;
    inMemoryGoogleUser = result.user;
    notifyListeners();
    return { user: result.user, token: inMemoryAccessToken };
  } catch (err: any) {
    if (
      err?.code === "auth/popup-closed-by-user" ||
      err?.code === "auth/cancelled-popup-request" ||
      err?.message?.includes("popup-closed-by-user")
    ) {
      // User closed the popup window - graceful dismissal, not a fatal exception
      return null;
    }
    if (err?.code === "auth/popup-blocked") {
      throw new Error("Google Sign-In popup was blocked by your browser. Please allow popups and try again.");
    }
    console.warn("Gmail Sign-In notice:", err?.message || err);
    throw err;
  } finally {
    isSigningIn = false;
  }
}

export async function disconnectGmail(): Promise<void> {
  await signOut(firebaseAuth);
  inMemoryAccessToken = null;
  inMemoryGoogleUser = null;
  notifyListeners();
}

export function getGmailAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function getGmailUser(): FirebaseUser | null {
  return inMemoryGoogleUser;
}

export function isGmailConnected(): boolean {
  return !!inMemoryAccessToken && !!inMemoryGoogleUser;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export async function fetchGmailProfile(): Promise<GmailProfile | null> {
  const token = inMemoryAccessToken;
  if (!token) return null;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Token expired or invalid
      inMemoryAccessToken = null;
      notifyListeners();
      throw new Error("Gmail session expired. Please reconnect your account.");
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to retrieve Gmail profile");
  }

  return res.json();
}

/**
 * Base64URL encode a UTF-8 string according to RFC 4648.
 * Replaces '+' with '-', '/' with '_', and strips trailing '=' padding.
 */
export function encodeBase64Url(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  fromName?: string;
  fromEmail?: string;
}

export interface SendEmailResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
}

/**
 * Builds a MIME RFC 2822 formatted email message string
 */
export function buildRfc2822Email({
  to,
  subject,
  bodyHtml,
  bodyText,
  fromName = "Aarogya X Clinical Portal",
  fromEmail,
}: SendEmailPayload): string {
  const senderHeader = fromEmail
    ? `From: "${fromName}" <${fromEmail}>`
    : `From: "${fromName}"`;

  const boundary = `====_Aarogya_Email_Boundary_${Date.now()}====`;
  const textContent = bodyText || bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // Multi-part alternative email with both plain text and rich HTML
  const lines = [
    senderHeader,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${encodeBase64Url(subject)}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    textContent,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyHtml,
    "",
    `--${boundary}--`,
  ];

  return lines.join("\r\n");
}

/**
 * Sends an email using Gmail REST API messages.send endpoint
 */
export async function sendEmailViaGmail(payload: SendEmailPayload): Promise<SendEmailResponse> {
  const token = inMemoryAccessToken;
  if (!token) {
    throw new Error("No active Gmail authentication token found. Please sign in with Google first.");
  }

  const senderEmail = inMemoryGoogleUser?.email || undefined;
  const rawEmail = buildRfc2822Email({
    ...payload,
    fromEmail: senderEmail,
  });

  const base64UrlRaw = encodeBase64Url(rawEmail);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: base64UrlRaw,
    }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      inMemoryAccessToken = null;
      notifyListeners();
      throw new Error("Gmail authorization expired. Please click 'Connect Gmail' to re-authenticate.");
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to send email via Gmail (Status ${res.status})`);
  }

  return res.json();
}

/**
 * Generates HTML for an Automated Patient Health Alert
 */
export function generateHealthAlertHtml({
  patient,
  alertTitle,
  alertLevel,
  findings,
  recommendedAction,
  doctorNotes,
  senderName,
}: {
  patient: { name: string; patientId: string; age?: number; gender?: string; region?: string };
  alertTitle: string;
  alertLevel: "CRITICAL" | "HIGH" | "MODERATE" | "INFO";
  findings: string[];
  recommendedAction?: string;
  doctorNotes?: string;
  senderName?: string;
}): string {
  const levelColors = {
    CRITICAL: { bg: "#dc2626", lightBg: "#fef2f2", text: "#991b1b", border: "#f87171" },
    HIGH: { bg: "#ea580c", lightBg: "#fff7ed", text: "#9a3412", border: "#fb923c" },
    MODERATE: { bg: "#d97706", lightBg: "#fffbeb", text: "#92400e", border: "#fcd34d" },
    INFO: { bg: "#0284c7", lightBg: "#f0f9ff", text: "#075985", border: "#7dd3fc" },
  }[alertLevel];

  const findingsList = findings.map((f) => `<li style="margin-bottom: 6px;">${f}</li>`).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${alertTitle}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${levelColors.bg};">
      <div>
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">
          Aarogya <span style="color: #00d2b4;">X</span> Clinical Alert
        </h1>
        <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">
          Automated Patient Health & Antimicrobial Surveillance
        </p>
      </div>
      <div style="background-color: ${levelColors.bg}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">
        ${alertLevel} ALERT
      </div>
    </div>

    <!-- Body -->
    <div style="padding: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a; font-weight: 700;">
        ${alertTitle}
      </h2>

      <!-- Patient Summary Box -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; width: 35%;">Patient Name:</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${patient.name}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Patient Record ID:</td>
            <td style="padding: 4px 0; font-family: monospace; font-weight: 600; color: #0284c7;">${patient.patientId}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Demographics:</td>
            <td style="padding: 4px 0; color: #334155;">
              ${patient.age ? `${patient.age} yrs` : "N/A"} • ${patient.gender || "N/A"} • Region: ${patient.region || "General"}
            </td>
          </tr>
        </table>
      </div>

      <!-- Critical Findings -->
      <div style="background-color: ${levelColors.lightBg}; border-left: 4px solid ${levelColors.bg}; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: ${levelColors.text};">
          Key Clinical Indicators & Findings:
        </h3>
        <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: ${levelColors.text}; line-height: 1.5;">
          ${findingsList}
        </ul>
      </div>

      ${
        recommendedAction
          ? `
      <!-- Recommended Action -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #166534; text-transform: uppercase;">
          Recommended Clinical Course of Action:
        </h4>
        <p style="margin: 0; font-size: 13px; color: #15803d; line-height: 1.45; font-weight: 600;">
          ${recommendedAction}
        </p>
      </div>`
          : ""
      }

      ${
        doctorNotes
          ? `
      <!-- Clinician Notes -->
      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">
          Physician / Provider Notes:
        </h4>
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px 14px; font-size: 13px; color: #334155; font-style: italic;">
          "${doctorNotes}"
        </div>
      </div>`
          : ""
      }

      <p style="margin: 16px 0 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
        This automated medical alert was generated via Aarogya X Antimicrobial & Clinical Management Platform by ${
          senderName || "the attending medical team"
        }. Please review patient records before making decisive medication alterations.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
      CONFIDENTIAL MEDICAL INFORMATION • AAROGYA X PLATFORM • NOT A REPLACEMENT FOR DIRECT CLINICAL TRIAGE
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generates HTML for a Comprehensive Patient Summary Report
 */
export function generatePatientSummaryHtml({
  patient,
  summaryTitle = "Comprehensive Patient Clinical & AMR Summary",
  amrRecords = [],
  clinicalCases = [],
  doctorNotes,
  senderName,
}: {
  patient: {
    name: string;
    patientId: string;
    age?: number;
    gender?: string;
    weight?: number;
    bloodGroup?: string;
    region?: string;
    diabetes?: boolean;
    ckd?: boolean;
    pregnancy?: boolean;
    immunocompromised?: boolean;
    createdAt?: string;
  };
  summaryTitle?: string;
  amrRecords?: any[];
  clinicalCases?: any[];
  doctorNotes?: string;
  senderName?: string;
}): string {
  const amrRows =
    amrRecords.length > 0
      ? amrRecords
          .slice(0, 5)
          .map(
            (r) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 10px; font-family: monospace; font-weight: 600; color: #0284c7;">${r.recordId || "REC"}</td>
          <td style="padding: 8px 10px; font-style: italic; color: #0f172a;">${r.organism || "N/A"}</td>
          <td style="padding: 8px 10px; text-transform: capitalize;">${r.specimenType?.replace("_", " ") || "N/A"}</td>
          <td style="padding: 8px 10px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; ${
              r.predictedRisk === "high"
                ? "background-color: #fee2e2; color: #991b1b;"
                : "background-color: #e0f2fe; color: #0369a1;"
            }">
              ${(r.predictedRisk || "standard").toUpperCase()}
            </span>
          </td>
          <td style="padding: 8px 10px; font-weight: 600; color: #166534;">${r.recommendedDrug || "Monitoring"}</td>
        </tr>
      `
          )
          .join("")
      : `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #94a3b8; font-style: italic;">No AMR laboratory records registered.</td></tr>`;

  const casesRows =
    clinicalCases.length > 0
      ? clinicalCases
          .slice(0, 4)
          .map(
            (c) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 10px; font-family: monospace; font-weight: 600;">#${c.caseNumber || c.id}</td>
          <td style="padding: 8px 10px; text-transform: uppercase;">${c.infectionType || "Infection"}</td>
          <td style="padding: 8px 10px;">${c.organism || "Pending"}</td>
          <td style="padding: 8px 10px; text-transform: capitalize;">${c.status || "Active"}</td>
        </tr>
      `
          )
          .join("")
      : `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8; font-style: italic;">No active hospital cases on record.</td></tr>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${summaryTitle}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <div style="max-width: 660px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #091728 0%, #0d2847 100%); padding: 22px 28px; border-bottom: 3px solid #00d2b4;">
      <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">
        Aarogya <span style="color: #00e5ff;">X</span> Patient Health Report
      </h1>
      <p style="margin: 4px 0 0; color: #38bdf8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600;">
        Official Clinical Summary & Antimicrobial Susceptibility Dossier
      </p>
    </div>

    <!-- Content -->
    <div style="padding: 26px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 18px;">
        <h2 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 700;">
          ${patient.name}
        </h2>
        <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: #0284c7; background: #f0f9ff; padding: 3px 8px; border-radius: 4px; border: 1px solid #bae6fd;">
          ID: ${patient.patientId}
        </span>
      </div>

      <!-- Demographics Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 12px;">
        <tr style="background-color: #f8fafc;">
          <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600; color: #64748b; width: 25%;">Age / Gender</td>
          <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #0f172a; width: 25%;">${patient.age ?? "N/A"} yrs / ${patient.gender ?? "N/A"}</td>
          <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600; color: #64748b; width: 25%;">Weight / Blood</td>
          <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #0f172a; width: 25%;">${patient.weight ? `${patient.weight} kg` : "N/A"} / ${patient.bloodGroup || "O+"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600; color: #64748b;">Clinical Risks</td>
          <td colspan="3" style="padding: 8px 10px; border: 1px solid #e2e8f0; color: #334155;">
            Diabetes: <strong>${patient.diabetes ? "Yes (Positive)" : "No"}</strong> •
            CKD: <strong>${patient.ckd ? "Yes (Positive)" : "No"}</strong> •
            Immunocompromised: <strong>${patient.immunocompromised ? "Yes (Positive)" : "No"}</strong>
          </td>
        </tr>
      </table>

      <!-- AMR Records Section -->
      <h3 style="margin: 0 0 8px; font-size: 14px; color: #0f172a; font-weight: 700;">
        Antimicrobial Resistance & Lab Tests (${amrRecords.length})
      </h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 12px; border: 1px solid #e2e8f0;">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569;">
            <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Test ID</th>
            <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Organism</th>
            <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Specimen</th>
            <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Risk Score</th>
            <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Recommended Drug</th>
          </tr>
        </thead>
        <tbody>
          ${amrRows}
        </tbody>
      </table>

      <!-- Clinical Cases -->
      <h3 style="margin: 0 0 8px; font-size: 14px; color: #0f172a; font-weight: 700;">
        Recent Hospital Cases (${clinicalCases.length})
      </h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 12px; border: 1px solid #e2e8f0;">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569;">
            <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Case #</th>
            <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Infection</th>
            <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Pathogen</th>
            <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${casesRows}
        </tbody>
      </table>

      ${
        doctorNotes
          ? `
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #334155; text-transform: uppercase;">
          Physician Consultation & Transition Notes:
        </h4>
        <p style="margin: 0; font-size: 13px; color: #1e293b; line-height: 1.5;">
          ${doctorNotes}
        </p>
      </div>`
          : ""
      }

      <div style="border-top: 1px dashed #cbd5e1; padding-top: 14px; font-size: 11px; color: #94a3b8;">
        Dispatched on ${new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })} by ${senderName || "Aarogya X Clinical Staff"}.
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
      CONFIDENTIAL PATIENT SUMMARY • AAROGYA X HEALTHCARE NETWORK
    </div>
  </div>
</body>
</html>
  `.trim();
}
