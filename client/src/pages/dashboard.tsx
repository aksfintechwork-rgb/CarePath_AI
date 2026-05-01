import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import { AiMinutesWarning } from "@/components/upgrade-prompt";
import { 
  Users, 
  Calendar, 
  Clock, 
  MoreVertical, 
  AlertCircle,
  Activity,
  ArrowUpRight,
  Sparkles,
  HeartPulse,
  Stethoscope,
  ShieldCheck,
  Pill,
  TrendingUp,
  CalendarCheck,
  Building2,
  QrCode,
  Download,
  Copy,
  Check,
  Phone,
  Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowRight, User, Clipboard } from "lucide-react";

const ROWS_PER_PAGE = 10;

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "active":
      return (
        <Badge data-testid="badge-status-active" className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-700 border-emerald-300/50 shadow-none backdrop-blur-sm">
          <span className="relative flex h-2 w-2 mr-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Active Care
        </Badge>
      );
    case "draft":
      return <Badge data-testid="badge-status-draft" variant="outline" className="text-violet-600 border-violet-200 bg-violet-50/50 backdrop-blur-sm">Draft</Badge>;
    case "recording":
      return (
        <Badge data-testid="badge-status-recording" variant="outline" className="text-orange-600 border-orange-300/50 bg-gradient-to-r from-orange-500/10 to-amber-500/10 backdrop-blur-sm">
          <span className="relative flex h-2 w-2 mr-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          Recording
        </Badge>
      );
    case "completed":
      return <Badge data-testid="badge-status-completed" variant="secondary" className="bg-gradient-to-r from-sky-100 to-blue-100 text-sky-700 backdrop-blur-sm">Completed</Badge>;
    case "attention":
      return <Badge data-testid="badge-status-attention" variant="destructive" className="bg-gradient-to-r from-rose-500/15 to-pink-500/15 text-rose-600 border-rose-300/50 shadow-none backdrop-blur-sm animate-pulse">Follow-up Due</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const statCards = [
  {
    key: "totalToday",
    testId: "total-today",
    label: "Total Patients Today",
    sub: "patients seen",
    icon: Users,
    gradientFrom: "from-cyan-500",
    gradientTo: "to-blue-600",
    iconBg: "bg-gradient-to-br from-cyan-400 to-blue-500",
    tintClass: "stat-card-blue",
    shadowColor: "shadow-cyan-500/25",
  },
  {
    key: "activeCare",
    testId: "active-care",
    label: "Active Care Plans",
    sub: "running smoothly",
    icon: HeartPulse,
    gradientFrom: "from-emerald-400",
    gradientTo: "to-teal-600",
    iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
    tintClass: "stat-card-green",
    shadowColor: "shadow-emerald-500/25",
  },
  {
    key: "pendingApprovals",
    testId: "pending",
    label: "Pending Reviews",
    sub: "requires review",
    icon: Clock,
    gradientFrom: "from-amber-400",
    gradientTo: "to-orange-500",
    iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
    tintClass: "stat-card-amber",
    shadowColor: "shadow-amber-500/25",
  },
  {
    key: "attentionNeeded",
    testId: "attention",
    label: "Upcoming Patient",
    sub: "needs action",
    icon: AlertCircle,
    gradientFrom: "from-rose-400",
    gradientTo: "to-pink-600",
    iconBg: "bg-gradient-to-br from-rose-400 to-pink-500",
    tintClass: "stat-card-rose",
    shadowColor: "shadow-rose-500/25",
  },
];

