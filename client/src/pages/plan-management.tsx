import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CreditCard, Plus, Edit, Copy, Trash2, Power, PowerOff,
  ChevronLeft, Globe, DollarSign, Users, Cpu, Languages,
  FileText, Calendar, Shield, Activity, HeartPulse, Headphones,
  Building2, Sparkles, ArrowLeft, Save, Loader2, Package,
  MapPin, Percent
} from "lucide-react";

type ViewMode = "list" | "edit" | "regions";

const authHeaders = () => {
  const token = getSessionToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    inactive: "bg-gray-100 text-gray-600 border-gray-200",
    draft: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span data-testid={`badge-status-${status}`} className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${colors[status] || colors.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function PlanManagement() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>("list");
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["/api/admin/subscription-plans"],
    queryFn: async () => {
      const res = await fetch("/api/admin/subscription-plans", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
  });

  const { data: regions = [] } = useQuery({
    queryKey: ["/api/admin/regional-pricing"],
    queryFn: async () => {
      const res = await fetch("/api/admin/regional-pricing", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch regions");
      return res.json();
    },
  });

  const savePlan = useMutation({
    mutationFn: async (plan: any) => {
      const url = plan.id
        ? `/api/admin/subscription-plans/${plan.id}`
        : "/api/admin/subscription-plans";
      const method = plan.id ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(plan) });
      if (!res.ok) throw new Error("Failed to save plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      toast({ title: "Plan saved successfully" });
      setView("list");
      setEditingPlan(null);
    },
    onError: () => toast({ title: "Failed to save plan", variant: "destructive" }),
  });

  const clonePlan = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/subscription-plans/${id}/clone`, { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to clone");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      toast({ title: "Plan cloned successfully" });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await fetch(`/api/admin/subscription-plans/${id}/${action}`, { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      toast({ title: "Plan status updated" });
    },
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/subscription-plans/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      toast({ title: "Plan deleted" });
    },
  });

  const seedPlans = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/seed-plans", { method: "POST", headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/regional-pricing"] });
      toast({ title: data.message || "Plans seeded successfully" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const saveRegion = useMutation({
    mutationFn: async (region: any) => {
      const url = region.id
        ? `/api/admin/regional-pricing/${region.id}`
        : "/api/admin/regional-pricing";
      const method = region.id ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(region) });
      if (!res.ok) throw new Error("Failed to save region");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/regional-pricing"] });
      toast({ title: "Region saved" });
    },
  });

  const deleteRegion = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/regional-pricing/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/regional-pricing"] });
      toast({ title: "Region deleted" });
    },
  });

  const filteredPlans = statusFilter === "all" ? plans : plans.filter((p: any) => p.status === statusFilter);

  if (view === "edit") return (
    <PlanEditor
      plan={editingPlan}
      onSave={(plan: any) => savePlan.mutate(plan)}
      onCancel={() => { setView("list"); setEditingPlan(null); }}
      isSaving={savePlan.isPending}
    />
  );

  if (view === "regions") return (
    <RegionalPricingView
      regions={regions}
      plans={plans}
      onSave={(r: any) => saveRegion.mutate(r)}
      onDelete={(id: string) => deleteRegion.mutate(id)}
      onBack={() => setView("list")}
    />
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Subscription Plans"
        subtitle="Manage pricing plans and regional settings"
        icon={CreditCard}
        iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
        testId="text-plan-management-title"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView("regions")}
              data-testid="button-regional-pricing"
            >
              <Globe className="h-4 w-4 mr-1.5" />
              Regional Pricing
            </Button>
            <Button
              size="sm"
              onClick={() => { setEditingPlan(null); setView("edit"); }}
              data-testid="button-create-plan"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Plan
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-3">
        {["all", "active", "inactive", "draft"].map((s) => (
          <button
            key={s}
            data-testid={`filter-${s}`}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} {s === "all" ? `(${plans.length})` : `(${plans.filter((p: any) => p.status === s).length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/40" />
          <h3 className="text-lg font-medium text-muted-foreground">No subscription plans yet</h3>
          <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
            Create your first plan or seed the default plans to get started.
          </p>
          <Button onClick={() => seedPlans.mutate()} disabled={seedPlans.isPending} data-testid="button-seed-plans">
            {seedPlans.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Seed Default Plans
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredPlans.map((plan: any) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={() => { setEditingPlan(plan); setView("edit"); }}
              onClone={() => clonePlan.mutate(plan.id)}
              onToggle={() => toggleStatus.mutate({ id: plan.id, action: plan.status === "active" ? "deactivate" : "activate" })}
              onDelete={() => {
                if (confirm(`Delete plan "${plan.name}"?`)) deletePlan.mutate(plan.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, onEdit, onClone, onToggle, onDelete }: any) {
  return (
    <div data-testid={`card-plan-${plan.id}`} className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{plan.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{plan.targetUser?.replace("_", " ")}</p>
        </div>
        <StatusBadge status={plan.status} />
      </div>

      <div className="space-y-1">
        {plan.isEnterprise ? (
          <p className="text-2xl font-bold">Custom</p>
        ) : (
          <>
            <p className="text-2xl font-bold">₹{plan.monthlyPrice}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            <p className="text-xs text-muted-foreground">₹{plan.annualPrice}/year (save {plan.monthlyPrice > 0 ? Math.round((1 - plan.annualPrice / (plan.monthlyPrice * 12)) * 100) : 0}%)</p>
          </>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{plan.doctorsIncluded} doctor{plan.doctorsIncluded > 1 ? "s" : ""} (max {plan.maxDoctors})</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Cpu className="h-3.5 w-3.5" />
          <span>{plan.aiMinutesPerMonth >= 99999 ? "Unlimited" : plan.aiMinutesPerMonth} AI min/mo</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Languages className="h-3.5 w-3.5" />
          <span>{plan.languagesSupported} languages</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Headphones className="h-3.5 w-3.5" />
          <span>{plan.supportLevel} support</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {plan.prescriptionChannels?.split(",").map((ch: string) => (
          <span key={ch} className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded-full border border-blue-100">
            {ch.trim()}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1.5 pt-2 border-t">
        <Button size="sm" variant="ghost" onClick={onEdit} data-testid={`button-edit-${plan.id}`}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onClone} data-testid={`button-clone-${plan.id}`}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onToggle} data-testid={`button-toggle-${plan.id}`}>
          {plan.status === "active" ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
        </Button>
        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={onDelete} data-testid={`button-delete-${plan.id}`}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function PlanEditor({ plan, onSave, onCancel, isSaving }: any) {
  const isNew = !plan;
  const [form, setForm] = useState(plan || {
    name: "",
    planType: "global",
    monthlyPrice: 0,
    annualPrice: 0,
    currency: "INR",
    status: "draft",
    doctorsIncluded: 1,
    maxDoctors: 1,
    aiMinutesPerMonth: 300,
    extraMinuteCost: 0.10,
    languagesSupported: 5,
    customLanguageSupport: false,
    aiCarePlanLevel: "basic",
    prescriptionChannels: "email",
    calendarFeatures: "basic",
    reportsLevel: "monthly",
    identityVerification: "none",
    adherenceTracking: "disabled",
    supportLevel: "email",
    targetUser: "solo_doctor",
    isEnterprise: false,
    whiteLabel: false,
    customIntegrations: false,
    sortOrder: 0,
  });

  const update = (field: string, value: any) => setForm((f: any) => ({ ...f, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-back-to-list">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">{isNew ? "Create New Plan" : `Edit: ${plan.name}`}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="bg-card rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Plan Name</Label>
              <Input data-testid="input-plan-name" value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div>
              <Label>Plan Type</Label>
              <select data-testid="select-plan-type" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.planType} onChange={(e) => update("planType", e.target.value)}>
                <option value="global">Global</option>
                <option value="regional">Regional</option>
                <option value="custom">Custom / Enterprise</option>
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select data-testid="select-status" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.status} onChange={(e) => update("status", e.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <Label>Target User</Label>
              <select data-testid="select-target-user" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.targetUser} onChange={(e) => update("targetUser", e.target.value)}>
                <option value="solo_doctor">Solo Doctor</option>
                <option value="clinic">Clinic</option>
                <option value="hospital">Hospital / Enterprise</option>
              </select>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input data-testid="input-sort-order" type="number" value={form.sortOrder} onChange={(e) => update("sortOrder", parseInt(e.target.value) || 0)} />
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Monthly Price (₹)</Label>
              <Input data-testid="input-monthly-price" type="number" step="0.01" value={form.monthlyPrice} onChange={(e) => update("monthlyPrice", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Annual Price (₹)</Label>
              <Input data-testid="input-annual-price" type="number" step="0.01" value={form.annualPrice} onChange={(e) => update("annualPrice", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Currency</Label>
              <select data-testid="select-currency" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.currency} onChange={(e) => update("currency", e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch data-testid="switch-enterprise" checked={form.isEnterprise} onCheckedChange={(v) => update("isEnterprise", v)} />
            <Label>Enterprise (custom pricing - contact sales)</Label>
          </div>
        </section>

        <section className="bg-card rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Doctor Limits
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Doctors Included</Label>
              <Input data-testid="input-doctors-included" type="number" value={form.doctorsIncluded} onChange={(e) => update("doctorsIncluded", parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Max Doctors</Label>
              <Input data-testid="input-max-doctors" type="number" value={form.maxDoctors} onChange={(e) => update("maxDoctors", parseInt(e.target.value) || 1)} />
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Cpu className="h-5 w-5 text-purple-500" />
            AI Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>AI Minutes / Month</Label>
              <Input data-testid="input-ai-minutes" type="number" value={form.aiMinutesPerMonth} onChange={(e) => update("aiMinutesPerMonth", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Extra Minute Cost (₹)</Label>
              <Input data-testid="input-extra-minute-cost" type="number" step="0.01" value={form.extraMinuteCost} onChange={(e) => update("extraMinuteCost", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>AI Care Plan Level</Label>
              <select data-testid="select-care-plan-level" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.aiCarePlanLevel} onChange={(e) => update("aiCarePlanLevel", e.target.value)}>
                <option value="basic">Basic</option>
                <option value="advanced">Advanced</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Languages className="h-5 w-5 text-cyan-500" />
            Language Support
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Languages Supported</Label>
              <Input data-testid="input-languages" type="number" value={form.languagesSupported} onChange={(e) => update("languagesSupported", parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Switch data-testid="switch-custom-language" checked={form.customLanguageSupport} onCheckedChange={(v) => update("customLanguageSupport", v)} />
              <Label>Custom Language Support</Label>
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Prescription Channels</Label>
              <Input data-testid="input-prescription-channels" value={form.prescriptionChannels} onChange={(e) => update("prescriptionChannels", e.target.value)} placeholder="email,whatsapp,pdf" />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated: email, whatsapp, pdf, api</p>
            </div>
            <div>
              <Label>Calendar Features</Label>
              <select data-testid="select-calendar" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.calendarFeatures} onChange={(e) => update("calendarFeatures", e.target.value)}>
                <option value="basic">Basic</option>
                <option value="advanced">Advanced</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <Label>Reports Level</Label>
              <select data-testid="select-reports" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.reportsLevel} onChange={(e) => update("reportsLevel", e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="realtime">Real-time</option>
              </select>
            </div>
            <div>
              <Label>Identity Verification</Label>
              <select data-testid="select-identity" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.identityVerification} onChange={(e) => update("identityVerification", e.target.value)}>
                <option value="none">None</option>
                <option value="aadhaar">Aadhaar</option>
                <option value="aadhaar_pan">Aadhaar + PAN</option>
              </select>
            </div>
            <div>
              <Label>Adherence Tracking</Label>
              <select data-testid="select-adherence" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.adherenceTracking} onChange={(e) => update("adherenceTracking", e.target.value)}>
                <option value="disabled">Disabled</option>
                <option value="basic">Basic</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <Label>Support Level</Label>
              <select data-testid="select-support" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.supportLevel} onChange={(e) => update("supportLevel", e.target.value)}>
                <option value="email">Email</option>
                <option value="priority">Priority</option>
                <option value="dedicated">Dedicated</option>
                <option value="enterprise">Enterprise (24/7)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-3 border-t">
            <div className="flex items-center gap-2">
              <Switch data-testid="switch-white-label" checked={form.whiteLabel} onCheckedChange={(v) => update("whiteLabel", v)} />
              <Label>White Label</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch data-testid="switch-custom-integrations" checked={form.customIntegrations} onCheckedChange={(v) => update("customIntegrations", v)} />
              <Label>Custom Integrations</Label>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || !form.name} data-testid="button-save-plan">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isNew ? "Create Plan" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function RegionalPricingView({ regions, plans, onSave, onDelete, onBack }: any) {
  const [editing, setEditing] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [newRegion, setNewRegion] = useState({ regionName: "", regionCode: "", multiplier: 1.0, currency: "INR", isActive: true });

  const basePlan = plans.find((p: any) => p.status === "active" && !p.isEnterprise);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-from-regions">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Plans
        </Button>
        <h1 className="text-2xl font-bold">Regional Pricing</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure pricing multipliers for different regions. Base prices from plans are multiplied by the regional factor.
      </p>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 text-sm font-medium">Region</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Code</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Multiplier</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Currency</th>
              {basePlan && <th className="text-left px-4 py-3 text-sm font-medium">Preview (₹{basePlan.monthlyPrice}/mo)</th>}
              <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((r: any) => (
              <tr key={r.id} data-testid={`row-region-${r.id}`} className="border-b last:border-0 hover:bg-muted/30">
                {editing?.id === r.id ? (
                  <>
                    <td className="px-4 py-2">
                      <Input data-testid="input-edit-region-name" className="h-8" value={editing.regionName} onChange={(e) => setEditing({ ...editing, regionName: e.target.value })} />
                    </td>
                    <td className="px-4 py-2">
                      <Input data-testid="input-edit-region-code" className="h-8 w-20" value={editing.regionCode} onChange={(e) => setEditing({ ...editing, regionCode: e.target.value })} />
                    </td>
                    <td className="px-4 py-2">
                      <Input data-testid="input-edit-multiplier" className="h-8 w-24" type="number" step="0.01" value={editing.multiplier} onChange={(e) => setEditing({ ...editing, multiplier: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="px-4 py-2">
                      <Input data-testid="input-edit-currency" className="h-8 w-20" value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} />
                    </td>
                    {basePlan && (
                      <td className="px-4 py-2 text-sm font-medium text-emerald-600">
                        ${(basePlan.monthlyPrice * (editing.multiplier || 0)).toFixed(2)}/mo
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <Switch checked={editing.isActive} onCheckedChange={(v) => setEditing({ ...editing, isActive: v })} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => { onSave(editing); setEditing(null); }}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium">{r.regionName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{r.regionCode}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium">{r.multiplier}x</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{r.currency}</td>
                    {basePlan && (
                      <td className="px-4 py-3 text-sm font-medium text-emerald-600">
                        ${(basePlan.monthlyPrice * r.multiplier).toFixed(2)}/mo
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {r.isActive ? (
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Active</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ ...r })} data-testid={`button-edit-region-${r.id}`}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm("Delete this region?")) onDelete(r.id); }} data-testid={`button-delete-region-${r.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew ? (
        <div className="bg-card rounded-xl border p-4 space-y-4">
          <h3 className="font-semibold">Add New Region</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label>Region Name</Label>
              <Input data-testid="input-new-region-name" value={newRegion.regionName} onChange={(e) => setNewRegion({ ...newRegion, regionName: e.target.value })} />
            </div>
            <div>
              <Label>Code</Label>
              <Input data-testid="input-new-region-code" value={newRegion.regionCode} onChange={(e) => setNewRegion({ ...newRegion, regionCode: e.target.value })} />
            </div>
            <div>
              <Label>Multiplier</Label>
              <Input data-testid="input-new-multiplier" type="number" step="0.01" value={newRegion.multiplier} onChange={(e) => setNewRegion({ ...newRegion, multiplier: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Currency</Label>
              <Input data-testid="input-new-currency" value={newRegion.currency} onChange={(e) => setNewRegion({ ...newRegion, currency: e.target.value })} />
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={() => { onSave(newRegion); setNewRegion({ regionName: "", regionCode: "", multiplier: 1.0, currency: "INR", isActive: true }); setShowNew(false); }} data-testid="button-save-new-region">
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowNew(true)} data-testid="button-add-region">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Region
        </Button>
      )}
    </div>
  );
}
