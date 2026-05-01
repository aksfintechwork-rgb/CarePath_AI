import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocation } from "wouter";
import { AiMinutesWarning } from "@/components/upgrade-prompt";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { Mic, ArrowRight, User, Globe, CreditCard, Camera, Upload, Loader2, Check, Search, UserCheck, UserPlus, Clock, Stethoscope, MessageCircle } from "lucide-react";
import { PatientHistoryForm } from "@/components/patient-history-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, getAuthHeaders, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const SUPPORTED_LANGUAGES = [
  "English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Punjabi",
  "Urdu", "Odia", "Assamese", "Sanskrit", "Nepali", "Konkani", "Goan Konkani", "Sindhi", "Kashmiri", "Maithili", "Dogri",
  "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Russian", "Polish", "Czech", "Romanian",
  "Mandarin Chinese", "Cantonese", "Japanese", "Korean", "Thai", "Vietnamese", "Indonesian", "Malay", "Filipino",
  "Arabic", "Persian", "Turkish", "Hebrew", "Swahili", "Amharic", "Hausa", "Yoruba", "Zulu",
  "Swedish", "Norwegian", "Danish", "Finnish", "Greek", "Hungarian", "Ukrainian", "Serbian", "Croatian", "Bulgarian",
];

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  age: z.string().min(1, {
    message: "Age is required.",
  }),
  whatsappNumber: z.string().optional(),
  gender: z.string().optional(),
  language: z.string().default("English"),
  consent: z.boolean().refine((val) => val === true, {
    message: "Patient consent is mandatory for recording.",
  }),
});

