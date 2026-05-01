import { useLocation } from "wouter";
import { FeatureGate } from "@/components/upgrade-prompt";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getSessionToken } from "@/lib/queryClient";
import {
  Pill, CheckCircle2, XCircle, Clock, TrendingUp,
  AlertCircle, Activity, User, Calendar, BarChart3,
  ArrowLeft
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Pagination } from "@/components/pagination";
import { useState, useEffect } from "react";

interface Medicine {
  id: string;
  visitId: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  timing: string | null;
  durationDays: number | null;
  instructions: string | null;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string | null;
  gender: string | null;
}

interface Visit {
  id: string;
  patientId: string;
  visitDate: string;
  status: string;
  patient?: Patient;
  medicines?: Medicine[];
}

interface AdherenceLog {
  id: string;
  visitId: string;
  patientId: string;
  medicineId: string | null;
  dayNumber: number;
  status: string;
  loggedAt: string;
  notes: string | null;
}

function getDaysBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function parseDurationDays(instructions: string | null, durationDays: number | null): number {
  if (durationDays && durationDays > 0) return durationDays;
  if (!instructions) return 1;
  const text = instructions.toLowerCase();
  const daysMatch = text.match(/(\d+)\s*day/);
  if (daysMatch) return parseInt(daysMatch[1]);
  const weeksMatch = text.match(/(\d+)\s*week/);
  if (weeksMatch) return parseInt(weeksMatch[1]) * 7;
  const monthsMatch = text.match(/(\d+)\s*month/);
  if (monthsMatch) return parseInt(monthsMatch[1]) * 30;
  return 1;
}

function getMedDuration(med: Medicine): number {
  return parseDurationDays(med.instructions, med.durationDays);
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "taken":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "missed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
}

