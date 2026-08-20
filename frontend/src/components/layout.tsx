import * as React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { canSeeNavItem, ROLE_LABELS, ROLE_COLORS, AppRole } from "@/lib/access";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, History, Stethoscope,
  AlertTriangle, BarChart3, Settings, LogOut,
  Plus, FileBarChart, Bot, Sun, Moon, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ALL_NAV = [
  { name: "Dashboard",     href: "/dashboard", icon: LayoutDashboard },
  { name: "New Case",      href: "/cases/new", icon: Plus },
  { name: "Case History",  href: "/cases",     icon: History },
  { name: "Stewardship",   href: "/stewardship", icon: BarChart3 },
  { name: "AMR Reporting", href: "/predict",   icon: Stethoscope },
  { name: "ADR Reporting", href: "/adr",       icon: AlertTriangle },
  { name: "AI Assistant",  href: "/ai",        icon: Bot },
  { name: "Reports",       href: "/reports",   icon: FileBarChart },
  { name: "Settings",      href: "/settings",  icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const role = (user?.role as AppRole) || "intern";
  const roleLabel = ROLE_LABELS[role] ?? role;
  const roleColor = ROLE_COLORS[role] ?? "#2563eb";
  const navigation = ALL_NAV.filter(item => canSeeNavItem(role, item.href));

  // Determine current active page title for header
  const currentNavItem = ALL_NAV.find(item =>
    item.href === "/cases/new"
      ? location === "/cases/new"
      : item.href === "/cases"
      ? location.startsWith("/cases") && !location.startsWith("/cases/new")
      : location.startsWith(item.href)
  );

  const pageTitle = currentNavItem?.name || "Clinical System";

  const handleLogout = () => {
    logout();
    toast({ title: "Logged out", description: "You have successfully signed out of Aarogya X." });
  };

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    toast({ title: `${nextTheme === "dark" ? "Dark" : "Light"} Mode enabled` });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground font-sans transition-colors duration-200">

        {/* ── Sidebar ── */}
        <Sidebar className="bg-sidebar dark:bg-[#121212] border-r border-sidebar-border w-64 shrink-0 flex flex-col">

          {/* Header & Brand Logo */}
          <SidebarHeader className="px-5 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="Aarogya X Logo"
                className="h-10 w-10 rounded-full object-cover shadow-sm border border-primary/20 shrink-0"
              />
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-base text-foreground tracking-tight">Aarogya X</span>
                <span className="text-[11px] font-medium text-muted-foreground">Predict • Prevent • Protect</span>
              </div>
            </div>
          </SidebarHeader>

          {/* Nav Links */}
          <SidebarContent className="px-3 py-4 flex-1">
            <SidebarMenu className="space-y-1">
              {navigation.map((item) => {
                const isActive =
                  item.href === "/cases/new"
                    ? location === "/cases/new"
                    : item.href === "/cases"
                    ? location.startsWith("/cases") && !location.startsWith("/cases/new")
                    : location.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.href)}
                      tooltip={item.name}
                      className={
                        isActive
                          ? "bg-primary/10 text-primary font-bold border-l-4 border-primary rounded-r-md px-3 py-2 text-sm flex items-center gap-3 w-full transition-all shadow-xs"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2 text-sm font-medium flex items-center gap-3 w-full transition-colors"
                      }
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* User Footer */}
          <SidebarFooter className="p-4 border-t border-sidebar-border bg-card/60 dark:bg-[#141414]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs" style={{ backgroundColor: roleColor }}>
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="flex flex-col leading-none min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">{user?.name}</span>
                  <span className="text-[11px] font-medium truncate mt-0.5" style={{ color: roleColor }}>{roleLabel}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Log out"
                aria-label="Log out"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-md"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* ── Main Workspace ── */}
        <div className="flex flex-1 flex-col min-w-0 bg-background dark:bg-[#0B0B0B]">
          {/* Top Header Bar */}
          <header className="flex h-14 items-center justify-between px-6 border-b border-border bg-card/80 dark:bg-[#141414] backdrop-blur-xs shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-foreground tracking-tight">{pageTitle}</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Light/Dark Toggle */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleThemeToggle}
                title="Toggle Theme"
                aria-label="Toggle Theme"
                className="h-9 w-9 rounded-md border-border bg-card dark:bg-[#181818] text-foreground hover:bg-accent"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
              </Button>
              
              {/* Healthcare Role Badge */}
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full border shadow-xs"
                style={{
                  backgroundColor: `${roleColor}15`,
                  color: roleColor,
                  borderColor: `${roleColor}40`
                }}
              >
                {roleLabel || "Clinical Portal"}
              </span>
            </div>
          </header>

          {/* Page Content Container */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
