import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, Trash2, Edit, Crown, Briefcase, HeadphonesIcon, DollarSign, type LucideIcon } from "lucide-react";

interface AdminAccount {
  id: string;
  name: string;
  email: string;
  adminRole: string | null;
  role: string;
  createdAt: string;
}

interface EditingState {
  id: string;
  adminRole: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon; description: string }> = {
  super_admin: { label: "Super Admin", color: "bg-red-100 text-red-700", icon: Crown, description: "Full access to all admin features" },
  finance_admin: { label: "Finance Admin", color: "bg-green-100 text-green-700", icon: DollarSign, description: "Billing, invoices, coupons, plans" },
  operations_admin: { label: "Operations Admin", color: "bg-blue-100 text-blue-700", icon: Briefcase, description: "Doctors, subscriptions, WhatsApp" },
  support_admin: { label: "Support Admin", color: "bg-yellow-100 text-yellow-700", icon: HeadphonesIcon, description: "View-only doctor info, audit logs" },
};

function AdminRolesBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.support_admin;
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className={`${config.color} flex items-center gap-1`} data-testid={`badge-role-${role}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function AdminRoles() {
  const { isSuperAdmin } = useAdminPermissions();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<EditingState | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", adminRole: "support_admin" });

  const token = getSessionToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["/api/admin/admins"],
    queryFn: async () => {
      const res = await fetch("/api/admin/admins", { headers });
      if (!res.ok) throw new Error("Failed to fetch admins");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/admin/admins", { method: "POST", headers, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      setCreateOpen(false);
      setForm({ name: "", email: "", password: "", adminRole: "support_admin" });
      toast({ title: "Admin account created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, adminRole }: { id: string; adminRole: string }) => {
      const res = await fetch(`/api/admin/admins/${id}/role`, { method: "PUT", headers, body: JSON.stringify({ adminRole }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      setEditingAdmin(null);
      toast({ title: "Admin role updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/admins/${id}`, { method: "DELETE", headers });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: "Admin account deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!isSuperAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">Only Super Admins can manage admin roles and accounts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="admin-roles-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Admin Role Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage admin accounts and assign role-based permissions</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-admin"><UserPlus className="h-4 w-4 mr-2" /> Create Admin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Admin Account</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input data-testid="input-admin-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input data-testid="input-admin-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@carepath.ai" />
              </div>
              <div>
                <Label>Password</Label>
                <Input data-testid="input-admin-password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 6 characters" />
              </div>
              <div>
                <Label>Admin Role</Label>
                <Select value={form.adminRole} onValueChange={v => setForm(f => ({ ...f, adminRole: v }))}>
                  <SelectTrigger data-testid="select-admin-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label} — {cfg.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button data-testid="button-submit-create-admin" className="w-full" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.name || !form.email || !form.password}>
                {createMutation.isPending ? "Creating..." : "Create Admin Account"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
          const count = admins.filter((a: AdminAccount) => (a.adminRole || "super_admin") === key).length;
          const Icon = cfg.icon;
          return (
            <Card key={key} className="border" data-testid={`card-role-count-${key}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cfg.color}`}><Icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card data-testid="card-admin-list">
        <CardHeader><CardTitle>Admin Accounts ({admins.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading admin accounts...</p>
          ) : admins.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No admin accounts found</p>
          ) : (
            <div className="space-y-3">
              {admins.map((admin: AdminAccount) => (
                <div key={admin.id} className="flex items-center justify-between p-4 rounded-lg border bg-card" data-testid={`row-admin-${admin.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                      {admin.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "AD"}
                    </div>
                    <div>
                      <p className="font-medium">{admin.name}</p>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                    </div>
                    <AdminRolesBadge role={admin.adminRole || "super_admin"} />
                  </div>
                  <div className="flex items-center gap-2">
                    {editingAdmin?.id === admin.id ? (
                      <div className="flex items-center gap-2">
                        <Select value={editingAdmin.adminRole} onValueChange={v => setEditingAdmin((e: EditingState | null) => e ? ({ ...e, adminRole: v }) : null)}>
                          <SelectTrigger className="w-48" data-testid={`select-edit-role-${admin.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" data-testid={`button-save-role-${admin.id}`} onClick={() => updateRoleMutation.mutate({ id: admin.id, adminRole: editingAdmin.adminRole })} disabled={updateRoleMutation.isPending}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingAdmin(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" data-testid={`button-edit-role-${admin.id}`} onClick={() => setEditingAdmin({ id: admin.id, adminRole: admin.adminRole || "super_admin" })}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" data-testid={`button-delete-admin-${admin.id}`}
                          onClick={() => { if (confirm("Delete this admin account?")) deleteMutation.mutate(admin.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-permission-matrix">
        <CardHeader><CardTitle>Permission Matrix</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Permission</th>
                  {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                    <th key={key} className="text-center py-2 px-3 font-medium">{cfg.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "admin.stats", label: "Dashboard Stats" },
                  { key: "admin.doctors", label: "Doctor Management" },
                  { key: "admin.doctor_data", label: "Doctor-wise Data" },
                  { key: "admin.subscription_plans", label: "Subscription Plans" },
                  { key: "admin.doctor_subscriptions", label: "Doctor Subscriptions" },
                  { key: "admin.billing", label: "Billing & Invoices" },
                  { key: "admin.coupons", label: "Coupon Management" },
                  { key: "admin.whatsapp", label: "WhatsApp Status" },
                  { key: "admin.audit_logs", label: "Audit Logs" },
                  { key: "admin.roles", label: "Admin Roles" },
                ].map(perm => (
                  <tr key={perm.key} className="border-b">
                    <td className="py-2 px-3">{perm.label}</td>
                    {Object.keys(ROLE_CONFIG).map(role => {
                      const perms = role === "super_admin" ? ["*"] : ({
                        finance_admin: ["admin.stats", "admin.billing", "admin.invoices", "admin.coupons", "admin.subscription_plans", "admin.doctor_subscriptions", "admin.ai_usage", "admin.audit_logs"],
                        operations_admin: ["admin.stats", "admin.doctors", "admin.doctor_data", "admin.doctor_patients", "admin.doctor_subscriptions", "admin.subscription_plans", "admin.whatsapp", "admin.audit_logs"],
                        support_admin: ["admin.stats", "admin.doctors.view", "admin.doctor_data", "admin.audit_logs"],
                      }[role] || []);
                      const hasAccess = perms.includes("*") || perms.includes(perm.key) || perms.some(p => perm.key.startsWith(p));
                      return (
                        <td key={role} className="text-center py-2 px-3">
                          {hasAccess ? <span className="text-green-600 font-bold">✓</span> : <span className="text-gray-300">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
