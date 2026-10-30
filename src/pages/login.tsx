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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { DoctorLiveWallpaper } from "@/components/doctor-live-wallpaper";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid clinical email address"),
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
        onSuccess: (res: any) => {
          if (!res || !res.token || !res.user) {
            toast({
              title: "Authentication Failed",
              description: res?.error || "Invalid response from authentication server.",
              variant: "destructive",
            });
            return;
          }
          login(res.token, res.user);
          const userName = res.user.name || res.user.email || "Clinician";
          const userRole = (res.user.role || "USER").toUpperCase();
          toast({
            title: "Access Granted",
            description: `Welcome Dr. ${userName} (${userRole}). Session active.`,
          });
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          toast({
            title: "Authentication Failed",
            description: err?.error || err?.message || "Invalid email or password",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <DoctorLiveWallpaper>
      <div className="w-full max-w-[380px] sm:max-w-[410px] mx-auto my-auto flex flex-col items-center">
        {/* ── AAROGYA X EMBLEM (EXACT MATCH TO USER SCREENSHOT) ── */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="relative mb-3">
            {/* Glowing circular outer ring with official Aarogya X logo */}
            <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-[#00b4d8] to-[#00d2b4] p-[2.5px] shadow-[0_0_35px_rgba(0,210,180,0.65)] flex items-center justify-center overflow-hidden">
              <img
                src="/logo.jpg"
                alt="Aarogya X Logo"
                className="h-full w-full rounded-full object-cover"
              />
            </div>
            {/* Pulsing beacon dot */}
            <div className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-slate-950 border border-teal-400/60 flex items-center gap-1 shadow-md">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping" />
              <span className="text-[8.5px] font-bold text-teal-300">AI</span>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-1">
            <span>Aarogya</span>
            <span className="text-[#00e5ff] drop-shadow-[0_0_15px_rgba(0,229,255,0.7)]">X</span>
          </h1>
          <p className="text-[10px] tracking-[0.16em] text-[#00d2b4] font-semibold uppercase mt-1">
            AI-BASED ANTIBIOTIC RESISTANCE PREDICTION
          </p>
        </div>

        {/* ── GLASSMORPHIС LOGIN CARD ── */}
        <div className="w-full backdrop-blur-2xl bg-[#040d1a]/85 border border-cyan-500/25 rounded-2xl p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.85)] relative overflow-hidden">
          {/* Subtle top glowing accent strip */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00b4d8] via-[#00d2b4] to-[#38bdf8] shadow-[0_0_15px_rgba(0,210,180,0.6)]" />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[10.5px] font-semibold tracking-wider text-slate-300 uppercase">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="doctor@hospital.com"
                        autoComplete="email"
                        className="bg-[#091728]/90 border-slate-700/60 text-white placeholder:text-slate-500 rounded-lg h-10 text-xs px-3 focus:border-[#00d2b4] focus:ring-1 focus:ring-[#00d2b4]/50 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-rose-400 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[10.5px] font-semibold tracking-wider text-slate-300 uppercase">
                      Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="bg-[#091728]/90 border-slate-700/60 text-white placeholder:text-slate-500 rounded-lg h-10 text-xs px-3 pr-10 focus:border-[#00d2b4] focus:ring-1 focus:ring-[#00d2b4]/50 transition-colors"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          title={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-rose-400 text-xs" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full bg-gradient-to-r from-[#00b4d8] to-[#00d2b4] hover:brightness-110 text-slate-950 font-bold tracking-wider py-2.5 rounded-lg shadow-[0_0_25px_rgba(0,210,180,0.45)] transition-all cursor-pointer text-xs mt-3 uppercase"
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Signing In...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          </Form>

          {/* Need an account? Register here */}
          <div className="mt-5 text-center text-xs text-slate-400 border-t border-slate-800/80 pt-4">
            Need an account?{" "}
            <Link
              href="/register"
              className="text-[#00d2b4] font-semibold hover:text-[#38bdf8] hover:underline transition-colors ml-1"
            >
              Register here
            </Link>
          </div>
        </div>
      </div>
    </DoctorLiveWallpaper>
  );
}
