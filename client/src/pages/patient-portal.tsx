import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Users,
  User,
  Calendar,
  Pill,
  FileText,
  ArrowLeft,
  Activity,
  Heart,
  ClipboardList,
  AlertCircle,
  Clock,
  Stethoscope,
  HeartPulse,
  FlaskConical,
  CalendarCheck,
  Pencil,
  MessageCircle,
  X,
  Save,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Pagination } from "@/components/pagination";
import type { Patient, Visit, Medicine, Test, Followup, CareEvent } from "@shared/schema";

const ROWS_PER_PAGE = 10;

interface PortalVisit extends Visit {
  medicines: Medicine[];
  tests: Test[];
  followups: Followup[];
  careEvents: CareEvent[];
}

interface PortalData {
  patient: Patient;
  visits: PortalVisit[];
}

interface PatientWithVisitCount extends Patient {
  visitCount?: number;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft: "bg-violet-50 text-violet-600 border-violet-200",
  recording: "bg-orange-50 text-orange-600 border-orange-200",
  completed: "bg-sky-100 text-sky-700 border-sky-200",
};

function PatientList({
  patients,
  isLoading,
  onSelect,
}: {
  patients: PatientWithVisitCount[] | undefined;
  isLoading: boolean;
  onSelect: (id: string) => void;
}) {
  const [patientPage, setPatientPage] = useState(1);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-card rounded-xl p-6 overflow-hidden">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!patients || patients.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-up">
        <div className="h-20 w-20 rounded-2xl bg-cyan-50 flex items-center justify-center mx-auto mb-4">
          <Users className="h-10 w-10 text-cyan-400" />
        </div>
        <p className="text-xl font-bold text-foreground" data-testid="text-no-patients">No patients found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Patient records will appear here after visits are created.
        </p>
      </div>
    );
  }

  const pagedPatients = patients.slice((patientPage - 1) * ROWS_PER_PAGE, patientPage * ROWS_PER_PAGE);

  return (
    <div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {pagedPatients.map((patient, index) => (
        <div
          key={patient.id}
          data-testid={`card-patient-${patient.id}`}
          className="glass-card rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all duration-300 hover:border-cyan-200 hover:-translate-y-1 group overflow-hidden animate-fade-up"
          style={{ animationDelay: `${index * 60}ms` }}
          onClick={() => onSelect(patient.id)}
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-200/50 flex items-center justify-center text-cyan-700 font-bold text-lg group-hover:scale-110 transition-transform duration-300">
              {patient.name?.charAt(0) || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate group-hover:text-cyan-700 transition-colors" data-testid={`text-patient-name-${patient.id}`}>
                {patient.name}
              </p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {patient.age} yrs{patient.gender ? `, ${patient.gender}` : ""}
                </span>
              </div>
              {patient.whatsappNumber && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {patient.whatsappNumber}
                </span>
              </div>
              )}
            </div>
          </div>
          {patient.knownConditions && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-xs text-muted-foreground truncate">
                <span className="font-medium">Conditions:</span> {patient.knownConditions}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
    <Pagination
      currentPage={patientPage}
      totalPages={Math.ceil(patients.length / ROWS_PER_PAGE)}
      onPageChange={setPatientPage}
    />
    </div>
  );
}

function PatientDetail({
  patientId,
  onBack,
}: {
  patientId: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    age: "",
    gender: "",
    whatsappNumber: "",
    knownConditions: "",
    allergies: "",
  });

  const { data: portal, isLoading } = useQuery<PortalData>({
    queryKey: ["/api/patients", patientId, "portal"],
    enabled: !!patientId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await apiRequest("PATCH", `/api/patients/${patientId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "portal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      setShowEditModal(false);
      toast({ title: "Patient Updated", description: "Patient information has been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openEditModal = () => {
    if (portal?.patient) {
      const p = portal.patient;
      setEditForm({
        name: p.name || "",
        age: String(p.age || ""),
        gender: p.gender || "",
        whatsappNumber: (p as any).whatsappNumber || "",
        knownConditions: p.knownConditions || "",
        allergies: p.allergies || "",
      });
      setShowEditModal(true);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="glass-card-strong rounded-xl p-6 space-y-4">
          <Skeleton className="h-6 w-64" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="text-center py-16">
        <p className="text-xl font-bold">Patient not found</p>
        <Button onClick={onBack} className="mt-4" data-testid="button-back-not-found">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Patients
        </Button>
      </div>
    );
  }

  const { patient, visits } = portal;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={onBack}
        data-testid="button-back-to-list"
        className="hover:bg-cyan-50 -ml-2 animate-fade-up"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Patients
      </Button>

      <div className="glass-card-strong rounded-xl overflow-hidden animate-fade-up" data-testid="card-patient-info">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-200/50 flex items-center justify-center text-cyan-700 font-bold text-2xl">
              {patient.name?.charAt(0) || "?"}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold" data-testid="text-portal-patient-name">
                {patient.name}
              </h2>
              <p className="text-muted-foreground mt-1">
                Patient since {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={openEditModal} className="gap-2" data-testid="button-update-patient">
              <Pencil className="h-4 w-4" />
              Update
            </Button>
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Age / Gender</p>
                <p className="text-sm font-medium" data-testid="text-patient-age-gender">
                  {patient.age} yrs{patient.gender ? ` / ${patient.gender}` : ""}
                </p>
              </div>
            </div>
            {patient.whatsappNumber && (
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="text-sm font-medium" data-testid="text-patient-whatsapp">{patient.whatsappNumber}</p>
              </div>
            </div>
            )}
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Known Conditions</p>
                <p className="text-sm font-medium" data-testid="text-patient-conditions">
                  {patient.knownConditions || "None"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Allergies</p>
                <p className="text-sm font-medium" data-testid="text-patient-allergies">
                  {patient.allergies || "None"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">Visit History</h2>
          <Badge variant="secondary" data-testid="badge-visit-count">
            {visits.length} visit{visits.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {visits.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <Stethoscope className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No visits recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visits.map((visit, index) => {
              const draft = visit.aiDraftJson as Record<string, any> | null;
              return (
                <div key={visit.id} data-testid={`card-visit-${visit.id}`} className="glass-card rounded-xl overflow-hidden animate-fade-up" style={{ animationDelay: `${(index + 1) * 80}ms` }}>
                  <div className="p-6 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-400/20 to-purple-500/20 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold" data-testid={`text-visit-date-${visit.id}`}>
                            Visit on {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : "N/A"}
                          </h3>
                          {draft?.complaint && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              Complaint: {draft.complaint}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[visit.status] || "bg-slate-100 text-slate-700"} data-testid={`badge-visit-status-${visit.id}`}>
                          {visit.status}
                        </Badge>
                        {visit.approved && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" data-testid={`badge-approved-${visit.id}`}>
                            Approved
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-6 pb-6">
                    <Tabs defaultValue="summary" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto" data-testid={`tabs-visit-${visit.id}`}>
                        <TabsTrigger value="summary" className="text-xs sm:text-sm" data-testid={`tab-summary-${visit.id}`}>
                          <FileText className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                          Summary
                        </TabsTrigger>
                        <TabsTrigger value="medicines" className="text-xs sm:text-sm" data-testid={`tab-medicines-${visit.id}`}>
                          <Pill className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                          Medicines
                        </TabsTrigger>
                        <TabsTrigger value="tests" className="text-xs sm:text-sm" data-testid={`tab-tests-${visit.id}`}>
                          <FlaskConical className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                          Tests
                        </TabsTrigger>
                        <TabsTrigger value="followup" className="text-xs sm:text-sm" data-testid={`tab-followup-${visit.id}`}>
                          <CalendarCheck className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                          Follow-up
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="summary" className="mt-4">
                        <div className="space-y-3">
                          {draft?.diagnosis_impression && (
                            <div className="p-3 rounded-lg bg-violet-50/50 border border-violet-100">
                              <p className="text-xs font-medium text-violet-600 mb-1">Provisional Diagnosis</p>
                              <p className="text-sm" data-testid={`text-diagnosis-${visit.id}`}>{draft.diagnosis_impression}</p>
                            </div>
                          )}
                          {draft?.patient_summary && (
                            <div className="p-3 rounded-lg bg-cyan-50/50 border border-cyan-100">
                              <p className="text-xs font-medium text-cyan-600 mb-1">Patient Summary</p>
                              <p className="text-sm" data-testid={`text-summary-${visit.id}`}>{draft.patient_summary}</p>
                            </div>
                          )}
                          {!draft?.diagnosis_impression && !draft?.patient_summary && (
                            <p className="text-sm text-muted-foreground text-center py-4">No AI summary available.</p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="medicines" className="mt-4">
                        {visit.medicines.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Medicine</TableHead>
                                <TableHead>Dose</TableHead>
                                <TableHead>Frequency</TableHead>
                                <TableHead>Timing</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Instructions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visit.medicines.map((med) => (
                                <TableRow key={med.id} data-testid={`row-medicine-${med.id}`}>
                                  <TableCell className="font-medium">{med.name}</TableCell>
                                  <TableCell>{med.dose || "—"}</TableCell>
                                  <TableCell>{med.frequency || "—"}</TableCell>
                                  <TableCell>{med.timing || "—"}</TableCell>
                                  <TableCell>{med.durationDays ? `${med.durationDays} days` : "—"}</TableCell>
                                  <TableCell className="text-muted-foreground">{med.instructions || "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">No medicines prescribed.</p>
                        )}
                      </TabsContent>

                      <TabsContent value="tests" className="mt-4">
                        {visit.tests.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Test</TableHead>
                                <TableHead>When</TableHead>
                                <TableHead>Urgency</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visit.tests.map((test) => (
                                <TableRow key={test.id} data-testid={`row-test-${test.id}`}>
                                  <TableCell className="font-medium">{test.name}</TableCell>
                                  <TableCell>{test.whenToDo || "—"}</TableCell>
                                  <TableCell>
                                    {test.urgency ? (
                                      <Badge
                                        variant={test.urgency === "urgent" ? "destructive" : "secondary"}
                                        data-testid={`badge-urgency-${test.id}`}
                                      >
                                        {test.urgency}
                                      </Badge>
                                    ) : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">No tests ordered.</p>
                        )}
                      </TabsContent>

                      <TabsContent value="followup" className="mt-4">
                        {visit.followups.length > 0 ? (
                          <div className="space-y-3">
                            {visit.followups.map((fu) => (
                              <div key={fu.id} className="p-3 rounded-lg bg-amber-50/50 border border-amber-100" data-testid={`card-followup-${fu.id}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="h-4 w-4 text-amber-600" />
                                  <span className="text-sm font-medium">
                                    Follow-up in {fu.followupAfterDays} day{fu.followupAfterDays !== 1 ? "s" : ""}
                                  </span>
                                </div>
                                {fu.notes && (
                                  <p className="text-sm text-muted-foreground mb-2">{fu.notes}</p>
                                )}
                                {fu.warningSigns && fu.warningSigns.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-medium text-rose-600 mb-1 flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      Warning Signs
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {fu.warningSigns.map((sign, i) => (
                                        <Badge key={i} variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-xs">
                                          {sign}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">No follow-up scheduled.</p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="glass-card-strong rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="modal-edit-patient">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Pencil className="h-5 w-5 text-cyan-600" />
                Update Patient Info
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowEditModal(false)} data-testid="button-close-edit-modal">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input data-testid="edit-patient-name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-11 mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Age</Label>
                  <Input data-testid="edit-patient-age" type="number" value={editForm.age} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))} className="h-11 mt-1" />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={editForm.gender} onValueChange={v => setEditForm(f => ({ ...f, gender: v }))}>
                    <SelectTrigger className="h-11 mt-1" data-testid="edit-patient-gender">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>WhatsApp Number</Label>
                <div className="relative mt-1">
                  <MessageCircle className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input data-testid="edit-patient-whatsapp" value={editForm.whatsappNumber} onChange={e => setEditForm(f => ({ ...f, whatsappNumber: e.target.value }))} className="pl-10 h-11" placeholder="Optional" />
                </div>
              </div>
              <div>
                <Label>Known Conditions</Label>
                <Input data-testid="edit-patient-conditions" value={editForm.knownConditions} onChange={e => setEditForm(f => ({ ...f, knownConditions: e.target.value }))} className="h-11 mt-1" placeholder="e.g. Diabetes, Hypertension" />
              </div>
              <div>
                <Label>Allergies</Label>
                <Input data-testid="edit-patient-allergies" value={editForm.allergies} onChange={e => setEditForm(f => ({ ...f, allergies: e.target.value }))} className="h-11 mt-1" placeholder="e.g. Penicillin, Sulfa drugs" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditModal(false)} data-testid="button-cancel-edit">Cancel</Button>
                <Button className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 gap-2" onClick={() => updateMutation.mutate(editForm)} disabled={updateMutation.isPending} data-testid="button-save-patient">
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PatientPortal() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: patients, isLoading } = useQuery<PatientWithVisitCount[]>({
    queryKey: ["/api/patients"],
  });

  const filteredPatients = patients?.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.whatsappNumber && p.whatsappNumber.includes(q)) ||
      (p.phone && p.phone.includes(q)) ||
      (p.knownConditions && p.knownConditions.toLowerCase().includes(q)) ||
      (p.gender && p.gender.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {!selectedPatientId ? (
        <>
          <PageHeader
            title="Patient Portal"
            subtitle="View all patients and their visit history"
            icon={Users}
            iconBg="bg-gradient-to-br from-cyan-500 to-blue-600"
            testId="text-patient-portal-title"
            actions={
              patients && patients.length > 0 ? (
                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 border-cyan-200" data-testid="badge-total-patients">
                  {patients.length} patient{patients.length !== 1 ? "s" : ""}
                </Badge>
              ) : undefined
            }
          />

          <div className="relative max-w-md" data-testid="search-patient-portal">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, condition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/80 border-blue-200/50 focus:border-cyan-400 focus:ring-cyan-400/20 rounded-xl"
              data-testid="input-search-patients"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <PatientList
            patients={filteredPatients}
            isLoading={isLoading}
            onSelect={(id) => setSelectedPatientId(id)}
          />
        </>
      ) : (
        <PatientDetail
          patientId={selectedPatientId}
          onBack={() => setSelectedPatientId(null)}
        />
      )}
    </div>
  );
}
