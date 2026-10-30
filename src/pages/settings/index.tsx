import { useAuth } from "@/hooks/use-auth";
import { useGmail } from "@/hooks/use-gmail";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { User, Mail, ShieldCheck, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const handleThemeChange = (checked: boolean) => {
    const nextTheme = checked ? "dark" : "light";
    setTheme(nextTheme);
    toast({ title: `${nextTheme === "dark" ? "Dark" : "Light"} Mode enabled` });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: "Settings & Preferences" }]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">System Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your clinical profile and display preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Profile Information
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Your registered clinical identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-md bg-muted/20 border border-border">
              <span className="text-muted-foreground font-semibold">Full Name</span>
              <p className="font-bold text-sm text-foreground mt-0.5">{user?.name}</p>
            </div>
            <div className="p-3 rounded-md bg-muted/20 border border-border">
              <span className="text-muted-foreground font-semibold">Email Address</span>
              <div className="flex items-center gap-1.5 font-bold text-sm text-foreground mt-0.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {user?.email}
              </div>
            </div>
            <div className="p-3 rounded-md bg-muted/20 border border-border md:col-span-2">
              <span className="text-muted-foreground font-semibold">Clinical Role & Permissions</span>
              <div className="mt-1">
                <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold capitalize flex items-center w-fit gap-1 bg-primary/10 text-primary border border-primary/20">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {user?.role} Role Access
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" /> Display & Theme Preferences
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Customize your interface theme for comfortable clinical workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3.5 border border-border rounded-md bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">Clinical Dark Mode</Label>
              <p className="text-xs text-muted-foreground">Recommended for low-light hospital environments to reduce eye strain</p>
            </div>
            <Switch 
              checked={theme === 'dark'} 
              onCheckedChange={handleThemeChange} 
            />
          </div>
        </CardContent>
      </Card>

      <GmailSettingsCard />
    </div>
  );
}

function GmailSettingsCard() {
  const { isConnected, user, connect, disconnect, isLoading, error } = useGmail();
  const { toast } = useToast();

  const handleConnect = async () => {
    const res = await connect();
    if (res) {
      toast({
        title: "Gmail Connected",
        description: `Successfully authenticated as ${res.user.email}. You can now send patient alerts.`,
      });
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    toast({
      title: "Gmail Disconnected",
      description: "Signed out of Google Workspace session.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> Google Workspace & Gmail Integration
          </CardTitle>
          {isConnected ? (
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              Active Connection
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Disconnected
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Authenticate with Google to dispatch automated patient health alerts and comprehensive clinical reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 border border-border rounded-md bg-muted/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">
                {isConnected ? user?.email : "No Gmail Account Connected"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isConnected
                ? "Your Gmail session is active in memory. You can draft and dispatch health alerts from patient records."
                : "Connect your medical Google account to enable automated email notifications to care teams."}
            </p>
            {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
          </div>

          <div>
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isLoading}
                className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                Disconnect Gmail
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={isLoading}
                data-testid="settings-connect-gmail-btn"
                className="text-xs font-semibold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Connect Gmail
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
