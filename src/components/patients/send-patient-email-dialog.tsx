import * as React from "react";
import { useGmail } from "@/hooks/use-gmail";
import {
  sendEmailViaGmail,
  generateHealthAlertHtml,
  generatePatientSummaryHtml,
} from "@/services/gmail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  AlertTriangle,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogOut,
  Send,
  Eye,
  Edit3,
} from "lucide-react";

export type EmailTemplateType = "health_alert" | "patient_summary" | "stewardship_advisory";

interface SendPatientEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: any;
  amrRecords?: any[];
  clinicalCases?: any[];
}

export function SendPatientEmailDialog({
  open,
  onOpenChange,
  patient,
  amrRecords = [],
  clinicalCases = [],
}: SendPatientEmailDialogProps) {
  const { toast } = useToast();
  const { isConnected, user, connect, disconnect, isLoading: isAuthLoading } = useGmail();

  const [templateType, setTemplateType] = React.useState<EmailTemplateType>("health_alert");
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [alertLevel, setAlertLevel] = React.useState<"CRITICAL" | "HIGH" | "MODERATE" | "INFO">("CRITICAL");
  const [doctorNotes, setDoctorNotes] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"compose" | "preview">("compose");

  const [showConfirm, setShowConfirm] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);

  // Derive latest AMR findings
  const latestAmr = amrRecords[0];

  // Set default subject and recipient based on patient & template
  React.useEffect(() => {
    if (!patient) return;

    if (templateType === "health_alert") {
      setSubject(`[URGENT CLINICAL ALERT] ${patient.name} (${patient.patientId}) - Antimicrobial Findings`);
      setDoctorNotes(
        latestAmr?.predictedRisk === "high"
          ? `High resistance risk profile detected. Suspected resistant pathogen: ${latestAmr.organism || "Pathogen"}. Immediate medication review recommended.`
          : `Automated surveillance notice for ${patient.name}. Review susceptibility panel for optimal stewardship.`
      );
    } else if (templateType === "patient_summary") {
      setSubject(`[AAROGYA X] Clinical Dossier & Patient Summary: ${patient.name} (${patient.patientId})`);
      setDoctorNotes("Comprehensive clinical summary for medical record archiving and transition of care.");
    } else {
      setSubject(`[STEWARDSHIP ADVISORY] Antibiotic De-escalation Plan: ${patient.name}`);
      setDoctorNotes("Stewardship review recommends narrow-spectrum targeted therapy based on culture sensitivities.");
    }
  }, [templateType, patient, latestAmr]);

  // Compute email HTML body
  const emailHtml = React.useMemo(() => {
    if (!patient) return "";

    if (templateType === "health_alert" || templateType === "stewardship_advisory") {
      const findings = [
        `Primary Specimen: ${latestAmr?.specimenType?.replace("_", " ") || "Clinical specimen"}`,
        `Identified Organism: ${latestAmr?.organism || "Gram-negative bacillus / Pathogen pending"}`,
        latestAmr?.predictedRisk
          ? `Predicted Resistance Level: ${latestAmr.predictedRisk.toUpperCase()} RISK`
          : "Standard Risk Classification",
        latestAmr?.susceptibilities?.length
          ? `Resistant Markers: ${latestAmr.susceptibilities
              .filter((s: any) => s.susceptibility === "Resistant")
              .map((s: any) => s.antibiotic)
              .join(", ") || "None flagged"}`
          : "Microbiology culture pending final sensitivity confirmation",
      ];

      return generateHealthAlertHtml({
        patient,
        alertTitle:
          templateType === "stewardship_advisory"
            ? "Antimicrobial Stewardship & Targeted Guidance"
            : `Automated Clinical Health Alert: ${latestAmr?.organism || "Pathogen Detected"}`,
        alertLevel: templateType === "stewardship_advisory" ? "MODERATE" : alertLevel,
        findings,
        recommendedAction:
          latestAmr?.recommendedDrug
            ? `Targeted Recommendation: ${latestAmr.recommendedDrug}. Cease empiric broad-spectrum coverage where appropriate.`
            : "Review microbiological susceptibility cultures before initiating tertiary line therapy.",
        doctorNotes,
        senderName: user?.displayName || user?.email || "Attending Physician",
      });
    }

    return generatePatientSummaryHtml({
      patient,
      summaryTitle: `Comprehensive Clinical Summary: ${patient.name}`,
      amrRecords,
      clinicalCases,
      doctorNotes,
      senderName: user?.displayName || user?.email || "Attending Medical Team",
    });
  }, [patient, templateType, alertLevel, doctorNotes, latestAmr, amrRecords, clinicalCases, user]);

  const handleOpenConfirm = () => {
    if (!recipientEmail.trim() || !recipientEmail.includes("@")) {
      toast({
        title: "Invalid Recipient Email",
        description: "Please enter a valid destination email address.",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "Gmail Not Connected",
        description: "Please connect your Gmail account via Google Sign-In first.",
        variant: "destructive",
      });
      return;
    }

    setShowConfirm(true);
  };

  const handleSendEmail = async () => {
    setShowConfirm(false);
    setIsSending(true);

    try {
      const response = await sendEmailViaGmail({
        to: recipientEmail.trim(),
        subject: subject.trim(),
        bodyHtml: emailHtml,
        fromName: user?.displayName || "Aarogya X Healthcare Portal",
        fromEmail: user?.email || undefined,
      });

      toast({
        title: "Email Sent Successfully",
        description: `Delivered via Gmail (Message ID: ${response.id.slice(0, 10)}...).`,
      });

      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Failed to Send Email",
        description: err instanceof Error ? err.message : "An error occurred while communicating with Gmail.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border">
          {/* Header */}
          <DialogHeader className="p-5 border-b border-border bg-muted/10 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Send Automated Patient Alert & Report
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Dispatched directly via your authenticated Gmail account for {patient?.name}
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                {patient?.patientId}
              </Badge>
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
            {/* Gmail Connection Status Card */}
            <div className="p-3.5 rounded-lg border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-900 border border-border shadow-xs flex items-center justify-center shrink-0">
                  {/* Google G Logo SVG */}
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground text-xs">Gmail Integration</span>
                    {isConnected ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                        Not Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isConnected
                      ? `Signed in as ${user?.email}`
                      : "Authorize Gmail to transmit reports and alerts directly from your clinical account."}
                  </p>
                </div>
              </div>

              <div>
                {isConnected ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={disconnect}
                    disabled={isAuthLoading}
                    className="text-xs text-muted-foreground hover:text-destructive h-8 gap-1.5"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={connect}
                    disabled={isAuthLoading}
                    data-testid="connect-gmail-btn"
                    className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-white dark:border-slate-700 text-xs font-semibold shadow-xs h-8 gap-2"
                  >
                    {isAuthLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    )}
                    Sign in with Google
                  </Button>
                )}
              </div>
            </div>

            {/* Template Selector Tabs */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Select Report Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateType("health_alert")}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    templateType === "health_alert"
                      ? "bg-rose-500/10 border-rose-500/50 text-rose-500"
                      : "bg-muted/10 border-border hover:bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    <span>Health Alert</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground line-clamp-2">
                    Urgent notification of AMR resistance or critical organism findings.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTemplateType("patient_summary")}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    templateType === "patient_summary"
                      ? "bg-primary/10 border-primary/50 text-primary"
                      : "bg-muted/10 border-border hover:bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground mb-1">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span>Summary Report</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground line-clamp-2">
                    Comprehensive clinical summary, history, and active case breakdown.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTemplateType("stewardship_advisory")}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    templateType === "stewardship_advisory"
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600"
                      : "bg-muted/10 border-border hover:bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground mb-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Stewardship Advisory</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground line-clamp-2">
                    Targeted antibiotic de-escalation and pharmacy stewardship notes.
                  </p>
                </button>
              </div>
            </div>

            {/* Compose vs Preview Switch */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-md border border-border">
                <Button
                  type="button"
                  size="sm"
                  variant={activeTab === "compose" ? "secondary" : "ghost"}
                  onClick={() => setActiveTab("compose")}
                  className="h-7 text-xs gap-1 px-3"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Compose
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeTab === "preview" ? "secondary" : "ghost"}
                  onClick={() => setActiveTab("preview")}
                  className="h-7 text-xs gap-1 px-3"
                >
                  <Eye className="h-3.5 w-3.5" /> HTML Preview
                </Button>
              </div>

              {templateType === "health_alert" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground font-medium">Alert Level:</span>
                  {(["CRITICAL", "HIGH", "MODERATE", "INFO"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setAlertLevel(lvl)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                        alertLevel === lvl
                          ? lvl === "CRITICAL"
                            ? "bg-rose-500 text-white border-rose-600"
                            : lvl === "HIGH"
                            ? "bg-amber-500 text-white border-amber-600"
                            : "bg-primary text-white border-primary"
                          : "bg-muted/20 text-muted-foreground border-border hover:bg-muted/40"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeTab === "compose" ? (
              <div className="space-y-3.5">
                {/* Recipient Email */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground">
                    Recipient Email Address <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="doctor@hospital.org or patient@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="h-9 text-xs"
                    data-testid="gmail-recipient-input"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Attending physician, infectious disease specialist, ICU unit, or patient caregiver.
                  </p>
                </div>

                {/* Email Subject */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground">Email Subject</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-9 text-xs"
                    data-testid="gmail-subject-input"
                  />
                </div>

                {/* Doctor's custom clinical note */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground">
                    Clinical Notes & Directives (Included in Email)
                  </label>
                  <Textarea
                    rows={3}
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Enter specific bedside instructions, isolation protocols, or follow-up schedules..."
                    className="text-xs resize-none"
                    data-testid="gmail-notes-input"
                  />
                </div>
              </div>
            ) : (
              /* Live Preview */
              <div className="border border-border rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-950 p-2">
                <div className="text-[11px] font-mono text-muted-foreground px-2 pb-1 border-b border-border/50 flex justify-between">
                  <span>To: {recipientEmail || "(recipient@example.com)"}</span>
                  <span>Subject: {subject}</span>
                </div>
                <div
                  className="p-3 bg-white text-slate-900 rounded mt-2 max-h-[300px] overflow-y-auto shadow-inner text-xs font-sans"
                  dangerouslySetInnerHTML={{ __html: emailHtml }}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-border bg-muted/10 shrink-0 flex flex-row items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {!isConnected && (
                <span className="text-[11px] text-amber-500 font-medium hidden sm:inline">
                  Google sign-in required before sending
                </span>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleOpenConfirm}
                disabled={!isConnected || isSending}
                data-testid="open-send-email-confirm-btn"
                className="gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transmitting...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" /> Send via Gmail
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mandatory User Confirmation Modal for Mutating Email Operation */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-card border border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Confirm Dispatch via Gmail
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <span>
                You are about to transmit a clinical alert from your authenticated account:
              </span>
              <div className="p-2.5 rounded-md bg-muted/30 border border-border text-foreground text-xs space-y-1 font-mono">
                <div>From: <strong>{user?.email}</strong></div>
                <div>To: <strong>{recipientEmail}</strong></div>
                <div>Subject: <strong>{subject}</strong></div>
                <div>Patient: <strong>{patient?.name} ({patient?.patientId})</strong></div>
              </div>
              <span className="block text-amber-600 dark:text-amber-400 font-medium pt-1">
                This will send an email through the Google Gmail API on your behalf.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendEmail}
              disabled={isSending}
              data-testid="confirm-send-gmail-btn"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold"
            >
              Confirm & Send Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
