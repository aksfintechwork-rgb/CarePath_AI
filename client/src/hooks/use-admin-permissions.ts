import { useAuth } from "./use-auth";

const ADMIN_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*"],
  finance_admin: [
    "admin.stats", "admin.billing", "admin.invoices", "admin.coupons",
    "admin.subscription_plans", "admin.doctor_subscriptions", "admin.ai_usage",
    "admin.audit_logs",
  ],
  operations_admin: [
    "admin.stats", "admin.doctors", "admin.doctor_data", "admin.doctor_patients",
    "admin.doctor_subscriptions", "admin.subscription_plans",
    "admin.whatsapp", "admin.audit_logs",
  ],
  support_admin: [
    "admin.stats", "admin.doctors.view",
    "admin.audit_logs",
  ],
};

const ADMIN_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  finance_admin: "Finance Admin",
  operations_admin: "Operations Admin",
  support_admin: "Support Admin",
};

export function useAdminPermissions() {
  const { user, isAdmin } = useAuth();

  const adminRole = isAdmin ? ((user?.adminRole as string) || "super_admin") : "none";
  const isSuperAdmin = isAdmin && adminRole === "super_admin";

  function hasPermission(permission: string): boolean {
    if (!isAdmin) return false;
    const perms = ADMIN_ROLE_PERMISSIONS[adminRole] || [];
    if (perms.includes("*")) return true;
    if (perms.includes(permission)) return true;
    return perms.some(p => permission.startsWith(p));
  }

  function canAccessRoute(route: string): boolean {
    if (!isAdmin) return false;
    if (isSuperAdmin) return true;
    const routePermMap: Record<string, string> = {
      "/admin": "admin.stats",
      "/admin/doctors": "admin.doctors.view",
      "/admin/doctor-data": "admin.doctor_data",
      "/admin/plans": "admin.subscription_plans",
      "/admin/subscriptions": "admin.doctor_subscriptions",
      "/admin/billing": "admin.billing",
      "/admin/audit-log": "admin.audit_logs",
      "/admin/roles": "admin.roles",
    };
    const perm = routePermMap[route];
    if (!perm) return true;
    return hasPermission(perm);
  }

  return {
    adminRole,
    adminRoleLabel: ADMIN_ROLE_LABELS[adminRole] || adminRole,
    isSuperAdmin,
    hasPermission,
    canAccessRoute,
    allRoles: Object.entries(ADMIN_ROLE_LABELS).map(([key, label]) => ({ key, label })),
  };
}
