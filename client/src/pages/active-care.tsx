import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  HeartPulse, Activity, Clock, CheckCircle2, 
  ArrowRight, Calendar, Pill, FileText, AlertCircle,
  Stethoscope, User, Users, Phone, Play, Check, Loader2, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ROWS_PER_PAGE = 10;

export default function ActiveCare() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const urlTab = new URLSearchParams(window.location.search).get("tab") as "active" | "pending" | "upcoming" | null;
  const [activeTab, setActiveTab] = useState<"active" | "pending" | "upcoming">(urlTab && ["active", "pending", "upcoming"].includes(urlTab) ? urlTab : "active");
  const [activePage, setActivePage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [queuePage, setQueuePage] = useState(1);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedQueueEntryId, setSelectedQueueEntryId] = useState<string | null>(null);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const queryClient = useQueryClient();

  const { data: visits, isLoading } = useQuery<any[]>({
    queryKey: ["/api/visits"],
  });

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
    refetchInterval: 15000,
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
      await queryClient.cancelQueries({ queryKey: ["/api/patient-queue"] });
      const previous = queryClient.getQueryData(["/api/patient-queue"]);
      queryClient.setQueryData(["/api/patient-queue"], (old: any[] | undefined) =>
        (old || []).map((e: any) => e.id === id ? { ...e, status } : e)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["/api/patient-queue"], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-queue"] });
    },
  });

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

  const activeVisits = visits?.filter(v => v.status === "active") || [];
  const draftVisits = visits?.filter(v => v.status === "draft") || [];
  const recordingVisits = visits?.filter(v => v.status === "recording") || [];
  const waitingQueue = (queueData || []).filter((e: any) => e.status === "waiting");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Active Care Plans"
        subtitle="Track and manage all ongoing patient care plans"
        icon={HeartPulse}
        iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
        testId="text-active-care-title"
      />

      <div className="grid gap-4 md:grid-cols-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <div className="glass-card stat-card-green rounded-xl p-6" data-testid="card-summary-active">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Plans</p>
              <p className="text-3xl font-bold text-emerald-600 animate-count-up">{activeVisits.length}</p>
            </div>
            <div className="icon-container h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="glass-card stat-card-amber rounded-xl p-6" data-testid="card-summary-draft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
              <p className="text-3xl font-bold text-amber-600 animate-count-up">{draftVisits.length}</p>
            </div>
            <div className="icon-container h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Clock className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="glass-card stat-card-orange rounded-xl p-6" data-testid="card-summary-recording">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">In Recording</p>
              <p className="text-3xl font-bold text-orange-600 animate-count-up">{recordingVisits.length}</p>
            </div>
            <div className="icon-container h-12 w-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
              <Activity className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="animate-fade-up -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scrollbar-hide" style={{ animationDelay: "0.2s" }}>
        <div className="flex gap-1 p-1 bg-muted/50 rounded-xl w-max sm:w-fit" data-testid="tabs-care-plans">
          <button
            onClick={() => { setActiveTab("active"); setPendingPage(1); }}
            data-testid="tab-active-plans"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "active"
                ? "bg-white shadow-md text-emerald-700 border border-emerald-200/50"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Active Care Plans
            {activeVisits.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === "active" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
              }`}>
                {activeVisits.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab("pending"); setActivePage(1); }}
            data-testid="tab-pending-review"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "pending"
                ? "bg-white shadow-md text-amber-700 border border-amber-200/50"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50"
            }`}
          >
            <Clock className="h-4 w-4" />
            Pending Review
            {draftVisits.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === "pending" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
              }`}>
                {draftVisits.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab("upcoming"); setQueuePage(1); }}
            data-testid="tab-upcoming-patients"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "upcoming"
                ? "bg-white shadow-md text-blue-700 border border-blue-200/50"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50"
            }`}
          >
            <Users className="h-4 w-4" />
            Upcoming Patients
            {waitingQueue.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === "upcoming" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
              }`}>
                {waitingQueue.length}
              </span>
            )}
          </button>
        </div>

        <div className="mt-5">
          {activeTab === "active" && (
            <div className="space-y-3">
              {activeVisits.length > 0 ? (
                activeVisits.slice((activePage - 1) * ROWS_PER_PAGE, activePage * ROWS_PER_PAGE).map((visit: any, index: number) => (
                  <div 
                    key={visit.id} 
                    data-testid={`card-active-visit-${visit.id}`}
                    className="glass-visit-row rounded-xl p-5 cursor-pointer animate-fade-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => setLocation(`/visit/${visit.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                          {visit.patient?.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="font-semibold" data-testid={`text-active-patient-${visit.id}`}>{visit.patient?.name || "Unknown"}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(visit.visitDate).toLocaleDateString()}
                            </span>
                            {visit.patient?.age && <span>{visit.patient.age} yrs</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                          <span className="relative flex h-2 w-2 mr-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          Active
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))
              ) : null}
              {activeVisits.length > 0 && (
                <Pagination
                  currentPage={activePage}
                  totalPages={Math.ceil(activeVisits.length / ROWS_PER_PAGE)}
                  onPageChange={setActivePage}
                />
              )}
              {activeVisits.length === 0 && (
                <div className="glass-card-strong rounded-2xl text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">No active care plans</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                    Approve pending visits to activate care plans for patients.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "pending" && (
            <div className="space-y-3">
              {draftVisits.length > 0 ? (
                draftVisits.slice((pendingPage - 1) * ROWS_PER_PAGE, pendingPage * ROWS_PER_PAGE).map((visit: any, index: number) => (
                  <div 
                    key={visit.id} 
                    data-testid={`card-draft-visit-${visit.id}`}
                    className="glass-visit-row rounded-xl p-5 cursor-pointer animate-fade-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => setLocation(`/visit/${visit.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
                          {visit.patient?.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="font-semibold" data-testid={`text-pending-patient-${visit.id}`}>{visit.patient?.name || "Unknown"}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(visit.visitDate).toLocaleDateString()}
                            </span>
                            {visit.patient?.age && <span>{visit.patient.age} yrs</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                          <Clock className="h-3 w-3 mr-1" />
                          Needs Review
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))
              ) : null}
              {draftVisits.length > 0 && (
                <Pagination
                  currentPage={pendingPage}
                  totalPages={Math.ceil(draftVisits.length / ROWS_PER_PAGE)}
                  onPageChange={setPendingPage}
                />
              )}
              {draftVisits.length === 0 && (
                <div className="glass-card-strong rounded-2xl text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-8 w-8 text-amber-300" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">No pending reviews</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                    All visits have been reviewed. Start a new visit to continue.
                  </p>
                  <Button
                    className="mt-6"
                    onClick={() => setLocation("/new-visit")}
                    data-testid="button-start-visit-pending"
                  >
                    <Stethoscope className="mr-2 h-4 w-4" />
                    Start New Visit
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === "upcoming" && (
            <div className="space-y-3">
              {waitingQueue.length > 0 ? (
                waitingQueue.slice((queuePage - 1) * ROWS_PER_PAGE, queuePage * ROWS_PER_PAGE).map((entry: any, index: number) => (
                  <div
                    key={entry.id}
                    data-testid={`card-queue-entry-${entry.id}`}
                    className="glass-visit-row rounded-xl p-3 sm:p-5 animate-fade-up hover:shadow-md hover:border-blue-200 transition-all overflow-hidden"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                          {entry.name?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-blue-700 hover:text-blue-900 transition-colors text-sm sm:text-base truncate" data-testid={`text-queue-name-${entry.id}`}>{entry.name}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-sm text-muted-foreground mt-1">
                            {entry.mobile && (
                              <span className="flex items-center gap-1 truncate">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span className="truncate">{entry.mobile}</span>
                              </span>
                            )}
                            {entry.age && <span className="shrink-0">{entry.age} yrs</span>}
                            {entry.gender && <span className="shrink-0">· {entry.gender}</span>}
                            <span className="flex items-center gap-1 shrink-0">
                              <Calendar className="h-3 w-3" />
                              {new Date(entry.entryTime).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-auto">
                        {entry.status === "waiting" && (
                          <>
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs whitespace-nowrap">
                              <span className="relative flex h-2 w-2 mr-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                              </span>
                              Waiting
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 text-xs whitespace-nowrap"
                              onClick={() => handleStartClick(entry)}
                              data-testid={`button-start-queue-${entry.id}`}
                            >
                              <Play className="h-3 w-3 mr-1" /> Start
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : null}
              {waitingQueue.length > 0 && (
                <Pagination
                  currentPage={queuePage}
                  totalPages={Math.ceil(waitingQueue.length / ROWS_PER_PAGE)}
                  onPageChange={setQueuePage}
                />
              )}
              {waitingQueue.length === 0 && (
                <div className="glass-card-strong rounded-2xl text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-blue-300" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">No upcoming patients</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                    Share your QR code to let patients check in remotely.
                  </p>
                </div>
              )}
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
                  <span className="text-2xl font-bold text-gray-900" data-testid="text-ac-patient-details-title">Patient Details</span>
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
              <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="loader-ac-patient-details">
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
                    <p className="text-lg font-semibold text-gray-900 flex items-center gap-2" data-testid="text-ac-patient-detail-name">
                      <User className="h-4 w-4 text-emerald-500" />
                      Selected: {patientDetails.name}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
                    <p data-testid="text-ac-patient-detail-age"><span className="font-semibold text-gray-900">Age:</span> <span className="text-gray-600">{patientDetails.age || "—"} yrs</span></p>
                    <p data-testid="text-ac-patient-detail-gender"><span className="font-semibold text-gray-900">Gender:</span> <span className="text-gray-600">{patientDetails.gender || "—"}</span></p>
                    <p data-testid="text-ac-patient-detail-phone"><span className="font-semibold text-gray-900">WhatsApp:</span> <span className="text-gray-600">{patientDetails.whatsappNumber || patientDetails.phone || "—"}</span></p>
                    <p data-testid="text-ac-patient-detail-blood"><span className="font-semibold text-gray-900">Blood Group:</span> <span className="text-gray-600">{patientDetails.bloodGroup || "—"}</span></p>
                    <p data-testid="text-ac-patient-detail-height"><span className="font-semibold text-gray-900">Height:</span> <span className="text-gray-600">{patientDetails.height ? `${patientDetails.height} cm` : "—"}</span></p>
                    <p data-testid="text-ac-patient-detail-weight"><span className="font-semibold text-gray-900">Weight:</span> <span className="text-gray-600">{patientDetails.weight ? `${patientDetails.weight} kg` : "—"}</span></p>
                  </div>

                  {(patientDetails.knownConditions || patientDetails.allergies || patientDetails.pastIllnesses || patientDetails.chronicDiseases || patientDetails.currentMedications || patientDetails.previousSurgeries || patientDetails.familyHistory || patientDetails.lifestyleHabits || patientDetails.pregnancyStatus) && (
                    <>
                      <div className="border-t border-gray-100 my-4" />
                      <p className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3" data-testid="text-ac-medical-history-header">Medical History (Patient-Provided)</p>
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
                    id="ac-consent"
                    checked={consentChecked}
                    onCheckedChange={(checked) => setConsentChecked(checked === true)}
                    className="mt-0.5 border-gray-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    data-testid="checkbox-ac-consent"
                  />
                  <label htmlFor="ac-consent" className="text-sm leading-relaxed cursor-pointer">
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
                    data-testid="button-ac-start-consultation"
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
    </div>
  );
}
