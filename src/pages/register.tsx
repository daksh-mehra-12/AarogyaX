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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, UserPlus, Shield } from "lucide-react";
import { DoctorLiveWallpaper } from "@/components/doctor-live-wallpaper";

const registerSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Please enter a valid clinical email address"),
  password: z.string().min(6, "Passcode must be at least 6 characters"),
  role: z.enum(["admin", "intern", "junior", "consultant"]),
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
          toast({
            title: "Practitioner Enrolled",
            description: `Welcome Dr. ${res.user.name}! Your ${res.user.role.toUpperCase()} clinical profile is ready.`,
          });
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
    <DoctorLiveWallpaper>
      <div className="w-full max-w-[380px] sm:max-w-[420px] mx-auto my-auto flex flex-col items-center">
        {/* Aarogya X Brand Emblem */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="relative mb-2">
            <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-[#00b4d8] to-[#00d2b4] p-[2px] shadow-[0_0_25px_rgba(0,210,180,0.55)] flex items-center justify-center overflow-hidden">
              <img
                src="/logo.jpg"
                alt="Aarogya X Logo"
                className="h-full w-full rounded-full object-cover"
              />
            </div>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center justify-center gap-1">
            <span>Aarogya</span>
            <span className="text-[#00e5ff] drop-shadow-[0_0_15px_rgba(0,229,255,0.7)]">X</span>
          </h1>
          <p className="text-[10px] tracking-[0.16em] text-[#00d2b4] font-semibold uppercase mt-0.5">
            PRACTITIONER ONBOARDING PORTAL
          </p>
        </div>

        {/* Glassmorphic Registration Card */}
        <div className="w-full backdrop-blur-2xl bg-[#040d1a]/85 border border-cyan-500/25 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.85)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00b4d8] via-[#00d2b4] to-[#38bdf8] shadow-[0_0_15px_rgba(0,210,180,0.6)]" />

          <div className="mb-4 text-center">
            <h2 className="text-base font-bold text-white tracking-wide">Register New Practitioner</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Create your isolated practitioner workspace.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold text-slate-200">
                      Full Practitioner Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Dr. Priya Sharma"
                        className="bg-slate-900/80 border-slate-700/60 text-white placeholder:text-slate-500 rounded-lg h-9.5 text-xs px-3 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-rose-400 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold text-slate-200">
                      Clinical Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="priya.sharma@hospital.org"
                        className="bg-slate-900/80 border-slate-700/60 text-white placeholder:text-slate-500 rounded-lg h-9.5 text-xs px-3 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-rose-400 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold text-slate-200">
                      Clinical Department Role
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-900/80 border-slate-700/60 text-white focus:border-cyan-400 rounded-lg h-9.5 text-xs">
                          <SelectValue placeholder="Select clinical role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-950 border-cyan-500/30 text-white shadow-2xl">
                        <SelectItem value="admin">🛡️ System Administrator</SelectItem>
                        <SelectItem value="consultant">🩺 Consultant Specialist</SelectItem>
                        <SelectItem value="junior">👨‍⚕️ Junior Resident (JR)</SelectItem>
                        <SelectItem value="intern">🎓 Intern Doctor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-rose-400 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold text-slate-200">
                      Passcode (minimum 6 characters)
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="bg-slate-900/80 border-slate-700/60 text-white placeholder:text-slate-500 rounded-lg h-9.5 text-xs px-3 pr-10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          title={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
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
                disabled={registerMutation.isPending}
                className="w-full bg-gradient-to-r from-teal-400 via-cyan-500 to-blue-500 hover:brightness-110 text-slate-950 font-bold tracking-wide py-2.5 rounded-lg shadow-[0_0_25px_rgba(0,229,255,0.4)] transition-all cursor-pointer text-xs mt-2"
              >
                {registerMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Enrolling Practitioner...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    <span>Create Practitioner Account</span>
                  </span>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-xs text-slate-400 border-t border-slate-800/80 pt-3">
            Already registered?{" "}
            <Link
              href="/login"
              className="text-cyan-400 font-semibold hover:text-cyan-300 hover:underline transition-colors"
            >
              Sign In to Portal
            </Link>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-center gap-2 text-[10.5px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
          <span>Multi-Tenant Isolated Practitioner Workspace</span>
        </div>
      </div>
    </DoctorLiveWallpaper>
  );
}
