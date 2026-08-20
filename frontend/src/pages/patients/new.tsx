import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreatePatient } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const formSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters"),
  age: z.coerce.number({ invalid_type_error: "Age is required" }).min(0, "Age cannot be negative").max(120, "Age must be valid"),
  gender: z.enum(["male", "female", "other"]),
  weight: z.coerce.number().optional(),
  region: z.string().optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  socioeconomicStatus: z.enum(["high", "middle", "low"]).optional(),
  icuStatus: z.boolean().default(false),
  diabetes: z.boolean().default(false),
  ckd: z.boolean().default(false),
  pregnancy: z.boolean().default(false),
  immunocompromised: z.boolean().default(false),
  others: z.boolean().default(false),
  rghsCard: z.boolean().default(false),
});

const factorLabels: Record<string, string> = {
  diabetes: "Diabetes",
  ckd: "Chronic Kidney Disease (CKD)",
  pregnancy: "Pregnancy",
  immunocompromised: "Immunocompromised Status",
  others: "Other Comorbidities",
};

const femaleOnlyFactors = ["pregnancy"];

export default function NewPatient() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const createPatient = useCreatePatient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      age: undefined as unknown as number,
      gender: "male",
      weight: undefined as unknown as number,
      region: "",
      bloodGroup: undefined,
      socioeconomicStatus: undefined,
      icuStatus: false,
      diabetes: false,
      ckd: false,
      pregnancy: false,
      immunocompromised: false,
      others: false,
      rghsCard: false,
    },
  });

  const selectedGender = form.watch("gender");

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (values.gender === "male") values.pregnancy = false;

    createPatient.mutate({ data: values as any }, {
      onSuccess: (res) => {
        toast({ title: "Patient registered", description: `Record for ${res.name} saved successfully.` });
        setLocation(`/patients/${res.id}`);
      },
      onError: (err) => {
        toast({
          title: "Registration failed",
          description: err.message || "Failed to register patient",
          variant: "destructive",
        });
      },
    });
  };

  const allFactors = ["diabetes", "ckd", "pregnancy", "immunocompromised", "others"];
  const visibleFactors = allFactors.filter(
    (f) => !(selectedGender === "male" && femaleOnlyFactors.includes(f))
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: "Patients Directory", href: "/patients" }, { label: "Register Patient" }]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Register Patient</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Add a new patient profile to the clinical registry</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Demographics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Demographics & Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Full Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Rajesh Kumar" className="text-xs" {...field} /></FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Age <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="120"
                        placeholder="e.g. 45"
                        className="text-xs"
                        {...field}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
                            e.preventDefault();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Gender <span className="text-destructive">*</span></FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        if (val === "male") form.setValue("pregnancy", false);
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Select gender" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="weight" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Weight (kg)</FormLabel>
                    <FormControl><Input type="number" min="0" placeholder="e.g. 70" className="text-xs" {...field} /></FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="region" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Region / City</FormLabel>
                    <FormControl><Input placeholder="e.g. Jaipur" className="text-xs" {...field} /></FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="bloodGroup" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Blood Group</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BLOOD_GROUPS.map((bg) => (
                          <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="socioeconomicStatus" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Socioeconomic Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="middle">Middle</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              {/* ICU Status Switch */}
              <FormField control={form.control} name="icuStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">ICU Status</FormLabel>
                  <div className={`flex items-center justify-between rounded-md border p-3 transition-colors ${
                    field.value ? "border-rose-500/50 bg-rose-500/5" : "border-border"
                  }`}>
                    <span className="text-xs font-medium">
                      {field.value ? <span className="text-rose-500 font-bold">Admitted in ICU</span> : <span className="text-muted-foreground">General Ward / Outpatient</span>}
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Clinical Risk Factors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Clinical Comorbidities</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Select pre-existing risk conditions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleFactors.map((factor) => (
                <FormField
                  key={factor}
                  control={form.control}
                  name={factor as any}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                      <FormLabel className="text-xs font-medium text-foreground">
                        {factorLabels[factor]}
                      </FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setLocation("/patients")}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createPatient.isPending}>
              {createPatient.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</> : "Save Patient"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
