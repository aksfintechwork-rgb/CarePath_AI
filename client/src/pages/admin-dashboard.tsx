import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, UserCheck, UserX, Activity, CalendarDays,
  Shield, Clock, CheckCircle, XCircle, Eye, Stethoscope,
  Building2, Award, Phone, Mail, ChevronRight, ArrowLeft,
  FileText, ClipboardList, FlaskConical, CalendarCheck,
  ScrollText, History, Pill, AlertTriangle, Search,
  MessageSquare, Send, AlertCircle, RefreshCw, X, Loader2,
  TrendingUp, DollarSign, Zap, Crown, PieChart as PieChartIcon, Sparkles, ArrowUpCircle
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

type DetailType = "active-subscriptions" | "trial-accounts" | "monthly-revenue" | "ai-minutes" | "chart-revenue" | "chart-subscriptions" | "chart-ai-usage" | "chart-doctor-growth" | null;

function StatDetailDialog({ type, onClose, analyticsData }: { type: DetailType; onClose: () => void; analyticsData?: AnalyticsData | null }) {
  const isChartType = type?.startsWith("chart-");
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/analytics/details", type],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/admin/analytics/details/${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!type && !isChartType,
  });

  const titles: Record<string, { title: string; icon: any; iconBg: string }> = {
    "active-subscriptions": { title: "Active Subscriptions", icon: Crown, iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500" },
    "trial-accounts": { title: "Trial Accounts", icon: Clock, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
    "monthly-revenue": { title: "Monthly Revenue Breakdown", icon: DollarSign, iconBg: "bg-gradient-to-br from-green-400 to-emerald-600" },
    "ai-minutes": { title: "AI Minutes Usage (This Month)", icon: Zap, iconBg: "bg-gradient-to-br from-violet-400 to-purple-500" },
    "chart-revenue": { title: "Monthly Revenue Growth", icon: TrendingUp, iconBg: "bg-gradient-to-br from-green-400 to-emerald-600" },
    "chart-subscriptions": { title: "Subscription Distribution", icon: PieChartIcon, iconBg: "bg-gradient-to-br from-violet-400 to-purple-600" },
    "chart-ai-usage": { title: "AI Usage Trends (30 Days)", icon: Zap, iconBg: "bg-gradient-to-br from-blue-400 to-indigo-600" },
    "chart-doctor-growth": { title: "Doctor Growth (12 Months)", icon: TrendingUp, iconBg: "bg-gradient-to-br from-cyan-400 to-blue-500" },
  };

  const info = type ? titles[type] : null;
  const Icon = info?.icon || Shield;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatCurrency = (v: number | string | null) => {
    const n = Number(v) || 0;
    return `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;
  };

  const totalMRR = type === "monthly-revenue" && data
    ? (data as any[]).reduce((sum: number, r: any) => sum + (Number(r.effectiveMRR) || 0), 0)
    : 0;

  return (
    <Dialog open={!!type} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${info?.iconBg} flex items-center justify-center shadow-lg`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold">{info?.title}</div>
              <div className="text-xs text-muted-foreground font-normal">{isChartType ? "Expanded View" : `${(data as any[])?.length || 0} records`}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {isChartType && analyticsData ? (
            <div className="pb-4 space-y-4">
              {type === "chart-revenue" && (
                <>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={analyticsData.monthlyRevenue}>
                      <defs>
                        <linearGradient id="revenueGradDialog" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(160, 70%, 40%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(160, 70%, 40%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 80% / 0.3)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => formatINR(v)} tick={{ fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip prefix="₹" />} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(160, 70%, 40%)" fill="url(#revenueGradDialog)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/50"><th className="px-4 py-2.5 text-left font-semibold">Month</th><th className="px-4 py-2.5 text-right font-semibold">Revenue</th></tr></thead>
                      <tbody>
                        {analyticsData.monthlyRevenue.map((r, i) => (
                          <tr key={i} className="border-t hover:bg-muted/30"><td className="px-4 py-2">{r.month}</td><td className="px-4 py-2 text-right font-semibold text-emerald-700">₹{Number(r.revenue).toLocaleString("en-IN")}</td></tr>
                        ))}
                        {analyticsData.monthlyRevenue.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No revenue data yet</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {type === "chart-subscriptions" && (
                <>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={analyticsData.subscriptionDistribution.map(d => ({ name: `${d.planName} (${d.status})`, value: Number(d.count) }))}
                        cx="50%" cy="50%" outerRadius={120} innerRadius={65}
                        dataKey="value" paddingAngle={3}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {analyticsData.subscriptionDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/50"><th className="px-4 py-2.5 text-left font-semibold">Plan</th><th className="px-4 py-2.5 text-left font-semibold">Status</th><th className="px-4 py-2.5 text-right font-semibold">Count</th></tr></thead>
                      <tbody>
                        {analyticsData.subscriptionDistribution.map((d, i) => (
                          <tr key={i} className="border-t hover:bg-muted/30">
                            <td className="px-4 py-2 font-medium">{d.planName}</td>
                            <td className="px-4 py-2"><Badge variant={d.status === "active" ? "default" : "secondary"}>{d.status}</Badge></td>
                            <td className="px-4 py-2 text-right font-semibold">{d.count}</td>
                          </tr>
                        ))}
                        {analyticsData.subscriptionDistribution.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No subscription data yet</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {type === "chart-ai-usage" && (
                <>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={analyticsData.aiUsageTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 80% / 0.3)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="minutes" name="Minutes" fill="hsl(215, 90%, 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="sessions" name="Sessions" fill="hsl(280, 60%, 55%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/50"><th className="px-4 py-2.5 text-left font-semibold">Date</th><th className="px-4 py-2.5 text-right font-semibold">Minutes</th><th className="px-4 py-2.5 text-right font-semibold">Sessions</th></tr></thead>
                      <tbody>
                        {analyticsData.aiUsageTrends.map((d, i) => (
                          <tr key={i} className="border-t hover:bg-muted/30">
                            <td className="px-4 py-2">{d.date}</td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-700">{Number(d.minutes).toFixed(1)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-purple-700">{d.sessions}</td>
                          </tr>
                        ))}
                        {analyticsData.aiUsageTrends.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No AI usage data yet</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {type === "chart-doctor-growth" && (
                <>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={analyticsData.doctorGrowth}>
                      <defs>
                        <linearGradient id="growthGradDialog" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(215, 90%, 45%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(215, 90%, 45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 80% / 0.3)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="count" name="Doctors" stroke="hsl(215, 90%, 45%)" fill="url(#growthGradDialog)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/50"><th className="px-4 py-2.5 text-left font-semibold">Month</th><th className="px-4 py-2.5 text-right font-semibold">Total Doctors</th></tr></thead>
                      <tbody>
                        {analyticsData.doctorGrowth.map((d, i) => (
                          <tr key={i} className="border-t hover:bg-muted/30">
                            <td className="px-4 py-2">{d.month}</td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-700">{d.count}</td>
                          </tr>
                        ))}
                        {analyticsData.doctorGrowth.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No growth data yet</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-muted-foreground">Loading details...</span>
            </div>
          ) : !data || (data as any[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No records found</div>
          ) : type === "active-subscriptions" ? (
            <div className="space-y-3 pb-4">
              {(data as any[]).map((row: any, i: number) => (
                <div key={i} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid={`detail-active-sub-${i}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-white">{row.doctorName?.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{row.doctorName}</div>
                      <div className="text-xs text-muted-foreground truncate">{row.doctorEmail}</div>
                      {row.clinicName && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="h-3 w-3" />{row.clinicName}</div>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">{row.planName}</Badge>
                    <Badge variant="outline">{row.billingCycle}</Badge>
                    <span className="font-semibold text-emerald-700">{formatCurrency(row.billingCycle === "monthly" ? row.monthlyPrice : row.annualPrice)}/{row.billingCycle === "monthly" ? "mo" : "yr"}</span>
                    <span className="text-muted-foreground">{formatDate(row.startDate)} — {formatDate(row.endDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : type === "trial-accounts" ? (
            <div className="space-y-3 pb-4">
              {(data as any[]).map((row: any, i: number) => {
                const daysLeft = row.endDate ? Math.max(0, Math.ceil((new Date(row.endDate).getTime() - Date.now()) / 86400000)) : 0;
                return (
                  <div key={i} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid={`detail-trial-${i}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-white">{row.doctorName?.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{row.doctorName}</div>
                        <div className="text-xs text-muted-foreground truncate">{row.doctorEmail}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">{row.planName} Trial</Badge>
                      <span className="text-muted-foreground">AI: {Math.round(Number(row.aiMinutesUsed) || 0)}/20 min</span>
                      <Badge variant={daysLeft <= 2 ? "destructive" : "outline"}>{daysLeft}d left</Badge>
                      <span className="text-muted-foreground">{formatDate(row.startDate)} — {formatDate(row.endDate)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : type === "monthly-revenue" ? (
            <div className="space-y-3 pb-4">
              <div className="glass-card rounded-xl p-4 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <span className="font-semibold text-green-800">Total Monthly Revenue (MRR)</span>
                <span className="text-2xl font-extrabold text-green-700">{formatCurrency(totalMRR)}</span>
              </div>
              {(data as any[]).map((row: any, i: number) => (
                <div key={i} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid={`detail-revenue-${i}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-white">{row.doctorName?.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{row.doctorName}</div>
                      <div className="text-xs text-muted-foreground truncate">{row.doctorEmail}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">{row.planName}</Badge>
                    <Badge variant="outline">{row.billingCycle}</Badge>
                    <span className="font-bold text-green-700 text-sm">{formatCurrency(row.effectiveMRR)}/mo</span>
                    <Badge variant={row.status === "active" ? "default" : "secondary"}>{row.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : type === "ai-minutes" ? (
            <div className="space-y-3 pb-4">
              {(data as any[]).map((row: any, i: number) => (
                <div key={i} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid={`detail-ai-${i}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-white">{row.doctorName?.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{row.doctorName}</div>
                      <div className="text-xs text-muted-foreground truncate">{row.doctorEmail}</div>
                      {row.specialization && <div className="text-xs text-muted-foreground mt-0.5">{row.specialization}</div>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="text-center">
                      <div className="text-lg font-bold text-violet-700">{Math.round(Number(row.minutesThisMonth) || 0)}</div>
                      <div className="text-muted-foreground">minutes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-700">{Number(row.sessionsThisMonth) || 0}</div>
                      <div className="text-muted-foreground">sessions</div>
                    </div>
                    <span className="text-muted-foreground">Last: {formatDate(row.lastUsed)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AnalyticsData {
  summary: {
    totalDoctors: number;
    totalPatients: number;
    totalVisits: number;
    todayVisits: number;
    activeSubscriptions: number;
    trialAccounts: number;
    expiredSubscriptions: number;
    mrr: number;
    aiMinutesToday: number;
    aiMinutesMonth: number;
    totalClinics: number;
  };
  topPlans: { planId: string; planName: string; count: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
  subscriptionDistribution: { planName: string; status: string; count: number }[];
  aiUsageTrends: { date: string; minutes: number; sessions: number }[];
  countryDistribution: { country: string; count: number }[];
  doctorGrowth: { month: string; count: number }[];
  topClinics: { clinicName: string; doctorCount: number; visitCount: number }[];
}

const CHART_COLORS = [
  "hsl(215, 90%, 45%)", "hsl(160, 70%, 40%)", "hsl(280, 60%, 55%)",
  "hsl(35, 90%, 50%)", "hsl(340, 70%, 50%)", "hsl(195, 80%, 45%)",
  "hsl(120, 50%, 40%)", "hsl(0, 70%, 55%)",
];

function formatINR(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value)}`;
}

const ChartTooltip = ({ active, payload, label, prefix = "" }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="font-medium text-muted-foreground text-xs mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="font-semibold" style={{ color: entry.color }}>
          {entry.name}: {prefix}{typeof entry.value === "number" ? entry.value.toLocaleString("en-IN") : entry.value}
        </p>
      ))}
    </div>
  );
};

type AdminTab = "dashboard" | "doctors" | "doctor-data" | "audit";

export default function AdminDashboard({ section = "dashboard" }: { section?: AdminTab }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const activeTab = section;
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedDoctorForData, setSelectedDoctorForData] = useState<any>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [detailType, setDetailType] = useState<DetailType>(null);

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/admin/stats", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/admin/analytics", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    refetchInterval: 30000,
    enabled: activeTab === "dashboard",
  });

  const { data: doctors, isLoading } = useQuery({
    queryKey: ["/api/admin/doctors"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/admin/doctors", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed to fetch doctors");
      return res.json();
    },
  });

  const { data: publicPlans } = useQuery({
    queryKey: ["/api/subscription-plans/public"],
    queryFn: async () => {
      const res = await fetch("/api/subscription-plans/public");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
  });

  const planMap = (publicPlans || []).reduce((acc: Record<string, any>, p: any) => { acc[p.id] = p; return acc; }, {});

  const { data: doctorPatients } = useQuery({
    queryKey: ["/api/admin/doctors", selectedDoctorForData?.id, "patients"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/admin/doctors/${selectedDoctorForData.id}/patients`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedDoctorForData?.id,
  });

  const { data: patientVisitsData } = useQuery({
    queryKey: ["/api/admin/patients", selectedPatient?.id, "visits"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/admin/patients/${selectedPatient.id}/visits`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedPatient?.id,
  });

  const { data: doctorDetail } = useQuery({
    queryKey: ["/api/admin/doctors", selectedDoctorForData?.id],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/admin/doctors/${selectedDoctorForData.id}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedDoctorForData?.id,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["/api/admin/audit-logs"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/admin/audit-logs", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
    enabled: section === "audit",
  });

  const { data: whatsappStatus } = useQuery({
    queryKey: ["/api/admin/whatsapp-status"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/admin/whatsapp-status", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed to fetch WhatsApp status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (doctorId: string) => {
      const token = getSessionToken();
      const res = await fetch(`/api/admin/doctors/${doctorId}/approve`, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast({ title: "Doctor Approved", description: "Doctor can now access the platform." });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (doctorId: string) => {
      const token = getSessionToken();
      const res = await fetch(`/api/admin/doctors/${doctorId}/reject`, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed to reject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast({ title: "Doctor Rejected", description: "Registration has been declined." });
    },
  });

  const { data: upgradeRequests } = useQuery({
    queryKey: ["/api/admin/upgrade-requests"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/admin/upgrade-requests", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const pendingUpgrades = (upgradeRequests || []).filter((r: any) => r.status === "pending");

  const approveUpgradeMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = getSessionToken();
      const res = await fetch(`/api/admin/upgrade-requests/${id}/approve`, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrade-requests"] });
      toast({ title: "Upgrade Approved", description: "Doctor plan has been upgraded." });
    },
    onError: () => { toast({ title: "Error", description: "Failed to approve upgrade request.", variant: "destructive" }); },
  });

  const rejectUpgradeMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = getSessionToken();
      const res = await fetch(`/api/admin/upgrade-requests/${id}/reject`, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrade-requests"] });
      toast({ title: "Upgrade Rejected", description: "Upgrade request has been declined." });
    },
    onError: () => { toast({ title: "Error", description: "Failed to reject upgrade request.", variant: "destructive" }); },
  });

  const statCards = [
    { label: "Total Doctors", value: stats?.totalDoctors || 0, sub: "registered doctors", icon: Users, iconBg: "bg-gradient-to-br from-cyan-400 to-blue-500", tintClass: "stat-card-blue", shadowColor: "shadow-cyan-500/25", link: "/admin/doctors" },
    { label: "Active Doctors", value: (doctors?.filter((d: any) => d.status === "approved") || []).length, sub: "platform active", icon: UserCheck, iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500", tintClass: "stat-card-green", shadowColor: "shadow-emerald-500/25", link: "/admin/doctors" },
    { label: "Total Patients", value: stats?.totalPatients || 0, sub: "across platform", icon: Activity, iconBg: "bg-gradient-to-br from-violet-400 to-purple-500", tintClass: "stat-card-purple", shadowColor: "shadow-violet-500/25", link: "/admin/doctor-data" },
    { label: "Total Visits", value: stats?.totalVisits || 0, sub: "all time", icon: CalendarDays, iconBg: "bg-gradient-to-br from-blue-400 to-indigo-500", tintClass: "stat-card-blue", shadowColor: "shadow-blue-500/25", link: "/admin/doctor-data" },
  ];

  const pendingDoctors = doctors?.filter((d: any) => d.status === "pending") || [];
  const approvedDoctors = doctors?.filter((d: any) => d.status === "approved") || [];
  const rejectedDoctors = doctors?.filter((d: any) => d.status === "rejected") || [];

  const filteredDoctors = doctorFilter === "all" ? (doctors || []) :
    (doctors || []).filter((d: any) => d.status === doctorFilter);

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "PENDING" },
      approved: { variant: "default", label: "ACTIVE" },
      rejected: { variant: "destructive", label: "REJECTED" },
      draft: { variant: "secondary", label: "Draft" },
      active: { variant: "default", label: "Active" },
      recording: { variant: "outline", label: "Recording" },
      processing: { variant: "outline", label: "Processing" },
    };
    const s = map[status] || { variant: "outline" as const, label: status };
    return <Badge variant={s.variant} data-testid={`badge-status-${status}`}>{s.label}</Badge>;
  };

  const formatDate = (d: string | Date | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatDateTime = (d: string | Date | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const actionIcon = (action: string) => {
    if (action.includes("APPROVE")) return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (action.includes("REJECT")) return <XCircle className="h-4 w-4 text-red-500" />;
    if (action.includes("LOGIN")) return <Shield className="h-4 w-4 text-blue-500" />;
    return <History className="h-4 w-4 text-gray-500" />;
  };

  const sectionHeaders: Record<AdminTab, { title: string; subtitle: string; icon: any; iconBg: string }> = {
    dashboard: { title: "CarePath_Admin", subtitle: `Welcome, ${user?.name || "Admin"} — Platform overview & stats`, icon: Shield, iconBg: "bg-gradient-to-br from-violet-500 to-purple-600" },
    doctors: { title: "Doctor Management", subtitle: "Registration verification, approvals & doctor profiles", icon: Users, iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600" },
    "doctor-data": { title: "Doctor-wise Data", subtitle: "Drill down into doctor patients, visits & care plans", icon: Search, iconBg: "bg-gradient-to-br from-indigo-500 to-purple-600" },
    audit: { title: "Audit Log", subtitle: "Track all admin actions & system events", icon: ScrollText, iconBg: "bg-gradient-to-br from-slate-500 to-gray-600" },
  };

  const header = sectionHeaders[activeTab];

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <PageHeader
        title={header.title}
        subtitle={header.subtitle}
        icon={header.icon}
        iconBg={header.iconBg}
        testId="text-admin-title"
      />

      {activeTab === "dashboard" && (
        <div className="space-y-6 animate-fade-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
          {pendingUpgrades.length > 0 && (
            <div className="glass-card-strong rounded-2xl p-6 border-2 border-violet-200/60 ring-1 ring-violet-100" data-testid="section-upgrade-requests">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4" data-testid="text-upgrade-requests-title">
                <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <ArrowUpCircle className="h-4 w-4 text-white" />
                </div>
                Upgrade Requests
                <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-violet-600 text-white text-xs font-bold">{pendingUpgrades.length}</span>
              </h2>
              <div className="space-y-3">
                {pendingUpgrades.map((req: any) => (
                  <div key={req.id} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" data-testid={`card-upgrade-${req.id}`}>
                    <div>
                      <div className="font-medium">{req.doctorName}</div>
                      <div className="text-xs text-muted-foreground">{req.doctorEmail}</div>
                      <div className="text-sm mt-1">
                        <span className="text-muted-foreground">{req.currentPlanName}</span>
                        <span className="mx-2 text-violet-500">→</span>
                        <span className="font-semibold text-violet-700">{req.requestedPlanName}</span>
                        <span className="text-xs text-muted-foreground ml-1">₹{new Intl.NumberFormat('en-IN').format(req.requestedPlanPrice)}/mo</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25" onClick={() => approveUpgradeMutation.mutate(req.id)} disabled={approveUpgradeMutation.isPending} data-testid={`button-approve-upgrade-${req.id}`}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectUpgradeMutation.mutate(req.id)} disabled={rejectUpgradeMutation.isPending} data-testid={`button-reject-upgrade-${req.id}`}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  onClick={() => setLocation(card.link)}
                  className={`glass-card ${card.tintClass} rounded-2xl p-5 animate-fade-up overflow-hidden group relative cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
                  style={{ animationDelay: `${(index + 1) * 0.08}s`, opacity: 0 }}
                  data-testid={`stat-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>{card.label}</span>
                    <div className={`icon-container h-11 w-11 rounded-xl ${card.iconBg} flex items-center justify-center shadow-lg ${card.shadowColor} group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="text-4xl font-extrabold tracking-tight text-foreground animate-count-up" style={{ animationDelay: `${(index + 1) * 0.1 + 0.3}s`, opacity: 0 }}>
                    {card.value}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${card.iconBg}`} />
                    <p className="text-xs text-muted-foreground font-medium">{card.sub}</p>
                  </div>
                  <div className={`absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-500 ${card.iconBg}`} />
                </div>
              );
            })}
          </div>

          {analytics && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Active Subscriptions", value: Number(analytics.summary.activeSubscriptions) || 0, icon: Crown, iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500", tintClass: "stat-card-green", shadowColor: "shadow-emerald-500/25", sub: "paid plans — click to view", detailKey: "active-subscriptions" as DetailType },
                  { label: "Trial Accounts", value: Number(analytics.summary.trialAccounts) || 0, icon: Clock, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500", tintClass: "stat-card-amber", shadowColor: "shadow-amber-500/25", sub: "in trial — click to view", detailKey: "trial-accounts" as DetailType },
                  { label: "Monthly Revenue", value: formatINR(Number(analytics.summary.mrr) || 0), icon: DollarSign, iconBg: "bg-gradient-to-br from-green-400 to-emerald-600", tintClass: "stat-card-green", shadowColor: "shadow-green-500/25", sub: "MRR — click to view", detailKey: "monthly-revenue" as DetailType },
                  { label: "AI Minutes (Month)", value: Math.round(Number(analytics.summary.aiMinutesMonth) || 0), icon: Zap, iconBg: "bg-gradient-to-br from-violet-400 to-purple-500", tintClass: "stat-card-purple", shadowColor: "shadow-violet-500/25", sub: `${Math.round(Number(analytics.summary.aiMinutesToday) || 0)} today — click to view`, detailKey: "ai-minutes" as DetailType },
                ].map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className={`glass-card ${card.tintClass} rounded-2xl p-5 animate-fade-up overflow-hidden group relative cursor-pointer hover:ring-2 hover:ring-blue-300 hover:shadow-xl transition-all duration-200`}
                      style={{ animationDelay: `${(index + 7) * 0.08}s`, opacity: 0 }}
                      data-testid={`stat-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => setDetailType(card.detailKey)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>{card.label}</span>
                        <div className={`icon-container h-10 w-10 rounded-xl ${card.iconBg} flex items-center justify-center shadow-lg ${card.shadowColor} group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="text-3xl font-extrabold tracking-tight text-foreground">{card.value}</div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${card.iconBg}`} />
                        <p className="text-xs text-muted-foreground font-medium">{card.sub}</p>
                      </div>
                      <div className="absolute top-3 right-14 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className={`absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-500 ${card.iconBg}`} />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card-strong rounded-2xl p-6 cursor-pointer hover:ring-2 hover:ring-green-300 hover:shadow-xl transition-all duration-200" data-testid="chart-monthly-revenue" onClick={() => setDetailType("chart-revenue")}>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
                      <TrendingUp className="h-4 w-4 text-white" />
                    </div>
                    Monthly Revenue Growth
                  </h3>
                  {analytics.monthlyRevenue.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={analytics.monthlyRevenue}>
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(160, 70%, 40%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(160, 70%, 40%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 80% / 0.3)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => formatINR(v)} tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip prefix="₹" />} />
                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(160, 70%, 40%)" fill="url(#revenueGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
                  )}
                </div>

                <div className="glass-card-strong rounded-2xl p-6 cursor-pointer hover:ring-2 hover:ring-violet-300 hover:shadow-xl transition-all duration-200" data-testid="chart-subscription-dist" onClick={() => setDetailType("chart-subscriptions")}>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                      <PieChartIcon className="h-4 w-4 text-white" />
                    </div>
                    Subscription Distribution
                  </h3>
                  {analytics.subscriptionDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={analytics.subscriptionDistribution.map(d => ({ name: `${d.planName} (${d.status})`, value: Number(d.count) }))}
                          cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                          dataKey="value" paddingAngle={3}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {analytics.subscriptionDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">No subscription data yet</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card-strong rounded-2xl p-6 cursor-pointer hover:ring-2 hover:ring-blue-300 hover:shadow-xl transition-all duration-200" data-testid="chart-ai-usage" onClick={() => setDetailType("chart-ai-usage")}>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    AI Usage Trends (30 Days)
                  </h3>
                  {analytics.aiUsageTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={analytics.aiUsageTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 80% / 0.3)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="minutes" name="Minutes" fill="hsl(215, 90%, 45%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="sessions" name="Sessions" fill="hsl(280, 60%, 55%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">No AI usage data yet</div>
                  )}
                </div>

                <div className="glass-card-strong rounded-2xl p-6 cursor-pointer hover:ring-2 hover:ring-cyan-300 hover:shadow-xl transition-all duration-200" data-testid="chart-doctor-growth" onClick={() => setDetailType("chart-doctor-growth")}>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                      <TrendingUp className="h-4 w-4 text-white" />
                    </div>
                    Doctor Growth (12 Months)
                  </h3>
                  {analytics.doctorGrowth.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={analytics.doctorGrowth}>
                        <defs>
                          <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(215, 90%, 45%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(215, 90%, 45%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 80% / 0.3)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="count" name="Doctors" stroke="hsl(215, 90%, 45%)" fill="url(#growthGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">No growth data yet</div>
                  )}
                </div>
              </div>

              {(analytics.topPlans.length > 0 || analytics.topClinics.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {analytics.topPlans.length > 0 && (
                    <div className="glass-card-strong rounded-2xl p-6" data-testid="chart-top-plans">
                      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                        <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                          <Crown className="h-4 w-4 text-white" />
                        </div>
                        Plan Popularity
                      </h3>
                      <div className="space-y-3">
                        {analytics.topPlans.map((plan, i) => {
                          const maxCount = Math.max(...analytics.topPlans.map(p => Number(p.count)), 1);
                          const pct = (Number(plan.count) / maxCount) * 100;
                          const medals = ["🥇", "🥈", "🥉"];
                          return (
                            <div key={plan.planId} className="space-y-1.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium flex items-center gap-1.5">
                                  {i < 3 && <span>{medals[i]}</span>}
                                  {plan.planName}
                                </span>
                                <span className="text-muted-foreground font-semibold">{plan.count}</span>
                              </div>
                              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {analytics.topClinics.length > 0 && (
                    <div className="glass-card-strong rounded-2xl p-6" data-testid="chart-top-clinics">
                      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                        <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                          <Building2 className="h-4 w-4 text-white" />
                        </div>
                        Top Clinics
                      </h3>
                      <div className="space-y-2">
                        {analytics.topClinics.slice(0, 5).map((clinic, i) => (
                          <div key={clinic.clinicName} className="glass-card rounded-xl p-3 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{clinic.clinicName}</div>
                              <div className="text-xs text-muted-foreground">{clinic.doctorCount} doctors · {clinic.visitCount} visits</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {pendingDoctors.length > 0 && (
            <div className="glass-card-strong rounded-2xl p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4" data-testid="text-pending-title">
                <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                Pending Approvals ({pendingDoctors.length})
              </h2>
              <div className="space-y-3">
                {pendingDoctors.map((doc: any) => (
                  <div key={doc.id} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" data-testid={`card-pending-doctor-${doc.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <span className="text-sm font-bold text-white">{doc.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {doc.name}
                          {doc.selectedPlanId && planMap[doc.selectedPlanId] && (
                            <Badge className="bg-gradient-to-r from-blue-500 to-violet-600 text-white text-[10px] px-2 py-0 border-0 shadow-sm">
                              <Crown className="h-3 w-3 mr-1" />{planMap[doc.selectedPlanId].name} · 7-day trial
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{doc.email}</span>
                          {doc.specialization && <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" />{doc.specialization}</span>}
                          {doc.licenseNumber && <span className="flex items-center gap-1"><Award className="h-3 w-3" />{doc.licenseNumber}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedDoctor(doc)} data-testid={`button-view-${doc.id}`}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                      <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25" onClick={() => approveMutation.mutate(doc.id)} disabled={approveMutation.isPending} data-testid={`button-approve-${doc.id}`}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate(doc.id)} disabled={rejectMutation.isPending} data-testid={`button-reject-${doc.id}`}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card-strong rounded-2xl p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              WhatsApp Reminders
              {whatsappStatus?.configured ? (
                <span className="ml-2 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${whatsappStatus?.schedulerRunning ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                  <span className="text-xs font-normal text-muted-foreground">{whatsappStatus?.schedulerRunning ? "Active" : "Stopped"}</span>
                </span>
              ) : (
                <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300 bg-amber-50">Not Configured</Badge>
              )}
            </h2>

            {whatsappStatus?.configured ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="glass-card rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Send className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{whatsappStatus?.today?.totalSent || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">Sent Today</div>
                  </div>
                  <div className="glass-card rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">{whatsappStatus?.today?.totalResponded || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">Responded</div>
                  </div>
                  <div className="glass-card rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    </div>
                    <div className="text-2xl font-bold text-red-600">{whatsappStatus?.today?.totalFailed || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">Failed</div>
                  </div>
                  <div className="glass-card rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Activity className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    <div className="text-2xl font-bold text-violet-600">{whatsappStatus?.today?.deliveryRate || 0}%</div>
                    <div className="text-xs text-muted-foreground mt-1">Delivery Rate</div>
                  </div>
                </div>

                {whatsappStatus?.recentFailed?.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Recent Failures
                    </h3>
                    <div className="space-y-2">
                      {whatsappStatus.recentFailed.slice(0, 5).map((msg: any) => (
                        <div key={msg.id} className="glass-card rounded-lg p-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{msg.patientName}</span>
                            <span className="text-muted-foreground mx-1">—</span>
                            <span className="text-muted-foreground">{msg.medicineName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 whitespace-nowrap">
                              <RefreshCw className="h-3 w-3 mr-1" /> {msg.retryCount || 0}/3
                            </Badge>
                            <span className="text-muted-foreground truncate max-w-[200px]" title={msg.error}>{msg.error || "Unknown error"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="glass-card rounded-xl p-6 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">WhatsApp Cloud API is not configured.</p>
                <p className="text-xs text-muted-foreground mt-1">Set <code className="bg-muted px-1.5 py-0.5 rounded text-xs">WHATSAPP_ACCESS_TOKEN</code> and <code className="bg-muted px-1.5 py-0.5 rounded text-xs">WHATSAPP_PHONE_NUMBER_ID</code> to enable automated reminders.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "doctors" && (
        <div className="space-y-6 animate-fade-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
          <div className="glass-card-strong rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Users className="h-4 w-4 text-white" />
                </div>
                Doctor Registration & Verification
              </h2>
              <div className="flex gap-2">
                {["all", "pending", "approved", "rejected"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setDoctorFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      doctorFilter === f
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md"
                        : "glass-card hover:bg-white/50"
                    }`}
                    data-testid={`filter-${f}`}
                  >
                    {f === "all" ? "All" : f === "approved" ? "Active" : f.charAt(0).toUpperCase() + f.slice(1)} ({
                      f === "all" ? (doctors?.length || 0) :
                      f === "pending" ? pendingDoctors.length :
                      f === "approved" ? approvedDoctors.length :
                      rejectedDoctors.length
                    })
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading doctors...</div>
            ) : filteredDoctors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No doctors found</div>
            ) : (
              <div className="space-y-3">
                {filteredDoctors.map((doc: any) => (
                  <div key={doc.id} className="glass-card rounded-xl p-4 hover:bg-white/50 transition-all" data-testid={`row-doctor-${doc.id}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg ${
                          doc.status === "approved" ? "bg-gradient-to-br from-emerald-400 to-teal-500" :
                          doc.status === "pending" ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                          "bg-gradient-to-br from-red-400 to-rose-500"
                        }`}>
                          <span className="text-sm font-bold text-white">{doc.name?.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold">{doc.name}</div>
                            {statusBadge(doc.status)}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 mt-1">
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{doc.email}</span>
                            {doc.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{doc.phone}</span>}
                            {doc.specialization && <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" />{doc.specialization}</span>}
                            {doc.licenseNumber && <span className="flex items-center gap-1"><Award className="h-3 w-3" />{doc.licenseNumber}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-4 mt-1">
                            <span>{doc.patientCount || 0} patients</span>
                            <span>{doc.visitCount || 0} visits</span>
                            <span>{doc.todayVisits || 0} today</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedDoctor(doc)} data-testid={`button-view-doctor-${doc.id}`}>
                          <Eye className="h-4 w-4 mr-1" /> Profile
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setLocation("/admin/doctor-data")} data-testid={`button-data-${doc.id}`}>
                          <FileText className="h-4 w-4 mr-1" /> Data
                        </Button>
                        {doc.status === "pending" && (
                          <>
                            <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25" onClick={() => approveMutation.mutate(doc.id)} disabled={approveMutation.isPending} data-testid={`button-approve-${doc.id}`}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate(doc.id)} disabled={rejectMutation.isPending} data-testid={`button-reject-${doc.id}`}>
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {doc.status === "rejected" && (
                          <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600" onClick={() => approveMutation.mutate(doc.id)} data-testid={`button-reapprove-${doc.id}`}>
                            <UserCheck className="h-4 w-4 mr-1" /> Re-Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "doctor-data" && (
        <div className="space-y-6 animate-fade-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
          {!selectedDoctorForData ? (
            <div className="glass-card-strong rounded-2xl p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-5">
                <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Search className="h-4 w-4 text-white" />
                </div>
                Select a Doctor to View Data
              </h2>
              <p className="text-sm text-muted-foreground mb-4">Choose a doctor to drill down into their patients, visits, and care plans. Admin has read-only access to all medical data.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(doctors || []).filter((d: any) => d.status === "approved").map((doc: any) => (
                  <button
                    key={doc.id}
                    onClick={() => { setSelectedDoctorForData(doc); setSelectedPatient(null); setSelectedVisit(null); }}
                    className="glass-card rounded-xl p-4 text-left hover:bg-white/50 transition-all group"
                    data-testid={`select-doctor-${doc.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                        <span className="text-sm font-bold text-white">{doc.name?.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{doc.name}</div>
                        <div className="text-xs text-muted-foreground">{doc.specialization || "General"}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>{doc.patientCount || 0} patients</span>
                      <span>{doc.visitCount || 0} visits</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : !selectedPatient ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedDoctorForData(null); setSelectedPatient(null); setSelectedVisit(null); }} data-testid="button-back-doctors">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{selectedDoctorForData.name?.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Dr. {selectedDoctorForData.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedDoctorForData.specialization || "General"} &middot; {selectedDoctorForData.email}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="glass-card rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{doctorDetail?.stats?.patientCount || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Patients</div>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{doctorDetail?.stats?.visitCount || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Visits</div>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{doctorDetail?.stats?.todayVisits || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Today's Visits</div>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{doctorDetail?.visits?.filter((v: any) => v.status === "active").length || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Active Care Plans</div>
                </div>
              </div>

              <div className="glass-card-strong rounded-2xl p-6">
                <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                  <div className="icon-container h-8 w-8 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  Patient List ({doctorPatients?.length || 0})
                </h3>
                {!doctorPatients || doctorPatients.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">No patients found for this doctor</div>
                ) : (
                  <div className="space-y-2">
                    {doctorPatients.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPatient(p); setSelectedVisit(null); }}
                        className="w-full glass-card rounded-xl p-4 text-left hover:bg-white/50 transition-all group"
                        data-testid={`patient-row-${p.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-xs font-bold text-white">{p.name?.charAt(0)}</span>
                            </div>
                            <div>
                              <div className="font-medium text-sm">{p.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-3">
                                <span>{p.age} yrs, {p.gender || "—"}</span>
                                {p.whatsappNumber && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.whatsappNumber}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right text-xs text-muted-foreground">
                              <div>{p.totalVisits} visits</div>
                              <div>{p.activeVisits} active</div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : !selectedVisit ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedPatient(null); setSelectedVisit(null); }} data-testid="button-back-patients">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back to Patients
                </Button>
                <div className="text-xs text-muted-foreground">
                  Dr. {selectedDoctorForData.name} &rarr; {selectedPatient.name}
                </div>
              </div>

              <div className="glass-card-strong rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{selectedPatient.name?.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{selectedPatient.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedPatient.age} yrs, {selectedPatient.gender || "—"}{selectedPatient.whatsappNumber ? ` · ${selectedPatient.whatsappNumber}` : ""}
                    </div>
                  </div>
                </div>
                {selectedPatient.knownConditions && (
                  <div className="glass-card rounded-xl p-3 mb-2">
                    <div className="text-xs text-muted-foreground">Known Conditions</div>
                    <div className="text-sm">{selectedPatient.knownConditions}</div>
                  </div>
                )}
                {selectedPatient.allergies && (
                  <div className="glass-card rounded-xl p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Allergies</div>
                    <div className="text-sm">{selectedPatient.allergies}</div>
                  </div>
                )}
              </div>

              <div className="glass-card-strong rounded-2xl p-6">
                <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                  <div className="icon-container h-8 w-8 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <CalendarDays className="h-4 w-4 text-white" />
                  </div>
                  Visit History ({patientVisitsData?.visits?.length || 0})
                </h3>
                {!patientVisitsData?.visits || patientVisitsData.visits.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">No visits found</div>
                ) : (
                  <div className="space-y-3">
                    {patientVisitsData.visits.map((v: any) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVisit(v)}
                        className="w-full glass-card rounded-xl p-4 text-left hover:bg-white/50 transition-all group"
                        data-testid={`visit-row-${v.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-sm">{formatDate(v.visitDate)}</div>
                              {statusBadge(v.status)}
                              {v.approved && <Badge variant="outline" className="text-xs">Approved</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                              <span>{v.language || "English"}</span>
                              <span>{v.medicines?.length || 0} medicines</span>
                              <span>{v.tests?.length || 0} tests</span>
                              <span>{v.followups?.length || 0} follow-ups</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedVisit(null)} data-testid="button-back-visits">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back to Visits
                </Button>
                <div className="text-xs text-muted-foreground">
                  Dr. {selectedDoctorForData.name} &rarr; {selectedPatient.name} &rarr; Visit {formatDate(selectedVisit.visitDate)}
                </div>
              </div>

              <div className="glass-card-strong rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Care Plan Details</h3>
                  <div className="flex items-center gap-2">
                    {statusBadge(selectedVisit.status)}
                    {selectedVisit.approved && <Badge className="bg-emerald-100 text-emerald-700">Approved</Badge>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="glass-card rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">Visit Date</div>
                    <div className="text-sm font-medium">{formatDateTime(selectedVisit.visitDate)}</div>
                  </div>
                  <div className="glass-card rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">Language</div>
                    <div className="text-sm font-medium">{selectedVisit.language || "English"}</div>
                  </div>
                  {selectedVisit.approvedAt && (
                    <div className="glass-card rounded-xl p-3">
                      <div className="text-xs text-muted-foreground">Approved At</div>
                      <div className="text-sm font-medium">{formatDateTime(selectedVisit.approvedAt)}</div>
                    </div>
                  )}
                </div>

                {(selectedVisit.aiDraftJson as any)?.summary && (
                  <div className="glass-card rounded-xl p-4 mb-4">
                    <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><ClipboardList className="h-3 w-3" /> Summary</div>
                    <div className="text-sm">{(selectedVisit.aiDraftJson as any).summary}</div>
                  </div>
                )}

                {(selectedVisit.aiDraftJson as any)?.complaint && (
                  <div className="glass-card rounded-xl p-4 mb-4">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Chief Complaint</div>
                    <div className="text-sm">{(selectedVisit.aiDraftJson as any).complaint}</div>
                  </div>
                )}

                {(selectedVisit.aiDraftJson as any)?.diagnosis_impression && (
                  <div className="glass-card rounded-xl p-4 mb-4">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Provisional Diagnosis</div>
                    <div className="text-sm">{(selectedVisit.aiDraftJson as any).diagnosis_impression}</div>
                  </div>
                )}
              </div>

              {selectedVisit.medicines?.length > 0 && (
                <div className="glass-card-strong rounded-2xl p-6">
                  <h4 className="text-base font-semibold flex items-center gap-2 mb-4">
                    <div className="icon-container h-8 w-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Pill className="h-4 w-4 text-white" />
                    </div>
                    Medicines ({selectedVisit.medicines.length})
                  </h4>
                  <div className="glass-table overflow-x-auto">
                    <table className="w-full" data-testid="table-medicines">
                      <thead>
                        <tr>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">#</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Medicine</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Dose</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Frequency</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Timing</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Instructions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/30">
                        {selectedVisit.medicines.map((med: any, i: number) => (
                          <tr key={med.id} className="hover:bg-white/30">
                            <td className="p-3 text-sm">{i + 1}</td>
                            <td className="p-3 text-sm font-medium">{med.name}</td>
                            <td className="p-3 text-sm">{med.dose || "—"}</td>
                            <td className="p-3 text-sm">{med.frequency || "—"}</td>
                            <td className="p-3 text-sm">{med.timing || "—"}</td>
                            <td className="p-3 text-sm">{med.instructions || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedVisit.tests?.length > 0 && (
                <div className="glass-card-strong rounded-2xl p-6">
                  <h4 className="text-base font-semibold flex items-center gap-2 mb-4">
                    <div className="icon-container h-8 w-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                      <FlaskConical className="h-4 w-4 text-white" />
                    </div>
                    Tests ({selectedVisit.tests.length})
                  </h4>
                  <div className="glass-table overflow-x-auto">
                    <table className="w-full" data-testid="table-tests">
                      <thead>
                        <tr>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">#</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Test</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">When</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Urgency</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Condition</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/30">
                        {selectedVisit.tests.map((t: any, i: number) => (
                          <tr key={t.id} className="hover:bg-white/30">
                            <td className="p-3 text-sm">{i + 1}</td>
                            <td className="p-3 text-sm font-medium">{t.name}</td>
                            <td className="p-3 text-sm">{t.whenToDo || "—"}</td>
                            <td className="p-3 text-sm">{t.urgency || "—"}</td>
                            <td className="p-3 text-sm">{t.triggerCondition || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedVisit.followups?.length > 0 && (
                <div className="glass-card-strong rounded-2xl p-6">
                  <h4 className="text-base font-semibold flex items-center gap-2 mb-4">
                    <div className="icon-container h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                      <CalendarCheck className="h-4 w-4 text-white" />
                    </div>
                    Follow-ups ({selectedVisit.followups.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedVisit.followups.map((f: any) => (
                      <div key={f.id} className="glass-card rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarCheck className="h-4 w-4 text-emerald-500" />
                          <span className="font-medium text-sm">Follow-up after {f.followupAfterDays || "—"} days</span>
                        </div>
                        {f.notes && <div className="text-sm text-muted-foreground mb-1">{f.notes}</div>}
                        {f.warningSigns?.length > 0 && (
                          <div className="text-xs text-red-600 flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            Warning Signs: {f.warningSigns.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="glass-card rounded-xl p-4 text-center text-xs text-muted-foreground">
                <Shield className="h-4 w-4 inline mr-1" />
                Admin Read-Only View — Medical decisions remain doctor-only
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "audit" && (
        <div className="space-y-6 animate-fade-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
          <div className="glass-card-strong rounded-2xl p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-5">
              <div className="icon-container h-9 w-9 rounded-xl bg-gradient-to-br from-slate-400 to-gray-600 flex items-center justify-center shadow-lg shadow-slate-500/25">
                <ScrollText className="h-4 w-4 text-white" />
              </div>
              System Audit Log
            </h2>
            {!auditLogs || auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No audit logs yet. Admin actions will appear here.</div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="glass-card rounded-xl p-4 flex items-start gap-3" data-testid={`audit-log-${log.id}`}>
                    <div className="mt-0.5">{actionIcon(log.action)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{log.action.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className="text-xs">{log.targetType}</Badge>
                      </div>
                      {log.details && <div className="text-sm text-muted-foreground mt-1">{log.details}</div>}
                      <div className="text-xs text-muted-foreground mt-1">
                        By {log.adminName} &middot; {formatDateTime(log.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedDoctor && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} className="bg-black/40 backdrop-blur-sm" onClick={() => setSelectedDoctor(null)}>
          <div className="glass-card-strong rounded-2xl shadow-2xl animate-scale-in" style={{ maxWidth: '32rem', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }} onClick={e => e.stopPropagation()} data-testid="modal-doctor-details">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold gradient-text-health">Doctor Profile</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDoctor(null)} data-testid="button-close-modal">
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`icon-container h-14 w-14 rounded-full flex items-center justify-center shadow-lg ${
                  selectedDoctor.status === "approved" ? "bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/25" :
                  selectedDoctor.status === "pending" ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/25" :
                  "bg-gradient-to-br from-red-400 to-rose-500 shadow-red-500/25"
                }`}>
                  <span className="text-xl font-bold text-white">{selectedDoctor.name?.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-bold text-lg">{selectedDoctor.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedDoctor.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {selectedDoctor.phone && (
                  <div className="glass-card rounded-xl p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Phone</div>
                    <div className="text-sm font-medium">{selectedDoctor.phone}</div>
                  </div>
                )}
                {selectedDoctor.specialization && (
                  <div className="glass-card rounded-xl p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Stethoscope className="h-3 w-3" />Specialization</div>
                    <div className="text-sm font-medium">{selectedDoctor.specialization}</div>
                  </div>
                )}
                {selectedDoctor.licenseNumber && (
                  <div className="glass-card rounded-xl p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Award className="h-3 w-3" />License</div>
                    <div className="text-sm font-medium">{selectedDoctor.licenseNumber}</div>
                  </div>
                )}
                {selectedDoctor.experience && (
                  <div className="glass-card rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">Experience</div>
                    <div className="text-sm font-medium">{selectedDoctor.experience} years</div>
                  </div>
                )}
                {selectedDoctor.clinicName && (
                  <div className="glass-card rounded-xl p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />Clinic</div>
                    <div className="text-sm font-medium">{selectedDoctor.clinicName}</div>
                  </div>
                )}
                {selectedDoctor.qualifications && (
                  <div className="glass-card rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">Qualifications</div>
                    <div className="text-sm font-medium">{selectedDoctor.qualifications}</div>
                  </div>
                )}
              </div>
              {selectedDoctor.clinicAddress && (
                <div className="glass-card rounded-xl p-3">
                  <div className="text-xs text-muted-foreground">Clinic Address</div>
                  <div className="text-sm font-medium">{selectedDoctor.clinicAddress}</div>
                </div>
              )}
              {selectedDoctor.selectedPlanId && planMap[selectedDoctor.selectedPlanId] && (
                <div className="rounded-xl p-3 bg-gradient-to-r from-blue-50/80 to-violet-50/80 border border-blue-200/50">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Crown className="h-3 w-3" />Selected Plan</div>
                  <div className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                    {planMap[selectedDoctor.selectedPlanId].name}
                    {planMap[selectedDoctor.selectedPlanId].isEnterprise
                      ? <span className="text-xs font-normal text-muted-foreground">· Custom Pricing</span>
                      : <span className="text-xs font-normal text-muted-foreground">· ₹{new Intl.NumberFormat('en-IN').format(planMap[selectedDoctor.selectedPlanId].monthlyPrice)}/mo</span>
                    }
                  </div>
                  <div className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> 7-day free trial on approval
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{selectedDoctor.patientCount || 0}</div>
                  <div className="text-xs text-muted-foreground">Patients</div>
                </div>
                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-indigo-600">{selectedDoctor.visitCount || 0}</div>
                  <div className="text-xs text-muted-foreground">Visits</div>
                </div>
                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-emerald-600">{selectedDoctor.todayVisits || 0}</div>
                  <div className="text-xs text-muted-foreground">Today</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-white/30">
                <div>Status: {statusBadge(selectedDoctor.status)}</div>
                {selectedDoctor.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25" onClick={() => { approveMutation.mutate(selectedDoctor.id); setSelectedDoctor(null); }}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { rejectMutation.mutate(selectedDoctor.id); setSelectedDoctor(null); }}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
                {selectedDoctor.status === "rejected" && (
                  <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600" onClick={() => { approveMutation.mutate(selectedDoctor.id); setSelectedDoctor(null); }}>
                    <UserCheck className="h-4 w-4 mr-1" /> Re-Approve
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <StatDetailDialog type={detailType} onClose={() => setDetailType(null)} analyticsData={analytics} />
    </div>
  );
}
