import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient, getSessionToken } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import NewVisit from "@/pages/new-visit";
import ActiveVisit from "@/pages/active-visit";
import ActiveCare from "@/pages/active-care";
import PatientPortal from "@/pages/patient-portal";
import CalendarPage from "@/pages/calendar";
import Adherence from "@/pages/adherence";
import SearchPage from "@/pages/search";
import ReportsPage from "@/pages/reports";
import NewsFeedPage from "@/pages/news-feed";
import DrVoiceStorePage from "@/pages/dr-voice-store";
import DoctorProfile from "@/pages/doctor-profile";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AdminDashboard from "@/pages/admin-dashboard";
import PlanManagement from "@/pages/plan-management";
import DoctorSubscriptions from "@/pages/doctor-subscriptions";
import BillingManagement from "@/pages/billing-management";
import AdminRoles from "@/pages/admin-roles";
import UpgradePlan from "@/pages/upgrade-plan";
import QrCheckin from "@/pages/qr-checkin";
import { Layout } from "@/components/layout";
import { useRealtime } from "@/hooks/use-realtime";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionKey, setTransitionKey] = useState(location);

  useEffect(() => {
    setDisplayChildren(children);
    setTransitionKey(location);
  }, [location, children]);

  return (
    <div key={transitionKey} className="page-enter">
      {displayChildren}
    </div>
  );
}

function AdminRedirectHome() {
  const { isAdmin } = useAuth();
  if (isAdmin) return <Redirect to="/admin" />;
  return <Dashboard />;
}

const AppRoutes = () => (
  <Switch>
    <Route path="/" component={AdminRedirectHome} />
    <Route path="/new-visit" component={NewVisit} />
    <Route path="/visit/:id" component={ActiveVisit} />
    <Route path="/active-care" component={ActiveCare} />
    <Route path="/patient-portal" component={PatientPortal} />
    <Route path="/calendar" component={CalendarPage} />
    <Route path="/adherence" component={Adherence} />
    <Route path="/search" component={SearchPage} />
    <Route path="/reports" component={ReportsPage} />
    <Route path="/news-feed" component={NewsFeedPage} />
    <Route path="/dr-voice-store" component={DrVoiceStorePage} />
    <Route path="/profile" component={DoctorProfile} />
    <Route path="/upgrade-plan" component={UpgradePlan} />
    <Route path="/admin/doctors">{() => <AdminDashboard section="doctors" />}</Route>
    <Route path="/admin/doctor-data">{() => <AdminDashboard section="doctor-data" />}</Route>
    <Route path="/admin/plans" component={PlanManagement} />
    <Route path="/admin/subscriptions" component={DoctorSubscriptions} />
    <Route path="/admin/billing" component={BillingManagement} />
    <Route path="/admin/roles" component={AdminRoles} />
    <Route path="/admin/analytics">{() => <Redirect to="/admin" />}</Route>
    <Route path="/admin/audit-log">{() => <AdminDashboard section="audit" />}</Route>
    <Route path="/admin">{() => <AdminDashboard section="dashboard" />}</Route>
    <Route component={NotFound} />
  </Switch>
);

function AuthenticatedRouter() {
  useRealtime();
  const { isDoctor } = useAuth();
  const [location] = useLocation();

  const { data: voiceStatus, isLoading: voiceLoading, isError } = useQuery({
    queryKey: ["/api/voice-samples/status"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/voice-samples/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to check voice status");
      return res.json();
    },
    enabled: isDoctor,
    staleTime: 30 * 1000,
    retry: 2,
  });

  if (isDoctor && voiceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-muted-foreground text-sm">Checking voice registration...</p>
        </div>
      </div>
    );
  }

  if (isDoctor && !isError) {
    const voiceComplete = voiceStatus && voiceStatus.recordedQuestions >= voiceStatus.totalQuestions;
    if (!voiceComplete && location !== "/dr-voice-store") {
      return <Redirect to="/dr-voice-store" />;
    }
  }

  return (
    <Layout>
      <PageTransition>
        <AppRoutes />
      </PageTransition>
    </Layout>
  );
}

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (location.startsWith("/qr/")) {
    return <QrCheckin />;
  }

  if (!isAuthenticated) {
    if (location !== "/login" && location !== "/register" && location !== "/forgot-password" && location !== "/reset-password") {
      return <Redirect to="/login" />;
    }
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route><Redirect to="/login" /></Route>
      </Switch>
    );
  }

  if (location === "/login" || location === "/register") {
    return <Redirect to="/" />;
  }

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