const visitColorAccents = [
  { gradient: "from-cyan-400 to-blue-500", text: "text-cyan-700", hoverText: "group-hover:text-cyan-700", border: "border-cyan-200/50", bg: "from-cyan-500/15 to-blue-500/10" },
  { gradient: "from-violet-400 to-purple-500", text: "text-violet-700", hoverText: "group-hover:text-violet-700", border: "border-violet-200/50", bg: "from-violet-500/15 to-purple-500/10" },
  { gradient: "from-emerald-400 to-teal-500", text: "text-emerald-700", hoverText: "group-hover:text-emerald-700", border: "border-emerald-200/50", bg: "from-emerald-500/15 to-teal-500/10" },
  { gradient: "from-amber-400 to-orange-500", text: "text-amber-700", hoverText: "group-hover:text-amber-700", border: "border-amber-200/50", bg: "from-amber-500/15 to-orange-500/10" },
  { gradient: "from-rose-400 to-pink-500", text: "text-rose-700", hoverText: "group-hover:text-rose-700", border: "border-rose-200/50", bg: "from-rose-500/15 to-pink-500/10" },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [visitPage, setVisitPage] = useState(1);
  const [linkCopied, setLinkCopied] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const doctorInitials = user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "DR";
  const qrUrl = user?.id ? `${window.location.origin}/qr/${user.id}` : "";
  const qrImageUrl = user?.id ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}` : "";

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(qrUrl).then(() => {
      setLinkCopied(true);
      toast({ title: "Link copied!", description: "Share this link with your patients" });
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [qrUrl, toast]);

  const handleDownloadQr = useCallback(() => {
    const link = document.createElement("a");
    link.href = qrImageUrl;
    link.download = `carepath-qr-${user?.name?.replace(/\s+/g, '-') || 'doctor'}.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [qrImageUrl, user?.name]);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalToday: number;
    activeCare: number;
    pendingApprovals: number;
    attentionNeeded: number;
  }>({
    queryKey: ["/api/dashboard"],
    refetchInterval: 5000,
  });

  const { data: visits, isLoading: visitsLoading } = useQuery<any[]>({
    queryKey: ["/api/visits"],
    refetchInterval: 5000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<{
    medicineAdherence: number;
    followupCompletion: number;
    reducedOpdLoad: number;
    details: { totalVisits: number; approvedVisits: number; totalPatients: number };
  }>({
    queryKey: ["/api/dashboard/metrics"],
    refetchInterval: 5000,
  });

  const qc = useQueryClient();

  const { data: queueData } = useQuery<any[]>({
    queryKey: ["/api/patient-queue"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/patient-queue", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load queue");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const updateQueueStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const token = getSessionToken();
      const res = await fetch(`/api/patient-queue/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["/api/patient-queue"] });
      const previous = qc.getQueryData(["/api/patient-queue"]);
      qc.setQueryData(["/api/patient-queue"], (old: any[] | undefined) =>
        (old || []).map((e: any) => e.id === id ? { ...e, status } : e)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(["/api/patient-queue"], context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient-queue"] });
    },
  });

  const waitingQueue = (queueData || []).filter((e: any) => e.status === "waiting");

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedQueueEntryId, setSelectedQueueEntryId] = useState<string | null>(null);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [queueSidebarOpen, setQueueSidebarOpen] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState<"totalToday" | "activeCare" | "pending" | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const { data: patientDetails, isLoading: patientDetailsLoading } = useQuery<any>({
    queryKey: ["/api/patients", selectedPatientId, "details-english"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/patients/${selectedPatientId}/details-english`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedPatientId && patientDialogOpen,
  });

  const handleStartClick = (entry: any) => {
    if (!entry.patientId) return;
    setSelectedPatientId(entry.patientId);
    setSelectedQueueEntryId(entry.id);
    setConsentChecked(false);
    setPatientDialogOpen(true);
  };

  const handleStartConsultation = () => {
    if (!selectedQueueEntryId || !selectedPatientId) return;
    updateQueueStatus.mutate(
      { id: selectedQueueEntryId, status: "completed" },
      {
        onSuccess: () => {
          setPatientDialogOpen(false);
          const englishName = patientDetails?.name ? encodeURIComponent(patientDetails.name) : "";
          const englishGender = patientDetails?.gender ? encodeURIComponent(patientDetails.gender) : "";
          const age = patientDetails?.age != null ? patientDetails.age : "";
          setLocation(`/new-visit?patientId=${selectedPatientId}&autoStart=true&eName=${englishName}&eGender=${englishGender}&eAge=${age}`);
        },
        onError: () => {
          toast({ title: "Failed to update queue status", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-8">
      <AiMinutesWarning />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-up">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Avatar className="h-11 w-11 border-2 border-blue-200 shadow-md" data-testid="img-doctor-dashboard-photo">
                <AvatarImage src={user?.profilePhoto || ""} alt={user?.name || "Doctor"} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold text-sm">{doctorInitials}</AvatarFallback>
              </Avatar>
              <h1 className="text-3xl font-bold tracking-tight gradient-text-health" data-testid="text-dashboard-title">
                Doctor Dashboard
              </h1>
              <HeartPulse className="h-6 w-6 text-rose-500 animate-heartbeat" />
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
              Overview of today's patients and care plans
              <span className="text-xs text-blue-500 font-medium">Powered by Codelyne Technologies</span>
            </p>
          </div>
          <Button
            data-testid="button-new-visit"
            onClick={() => setLocation("/new-visit")}
            className="bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:from-cyan-600 hover:via-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-1 hover:scale-105 animate-gradient"
          >
            <Stethoscope className="mr-2 h-4 w-4" />
            New Patient Visit
            <ArrowUpRight className="ml-1 h-3.5 w-3.5 opacity-70" />
          </Button>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            const value = stats?.[card.key as keyof typeof stats] ?? 0;
            const sidebarMap: Record<string, "totalToday" | "activeCare" | "pending"> = {
              totalToday: "totalToday",
              activeCare: "activeCare",
              pendingApprovals: "pending",
            };
            return (
              <div
                key={card.key}
                data-testid={`card-stat-${card.testId}`}
                onClick={() => {
                  if (card.key === "attentionNeeded") {
                    setQueueSidebarOpen(true);
                  } else if (sidebarMap[card.key]) {
                    setActiveSidebar(sidebarMap[card.key]);
                  }
                }}
                className={`glass-card ${card.tintClass} rounded-2xl p-5 animate-fade-up overflow-hidden group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
                style={{ animationDelay: `${(index + 1) * 0.1}s`, opacity: 0 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>{card.label}</span>
                  <div className={`icon-container h-11 w-11 rounded-xl ${card.iconBg} flex items-center justify-center shadow-lg ${card.shadowColor} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                {statsLoading ? (
                  <Skeleton className="h-10 w-16 bg-white/50 rounded-lg" />
                ) : (
                  <>
                    <div className="text-4xl font-extrabold tracking-tight text-foreground animate-count-up" data-testid={`text-${card.testId}`} style={{ animationDelay: `${(index + 1) * 0.15 + 0.3}s`, opacity: 0 }}>
                      {value}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${card.iconBg}`} />
                      <p className="text-xs text-muted-foreground font-medium">{card.sub}</p>
                    </div>
                  </>
                )}
                <div className={`absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${card.gradientFrom} ${card.gradientTo}`}>
                </div>
              </div>
            );
          })}
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '0.5s', opacity: 0 }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight" data-testid="text-performance-title">Performance Metrics</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                key: "medicineAdherence",
                label: "Medicine Adherence",
                desc: "Patients following prescriptions",
                value: metrics?.medicineAdherence ?? 0,
                icon: Pill,
                gradientFrom: "from-emerald-400",
                gradientTo: "to-green-600",
                iconBg: "bg-gradient-to-br from-emerald-400 to-green-500",
                barColor: "bg-gradient-to-r from-emerald-400 to-green-500",
                shadowColor: "shadow-emerald-500/25",
                tintClass: "stat-card-green",
              },
              {
                key: "followupCompletion",
                label: "Follow-up Completion",
                desc: "Scheduled follow-ups completed",
                value: metrics?.followupCompletion ?? 0,
                icon: CalendarCheck,
                gradientFrom: "from-blue-400",
                gradientTo: "to-indigo-600",
                iconBg: "bg-gradient-to-br from-blue-400 to-indigo-500",
                barColor: "bg-gradient-to-r from-blue-400 to-indigo-500",
                shadowColor: "shadow-blue-500/25",
                tintClass: "stat-card-blue",
              },
              {
                key: "reducedOpdLoad",
                label: "Reduced Repeat OPD",
                desc: "Patients managed without repeat visits",
                value: metrics?.reducedOpdLoad ?? 0,
                icon: Building2,
                gradientFrom: "from-violet-400",
                gradientTo: "to-purple-600",
                iconBg: "bg-gradient-to-br from-violet-400 to-purple-500",
                barColor: "bg-gradient-to-r from-violet-400 to-purple-500",
                shadowColor: "shadow-violet-500/25",
                tintClass: "stat-card-violet",
              },
            ].map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.key}
                  data-testid={`card-metric-${metric.key}`}
                  onClick={() => setLocation("/adherence")}
                  className={`glass-card ${metric.tintClass || ''} rounded-2xl p-5 animate-fade-up overflow-hidden group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
                  style={{ animationDelay: `${0.6 + index * 0.1}s`, opacity: 0 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>{metric.label}</span>
                    <div className={`icon-container h-11 w-11 rounded-xl ${metric.iconBg} flex items-center justify-center shadow-lg ${metric.shadowColor} group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  {metricsLoading ? (
                    <Skeleton className="h-10 w-20 bg-white/50 rounded-lg" />
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold tracking-tight text-foreground" data-testid={`text-metric-${metric.key}`}>
                          {metric.value}
                        </span>
                        <span className="text-lg font-bold text-muted-foreground">%</span>
                      </div>
                      <div className="mt-3 mb-1">
                        <div className="h-2 w-full rounded-full bg-gray-100/80 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${metric.barColor} transition-all duration-1000 ease-out`}
                            style={{ width: `${metric.value}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${metric.iconBg}`} />
                        <p className="text-xs text-muted-foreground font-medium">{metric.desc}</p>
                      </div>
                    </>
                  )}
                  <div className={`absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${metric.gradientFrom} ${metric.gradientTo}`} />
                </div>
              );
            })}
          </div>
        </div>

        {qrUrl && (
          <div className="glass-card-strong rounded-2xl animate-fade-up overflow-hidden" style={{ animationDelay: '0.45s', opacity: 0 }} data-testid="card-qr-checkin">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="flex-shrink-0 group relative cursor-pointer" data-testid="button-qr-preview">
                      <div className="bg-white rounded-2xl p-3 border border-blue-100 shadow-sm group-hover:shadow-md group-hover:border-blue-300 transition-all">
                        <img src={qrImageUrl} alt="Patient Check-in QR Code" className="h-32 w-32 rounded-lg" />
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-2xl transition-all flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-blue-600 bg-white/90 px-2 py-1 rounded-full shadow">Click to enlarge</span>
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-blue-600" />
                        Patient Check-in QR Code
                      </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-4">
                      <div className="bg-white rounded-2xl p-4 border border-blue-100">
                        <img src={qrImageUrl} alt="Patient Check-in QR Code" className="h-64 w-64" />
                      </div>
                      <p className="text-sm text-muted-foreground text-center max-w-xs">
                        Print this QR code and display it in your clinic. Patients can scan to check in before their appointment.
                      </p>
                      <div className="flex gap-2 w-full">
                        <Button variant="outline" className="flex-1" onClick={handleCopyLink} data-testid="button-copy-link-dialog">
                          {linkCopied ? <Check className="h-4 w-4 mr-2 text-emerald-600" /> : <Copy className="h-4 w-4 mr-2" />}
                          {linkCopied ? "Copied!" : "Copy Link"}
                        </Button>
                        <Button className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white" onClick={handleDownloadQr} data-testid="button-download-qr-dialog">
                          <Download className="h-4 w-4 mr-2" />
                          Download QR
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                      <QrCode className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Patient Check-in QR</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Display this QR code in your clinic. Patients can scan it to check in, saving time during registration.
                  </p>
                  <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
                    <Button size="sm" variant="outline" onClick={handleCopyLink} data-testid="button-copy-qr-link">
                      {linkCopied ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                      {linkCopied ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white" onClick={handleDownloadQr} data-testid="button-download-qr">
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {waitingQueue.length > 0 && (
          <div className="glass-card-strong rounded-2xl animate-fade-up overflow-hidden" style={{ animationDelay: '0.47s', opacity: 0 }} data-testid="card-upcoming-patients">
            <div className="p-6 pb-4 border-b border-white/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Upcoming Patients</h2>
                    <p className="text-sm text-muted-foreground">Patients checked in via QR code</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-gradient-to-r from-blue-500/15 to-cyan-500/15 text-blue-700 border-blue-200/50 font-semibold" data-testid="badge-queue-count">
                  {waitingQueue.length} waiting
                </Badge>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {waitingQueue.slice(0, 5).map((entry: any, index: number) => (
                  <div
                    key={entry.id}
                    data-testid={`card-dashboard-queue-${entry.id}`}
                    className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-cyan-50/30 border border-blue-100/60 hover:shadow-md hover:border-blue-200 transition-all animate-fade-up"
                    style={{ animationDelay: `${0.5 + index * 0.06}s`, opacity: 0 }}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20 shrink-0">
                        {entry.name?.charAt(0) || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-sm sm:text-base truncate">{entry.name}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                          {entry.mobile && (
                            <span className="flex items-center gap-1 truncate">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate">{entry.mobile}</span>
                            </span>
                          )}
                          {entry.age && <span className="shrink-0">{entry.age} yrs</span>}
                          {entry.gender && <span className="shrink-0">· {entry.gender}</span>}
                          <span className="flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3" />
                            {new Date(entry.entryTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                      {entry.status === "waiting" && (
                        <>
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs whitespace-nowrap">
                            <span className="relative flex h-1.5 w-1.5 mr-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                            </span>
                            Waiting
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 text-xs whitespace-nowrap"
                            onClick={(e) => { e.stopPropagation(); handleStartClick(entry); }}
                            data-testid={`button-dashboard-start-${entry.id}`}
                          >
                            <Play className="h-3 w-3 mr-1" /> Start
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {waitingQueue.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full text-blue-600 hover:text-blue-800 hover:bg-blue-50/50"
                    onClick={() => setLocation("/active-care")}
                    data-testid="button-view-all-queue"
                  >
                    View all {waitingQueue.length} patients in Active Care
                    <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="glass-card-strong rounded-2xl animate-fade-up overflow-hidden" style={{ animationDelay: '0.5s', opacity: 0 }}>
          <div className="p-6 pb-4 border-b border-white/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <Pill className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Recent Patient Visits</h2>
                  <p className="text-sm text-muted-foreground">Manage ongoing care plans and visit records</p>
                </div>
              </div>
              {visits && visits.length > 0 && (
                <Badge variant="secondary" className="bg-gradient-to-r from-violet-500/15 to-purple-500/15 text-violet-700 border-violet-200/50 font-semibold" data-testid="badge-visit-count">
                  {visits.length} visit{visits.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
          <div className="p-6">
            {visitsLoading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-12 w-12 rounded-full bg-white/50" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40 bg-white/50 rounded" />
                      <Skeleton className="h-3 w-24 bg-white/40 rounded" />
                    </div>
                    <Skeleton className="h-6 w-20 bg-white/40 rounded-full" />
                  </div>
                ))}
              </div>
            ) : visits && visits.length > 0 ? (
              <>
              <div className="space-y-3">
                {visits.slice((visitPage - 1) * ROWS_PER_PAGE, visitPage * ROWS_PER_PAGE).map((visit: any, i: number) => {
                  const colorAccent = visitColorAccents[i % visitColorAccents.length];
                  return (
                    <div
                      key={visit.id}
                      data-testid={`card-visit-${visit.id}`}
                      className="glass-visit-row flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3 sm:p-4 rounded-xl cursor-pointer group animate-fade-up"
                      onClick={() => setLocation(`/visit/${visit.id}`)}
                      onMouseEnter={() => {
                        queryClient.prefetchQuery({
                          queryKey: ["/api/visits", visit.id],
                          staleTime: 5 * 60 * 1000,
                        });
                      }}
                      style={{ animationDelay: `${0.6 + i * 0.08}s`, opacity: 0 }}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br ${colorAccent.bg} border ${colorAccent.border} flex items-center justify-center ${colorAccent.text} font-bold text-sm backdrop-blur-sm group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                          {visit.patient?.name?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold text-foreground text-sm sm:text-base ${colorAccent.hoverText} transition-colors truncate max-w-[60vw] sm:max-w-none`} data-testid={`text-patient-name-${visit.id}`}>
                              {visit.patient?.name || "Unknown"}
                            </p>
                            {visit.patient?.age && (
                              <span className="text-[10px] sm:text-xs text-muted-foreground bg-gradient-to-r from-slate-100 to-slate-50 px-2 py-0.5 rounded-full border border-slate-200/50 shrink-0">
                                {visit.patient.age} yrs
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] sm:text-sm text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3 text-violet-400 shrink-0" />
                            <span className="truncate">{new Date(visit.visitDate).toLocaleDateString()} {new Date(visit.visitDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-auto">
                        <StatusBadge status={visit.status} />
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 hover:bg-violet-50" data-testid={`button-menu-${visit.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="glass-card-strong">
                            <DropdownMenuItem onClick={() => setLocation(`/visit/${visit.id}`)}>View Details</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination
                currentPage={visitPage}
                totalPages={Math.ceil(visits.length / ROWS_PER_PAGE)}
                onPageChange={setVisitPage}
              />
              </>
            ) : (
              <div className="text-center py-16 animate-scale-in" style={{ animationDelay: '0.3s', opacity: 0 }}>
                <div className="relative inline-block mb-6">
                  <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-cyan-400/15 via-violet-400/15 to-rose-400/15 border border-white/40 flex items-center justify-center backdrop-blur-sm animate-float">
                    <Stethoscope className="h-12 w-12 text-violet-500/50" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/30 animate-heartbeat">
                    <HeartPulse className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-pulse">
                    <ShieldCheck className="h-3 w-3 text-white" />
                  </div>
                </div>
                <p className="text-xl font-bold gradient-text-health">No visits yet</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                  Start your first patient visit to begin building personalized care plans.
                </p>
                <Button
                  className="mt-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:from-cyan-600 hover:via-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all duration-300 animate-gradient"
                  onClick={() => setLocation("/new-visit")}
                  data-testid="button-first-visit"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start First Visit
                </Button>
              </div>
            )}
          </div>
        </div>

      <Dialog open={patientDialogOpen} onOpenChange={setPatientDialogOpen}>
        <DialogContent className="sm:max-w-[750px] w-[95vw] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-emerald-50/30 to-cyan-50/20 p-0 border-0 shadow-2xl">
          <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Stethoscope className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-2xl font-bold text-gray-900" data-testid="text-patient-details-title">Patient Details</span>
                  <p className="text-sm text-muted-foreground font-normal mt-0.5 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    Review patient information before starting consultation
                  </p>
                </div>
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 pt-4">
            {patientDetailsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="loader-patient-details">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm text-muted-foreground">Loading patient details...</p>
              </div>
            ) : patientDetails ? (
              <div className="space-y-5">
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center text-white font-bold text-base shadow-md">
                      {patientDetails.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <p className="text-lg font-semibold text-gray-900 flex items-center gap-2" data-testid="text-patient-detail-name">
                      <User className="h-4 w-4 text-emerald-500" />
                      Selected: {patientDetails.name}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
                    <p data-testid="text-patient-detail-age"><span className="font-semibold text-gray-900">Age:</span> <span className="text-gray-600">{patientDetails.age || "—"} yrs</span></p>
                    <p data-testid="text-patient-detail-gender"><span className="font-semibold text-gray-900">Gender:</span> <span className="text-gray-600">{patientDetails.gender || "—"}</span></p>
                    <p data-testid="text-patient-detail-phone"><span className="font-semibold text-gray-900">WhatsApp:</span> <span className="text-gray-600">{patientDetails.whatsappNumber || patientDetails.phone || "—"}</span></p>
                    <p data-testid="text-patient-detail-blood"><span className="font-semibold text-gray-900">Blood Group:</span> <span className="text-gray-600">{patientDetails.bloodGroup || "—"}</span></p>
                    <p data-testid="text-patient-detail-height"><span className="font-semibold text-gray-900">Height:</span> <span className="text-gray-600">{patientDetails.height ? `${patientDetails.height} cm` : "—"}</span></p>
                    <p data-testid="text-patient-detail-weight"><span className="font-semibold text-gray-900">Weight:</span> <span className="text-gray-600">{patientDetails.weight ? `${patientDetails.weight} kg` : "—"}</span></p>
                  </div>

                  {(patientDetails.knownConditions || patientDetails.allergies || patientDetails.pastIllnesses || patientDetails.chronicDiseases || patientDetails.currentMedications || patientDetails.previousSurgeries || patientDetails.familyHistory || patientDetails.lifestyleHabits || patientDetails.pregnancyStatus) && (
                    <>
                      <div className="border-t border-gray-100 my-4" />
                      <p className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3" data-testid="text-medical-history-header">Medical History (Patient-Provided)</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px]">
                        {patientDetails.knownConditions && <p><span className="font-semibold text-gray-900">Conditions:</span> <span className="text-gray-600">{patientDetails.knownConditions}</span></p>}
                        {patientDetails.allergies && <p><span className="font-semibold text-gray-900">Allergies:</span> <span className="text-gray-600">{patientDetails.allergies}</span></p>}
                        {patientDetails.chronicDiseases && <p><span className="font-semibold text-gray-900">Chronic Diseases:</span> <span className="text-gray-600">{patientDetails.chronicDiseases}</span></p>}
                        {patientDetails.currentMedications && <p><span className="font-semibold text-gray-900">Current Medications:</span> <span className="text-gray-600">{patientDetails.currentMedications}</span></p>}
                        {patientDetails.pastIllnesses && <p><span className="font-semibold text-gray-900">Past Illnesses:</span> <span className="text-gray-600">{patientDetails.pastIllnesses}</span></p>}
                        {patientDetails.previousSurgeries && <p><span className="font-semibold text-gray-900">Surgeries:</span> <span className="text-gray-600">{patientDetails.previousSurgeries}</span></p>}
                        {patientDetails.familyHistory && <p><span className="font-semibold text-gray-900">Family History:</span> <span className="text-gray-600">{patientDetails.familyHistory}</span></p>}
                        {patientDetails.lifestyleHabits && <p><span className="font-semibold text-gray-900">Lifestyle:</span> <span className="text-gray-600">{patientDetails.lifestyleHabits}</span></p>}
                        {patientDetails.pregnancyStatus && <p><span className="font-semibold text-gray-900">Pregnancy:</span> <span className="text-gray-600">{patientDetails.pregnancyStatus}</span></p>}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-start gap-3 p-4 bg-white border border-gray-200/80 rounded-2xl shadow-sm">
                  <Checkbox
                    id="consent"
                    checked={consentChecked}
                    onCheckedChange={(checked) => setConsentChecked(checked === true)}
                    className="mt-0.5 border-gray-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    data-testid="checkbox-consent"
                  />
                  <label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                    <span className="font-semibold text-gray-900">Consent for Audio Recording</span>
                    <br />
                    <span className="text-muted-foreground text-xs">Patient consents to audio recording for the purpose of medical documentation and care plan generation.</span>
                  </label>
                </div>

                <div className="flex justify-end">
                  <Button
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 text-white font-semibold py-5 px-8 rounded-xl text-sm"
                    disabled={!consentChecked}
                    onClick={handleStartConsultation}
                    data-testid="button-start-consultation"
                  >
                    <Stethoscope className="h-4 w-4 mr-2" />
                    Start Consultation
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Could not load patient details.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {activeSidebar && (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const allVisits = visits || [];

        const sidebarConfig = {
          totalToday: {
            title: "Today's Patients",
            subtitle: "Patients visited today",
            icon: Users,
            iconBg: "bg-gradient-to-br from-cyan-400 to-blue-500",
            shadowColor: "shadow-blue-500/25",
            itemBg: "from-cyan-50/50 to-blue-50/30",
            itemBorder: "border-blue-100/60 hover:border-blue-200",
            avatarBg: "from-cyan-400 to-blue-500",
            avatarShadow: "shadow-blue-500/20",
            emptyIcon: Users,
            emptyTitle: "No patients today",
            emptyDesc: "No visits have been recorded today",
            items: allVisits.filter((v: any) => {
              const vd = new Date(v.visitDate);
              vd.setHours(0, 0, 0, 0);
              return vd.getTime() === today.getTime();
            }),
          },
          activeCare: {
            title: "Active Care Plans",
            subtitle: "Currently running care plans",
            icon: HeartPulse,
            iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
            shadowColor: "shadow-emerald-500/25",
            itemBg: "from-emerald-50/50 to-teal-50/30",
            itemBorder: "border-emerald-100/60 hover:border-emerald-200",
            avatarBg: "from-emerald-400 to-teal-500",
            avatarShadow: "shadow-emerald-500/20",
            emptyIcon: HeartPulse,
            emptyTitle: "No active care plans",
            emptyDesc: "No visits currently have active care plans",
            items: allVisits.filter((v: any) => v.status === "active"),
          },
          pending: {
            title: "Pending Reviews",
            subtitle: "Visits awaiting your review",
            icon: Clock,
            iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
            shadowColor: "shadow-amber-500/25",
            itemBg: "from-amber-50/50 to-orange-50/30",
            itemBorder: "border-amber-100/60 hover:border-amber-200",
            avatarBg: "from-amber-400 to-orange-500",
            avatarShadow: "shadow-amber-500/20",
            emptyIcon: Clock,
            emptyTitle: "No pending reviews",
            emptyDesc: "All visits have been reviewed",
            items: allVisits.filter((v: any) => v.status === "draft"),
          },
        };

        const cfg = sidebarConfig[activeSidebar];
        const SidebarIcon = cfg.icon;
        const EmptyIcon = cfg.emptyIcon;

        return (
          <div className="fixed inset-0 z-50 flex justify-end" data-testid={`sidebar-${activeSidebar}`}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActiveSidebar(null)} />
            <div className="relative w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl ${cfg.iconBg} flex items-center justify-center shadow-lg ${cfg.shadowColor}`}>
                    <SidebarIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{cfg.title}</h2>
                    <p className="text-sm text-muted-foreground">{cfg.subtitle}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveSidebar(null)} className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100">
                  <span className="text-lg">&times;</span>
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {cfg.items.length > 0 ? (
                  <div className="space-y-3">
                    {cfg.items.map((visit: any) => (
                      <div
                        key={visit.id}
                        className={`flex items-center justify-between p-4 rounded-xl bg-gradient-to-r ${cfg.itemBg} border ${cfg.itemBorder} hover:shadow-md transition-all cursor-pointer`}
                        onClick={() => { setActiveSidebar(null); setLocation(`/visit/${visit.id}`); }}
                        data-testid={`sidebar-visit-${visit.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${cfg.avatarBg} flex items-center justify-center text-white font-bold text-sm shadow-md ${cfg.avatarShadow}`}>
                            {visit.patient?.name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{visit.patient?.name || "Unknown"}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {visit.patient?.age && <span>{visit.patient.age} yrs</span>}
                              {visit.patient?.gender && <span>· {visit.patient.gender}</span>}
                              {visit.patient?.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {visit.patient.phone}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <Calendar className="h-3 w-3" />
                              {new Date(visit.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              {" · "}
                              {new Date(visit.visitDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={visit.status} />
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                      <EmptyIcon className="h-8 w-8 text-gray-300" />
                    </div>
                    <p className="font-semibold text-foreground mb-1">{cfg.emptyTitle}</p>
                    <p className="text-sm text-muted-foreground">{cfg.emptyDesc}</p>
                  </div>
                )}
              </div>
              {cfg.items.length > 0 && (
                <div className="p-4 border-t border-gray-100 shrink-0">
                  <p className="text-xs text-center text-muted-foreground">{cfg.items.length} visit{cfg.items.length !== 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {queueSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" data-testid="sidebar-upcoming-patients">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setQueueSidebarOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Upcoming Patients</h2>
                  <p className="text-sm text-muted-foreground">Patients checked in via QR code</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setQueueSidebarOpen(false)} className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100">
                <span className="text-lg">&times;</span>
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {waitingQueue.length > 0 ? (
                <div className="space-y-3">
                  {waitingQueue.map((entry: any, index: number) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-cyan-50/30 border border-blue-100/60 hover:shadow-md hover:border-blue-200 transition-all"
                      data-testid={`sidebar-queue-entry-${entry.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20 shrink-0">
                          {entry.name?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground text-sm truncate">{entry.name}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                            {entry.mobile && (
                              <span className="flex items-center gap-1 truncate">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span className="truncate">{entry.mobile}</span>
                              </span>
                            )}
                            {entry.age && <span className="shrink-0">{entry.age} yrs</span>}
                            {entry.gender && <span className="shrink-0">· {entry.gender}</span>}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            {new Date(entry.entryTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-auto">
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs whitespace-nowrap">
                          <span className="relative flex h-1.5 w-1.5 mr-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                          </span>
                          Waiting
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 text-xs whitespace-nowrap"
                          onClick={() => { setQueueSidebarOpen(false); handleStartClick(entry); }}
                          data-testid={`sidebar-start-${entry.id}`}
                        >
                          <Play className="h-3 w-3 mr-1" /> Start
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-blue-300" />
                  </div>
                  <p className="font-semibold text-foreground mb-1">No patients waiting</p>
                  <p className="text-sm text-muted-foreground">Patients who check in via QR code will appear here</p>
                </div>
              )}
            </div>
            {waitingQueue.length > 0 && (
              <div className="p-4 border-t border-gray-100 shrink-0">
                <p className="text-xs text-center text-muted-foreground">{waitingQueue.length} patient{waitingQueue.length !== 1 ? "s" : ""} waiting</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
