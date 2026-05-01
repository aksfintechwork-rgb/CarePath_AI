import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users, CreditCard, Cpu, Clock, AlertTriangle,
  ArrowLeft, Search, Filter, ChevronDown, Loader2,
  Zap, BarChart3, TrendingUp, DollarSign, MoreVertical, PauseCircle, XCircle, PlayCircle
} from "lucide-react";

function ActionDropdown({ subscription, doctorName, onAction }: { subscription: any; doctorName: string; onAction: (id: number, status: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items: { label: string; icon: any; color: string; status: string; confirm?: string }[] = [];

  if (subscription.status === "active") {
    items.push({ label: "Suspend", icon: PauseCircle, color: "text-amber-600", status: "suspended" });
  }
  if (subscription.status === "suspended") {
    items.push({ label: "Activate", icon: PlayCircle, color: "text-emerald-600", status: "active" });
  }
  if (subscription.status !== "cancelled") {
    items.push({ label: "Cancel", icon: XCircle, color: "text-red-500", status: "cancelled", confirm: `Cancel subscription for ${doctorName}?` });
  }

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setOpen(!open)} data-testid={`button-actions-${subscription.id}`}>
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-white rounded-lg border shadow-lg py-1 animate-in fade-in-0 zoom-in-95">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.status}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${item.color}`}
                onClick={() => {
                  if (item.confirm && !confirm(item.confirm)) return;
                  onAction(subscription.id, item.status);
                  setOpen(false);
                }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ViewMode = "subscriptions" | "usage";

const authHeaders = () => {
  const token = getSessionToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

function SubStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 border border-gray-200">No Plan</span>;
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    trial: "bg-blue-100 text-blue-700 border-blue-200",
    expired: "bg-red-100 text-red-700 border-red-200",
    cancelled: "bg-gray-100 text-gray-600 border-gray-200",
    suspended: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span data-testid={`badge-sub-status-${status}`} className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status] || colors.trial}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  if (limit === 0) return <span className="text-xs text-muted-foreground">N/A</span>;
  const pct = Math.min(100, (used / limit) * 100);
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{Math.round(used)} / {limit >= 99999 ? "∞" : limit} min</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DoctorSubscriptions() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>("subscriptions");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [assignDialog, setAssignDialog] = useState<any>(null);
  const [usagePeriod, setUsagePeriod] = useState("month");
  const [selectedDoctorUsage, setSelectedDoctorUsage] = useState<string | null>(null);

  const { data: doctorSubs = [], isLoading } = useQuery({
    queryKey: ["/api/admin/doctor-subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/doctor-subscriptions", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["/api/admin/subscription-plans"],
    queryFn: async () => {
      const res = await fetch("/api/admin/subscription-plans", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: usageData } = useQuery({
    queryKey: ["/api/admin/ai-usage", usagePeriod, selectedDoctorUsage],
    queryFn: async () => {
      const params = new URLSearchParams({ period: usagePeriod });
      if (selectedDoctorUsage) params.set("doctorId", selectedDoctorUsage);
      const res = await fetch(`/api/admin/ai-usage?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: view === "usage",
  });

  const assignPlan = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/doctor-subscriptions", { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctor-subscriptions"] });
      toast({ title: "Subscription assigned successfully" });
      setAssignDialog(null);
    },
    onError: () => toast({ title: "Failed to assign subscription", variant: "destructive" }),
  });

  const updateSub = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/admin/doctor-subscriptions/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctor-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/details"] });
      toast({ title: "Subscription updated" });
    },
    onError: () => toast({ title: "Failed to update subscription", variant: "destructive" }),
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ["/api/admin/coupons"],
    queryFn: async () => {
      const res = await fetch("/api/admin/coupons", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const activeCoupons = coupons.filter((c: any) => c.isActive);

  const activePlans = plans.filter((p: any) => p.status === "active");

  const uniquePlanNames = [...new Set(doctorSubs.map((d: any) => d.plan?.name).filter(Boolean))] as string[];
  const uniqueCountries = [...new Set(doctorSubs.map((d: any) => d.doctor.country).filter(Boolean))] as string[];

  const filtered = doctorSubs.filter((d: any) => {
    if (statusFilter !== "all") {
      const subStatus = d.subscription?.status || "none";
      if (statusFilter === "none" && subStatus !== "none" && d.subscription) return false;
      if (statusFilter !== "none" && subStatus !== statusFilter) return false;
    }
    if (planFilter !== "all") {
      const pName = d.plan?.name || "";
      if (planFilter === "none" && pName) return false;
      if (planFilter !== "none" && pName !== planFilter) return false;
    }
    if (countryFilter !== "all") {
      const country = d.doctor.country || "";
      if (countryFilter === "none" && country) return false;
      if (countryFilter !== "none" && country !== countryFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return d.doctor.name.toLowerCase().includes(q) || d.doctor.email.toLowerCase().includes(q);
    }
    return true;
  });

  const subStatusCounts = {
    all: doctorSubs.length,
    active: doctorSubs.filter((d: any) => d.subscription?.status === "active").length,
    trial: doctorSubs.filter((d: any) => d.subscription?.status === "trial").length,
    none: doctorSubs.filter((d: any) => !d.subscription).length,
    expired: doctorSubs.filter((d: any) => d.subscription?.status === "expired").length,
    suspended: doctorSubs.filter((d: any) => d.subscription?.status === "suspended").length,
    cancelled: doctorSubs.filter((d: any) => d.subscription?.status === "cancelled").length,
  };

  if (view === "usage") return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => { setView("subscriptions"); setSelectedDoctorUsage(null); }} data-testid="button-back-to-subs">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold">AI Usage Tracking</h1>
      </div>

      <div className="flex items-center gap-3">
        {["today", "week", "month"].map(p => (
          <button key={p} data-testid={`filter-period-${p}`} onClick={() => setUsagePeriod(p)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${usagePeriod === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        {selectedDoctorUsage && (
          <Button variant="outline" size="sm" onClick={() => setSelectedDoctorUsage(null)}>
            Clear Doctor Filter
          </Button>
        )}
      </div>

      {selectedDoctorUsage && usageData?.summary ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Minutes Used", value: usageData.summary.totalMinutes, icon: Clock, color: "text-blue-500" },
              { label: "Transcriptions", value: usageData.summary.transcriptionCount, icon: Zap, color: "text-purple-500" },
              { label: "Minutes Limit", value: usageData.summary.minutesLimit >= 99999 ? "∞" : usageData.summary.minutesLimit, icon: BarChart3, color: "text-emerald-500" },
              { label: "Extra Minutes", value: usageData.summary.extraMinutes, icon: AlertTriangle, color: "text-amber-500" },
              { label: "Extra Cost", value: `₹${usageData.summary.extraCost}`, icon: DollarSign, color: "text-red-500" },
            ].map((stat, i) => (
              <div key={i} className="bg-card rounded-xl border p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[450px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 text-sm font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">Minutes</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">Visit ID</th>
                </tr>
              </thead>
              <tbody>
                {(usageData?.logs || []).map((log: any) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 text-sm">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                        {log.usageType?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm font-medium">{log.minutesUsed}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono">{log.visitId?.substring(0, 8) || "—"}</td>
                  </tr>
                ))}
                {(!usageData?.logs || usageData.logs.length === 0) && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No usage logs for this period</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-medium">Doctor</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Minutes Used</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Limit</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Extra</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Extra Cost</th>
                <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(usageData?.doctors || []).map((d: any) => (
                <tr key={d.doctorId} data-testid={`row-usage-${d.doctorId}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{d.doctorName}</td>
                  <td className="px-4 py-3 text-sm">{d.planName}</td>
                  <td className="px-4 py-3 text-sm font-medium">{d.totalMinutes}</td>
                  <td className="px-4 py-3 text-sm">{d.minutesLimit >= 99999 ? "∞" : d.minutesLimit}</td>
                  <td className="px-4 py-3 text-sm">
                    {d.extraMinutes > 0 ? (
                      <span className="text-amber-600 font-medium">{d.extraMinutes} min</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {d.extraCost > 0 ? (
                      <span className="text-red-600 font-medium">₹{d.extraCost}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDoctorUsage(d.doctorId)} data-testid={`button-view-usage-${d.doctorId}`}>
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
              {(!usageData?.doctors || usageData.doctors.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No AI usage data for this period</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <PageHeader
        title="Doctor Subscriptions"
        subtitle="Manage doctor plans and track AI usage"
        icon={Users}
        iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
        testId="text-doctor-subscriptions-title"
        actions={
          <Button variant="outline" size="sm" onClick={() => setView("usage")} data-testid="button-ai-usage">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            AI Usage
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search-doctors"
              className="pl-9"
              placeholder="Search doctors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select data-testid="filter-plan" className="h-9 px-2 text-xs rounded-md border bg-background flex-1 sm:flex-none"
              value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="all">All Plans</option>
              <option value="none">No Plan</option>
              {uniquePlanNames.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select data-testid="filter-country" className="h-9 px-2 text-xs rounded-md border bg-background flex-1 sm:flex-none"
              value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
              <option value="all">All Countries</option>
              <option value="none">No Country</option>
              {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1 -mx-1 px-1">
          {(["all", "active", "trial", "none", "expired", "suspended", "cancelled"] as const).map(s => (
            <button key={s} data-testid={`filter-sub-${s}`} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({(subStatusCounts as any)[s] || 0})
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="hidden lg:block bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 text-sm font-medium">Doctor</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Plan</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">AI Usage</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Extra Cost</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Next Billing</th>
                    <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d: any) => (
                    <tr key={d.doctor.id} data-testid={`row-doctor-sub-${d.doctor.id}`} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-sm">{d.doctor.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{d.doctor.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{d.plan?.name || "—"}</td>
                      <td className="px-4 py-3"><SubStatusBadge status={d.subscription?.status || null} /></td>
                      <td className="px-4 py-3 w-44">
                        <UsageBar used={d.usage.minutesUsed} limit={d.usage.minutesLimit} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {d.usage.extraCost > 0 ? (
                          <span className="text-red-600 font-medium">₹{d.usage.extraCost}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {d.subscription?.nextBillingDate ? new Date(d.subscription.nextBillingDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!d.subscription || d.subscription.status === "cancelled" || d.subscription.status === "expired" ? (
                            <Button size="sm" variant="outline" onClick={() => setAssignDialog(d.doctor)} data-testid={`button-assign-${d.doctor.id}`}>
                              <CreditCard className="h-3.5 w-3.5 mr-1" />
                              Assign
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setAssignDialog(d.doctor)} data-testid={`button-change-${d.doctor.id}`}>
                                Change
                              </Button>
                              <ActionDropdown
                                subscription={d.subscription}
                                doctorName={d.doctor.name}
                                onAction={(id, status) => updateSub.mutate({ id, data: { status } })}
                              />
                            </>
                          )}
                          <Button size="sm" variant="ghost"
                            onClick={() => { setSelectedDoctorUsage(d.doctor.id); setView("usage"); }}
                            data-testid={`button-usage-${d.doctor.id}`}>
                            <BarChart3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No doctors found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:hidden space-y-3">
            {filtered.map((d: any) => (
              <div key={d.doctor.id} data-testid={`card-doctor-sub-${d.doctor.id}`} className="bg-card rounded-xl border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{d.doctor.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.doctor.email}</p>
                  </div>
                  <SubStatusBadge status={d.subscription?.status || null} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Plan</p>
                    <p className="text-sm font-medium">{d.plan?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Next Billing</p>
                    <p className="text-sm">{d.subscription?.nextBillingDate ? new Date(d.subscription.nextBillingDate).toLocaleDateString() : "—"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">AI Usage (this month)</p>
                  <UsageBar used={d.usage.minutesUsed} limit={d.usage.minutesLimit} />
                </div>

                {d.usage.extraCost > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-sm text-red-600 font-medium">Extra Cost: ₹{d.usage.extraCost}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t">
                  {!d.subscription || d.subscription.status === "cancelled" || d.subscription.status === "expired" ? (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setAssignDialog(d.doctor)} data-testid={`button-assign-m-${d.doctor.id}`}>
                      <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                      Assign Plan
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setAssignDialog(d.doctor)} data-testid={`button-change-m-${d.doctor.id}`}>
                        Change
                      </Button>
                      <ActionDropdown
                        subscription={d.subscription}
                        doctorName={d.doctor.name}
                        onAction={(id, status) => updateSub.mutate({ id, data: { status } })}
                      />
                    </>
                  )}
                  <Button size="sm" variant="ghost"
                    onClick={() => { setSelectedDoctorUsage(d.doctor.id); setView("usage"); }}
                    data-testid={`button-usage-m-${d.doctor.id}`}>
                    <BarChart3 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground">No doctors found</div>
            )}
          </div>
        </>
      )}

      {assignDialog && (
        <AssignPlanDialog
          doctor={assignDialog}
          plans={activePlans}
          coupons={activeCoupons}
          onAssign={(data: any) => assignPlan.mutate(data)}
          onClose={() => setAssignDialog(null)}
          isLoading={assignPlan.isPending}
        />
      )}
    </div>
  );
}

function AssignPlanDialog({ doctor, plans, coupons, onAssign, onClose, isLoading }: any) {
  const [planId, setPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [status, setStatus] = useState("active");
  const [couponId, setCouponId] = useState("");

  const selectedPlan = plans.find((p: any) => p.id === planId);
  const applicableCoupons = (coupons || []).filter((c: any) =>
    !c.applicablePlanIds || c.applicablePlanIds.length === 0 || (planId && c.applicablePlanIds.includes(planId))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Assign Plan to {doctor.name}</h2>
        <p className="text-sm text-muted-foreground">{doctor.email}</p>

        <div>
          <Label>Plan</Label>
          <select data-testid="select-assign-plan" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={planId} onChange={(e) => { setPlanId(e.target.value); setCouponId(""); }}>
            <option value="">Select a plan...</option>
            {plans.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} — ₹{p.monthlyPrice}/mo</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Billing Cycle</Label>
          <select data-testid="select-billing-cycle" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>

        <div>
          <Label>Initial Status</Label>
          <select data-testid="select-initial-status" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
          </select>
        </div>

        <div>
          <Label>Coupon (optional)</Label>
          <select data-testid="select-coupon" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={couponId} onChange={(e) => setCouponId(e.target.value)}>
            <option value="">No coupon</option>
            {applicableCoupons.map((c: any) => (
              <option key={c.id} value={c.id}>{c.code} — {c.discountType === "percentage" ? `${c.discountValue}%` : `₹${c.discountValue}`} off</option>
            ))}
          </select>
        </div>

        {selectedPlan && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <p><strong>{selectedPlan.name}</strong></p>
            <p className="text-muted-foreground">{billingCycle === "monthly" ? `₹${selectedPlan.monthlyPrice}/month` : `₹${selectedPlan.annualPrice}/year`}</p>
            <p className="text-muted-foreground">{selectedPlan.aiMinutesPerMonth >= 99999 ? "Unlimited" : selectedPlan.aiMinutesPerMonth} AI min/month</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-assign">Cancel</Button>
          <Button onClick={() => onAssign({ doctorId: doctor.id, planId, billingCycle, status, ...(couponId ? { couponId } : {}) })} disabled={!planId || isLoading} data-testid="button-confirm-assign">
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Assign Plan
          </Button>
        </div>
      </div>
    </div>
  );
}
