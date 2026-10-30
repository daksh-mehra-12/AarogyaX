import * as React from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, Home, Stethoscope, AlertTriangle, FileBarChart, History, Users, BarChart3, Bot, Settings, Activity } from "lucide-react";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface BreadcrumbContextType {
  customSegments: BreadcrumbSegment[] | null;
  setCustomBreadcrumbs: (segments: BreadcrumbSegment[] | null) => void;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextType>({
  customSegments: null,
  setCustomBreadcrumbs: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [customSegments, setCustomBreadcrumbs] = React.useState<BreadcrumbSegment[] | null>(null);
  const [location] = useLocation();

  // Reset custom segments when location changes unless overridden by the new page
  React.useEffect(() => {
    setCustomBreadcrumbs(null);
  }, [location]);

  return (
    <BreadcrumbContext.Provider value={{ customSegments, setCustomBreadcrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useWorkspaceBreadcrumbs() {
  return React.useContext(BreadcrumbContext);
}

/**
 * Derives default hierarchical breadcrumb segments from current pathname
 */
function resolveRouteSegments(pathname: string): BreadcrumbSegment[] {
  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  if (clean === "/" || clean === "/dashboard") {
    return [{ label: "Dashboard", href: "/dashboard" }];
  }

  // Patients
  if (clean === "/patients") {
    return [{ label: "Patients", href: "/patients", icon: Users }];
  }
  if (clean === "/patients/new") {
    return [
      { label: "Patients", href: "/patients", icon: Users },
      { label: "New Patient Registration" },
    ];
  }
  if (clean.startsWith("/patients/")) {
    const id = clean.split("/")[2] || "Record";
    return [
      { label: "Patients", href: "/patients", icon: Users },
      { label: `Patient Profile (${id})` },
    ];
  }

  // Cases
  if (clean === "/cases") {
    return [{ label: "Cases & AMR Records", href: "/cases", icon: History }];
  }
  if (clean === "/cases/new") {
    return [
      { label: "Cases & AMR Records", href: "/cases", icon: History },
      { label: "New Clinical Case" },
    ];
  }
  if (clean.startsWith("/cases/")) {
    const id = clean.split("/")[2] || "Record";
    return [
      { label: "Cases & AMR Records", href: "/cases", icon: History },
      { label: `Case #${id}` },
    ];
  }

  // AMR Reporting & Predictor
  if (clean === "/predict") {
    return [{ label: "AMR Reporting & Intelligence", href: "/predict", icon: Stethoscope }];
  }
  if (clean === "/amr-report") {
    return [
      { label: "AMR Reporting", href: "/predict", icon: Stethoscope },
      { label: "Lab Case Collection" },
    ];
  }

  // ADR / Pharmacovigilance
  if (clean === "/adr") {
    return [{ label: "ADR Surveillance", href: "/adr", icon: AlertTriangle }];
  }
  if (clean === "/adr/new") {
    return [
      { label: "ADR Surveillance", href: "/adr", icon: AlertTriangle },
      { label: "Report New Reaction" },
    ];
  }
  if (clean.startsWith("/adr/")) {
    const id = clean.split("/")[2] || "Report";
    return [
      { label: "ADR Surveillance", href: "/adr", icon: AlertTriangle },
      { label: `Reaction Report #${id}` },
    ];
  }

  // Stewardship
  if (clean === "/stewardship") {
    return [{ label: "Antimicrobial Stewardship & Policy", href: "/stewardship", icon: BarChart3 }];
  }

  // Reports
  if (clean === "/reports") {
    return [{ label: "Reports & Surveillance Exports", href: "/reports", icon: FileBarChart }];
  }

  // Analytics
  if (clean === "/analytics") {
    return [{ label: "Epidemiological Analytics", href: "/analytics", icon: Activity }];
  }

  // AI Assistant
  if (clean === "/ai") {
    return [{ label: "Clinical AI Intelligence", href: "/ai", icon: Bot }];
  }

  // Settings
  if (clean === "/settings") {
    return [{ label: "Clinical Governance & Settings", href: "/settings", icon: Settings }];
  }

  // Fallback: parse path chunks
  const parts = clean.split("/").filter(Boolean);
  return parts.map((part, index) => {
    const url = "/" + parts.slice(0, index + 1).join("/");
    const formatted = part.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return {
      label: formatted,
      href: index < parts.length - 1 ? url : undefined,
    };
  });
}

export function WorkspaceBreadcrumbs() {
  const [location] = useLocation();
  const { customSegments } = useWorkspaceBreadcrumbs();

  const segments = customSegments && customSegments.length > 0
    ? customSegments
    : resolveRouteSegments(location);

  const isHome = location === "/" || location === "/dashboard";

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center text-xs font-medium text-muted-foreground select-none overflow-hidden max-w-[280px] sm:max-w-md md:max-w-xl"
    >
      {/* Home / Dashboard Anchor */}
      <Link
        href="/dashboard"
        className={`flex items-center gap-1.5 p-1 rounded-md transition-colors shrink-0 ${
          isHome
            ? "text-primary font-bold bg-primary/10"
            : "hover:text-foreground hover:bg-accent/60"
        }`}
        title="Go to Clinical Dashboard"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only">Dashboard</span>
      </Link>

      {!isHome && (
        <ChevronRight className="h-3 w-3 shrink-0 mx-1 opacity-40 text-muted-foreground" />
      )}

      {/* Breadcrumb Segments */}
      {!isHome &&
        segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const Icon = segment.icon;

          return (
            <React.Fragment key={`${segment.label}-${index}`}>
              {index > 0 && (
                <ChevronRight className="h-3 w-3 shrink-0 mx-1 opacity-40 text-muted-foreground" />
              )}
              {segment.href && !isLast ? (
                <Link
                  href={segment.href}
                  className="flex items-center gap-1 hover:text-foreground hover:underline transition-colors truncate max-w-[120px] sm:max-w-[180px]"
                >
                  {Icon && <Icon className="h-3 w-3 shrink-0 opacity-70" />}
                  <span className="truncate">{segment.label}</span>
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={`flex items-center gap-1.5 truncate max-w-[140px] sm:max-w-[240px] md:max-w-xs ${
                    isLast
                      ? "font-bold text-foreground tracking-tight text-xs sm:text-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  <span className="truncate">{segment.label}</span>
                </span>
              )}
            </React.Fragment>
          );
        })}
    </nav>
  );
}
