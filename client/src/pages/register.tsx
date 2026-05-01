import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, ArrowLeft, HeartPulse, Crown, Sparkles, Mic, MicOff, Loader2, ScanFace, Camera, Upload, X, SkipForward, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PublicPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  isEnterprise: boolean;
  targetUser: string;
  aiMinutesPerMonth: number;
  maxDoctors: number;
}

type Step = "form" | "face-enroll";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [step, setStep] = useState<Step>("form");
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    specialization: "",
    licenseNumber: "",
    clinicName: "",
    clinicAddress: "",
    experience: "",
    qualifications: "",
    planId: "",
  });

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/subscription-plans/public")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPlans(data); })
      .catch(() => {});
  }, []);

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('en-IN').format(price);

  const goToFaceStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("face-enroll");
    tryStartCamera();
  };

  const tryStartCamera = async () => {
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      cameraStreamRef.current = stream;
      setCameraReady(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setCameraReady(false);
    }
  };

  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraReady(false);
  };

  const captureFace = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.split(",")[1];
    setFaceImage(base64);
    setFacePreview(dataUrl);
    stopCameraStream();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please select an image", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setFacePreview(result);
      setFaceImage(result.split(",")[1]);
      stopCameraStream();
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openSelfie = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "user";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setFacePreview(result);
        setFaceImage(result.split(",")[1]);
        stopCameraStream();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const retakeFace = () => {
    setFaceImage(null);
    setFacePreview(null);
    tryStartCamera();
  };

  const submitRegistration = async (includeFace: boolean) => {
    setSubmitting(true);
    stopCameraStream();
    try {
      const selectedPlan = plans.find(p => p.id === form.planId);
      await register.mutateAsync({
        ...form,
        experience: form.experience ? parseInt(form.experience) : undefined,
        planId: form.planId || undefined,
        faceImage: includeFace && faceImage ? faceImage : undefined,
      });
      const planMsg = selectedPlan ? ` Your ${selectedPlan.name} plan (7-day free trial) will activate once approved.` : "";
      const faceMsg = includeFace && faceImage ? " Face enrolled for face login." : "";
      toast({
        title: "Registration Submitted!",
        description: `Your account is pending admin approval.${planMsg}${faceMsg}`,
      });
      setLocation("/login");
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: "Recording Started", description: "Speak your details in any language" });
    } catch {
      toast({ title: "Microphone Error", description: "Please allow microphone access", variant: "destructive" });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.onstop = async () => {
      if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null; }
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];
      setIsProcessing(true);
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const res = await fetch("/api/auth/voice-extract-doctor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio: base64 }) });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);
        const d = result.data;
        setForm(prev => {
          const updated = { ...prev };
          if (d.name && !prev.name) updated.name = d.name;
          if (d.email && !prev.email) updated.email = d.email;
          if (d.phone && !prev.phone) updated.phone = d.phone;
          if (d.specialization && !prev.specialization) updated.specialization = d.specialization;
          if (d.licenseNumber && !prev.licenseNumber) updated.licenseNumber = d.licenseNumber;
          if (d.clinicName && !prev.clinicName) updated.clinicName = d.clinicName;
          if (d.clinicAddress && !prev.clinicAddress) updated.clinicAddress = d.clinicAddress;
          if (d.experience && !prev.experience) updated.experience = d.experience;
          if (d.qualifications && !prev.qualifications) updated.qualifications = d.qualifications;
          return updated;
        });
        toast({ title: "Voice Fill Complete", description: "Review and fill in any missing fields." });
      } catch (err: any) {
        toast({ title: "Voice Extraction Failed", description: err.message || "Could not process audio", variant: "destructive" });
      } finally { setIsProcessing(false); }
    };
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, [toast]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 glass-bg">
      <div className="glass-orb glass-orb-1" />
      <div className="glass-orb glass-orb-2" />
      <div className="glass-orb glass-orb-3" />
      <div className="glass-orb glass-orb-4" />
      <div className="glass-orb glass-orb-5" />
      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

      <div className="w-full max-w-lg relative z-10">

        {step === "face-enroll" ? (
          <>
            <div className="text-center mb-6 animate-fade-up">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                  <ScanFace className="h-7 w-7 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold gradient-text-health" data-testid="text-face-enroll-title">Enroll Your Face</h1>
              <p className="text-sm text-muted-foreground mt-1">Enable face login for quick access</p>
            </div>

            <div className="glass-card-strong rounded-2xl p-8 animate-fade-up" style={{ animationDelay: '0.15s', opacity: 0 }}>
              {submitting ? (
                <div className="text-center py-10 space-y-4">
                  {facePreview && (
                    <div className="mx-auto w-28 h-28 rounded-full overflow-hidden border-4 border-blue-200 shadow-xl">
                      <img src={facePreview} alt="Your face" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
                  <p className="font-semibold">Submitting registration...</p>
                </div>
              ) : facePreview ? (
                <div className="space-y-5">
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-emerald-300 shadow-xl">
                        <img src={facePreview} alt="Face preview" className="w-full h-full object-cover" data-testid="img-face-preview" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-emerald-700 mt-3">Face captured successfully!</p>
                  </div>

                  <Button
                    onClick={() => submitRegistration(true)}
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:from-cyan-600 hover:via-blue-700 hover:to-violet-700 shadow-xl shadow-blue-500/30"
                    data-testid="button-submit-with-face"
                  >
                    <ScanFace className="h-5 w-5 mr-2" />
                    Submit Registration with Face
                  </Button>

                  <Button variant="outline" onClick={retakeFace} className="w-full gap-2 border-blue-200 hover:bg-blue-50" data-testid="button-retake-face">
                    <Camera className="h-4 w-4" /> Retake Photo
                  </Button>
                </div>
              ) : cameraReady ? (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-gray-900 shadow-inner">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-80 object-cover" data-testid="video-face-enroll" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-56 border-2 border-white/40 rounded-3xl" />
                      <div className="absolute bottom-4 left-0 right-0 text-center">
                        <span className="text-white/80 text-sm font-medium drop-shadow-lg">Center your face in the frame</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={captureFace}
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 via-violet-600 to-blue-700 hover:from-blue-700 hover:via-violet-700 hover:to-blue-800 shadow-xl shadow-blue-500/30"
                    data-testid="button-capture-face"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Capture Face
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-gray-800 to-gray-900 shadow-inner flex flex-col items-center justify-center h-72">
                    <div className="w-48 h-56 border-2 border-white/20 rounded-3xl mb-4" />
                    <div className="text-center px-6">
                      <p className="text-white/90 text-sm font-medium mb-1">Camera access needed</p>
                      <p className="text-white/50 text-xs">Use the options below to capture your face</p>
                    </div>
                  </div>
                  <Button
                    onClick={openSelfie}
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 via-violet-600 to-blue-700 shadow-xl shadow-blue-500/30"
                    data-testid="button-selfie-enroll"
                  >
                    <Camera className="h-5 w-5 mr-2" /> Take a Selfie
                  </Button>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full h-11 gap-2 border-blue-200 hover:bg-blue-50" data-testid="button-upload-enroll">
                    <Upload className="h-4 w-4" /> Upload Face Photo
                  </Button>
                </div>
              )}

              {!submitting && (
                <div className="mt-5 pt-5 border-t border-white/30 flex gap-3">
                  <Button variant="ghost" size="sm" onClick={() => { stopCameraStream(); setStep("form"); setFaceImage(null); setFacePreview(null); }} className="gap-1" data-testid="button-back-to-form">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => submitRegistration(false)} className="ml-auto gap-1 text-muted-foreground hover:text-foreground" data-testid="button-skip-face">
                    <SkipForward className="h-4 w-4" /> Skip & Register
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-6 animate-fade-up">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="relative">
                  <div className="icon-container h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                    <Stethoscope className="h-7 w-7 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/30 animate-heartbeat">
                    <HeartPulse className="h-3 w-3 text-white" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <h1 className="text-2xl font-bold gradient-text-health" data-testid="text-register-title">
                  Doctor Registration
                </h1>
                {isProcessing ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">Processing...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`group relative h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                      isRecording
                        ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/40 animate-pulse"
                        : "bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5"
                    }`}
                    title={isRecording ? "Stop recording" : "Speak your details to auto-fill (any language)"}
                    data-testid="button-voice-fill"
                  >
                    {isRecording ? <MicOff className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-white" />}
                    {isRecording && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                      </span>
                    )}
                  </button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isRecording ? "Listening... Speak your name, email, phone, specialization, clinic details" : "Fill in your details or tap the mic to speak in any language"}
              </p>
            </div>

            <div className="glass-card-strong rounded-2xl p-8 animate-fade-up" style={{ animationDelay: '0.15s', opacity: 0 }}>
              <form onSubmit={goToFaceStep} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-medium">Full Name *</Label>
                    <Input id="name" placeholder="Dr. John Doe" value={form.name} onChange={e => updateField("name", e.target.value)} required className="bg-white/60 border-white/50 focus:bg-white/80" data-testid="input-reg-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium">Email *</Label>
                    <Input id="email" type="email" placeholder="doctor@clinic.com" value={form.email} onChange={e => updateField("email", e.target.value)} required className="bg-white/60 border-white/50 focus:bg-white/80" data-testid="input-reg-email" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-medium">Password *</Label>
                    <Input id="password" type="password" placeholder="Min 6 characters" value={form.password} onChange={e => updateField("password", e.target.value)} required minLength={6} className="bg-white/60 border-white/50 focus:bg-white/80" data-testid="input-reg-password" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-medium">Phone</Label>
                    <Input id="phone" placeholder="+91 9876543210" value={form.phone} onChange={e => updateField("phone", e.target.value)} className="bg-white/60 border-white/50 focus:bg-white/80" data-testid="input-reg-phone" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="specialization" className="text-xs font-medium">Specialization</Label>
                    <Input id="specialization" placeholder="General Medicine" value={form.specialization} onChange={e => updateField("specialization", e.target.value)} className="bg-white/60 border-white/50 focus:bg-white/80" data-testid="input-reg-specialization" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="licenseNumber" className="text-xs font-medium">License Number</Label>
                    <Input id="licenseNumber" placeholder="MCI-12345" value={form.licenseNumber} onChange={e => updateField("licenseNumber", e.target.value)} className="bg-white/60 border-white/50 focus:bg-white/80" data-testid="input-reg-license" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="clinicName" className="text-xs font-medium">Clinic Name</Label>
                    <Input id="clinicName" placeholder="City Hospital" value={form.clinicName} onChange={e => updateField("clinicName", e.target.value)} className="bg-white/60 border-white/50 focus:bg-white/80" data-testid="input-reg-clinic" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="experience" className="text-xs font-medium">Experience (Years)</Label>
                    <Input id="experience" type="number" placeholder="5" value={form.experience} onChange={e => updateField("experience", e.target.value)} className="bg-white/60 border-white/50 focus:bg-white/80" data-testid="input-reg-experience" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="clinicAddress" className="text-xs font-medium">Clinic Address</Label>
                  <Input id="clinicAddress" placeholder="123, Main Road, City" value={form.clinicAddress} onChange={e => updateField("clinicAddress", e.target.value)} className="bg-white/60 border-white/50 focus:bg-white/80" data-testid="input-reg-address" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="qualifications" className="text-xs font-medium">Qualifications</Label>
                  <Input id="qualifications" placeholder="MBBS, MD, DM" value={form.qualifications} onChange={e => updateField("qualifications", e.target.value)} className="bg-white/60 border-white/50 focus:bg-white/80" data-testid="input-reg-qualifications" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="planId" className="text-xs font-medium">Subscription Plan</Label>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm">
                      <Sparkles className="h-3 w-3" />
                      7 DAY FREE TRIAL
                    </span>
                  </div>
                  <select
                    id="planId"
                    value={form.planId}
                    onChange={e => updateField("planId", e.target.value)}
                    className="w-full h-10 rounded-md border bg-white/60 border-white/50 focus:bg-white/80 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    data-testid="select-reg-plan"
                  >
                    <option value="">Select a plan...</option>
                    {plans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} {plan.isEnterprise ? "— Custom Pricing" : `— ₹${formatPrice(plan.monthlyPrice)}/mo`}
                      </option>
                    ))}
                  </select>
                  {form.planId && (
                    <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-violet-50/80 border border-blue-100/50">
                      {(() => {
                        const selected = plans.find(p => p.id === form.planId);
                        if (!selected) return null;
                        return (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                              <Crown className="h-4 w-4 text-white" />
                            </div>
                            <div className="text-xs space-y-1">
                              <div className="font-semibold text-sm text-blue-900">{selected.name}</div>
                              {selected.isEnterprise ? (
                                <div className="text-blue-700">Custom pricing — contact us after registration</div>
                              ) : (
                                <div className="text-blue-700">
                                  ₹{formatPrice(selected.monthlyPrice)}/mo · {selected.aiMinutesPerMonth} AI min/mo · {selected.maxDoctors} doctor{selected.maxDoctors > 1 ? "s" : ""}
                                </div>
                              )}
                              <div className="text-emerald-600 font-medium flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Start with 7-day free trial
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:from-cyan-600 hover:via-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300 animate-gradient mt-2"
                  disabled={register.isPending}
                  data-testid="button-register"
                >
                  Submit Registration
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLocation("/login")} className="hover:bg-white/40" data-testid="button-back-to-login">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
