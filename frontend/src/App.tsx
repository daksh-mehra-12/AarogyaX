import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayout } from "@/components/layout";
import { setAuthTokenGetter } from "@/api";
import { getAccess, getLimitedMsg, ROLE_LABELS, ROLE_COLORS, AppRole } from "@/lib/access";
import * as React from "react";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients/index";
import NewPatient from "@/pages/patients/new";
import PatientDetail from "@/pages/patients/[id]";
import Cases from "@/pages/cases/index";
import NewCase from "@/pages/cases/new";
import CaseDetail from "@/pages/cases/[id]";
import Predict from "@/pages/predict/index";
import AdrReports from "@/pages/adr/index";
import NewAdrReport from "@/pages/adr/new";
import AdrDetail from "@/pages/adr/[id]";
import Analytics from "@/pages/analytics/index";
import Stewardship from "@/pages/stewardship/index";
import Reports from "@/pages/reports/index";
import AiAssistant from "@/pages/ai/index";
import Settings from "@/pages/settings/index";

const queryClient = new QueryClient();

setAuthTokenGetter(() => localStorage.getItem("aarogya_token"));

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  React.useEffect(() => {
    setLocation(isAuthenticated ? "/dashboard" : "/login");
  }, [isAuthenticated, setLocation]);
  return null;
}

// ── Access Denied page ────────────────────────────────────────────────────────
function AccessDenied({ role }: { role: string }) {
  const [, setLocation] = useLocation();
  const roleLabel = ROLE_LABELS[role as AppRole] ?? role;
  const roleColor = ROLE_COLORS[role as AppRole] ?? "#6b8fa8";
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="h-20 w-20 rounded-full flex items-center justify-center"
        style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.3)" }}>
        <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <div>
        <h2 className="text-2xl font-black text-foreground mb-2">Access Restricted</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          This page is not available for your current role.
        </p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
        style={{ background: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}40` }}>
        <span className="h-2 w-2 rounded-full" style={{ background: roleColor }} />
        {roleLabel}
      </div>
      <button
        onClick={() => setLocation("/dashboard")}
        className="mt-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: "rgba(20,184,166,0.15)", color: "#2dd4bf", border: "1px solid rgba(20,184,166,0.3)" }}
      >
        ← Back to Dashboard
      </button>
    </div>
  );
}

// ── Limited access banner ─────────────────────────────────────────────────────
function LimitedBanner({ message, role }: { message: string; role: string }) {
  const roleColor = ROLE_COLORS[role as AppRole] ?? "#f59e0b";
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg px-4 py-3 text-sm"
      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "#fcd34d" }}>
      <svg className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#f59e0b" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <span><strong>Limited Access</strong> — {message}</span>
    </div>
  );
}

// ── Role-aware ProtectedRoute ─────────────────────────────────────────────────
function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType<any>; [key: string]: any }) {
  const { isAuthenticated, user } = useAuth();
  const [location, setLocation] = useLocation();

  React.useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  const access = getAccess(user?.role, location);
  const limitedMsg = getLimitedMsg(user?.role, location);

  if (access === "denied") {
    return (
      <AppLayout>
        <AccessDenied role={user?.role ?? ""} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {access === "limited" && limitedMsg && (
        <LimitedBanner message={limitedMsg} role={user?.role ?? ""} />
      )}
      <Component {...rest} />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>

      <Route path="/patients"><ProtectedRoute component={Patients} /></Route>
      <Route path="/patients/new"><ProtectedRoute component={NewPatient} /></Route>
      <Route path="/patients/:id"><ProtectedRoute component={PatientDetail} /></Route>

      <Route path="/cases"><ProtectedRoute component={Cases} /></Route>
      <Route path="/cases/new"><ProtectedRoute component={NewCase} /></Route>
      <Route path="/cases/:id"><ProtectedRoute component={CaseDetail} /></Route>

      <Route path="/predict"><ProtectedRoute component={Predict} /></Route>

      <Route path="/adr"><ProtectedRoute component={AdrReports} /></Route>
      <Route path="/adr/new"><ProtectedRoute component={NewAdrReport} /></Route>
      <Route path="/adr/:id"><ProtectedRoute component={AdrDetail} /></Route>

      <Route path="/analytics"><ProtectedRoute component={Analytics} /></Route>
      <Route path="/stewardship"><ProtectedRoute component={Stewardship} /></Route>
      <Route path="/reports"><ProtectedRoute component={Reports} /></Route>
      <Route path="/ai"><ProtectedRoute component={AiAssistant} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>

      <Route path="/" component={RootRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" attribute="class">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
