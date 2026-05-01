import { useState, useRef, useCallback, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  User, Phone, Calendar, UserPlus, Search, ChevronRight,
  Stethoscope, CheckCircle2, Heart, Shield, Activity,
  ArrowLeft, Loader2, Mic, MicOff, Sparkles, PenLine, Globe, ChevronDown, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type QrLang, QR_LANGUAGES, getQrTranslation } from "@/lib/qr-translations";

type Step = "choose" | "new-method" | "new-patient" | "voice-recording" | "voice-preview" | "existing-patient" | "medical-history" | "success";

export default function QrCheckin() {
  const [, params] = useRoute("/qr/:doctorId");
  const doctorId = params?.doctorId || "";
  const { toast } = useToast();

  const [lang, setLang] = useState<QrLang>("English");
  const [langOpen, setLangOpen] = useState(false);
  const t = getQrTranslation(lang);

  const [step, setStep] = useState<Step>("choose");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", age: "", gender: "", mobile: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  const [historyForm, setHistoryForm] = useState({
    knownConditions: "", allergies: "", pastIllnesses: "", chronicDiseases: "",
    currentMedications: "", familyHistory: "", lifestyleHabits: "", previousSurgeries: "",
    pregnancyStatus: "", bloodGroup: "", weight: "", height: "",
  });
  const [historyTab, setHistoryTab] = useState("medical");

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const { data: doctor, isLoading: doctorLoading, error: doctorError } = useQuery({
    queryKey: ["/api/qr/doctor", doctorId],
    queryFn: async () => {
      const res = await fetch(`/api/qr/doctor/${doctorId}`);
      if (!res.ok) throw new Error("Doctor not found");
      return res.json();
    },
    enabled: !!doctorId,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["/api/qr/patients", doctorId, searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/qr/patients/${doctorId}?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: !!doctorId && searchQuery.length >= 2,
  });

  const addToQueueMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/qr/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to register");
      return res.json();
    },
    onSuccess: async (result) => {
      setPatientId(result.patientId);
      const hasVoiceHistory = Object.values(historyForm).some(v => v && v.trim());
      if (hasVoiceHistory) {
        try {
          const hRes = await fetch(`/api/qr/patients/${result.patientId}/history`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(historyForm),
          });
          if (!hRes.ok) throw new Error("Failed to save history");
          setStep("success");
        } catch {
          setStep("medical-history");
        }
      } else {
        setStep("medical-history");
      }
    },
    onError: () => {
      toast({ title: t.errorTitle, description: t.couldNotRegister, variant: "destructive" });
    },
  });

  const saveHistoryMutation = useMutation({
    mutationFn: async () => {
      const pid = patientId || selectedPatient?.id;
      if (!pid) return;
      const res = await fetch(`/api/qr/patients/${pid}/history`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(historyForm),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      setStep("success");
    },
    onError: () => {
      toast({ title: t.errorTitle, description: t.failedSaveHistory, variant: "destructive" });
    },
  });

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      toast({ title: t.micError, description: t.micErrorDesc, variant: "destructive" });
    }
  }, [toast, t]);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessingVoice(true);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          try {
            const res = await fetch("/api/qr/voice-extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64, language: lang }),
            });
            if (!res.ok) throw new Error("Failed");
            const result = await res.json();
            setVoiceTranscript(result.transcript || "");
            const d = result.data;
            setForm({
              name: d.name || form.name,
              age: d.age || form.age,
              gender: d.gender || form.gender,
              mobile: d.mobile || form.mobile,
            });
            setHistoryForm({
              knownConditions: d.knownConditions || historyForm.knownConditions,
              allergies: d.allergies || historyForm.allergies,
              pastIllnesses: d.pastIllnesses || historyForm.pastIllnesses,
              chronicDiseases: d.chronicDiseases || historyForm.chronicDiseases,
              currentMedications: d.currentMedications || historyForm.currentMedications,
              familyHistory: d.familyHistory || historyForm.familyHistory,
              lifestyleHabits: d.lifestyleHabits || historyForm.lifestyleHabits,
              previousSurgeries: d.previousSurgeries || historyForm.previousSurgeries,
              pregnancyStatus: d.pregnancyStatus || historyForm.pregnancyStatus,
              bloodGroup: d.bloodGroup || historyForm.bloodGroup,
              weight: d.weight || historyForm.weight,
              height: d.height || historyForm.height,
            });
            setStep("voice-preview");
          } catch {
            toast({ title: t.errorTitle, description: t.couldNotProcessVoice, variant: "destructive" });
            setStep("new-method");
          } finally {
            setIsProcessingVoice(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        resolve();
      };
      recorder.stop();
    });
  }, [form, historyForm, toast, t, lang]);

  const handleVoiceInForm = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      toast({ title: t.recordingToast, description: t.recordingToastDesc });
    } catch {
      toast({ title: t.micError, description: t.micErrorDesc, variant: "destructive" });
    }
  }, [toast, t, lang]);

  const stopVoiceInForm = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessingVoice(true);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          try {
            const res = await fetch("/api/qr/voice-extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64, language: lang }),
            });
            if (!res.ok) throw new Error("Failed");
            const result = await res.json();
            const d = result.data;
            if (d.name) setForm(prev => ({ ...prev, name: d.name }));
            if (d.age) setForm(prev => ({ ...prev, age: d.age }));
            if (d.gender) setForm(prev => ({ ...prev, gender: d.gender }));
            if (d.mobile) setForm(prev => ({ ...prev, mobile: d.mobile }));
            if (d.knownConditions) setHistoryForm(prev => ({ ...prev, knownConditions: d.knownConditions }));
            if (d.allergies) setHistoryForm(prev => ({ ...prev, allergies: d.allergies }));
            if (d.pastIllnesses) setHistoryForm(prev => ({ ...prev, pastIllnesses: d.pastIllnesses }));
            if (d.chronicDiseases) setHistoryForm(prev => ({ ...prev, chronicDiseases: d.chronicDiseases }));
            if (d.currentMedications) setHistoryForm(prev => ({ ...prev, currentMedications: d.currentMedications }));
            if (d.familyHistory) setHistoryForm(prev => ({ ...prev, familyHistory: d.familyHistory }));
            if (d.lifestyleHabits) setHistoryForm(prev => ({ ...prev, lifestyleHabits: d.lifestyleHabits }));
            if (d.previousSurgeries) setHistoryForm(prev => ({ ...prev, previousSurgeries: d.previousSurgeries }));
            if (d.pregnancyStatus) setHistoryForm(prev => ({ ...prev, pregnancyStatus: d.pregnancyStatus }));
            if (d.bloodGroup) setHistoryForm(prev => ({ ...prev, bloodGroup: d.bloodGroup }));
            if (d.weight) setHistoryForm(prev => ({ ...prev, weight: d.weight }));
            if (d.height) setHistoryForm(prev => ({ ...prev, height: d.height }));
            toast({ title: t.voiceProcessed, description: t.voiceProcessedDesc });
          } catch {
            toast({ title: t.errorTitle, description: t.couldNotProcessVoice, variant: "destructive" });
          } finally {
            setIsProcessingVoice(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        resolve();
      };
      recorder.stop();
    });
  }, [toast, t, lang]);

  const handleNewPatientSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: t.nameRequired, description: t.nameRequiredDesc, variant: "destructive" });
      return;
    }
    addToQueueMutation.mutate({
      doctorId,
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      age: form.age,
      gender: form.gender,
      ...historyForm,
    });
  };

  const handleExistingPatientSelect = (patient: any) => {
    setSelectedPatient(patient);
    setHistoryForm({
      knownConditions: patient.knownConditions || "",
      allergies: patient.allergies || "",
      pastIllnesses: patient.pastIllnesses || "",
      chronicDiseases: patient.chronicDiseases || "",
      currentMedications: patient.currentMedications || "",
      familyHistory: patient.familyHistory || "",
      lifestyleHabits: patient.lifestyleHabits || "",
      previousSurgeries: patient.previousSurgeries || "",
      pregnancyStatus: patient.pregnancyStatus || "",
      bloodGroup: patient.bloodGroup || "",
      weight: patient.weight || "",
      height: patient.height || "",
    });
    addToQueueMutation.mutate({
      doctorId,
      name: patient.name,
      mobile: patient.phone || "",
      age: patient.age?.toString() || "",
      gender: patient.gender || "",
      patientId: patient.id,
    });
  };

  if (doctorLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-muted-foreground">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (doctorError || !doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 p-4">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-red-700">{t.invalidQr}</h1>
          <p className="text-muted-foreground mt-2">{t.invalidQrDesc}</p>
        </div>
      </div>
    );
  }

  const renderMissingFields = () => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push(t.fullName);
    if (!form.age) missing.push(t.age);
    if (!form.gender) missing.push(t.gender);
    if (!form.mobile) missing.push(t.mobileNumber);
    if (missing.length === 0) return null;
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
        <p className="font-medium">{t.pleaseComplete} {missing.join(", ")}</p>
      </div>
    );
  };

  const selectedLangNative = QR_LANGUAGES.find(l => l.code === lang)?.native || "English";

  const LanguageSelector = () => (
    <div className="relative" data-testid="language-selector">
      <button
        onClick={() => setLangOpen(!langOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 bg-white hover:bg-blue-50 transition-colors text-sm text-blue-700"
        data-testid="button-language-toggle"
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="font-medium">{selectedLangNative}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${langOpen ? "rotate-180" : ""}`} />
      </button>
      {langOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setLangOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-xl border border-blue-100 py-1 w-52 max-h-72 overflow-y-auto">
            {QR_LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setLangOpen(false); }}
                data-testid={`button-lang-${l.code}`}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between transition-colors ${lang === l.code ? "text-blue-600 font-semibold bg-blue-50/50" : "text-foreground"}`}
              >
                <span>{l.code === l.native ? l.code : `${l.code}`}</span>
                <span className="text-muted-foreground text-xs">{l.native !== l.code ? l.native : ""}</span>
                {lang === l.code && <CheckCircle2 className="h-4 w-4 text-blue-600 ml-1 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const medicalHistoryTabs = (
    <Tabs value={historyTab} onValueChange={setHistoryTab}>
      <TabsList className="w-full justify-start border-b rounded-none bg-muted/30 px-2 pt-2">
        <TabsTrigger value="medical" className="text-xs">{t.medical}</TabsTrigger>
        <TabsTrigger value="lifestyle" className="text-xs">{t.lifestyle}</TabsTrigger>
        <TabsTrigger value="vitals" className="text-xs">{t.vitals}</TabsTrigger>
      </TabsList>

      <TabsContent value="medical" className="p-4 space-y-3">
        <div><Label>{t.knownConditions}</Label><Input className="mt-1" placeholder={t.knownConditionsPlaceholder} value={historyForm.knownConditions} onChange={e => setHistoryForm({ ...historyForm, knownConditions: e.target.value })} data-testid="input-known-conditions" /></div>
        <div><Label>{t.allergies}</Label><Input className="mt-1" placeholder={t.allergiesPlaceholder} value={historyForm.allergies} onChange={e => setHistoryForm({ ...historyForm, allergies: e.target.value })} data-testid="input-allergies" /></div>
        <div><Label>{t.pastIllnesses}</Label><Input className="mt-1" placeholder={t.pastIllnessesPlaceholder} value={historyForm.pastIllnesses} onChange={e => setHistoryForm({ ...historyForm, pastIllnesses: e.target.value })} data-testid="input-past-illnesses" /></div>
        <div><Label>{t.chronicDiseases}</Label><Input className="mt-1" placeholder={t.chronicDiseasesPlaceholder} value={historyForm.chronicDiseases} onChange={e => setHistoryForm({ ...historyForm, chronicDiseases: e.target.value })} data-testid="input-chronic-diseases" /></div>
        <div><Label>{t.currentMedications}</Label><Input className="mt-1" placeholder={t.currentMedicationsPlaceholder} value={historyForm.currentMedications} onChange={e => setHistoryForm({ ...historyForm, currentMedications: e.target.value })} data-testid="input-current-medications" /></div>
        <div><Label>{t.previousSurgeries}</Label><Input className="mt-1" placeholder={t.previousSurgeriesPlaceholder} value={historyForm.previousSurgeries} onChange={e => setHistoryForm({ ...historyForm, previousSurgeries: e.target.value })} data-testid="input-previous-surgeries" /></div>
      </TabsContent>

      <TabsContent value="lifestyle" className="p-4 space-y-3">
        <div><Label>{t.familyHistory}</Label><Input className="mt-1" placeholder={t.familyHistoryPlaceholder} value={historyForm.familyHistory} onChange={e => setHistoryForm({ ...historyForm, familyHistory: e.target.value })} data-testid="input-family-history" /></div>
        <div><Label>{t.lifestyleHabits}</Label><Input className="mt-1" placeholder={t.lifestyleHabitsPlaceholder} value={historyForm.lifestyleHabits} onChange={e => setHistoryForm({ ...historyForm, lifestyleHabits: e.target.value })} data-testid="input-lifestyle-habits" /></div>
        <div><Label>{t.pregnancyStatus}</Label><Input className="mt-1" placeholder={t.pregnancyStatusPlaceholder} value={historyForm.pregnancyStatus} onChange={e => setHistoryForm({ ...historyForm, pregnancyStatus: e.target.value })} data-testid="input-pregnancy-status" /></div>
      </TabsContent>

      <TabsContent value="vitals" className="p-4 space-y-3">
        <div><Label>{t.bloodGroup}</Label>
          <Select value={historyForm.bloodGroup} onValueChange={v => setHistoryForm({ ...historyForm, bloodGroup: v })}>
            <SelectTrigger className="mt-1" data-testid="select-blood-group"><SelectValue placeholder={t.selectBloodGroup} /></SelectTrigger>
            <SelectContent>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{t.weight}</Label><Input className="mt-1" inputMode="numeric" pattern="[0-9]*" placeholder="e.g., 70" value={historyForm.weight} onChange={e => setHistoryForm({ ...historyForm, weight: e.target.value.replace(/[^0-9]/g, "") })} onKeyDown={e => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","Tab","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault(); }} data-testid="input-weight" /></div>
          <div><Label>{t.height}</Label><Input className="mt-1" inputMode="numeric" pattern="[0-9]*" placeholder="e.g., 170" value={historyForm.height} onChange={e => setHistoryForm({ ...historyForm, height: e.target.value.replace(/[^0-9]/g, "") })} onKeyDown={e => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","Tab","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault(); }} data-testid="input-height" /></div>
        </div>
      </TabsContent>
    </Tabs>
  );

  const VoiceInlineButton = ({ testId }: { testId: string }) => (
    isRecording ? (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
        onClick={stopVoiceInForm}
        disabled={isProcessingVoice}
        data-testid={`button-stop-${testId}`}
      >
        {isProcessingVoice ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MicOff className="h-3 w-3 mr-1" />}
        {isProcessingVoice ? t.processing : t.stop}
      </Button>
    ) : (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-violet-200 text-violet-600 hover:bg-violet-50"
        onClick={handleVoiceInForm}
        disabled={isProcessingVoice}
        data-testid={`button-voice-${testId}`}
      >
        <Mic className="h-3 w-3 mr-1" /> {t.fillWithVoice}
      </Button>
    )
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-blue-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-blue-900">CarePath AI</p>
            <p className="text-xs text-muted-foreground truncate">{doctor.name} {doctor.specialization ? `· ${doctor.specialization}` : ""}</p>
          </div>
          <LanguageSelector />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {step === "choose" && (
          <div className="space-y-6 animate-fade-up" data-testid="qr-choose-step">
            <div className="text-center mb-8">
              {doctor.profilePhoto ? (
                <img src={doctor.profilePhoto} alt={doctor.name} className="h-20 w-20 rounded-full mx-auto mb-3 object-cover border-4 border-blue-100" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mx-auto mb-3">
                  <Stethoscope className="h-10 w-10 text-white" />
                </div>
              )}
              <h1 className="text-xl font-bold text-foreground" data-testid="text-doctor-name">{doctor.name}</h1>
              {doctor.clinicName && <p className="text-sm text-muted-foreground">{doctor.clinicName}</p>}
              {doctor.specialization && <p className="text-xs text-blue-600 font-medium mt-1">{doctor.specialization}</p>}
            </div>

            <p className="text-center text-sm text-muted-foreground">{t.selectOption}</p>

            <button
              onClick={() => setStep("new-method")}
              data-testid="button-new-patient"
              className="w-full bg-white rounded-2xl p-6 border border-blue-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex items-center gap-4"
            >
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                <UserPlus className="h-7 w-7 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">{t.newPatient}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.newPatientDesc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
            </button>

            <button
              onClick={() => setStep("existing-patient")}
              data-testid="button-existing-patient"
              className="w-full bg-white rounded-2xl p-6 border border-blue-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex items-center gap-4"
            >
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center flex-shrink-0">
                <Search className="h-7 w-7 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">{t.existingPatient}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.existingPatientDesc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
            </button>
          </div>
        )}

        {step === "new-method" && (
          <div className="space-y-5 animate-fade-up" data-testid="qr-new-method-step">
            <button onClick={() => setStep("choose")} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800" data-testid="button-back-method">
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold">{t.howRegister}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t.chooseMethod}</p>
            </div>

            <button
              onClick={() => { setStep("voice-recording"); }}
              data-testid="button-voice-mode"
              className="w-full bg-gradient-to-r from-violet-50 to-blue-50 rounded-2xl p-6 border-2 border-violet-200 shadow-sm hover:shadow-md hover:border-violet-400 transition-all flex items-center gap-4"
            >
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <Mic className="h-7 w-7 text-white" />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{t.continueVoice}</p>
                  <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">AI</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t.voiceDesc}</p>
              </div>
              <Sparkles className="h-5 w-5 text-violet-400 ml-auto" />
            </button>

            <button
              onClick={() => setStep("new-patient")}
              data-testid="button-manual-mode"
              className="w-full bg-white rounded-2xl p-6 border border-blue-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex items-center gap-4"
            >
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center flex-shrink-0">
                <PenLine className="h-7 w-7 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">{t.fillManually}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.fillManuallyDesc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
            </button>
          </div>
        )}

        {step === "voice-recording" && (
          <div className="space-y-6 animate-fade-up" data-testid="qr-voice-step">
            <button onClick={() => { if (isRecording) { const r = mediaRecorderRef.current; if (r && r.state !== "inactive") r.stop(); if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } setIsRecording(false); } setStep("new-method"); }} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>

            <div className="text-center">
              <h2 className="text-lg font-bold">{t.voiceRegistration}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t.voiceRegDesc}</p>
            </div>

            {isProcessingVoice ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">{t.aiProcessing}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.aiProcessingDesc}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 py-8">
                <div className="relative">
                  {isRecording && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-red-400/20 animate-ping" style={{ animationDuration: "1.5s" }}></div>
                      <div className="absolute -inset-4 rounded-full bg-red-400/10 animate-ping" style={{ animationDuration: "2s" }}></div>
                    </>
                  )}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    data-testid="button-voice-toggle"
                    className={`relative h-28 w-28 rounded-full flex items-center justify-center shadow-lg transition-all ${
                      isRecording
                        ? "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/30"
                        : "bg-gradient-to-br from-violet-500 to-blue-600 hover:from-violet-600 hover:to-blue-700 shadow-violet-500/30"
                    }`}
                  >
                    {isRecording ? <MicOff className="h-12 w-12 text-white" /> : <Mic className="h-12 w-12 text-white" />}
                  </button>
                </div>
                <div className="text-center">
                  {isRecording ? (
                    <>
                      <p className="font-semibold text-red-600 flex items-center gap-2 justify-center">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        {t.recordingTap}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 max-w-xs">{t.recordingHint}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-foreground">{t.tapToStart}</p>
                      <p className="text-xs text-muted-foreground mt-2 max-w-xs">{t.tapToStartDesc}</p>
                    </>
                  )}
                </div>

                <div className="bg-blue-50 rounded-xl p-4 w-full border border-blue-100">
                  <p className="text-xs font-medium text-blue-800 mb-2">{t.speakInYourLang}:</p>
                  <p className="text-xs text-blue-700 italic">{t.voiceExample}</p>
                </div>

                <div className="bg-amber-50 rounded-xl p-4 w-full border border-amber-200">
                  <p className="text-xs font-semibold text-amber-900 mb-3 flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" />
                    {t.voiceFieldsTitle}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {[
                      t.fullName, t.age, t.gender, t.mobileNumber,
                      t.knownConditions, t.pastIllnesses, t.allergies, t.chronicDiseases,
                      t.currentMedications, t.previousSurgeries, t.familyHistory, t.lifestyleHabits,
                      t.pregnancyStatus, t.weight, t.height, t.bloodGroup,
                    ].map((field, i) => (
                      <p key={i} className="text-xs text-amber-800 flex items-start gap-1">
                        <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                        {field}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "voice-preview" && (
          <div className="space-y-5 animate-fade-up" data-testid="qr-voice-preview-step">
            <button onClick={() => setStep("new-method")} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              <h2 className="text-lg font-bold">{t.aiExtracted}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t.reviewEdit}</p>

            {voiceTranscript && (
              <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
                <p className="text-xs font-medium text-violet-700 mb-1">{t.whatWeHeard}</p>
                <p className="text-sm text-violet-900 italic">"{voiceTranscript}"</p>
              </div>
            )}

            {renderMissingFields()}

            <div className="bg-white rounded-2xl p-5 border border-blue-100 space-y-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{t.patientDetails}</p>
              <div>
                <Label htmlFor="v-name">{t.fullName} *</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="v-name" placeholder={t.enterFullName} className="pl-10" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-voice-name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="v-age">{t.age}</Label>
                  <Input id="v-age" inputMode="numeric" pattern="[0-9]*" placeholder={t.age} className="mt-1" value={form.age} onChange={e => setForm({ ...form, age: e.target.value.replace(/[^0-9]/g, "") })} data-testid="input-voice-age" />
                </div>
                <div>
                  <Label>{t.gender}</Label>
                  <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                    <SelectTrigger className="mt-1" data-testid="select-voice-gender"><SelectValue placeholder={t.select} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">{t.male}</SelectItem>
                      <SelectItem value="Female">{t.female}</SelectItem>
                      <SelectItem value="Other">{t.other}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="v-mobile">{t.mobileNumber}</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="v-mobile" placeholder={t.enterMobile} className="pl-10" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} data-testid="input-voice-mobile" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden">
              <div className="p-4 pb-2 border-b border-blue-50">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{t.medicalHistory}</p>
              </div>
              {medicalHistoryTabs}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-violet-500 via-blue-600 to-cyan-500 text-white h-12 rounded-xl text-base"
              onClick={handleNewPatientSubmit}
              disabled={addToQueueMutation.isPending || !form.name.trim()}
              data-testid="button-voice-confirm"
            >
              {addToQueueMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
              {t.confirmStart}
            </Button>
          </div>
        )}

        {step === "new-patient" && (
          <div className="space-y-5 animate-fade-up" data-testid="qr-new-patient-step">
            <button onClick={() => setStep("new-method")} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>
            <h2 className="text-lg font-bold">{t.newPatientRegistration}</h2>

            <div className="bg-white rounded-2xl p-5 border border-blue-100 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{t.patientDetails}</p>
                <VoiceInlineButton testId="inline" />
              </div>
              <div>
                <Label htmlFor="name">{t.fullName} *</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="name" placeholder={t.enterFullName} className="pl-10" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-patient-name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="age">{t.age}</Label>
                  <Input id="age" type="number" placeholder={t.age} className="mt-1" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} data-testid="input-patient-age" />
                </div>
                <div>
                  <Label>{t.gender}</Label>
                  <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                    <SelectTrigger className="mt-1" data-testid="select-gender">
                      <SelectValue placeholder={t.select} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">{t.male}</SelectItem>
                      <SelectItem value="Female">{t.female}</SelectItem>
                      <SelectItem value="Other">{t.other}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="mobile">{t.mobileNumber}</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="mobile" placeholder={t.enterMobile} className="pl-10" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} data-testid="input-patient-mobile" />
                </div>
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 text-white h-12 rounded-xl text-base"
              onClick={handleNewPatientSubmit}
              disabled={addToQueueMutation.isPending}
              data-testid="button-start-consulting"
            >
              {addToQueueMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Stethoscope className="h-5 w-5 mr-2" />}
              {t.startConsulting}
            </Button>
          </div>
        )}

        {step === "existing-patient" && (
          <div className="space-y-5 animate-fade-up" data-testid="qr-existing-patient-step">
            <button onClick={() => setStep("choose")} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800" data-testid="button-back-existing">
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>
            <h2 className="text-lg font-bold">{t.findRecord}</h2>

            <div className="bg-white rounded-2xl p-5 border border-blue-100 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.searchPlaceholder}
                  className="pl-10"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  data-testid="input-search-patient"
                />
              </div>

              {searchQuery.length >= 2 && searchResults && (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t.noPatients}</p>
                  ) : (
                    searchResults.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => handleExistingPatientSelect(p)}
                        disabled={addToQueueMutation.isPending}
                        data-testid={`button-select-patient-${p.id}`}
                        className="w-full text-left bg-blue-50/50 hover:bg-blue-100/80 rounded-xl p-4 border border-blue-100 transition-all flex items-center gap-3"
                      >
                        <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                          {p.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.age ? `${p.age} ${t.yrs}` : ""} {p.gender ? `· ${p.gender}` : ""} {p.phone ? `· ${p.phone}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === "medical-history" && (
          <div className="space-y-5 animate-fade-up" data-testid="qr-medical-history-step">
            <h2 className="text-lg font-bold">{t.medicalHistory}</h2>
            <p className="text-sm text-muted-foreground">{t.medicalHistoryDesc}</p>

            <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{t.yourMedicalInfo}</p>
                <VoiceInlineButton testId="history" />
              </div>
              {medicalHistoryTabs}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={() => setStep("success")}
                data-testid="button-skip-history"
              >
                {t.skip}
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 text-white h-12 rounded-xl"
                onClick={() => saveHistoryMutation.mutate()}
                disabled={saveHistoryMutation.isPending}
                data-testid="button-save-history"
              >
                {saveHistoryMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Heart className="h-5 w-5 mr-2" />}
                {t.saveContinue}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-12 animate-fade-up" data-testid="qr-success-step">
            <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{t.checkedIn}</h2>
            <p className="text-muted-foreground mt-3 max-w-xs mx-auto">
              {t.checkedInDesc}
            </p>
            <div className="mt-8 bg-white rounded-2xl p-5 border border-blue-100 max-w-xs mx-auto">
              <p className="text-sm font-medium text-muted-foreground">{t.yourStatus}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="text-lg font-bold text-amber-600">{t.waiting}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