export default function NewVisit() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "done">("idle");
  const [activeTab, setActiveTab] = useState("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [existingLanguage, setExistingLanguage] = useState("English");
  const [existingConsent, setExistingConsent] = useState(false);
  const [pendingVisitId, setPendingVisitId] = useState<string | null>(null);
  const [pendingPatientId, setPendingPatientId] = useState<string | null>(null);
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [isFirstVisitPatient, setIsFirstVisitPatient] = useState(false);
  const [fromQueue, setFromQueue] = useState(false);
  const autoStartTriggered = useRef(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      age: "",
      whatsappNumber: "",
      gender: "",
      language: "English",
      consent: false,
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/patients");
      return res.json();
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preselectedId = params.get("patientId");
    const autoStart = params.get("autoStart") === "true";
    const eName = params.get("eName");
    const eGender = params.get("eGender");
    const eAge = params.get("eAge");
    if (preselectedId && patients.length > 0) {
      const patient = patients.find((p: any) => p.id === preselectedId);
      if (patient) {
        setActiveTab("existing");
        setSelectedPatient(patient);
        setFromQueue(true);
        if (autoStart && !autoStartTriggered.current) {
          autoStartTriggered.current = true;
          const visitName = eName || patient.name;
          const visitAge = eAge || String(patient.age || 0);
          const visitGender = eGender || patient.gender || null;
          (async () => {
            try {
              const res = await apiRequest("POST", "/api/visits", {
                patientName: visitName,
                patientAge: visitAge,
                patientGender: visitGender,
                language: "English",
              });
              const data = await res.json();
              queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
              queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
              setLocation(`/visit/${data.id}`);
            } catch (err: any) {
              toast({ title: "Error", description: err.message || "Failed to create visit", variant: "destructive" });
            }
          })();
        }
      }
    }
  }, [patients]);

  const filteredPatients = searchQuery.trim().length > 0
    ? patients.filter((p: any) =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.whatsappNumber?.includes(searchQuery)
      )
    : patients;

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      voiceChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) voiceChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          setVoiceProcessing(true);
          try {
            const res = await fetch("/api/qr/voice-extract", {
              method: "POST",
              headers: getAuthHeaders({ "Content-Type": "application/json" }),
              body: JSON.stringify({
                audio: base64,
                language: form.getValues("language") || "English",
              }),
            });
            if (!res.ok) {
              let errMsg = "Voice extraction failed";
              try {
                const j = await res.json();
                errMsg = j.detail || j.message || errMsg;
              } catch {
                /* ignore */
              }
              throw new Error(errMsg);
            }
            const { data } = await res.json();
            if (data.name) form.setValue("name", data.name, { shouldValidate: true });
            if (data.age) form.setValue("age", String(data.age), { shouldValidate: true });
            if (data.gender) {
              const g = data.gender.trim().toLowerCase();
              form.setValue("gender", g === "male" ? "Male" : g === "female" ? "Female" : "Other", { shouldValidate: true });
            }
            if (data.mobile) form.setValue("whatsappNumber", data.mobile, { shouldValidate: true });
            toast({ title: "Voice Input Processed", description: `Filled: ${[data.name, data.age && `Age ${data.age}`, data.gender, data.mobile].filter(Boolean).join(", ") || "No data detected"}` });
          } catch (err: any) {
            toast({ title: "Voice Error", description: err.message || "Could not process voice input", variant: "destructive" });
          } finally {
            setVoiceProcessing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      voiceRecorderRef.current = recorder;
      setVoiceRecording(true);
      toast({ title: "Recording Started", description: "Speak patient's name, age, gender, and WhatsApp number" });
    } catch (err) {
      toast({ title: "Microphone Error", description: "Please allow microphone access", variant: "destructive" });
    }
  };

  const stopVoiceRecording = () => {
    if (voiceRecorderRef.current && voiceRecorderRef.current.state === "recording") {
      voiceRecorderRef.current.stop();
      voiceRecorderRef.current = null;
      setVoiceRecording(false);
    }
  };

  const scanAadhaarMutation = useMutation({
    mutationFn: async (base64Image: string) => {
      setScanStatus("scanning");
      const res = await apiRequest("POST", "/api/scan-aadhaar", { image: base64Image });
      return res.json();
    },
    onSuccess: (data: { name: string | null; age: number | null; gender: string | null; aadhaarNumber: string | null }) => {
      setScanStatus("done");
      if (data.name) form.setValue("name", data.name, { shouldValidate: true });
      if (data.age) form.setValue("age", String(data.age), { shouldValidate: true });
      if (data.gender) {
        const g = data.gender.trim().toLowerCase();
        const normalizedGender = g === "male" ? "Male" : g === "female" ? "Female" : "Other";
        form.setValue("gender", normalizedGender, { shouldValidate: true });
      }
      toast({
        title: "Aadhaar Card Scanned",
        description: `Extracted: ${data.name || "N/A"}, Age: ${data.age || "N/A"}, Gender: ${data.gender || "N/A"}`,
      });
      setTimeout(() => setScanStatus("idle"), 3000);
    },
    onError: (err: Error) => {
      setScanStatus("idle");
      toast({
        title: "Scan Failed",
        description: err.message || "Could not read the Aadhaar card. Please try with a clearer photo.",
        variant: "destructive",
      });
    },
  });

  function handleAadhaarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please upload an image file (photo of Aadhaar card).", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Please upload an image smaller than 5MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setScanPreview(result);
      const base64 = result.split(",")[1];
      scanAadhaarMutation.mutate(base64);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function checkFirstVisitAndShowHistory(visitId: string, patientId: string) {
    try {
      const res = await apiRequest("GET", `/api/patients/${patientId}/first-visit-check`);
      const check = await res.json();
      setPendingVisitId(visitId);
      setPendingPatientId(patientId);
      setIsFirstVisitPatient(check.isFirstVisit);
      setShowHistoryForm(true);
    } catch {
      setLocation(`/visit/${visitId}`);
    }
  }

  const createVisitMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/visits", {
        patientName: values.name,
        patientAge: values.age,
        patientWhatsapp: values.whatsappNumber || null,
        patientGender: values.gender || null,
        language: values.language || "English",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      checkFirstVisitAndShowHistory(data.id, data.patientId);
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const existingVisitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error("No patient selected");
      const res = await apiRequest("POST", "/api/visits", {
        patientName: selectedPatient.name,
        patientAge: String(selectedPatient.age),
        patientGender: selectedPatient.gender || null,
        language: existingLanguage,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      checkFirstVisitAndShowHistory(data.id, data.patientId);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createVisitMutation.mutate(values);
  }

  function onFormError(errors: any) {
    const errorFields = Object.entries(errors).map(([key, val]: [string, any]) => {
      const labels: Record<string, string> = { name: "Patient Name", age: "Age", consent: "Consent" };
      return labels[key] || key;
    });
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      const el = document.querySelector(`[name="${firstErrorField}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    toast({
      title: "Missing Information",
      description: `Please complete: ${errorFields.join(", ")}`,
      variant: "destructive",
    });
  }

  if (showHistoryForm && pendingPatientId && pendingVisitId) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="mb-8">
          <PageHeader
            title="Patient Medical History"
            subtitle={isFirstVisitPatient
              ? "Review and update the patient's medical history before starting the consultation."
              : "Review and update the patient's medical history before starting the consultation."}
            icon={Stethoscope}
            iconBg="bg-gradient-to-br from-red-500 to-pink-600"
            testId="text-history-title"
          />
        </div>

        <PatientHistoryForm
          patientId={pendingPatientId}
          isFirstVisit={isFirstVisitPatient}
          onComplete={() => setLocation(`/visit/${pendingVisitId}`)}
          onSkip={() => setLocation(`/visit/${pendingVisitId}`)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <AiMinutesWarning />
      <div className="mb-8">
        <PageHeader
          title={fromQueue ? "Patient Details" : "Patient Visit"}
          subtitle={fromQueue ? "Review patient information before starting consultation" : "Start a new consultation for a new or existing patient"}
          icon={Stethoscope}
          iconBg="bg-gradient-to-br from-blue-500 to-violet-600"
          testId="text-new-visit-title"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {!fromQueue && (
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="new" className="gap-2 text-sm font-medium" data-testid="tab-new-patient">
              <UserPlus className="h-4 w-4" />
              New Patient
            </TabsTrigger>
            <TabsTrigger value="existing" className="gap-2 text-sm font-medium" data-testid="tab-existing-patient">
              <UserCheck className="h-4 w-4" />
              Existing Patient
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="new">
          <div className="glass-card-strong rounded-xl">
            <div className="p-6 pb-4 border-b border-white/30">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    New Patient Details
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    All fields are required to generate a valid care plan.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={voiceRecording ? "destructive" : "outline"}
                  size="sm"
                  className={`gap-2 h-10 px-4 rounded-xl transition-all ${voiceRecording ? "animate-pulse bg-red-500 hover:bg-red-600 text-white" : voiceProcessing ? "border-blue-300 bg-blue-50" : "border-blue-200 hover:border-blue-400 hover:bg-blue-50"}`}
                  onClick={voiceRecording ? stopVoiceRecording : startVoiceRecording}
                  disabled={voiceProcessing}
                  data-testid="button-voice-patient"
                >
                  {voiceProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs font-medium">Processing...</span>
                    </>
                  ) : voiceRecording ? (
                    <>
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                      </span>
                      <span className="text-xs font-medium">Stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium">Voice Fill</span>
                    </>
                  )}
                </Button>
              </div>
              {voiceRecording && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <p className="text-xs text-red-700 font-medium">Listening... Speak name, age, gender & WhatsApp number in any language</p>
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-sm">Scan Aadhaar Card</h3>
                  <span className="text-xs text-muted-foreground">(auto-fill name, age & gender)</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleAadhaarUpload}
                  data-testid="input-aadhaar-file"
                />

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.setAttribute("capture", "environment");
                      input.onchange = (e) => handleAadhaarUpload(e as any);
                      input.click();
                    }}
                    disabled={scanStatus === "scanning"}
                    data-testid="button-scan-aadhaar"
                  >
                    {scanStatus === "scanning" ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span>Scanning card...</span>
                      </>
                    ) : scanStatus === "done" ? (
                      <>
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="text-green-600">Scan complete</span>
                      </>
                    ) : (
                      <>
                        <Camera className="h-5 w-5" />
                        <span>Take Photo</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e) => handleAadhaarUpload(e as any);
                      input.click();
                    }}
                    disabled={scanStatus === "scanning"}
                    data-testid="button-upload-aadhaar"
                  >
                    <Upload className="h-5 w-5" />
                    <span>Upload Image</span>
                  </Button>
                </div>

                {scanPreview && (
                  <div className="mt-3 relative rounded-lg overflow-hidden border bg-muted/30">
                    <img
                      src={scanPreview}
                      alt="Aadhaar card preview"
                      className="w-full max-h-48 object-contain"
                      data-testid="img-aadhaar-preview"
                    />
                    {scanStatus === "scanning" && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <div className="flex items-center gap-2 bg-background/90 px-4 py-2 rounded-full shadow-lg">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm font-medium">Reading Aadhaar card...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Separator className="mt-6" />
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-6">
                  
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input data-testid="input-patient-name" placeholder="e.g. Jane Doe" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age</FormLabel>
                          <FormControl>
                            <Input data-testid="input-patient-age" placeholder="Years" type="number" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-gender" className="h-11">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="whatsappNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MessageCircle className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                            <Input data-testid="input-patient-whatsapp" placeholder="+91 98765" className="pl-10 h-11" {...field} />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <input type="hidden" {...form.register("language")} />

                  <Separator className="my-4" />

                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <FormField
                      control={form.control}
                      name="consent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              data-testid="checkbox-consent"
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(checked === true)}
                              className="mt-1"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-base font-medium">
                              Consent for Audio Recording
                            </FormLabel>
                            <FormDescription className="text-blue-900/70">
                              Patient consents to audio recording for the purpose of medical documentation and care plan generation.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      data-testid="button-start-recording"
                      type="submit" 
                      size="lg" 
                      className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
                      disabled={createVisitMutation.isPending}
                    >
                      <Mic className="h-4 w-4" />
                      {createVisitMutation.isPending ? "Creating..." : "Start Consultation"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="existing">
          <div className="glass-card-strong rounded-xl">
            {!fromQueue && (
              <>
                <div className="p-6 pb-4 border-b border-white/30">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    Search Existing Patient
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Search by patient name to start a new visit.
                  </p>
                </div>
              </>
            )}
            <div className="p-6 space-y-6">
              {!fromQueue && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name..."
                      className="pl-10 h-11"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setSelectedPatient(null); }}
                      data-testid="input-search-patient"
                    />
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient: any) => (
                        <div
                          key={patient.id}
                          className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedPatient?.id === patient.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-muted/50 hover:border-primary/30"
                          }`}
                          onClick={() => setSelectedPatient(patient)}
                          data-testid={`card-patient-${patient.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                              {patient.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="font-medium" data-testid={`text-patient-name-${patient.id}`}>{patient.name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {patient.age && <span>{patient.age} yrs</span>}
                                {patient.gender && <span>{patient.gender}</span>}
                                {patient.whatsappNumber && (
                                  <span className="flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3" /> {patient.whatsappNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {selectedPatient?.id === patient.id && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        {searchQuery.trim() ? "No patients found matching your search." : "No patients registered yet."}
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedPatient && (
                <>
                  <Separator />

                  <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-2 mb-3">
                      <UserCheck className="h-5 w-5 text-emerald-600" />
                      <h4 className="font-medium text-emerald-900">Selected: {selectedPatient.name}</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm text-emerald-800">
                      <div>
                        <span className="text-emerald-600">Age:</span> {selectedPatient.age || "—"} yrs
                      </div>
                      <div>
                        <span className="text-emerald-600">Gender:</span> {selectedPatient.gender || "—"}
                      </div>
                      <div>
                        <span className="text-emerald-600">WhatsApp:</span> {selectedPatient.whatsappNumber || "—"}
                      </div>
                      <div>
                        <span className="text-emerald-600">Blood Group:</span> {selectedPatient.bloodGroup || "—"}
                      </div>
                      <div>
                        <span className="text-emerald-600">Height:</span> {selectedPatient.height ? `${selectedPatient.height} cm` : "—"}
                      </div>
                      <div>
                        <span className="text-emerald-600">Weight:</span> {selectedPatient.weight ? `${selectedPatient.weight} kg` : "—"}
                      </div>
                    </div>

                    {(selectedPatient.knownConditions || selectedPatient.allergies || selectedPatient.chronicDiseases || selectedPatient.currentMedications || selectedPatient.pastIllnesses || selectedPatient.previousSurgeries || selectedPatient.familyHistory || selectedPatient.lifestyleHabits || selectedPatient.pregnancyStatus) && (
                      <div className="mt-4 pt-3 border-t border-emerald-200/60">
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Medical History (Patient-Provided)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {selectedPatient.knownConditions && (
                            <div><span className="text-emerald-600 font-medium">Conditions:</span> {selectedPatient.knownConditions}</div>
                          )}
                          {selectedPatient.allergies && (
                            <div><span className="text-emerald-600 font-medium">Allergies:</span> {selectedPatient.allergies}</div>
                          )}
                          {selectedPatient.chronicDiseases && (
                            <div><span className="text-emerald-600 font-medium">Chronic Diseases:</span> {selectedPatient.chronicDiseases}</div>
                          )}
                          {selectedPatient.currentMedications && (
                            <div><span className="text-emerald-600 font-medium">Current Medications:</span> {selectedPatient.currentMedications}</div>
                          )}
                          {selectedPatient.pastIllnesses && (
                            <div><span className="text-emerald-600 font-medium">Past Illnesses:</span> {selectedPatient.pastIllnesses}</div>
                          )}
                          {selectedPatient.previousSurgeries && (
                            <div><span className="text-emerald-600 font-medium">Surgeries:</span> {selectedPatient.previousSurgeries}</div>
                          )}
                          {selectedPatient.familyHistory && (
                            <div><span className="text-emerald-600 font-medium">Family History:</span> {selectedPatient.familyHistory}</div>
                          )}
                          {selectedPatient.lifestyleHabits && (
                            <div><span className="text-emerald-600 font-medium">Lifestyle:</span> {selectedPatient.lifestyleHabits}</div>
                          )}
                          {selectedPatient.pregnancyStatus && (
                            <div><span className="text-emerald-600 font-medium">Pregnancy:</span> {selectedPatient.pregnancyStatus}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>


                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <div className="flex flex-row items-start space-x-3">
                      <Checkbox
                        checked={existingConsent}
                        onCheckedChange={(v) => setExistingConsent(v === true)}
                        className="mt-1"
                        data-testid="checkbox-existing-consent"
                      />
                      <div className="space-y-1 leading-none">
                        <label className="text-base font-medium cursor-pointer">
                          Consent for Audio Recording
                        </label>
                        <p className="text-sm text-blue-900/70">
                          Patient consents to audio recording for the purpose of medical documentation and care plan generation.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
                      disabled={!existingConsent || existingVisitMutation.isPending}
                      onClick={() => existingVisitMutation.mutate()}
                      data-testid="button-start-existing-recording"
                    >
                      <Mic className="h-4 w-4" />
                      {existingVisitMutation.isPending ? "Creating..." : "Start Consultation"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
