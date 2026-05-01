import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  PlusCircle, 
  Activity, 
  Users,
  Calendar,
  Stethoscope,
  Pill,
  Search,
  Menu,
  X,
  Shield,
  LogOut,
  UserCheck,
  Database,
  ScrollText,
  FileBarChart,
  Newspaper,
  AudioWaveform,
  CreditCard,
  Receipt,
  Crown,
  ArrowUpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' && window.innerWidth >= 768);
  const { user, isAdmin, logout } = useAuth();
  const { canAccessRoute, isSuperAdmin, adminRoleLabel } = useAdminPermissions();

  const { data: pendingUpgradeCount = 0 } = useQuery({
    queryKey: ["/api/admin/upgrade-requests"],
    queryFn: async () => {
      const token = sessionStorage.getItem("session_token");
      const res = await fetch("/api/admin/upgrade-requests", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 30000,
    select: (data: any[]) => Array.isArray(data) ? data.filter((r: any) => r.status === "pending").length : 0,
  });

  const doctorNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: PlusCircle, label: "Patient Visit", href: "/new-visit" },
    { icon: Activity, label: "Active Care", href: "/active-care" },
    { icon: Calendar, label: "Calendar", href: "/calendar" },
    { icon: Pill, label: "Adherence", href: "/adherence" },
    { icon: Users, label: "Patient Portal", href: "/patient-portal" },
    { icon: FileBarChart, label: "Reports", href: "/reports" },
    { icon: Newspaper, label: "News Feed", href: "/news-feed" },
    { icon: AudioWaveform, label: "Dr Voice Store", href: "/dr-voice-store" },
    { icon: Search, label: "Search", href: "/search" },
    { icon: Crown, label: "Upgrade Plan", href: "/upgrade-plan" },
  ];

  const adminNavItems = [
    { icon: Shield, label: "Admin Dashboard", href: "/admin" },
    { icon: UserCheck, label: "Doctor Management", href: "/admin/doctors" },
    { icon: Database, label: "Doctor-wise Data", href: "/admin/doctor-data" },
    { icon: CreditCard, label: "Subscription Plans", href: "/admin/plans" },
    { icon: Users, label: "Doctor Subscriptions", href: "/admin/subscriptions" },
    { icon: Receipt, label: "Billing & Invoices", href: "/admin/billing" },
    { icon: ScrollText, label: "Audit Log", href: "/admin/audit-log" },
    { icon: Shield, label: "Admin Roles", href: "/admin/roles" },
  ];

  const filteredAdminNavItems = isAdmin
    ? adminNavItems.filter(item => canAccessRoute(item.href))
    : [];

  const navItems = isAdmin ? filteredAdminNavItems : doctorNavItems;

  const initials = user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "DR";

  return (
    <div className="flex w-full bg-background/50 overflow-hidden" style={{ height: "100dvh" }}>
      <aside className={cn(
        "fixed left-0 top-0 z-40 glass-sidebar flex flex-col transition-all duration-300 ease-in-out",
        sidebarOpen ? "w-64" : "w-0 overflow-hidden",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )} style={{ height: "100dvh", maxHeight: "100dvh" }}>
        <div className="flex h-16 items-center px-6 border-b border-white/30 min-w-[256px]">
          {isAdmin ? (
            <>
              <Avatar className="h-9 w-9 border-2 border-blue-200 shadow-md shrink-0 mr-2.5">
                {user?.profilePhoto ? (
                  <AvatarImage src={user.profilePhoto} alt="Admin" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs font-bold">
                  <Shield className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-700 to-blue-600 bg-clip-text text-transparent whitespace-nowrap leading-tight">CarePath_Admin</span>
                <span className="text-[9px] text-muted-foreground whitespace-nowrap leading-tight">Powered by Codelyne Technologies</span>
              </div>
            </>
          ) : (
            <>
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mr-2.5 shadow-md shadow-blue-500/20 shrink-0">
                <Stethoscope className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-blue-600 bg-clip-text text-transparent whitespace-nowrap leading-tight">{user?.name || "Doctor"}</span>
                <span className="text-[9px] text-muted-foreground whitespace-nowrap leading-tight">Powered by Codelyne Technologies</span>
              </div>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
            data-testid="button-close-sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 py-6 px-3 space-y-1 min-w-[256px] overflow-y-auto overscroll-contain">
          {isAdmin && (
            <>
              <div className="px-3 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Admin</span>
              </div>
              {navItems.filter(item => item.href.startsWith("/admin")).map((item) => (
                <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`} className={cn(
                    "sidebar-nav-item",
                    location === item.href && "active"
                  )}
                  onClick={() => { if (window.innerWidth < 768) setSidebarOpen(false); }}
                >
                    <item.icon className="sidebar-icon" />
                    <span className="sidebar-label">{item.label}</span>
                    {item.href === "/admin" && pendingUpgradeCount > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-bold animate-pulse" data-testid="badge-pending-upgrades">
                        {pendingUpgradeCount}
                      </span>
                    )}
                </Link>
              ))}
            </>
          )}
          {navItems.filter(item => !item.href.startsWith("/admin")).map((item) => (
            <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`} className={cn(
                "sidebar-nav-item",
                location === item.href && "active"
              )}
              onClick={() => { if (window.innerWidth < 768) setSidebarOpen(false); }}
            >
                <item.icon className="sidebar-icon" />
                <span className="sidebar-label">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="shrink-0 p-4 border-t border-white/30 min-w-[256px] bg-white/40 backdrop-blur-sm">
          <Link
            href="/profile"
            className="sidebar-profile-card flex items-center gap-3 mb-3 px-2 py-2 rounded-lg cursor-pointer group"
            onClick={() => { if (window.innerWidth < 768) setSidebarOpen(false); }}
            data-testid="link-doctor-profile"
          >
            <Avatar className="profile-avatar h-9 w-9 border-2 border-white/60 shadow-sm shrink-0">
              {user?.profilePhoto ? (
                <AvatarImage src={user.profilePhoto} alt={user.name} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 text-blue-700 text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-foreground truncate group-hover:text-blue-700 transition-colors" data-testid="text-user-name">{user?.name || "Doctor"}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.specialization || (isAdmin ? "Administrator" : "Doctor")}</span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="sidebar-logout w-full justify-start gap-2 text-muted-foreground hover:text-red-600 hover:bg-red-50"
            onClick={() => logout.mutate()}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out ml-0",
        sidebarOpen ? "md:ml-64" : "md:ml-0"
      )}>
        <header className={cn(
          "flex h-14 items-center border-b glass-sidebar px-4 shrink-0 z-20",
          sidebarOpen ? "md:hidden" : ""
        )}>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 mr-3"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-open-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mr-2 shadow-sm">
            <Stethoscope className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold bg-gradient-to-r from-blue-700 to-blue-600 bg-clip-text text-transparent leading-tight">{user?.name || "Doctor"}</span>
            <span className="text-[8px] text-muted-foreground leading-tight">Powered by Codelyne Technologies</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden glass-bg">
          <div className="glass-orb glass-orb-1" />
          <div className="glass-orb glass-orb-2" />
          <div className="glass-orb glass-orb-3" />
          <div className="glass-orb glass-orb-4" />
          <div className="glass-orb glass-orb-5" />
          <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto w-full min-h-full">
            {isAdmin && pendingUpgradeCount > 0 && location.startsWith("/admin") && (
              <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 mb-6 animate-fade-up" data-testid="banner-pending-upgrades-global">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/25 shrink-0">
                  <ArrowUpCircle className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-violet-800 flex-1">
                  You have <strong>{pendingUpgradeCount}</strong> pending upgrade {pendingUpgradeCount === 1 ? "request" : "requests"} awaiting review
                </span>
                {location !== "/admin" && (
                  <Link href="/admin">
                    <Button size="sm" variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-100" data-testid="button-review-upgrades-global">
                      Review
                    </Button>
                  </Link>
                )}
              </div>
            )}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
