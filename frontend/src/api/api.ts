import { useMutation, useQuery } from "@tanstack/react-query";
import type { UseMutationOptions, UseQueryOptions } from "@tanstack/react-query";

// ── Custom Fetch & Auth Config ───────────────────────────────────────────────

export type AuthTokenGetter = () => Promise<string | null> | string | null;

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

export async function customFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const fullUrl = _baseUrl && url.startsWith("/") ? `${_baseUrl}${url}` : url;
  const headers = new Headers(options.headers || {});

  if (options.body && typeof options.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(fullUrl, { ...options, headers });
  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      const isAuthEndpoint = url.includes("/api/auth/login") || url.includes("/api/auth/register");
      if (!isAuthEndpoint) {
        localStorage.removeItem("aarogya_token");
        localStorage.removeItem("aarogya_user");
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
    }
    if (typeof data === "string") {
      throw { message: `Request failed (${response.status}): ${response.statusText}`, error: response.statusText };
    }
    throw data || { message: response.statusText, error: response.statusText };
  }

  return data as T;
}

// ── Types & Schemas ──────────────────────────────────────────────────────────

export type UserRole = "intern" | "junior" | "consultant" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type PatientGender = "male" | "female" | "other";

export interface Patient {
  id: number;
  patientId: string;
  name: string;
  age: number;
  gender: PatientGender;
  weight?: number;
  region?: string;
  bloodGroup?: string;
  diabetes?: boolean;
  ckd?: boolean;
  pregnancy?: boolean;
  immunocompromised?: boolean;
  createdAt: string;
}

export interface PatientList {
  patients: Patient[];
  total: number;
}

export interface CreatePatientRequest {
  name: string;
  age: number;
  gender: PatientGender;
  weight?: number;
  region?: string;
  bloodGroup?: string;
  diabetes?: boolean;
  ckd?: boolean;
  pregnancy?: boolean;
  immunocompromised?: boolean;
}

export type CaseInfectionType = "uti" | "pneumonia" | "sepsis" | "skin" | "gi" | "other";
export type CaseSeverity = "mild" | "moderate" | "severe";
export type CaseStatus = "open" | "in-progress" | "resolved" | "closed";
export type PredictionResistanceRisk = "low" | "medium" | "high" | "critical";

export interface Prediction {
  id: number;
  caseId: number;
  resistanceProbability: number;
  recommendedDrug: string;
  alternativeDrugs?: string[];
  resistanceRisk: PredictionResistanceRisk;
  confidence: number;
  rationale?: string;
  dosage?: string;
  createdAt: string;
}

export interface Case {
  id: number;
  caseNumber: string;
  patientId: number;
  patient?: Patient;
  infectionType: CaseInfectionType;
  severity: CaseSeverity;
  icuStatus?: boolean;
  priorAntibiotics?: boolean;
  priorAntibioticsList?: string;
  organism?: string;
  cultureResult?: string;
  cbcValue?: number;
  crpValue?: number;
  procalcitoninValue?: number;
  status: CaseStatus;
  createdBy?: number;
  prediction?: Prediction;
  clinicalNotes?: string;
  createdAt: string;
}

export interface CaseList {
  cases: Case[];
  total: number;
}

export interface CreateCaseRequest {
  patientId: number;
  infectionType: CaseInfectionType;
  severity: CaseSeverity;
  icuStatus?: boolean;
  priorAntibiotics?: boolean;
  priorAntibioticsList?: string;
  organism?: string;
  cultureResult?: string;
  cbcValue?: number;
  crpValue?: number;
  procalcitoninValue?: number;
  hospitalizationHistory?: boolean;
  notes?: string;
}

export interface UpdateCaseRequest {
  status?: CaseStatus;
  organism?: string;
  cultureResult?: string;
}

export interface PredictRequest {
  caseId: number;
  infectionType: string;
  icuStatus?: boolean;
  priorAntibiotics?: boolean;
  diabetes?: boolean;
  ckd?: boolean;
  pregnancy?: boolean;
  organism?: string;
  severity: string;
}

export interface PredictResponse {
  prediction: Prediction;
  message?: string;
}

export type AdrReportSeverity = "mild" | "moderate" | "severe" | "life-threatening" | "fatal";
export type AdrReportOutcome = "recovered" | "recovering" | "not-recovered" | "recovered-sequelae" | "fatal" | "unknown";
export type AdrReportStatus = "pending" | "submitted" | "reviewed" | "closed";

