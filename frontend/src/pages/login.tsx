import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLoginUser } from "@/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [_, setLocation] = useLocation();
  const [showPassword, setShowPassword] = React.useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLoginUser();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    const cleanData = {
      email: data.email.trim().toLowerCase(),
      password: data.password.trim(),
    };
    loginMutation.mutate(
      { data: cleanData as any },
      {
        onSuccess: (res) => {
          login(res.token, res.user);
          toast({ title: "Welcome back!", description: `Signed in as ${res.user.name} (${res.user.role}).` });
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          toast({
            title: "Login Failed",
            description: err?.error || err?.message || "Invalid email or password",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Portal Header */}
        <div className="text-center space-y-2">
          <img
            src="/logo.jpg"
            alt="Aarogya X Logo"
            className="h-20 w-20 rounded-full object-cover shadow-md mx-auto mb-2 border-2 border-primary/20"
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Aarogya X</h1>
          <p className="text-sm text-muted-foreground font-medium">Predict • Prevent • Protect | Clinical Portal</p>
        </div>

        {/* Login Card */}
        <Card className="bg-card border-border shadow-sm rounded-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold text-card-foreground">Sign In</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Enter your clinical credentials to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Email Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="doctor@hospital.org"
                          className="bg-card border-border focus:border-primary rounded-md"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="bg-card border-border focus:border-primary rounded-md pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? "Hide password" : "Show password"}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-md transition-colors shadow-sm mt-2"
                >
                  {loginMutation.isPending ? "Signing In..." : "Sign In to Portal"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground border-t border-border pt-4">
              Don't have an account?{" "}
              <Link href="/register" className="font-semibold text-primary hover:underline">
                Register New User
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
