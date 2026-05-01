import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff,
  Monitor, User, Users, MessageSquare, FileText,
  Pill, Clock, Plus, ArrowLeft, Activity,
  CalendarClock, Maximize2, Minimize2, Settings, Save, Check
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export default function Telehealth() {
  const [, setLocation] = useLocation();
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [consultationNotes, setConsultationNotes] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: visits, isLoading } = useQuery<any[]>({
    queryKey: ["/api/visits"],
  });

  const { data: visitDetail } = useQuery<any>({
    queryKey: [`/api/visits/${selectedVisitId}`],
    enabled: !!selectedVisitId,
  });

  const activeVisits = visits?.filter(
    (v) => v.status === "active" || v.status === "draft" || v.status === "recording"
  ) || [];

  const selectedVisit = visitDetail || activeVisits.find((v) => v.id === selectedVisitId);

  useEffect(() => {
    if (visitDetail) {
      const existingNotes = (visitDetail.aiDraftJson as any)?.consultation_notes || "";
      setConsultationNotes(existingNotes);
      setNotesSaved(false);
    }
  }, [visitDetail?.id]);

  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVisitId || !selectedVisit) return;
      const existingDraft = (selectedVisit.aiDraftJson as any) || {};
      const updated = { ...existingDraft, consultation_notes: consultationNotes };
      await apiRequest("PATCH", `/api/visits/${selectedVisitId}`, { aiDraftJson: updated });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/visits/${selectedVisitId}`] });
      setNotesSaved(true);
      toast({ title: "Notes saved", description: "Consultation notes have been saved successfully." });
      setTimeout(() => setNotesSaved(false), 2000);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save notes. Please try again.", variant: "destructive" });
    },
  });

  const handleStartCall = () => {
    setInCall(true);
    setIsMuted(false);
    setIsCameraOff(false);
  };

  const handleEndCall = () => {
    setInCall(false);
  };

  const handleSelectVisit = (visitId: string) => {
    setSelectedVisitId(visitId);
    setInCall(false);
    setConsultationNotes("");
    setNotesSaved(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-100 animate-pulse" />
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="lg:col-span-3 h-96 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telehealth"
        subtitle="Virtual consultation room"
        icon={Video}
        iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
        testId="text-telehealth-title"
        actions={
          <Button
            data-testid="button-new-telehealth-visit"
            onClick={() => setLocation("/new-visit")}
            className="bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:opacity-90 gap-2 text-white shadow-lg"
          >
            <Plus className="h-4 w-4" />
            New Visit
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Consultations
            </h2>
            <Badge variant="secondary" data-testid="badge-consultation-count">
              {activeVisits.length}
            </Badge>
          </div>

          {activeVisits.length === 0 ? (
            <div className="glass-card rounded-xl border-dashed p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active consultations</p>
              <Button
                variant="link"
                className="text-blue-600 mt-2"
                onClick={() => setLocation("/new-visit")}
                data-testid="button-start-first-visit"
              >
                Start a new visit
              </Button>
            </div>
          ) : (
            activeVisits.map((visit: any) => (
              <div
                key={visit.id}
                data-testid={`card-consultation-${visit.id}`}
                className={`glass-card rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedVisitId === visit.id
                    ? "ring-2 ring-blue-500 border-blue-200 bg-blue-50/50"
                    : "hover:border-blue-200"
                }`}
                onClick={() => handleSelectVisit(visit.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {visit.patient?.name?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate" data-testid={`text-patient-name-${visit.id}`}>
                      {visit.patient?.name || "Unknown"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {visit.patient?.age && (
                        <span className="text-xs text-muted-foreground">
                          {visit.patient.age} yrs
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          visit.status === "active"
                            ? "border-emerald-200 text-emerald-600 bg-emerald-50"
                            : visit.status === "draft"
                            ? "border-amber-200 text-amber-600 bg-amber-50"
                            : "border-orange-200 text-orange-600 bg-orange-50"
                        }`}
                      >
                        {visit.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-3">
          {!selectedVisit ? (
            <div className="glass-card-strong rounded-xl h-full min-h-[500px] flex items-center justify-center border-dashed">
              <div className="text-center py-16">
                <div className="h-20 w-20 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <Video className="h-10 w-10 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2" data-testid="text-select-prompt">
                  Select a Consultation
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Choose a patient from the list to start a virtual consultation or review their care plan.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {inCall ? (
                <VideoCallInterface
                  visit={selectedVisit}
                  isMuted={isMuted}
                  isCameraOff={isCameraOff}
                  isFullscreen={isFullscreen}
                  onToggleMute={() => setIsMuted(!isMuted)}
                  onToggleCamera={() => setIsCameraOff(!isCameraOff)}
                  onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                  onEndCall={handleEndCall}
                />
              ) : (
                <div className="glass-card-strong rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-xl font-bold">
                          {selectedVisit.patient?.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold" data-testid="text-selected-patient">
                            {selectedVisit.patient?.name || "Unknown Patient"}
                          </h2>
                          <div className="flex items-center gap-3 text-blue-100 text-sm mt-1">
                            {selectedVisit.patient?.age && (
                              <span>{selectedVisit.patient.age} years old</span>
                            )}
                            {selectedVisit.patient?.gender && (
                              <>
                                <span>•</span>
                                <span>{selectedVisit.patient.gender}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>
                              {selectedVisit.visitDate
                                ? new Date(selectedVisit.visitDate).toLocaleDateString()
                                : "Today"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        data-testid="button-start-video-call"
                        size="lg"
                        className="bg-white text-blue-700 hover:bg-blue-50 gap-2 shadow-lg"
                        onClick={handleStartCall}
                      >
                        <Video className="h-5 w-5" />
                        Start Video Call
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "200ms" }}>
                <div className="xl:col-span-2">
                  <Tabs defaultValue="notes" className="w-full">
                    <TabsList className="w-full justify-start h-11 bg-white/50 backdrop-blur-sm border p-1 gap-1">
                      <TabsTrigger
                        data-testid="tab-notes"
                        value="notes"
                        className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-full px-4"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Notes
                      </TabsTrigger>
                      <TabsTrigger
                        data-testid="tab-medicines"
                        value="medicines"
                        className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-full px-4"
                      >
                        <Pill className="h-4 w-4 mr-2" />
                        Medicines
                      </TabsTrigger>
                      <TabsTrigger
                        data-testid="tab-tests"
                        value="tests"
                        className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-full px-4"
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        Tests
                      </TabsTrigger>
                      <TabsTrigger
                        data-testid="tab-followups"
                        value="followups"
                        className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-full px-4"
                      >
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Follow-ups
                      </TabsTrigger>
                    </TabsList>

                    <div className="glass-card-strong rounded-xl mt-3">
                      <div className="p-5">
                        <TabsContent value="notes" className="mt-0">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            Consultation Notes
                          </h3>
                          <Textarea
                            data-testid="textarea-consultation-notes"
                            placeholder="Type your consultation notes here... Document symptoms, observations, and treatment decisions during the call."
                            className="min-h-[200px] resize-none text-sm leading-relaxed"
                            value={consultationNotes}
                            onChange={(e) => setConsultationNotes(e.target.value)}
                          />
                          <div className="flex justify-end mt-3">
                            <Button
                              data-testid="button-save-notes"
                              variant="outline"
                              size="sm"
                              className={`gap-2 ${notesSaved ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-blue-600 border-blue-200 hover:bg-blue-50"}`}
                              onClick={() => saveNotesMutation.mutate()}
                              disabled={saveNotesMutation.isPending || !consultationNotes.trim()}
                            >
                              {saveNotesMutation.isPending ? (
                                <span className="h-3.5 w-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              ) : notesSaved ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              {saveNotesMutation.isPending ? "Saving..." : notesSaved ? "Saved!" : "Save Notes"}
                            </Button>
                          </div>
                        </TabsContent>

                        <TabsContent value="medicines" className="mt-0">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Pill className="h-4 w-4 text-blue-600" />
                            Current Medicines
                          </h3>
                          {selectedVisit.medicines?.length > 0 ? (
                            <div className="space-y-2">
                              {selectedVisit.medicines.map((med: any) => (
                                <div
                                  key={med.id}
                                  data-testid={`card-medicine-${med.id}`}
                                  className="flex items-center justify-between p-3 bg-white/30 backdrop-blur-sm rounded-lg border border-white/40"
                                >
                                  <div>
                                    <p className="font-medium text-sm">{med.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {med.dose} • {med.frequency}
                                      {med.timing ? ` • ${med.timing}` : ""}
                                    </p>
                                  </div>
                                  {med.durationDays && (
                                    <Badge variant="outline" className="text-xs">
                                      {med.durationDays}d
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              No medicines prescribed yet.
                            </p>
                          )}
                        </TabsContent>

                        <TabsContent value="tests" className="mt-0">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-blue-600" />
                            Ordered Tests
                          </h3>
                          {selectedVisit.tests?.length > 0 ? (
                            <div className="space-y-2">
                              {selectedVisit.tests.map((test: any) => (
                                <div
                                  key={test.id}
                                  data-testid={`card-test-${test.id}`}
                                  className="flex items-center justify-between p-3 bg-white/30 backdrop-blur-sm rounded-lg border border-white/40"
                                >
                                  <div>
                                    <p className="font-medium text-sm">{test.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {test.whenToDo || "TBD"}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={test.urgency === "Routine" ? "secondary" : "default"}
                                    className="text-xs"
                                  >
                                    {test.urgency || "Standard"}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              No tests ordered.
                            </p>
                          )}
                        </TabsContent>

                        <TabsContent value="followups" className="mt-0">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-blue-600" />
                            Follow-up Schedule
                          </h3>
                          {selectedVisit.followups?.length > 0 ? (
                            <div className="space-y-2">
                              {selectedVisit.followups.map((fup: any) => (
                                <div
                                  key={fup.id}
                                  data-testid={`card-followup-${fup.id}`}
                                  className="flex items-center justify-between p-3 bg-white/30 backdrop-blur-sm rounded-lg border border-white/40"
                                >
                                  <div>
                                    <p className="font-medium text-sm">
                                      {(fup.followupAfterDays || fup.followUpAfterDays)
                                        ? `Follow-up in ${fup.followupAfterDays || fup.followUpAfterDays} days`
                                        : "Follow-up scheduled"}
                                    </p>
                                    {(fup.notes || fup.reason) && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {fup.notes || fup.reason}
                                      </p>
                                    )}
                                    {fup.warningSigns?.length > 0 && (
                                      <p className="text-xs text-orange-600 mt-0.5">
                                        Warning signs: {fup.warningSigns.join(", ")}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-xs border-blue-200 text-blue-600">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Pending
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              No follow-ups scheduled.
                            </p>
                          )}
                        </TabsContent>
                      </div>
                    </div>
                  </Tabs>
                </div>

                <div className="space-y-4">
                  <div className="glass-card-strong rounded-xl overflow-hidden">
                    <div className="p-4 pb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" />
                        Patient Info
                      </h3>
                    </div>
                    <div className="px-4 pb-4 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Full Name</p>
                        <p className="text-sm font-medium" data-testid="text-info-patient-name">
                          {selectedVisit.patient?.name || "Unknown"}
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground">Age</p>
                        <p className="text-sm font-medium" data-testid="text-info-patient-age">
                          {selectedVisit.patient?.age ? `${selectedVisit.patient.age} years` : "N/A"}
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground">Gender</p>
                        <p className="text-sm font-medium">
                          {selectedVisit.patient?.gender || "N/A"}
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground">Visit Date</p>
                        <p className="text-sm font-medium">
                          {selectedVisit.visitDate
                            ? new Date(selectedVisit.visitDate).toLocaleDateString()
                            : "Today"}
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge
                          variant="outline"
                          className={`mt-1 ${
                            selectedVisit.status === "active"
                              ? "border-emerald-200 text-emerald-600 bg-emerald-50"
                              : selectedVisit.status === "draft"
                              ? "border-amber-200 text-amber-600 bg-amber-50"
                              : "border-orange-200 text-orange-600 bg-orange-50"
                          }`}
                          data-testid="badge-visit-status"
                        >
                          {selectedVisit.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card-strong rounded-xl overflow-hidden">
                    <div className="p-4 pb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Quick Summary
                      </h3>
                    </div>
                    <div className="px-4 pb-4">
                      <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-quick-summary">
                        {(selectedVisit.aiDraftJson as any)?.summary ||
                          (selectedVisit.aiDraftJson as any)?.patient_summary ||
                          "No summary available yet. Start a consultation to generate an AI-powered summary."}
                      </p>
                    </div>
                  </div>

                  <Button
                    data-testid="button-view-full-visit"
                    variant="outline"
                    className="w-full gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => setLocation(`/visit/${selectedVisit.id}`)}
                  >
                    <FileText className="h-4 w-4" />
                    View Full Visit
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VideoCallInterface({
  visit,
  isMuted,
  isCameraOff,
  isFullscreen,
  onToggleMute,
  onToggleCamera,
  onToggleFullscreen,
  onEndCall,
}: {
  visit: any;
  isMuted: boolean;
  isCameraOff: boolean;
  isFullscreen: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleFullscreen: () => void;
  onEndCall: () => void;
}) {
  return (
    <div className="glass-card-strong rounded-xl overflow-hidden" data-testid="card-video-call">
      <div className={`relative ${isFullscreen ? "h-[600px]" : "h-[400px]"} bg-gray-900 transition-all`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
          <div className="text-center">
            <div className="h-24 w-24 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
              <User className="h-12 w-12 text-white/60" />
            </div>
            <p className="text-white/80 font-medium text-lg" data-testid="text-call-patient-name">
              {visit.patient?.name || "Patient"}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <p className="text-green-400 text-sm">Connected</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 w-36 h-24 rounded-lg overflow-hidden border-2 border-white/30 shadow-xl">
          <div className={`w-full h-full flex items-center justify-center ${
            isCameraOff
              ? "bg-gray-800"
              : "bg-gradient-to-br from-slate-700 to-slate-900"
          }`}>
            {isCameraOff ? (
              <VideoOff className="h-6 w-6 text-white/40" />
            ) : (
              <div className="text-center">
                <div className="h-10 w-10 rounded-full bg-blue-500/30 flex items-center justify-center mx-auto">
                  <User className="h-5 w-5 text-white/70" />
                </div>
                <p className="text-white/50 text-[10px] mt-1">You</p>
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-4 left-4 flex items-center gap-2">
          <Badge className="bg-red-500/90 text-white border-0 gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            LIVE
          </Badge>
          <Badge className="bg-black/40 text-white border-0 backdrop-blur-sm">
            <Monitor className="h-3 w-3 mr-1" />
            HD
          </Badge>
        </div>

        {isMuted && (
          <div className="absolute top-4 right-4">
            <Badge className="bg-red-500/90 text-white border-0 gap-1">
              <MicOff className="h-3 w-3" />
              Muted
            </Badge>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
          <div className="flex items-center justify-center gap-3">
            <Button
              data-testid="button-toggle-mute"
              size="lg"
              variant="secondary"
              className={`rounded-full h-12 w-12 p-0 ${
                isMuted
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
              }`}
              onClick={onToggleMute}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              data-testid="button-toggle-camera"
              size="lg"
              variant="secondary"
              className={`rounded-full h-12 w-12 p-0 ${
                isCameraOff
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
              }`}
              onClick={onToggleCamera}
            >
              {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>

            <Button
              data-testid="button-toggle-fullscreen"
              size="lg"
              variant="secondary"
              className="rounded-full h-12 w-12 p-0 bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>

            <Button
              data-testid="button-end-call"
              size="lg"
              className="rounded-full h-12 px-6 bg-red-600 hover:bg-red-700 text-white gap-2"
              onClick={onEndCall}
            >
              <PhoneOff className="h-5 w-5" />
              End Call
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
