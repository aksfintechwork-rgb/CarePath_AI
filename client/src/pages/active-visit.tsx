import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { AiMinutesWarning } from "@/components/upgrade-prompt";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getSessionToken } from "@/lib/queryClient";
import { 
  Mic, MicOff, Square, Loader2, Play, Pause, Save, CheckCircle2, 
  AlertCircle, Pill, FileText, CalendarClock,
  Activity, ArrowLeft, Info, Trash2, Globe, X,
  Stethoscope, UtensilsCrossed, ShieldAlert, AlertTriangle, Volume2,
  Pencil, Plus, Check, Languages, Share2, Printer, MessageCircle, Mail, Phone, RefreshCw,
  AudioWaveform, User
} from "lucide-react";
import LabReportUpload from "@/components/lab-report-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MedicineAutocomplete } from "@/components/medicine-autocomplete";
import { translateMedicalTerm } from "@/lib/medical-translations";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const TRANSLATION_LANGUAGES = [
  "English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Punjabi",
  "Urdu", "Konkani", "Goan Konkani", "Malay (Bahasa Melayu)", "Spanish", "French", "German", "Portuguese", "Arabic", "Russian", "Japanese", "Korean", "Mandarin Chinese",
];

const CHUNK_INTERVAL_MS = 15000;

function useAudioRecorder(visitId: string | undefined, onTranscriptUpdate?: (text: string) => void) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const allChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunkIndexRef = useRef(0);
  const sendingRef = useRef(false);
  const lastSentChunkCountRef = useRef(0);

  const sendChunk = useCallback(async (forceFlush = false) => {
    if (!visitId || sendingRef.current) {
      console.log(`[CHUNK] Skip: visitId=${!!visitId}, sending=${sendingRef.current}`);
      return;
    }
    const currentCount = allChunksRef.current.length;
    if (currentCount === 0) {
      console.log(`[CHUNK] Skip: no audio data blobs yet`);
      return;
    }

    const totalBlobSize = allChunksRef.current.reduce((sum, b) => sum + b.size, 0);
    console.log(`[CHUNK] Audio check: ${currentCount} blobs, totalSize=${totalBlobSize} bytes, lastSentAt=${lastSentChunkCountRef.current} blobs`);

    if (totalBlobSize < 1000) {
      console.log(`[CHUNK] Skip: audio data too small (${totalBlobSize} bytes), waiting for more`);
      return;
    }

    if (!forceFlush && currentCount <= lastSentChunkCountRef.current + 2) {
      console.log(`[CHUNK] Skip: not enough new blobs (current=${currentCount}, lastSent=${lastSentChunkCountRef.current})`);
      return;
    }

    sendingRef.current = true;

    try {
      const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(allChunksRef.current, { type: mimeType });
      console.log(`[CHUNK] Blob created: ${blob.size} bytes, type=${mimeType}`);

      if (blob.size < 500) {
        console.warn(`[CHUNK] Blob too small (${blob.size} bytes), skipping send`);
        return;
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          if (!result || !result.includes(",")) {
            reject(new Error("FileReader produced empty result"));
            return;
          }
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => reject(new Error("FileReader failed"));
        reader.readAsDataURL(blob);
      });

      if (!base64 || base64.length < 100) {
        console.warn(`[CHUNK] Base64 too short after encoding: ${base64?.length || 0}`);
        return;
      }

      const idx = chunkIndexRef.current++;
      lastSentChunkCountRef.current = currentCount;
      console.log(`[CHUNK] Sending chunk #${idx}: base64=${base64.length} chars, blobs=${currentCount}`);
      const chunkToken = getSessionToken();
      const resp = await fetch(`/api/visits/${visitId}/chunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(chunkToken ? { Authorization: `Bearer ${chunkToken}` } : {}) },
        body: JSON.stringify({ audio: base64, chunkIndex: idx }),
      });
      console.log(`[CHUNK] Server response: status=${resp.status}`);
      if (resp.ok) {
        const data = await resp.json();
        console.log(`[CHUNK] Transcript received: ${data.fullTranscript?.length || 0} chars`);
        if (data.fullTranscript && onTranscriptUpdate) {
          onTranscriptUpdate(data.fullTranscript);
        }
      } else {
        const errText = await resp.text();
        console.error(`[CHUNK] Server error: ${resp.status} - ${errText}`);
      }
    } catch (err) {
      console.error("[CHUNK] Send error:", err);
    } finally {
      sendingRef.current = false;
    }
  }, [visitId, onTranscriptUpdate]);

  const startRecording = useCallback(async () => {
    console.log("[MIC] startRecording called");
    try {
      setMicError(null);
      chunkIndexRef.current = 0;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("[MIC] getUserMedia not available");
        setMicError("Your browser or app does not support microphone access. Please open this page in Chrome or your phone's default browser instead.");
        return;
      }

      console.log("[MIC] Requesting getUserMedia with constraints...");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
          } 
        });
        console.log("[MIC] getUserMedia granted with constraints");
      } catch (firstErr: any) {
        console.warn(`[MIC] First getUserMedia failed: ${firstErr.name} - ${firstErr.message}`);
        if (firstErr.name === "OverconstrainedError" || firstErr.name === "TypeError") {
          console.log("[MIC] Retrying with basic audio:true...");
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log("[MIC] getUserMedia granted with basic audio");
        } else {
          throw firstErr;
        }
      }
      streamRef.current = stream;
      const tracks = stream.getAudioTracks();
      console.log(`[MIC] Stream tracks: ${tracks.length}, track[0]: label=${tracks[0]?.label}, enabled=${tracks[0]?.enabled}, muted=${tracks[0]?.muted}`);

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      console.log(`[MIC] AudioContext state: ${audioContext.state}, sampleRate: ${audioContext.sampleRate}`);
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
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4';
      console.log(`[MIC] MediaRecorder mimeType: ${mimeType}`);

      const recorder = new MediaRecorder(stream, { mimeType });
      allChunksRef.current = [];
      lastSentChunkCountRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          allChunksRef.current.push(e.data);
          const totalSize = allChunksRef.current.reduce((sum, b) => sum + b.size, 0);
          if (allChunksRef.current.length <= 3 || allChunksRef.current.length % 5 === 0) {
            console.log(`[MIC] Data blob #${allChunksRef.current.length}: ${e.data.size} bytes, total accumulated: ${totalSize} bytes`);
          }
        } else {
          console.warn(`[MIC] Empty data blob received (size=0)`);
        }
      };

      recorder.onerror = (e: any) => {
        console.error("[MIC] MediaRecorder error:", e.error?.name, e.error?.message);
      };

      recorder.onstart = () => {
        console.log("[MIC] MediaRecorder started");
      };

      recorder.onstop = () => {
        console.log(`[MIC] MediaRecorder stopped, total chunks: ${allChunksRef.current.length}`);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      console.log(`[MIC] Recording started, chunk interval: ${CHUNK_INTERVAL_MS}ms`);

      chunkTimerRef.current = setInterval(() => {
        console.log(`[CHUNK] Timer fired, chunks: ${allChunksRef.current.length}, lastSent: ${lastSentChunkCountRef.current}`);
        sendChunk();
      }, CHUNK_INTERVAL_MS);
    } catch (err: any) {
      console.error("[MIC] Error:", err?.name, err?.message, err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMicError("Microphone permission was denied. Please allow microphone access when prompted, or enable it in your device Settings > Apps > Browser/App > Permissions > Microphone.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setMicError("No microphone found. Please connect a microphone and try again.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setMicError("Microphone is being used by another app. Please close other apps using the mic and try again.");
      } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicError("Your browser or app does not support microphone access. Please open this page in Chrome browser instead.");
      } else {
        setMicError("Could not access microphone. Please check your browser/app permissions and try again.");
      }
    }
  }, [sendChunk]);

  const flushPendingChunks = useCallback(async () => {
    const pending = allChunksRef.current.length - lastSentChunkCountRef.current;
    const totalSize = allChunksRef.current.reduce((sum, b) => sum + b.size, 0);
    console.log(`[FLUSH] Pending blobs: ${pending}, total blobs: ${allChunksRef.current.length}, totalSize: ${totalSize} bytes`);
    if (allChunksRef.current.length > 0 && totalSize > 500) {
      lastSentChunkCountRef.current = 0;
      await sendChunk(true);
    } else {
      console.warn(`[FLUSH] Nothing to flush — blobs=${allChunksRef.current.length}, size=${totalSize}`);
    }
  }, [sendChunk]);

  const stopRecording = useCallback((): Promise<string | null> => {
    console.log(`[STOP] stopRecording called, chunks: ${allChunksRef.current.length}, isRecording state will be set to false`);
    return new Promise(async (resolve) => {
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
        console.log("[STOP] Chunk timer cleared");
      }

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
      setAudioLevel(0);

      const recorder = mediaRecorderRef.current;
      const mimeType = recorder?.mimeType || "audio/webm";
      console.log(`[STOP] Recorder state: ${recorder?.state || 'null'}, mimeType: ${mimeType}`);

      const cleanup = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            console.log(`[STOP] Stopping track: ${track.label}, enabled=${track.enabled}`);
            track.stop();
          });
          streamRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        analyserRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
      };

      const buildResult = async (): Promise<string | null> => {
        console.log(`[STOP] Building result from ${allChunksRef.current.length} chunks`);
        try {
          await flushPendingChunks();
        } catch (e) {
          console.warn("[STOP] Final flush error:", e);
        }
        if (allChunksRef.current.length === 0) {
          console.warn("[STOP] No chunks available — returning null");
          return null;
        }
        const blob = new Blob(allChunksRef.current, { type: mimeType });
        console.log(`[STOP] Final blob: ${blob.size} bytes`);
        return new Promise<string | null>((res) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const b64 = (reader.result as string).split(",")[1];
            console.log(`[STOP] Final base64 length: ${b64?.length || 0}`);
            res(b64);
          };
          reader.onerror = () => {
            console.error("[STOP] FileReader error");
            res(null);
          };
          reader.readAsDataURL(blob);
        });
      };

      if (!recorder || recorder.state === "inactive") {
        console.log("[STOP] Recorder already inactive, building result directly");
        cleanup();
        const result = await buildResult();
        resolve(result);
        return;
      }

      let resolved = false;
      recorder.onstop = async () => {
        if (resolved) return;
        resolved = true;
        console.log("[STOP] Recorder onstop fired, cleaning up then building result");
        cleanup();
        const result = await buildResult();
        resolve(result);
      };

      try {
        recorder.stop();
        console.log("[STOP] recorder.stop() called successfully");
      } catch (e) {
        console.warn("[STOP] recorder.stop() error:", e);
        cleanup();
      }

      setTimeout(async () => {
        if (!resolved) {
          resolved = true;
          console.warn("[STOP] Timeout fallback — cleaning up and building result");
          cleanup();
          const result = await buildResult();
          resolve(result);
        }
      }, 3000);
    });
  }, [flushPendingChunks]);

  const resetMicError = useCallback(() => {
    setMicError(null);
  }, []);

  return { isRecording, startRecording, stopRecording, micError, resetMicError, audioLevel };
}

