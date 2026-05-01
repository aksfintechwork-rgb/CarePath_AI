import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  User,
  Mail,
  Phone,
  Stethoscope,
  Building2,
  MapPin,
  Award,
  GraduationCap,
  Clock,
  Save,
  ArrowLeft,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  Trash2,
  Eye,
  Upload,
  ScanFace,
  X,
} from "lucide-react";

export default function DoctorProfile() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewPhotoOpen, setViewPhotoOpen] = useState(false);
  const [faceMode, setFaceMode] = useState(false);
  const [faceProcessing, setFaceProcessing] = useState(false);
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const hasFaceData = !!(user as any)?.faceData;

  const startFaceCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      faceStreamRef.current = stream;
      setFaceMode(true);
      setTimeout(() => {
        if (faceVideoRef.current) {
          faceVideoRef.current.srcObject = stream;
          faceVideoRef.current.play();
        }
      }, 100);
    } catch {
      toast({ title: "Camera Error", description: "Please allow camera access", variant: "destructive" });
    }
  };

  const stopFaceCamera = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(t => t.stop());
      faceStreamRef.current = null;
    }
    setFaceMode(false);
  };

  const captureFace = async () => {
    if (!faceVideoRef.current || !faceCanvasRef.current) return;
    const canvas = faceCanvasRef.current;
    canvas.width = faceVideoRef.current.videoWidth;
    canvas.height = faceVideoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(faceVideoRef.current, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    stopFaceCamera();
    setFaceProcessing(true);
    try {
      const res = await apiRequest("POST", "/api/auth/face-register", { faceImage: base64 });
      if (!res.ok) throw new Error("Failed to register face");
      toast({ title: "Face Registered!", description: "You can now login using face scan" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: any) {
      toast({ title: "Face Registration Failed", description: err.message, variant: "destructive" });
    } finally {
      setFaceProcessing(false);
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    specialization: "",
    licenseNumber: "",
    clinicName: "",
    clinicAddress: "",
    experience: "",
    qualifications: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
        specialization: user.specialization || "",
        licenseNumber: user.licenseNumber || "",
        clinicName: user.clinicName || "",
        clinicAddress: user.clinicAddress || "",
        experience: user.experience?.toString() || "",
        qualifications: user.qualifications || "",
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("PUT", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
    },
  });

  const photoMutation = useMutation({
    mutationFn: async (photo: string) => {
      const res = await apiRequest("POST", "/api/auth/profile/photo", { photo });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Photo updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to upload photo", description: err.message, variant: "destructive" });
    },
  });

  const removePhotoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/auth/profile/photo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Photo removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove photo", description: err.message, variant: "destructive" });
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Photo must be under 2MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      photoMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    updateMutation.mutate(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const initials = user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "DR";

  const statusColor = user?.status === "approved" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    user?.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-red-100 text-red-700 border-red-200";

  const statusIcon = user?.status === "approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
    user?.status === "pending" ? <Clock className="h-3.5 w-3.5" /> :
    <AlertCircle className="h-3.5 w-3.5" />;

  const isUploading = photoMutation.isPending || removePhotoMutation.isPending;

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} data-testid="button-back-dashboard">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Doctor Profile</h1>
      </div>

      <Card className="glass-card border-white/40 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-white/60 shadow-lg">
                {user?.profilePhoto ? (
                  <AvatarImage src={user.profilePhoto} alt={user.name} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
                data-testid="input-photo-file"
              />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl" data-testid="text-profile-name">{user?.name || "Doctor"}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-profile-email">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={`${statusColor} text-xs gap-1`} data-testid="badge-status">
                  {statusIcon}
                  {user?.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : "Unknown"}
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs gap-1">
                  <Shield className="h-3 w-3" />
                  {user?.role === "admin" ? "Admin" : "Doctor"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-photo"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Upload Image
                </Button>
                {user?.profilePhoto && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => setViewPhotoOpen(true)}
                      data-testid="button-view-photo"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Image
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={() => removePhotoMutation.mutate()}
                      disabled={isUploading}
                      data-testid="button-remove-photo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Max photo size: 2MB</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Dialog open={viewPhotoOpen} onOpenChange={setViewPhotoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profile Photo</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            {user?.profilePhoto && (
              <img
                src={user.profilePhoto}
                alt={user?.name || "Profile"}
                className="max-w-full max-h-[60vh] rounded-lg object-contain shadow-lg"
                data-testid="img-profile-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <canvas ref={faceCanvasRef} className="hidden" />
      <Card className="glass-card border-white/40 shadow-lg" data-testid="card-face-scan">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScanFace className="h-4 w-4 text-blue-600" />
            Face Scan Login
          </CardTitle>
          <p className="text-xs text-muted-foreground">Register your face to enable quick login via face scan</p>
        </CardHeader>
        <CardContent>
          {faceMode ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border-2 border-blue-200 bg-black">
                <video ref={faceVideoRef} autoPlay playsInline muted className="w-full h-48 object-cover" data-testid="video-face-register" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-32 h-40 border-2 border-white/50 rounded-3xl" />
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">Position your face in the frame</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={stopFaceCamera} className="flex-1 gap-1" data-testid="button-face-cancel">
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button type="button" onClick={captureFace} className="flex-1 gap-1 bg-gradient-to-r from-blue-600 to-violet-600 text-white" data-testid="button-face-capture">
                  <Camera className="h-4 w-4" /> Capture Face
                </Button>
              </div>
            </div>
          ) : faceProcessing ? (
            <div className="text-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-medium">Registering your face...</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${hasFaceData ? "bg-emerald-100" : "bg-gray-100"}`}>
                <ScanFace className={`h-6 w-6 ${hasFaceData ? "text-emerald-600" : "text-gray-400"}`} />
              </div>
              <div className="flex-1">
                {hasFaceData ? (
                  <div>
                    <p className="text-sm font-medium text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Face Registered
                    </p>
                    <p className="text-xs text-muted-foreground">You can login using face scan</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">No face registered</p>
                    <p className="text-xs text-muted-foreground">Register to enable face login</p>
                  </div>
                )}
              </div>
              <Button type="button" variant="outline" onClick={startFaceCamera} className="gap-2 border-blue-200 hover:bg-blue-50" data-testid="button-register-face">
                <Camera className="h-4 w-4" />
                {hasFaceData ? "Update Face" : "Register Face"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card className="glass-card border-white/40 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Full Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Dr. Full Name"
                  data-testid="input-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
                </Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted/30"
                  data-testid="input-email"
                />
                <p className="text-[10px] text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone Number
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+91 98765 43210"
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="experience" className="text-xs font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Years of Experience
                </Label>
                <Input
                  id="experience"
                  type="number"
                  min="0"
                  max="70"
                  value={formData.experience}
                  onChange={(e) => handleChange("experience", e.target.value)}
                  placeholder="e.g., 10"
                  data-testid="input-experience"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/40 shadow-lg mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-blue-600" />
              Professional Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="specialization" className="text-xs font-medium flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" /> Specialization
                </Label>
                <Input
                  id="specialization"
                  value={formData.specialization}
                  onChange={(e) => handleChange("specialization", e.target.value)}
                  placeholder="e.g., General Medicine, Cardiology"
                  data-testid="input-specialization"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="licenseNumber" className="text-xs font-medium flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-muted-foreground" /> License Number
                </Label>
                <Input
                  id="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={(e) => handleChange("licenseNumber", e.target.value)}
                  placeholder="Medical license number"
                  data-testid="input-license"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qualifications" className="text-xs font-medium flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" /> Qualifications
              </Label>
              <Textarea
                id="qualifications"
                value={formData.qualifications}
                onChange={(e) => handleChange("qualifications", e.target.value)}
                placeholder="e.g., MBBS, MD (Internal Medicine), FACP"
                rows={2}
                data-testid="input-qualifications"
              />
            </div>
          </CardContent>
        </Card>

        {!isAdmin && (
        <Card className="glass-card border-white/40 shadow-lg mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              Clinic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="clinicName" className="text-xs font-medium flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Clinic Name
              </Label>
              <Input
                id="clinicName"
                value={formData.clinicName}
                onChange={(e) => handleChange("clinicName", e.target.value)}
                placeholder="Name of your clinic or hospital"
                data-testid="input-clinic-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clinicAddress" className="text-xs font-medium flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Clinic Address
              </Label>
              <Textarea
                id="clinicAddress"
                value={formData.clinicAddress}
                onChange={(e) => handleChange("clinicAddress", e.target.value)}
                placeholder="Full address of your clinic"
                rows={2}
                data-testid="input-clinic-address"
              />
            </div>
          </CardContent>
        </Card>
        )}

        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-muted-foreground">
            Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "—"}
          </p>
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 gap-2"
            disabled={updateMutation.isPending}
            data-testid="button-save-profile"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Profile
          </Button>
        </div>
      </form>
    </div>
  );
}
