import { 
  useGetResistanceTrends, 
  useGetDrugUsageStats, 
  useGetOrganismFrequency 
} from "@/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ErrorState } from "@/components/ui/error-state";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const COLORS = {
  highRisk: "hsl(var(--destructive))",
  mediumRisk: "hsl(30 80% 55%)",
  lowRisk: "hsl(160 84% 39%)",
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--accent))",
};

export default function Analytics() {
  const { data: trends, isLoading: loadTrends, isError: errTrends, refetch: refetchTrends } = useGetResistanceTrends();
  const { data: usage, isLoading: loadUsage, isError: errUsage, refetch: refetchUsage } = useGetDrugUsageStats();
  const { data: organisms, isLoading: loadOrgs, isError: errOrgs, refetch: refetchOrgs } = useGetOrganismFrequency();

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Clinical Analytics" }]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Clinical Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Global insights into resistance patterns and prescribing habits</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-bold">AMR Risk Trends</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Monthly distribution of identified resistance risks</CardDescription>
          </CardHeader>
          <CardContent className="h-[380px]">
            {errTrends ? (
              <ErrorState title="Failed to load resistance trends" onRetry={refetchTrends} />
            ) : loadTrends ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends?.trends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                  <Line type="monotone" name="High/Critical Risk" dataKey="highRisk" stroke={COLORS.highRisk} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" name="Medium Risk" dataKey="mediumRisk" stroke={COLORS.mediumRisk} strokeWidth={2} />
                  <Line type="monotone" name="Low Risk" dataKey="lowRisk" stroke={COLORS.lowRisk} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Top Prescribed Drugs</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">By volume and estimated success rate</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {errUsage ? (
              <ErrorState title="Failed to load drug statistics" onRetry={refetchUsage} />
            ) : loadUsage ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage?.drugs} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: "hsl(var(--muted))"}} contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}/>
                  <Bar dataKey="count" name="Prescriptions" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Pathogen Frequency</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Most commonly isolated organisms</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {errOrgs ? (
              <ErrorState title="Failed to load pathogen data" onRetry={refetchOrgs} />
            ) : loadOrgs ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={organisms?.organisms}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="name"
                    stroke="none"
                  >
                    {organisms?.organisms.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={[COLORS.primary, COLORS.secondary, COLORS.highRisk, COLORS.mediumRisk, COLORS.lowRisk][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: '8px' }} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