export interface AdrReport {
  id: number;
  reportNumber: string;
  caseId?: number;
  patientId?: number;
  drugName: string;
  reactionDescription: string;
  severity: AdrReportSeverity;
  outcome: AdrReportOutcome;
  onsetDate?: string;
  status: AdrReportStatus;
  createdAt: string;
}

export interface AdrReportList {
  reports: AdrReport[];
  total: number;
}

export interface CreateAdrReportRequest {
  caseId?: number;
  patientId?: number;
  drugName: string;
  reactionDescription: string;
  severity: AdrReportSeverity;
  outcome: AdrReportOutcome;
  onsetDate?: string;
  batchNo?: string;
}

export interface DashboardSummary {
  totalPatients: number;
  totalCases?: number;
  activeCases: number;
  resolvedCases?: number;
  highRiskCases?: number;
  highRiskRatio: number;
  pendingAdrReports: number;
  resistanceRate?: number;
  topInfectionTypes?: { type: string; count: number }[];
}

export interface ResistanceTrendsItem {
  month: string;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
}

export interface ResistanceTrends {
  trends: ResistanceTrendsItem[];
}

export interface DrugUsageItem {
  name: string;
  count: number;
}

export interface DrugUsageStats {
  drugs: DrugUsageItem[];
}

export interface OrganismFrequencyItem {
  name: string;
  count: number;
}

export interface OrganismFrequency {
  organisms: OrganismFrequencyItem[];
}

export interface RecentActivityItem {
  id: string | number;
  description: string;
  timestamp: string;
  type: string;
  user?: string;
}

export interface RecentActivity {
  activity: RecentActivityItem[];
  activities?: RecentActivityItem[];
}

export type ListPatientsParams = { search?: string; page?: number; limit?: number };
export type ListCasesParams = { patientId?: number; status?: string; page?: number; limit?: number };
export type ListAdrReportsParams = { page?: number; limit?: number };

// ── Auth Hooks ───────────────────────────────────────────────────────────────

