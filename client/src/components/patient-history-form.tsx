import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Heart,
  Pill,
  Activity,
  Users,
  Scissors,
  Baby,
  Droplets,
  Weight,
  Ruler,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Sparkles,
} from "lucide-react";

interface PatientHistoryFormProps {
  patientId: string;
  isFirstVisit: boolean;
  onComplete: () => void;
  onSkip?: () => void;
}

interface PatientHistory {
  pastIllnesses: string | null;
  chronicDiseases: string | null;
  currentMedications: string | null;
  familyHistory: string | null;
  lifestyleHabits: string | null;
  previousSurgeries: string | null;
  pregnancyStatus: string | null;
  bloodGroup: string | null;
  weight: string | null;
  height: string | null;
  allergies: string | null;
  knownConditions: string | null;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const speechSupported = !!SpeechRecognition;

export function PatientHistoryForm({ patientId, isFirstVisit, onComplete, onSkip }: PatientHistoryFormProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(isFirstVisit);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const recogRef = useRef<any>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    transcriptRef.current = voiceTranscript;
  }, [voiceTranscript]);

  const doAiParse = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    setAiParsing(true);
    try {
      const res = await apiRequest("POST", "/api/ai/parse-medical-history", { transcript });
      const parsed = await res.json();
      setFormData(prev => ({
        ...prev,
        allergies: parsed.allergies || prev.allergies || "",
        knownConditions: parsed.knownConditions || prev.knownConditions || "",
        chronicDiseases: parsed.chronicDiseases || prev.chronicDiseases || "",
        pastIllnesses: parsed.pastIllnesses || prev.pastIllnesses || "",
        currentMedications: parsed.currentMedications || prev.currentMedications || "",
        familyHistory: parsed.familyHistory || prev.familyHistory || "",
        previousSurgeries: parsed.previousSurgeries || prev.previousSurgeries || "",
        lifestyleHabits: parsed.lifestyleHabits || prev.lifestyleHabits || "",
        bloodGroup: parsed.bloodGroup || prev.bloodGroup || "",
        weight: parsed.weight || prev.weight || "",
        height: parsed.height || prev.height || "",
        pregnancyStatus: parsed.pregnancyStatus || prev.pregnancyStatus || "",
      }));
      setVoiceTranscript("");
      toast({ title: "Voice Parsed", description: "Medical history fields have been filled from your voice input." });
    } catch (err: any) {
      toast({ title: "Parse Error", description: "Could not parse voice input. Please fill fields manually.", variant: "destructive" });
    } finally {
      setAiParsing(false);
    }
  }, [toast]);

  const toggleVoice = useCallback(() => {
    if (voiceListening && recogRef.current) {
      recogRef.current.stop();
      setVoiceListening(false);
      return;
    }
    if (!speechSupported) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recogRef.current = recognition;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript.trim()) {
        setVoiceTranscript(prev => {
          const updated = prev ? `${prev} ${transcript.trim()}` : transcript.trim();
          transcriptRef.current = updated;
          return updated;
        });
      }
    };
    recognition.onerror = () => setVoiceListening(false);
    recognition.onend = () => {
      setVoiceListening(false);
      setTimeout(() => {
        const finalTranscript = transcriptRef.current;
        if (finalTranscript.trim()) {
          doAiParse(finalTranscript);
        }
      }, 300);
    };
    recognition.start();
    setVoiceListening(true);
    setVoiceTranscript("");
    transcriptRef.current = "";
  }, [voiceListening, doAiParse]);

  useEffect(() => {
    return () => { if (recogRef.current) { try { recogRef.current.stop(); } catch {} } };
  }, []);

  const [formData, setFormData] = useState<PatientHistory>({
    pastIllnesses: "",
    chronicDiseases: "",
    currentMedications: "",
    familyHistory: "",
    lifestyleHabits: "",
    previousSurgeries: "",
    pregnancyStatus: "",
    bloodGroup: "",
    weight: "",
    height: "",
    allergies: "",
    knownConditions: "",
  });

  const { data: history, isLoading } = useQuery({
    queryKey: [`/api/patients/${patientId}/history`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/patients/${patientId}/history`);
      return res.json();
    },
    enabled: !!patientId,
  });

  useEffect(() => {
    if (history) {
      setFormData({
        pastIllnesses: history.pastIllnesses || "",
        chronicDiseases: history.chronicDiseases || "",
        currentMedications: history.currentMedications || "",
        familyHistory: history.familyHistory || "",
        lifestyleHabits: history.lifestyleHabits || "",
        previousSurgeries: history.previousSurgeries || "",
        pregnancyStatus: history.pregnancyStatus || "",
        bloodGroup: history.bloodGroup || "",
        weight: history.weight || "",
        height: history.height || "",
        allergies: history.allergies || "",
        knownConditions: history.knownConditions || "",
      });
    }
  }, [history]);

  const saveMutation = useMutation({
    mutationFn: async (data: PatientHistory) => {
      const res = await apiRequest("PUT", `/api/patients/${patientId}/history`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/history`] });
      toast({ title: "History Saved", description: "Patient medical history has been updated." });
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function handleChange(field: keyof PatientHistory, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    saveMutation.mutate(formData);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading patient history...</span>
      </div>
    );
  }

  const hasExistingData = history && (
    history.pastIllnesses || history.chronicDiseases || history.currentMedications ||
    history.familyHistory || history.bloodGroup || history.weight || history.height ||
    history.allergies || history.knownConditions
  );

  return (
    <div className="glass-card-strong rounded-xl" data-testid="patient-history-form">
      <div
        className="p-6 pb-4 border-b border-white/30 cursor-pointer flex items-center justify-between"
        onClick={() => !isFirstVisit && setExpanded(!expanded)}
        data-testid="button-toggle-history"
      >
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Medical History
            {isFirstVisit && (
              <Badge variant="secondary" className="ml-2" data-testid="badge-first-visit">
                First Visit
              </Badge>
            )}
            {!isFirstVisit && hasExistingData && (
              <Badge variant="secondary" className="ml-2" data-testid="badge-returning-patient">
                <ShieldCheck className="h-3 w-3 mr-1" />
                On File
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Review and update the patient's medical history if needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {speechSupported && expanded && (
            <Button
              type="button"
              variant={voiceListening ? "destructive" : "outline"}
              size="sm"
              className={`gap-2 h-10 px-4 rounded-xl transition-all ${voiceListening ? "animate-pulse bg-red-500 hover:bg-red-600 text-white" : aiParsing ? "border-blue-300 bg-blue-50" : "border-blue-200 hover:border-blue-400 hover:bg-blue-50"}`}
              onClick={(e) => { e.stopPropagation(); toggleVoice(); }}
              disabled={aiParsing}
              data-testid="button-voice-history"
            >
              {aiParsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs font-medium">Processing...</span>
                </>
              ) : voiceListening ? (
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
          )}
          {!isFirstVisit && (
            expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-6 space-y-6">
          {(voiceListening || voiceTranscript) && (
            <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-4 space-y-3" data-testid="voice-transcript-box">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                {voiceListening ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    Listening... speak the patient's medical history
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Voice transcript captured
                  </>
                )}
              </div>
              {voiceTranscript && (
                <>
                  <p className="text-sm text-foreground bg-white rounded-lg p-3 border border-blue-100 italic">
                    "{voiceTranscript}"
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setVoiceTranscript("")}
                      data-testid="button-clear-transcript"
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => doAiParse(voiceTranscript)}
                      disabled={aiParsing}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                      data-testid="button-fill-fields"
                    >
                      {aiParsing ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Parsing...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-1" /> Fill All Fields</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <Droplets className="h-4 w-4 text-red-500" />
                Blood Group
              </Label>
              <Select
                value={formData.bloodGroup || ""}
                onValueChange={(v) => handleChange("bloodGroup", v)}
              >
                <SelectTrigger data-testid="select-blood-group" className="h-11">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map(bg => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <Weight className="h-4 w-4 text-blue-500" />
                Weight (kg)
              </Label>
              <Input
                data-testid="input-weight"
                placeholder="e.g. 70"
                value={formData.weight || ""}
                onChange={(e) => handleChange("weight", e.target.value)}
                className="h-11"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <Ruler className="h-4 w-4 text-green-500" />
                Height (cm)
              </Label>
              <Input
                data-testid="input-height"
                placeholder="e.g. 170"
                value={formData.height || ""}
                onChange={(e) => handleChange("height", e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <Separator />

          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Allergies
            </Label>
            <Textarea
              data-testid="input-allergies"
              placeholder="e.g. Penicillin, Sulfa drugs, Peanuts, Latex..."
              value={formData.allergies || ""}
              onChange={(e) => handleChange("allergies", e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <Activity className="h-4 w-4 text-orange-500" />
              Known Conditions
            </Label>
            <Textarea
              data-testid="input-known-conditions"
              placeholder="e.g. Diabetes Type 2, Hypertension, Asthma..."
              value={formData.knownConditions || ""}
              onChange={(e) => handleChange("knownConditions", e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <Heart className="h-4 w-4 text-red-500" />
              Chronic Diseases
            </Label>
            <Textarea
              data-testid="input-chronic-diseases"
              placeholder="e.g. Heart disease, Kidney disease, COPD..."
              value={formData.chronicDiseases || ""}
              onChange={(e) => handleChange("chronicDiseases", e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <Activity className="h-4 w-4 text-purple-500" />
              Past Illnesses
            </Label>
            <Textarea
              data-testid="input-past-illnesses"
              placeholder="e.g. Dengue (2019), Typhoid (2021), COVID-19 (2022)..."
              value={formData.pastIllnesses || ""}
              onChange={(e) => handleChange("pastIllnesses", e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <Pill className="h-4 w-4 text-blue-500" />
              Current Medications
            </Label>
            <Textarea
              data-testid="input-current-medications"
              placeholder="e.g. Metformin 500mg twice daily, Amlodipine 5mg once daily..."
              value={formData.currentMedications || ""}
              onChange={(e) => handleChange("currentMedications", e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <Users className="h-4 w-4 text-teal-500" />
              Family History
            </Label>
            <Textarea
              data-testid="input-family-history"
              placeholder="e.g. Father: Diabetes, Mother: Hypertension, Sibling: Asthma..."
              value={formData.familyHistory || ""}
              onChange={(e) => handleChange("familyHistory", e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <Scissors className="h-4 w-4 text-gray-500" />
                Previous Surgeries
              </Label>
              <Textarea
                data-testid="input-previous-surgeries"
                placeholder="e.g. Appendectomy (2018), Knee replacement (2020)..."
                value={formData.previousSurgeries || ""}
                onChange={(e) => handleChange("previousSurgeries", e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <Activity className="h-4 w-4 text-green-500" />
                Lifestyle Habits
              </Label>
              <Textarea
                data-testid="input-lifestyle-habits"
                placeholder="e.g. Non-smoker, Social drinker, Vegetarian, Exercises 3x/week..."
                value={formData.lifestyleHabits || ""}
                onChange={(e) => handleChange("lifestyleHabits", e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <Baby className="h-4 w-4 text-pink-500" />
              Pregnancy Status
            </Label>
            <Select
              value={formData.pregnancyStatus || ""}
              onValueChange={(v) => handleChange("pregnancyStatus", v)}
            >
              <SelectTrigger data-testid="select-pregnancy-status" className="h-11">
                <SelectValue placeholder="Select if applicable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_applicable">Not Applicable</SelectItem>
                <SelectItem value="not_pregnant">Not Pregnant</SelectItem>
                <SelectItem value="pregnant">Pregnant</SelectItem>
                <SelectItem value="breastfeeding">Breastfeeding</SelectItem>
                <SelectItem value="planning">Planning Pregnancy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            {onSkip && (
              <Button
                type="button"
                variant="ghost"
                onClick={onSkip}
                data-testid="button-skip-history"
              >
                Skip
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-2"
              data-testid="button-save-history"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isFirstVisit ? "Save & Continue" : "Update History"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
