import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, ArrowRight, UserPlus, Camera, Loader2, ScanFace, X, Upload } from "lucide-react";
import codelyneLogo from "@assets/image_1771397692857.png";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [faceMode, setFaceMode] = useState(false);
  const [faceProcessing, setFaceProcessing] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Login Failed", description: err.message, variant: "destructive" });
    }
  };

  const sendFaceLogin = useCallback(async (base64: string) => {
    setFaceProcessing(true);
    try {
      const res = await fetch("/api/auth/face-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceImage: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      sessionStorage.setItem("session_token", data.token);
      window.location.href = "/";
    } catch (err: any) {
      toast({ title: "Face Login Failed", description: err.message || "Could not recognize face", variant: "destructive" });
    } finally {
      setFaceProcessing(false);
      setCapturedPreview(null);
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setFaceMode(false);
    setCapturedPreview(null);
    setCameraReady(false);
  }, []);

  const startFaceScan = useCallback(async () => {
    setFaceMode(true);
    setCapturedPreview(null);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
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
  }, []);

  const captureAndVerify = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.split(",")[1];
    setCapturedPreview(dataUrl);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setFaceMode(false);
    sendFaceLogin(base64);
  }, [sendFaceLogin]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setCapturedPreview(result);
      const base64 = result.split(",")[1];
      stopCamera();
      sendFaceLogin(base64);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [sendFaceLogin, toast, stopCamera]);

  const openSelfieCapture = useCallback(() => {
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
        setCapturedPreview(result);
        const base64 = result.split(",")[1];
        stopCamera();
        sendFaceLogin(base64);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [sendFaceLogin, stopCamera]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 glass-bg">
      <div className="glass-orb glass-orb-1" />
      <div className="glass-orb glass-orb-2" />
      <div className="glass-orb glass-orb-3" />
      <div className="glass-orb glass-orb-4" />
      <div className="glass-orb glass-orb-5" />
      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} data-testid="input-face-file" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-up">
          <div className="flex flex-col items-center justify-center mb-2">
            <img src={codelyneLogo} alt="Codelyne" className="h-20 w-auto object-contain" data-testid="img-login-logo" />
          </div>
          <h1 className="text-3xl font-bold gradient-text-health mt-2" data-testid="text-login-title">CAREPATH AI</h1>
          <p className="text-sm text-muted-foreground mt-1">Powered by Codelyne Technologies</p>
          <p className="text-muted-foreground mt-3">Sign in to your account</p>
        </div>

        <div className="glass-card-strong rounded-2xl p-8 animate-fade-up" style={{ animationDelay: '0.15s', opacity: 0 }}>

          {faceMode ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold flex items-center gap-2">
                  <ScanFace className="h-5 w-5 text-blue-600" />
                  Face Scan Login
                </h3>
                <Button variant="ghost" size="sm" onClick={stopCamera} className="h-8 w-8 p-0" data-testid="button-close-face">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {cameraReady ? (
                <>
                  <div className="relative rounded-2xl overflow-hidden bg-gray-900 shadow-inner">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-80 object-cover" data-testid="video-face-login" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-56 border-2 border-white/40 rounded-3xl shadow-lg" />
                      <div className="absolute bottom-4 left-0 right-0 text-center">
                        <span className="text-white/80 text-sm font-medium drop-shadow-lg">Center your face in the frame</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={captureAndVerify}
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 via-violet-600 to-blue-700 hover:from-blue-700 hover:via-violet-700 hover:to-blue-800 shadow-xl shadow-blue-500/30"
                    data-testid="button-verify-face"
                  >
                    <ScanFace className="h-5 w-5 mr-2" />
                    Verify Face & Login
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-gray-800 to-gray-900 shadow-inner flex flex-col items-center justify-center h-80">
                    <div className="w-48 h-56 border-2 border-white/20 rounded-3xl mb-4" />
                    <div className="text-center px-6">
                      <p className="text-white/90 text-sm font-medium mb-1">Camera access needed</p>
                      <p className="text-white/50 text-xs">Use the options below to capture or upload your face photo</p>
                    </div>
                  </div>
                  <Button
                    onClick={openSelfieCapture}
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 via-violet-600 to-blue-700 hover:from-blue-700 hover:via-violet-700 hover:to-blue-800 shadow-xl shadow-blue-500/30"
                    data-testid="button-take-selfie"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Take a Selfie
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-11 gap-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                    data-testid="button-upload-face"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Face Photo
                  </Button>
                </div>
              )}
            </div>

          ) : faceProcessing ? (
            <div className="text-center py-8 space-y-4">
              {capturedPreview && (
                <div className="mx-auto w-28 h-28 rounded-full overflow-hidden border-4 border-blue-200 shadow-xl">
                  <img src={capturedPreview} alt="Your face" className="w-full h-full object-cover" />
                </div>
              )}
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
              <p className="font-semibold text-foreground">Verifying your face...</p>
              <p className="text-sm text-muted-foreground">Matching against registered doctors</p>
            </div>

          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="doctor@clinic.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-white/60 border-white/50 focus:bg-white/80" required data-testid="input-email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-white/60 border-white/50 focus:bg-white/80" required data-testid="input-password" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors" onClick={() => setLocation("/forgot-password")} data-testid="link-forgot-password">
                    Forgot Password?
                  </button>
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:from-cyan-600 hover:via-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300 animate-gradient" disabled={login.isPending} data-testid="button-login">
                  {login.isPending ? "Signing in..." : "Sign In"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/30" /></div>
                <div className="relative flex justify-center"><span className="px-3 text-xs text-muted-foreground bg-white/60 rounded-full">or</span></div>
              </div>

              <Button variant="outline" className="w-full gap-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 h-11" onClick={startFaceScan} data-testid="button-face-login">
                <ScanFace className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Login with Face Scan</span>
              </Button>

              <div className="mt-6 pt-6 border-t border-white/30 text-center">
                <p className="text-sm text-muted-foreground mb-3">New doctor?</p>
                <Button variant="outline" className="gap-2 border-white/50 hover:bg-white/40 hover:border-blue-200" onClick={() => setLocation("/register")} data-testid="button-go-register">
                  <UserPlus className="h-4 w-4" />
                  Register as Doctor
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