export function useLoginUser(options?: { mutation?: UseMutationOptions<AuthResponse, any, { data: LoginRequest }> }) {
  return useMutation({
    mutationFn: ({ data }: { data: LoginRequest }) => customFetch<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export function useRegisterUser(options?: { mutation?: UseMutationOptions<AuthResponse, any, { data: RegisterRequest }> }) {
  return useMutation({
    mutationFn: ({ data }: { data: RegisterRequest }) => customFetch<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

// ── Patient Hooks ────────────────────────────────────────────────────────────

export const getListPatientsQueryKey = (params?: ListPatientsParams) => params ? (["/api/patients", params] as const) : (["/api/patients"] as const);

export function useListPatients(params?: ListPatientsParams, options?: { query?: UseQueryOptions<PatientList, any> }) {
  return useQuery({
    queryKey: getListPatientsQueryKey(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.append("search", params.search);
      const queryStr = searchParams.toString();
      return customFetch<PatientList>(`/api/patients${queryStr ? `?${queryStr}` : ""}`);
    },
    ...options?.query,
  });
}

export const getGetPatientQueryKey = (id: number) => [`/api/patients/${id}`] as const;

export function useGetPatient(id: number, options?: { query?: UseQueryOptions<Patient, any> }) {
  return useQuery({
    queryKey: getGetPatientQueryKey(id),
    queryFn: () => customFetch<Patient>(`/api/patients/${id}`),
    enabled: !!id,
    ...options?.query,
  });
}

export function useCreatePatient(options?: { mutation?: UseMutationOptions<Patient, any, { data: CreatePatientRequest }> }) {
  return useMutation({
    mutationFn: ({ data }: { data: CreatePatientRequest }) => customFetch<Patient>("/api/patients", { method: "POST", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

// ── Case Hooks ───────────────────────────────────────────────────────────────

export const getListCasesQueryKey = (params?: ListCasesParams) => params ? (["/api/cases", params] as const) : (["/api/cases"] as const);

export function useListCases(params?: ListCasesParams, options?: { query?: UseQueryOptions<CaseList, any> }) {
  return useQuery({
    queryKey: getListCasesQueryKey(params),
    queryFn: () => customFetch<CaseList>("/api/cases"),
    ...options?.query,
  });
}

export const getGetCaseQueryKey = (id: number) => [`/api/cases/${id}`] as const;

export function useGetCase(id: number, options?: { query?: UseQueryOptions<Case, any> }) {
  return useQuery({
    queryKey: getGetCaseQueryKey(id),
    queryFn: () => customFetch<Case>(`/api/cases/${id}`),
    enabled: !!id,
    ...options?.query,
  });
}

export function useCreateCase(options?: { mutation?: UseMutationOptions<Case, any, { data: CreateCaseRequest }> }) {
  return useMutation({
    mutationFn: ({ data }: { data: CreateCaseRequest }) => customFetch<Case>("/api/cases", { method: "POST", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export function useUpdateCase(options?: { mutation?: UseMutationOptions<Case, any, { id: number; data: UpdateCaseRequest }> }) {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCaseRequest }) => customFetch<Case>(`/api/cases/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

// ── Prediction & ADR Hooks ───────────────────────────────────────────────────

export function usePredictAmr(options?: { mutation?: UseMutationOptions<PredictResponse, any, { data: PredictRequest }> }) {
  return useMutation({
    mutationFn: ({ data }: { data: PredictRequest }) => customFetch<PredictResponse>("/api/predict", { method: "POST", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export const getListAdrReportsQueryKey = (params?: ListAdrReportsParams) => params ? (["/api/adr", params] as const) : (["/api/adr"] as const);

export function useListAdrReports(params?: ListAdrReportsParams, options?: { query?: UseQueryOptions<AdrReportList, any> }) {
  return useQuery({
    queryKey: getListAdrReportsQueryKey(params),
    queryFn: () => customFetch<AdrReportList>("/api/adr"),
    ...options?.query,
  });
}

export const getGetAdrReportQueryKey = (id: number) => [`/api/adr/${id}`] as const;

export function useGetAdrReport(id: number, options?: { query?: UseQueryOptions<AdrReport, any> }) {
  return useQuery({
    queryKey: getGetAdrReportQueryKey(id),
    queryFn: () => customFetch<AdrReport>(`/api/adr/${id}`),
    enabled: !!id,
    ...options?.query,
  });
}

export function useCreateAdrReport(options?: { mutation?: UseMutationOptions<AdrReport, any, { data: CreateAdrReportRequest }> }) {
  return useMutation({
    mutationFn: ({ data }: { data: CreateAdrReportRequest }) => customFetch<AdrReport>("/api/adr", { method: "POST", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

// ── Analytics Hooks ──────────────────────────────────────────────────────────

export function useGetDashboardSummary(options?: { query?: UseQueryOptions<DashboardSummary, any> }) {
  return useQuery({
    queryKey: ["/api/analytics/dashboard"],
    queryFn: () => customFetch<DashboardSummary>("/api/analytics/dashboard"),
    ...options?.query,
  });
}

export function useGetRecentActivity(options?: { query?: UseQueryOptions<RecentActivity, any> }) {
  return useQuery({
    queryKey: ["/api/analytics/recent-activity"],
    queryFn: () => customFetch<RecentActivity>("/api/analytics/recent-activity"),
    ...options?.query,
  });
}

export function useGetResistanceTrends(options?: { query?: UseQueryOptions<ResistanceTrends, any> }) {
  return useQuery({
    queryKey: ["/api/analytics/resistance-trends"],
    queryFn: () => customFetch<ResistanceTrends>("/api/analytics/resistance-trends"),
    ...options?.query,
  });
}

export function useGetDrugUsageStats(options?: { query?: UseQueryOptions<DrugUsageStats, any> }) {
  return useQuery({
    queryKey: ["/api/analytics/drug-usage"],
    queryFn: () => customFetch<DrugUsageStats>("/api/analytics/drug-usage"),
    ...options?.query,
  });
}

export function useGetOrganismFrequency(options?: { query?: UseQueryOptions<OrganismFrequency, any> }) {
  return useQuery({
    queryKey: ["/api/analytics/organism-frequency"],
    queryFn: () => customFetch<OrganismFrequency>("/api/analytics/organism-frequency"),
    ...options?.query,
  });
}

export function useGetMlInfo(options?: { query?: UseQueryOptions<any, any> }) {
  return useQuery({
    queryKey: ["/api/ml/info"],
    queryFn: () => customFetch<any>("/api/ml/info"),
    ...options?.query,
  });
}

export function useGetMlModels(options?: { query?: UseQueryOptions<any, any> }) {
  return useQuery({
    queryKey: ["/api/ml/models"],
    queryFn: () => customFetch<any>("/api/ml/models"),
    ...options?.query,
  });
}

