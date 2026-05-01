import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Crown, Calendar, Zap, ArrowUpCircle, Clock, CheckCircle, XCircle, Sparkles } from "lucide-react";
import { useState } from "react";

export default function UpgradePlanPage() {
  const { toast } = useToast();
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState("");

  const { data: planData, isLoading } = useQuery({
    queryKey: ["/api/my-plan-features"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/my-plan-features", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["/api/subscription-plans/public"],
    queryFn: async () => {
      const res = await fetch("/api/subscription-plans/public");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: myRequests } = useQuery({
    queryKey: ["/api/my-upgrade-requests"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/my-upgrade-requests", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async (requestedPlanId: string) => {
      const token = getSessionToken();
      const res = await fetch("/api/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ requestedPlanId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Request Sent!", description: data.message });
      setSelectedUpgradePlan("");
      queryClient.invalidateQueries({ queryKey: ["/api/my-upgrade-requests"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const formatPrice = (price: number) => new Intl.NumberFormat('en-IN').format(price);
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : "—";

  const hasPlan = planData && planData.planStatus !== "none";
  const pendingRequest = (myRequests || []).find((r: any) => r.status === "pending");
  const currentPrice = planData?.monthlyPrice || 0;
  const availableUpgrades = (plans || []).filter((p: any) => p.id !== planData?.planId && !p.isEnterprise && p.monthlyPrice > currentPrice);

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-emerald-500";
      case "trial": return "bg-blue-500";
      case "expired": return "bg-red-500";
      case "cancelled": return "bg-gray-500";
      default: return "bg-gray-400";
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="My Plan" subtitle="View your subscription details and upgrade" icon={Crown} />

      <div className="glass-card-strong rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" data-testid="text-current-plan-title">
          <Crown className="h-5 w-5 text-blue-600" />
          Current Plan
        </h2>

        {!hasPlan ? (
          <div className="text-center py-6">
            <div className="text-muted-foreground mb-2">No active subscription</div>
            <div className="text-sm text-muted-foreground">Contact admin to get started</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xl font-bold" data-testid="text-plan-name">{planData.planName}</span>
              <Badge className={`${statusColor(planData.planStatus)} text-white border-0`} data-testid="badge-plan-status">
                {planData.planStatus === "trial" ? "Trial" : planData.planStatus === "active" ? "Active" : planData.planStatus}
              </Badge>
              {planData.billingCycle && (
                <Badge variant="outline" className="text-xs">{planData.billingCycle === "monthly" ? "Monthly" : "Annual"}</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-card rounded-xl p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Start Date</div>
                <div className="text-sm font-medium" data-testid="text-start-date">{formatDate(planData.startDate)}</div>
              </div>
              <div className="glass-card rounded-xl p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{planData.planStatus === "trial" ? "Trial Ends" : "Renews On"}</div>
                <div className="text-sm font-medium" data-testid="text-renew-date">{formatDate(planData.expiresAt || planData.nextBillingDate)}</div>
              </div>
              <div className="glass-card rounded-xl p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" />AI Minutes</div>
                <div className="text-sm font-medium" data-testid="text-ai-minutes">{planData.aiMinutesUsed} / {planData.aiMinutesPerMonth}</div>
              </div>
              <div className="glass-card rounded-xl p-3">
                <div className="text-xs text-muted-foreground">Price</div>
                <div className="text-sm font-medium" data-testid="text-plan-price">
                  {planData.monthlyPrice ? `₹${formatPrice(planData.monthlyPrice)}/mo` : "Free"}
                </div>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div
                className="bg-gradient-to-r from-blue-500 to-violet-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (planData.aiMinutesUsed / planData.aiMinutesPerMonth) * 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {Math.max(0, planData.aiMinutesPerMonth - planData.aiMinutesUsed)} AI minutes remaining
            </div>

            {planData.trialMinutesExhausted && (
              <div className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center" data-testid="banner-trial-exhausted">
                <div className="text-red-600 font-semibold text-base mb-1">Free Demo Minutes Complete</div>
                <div className="text-sm text-red-500">Your 20 free trial AI minutes have been used. Subscribe to a plan below to continue using AI features.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {pendingRequest && (
        <div className="glass-card-strong rounded-2xl p-4 border-l-4 border-amber-500">
          <div className="flex items-center gap-2 text-amber-700">
            <Clock className="h-4 w-4" />
            <span className="font-medium text-sm">Upgrade request pending admin approval</span>
          </div>
        </div>
      )}

      <div className="glass-card-strong rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" data-testid="text-upgrade-title">
          <ArrowUpCircle className="h-5 w-5 text-violet-600" />
          Upgrade Plan
        </h2>

        {availableUpgrades.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">No upgrade plans available</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableUpgrades.map((plan: any) => (
              <div
                key={plan.id}
                className={`glass-card rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg ${
                  selectedUpgradePlan === plan.id ? "ring-2 ring-blue-500 shadow-blue-500/20" : ""
                }`}
                onClick={() => setSelectedUpgradePlan(plan.id)}
                data-testid={`card-upgrade-plan-${plan.id}`}
              >
                <div className="font-semibold text-base mb-1">{plan.name}</div>
                <div className="text-lg font-bold text-blue-600">₹{formatPrice(plan.monthlyPrice)}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                  <div>{plan.aiMinutesPerMonth} AI min/mo</div>
                  <div>{plan.maxDoctors} doctor{plan.maxDoctors > 1 ? "s" : ""}</div>
                  <div>{plan.languagesSupported} languages</div>
                </div>
                {selectedUpgradePlan === plan.id && (
                  <div className="mt-3 text-xs text-blue-600 font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Selected
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {selectedUpgradePlan && !pendingRequest && (
          <Button
            className="mt-4 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-lg"
            onClick={() => upgradeMutation.mutate(selectedUpgradePlan)}
            disabled={upgradeMutation.isPending}
            data-testid="button-request-upgrade"
          >
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            {upgradeMutation.isPending ? "Sending..." : "Request Upgrade"}
          </Button>
        )}
      </div>

      {(myRequests || []).length > 0 && (
        <div className="glass-card-strong rounded-2xl p-6">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">Recent Requests</h2>
          <div className="space-y-2">
            {(myRequests || []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm glass-card rounded-lg p-3">
                <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>
                <Badge className={`border-0 text-white ${r.status === "pending" ? "bg-amber-500" : r.status === "approved" ? "bg-emerald-500" : "bg-red-500"}`}>
                  {r.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                  {r.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                  {r.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