function AudioPlayer({ visitId, hasAudio }: { visitId: string; hasAudio: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    if (!hasAudio || audioRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const token = sessionStorage.getItem("session_token");
        const res = await fetch(`/api/visits/${visitId}/audio`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) { if (!cancelled) setAudioError(true); return; }
        if (cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        const audio = new Audio(url);
        audio.addEventListener("loadedmetadata", () => {
          if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
        });
        audio.addEventListener("durationchange", () => {
          if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
        });
        audio.addEventListener("timeupdate", () => {
          setCurrentTime(audio.currentTime);
          if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
        });
        audio.addEventListener("ended", () => setIsPlaying(false));
        audio.addEventListener("error", () => setAudioError(true));
        audioRef.current = audio;
        setAudioReady(true);
      } catch {
        if (!cancelled) setAudioError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [visitId, hasAudio]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s) || !isFinite(s)) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 && isFinite(duration) ? (currentTime / duration) * 100 : 0;

  if (!hasAudio) {
    return (
      <div className="bg-muted/50 p-3 rounded-md text-center text-sm text-muted-foreground">
        <Volume2 className="h-4 w-4 mx-auto mb-1 opacity-50" />
        No recorded audio (simulated transcript used)
      </div>
    );
  }

  if (audioError) {
    return (
      <div className="bg-muted/50 p-3 rounded-md text-center text-sm text-muted-foreground">
        <Volume2 className="h-4 w-4 mx-auto mb-1 opacity-50" />
        Audio could not be loaded
      </div>
    );
  }

  return (
    <div className="bg-muted/50 p-3 rounded-md space-y-2">
      <div className="flex items-center gap-3">
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-9 w-9 rounded-full bg-white shadow-sm hover:bg-primary/10"
          onClick={togglePlayback}
          data-testid="button-play-audio"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        <div className="flex-1">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-200" 
              style={{ width: `${progressPct}%` }} 
            />
          </div>
        </div>
        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

export default function ActiveVisit() {
  const [, params] = useRoute("/visit/:id");
  const visitId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const { features: planFeatures } = usePlanFeatures();
  const canSendWhatsApp = (planFeatures.prescriptionChannels || "").split(",").some((c: string) => c === "whatsapp" || c === "all");

  const [recordingTime, setRecordingTime] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedSummary, setEditedSummary] = useState<string | null>(null);
  const [editedComplaint, setEditedComplaint] = useState<string | null>(null);
  const [micStarted, setMicStarted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [chunksProcessed, setChunksProcessed] = useState(0);

  const handleTranscriptUpdate = useCallback((text: string) => {
    setLiveTranscript(text);
    setChunksProcessed(prev => prev + 1);
  }, []);

  const { isRecording, startRecording, stopRecording, micError, resetMicError, audioLevel } = useAudioRecorder(visitId, handleTranscriptUpdate);

  const recordingWaveHeights = useMemo(() => Array.from({ length: 20 }, () => Math.max(20, Math.random() * 100)), []);

  const { data: visitData, isLoading } = useQuery<any>({
    queryKey: ["/api/visits", visitId],
    enabled: !!visitId,
    refetchInterval: false,
  });

  const { data: visitAlternatives = [] } = useQuery<any[]>({
    queryKey: ["/api/visits", visitId, "alternatives"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/visits/${visitId}/alternatives`);
      return res.json();
    },
    enabled: !!visitId,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const visit = visitData;
  const currentStatus = visit?.status || "recording";

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isProcessing) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isProcessing]);

  const handleStartMic = useCallback(() => {
    console.log("[PAGE] handleStartMic tapped by user");
    setMicStarted(true);
    startRecording();
  }, [startRecording]);

  // No auto-start: user must tap the button to start recording (user gesture required for getUserMedia on published domains)
  console.log(`[PAGE] Render — status=${currentStatus}, isRecording=${isRecording}, micStarted=${micStarted}, micError=${micError}, isProcessing=${isProcessing}, chunks=${chunksProcessed}`);

  useEffect(() => {
    if (!isProcessing) {
      setProcessingProgress(0);
    }
  }, [isProcessing]);

  const processMutation = useMutation({
    mutationFn: async () => {
      console.log(`[FINALIZE] Starting finalize process, chunksProcessed=${chunksProcessed}, isRecording=${isRecording}, micStarted=${micStarted}`);

      if (!micStarted && !isRecording) {
        throw new Error("Please tap 'Start Consultation' first and speak during the consultation before processing.");
      }

      setIsProcessing(true);
      setProcessingProgress(0);

      let fullAudioBase64: string | null = null;
      try {
        fullAudioBase64 = await stopRecording();
        console.log(`[FINALIZE] stopRecording returned: ${fullAudioBase64 ? `${fullAudioBase64.length} chars` : 'null'}`);
      } catch (e) {
        console.warn("[FINALIZE] Could not stop recording:", e);
      }

      if (!fullAudioBase64 && chunksProcessed === 0) {
        setIsProcessing(false);
        throw new Error("No audio was captured. Please ensure the microphone is working and try the consultation again.");
      }

      setProcessingProgress(10);

      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 90) return 90;
          return prev + (90 - prev) * 0.08;
        });
      }, 400);
      try {
        const body: any = {
          hadChunks: chunksProcessed > 0,
        };
        if (fullAudioBase64) {
          body.fullAudio = fullAudioBase64;
        }
        console.log(`[FINALIZE] Calling /api/visits/${visitId}/finalize — hadChunks=${body.hadChunks}, hasFullAudio=${!!fullAudioBase64}`);
        const res = await apiRequest("POST", `/api/visits/${visitId}/finalize`, body);
        clearInterval(progressInterval);
        setProcessingProgress(100);
        console.log(`[FINALIZE] Server responded: status=${res.status}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        const data = await res.json();
        console.log(`[FINALIZE] Response data keys: ${Object.keys(data).join(', ')}`);
        return data;
      } catch (err: any) {
        clearInterval(progressInterval);
        console.error(`[FINALIZE] Error: ${err.message}`);
        throw err;
      }
    },
    onSuccess: () => {
      console.log("[FINALIZE] Success — invalidating queries");
      setIsProcessing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
    },
    onError: (err: Error) => {
      console.error("[FINALIZE] Mutation error:", err.message);
      setIsProcessing(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/visits/${visitId}/approve`);
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/visits", visitId] });
      const prev = queryClient.getQueryData(["/api/visits", visitId]);
      queryClient.setQueryData(["/api/visits", visitId], (old: any) => {
        if (!old) return old;
        return { ...old, status: "active", approved: true };
      });
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/adherence"] });
      toast({ title: "Care Path Activated", description: "The care plan has been approved and is now active." });
    },
    onError: (err: Error, _vars: void, context: any) => {
      if (context?.prev) queryClient.setQueryData(["/api/visits", visitId], context.prev);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const sendWhatsappPdfMutation = useMutation({
    mutationFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/visits/${visitId}/send-prescription-whatsapp`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Prescription Sent", description: "Prescription PDF has been sent to the patient's WhatsApp." });
    },
    onError: (err: Error) => {
      toast({ title: "WhatsApp Send Failed", description: err.message, variant: "destructive" });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const currentDraft = visit?.aiDraftJson as any || {};
      const updatedDraft = { ...currentDraft };
      if (editedSummary !== null) updatedDraft.summary = editedSummary;
      if (editedComplaint !== null) updatedDraft.complaint = editedComplaint;

      const res = await apiRequest("PATCH", `/api/visits/${visitId}`, { 
        status: "draft",
        aiDraftJson: updatedDraft,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
      toast({ title: "Draft Saved", description: "Changes saved successfully." });
    }
  });

  const reextractMutation = useMutation({
    mutationFn: async () => {
      const lang = displayLanguage || visit?.language || "English";
      const res = await apiRequest("POST", `/api/visits/${visitId}/reextract`, { language: lang });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
      toast({ title: "Re-extracted", description: "Care plan re-generated in the selected language." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/visits/${visitId}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Visit Cancelled", description: "The consultation has been cancelled." });
      setLocation("/");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteMedicineMutation = useMutation({
    mutationFn: async (medId: string) => {
      await apiRequest("DELETE", `/api/medicines/${medId}`);
    },
    onMutate: async (medId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/visits", visitId] });
      const prev = queryClient.getQueryData(["/api/visits", visitId]);
      queryClient.setQueryData(["/api/visits", visitId], (old: any) => {
        if (!old) return old;
        return { ...old, medicines: old.medicines?.filter((m: any) => m.id !== medId) };
      });
      return { prev };
    },
    onError: (_err: any, _medId: string, context: any) => {
      if (context?.prev) queryClient.setQueryData(["/api/visits", visitId], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
    }
  });


  const [editingMedicine, setEditingMedicine] = useState<any>(null);
  const [addingMedicine, setAddingMedicine] = useState(false);
  const [medForm, setMedForm] = useState({ name: "", dose: "", frequency: "", timing: "", instructions: "" });
  const [translateLang, setTranslateLang] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [includeAlternatives, setIncludeAlternatives] = useState(false);
  const [displayLanguage, setDisplayLanguage] = useState("");

  useEffect(() => {
    if (visit?.language && !displayLanguage) {
      setDisplayLanguage(visit.language);
    }
  }, [visit?.language]);

  const updateMedicineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/medicines/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      setEditingMedicine(null);
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
      toast({ title: "Medicine updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const addMedicineMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/visits/${visitId}/medicines`, data);
      return res.json();
    },
    onSuccess: () => {
      setAddingMedicine(false);
      setMedForm({ name: "", dose: "", frequency: "", timing: "", instructions: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
      toast({ title: "Medicine added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const translateMutation = useMutation({
    mutationFn: async ({ text, targetLanguage }: { text: string; targetLanguage: string }) => {
      const res = await apiRequest("POST", "/api/translate", { text, targetLanguage });
      return res.json();
    },
    onSuccess: (data: { translatedText: string }) => {
      setTranslatedText(data.translatedText);
    },
    onError: (err: Error) => {
      toast({ title: "Translation failed", description: err.message, variant: "destructive" });
    }
  });

  const { data: diarizedTranscript } = useQuery({
    queryKey: ["/api/visits", visitId, "diarized-transcript"],
    queryFn: async () => {
      const dToken = getSessionToken();
      const res = await fetch(`/api/visits/${visitId}/diarized-transcript`, { headers: { ...(dToken ? { Authorization: `Bearer ${dToken}` } : {}) } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!visitId,
  });

  const diarizeMutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await apiRequest("POST", `/api/visits/${visitId}/diarize`);
        return res.json();
      } catch (err: any) {
        const errText = err.message || "";
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId, "diarized-transcript"] });
    },
    onError: (err: Error) => {
      toast({ title: "Speaker identification failed", description: err.message, variant: "destructive" });
    }
  });

  const autoDiarizeTriggered = useRef(false);
  useEffect(() => {
    if (
      visit?.transcriptText &&
      !diarizedTranscript &&
      !diarizeMutation.isPending &&
      !autoDiarizeTriggered.current
    ) {
      autoDiarizeTriggered.current = true;
      diarizeMutation.mutate();
    }
  }, [visit?.transcriptText, diarizedTranscript, diarizeMutation.isPending]);

  const deleteTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      await apiRequest("DELETE", `/api/tests/${testId}`);
    },
    onMutate: async (testId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/visits", visitId] });
      const prev = queryClient.getQueryData(["/api/visits", visitId]);
      queryClient.setQueryData(["/api/visits", visitId], (old: any) => {
        if (!old) return old;
        return { ...old, tests: old.tests?.filter((t: any) => t.id !== testId) };
      });
      return { prev };
    },
    onError: (_err: any, _testId: string, context: any) => {
      if (context?.prev) queryClient.setQueryData(["/api/visits", visitId], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
    }
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const medicines = visit?.medicines || [];
  const visitTests = visit?.tests || [];
  const followups = visit?.followups || [];

  const freeTextTerms = useMemo(() => {
    const terms: string[] = [];
    visitTests.forEach((tt: any) => {
      if (tt.whenToDo) terms.push(tt.whenToDo);
      if (tt.triggerCondition) terms.push(tt.triggerCondition);
      if (tt.urgency) terms.push(tt.urgency);
    });
    medicines.forEach((m: any) => {
      if (m.frequency) terms.push(m.frequency);
      if (m.timing) terms.push(m.timing);
      if (m.instructions) terms.push(m.instructions);
    });
    followups.forEach((f: any) => {
      if (f.notes) terms.push(f.notes);
    });
    return [...new Set(terms.filter(Boolean))];
  }, [visitTests, medicines, followups]);

  const effectiveLang = displayLanguage || visit?.language || "English";

  const { data: aiTranslations } = useQuery({
    queryKey: ["/api/translate-terms", effectiveLang, freeTextTerms.join("|")],
    queryFn: async () => {
      if (effectiveLang === "English" || freeTextTerms.length === 0) return {};
      const untranslated = freeTextTerms.filter(term => translateMedicalTerm(term, effectiveLang) === term);
      if (untranslated.length === 0) return {};
      const res = await apiRequest("POST", "/api/translate-terms", { terms: untranslated, language: effectiveLang });
      return res.json();
    },
    enabled: effectiveLang !== "English" && freeTextTerms.length > 0,
    staleTime: Infinity,
  });

  const t = useCallback((text: string | null | undefined): string => {
    if (!text) return "—";
    if (effectiveLang === "English") return text;
    const staticResult = translateMedicalTerm(text, effectiveLang);
    if (staticResult !== text) return staticResult;
    if (aiTranslations && aiTranslations[text]) return aiTranslations[text];
    return text;
  }, [effectiveLang, aiTranslations]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="max-w-2xl mx-auto py-24 flex flex-col items-center justify-center text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <Loader2 className="h-16 w-16 text-primary animate-spin relative z-10" />
        </div>
        
        <h2 className="text-2xl font-bold mb-2">Generating Care Plan</h2>
        <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 px-3 py-1 mb-4">
          <Globe className="h-3.5 w-3.5 mr-1.5" />
          Processing in {visit?.language || "English"}
        </Badge>
        <p className="text-muted-foreground mb-8 max-w-md">
          Extracting clinical data: medicines, tests, diet, precautions, and follow-up...
        </p>

        <div className="w-full max-w-md space-y-2">
          <Progress value={processingProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span className={`${chunksProcessed > 0 ? "text-emerald-600" : processingProgress > 10 ? "text-primary" : ""}`}>
              Transcription
            </span>
            <span className={processingProgress > 30 ? "text-primary" : ""}>Carepath Extraction</span>
            <span className={processingProgress > 60 ? "text-primary" : ""}>Care Plan</span>
            <span className={processingProgress > 90 ? "text-primary" : ""}>Complete</span>
          </div>
        </div>
      </div>
    );
  }

  if (currentStatus === "recording") {
    return (
      <div className="max-w-3xl mx-auto py-12 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 mb-12">
          <Badge variant="outline" className={`px-4 py-1 ${isRecording ? "animate-pulse border-red-200 text-red-600 bg-red-50" : micError ? "border-red-200 text-red-600 bg-red-50" : "border-blue-200 text-blue-600 bg-blue-50"}`}>
            <div className={`h-2 w-2 rounded-full mr-2 ${isRecording ? "bg-red-600 animate-pulse" : micError ? "bg-red-500" : "bg-blue-500"}`} />
            {isRecording ? "Consultation in Progress" : micError ? "Microphone Error" : "Ready"}
          </Badge>
          <h1 className="text-6xl font-mono tabular-nums tracking-tighter text-foreground font-light" data-testid="text-recording-timer">
            {formatTime(recordingTime)}
          </h1>
          <p className="text-muted-foreground">
            Patient: {visit?.patient?.name || "Unknown"} ({visit?.patient?.age || "?"}
            {visit?.patient?.gender ? `, ${visit.patient.gender}` : ""})
          </p>
          <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 px-3 py-1 mx-auto">
            <Globe className="h-3.5 w-3.5 mr-1.5" />
            {visit?.language || "English"}
          </Badge>
        </div>

        {!isRecording && !isProcessing && currentStatus === "recording" && (
          <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-center max-w-md">
            <Mic className="h-10 w-10 mx-auto mb-3 text-blue-600" />
            {micError ? (
              <>
                <p className="font-semibold text-lg mb-2">Microphone Permission Required</p>
                <p className="text-sm text-blue-600 mb-4">Tap the button below and allow microphone access when your browser asks.</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-lg mb-2">Start Consultation</p>
                <p className="text-sm text-blue-600 mb-4">Tap the button below to begin the consultation. Your browser will ask for microphone permission.</p>
              </>
            )}
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-base w-full"
              onClick={handleStartMic}
              data-testid="button-start-mic"
            >
              <Mic className="h-5 w-5 mr-2" />
              {micError ? "Allow Microphone & Retry" : "Start Consultation"}
            </Button>
            {micError && (
              <p className="text-xs text-blue-400 mt-3">If permission was denied, go to your browser Settings &gt; Site Settings &gt; Microphone and allow access for this site.</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-1 h-32 mb-12 w-full max-w-md">
            {recordingWaveHeights.map((h, i) => {
              const liveHeight = isRecording 
                ? Math.max(15, h * (0.3 + audioLevel * 1.4)) 
                : h * 0.3;
              return (
                <div 
                  key={i} 
                  className={`w-3 rounded-full transition-all duration-150 ${isRecording ? "bg-red-400/60" : "bg-primary/15"}`}
                  style={{ 
                    height: `${liveHeight}%`,
                  }} 
                />
              );
            })}
          </div>

        {isRecording && (
          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5 text-red-500" />
            Microphone is live — speak naturally during the consultation
          </p>
        )}

        {liveTranscript && (
          <div className="w-full max-w-lg mb-6">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Live Transcript</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-200 text-emerald-600 bg-emerald-50">
                {chunksProcessed} chunks processed
              </Badge>
            </div>
            <div className="bg-white border rounded-lg p-3 max-h-32 overflow-y-auto shadow-sm">
              <p className="text-xs text-foreground/80 leading-relaxed" data-testid="text-live-transcript">
                {liveTranscript}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
            {isRecording && (
              <Button 
                data-testid="button-stop-recording"
                size="lg" 
                variant="destructive" 
                className="h-16 px-8 text-lg rounded-full shadow-lg hover:scale-105 transition-transform"
                onClick={() => processMutation.mutate()}
                disabled={processMutation.isPending || cancelMutation.isPending}
              >
                <Square className="mr-2 h-5 w-5 fill-current" />
                Stop & Process
              </Button>
            )}
            <Button
              data-testid="button-cancel-recording"
              size="lg"
              variant="outline"
              className="h-16 px-6 text-lg rounded-full"
              onClick={() => { 
                if (isRecording) { stopRecording(); }
                cancelMutation.mutate(); 
              }}
              disabled={processMutation.isPending || cancelMutation.isPending}
            >
              <X className="mr-2 h-5 w-5" />
              Cancel
            </Button>
        </div>
      </div>
    );
  }

  const aiDraft = visit?.aiDraftJson as any;
  const isApproved = currentStatus === "active";
  const isDraft = currentStatus === "draft";

  const buildCarePlanText = () => {
    const patientName = visit?.patient?.name || "Unknown";
    const visitDate = visit?.visitDate ? new Date(visit.visitDate).toLocaleDateString() : "Today";
    const lang = displayLanguage || visit?.language || "English";
    const summary = aiDraft?.summary || "";
    const complaint = aiDraft?.complaint || "";
    const diagnosis = aiDraft?.diagnosis_impression || (aiDraft?.diagnosis || []).join(", ") || "";

    const doctorName = authUser?.name || "Doctor";
    let text = `${doctorName} - Care Plan\n${"─".repeat(40)}\n`;
    text += `Patient: ${patientName}\nVisit Date: ${visitDate}\nLanguage: ${lang}\nStatus: ${isApproved ? "Approved" : "Draft"}\n`;
    text += `${"─".repeat(40)}\n`;

    if (complaint || diagnosis || summary) {
      text += `\n📋 CLINICAL SUMMARY\n`;
      if (complaint) text += `Complaint: ${complaint}\n`;
      if (diagnosis) text += `Provisional Diagnosis: ${diagnosis}\n`;
      if (summary) text += `${summary}\n`;
    }

    if (medicines.length > 0) {
      text += `\n💊 MEDICATIONS (${medicines.length})\n`;
      medicines.forEach((med: any, i: number) => {
        text += `${i + 1}. ${med.name || "—"} - ${med.dose || "—"}, ${t(med.frequency)}, ${t(med.timing)}${med.instructions ? ` (${t(med.instructions)})` : ""}\n`;
      });
    }

    if (visitTests.length > 0) {
      text += `\n🔬 TESTS (${visitTests.length})\n`;
      visitTests.forEach((test: any, i: number) => {
        text += `${i + 1}. ${test.name || "—"} - ${t(test.whenToDo) || "—"} (${t(test.urgency) || "—"})\n`;
      });
    }

    if (followups.length > 0) {
      text += `\n📅 FOLLOW-UP\n`;
      followups.forEach((f: any) => {
        text += `Follow-up after ${f.followupAfterDays || "—"} days`;
        let specificDate = f.followupDate;
        if (!specificDate && f.followupAfterDays && visit?.visitDate) {
          const d = new Date(visit.visitDate);
          d.setDate(d.getDate() + Number(f.followupAfterDays));
          specificDate = d.toLocaleDateString();
        }
        if (specificDate) text += ` (Date: ${specificDate})`;
        if (f.notes) text += ` | ${f.notes}`;
        text += `\n`;
        if (f.warningSigns?.length) text += `Warning Signs: ${f.warningSigns.join(", ")}\n`;
      });
    }

    if (includeTranscript && visit?.transcriptText) {
      const doctorDisplayName = authUser?.name || "Doctor";
      const patientDisplayName = visit?.patient?.name || "Patient";
      if (diarizedTranscript?.diarizedTranscript) {
        const formatted = diarizedTranscript.diarizedTranscript
          .split('\n')
          .map((line: string) => {
            if (line.startsWith('DR:')) return `${doctorDisplayName}: ${line.replace('DR:', '').trim()}`;
            const pm = line.match(/^(PATIENT\s*\d*):/);
            if (pm) return `${pm[1].trim()}: ${line.replace(/^PATIENT\s*\d*:/, '').trim()}`;
            if (line.startsWith('PATIENT:')) return `${patientDisplayName}: ${line.replace('PATIENT:', '').trim()}`;
            return line;
          })
          .join('\n');
        text += `\n📝 TRANSCRIPT\n${formatted}\n`;
      } else {
        text += `\n📝 TRANSCRIPT\n${visit.transcriptText}\n`;
      }
    }

    text += `\n${"─".repeat(40)}\nGenerated by ${doctorName} | ${new Date().toLocaleString()}\nPlease verify with the attending physician.`;
    return text;
  };

  const escHtml = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  const buildCarePlanHtml = () => {
    const patientName = escHtml(visit?.patient?.name || "Unknown");
    const patientId = visit?.patientId ? "CP-" + visit.patientId.slice(-8).toUpperCase() : "N/A";
    const visitDate = visit?.visitDate ? new Date(visit.visitDate).toLocaleDateString() : "Today";
    const visitDateTime = visit?.visitDate ? new Date(visit.visitDate).toLocaleString() : new Date().toLocaleString();
    const lang = displayLanguage || visit?.language || "English";
    const summary = escHtml(aiDraft?.summary || "");
    const complaint = escHtml(aiDraft?.complaint || "");
    const diagnosis = escHtml(aiDraft?.diagnosis_impression || (aiDraft?.diagnosis || []).join(", ") || "");
    const doctorPhoto = (authUser?.profilePhoto || "").startsWith("data:image/") ? authUser!.profilePhoto : "";
    const doctorPhone = escHtml(authUser?.phone || "");
    const doctorEmail = escHtml(authUser?.email || "");
    const doctorClinicName = escHtml(authUser?.clinicName || "");
    const doctorClinicAddress = escHtml(authUser?.clinicAddress || "");
    const doctorSpecialization = escHtml(authUser?.specialization || "");
    const doctorQualifications = escHtml(authUser?.qualifications || "");

    let medsRows = "";
    medicines.forEach((med: any, i: number) => {
      let altText = "";
      if (includeAlternatives) {
        const medAlts = visitAlternatives.filter((a: any) => a.medicineId === med.id);
        altText = medAlts.length > 0 ? ` <span style="color:#888; font-weight:normal; font-size:12px">/ ${medAlts.slice(0, 3).map((a: any) => a.alternativeName).join(" / ")}</span>` : "";
      }
      medsRows += `<tr><td>${i + 1}</td><td><strong>${med.name || "—"}</strong>${altText}</td><td>${med.dose || "—"}</td><td>${t(med.frequency)}</td><td>${t(med.timing)}</td><td>${t(med.instructions)}</td></tr>`;
    });

    let testsRows = "";
    visitTests.forEach((test: any, i: number) => {
      testsRows += `<tr><td>${i + 1}</td><td>${test.name || "—"}</td><td>${t(test.whenToDo) || "—"}</td><td>${t(test.urgency) || "—"}</td><td>${t(test.triggerCondition) || "—"}</td></tr>`;
    });

    let followupHtml = "";
    followups.forEach((f: any) => {
      let specificDate = f.followupDate;
      if (!specificDate && f.followupAfterDays && visit?.visitDate) {
        const d = new Date(visit.visitDate);
        d.setDate(d.getDate() + Number(f.followupAfterDays));
        specificDate = d.toLocaleDateString();
      }
      followupHtml += `<p><strong>Follow-up after:</strong> ${f.followupAfterDays || "—"} days`;
      if (specificDate) followupHtml += ` &nbsp;|&nbsp; <strong>Date:</strong> ${specificDate}`;
      followupHtml += `</p>`;
      if (f.notes) followupHtml += `<p><strong>Notes:</strong> ${f.notes}</p>`;
      if (f.warningSigns?.length) followupHtml += `<p><strong>Warning Signs:</strong> ${f.warningSigns.join(", ")}</p>`;
    });

    let transcriptHtml = "";
    if (includeTranscript && visit?.transcriptText) {
      const doctorName = authUser?.name || "Doctor";
      const patientName2 = visit?.patient?.name || "Patient";
      if (diarizedTranscript?.diarizedTranscript) {
        const lines = diarizedTranscript.diarizedTranscript.split('\n').filter((l: string) => l.trim());
        transcriptHtml = lines.map((line: string) => {
          const escaped = escHtml(line);
          if (line.startsWith('DR:')) {
            const content = escaped.replace('DR:', '').trim();
            return `<div style="margin-bottom:8px;display:flex;align-items:flex-start;gap:8px;"><span style="display:inline-block;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;white-space:nowrap;flex-shrink:0;">🩺 ${escHtml(doctorName)}</span><span style="flex:1">${content}</span></div>`;
          }
          const patientMatch = line.match(/^(PATIENT\s*\d*):/);
          if (patientMatch) {
            const label = patientMatch[1].trim() || "Patient";
            const content = escaped.replace(/^PATIENT\s*\d*:/, '').trim();
            return `<div style="margin-bottom:8px;display:flex;align-items:flex-start;gap:8px;"><span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;white-space:nowrap;flex-shrink:0;">👤 ${escHtml(label)}</span><span style="flex:1">${content}</span></div>`;
          }
          if (line.startsWith('PATIENT:')) {
            const content = escaped.replace('PATIENT:', '').trim();
            return `<div style="margin-bottom:8px;display:flex;align-items:flex-start;gap:8px;"><span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;white-space:nowrap;flex-shrink:0;">👤 ${escHtml(patientName2)}</span><span style="flex:1">${content}</span></div>`;
          }
          return `<div style="margin-bottom:8px;">${escaped}</div>`;
        }).join('');
      } else {
        transcriptHtml = `<pre style="white-space:pre-wrap;font-size:11px;">${visit.transcriptText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
      }
    }

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Care Plan</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1a1a1a; font-size: 13px; line-height: 1.5; }
  .header { border-bottom: 3px solid #1a56db; padding-bottom: 15px; margin-bottom: 20px; }
  .header-top { display: flex; align-items: center; gap: 16px; }
  .header-top img { width: 64px; height: 64px; object-fit: cover; border-radius: 50%; border: 3px solid #1a56db; flex-shrink: 0; }
  .header-top .dr-initials { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg,#1a56db,#3b82f6); display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 700; border: 3px solid #1a56db; flex-shrink: 0; }
  .header-info { flex: 1; }
  .header-info h1 { font-size: 22px; color: #1a56db; margin: 0 0 2px 0; line-height: 1.2; }
  .header-info .dr-qual { font-size: 12px; color: #555; margin: 0 0 1px 0; line-height: 1.4; }
  .header-info .clinic-info { font-size: 13px; color: #1a56db; font-weight: 600; margin: 4px 0 0 0; }
  .header-subtitle { text-align: center; color: #555; font-size: 13px; margin-top: 10px; font-weight: 500; letter-spacing: 0.3px; }
  .patient-info { display: flex; gap: 30px; background: #f0f5ff; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; flex-wrap: wrap; }
  .patient-info div { font-size: 13px; }
  .patient-info strong { color: #1a56db; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 15px; font-weight: 700; color: #1a56db; border-bottom: 2px solid #e5edff; padding-bottom: 6px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #1a56db; color: white; padding: 8px 10px; text-align: left; font-size: 12px; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
  tr:nth-child(even) { background: #f9fafb; }
  .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-top: 6px; }
  .transcript-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-top: 6px; white-space: pre-wrap; font-size: 11px; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid #1a56db; color: #555; font-size: 11px; }
  .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 8px; }
  .footer-grid div { font-size: 12px; }
  .footer-grid strong { color: #1a56db; }
  .footer-note { text-align: center; font-size: 10px; color: #888; margin-top: 8px; }
  @media print {
    body { padding: 15px; }
    .section, .transcript-box, .summary-box { page-break-inside: auto; overflow: visible !important; max-height: none !important; }
    .section-title { page-break-after: avoid; }
    .footer { page-break-inside: avoid; }
  }
</style></head><body>
<div class="header">
  <div class="header-top">
    ${doctorPhoto ? `<img src="${doctorPhoto}" alt="Doctor Photo" />` : `<div class="dr-initials">${(authUser?.name || "D").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2)}</div>`}
    <div class="header-info">
      <h1>${authUser?.name || "Doctor"}</h1>
      ${doctorQualifications ? `<p class="dr-qual">${doctorQualifications}</p>` : ""}
      ${doctorSpecialization ? `<p class="dr-qual">${doctorSpecialization}</p>` : ""}
      ${doctorClinicName ? `<p class="clinic-info">${doctorClinicName}</p>` : ""}
    </div>
  </div>
  <p class="header-subtitle">Medical Consultation Report</p>
</div>
<div class="patient-info">
  <div><strong>Patient:</strong> ${patientName}</div>
  <div><strong>Patient ID:</strong> ${patientId}</div>
  <div><strong>Visit Date:</strong> ${visitDate}</div>
  <div><strong>Language:</strong> ${lang}</div>
  <div><strong>Status:</strong> ${isApproved ? "Approved" : "Draft"}</div>
</div>
${complaint || diagnosis || summary ? `
<div class="section">
  <div class="section-title">Clinical Summary</div>
  <div class="summary-box">
    ${complaint ? `<p><strong>Complaint:</strong> ${complaint}</p>` : ""}
    ${diagnosis ? `<p><strong>Provisional Diagnosis:</strong> ${diagnosis}</p>` : ""}
    ${summary ? `<p style="margin-top:6px">${summary}</p>` : ""}
  </div>
</div>` : ""}
<div class="section">
  <div class="section-title">Prescribed Medications (${medicines.length})</div>
  ${medicines.length > 0 ? `
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Timing</th><th>Duration / Instructions</th></tr></thead>
    <tbody>${medsRows}</tbody>
  </table>` : `<p style="color:#888; padding:10px 0;">No medicines prescribed.</p>`}
</div>
<div class="section">
  <div class="section-title">Lab Tests & Diagnostics (${visitTests.length})</div>
  ${visitTests.length > 0 ? `
  <table>
    <thead><tr><th>#</th><th>Test Name</th><th>When to Do</th><th>Urgency</th><th>Trigger Condition</th></tr></thead>
    <tbody>${testsRows}</tbody>
  </table>` : `<p style="color:#888; padding:10px 0;">No tests ordered.</p>`}
</div>
<div class="section">
  <div class="section-title">Follow-Up</div>
  ${followups.length > 0 ? `<div class="summary-box">${followupHtml}</div>` : `<p style="color:#888; padding:10px 0;">No follow-up scheduled.</p>`}
</div>
${transcriptHtml ? `
<div class="section">
  <div class="section-title">Full Transcript</div>
  <div class="transcript-box">${transcriptHtml}</div>
</div>` : ""}
<div class="footer">
  <div class="footer-grid">
    ${doctorPhone ? `<div><strong>Phone:</strong> ${doctorPhone}</div>` : ""}
    ${doctorEmail ? `<div><strong>Email:</strong> ${doctorEmail}</div>` : ""}
    ${doctorClinicName ? `<div><strong>Clinic:</strong> ${doctorClinicName}</div>` : ""}
    ${doctorClinicAddress ? `<div><strong>Address:</strong> ${doctorClinicAddress}</div>` : ""}
  </div>
  <p class="footer-note">Generated on ${new Date().toLocaleString()} | This is a computer-generated document. Please verify with the attending physician.</p>
</div>
</body></html>`;
  };

  const handlePrint = async () => {
    await queryClient.refetchQueries({ queryKey: ["/api/visits", visitId, "alternatives"] });
    const printWindow = window.open("", "_blank");
    if (!printWindow) { window.print(); return; }
    printWindow.document.write(buildCarePlanHtml());
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const generateShareLink = async (): Promise<string | null> => {
    if (shareUrl) return shareUrl;
    setIsGeneratingLink(true);
    try {
      const shareToken = getSessionToken();
      const resp = await fetch(`/api/visits/${visitId}/share`, { method: "POST", headers: { ...(shareToken ? { Authorization: `Bearer ${shareToken}` } : {}) } });
      if (!resp.ok) throw new Error("Failed to generate share link");
      const data = await resp.json();
      setShareUrl(data.shareUrl);
      return data.shareUrl;
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate share link", variant: "destructive" });
      return null;
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const buildShareSummary = () => {
    const doctorName = authUser?.name || "Doctor";
    const patientName = visit?.patient?.name || "Unknown";
    const visitDate = visit?.visitDate ? new Date(visit.visitDate).toLocaleDateString() : "Today";
    const lang = displayLanguage || visit?.language || "English";
    const status = isApproved ? "Approved" : "Draft";
    let followupLine = "";
    if (followups.length > 0) {
      const f = followups[0] as any;
      let fDate = f.followupDate;
      if (!fDate && f.followupAfterDays && visit?.visitDate) {
        const d = new Date(visit.visitDate);
        d.setDate(d.getDate() + Number(f.followupAfterDays));
        fDate = d.toLocaleDateString();
      }
      followupLine = fDate ? `\nFollow-up Date: ${fDate}` : (f.followupAfterDays ? `\nFollow-up: After ${f.followupAfterDays} days` : "");
    }
    return `${doctorName} - Care Plan\n\nPatient: ${patientName}\nVisit Date: ${visitDate}\nLanguage: ${lang}\nStatus: ${status}${followupLine}`;
  };

  const handleShareWhatsApp = async () => {
    const link = await generateShareLink();
    if (!link) return;
    const text = `${buildShareSummary()}\n\n📄 *View & Download Full Prescription PDF:*\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    setShowShareModal(false);
  };

  const handleShareEmail = async () => {
    const link = await generateShareLink();
    if (!link) return;
    const patientName = visit?.patient?.name || "Unknown";
    const visitDate = visit?.visitDate ? new Date(visit.visitDate).toLocaleDateString() : "Today";
    const subject = `Care Plan - ${patientName} (${visitDate}) | ${authUser?.name || "Doctor"}`;
    const body = `${buildShareSummary()}\n\nView & Download Full Prescription PDF:\n${link}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setShowShareModal(false);
  };

  const handleShareSMS = async () => {
    const link = await generateShareLink();
    if (!link) return;
    const text = `${buildShareSummary()}\n\nView Prescription: ${link}`;
    window.location.href = `sms:?body=${encodeURIComponent(text)}`;
    setShowShareModal(false);
  };

  return (
    <div className="space-y-6">
      <AiMinutesWarning />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/active-care")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-visit-title">
              Review Care Plan
              {isApproved && <Badge className="bg-emerald-500 hover:bg-emerald-600">Approved</Badge>}
              {isDraft && <Badge variant="outline" className="border-orange-200 text-orange-600 bg-orange-50">Draft Review</Badge>}
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2 flex-wrap">
              Patient: {visit?.patient?.name || "Unknown"} • Visit Date: {visit?.visitDate ? new Date(visit.visitDate).toLocaleDateString() : "Today"}
              <Select value={displayLanguage || visit?.language || "English"} onValueChange={setDisplayLanguage}>
                <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs border-blue-200 text-blue-700 bg-blue-50 gap-1 px-2" data-testid="select-display-language">
                  <Globe className="h-3 w-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Punjabi", "Urdu", "Odia", "Assamese", "Konkani", "Goan Konkani", "Malay (Bahasa Melayu)"].map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
           {isDraft && (
             <>
               <Button 
                 data-testid="button-save-draft"
                 variant="outline" 
                 className="gap-2"
                 onClick={() => saveDraftMutation.mutate()}
                 disabled={saveDraftMutation.isPending}
               >
                 <Save className="h-4 w-4" />
                 <span className="hidden sm:inline">Save </span>Draft
               </Button>
               <Button 
                 data-testid="button-approve"
                 className="gap-2 bg-primary hover:bg-primary/90" 
                 onClick={() => approveMutation.mutate()}
                 disabled={approveMutation.isPending}
               >
                 <CheckCircle2 className="h-4 w-4" />
                 {approveMutation.isPending ? "Approving..." : <>Approve<span className="hidden sm:inline"> & Activate</span></>}
               </Button>
             </>
           )}
           {isApproved && (
             <>
               {canSendWhatsApp && <Button 
                 variant="secondary" 
                 className="gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100" 
                 data-testid="button-whatsapp-pdf"
                 onClick={() => sendWhatsappPdfMutation.mutate()}
                 disabled={sendWhatsappPdfMutation.isPending || !visit?.patient?.phone}
                 title={!visit?.patient?.phone ? "Patient has no phone number" : "Send prescription PDF via WhatsApp"}
               >
                 <MessageCircle className="h-4 w-4" />
                 {sendWhatsappPdfMutation.isPending ? "Sending..." : "Send PDF via WhatsApp"}
               </Button>}
               <Button variant="secondary" className="gap-2" data-testid="button-print" onClick={() => setShowShareModal(true)}>
                 <Share2 className="h-4 w-4" />
                 Print / Share
               </Button>
             </>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                Audio Source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AudioPlayer visitId={visitId || ""} hasAudio={visit?.hasAudio || false} />
              <div className="text-xs text-muted-foreground bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-100">
                <Info className="h-3 w-3 inline mr-1" />
                {visit?.transcriptText ? `Transcript available (${visit?.language || "English"}).` : "Audio recorded (transcript pending)."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Consultation Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                data-testid="textarea-summary"
                className="min-h-[120px] resize-none text-sm leading-relaxed" 
                value={editedSummary !== null ? editedSummary : (aiDraft?.summary || "")}
                onChange={(e) => setEditedSummary(e.target.value)}
                readOnly={isApproved}
              />
            </CardContent>
          </Card>

          {aiDraft?.diagnosis && aiDraft.diagnosis.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-purple-600" />
                  Provisional Diagnosis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {aiDraft.diagnosis.map((d: string, i: number) => (
                    <Badge key={i} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 px-3 py-1">
                      {d}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {aiDraft?.diet && aiDraft.diet.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-green-600" />
                  Diet Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {aiDraft.diet.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {aiDraft?.precautions && aiDraft.precautions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  Precautions & Lifestyle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {aiDraft.precautions.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {aiDraft?.red_flags && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  Red Flags / Emergency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-800">{aiDraft.red_flags}</p>
              </CardContent>
            </Card>
          )}

          {aiDraft?.needs_doctor_review && (
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                  <AlertCircle className="h-4 w-4" />
                  Needs Doctor Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-orange-700">Some parts of the transcript were unclear. Please review all extracted data carefully.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="medicines" className="w-full">
            <TabsList className="w-full justify-start h-auto sm:h-12 bg-white border p-1 gap-1 flex-wrap">
              <TabsTrigger data-testid="tab-medicines" value="medicines" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-2 sm:px-4 sm:h-full text-xs sm:text-sm">
                <Pill className="h-4 w-4 mr-1 sm:mr-2" />
                Medicines ({medicines.length})
              </TabsTrigger>
              <TabsTrigger data-testid="tab-tests" value="tests" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-2 sm:px-4 sm:h-full text-xs sm:text-sm">
                <Activity className="h-4 w-4 mr-1 sm:mr-2" />
                Tests ({visitTests.length})
              </TabsTrigger>
              <TabsTrigger data-testid="tab-followup" value="followup" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-2 sm:px-4 sm:h-full text-xs sm:text-sm">
                <CalendarClock className="h-4 w-4 mr-1 sm:mr-2" />
                Follow Up
              </TabsTrigger>
              <TabsTrigger data-testid="tab-transcript" value="transcript" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-2 sm:px-4 sm:h-full text-xs sm:text-sm">
                <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                Transcript
              </TabsTrigger>
            </TabsList>

            <Card className="mt-4 border-none shadow-sm ring-1 ring-border/50">
              <CardContent className="p-6">
                <TabsContent value="medicines" className="mt-0 space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg">Prescribed Medications</h3>
                    {isDraft && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setMedForm({ name: "", dose: "", frequency: "", timing: "", instructions: "" });
                          setAddingMedicine(true);
                          setEditingMedicine(null);
                        }}
                        data-testid="button-add-medicine"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Medicine
                      </Button>
                    )}
                  </div>

                  {addingMedicine && (
                    <div className="border rounded-lg p-4 bg-blue-50/50 space-y-3 mb-4">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Pill className="h-4 w-4 text-blue-600" />
                        Add New Medicine
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <MedicineAutocomplete
                          value={medForm.name}
                          onChange={(name) => setMedForm(f => ({ ...f, name }))}
                          onSelect={(med) => {
                            setMedForm(f => ({
                              ...f,
                              name: med.name,
                              dose: f.dose || med.strength || "",
                              frequency: f.frequency || "",
                              timing: f.timing || "",
                              instructions: f.instructions || "",
                            }));
                          }}
                          placeholder="Search medicine name *"
                          data-testid="input-add-med-name"
                        />
                        <Input placeholder="Dosage (e.g. 500mg)" value={medForm.dose} onChange={e => setMedForm(f => ({ ...f, dose: e.target.value }))} data-testid="input-add-med-dose" />
                        <Input placeholder="Frequency (e.g. Twice daily)" value={medForm.frequency} onChange={e => setMedForm(f => ({ ...f, frequency: e.target.value }))} data-testid="input-add-med-frequency" />
                        <Input placeholder="Timing (e.g. After food)" value={medForm.timing} onChange={e => setMedForm(f => ({ ...f, timing: e.target.value }))} data-testid="input-add-med-timing" />
                        <Input placeholder="Duration (e.g. 5 days)" value={medForm.instructions} onChange={e => setMedForm(f => ({ ...f, instructions: e.target.value }))} data-testid="input-add-med-duration" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setAddingMedicine(false)} data-testid="button-cancel-add-med">Cancel</Button>
                        <Button size="sm" disabled={!medForm.name.trim() || addMedicineMutation.isPending} onClick={() => addMedicineMutation.mutate(medForm)} data-testid="button-save-add-med">
                          {addMedicineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {medicines.length > 0 ? (
                    <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[180px]">Medicine</TableHead>
                          <TableHead>Dosage</TableHead>
                          <TableHead className="hidden sm:table-cell">Frequency</TableHead>
                          <TableHead className="hidden sm:table-cell">Timing</TableHead>
                          <TableHead className="hidden md:table-cell">Duration</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medicines.map((med: any) => (
                          editingMedicine?.id === med.id ? (
                            <TableRow key={med.id} className="bg-blue-50/30">
                              <TableCell>
                                <MedicineAutocomplete
                                  value={editingMedicine.name}
                                  onChange={(name) => setEditingMedicine((p: any) => ({ ...p, name }))}
                                  onSelect={(ref) => {
                                    setEditingMedicine((p: any) => ({
                                      ...p,
                                      name: ref.name,
                                      dose: p.dose || ref.strength || "",
                                    }));
                                  }}
                                  className="h-8 text-sm"
                                  data-testid={`input-edit-med-name-${med.id}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input className="h-8 text-sm" value={editingMedicine.dose || ""} onChange={e => setEditingMedicine((p: any) => ({ ...p, dose: e.target.value }))} data-testid={`input-edit-med-dose-${med.id}`} />
                              </TableCell>
                              <TableCell>
                                <Input className="h-8 text-sm" value={editingMedicine.frequency || ""} onChange={e => setEditingMedicine((p: any) => ({ ...p, frequency: e.target.value }))} data-testid={`input-edit-med-freq-${med.id}`} />
                              </TableCell>
                              <TableCell>
                                <Input className="h-8 text-sm" value={editingMedicine.timing || ""} onChange={e => setEditingMedicine((p: any) => ({ ...p, timing: e.target.value }))} data-testid={`input-edit-med-timing-${med.id}`} />
                              </TableCell>
                              <TableCell>
                                <Input className="h-8 text-sm" value={editingMedicine.instructions || ""} onChange={e => setEditingMedicine((p: any) => ({ ...p, instructions: e.target.value }))} data-testid={`input-edit-med-dur-${med.id}`} />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingMedicine(null)} data-testid={`button-cancel-edit-${med.id}`}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                                    disabled={updateMedicineMutation.isPending}
                                    onClick={() => updateMedicineMutation.mutate({ id: med.id, data: { name: editingMedicine.name, dose: editingMedicine.dose, frequency: editingMedicine.frequency, instructions: editingMedicine.instructions, timing: editingMedicine.timing } })}
                                    data-testid={`button-save-edit-${med.id}`}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            <TableRow key={med.id} data-testid={`row-medicine-${med.id}`}>
                              <TableCell className="font-medium">
                                <div>
                                  <span className="font-bold text-foreground">{med.name}</span>
                                  {(() => {
                                    const medAlts = visitAlternatives.filter((a: any) => a.medicineId === med.id);
                                    if (medAlts.length > 0) {
                                      return (
                                        <span className="text-muted-foreground font-normal text-sm">
                                          {" / "}
                                          {medAlts.slice(0, 3).map((a: any) => a.alternativeName).join(" / ")}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {med.saltComposition && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5">{med.saltComposition}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell><span className="font-medium">{med.dose || "—"}</span></TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100">
                                  {t(med.frequency)}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-100">
                                  {t(med.timing)}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">{t(med.instructions)}</TableCell>
                              <TableCell className="text-right">
                                {isDraft ? (
                                  <div className="flex gap-1 justify-end">
                                    <Button 
                                      variant="ghost" size="sm" 
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600"
                                      onClick={() => { setEditingMedicine({ ...med }); setAddingMedicine(false); }}
                                      data-testid={`button-edit-med-${med.id}`}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button 
                                      variant="ghost" size="sm" 
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => deleteMedicineMutation.mutate(med.id)}
                                      data-testid={`button-delete-med-${med.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-8">No medicines prescribed yet.</p>
                  )}
                </TabsContent>

                <TabsContent value="tests" className="mt-0">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg mb-4">Lab Tests & Diagnostics</h3>
                    {visitTests.length > 0 ? visitTests.map((test: any) => (
                      <div key={test.id} data-testid={`card-test-${test.id}`} className="p-4 border rounded-lg bg-card hover:bg-accent/10 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4">
                            <div className="h-10 w-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                              <Activity className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-medium">{test.name}</h4>
                              {test.whenToDo && <p className="text-sm text-muted-foreground mt-1">Schedule: {t(test.whenToDo)}</p>}
                              {test.triggerCondition && (
                                 <div className="flex items-center gap-1 mt-2 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded w-fit">
                                   <AlertCircle className="h-3 w-3" />
                                   Trigger: {t(test.triggerCondition)}
                                 </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={test.urgency === "Routine" ? "secondary" : "default"}>
                              {t(test.urgency) || "Standard"}
                            </Badge>
                            {isDraft && (
                              <Button 
                                variant="ghost" size="sm" 
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteTestMutation.mutate(test.id)}
                                data-testid={`button-delete-test-${test.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <LabReportUpload test={test} visitId={visitId || ""} isApproved={isApproved} />
                      </div>
                    )) : (
                      <p className="text-muted-foreground text-sm text-center py-8">No tests ordered.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="followup" className="mt-0">
                   {followups.length > 0 ? followups.map((fup: any) => (
                     <div key={fup.id} className="grid gap-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-sm font-medium">Follow-up After (Days)</label>
                             <Input data-testid="input-followup-days" defaultValue={fup.followupAfterDays || ""} readOnly={isApproved} />
                          </div>
                          <div className="space-y-2">
                             <label className="text-sm font-medium">Specific Date</label>
                             <Input data-testid="input-followup-date" type="date" defaultValue={(() => {
                               if (fup.followupDate) return fup.followupDate;
                               if (fup.followupAfterDays && visit?.visitDate) {
                                 const d = new Date(visit.visitDate);
                                 d.setDate(d.getDate() + Number(fup.followupAfterDays));
                                 return d.toISOString().split("T")[0];
                               }
                               return "";
                             })()} readOnly={isApproved} />
                          </div>
                        </div>
                        
                        {fup.notes && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Follow-up Notes</label>
                            <Textarea defaultValue={fup.notes} readOnly={isApproved} className="min-h-[80px]" />
                          </div>
                        )}

                        {fup.warningSigns && fup.warningSigns.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-destructive" />
                              Warning Signs (Immediate Return)
                            </label>
                            <div className="bg-red-50 border border-red-100 rounded-md p-4 space-y-2">
                              {fup.warningSigns.map((sign: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-red-800">
                                  <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                  {sign}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                     </div>
                   )) : (
                     <p className="text-muted-foreground text-sm text-center py-8">No follow-up scheduled.</p>
                   )}
                </TabsContent>
                
                <TabsContent value="transcript" className="mt-0">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Full Transcript</h3>

                    {diarizeMutation.isPending && (
                      <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Analyzing speakers and formatting transcript...
                      </div>
                    )}

                    {!diarizeMutation.isPending && diarizedTranscript && visit?.transcriptText ? (
                      <div className="bg-muted/20 rounded-lg p-4 max-h-[500px] overflow-y-auto space-y-2">
                        {diarizedTranscript.diarizedTranscript.split('\n').map((line: string, i: number) => {
                          const isDr = line.startsWith('DR:');
                          const patientMatch = line.match(/^PATIENT(\d*):(.*)$/);
                          const isPatient = !!patientMatch || line.startsWith('PATIENT:');
                          if (!line.trim()) return null;
                          const doctorDisplayName = authUser?.name || "Doctor";
                          const patientDisplayName = visit?.patient?.name || "Patient";

                          const patientColors = [
                            { bg: "bg-green-100", text: "text-green-700", border: "border-green-200", content: "text-green-900" },
                            { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", content: "text-purple-900" },
                            { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", content: "text-orange-900" },
                            { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200", content: "text-pink-900" },
                            { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200", content: "text-cyan-900" },
                          ];

                          let patientNum = 0;
                          let lineContent = line;
                          let patientLabel = patientDisplayName;

                          if (patientMatch) {
                            patientNum = patientMatch[1] ? parseInt(patientMatch[1]) - 1 : 0;
                            lineContent = patientMatch[2]?.trim() || "";
                            patientLabel = patientMatch[1] ? `Patient ${patientMatch[1]}` : patientDisplayName;
                          } else if (line.startsWith('PATIENT:')) {
                            lineContent = line.replace('PATIENT:', '').trim();
                            patientLabel = patientDisplayName;
                          }

                          const pColor = patientColors[patientNum % patientColors.length];

                          return (
                            <div key={i} className={`flex gap-2.5 py-1.5 ${isDr ? '' : isPatient ? '' : 'text-muted-foreground'}`}>
                              {isDr && (
                                <Badge className="shrink-0 bg-blue-100 text-blue-700 border-blue-200 h-6 text-[11px] mt-0.5 font-medium" variant="outline">
                                  <Stethoscope className="h-3 w-3 mr-1" /> {doctorDisplayName}
                                </Badge>
                              )}
                              {isPatient && (
                                <Badge className={`shrink-0 ${pColor.bg} ${pColor.text} ${pColor.border} h-6 text-[11px] mt-0.5 font-medium`} variant="outline">
                                  <User className="h-3 w-3 mr-1" /> {patientLabel}
                                </Badge>
                              )}
                              <span className={`text-sm leading-relaxed ${isDr ? 'text-blue-900' : isPatient ? pColor.content : ''}`}>
                                {isDr ? line.replace('DR:', '').trim() : isPatient ? lineContent : line}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : !diarizeMutation.isPending && visit?.transcriptText ? (
                      <div className="bg-muted/30 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{visit.transcriptText}</pre>
                      </div>
                    ) : !visit?.transcriptText ? (
                      <p className="text-muted-foreground text-sm text-center py-8">No transcript available.</p>
                    ) : null}

                    {visit?.transcriptText && (
                      <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-2">
                            <Languages className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold">Translate Transcript</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={translateLang}
                              onValueChange={(val) => {
                                setTranslateLang(val);
                                setTranslatedText("");
                              }}
                            >
                              <SelectTrigger className="w-[200px] h-9 bg-white" data-testid="select-translate-language">
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px] overflow-y-auto">
                                {TRANSLATION_LANGUAGES.map((lang) => (
                                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              disabled={!translateLang || translateMutation.isPending}
                              onClick={() => {
                                const textToTranslate = diarizedTranscript?.diarizedTranscript || visit?.transcriptText;
                                if (textToTranslate && translateLang) {
                                  translateMutation.mutate({ text: textToTranslate, targetLanguage: translateLang });
                                }
                              }}
                              data-testid="button-translate"
                            >
                              {translateMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Translating...</>
                              ) : (
                                "Translate"
                              )}
                            </Button>
                          </div>
                        </div>

                        {translateMutation.isPending && (
                          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Translating to {translateLang}...
                          </div>
                        )}

                        {translatedText && !translateMutation.isPending && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-white">{translateLang}</Badge>
                              <span className="text-xs text-muted-foreground">Translated transcript</span>
                            </div>
                            <div className="bg-white rounded-lg p-4 max-h-[400px] overflow-y-auto border space-y-2">
                              {translatedText.split('\n').map((line: string, i: number) => {
                                const isDr = line.startsWith('DR:');
                                const patientMatch = line.match(/^PATIENT(\d*):(.*)$/);
                                const isPatient = !!patientMatch || line.startsWith('PATIENT:');
                                if (!line.trim()) return null;
                                const doctorDisplayName = authUser?.name || "Doctor";
                                const patientDisplayName = visit?.patient?.name || "Patient";

                                const patientColors = [
                                  { bg: "bg-green-100", text: "text-green-700", border: "border-green-200", content: "text-green-900" },
                                  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", content: "text-purple-900" },
                                  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", content: "text-orange-900" },
                                  { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200", content: "text-pink-900" },
                                  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200", content: "text-cyan-900" },
                                ];

                                let patientNum = 0;
                                let lineContent = line;
                                let patientLabel = patientDisplayName;

                                if (patientMatch) {
                                  patientNum = patientMatch[1] ? parseInt(patientMatch[1]) - 1 : 0;
                                  lineContent = patientMatch[2]?.trim() || "";
                                  patientLabel = patientMatch[1] ? `Patient ${patientMatch[1]}` : patientDisplayName;
                                } else if (line.startsWith('PATIENT:')) {
                                  lineContent = line.replace('PATIENT:', '').trim();
                                }

                                const pColor = patientColors[patientNum % patientColors.length];

                                if (isDr || isPatient) {
                                  return (
                                    <div key={i} className="flex gap-2.5 py-1.5">
                                      {isDr && (
                                        <Badge className="shrink-0 bg-blue-100 text-blue-700 border-blue-200 h-6 text-[11px] mt-0.5 font-medium" variant="outline">
                                          <Stethoscope className="h-3 w-3 mr-1" /> {doctorDisplayName}
                                        </Badge>
                                      )}
                                      {isPatient && (
                                        <Badge className={`shrink-0 ${pColor.bg} ${pColor.text} ${pColor.border} h-6 text-[11px] mt-0.5 font-medium`} variant="outline">
                                          <User className="h-3 w-3 mr-1" /> {patientLabel}
                                        </Badge>
                                      )}
                                      <span className={`text-sm leading-relaxed ${isDr ? 'text-blue-900' : pColor.content}`}>
                                        {isDr ? line.replace('DR:', '').trim() : lineContent}
                                      </span>
                                    </div>
                                  );
                                }
                                return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="glass-card-strong rounded-2xl p-6 w-full max-w-md animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="icon-container h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Share2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold gradient-text-health">Share Care Plan</h3>
                  <p className="text-xs text-muted-foreground">Send to patient via any channel</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-white/40" onClick={() => setShowShareModal(false)} data-testid="button-close-share">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {visit?.transcriptText && (
              <div className="mb-3 p-3 rounded-xl glass-card">
                <label className="flex items-center gap-3 cursor-pointer" data-testid="toggle-include-transcript">
                  <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${includeTranscript ? 'bg-primary' : 'bg-gray-300'}`} onClick={() => setIncludeTranscript(!includeTranscript)}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${includeTranscript ? 'translate-x-5' : ''}`} />
                  </div>
                  <div>
                    <div className="font-medium text-sm">Include Transcript</div>
                    <div className="text-xs text-muted-foreground">Add consultation transcript to the report</div>
                  </div>
                </label>
              </div>
            )}

            <div className="mb-4 p-3 rounded-xl glass-card">
              <label className="flex items-center gap-3 cursor-pointer" data-testid="toggle-include-alternatives">
                <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${includeAlternatives ? 'bg-primary' : 'bg-gray-300'}`} onClick={() => setIncludeAlternatives(!includeAlternatives)}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${includeAlternatives ? 'translate-x-5' : ''}`} />
                </div>
                <div>
                  <div className="font-medium text-sm">Include Alternate Medicine</div>
                  <div className="text-xs text-muted-foreground">Show alternative medicines in the prescription</div>
                </div>
              </label>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleShareWhatsApp}
                disabled={isGeneratingLink}
                className="w-full flex items-center gap-4 p-4 rounded-xl glass-card hover:scale-[1.02] transition-all duration-200 cursor-pointer text-left disabled:opacity-50 disabled:cursor-wait"
                data-testid="button-share-whatsapp"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/25 shrink-0">
                  {isGeneratingLink ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <MessageCircle className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <div className="font-semibold text-sm">WhatsApp</div>
                  <div className="text-xs text-muted-foreground">Send prescription PDF link via WhatsApp</div>
                </div>
              </button>

              <button
                onClick={handleShareEmail}
                disabled={isGeneratingLink}
                className="w-full flex items-center gap-4 p-4 rounded-xl glass-card hover:scale-[1.02] transition-all duration-200 cursor-pointer text-left disabled:opacity-50 disabled:cursor-wait"
                data-testid="button-share-email"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                  {isGeneratingLink ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Mail className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <div className="font-semibold text-sm">Email</div>
                  <div className="text-xs text-muted-foreground">Send prescription PDF link via email</div>
                </div>
              </button>

              <button
                onClick={handleShareSMS}
                disabled={isGeneratingLink}
                className="w-full flex items-center gap-4 p-4 rounded-xl glass-card hover:scale-[1.02] transition-all duration-200 cursor-pointer text-left disabled:opacity-50 disabled:cursor-wait"
                data-testid="button-share-sms"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25 shrink-0">
                  {isGeneratingLink ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Phone className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <div className="font-semibold text-sm">Text Message</div>
                  <div className="text-xs text-muted-foreground">Send prescription PDF link via SMS</div>
                </div>
              </button>

              <button
                onClick={() => { handlePrint(); setShowShareModal(false); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl glass-card hover:scale-[1.02] transition-all duration-200 cursor-pointer text-left"
                data-testid="button-share-print"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
                  <Printer className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Print / Download PDF</div>
                  <div className="text-xs text-muted-foreground">Print or save as PDF document</div>
                </div>
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-white/30 text-center">
              <p className="text-[11px] text-muted-foreground">Care plan by {authUser?.name || "Doctor"}{authUser?.clinicName ? ` | ${authUser.clinicName}` : ""}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