function StatusButton({
  currentStatus,
  onStatusChange,
  disabled,
}: {
  currentStatus: "taken" | "missed" | "pending";
  onStatusChange: (status: "taken" | "missed" | "pending") => void;
  disabled?: boolean;
}) {
  const nextStatus = (): "taken" | "missed" | "pending" => {
    if (currentStatus === "pending") return "taken";
    if (currentStatus === "taken") return "missed";
    return "pending";
  };

  const bgClass =
    currentStatus === "taken"
      ? "bg-emerald-100 hover:bg-emerald-200 border-emerald-300"
      : currentStatus === "missed"
      ? "bg-red-100 hover:bg-red-200 border-red-300"
      : "bg-gray-100 hover:bg-gray-200 border-gray-300";

  return (
    <button
      className={`h-8 w-8 rounded-md border flex items-center justify-center transition-all ${bgClass} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onClick={() => !disabled && onStatusChange(nextStatus())}
      disabled={disabled}
      data-testid="button-status-toggle"
    >
      <StatusIcon status={currentStatus} />
    </button>
  );
}

const ROWS_PER_PAGE = 10;

export default function Adherence() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [adherencePage, setAdherencePage] = useState(1);

  const { data: visits, isLoading: visitsLoading } = useQuery<Visit[]>({
    queryKey: ["/api/visits"],
  });

  const activeVisits = visits?.filter((v) => v.status === "active") || [];
  const activeVisitIds = activeVisits.map(v => v.id).sort().join(",");
  useEffect(() => { setAdherencePage(1); }, [activeVisits.length]);

  const { data: visitDetails, isLoading: detailsLoading } = useQuery<Visit[]>({
    queryKey: ["/api/visits", "active-details", activeVisitIds],
    queryFn: async () => {
      if (!activeVisits.length) return [];
      const details = await Promise.all(
        activeVisits.map(async (v) => {
          const token = getSessionToken();
          const res = await fetch(`/api/visits/${v.id}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
          if (!res.ok) throw new Error("Failed to fetch visit details");
          return res.json();
        })
      );
      return details;
    },
    enabled: activeVisits.length > 0,
  });

  const { data: allAdherenceLogs } = useQuery<AdherenceLog[]>({
    queryKey: ["/api/adherence", "all-visits", activeVisitIds],
    queryFn: async () => {
      if (!activeVisits.length) return [];
      const logs = await Promise.all(
        activeVisits.map(async (v) => {
          const token = getSessionToken();
          const res = await fetch(`/api/adherence/visit/${v.id}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
          if (!res.ok) return [];
          return res.json();
        })
      );
      return logs.flat();
    },
    enabled: activeVisits.length > 0,
  });

  const adherenceMutation = useMutation({
    mutationFn: async (data: {
      visitId: string;
      patientId: string;
      medicineId: string;
      dayNumber: number;
      status: "taken" | "missed" | "pending";
      notes: string;
    }) => {
      const res = await apiRequest("POST", "/api/adherence", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/adherence"] });
      toast({
        title: "Adherence Updated",
        description: "Medication status has been logged.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update adherence status.",
        variant: "destructive",
      });
    },
  });

  const isLoading = visitsLoading || detailsLoading;

  function getStatusForCell(visitId: string, medicineId: string, day: number, daysPassed: number): "taken" | "missed" | "pending" {
    const log = (allAdherenceLogs || []).find(
      (l) => l.visitId === visitId && l.medicineId === medicineId && l.dayNumber === day
    );
    if (log) return log.status as "taken" | "missed" | "pending";
    if (day < daysPassed) return "missed";
    return "pending";
  }

  function computeStats() {
    let totalDoses = 0, taken = 0, missed = 0, pending = 0;
    for (const visit of (visitDetails || [])) {
      const visitStart = new Date(visit.visitDate);
      const daysPassed = getDaysBetween(visitStart, new Date());
      for (const med of (visit.medicines || [])) {
        const duration = getMedDuration(med);
        for (let d = 0; d < duration; d++) {
          totalDoses++;
          const st = getStatusForCell(visit.id, med.id, d, daysPassed);
          if (st === "taken") taken++;
          else if (st === "missed") missed++;
          else pending++;
        }
      }
    }
    const complianceRate = (taken + missed) > 0 ? Math.round((taken / (taken + missed)) * 100) : 0;
    return { totalDoses, taken, missed, pending, complianceRate };
  }

  const overallStats = computeStats();

  const handleStatusChange = (
    visit: Visit,
    med: Medicine,
    day: number,
    newStatus: "taken" | "missed" | "pending"
  ) => {
    adherenceMutation.mutate({
      visitId: visit.id,
      patientId: visit.patientId,
      medicineId: med.id,
      dayNumber: day,
      status: newStatus,
      notes: `Day ${day + 1} - ${med.name} marked as ${newStatus}`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="loading-adherence">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <FeatureGate feature="adherenceTracking">
    <div className="space-y-8" data-testid="page-adherence">
      <PageHeader
        title="Medication Adherence"
        subtitle="Track patient medication compliance across active care plans"
        icon={Pill}
        iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
        testId="text-adherence-title"
        actions={
          <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-back-dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        }
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 animate-fade-up" style={{ animationDelay: "100ms" }} data-testid="section-summary-stats">
        <div className="glass-card stat-card-green rounded-xl p-6" data-testid="card-stat-taken">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Doses Taken</p>
              <p className="text-3xl font-bold text-emerald-600 animate-count-up">{overallStats.taken}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {overallStats.totalDoses > 0 ? `${Math.round((overallStats.taken / overallStats.totalDoses) * 100)}% of total` : "No data"}
              </p>
            </div>
            <div className="icon-container h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="glass-card stat-card-rose rounded-xl p-6 animate-fade-up" style={{ animationDelay: "150ms" }} data-testid="card-stat-missed">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Doses Missed</p>
              <p className="text-3xl font-bold text-red-600 animate-count-up">{overallStats.missed}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {overallStats.totalDoses > 0 ? `${Math.round((overallStats.missed / overallStats.totalDoses) * 100)}% of total` : "No data"}
              </p>
            </div>
            <div className="icon-container h-12 w-12 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="glass-card stat-card-amber rounded-xl p-6 animate-fade-up" style={{ animationDelay: "200ms" }} data-testid="card-stat-pending">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Doses Pending</p>
              <p className="text-3xl font-bold text-gray-600 animate-count-up">{overallStats.pending}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {overallStats.totalDoses > 0 ? `${Math.round((overallStats.pending / overallStats.totalDoses) * 100)}% of total` : "No data"}
              </p>
            </div>
            <div className="icon-container h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Clock className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="glass-card stat-card-blue rounded-xl p-6 animate-fade-up" style={{ animationDelay: "250ms" }} data-testid="card-stat-compliance">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Compliance Rate</p>
              <p className="text-3xl font-bold text-blue-600 animate-count-up">{overallStats.complianceRate}%</p>
              <Progress value={overallStats.complianceRate} className="mt-2 h-2" data-testid="progress-overall-compliance" />
            </div>
            <div className="icon-container h-12 w-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {activeVisits.length === 0 ? (
        <div className="glass-card-strong rounded-xl animate-fade-up" style={{ animationDelay: "300ms" }} data-testid="card-no-active-visits">
          <div className="p-16">
            <div className="text-center">
              <div className="h-20 w-20 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Pill className="h-10 w-10 text-blue-400" />
              </div>
              <p className="text-xl font-bold text-foreground">No Active Care Plans</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                There are no active visits to track medication adherence for. Approve a visit to start tracking.
              </p>
              <Button className="mt-6" onClick={() => setLocation("/active-care")} data-testid="button-go-active-care">
                <Activity className="mr-2 h-4 w-4" />
                View Care Plans
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {(visitDetails || []).slice((adherencePage - 1) * ROWS_PER_PAGE, adherencePage * ROWS_PER_PAGE).map((visit, vIndex) => {
            const medicines = visit.medicines || [];
            const visitStart = new Date(visit.visitDate);
            const daysPassed = getDaysBetween(visitStart, new Date());

            let visitTaken = 0, visitMissed = 0, visitPending = 0, visitTotal = 0;
            medicines.forEach(med => {
              const dur = getMedDuration(med);
              for (let d = 0; d < dur; d++) {
                visitTotal++;
                const s = getStatusForCell(visit.id, med.id, d, daysPassed);
                if (s === "taken") visitTaken++;
                else if (s === "missed") visitMissed++;
                else visitPending++;
              }
            });
            const visitCompliance = (visitTaken + visitMissed) > 0 ? Math.round((visitTaken / (visitTaken + visitMissed)) * 100) : 0;

            return (
              <div key={visit.id} className="glass-card-strong rounded-xl overflow-hidden animate-fade-up" style={{ animationDelay: `${300 + vIndex * 100}ms` }} data-testid={`card-patient-adherence-${visit.id}`}>
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-500/20 border border-blue-200/50 flex items-center justify-center text-blue-700 font-bold text-lg shrink-0">
                        {visit.patient?.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <h3 className="font-semibold flex items-center gap-2" data-testid={`text-patient-name-${visit.id}`}>
                          <User className="h-4 w-4 text-muted-foreground" />
                          {visit.patient?.name || "Unknown Patient"}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Started {visitStart.toLocaleDateString()}
                          </span>
                          {visit.patient?.age && <span>{visit.patient.age} yrs</span>}
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-16 sm:ml-0">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Compliance</p>
                        <p className={`text-2xl font-bold ${visitCompliance >= 80 ? "text-emerald-600" : visitCompliance >= 50 ? "text-amber-600" : "text-red-600"}`}
                          data-testid={`text-compliance-rate-${visit.id}`}
                        >
                          {visitCompliance}%
                        </p>
                        <Progress value={visitCompliance} className="mt-1 h-1.5 w-24" />
                      </div>
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> {visitTaken} taken
                        </span>
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-3 w-3" /> {visitMissed} missed
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock className="h-3 w-3" /> {visitPending} pending
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  {medicines.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p>No medicines prescribed for this visit</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table data-testid={`table-adherence-${visit.id}`}>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px] sticky left-0 bg-background z-10">
                              <div className="flex items-center gap-2">
                                <Pill className="h-4 w-4" />
                                Medicine
                              </div>
                            </TableHead>
                            <TableHead className="text-center min-w-[80px]">Dose</TableHead>
                            <TableHead className="text-center min-w-[80px]">Frequency</TableHead>
                            {Array.from({ length: Math.max(...medicines.map((m) => getMedDuration(m))) }).map((_, dayIdx) => (
                              <TableHead
                                key={dayIdx}
                                className={`text-center min-w-[40px] ${dayIdx < daysPassed ? "bg-slate-50" : dayIdx === daysPassed ? "bg-blue-50 font-bold" : ""}`}
                              >
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(visitStart.getTime() + dayIdx * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                  </span>
                                  <span>D{dayIdx + 1}</span>
                                </div>
                              </TableHead>
                            ))}
                            <TableHead className="text-center min-w-[60px]">
                              <BarChart3 className="h-4 w-4 mx-auto" />
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {medicines.map((med) => {
                            const duration = getMedDuration(med);
                            const maxDays = Math.max(...medicines.map((m) => getMedDuration(m)));
                            let medTaken = 0, medTotal = 0;
                            for (let d = 0; d < duration; d++) {
                              medTotal++;
                              if (getStatusForCell(visit.id, med.id, d, daysPassed) === "taken") medTaken++;
                            }
                            const medPercent = medTotal > 0 ? Math.round((medTaken / medTotal) * 100) : 0;

                            return (
                              <TableRow key={med.id} data-testid={`row-medicine-${med.id}`}>
                                <TableCell className="font-medium sticky left-0 bg-background z-10">
                                  <div>
                                    <p className="font-semibold" data-testid={`text-medicine-name-${med.id}`}>{med.name}</p>
                                    {med.timing && <p className="text-xs text-muted-foreground">{med.timing}</p>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center text-sm text-muted-foreground">{med.dose || "-"}</TableCell>
                                <TableCell className="text-center text-sm text-muted-foreground">{med.frequency || "-"}</TableCell>
                                {Array.from({ length: maxDays }).map((_, dayIdx) => {
                                  if (dayIdx >= duration) {
                                    return <TableCell key={dayIdx} className="text-center bg-gray-50/50"><span className="text-gray-300">-</span></TableCell>;
                                  }
                                  const cellStatus = getStatusForCell(visit.id, med.id, dayIdx, daysPassed);
                                  return (
                                    <TableCell key={dayIdx} className={`text-center ${dayIdx === daysPassed ? "bg-blue-50/50" : ""}`}>
                                      <StatusButton
                                        currentStatus={cellStatus}
                                        onStatusChange={(ns) => handleStatusChange(visit, med, dayIdx, ns)}
                                        disabled={adherenceMutation.isPending}
                                      />
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={`text-sm font-bold ${medPercent >= 80 ? "text-emerald-600" : medPercent >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                      {medPercent}%
                                    </span>
                                    <Progress value={medPercent} className="h-1 w-12" />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground border-t border-white/20 pt-3">
                    <span className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-emerald-200 border border-emerald-300" /> Taken
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-red-200 border border-red-300" /> Missed
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-gray-200 border border-gray-300" /> Pending
                    </span>
                    <span className="ml-auto">Click to toggle status</span>
                  </div>
                </div>
              </div>
            );
          })}
          <Pagination
            currentPage={adherencePage}
            totalPages={Math.ceil((visitDetails || []).length / ROWS_PER_PAGE)}
            onPageChange={setAdherencePage}
          />
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
