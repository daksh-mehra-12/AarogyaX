import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
    </div>
  );
}
