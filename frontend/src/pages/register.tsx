import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useRegisterUser } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["intern", "junior", "consultant", "admin"]),
});

export default function Register() {
  const [_, setLocation] = useLocation();
  const [showPassword, setShowPassword] = React.useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegisterUser();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", role: "intern" },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    const cleanData = {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password.trim(),
      role: data.role,
    };
    registerMutation.mutate(
      { data: cleanData as any },
      {
        onSuccess: (res) => {
          login(res.token, res.user);
          toast({ title: "Account registered!", description: `Welcome ${res.user.name}! Your ${res.user.role} profile is ready.` });
          setLocation("/dashboard");
        },
        onError: (error: any) => {
          toast({
            title: "Registration Failed",
            description: error?.error || error?.message || "An error occurred during registration",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <img
            src="/logo.jpg"
            alt="Aarogya X Logo"
            className="h-20 w-20 rounded-full object-cover shadow-md mx-auto mb-2 border-2 border-primary/20"
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Aarogya X</h1>
          <p className="text-sm text-muted-foreground font-medium">Predict • Prevent • Protect | Clinical Portal</p>
        </div>

        {/* Card */}
        <Card className="bg-card border-border shadow-sm rounded-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold text-card-foreground">User Registration</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Create a new user account for system access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Dr. Priya Sharma"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Clinical Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="priya.sharma@hospital.org"
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
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Clinical Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-card border-border focus:border-primary rounded-md">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border shadow-md rounded-md">
                          <SelectItem value="intern">Intern Doctor</SelectItem>
                          <SelectItem value="junior">Junior Resident (JR)</SelectItem>
                          <SelectItem value="consultant">Consultant Specialist</SelectItem>
                          <SelectItem value="admin">System Administrator</SelectItem>
                        </SelectContent>
                      </Select>
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
                  disabled={registerMutation.isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-md transition-colors shadow-sm mt-2"
                >
                  {registerMutation.isPending ? "Registering..." : "Register User"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground border-t border-border pt-4">
              Already registered?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
