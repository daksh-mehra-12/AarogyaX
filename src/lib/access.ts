/**
 * Role-Based Access Control Matrix for Aarogya X
 * Matches the required clinical security matrix:
 *   full = Full Access   limited = Read/View/Scoped Only   denied = Access Restricted
 */

export type AppRole = "intern" | "junior" | "consultant" | "admin";
export type AccessLevel = "full" | "limited" | "denied";

export interface RouteAccess {
  intern: AccessLevel;
  junior: AccessLevel;
  consultant: AccessLevel;
  admin: AccessLevel;
}

/** Central access matrix — keyed by route prefix */
export const ACCESS_MATRIX: Record<string, RouteAccess> = {
  "/dashboard":    { intern: "full",    junior: "full",    consultant: "full",    admin: "full" },
  "/patients/new": { intern: "full",    junior: "full",    consultant: "full",    admin: "denied" },
  "/patients":     { intern: "full",    junior: "full",    consultant: "full",    admin: "denied" },
  "/cases/new":    { intern: "full",    junior: "full",    consultant: "full",    admin: "denied" },
  "/cases":        { intern: "limited", junior: "full",    consultant: "full",    admin: "full" },
  "/predict":      { intern: "full",    junior: "full",    consultant: "full",    admin: "full" },
  "/amr-report":   { intern: "full",    junior: "full",    consultant: "full",    admin: "full" },
  "/amr/new font":    { intern: "full",    junior: "full",    consultant: "full",    admin: "denied" },
  "/amr-history": { intern: "full",    junior: "full",    consultant: "full",    admin: "full" },
  "/amr":         { intern: "full",    junior: "full",    consultant: "full",    admin: "full" },
  "/stewardship":  { intern: "denied",  junior: "limited", consultant: "full",    admin: "full" },
  "/adr":          { intern: "full",    junior: "full",    consultant: "full",    admin: "full" },
  "/ai":           { intern: "full",    junior: "full",    consultant: "full",    admin: "denied" },
  "/reports":      { intern: "denied",  junior: "denied",  consultant: "limited", admin: "full" },
  "/settings":     { intern: "full",    junior: "full",    consultant: "full",    admin: "full" },
};

/** Limited access descriptions shown as info banners */
export const LIMITED_MSG: Record<string, Partial<Record<AppRole, string>>> = {
  "/cases": {
    intern: "Scoped View — You are restricted to viewing your own created cases only.",
  },
  "/predict": {
    intern: "View Only — Clinical AI Engine predictions are in view-only mode for interns.",
    junior: "Run Existing Only — You can run predictions on existing cases, but cannot modify model settings.",
  },
  "/stewardship": {
    junior: "View Only — Antimicrobial Stewardship protocol editing requires Consultant or Admin role.",
  },
  "/reports": {
    consultant: "Department View — You are viewing Department-Level Reports. Global hospital reports require Admin role.",
  },
};

/** Resolve access level for role and route */
export function getAccess(role: AppRole | string | undefined, path: string): AccessLevel {
  if (!role) return "denied";

  const normalizedRole = role as AppRole;

  const matching = Object.keys(ACCESS_MATRIX)
    .filter(prefix => path.startsWith(prefix))
    .sort((a, b) => b.length - a.length);

  if (matching.length === 0) return "full";
  const key = matching[0];
  return ACCESS_MATRIX[key][normalizedRole] ?? "full";
}

/** Get limited banner message */
export function getLimitedMsg(role: AppRole | string | undefined, path: string): string | null {
  if (!role) return null;

  const matching = Object.keys(LIMITED_MSG)
    .filter(prefix => path.startsWith(prefix))
    .sort((a, b) => b.length - a.length);

  if (matching.length === 0) return null;
  return LIMITED_MSG[matching[0]][role as AppRole] ?? null;
}

/** Sidebar nav visibility: hide items the role has NO access to */
export function canSeeNavItem(role: AppRole | string | undefined, href: string): boolean {
  return getAccess(role, href) !== "denied";
}

/** Human-readable role labels */
export const ROLE_LABELS: Record<AppRole, string> = {
  intern:     "Intern Doctor",
  junior:     "Junior Resident (JR)",
  consultant: "Consultant Specialist",
  admin:      "Administrator",
};

/** Subtle healthcare-style role badge colors */
export const ROLE_COLORS: Record<AppRole, string> = {
  intern:     "#2563eb", // Healthcare Blue
  junior:     "#7c3aed", // Indigo/Purple
  consultant: "#0d9488", // Teal/Emerald
  admin:      "#d97706", // Amber/Orange
};
