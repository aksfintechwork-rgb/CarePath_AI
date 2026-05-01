import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mic, MicOff, Check, Trash2, AlertCircle, Volume2, RefreshCw, AudioWaveform, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const VOICE_QUESTIONS = [
  {
    id: "q1",
    text: "Please introduce yourself — say your full name, specialization, and hospital name.",
    description: "Helps identify your voice pattern with professional context.",
  },
  {
    id: "q2",
    text: "Read aloud: 'Good morning, I am your doctor. How are you feeling today? Please describe your symptoms.'",
    description: "Captures your speaking style during patient interaction.",
  },
  {
    id: "q3",
    text: "Read aloud: 'I am prescribing you Paracetamol 500mg twice daily after food for 5 days.'",
    description: "Records how you pronounce common medical terms and prescriptions.",
  },
  {
    id: "q4",
    text: "Read aloud: 'We need to run a complete blood count test and a chest X-ray. Please come fasting tomorrow.'",
    description: "Captures your voice pattern when ordering diagnostic tests.",
  },
  {
    id: "q5",
    text: "Speak naturally for 15-20 seconds about any medical topic of your choice.",
    description: "Records your natural speaking rhythm and intonation.",
  },
];

export default function DrVoiceStore() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [recordingQuestionId, setRecordingQuestionId] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ["/api/voice-samples"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/voice-samples");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ questionId, questionText, audioBase64, durationSeconds }: any) => {
      const res = await apiRequest("POST", "/api/voice-samples", {
        questionId,
        questionText,
        audioBase64,
        durationSeconds,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-samples"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-samples/status"] });
      toast({ title: "Voice sample saved", description: "Your voice recording has been stored securely." });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Could not save the voice sample. Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/voice-samples/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-samples"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-samples/status"] });
      toast({ title: "Voice sample deleted" });
    },
  });

  const startRecording = useCallback(async (questionId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(100, (avg / 128) * 100));
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecordingQuestionId(questionId);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record voice samples.", variant: "destructive" });
    }
  }, [toast]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !recordingQuestionId) return;

    const questionId = recordingQuestionId;
    const duration = recordingTime;

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          const question = VOICE_QUESTIONS.find((q) => q.id === questionId);
          saveMutation.mutate({
            questionId,
            questionText: question?.text || "",
            audioBase64: base64,
            durationSeconds: duration,
          });
          resolve();
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current!.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      setRecordingQuestionId(null);
      setRecordingTime(0);
      setAudioLevel(0);
    });
  }, [recordingQuestionId, recordingTime, saveMutation]);

  const recordedIds = samples.map((s: any) => s.questionId);
  const completionPercent = (recordedIds.length / VOICE_QUESTIONS.length) * 100;

  return (
    <div className="space-y-6">
      {completionPercent < 100 && (
        <Card className="border-amber-300 bg-amber-50/80 shadow-amber-100 shadow-md" data-testid="card-voice-mandatory-banner">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Voice Registration Required</p>
                <p className="text-xs text-amber-700 mt-0.5">Please record all {VOICE_QUESTIONS.length} voice samples below before you can start using the app. This helps the AI identify your voice during patient consultations.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {completionPercent === 100 && (
        <Card className="border-green-300 bg-green-50/80 shadow-green-100 shadow-md" data-testid="card-voice-complete-banner">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Voice Registration Complete!</p>
                  <p className="text-xs text-green-700 mt-0.5">All voice samples recorded. You can now access all features.</p>
                </div>
              </div>
              <Button onClick={() => setLocation("/")} className="gap-2 bg-green-600 hover:bg-green-700" data-testid="button-continue-dashboard">
                Continue to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <PageHeader
        icon={AudioWaveform}
        title="Dr Voice Store"
        subtitle="Record your voice samples for AI-powered speaker identification during consultations"
      />

      <Card className="glass-card border-blue-200/40" data-testid="card-voice-profile-status">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Voice Profile Setup</CardTitle>
              <CardDescription>
                Record {VOICE_QUESTIONS.length} voice samples to enable automatic speaker detection
              </CardDescription>
            </div>
            <Badge variant={completionPercent === 100 ? "default" : "secondary"} className={completionPercent === 100 ? "bg-green-100 text-green-700 border-green-200" : ""} data-testid="badge-completion">
              {recordedIds.length}/{VOICE_QUESTIONS.length} Recorded
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={completionPercent} className="h-2" data-testid="progress-voice-profile" />
          <div className="flex items-center gap-2 mt-3">
            {completionPercent === 100 ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <Check className="h-4 w-4" />
                <span>Voice profile complete! Speaker diarization is enabled for your consultations.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Record all {VOICE_QUESTIONS.length} samples to activate speaker identification.</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {VOICE_QUESTIONS.map((question, index) => {
          const isRecorded = recordedIds.includes(question.id);
          const isRecording = recordingQuestionId === question.id;
          const sample = samples.find((s: any) => s.questionId === question.id);

          return (
            <Card key={question.id} className={`glass-card transition-all duration-300 ${isRecording ? "border-red-400 shadow-red-100 shadow-lg" : isRecorded ? "border-green-200" : "border-blue-200/40"}`} data-testid={`card-question-${question.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${isRecorded ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                    {isRecorded ? <Check className="h-5 w-5" /> : index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground mb-1">{question.text}</p>
                    <p className="text-xs text-muted-foreground">{question.description}</p>

                    {isRecording && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-xs font-medium text-red-600">Recording...</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{recordingTime}s</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-100 rounded-full" style={{ width: `${audioLevel}%` }} />
                        </div>
                      </div>
                    )}

                    {isRecorded && !isRecording && sample && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
                          <Volume2 className="h-3 w-3 mr-1" />
                          {sample.durationSeconds ? `${sample.durationSeconds}s recorded` : "Recorded"}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isRecording ? (
                      <Button size="sm" variant="destructive" onClick={stopRecording} className="gap-1.5" data-testid={`button-stop-${question.id}`}>
                        <MicOff className="h-4 w-4" />
                        Stop
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant={isRecorded ? "outline" : "default"} onClick={() => startRecording(question.id)} disabled={!!recordingQuestionId || saveMutation.isPending} className="gap-1.5" data-testid={`button-record-${question.id}`}>
                          {isRecorded ? <RefreshCw className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                          {isRecorded ? "Re-record" : "Record"}
                        </Button>
                        {isRecorded && sample && (
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0" onClick={() => deleteMutation.mutate(sample.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-${question.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="glass-card border-blue-200/40">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">How Voice Recognition Works</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>Your voice samples are stored securely and linked to your account.</li>
                <li>During consultations, AI uses your voice profile to distinguish between doctor and patient speech.</li>
                <li>Transcripts are automatically formatted as <span className="font-mono bg-gray-100 px-1 rounded">DR:</span> and <span className="font-mono bg-gray-100 px-1 rounded">PATIENT:</span> segments.</li>
                <li>All {VOICE_QUESTIONS.length} samples are needed for optimal accuracy.</li>
                <li>You can re-record any sample at any time to improve recognition.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
