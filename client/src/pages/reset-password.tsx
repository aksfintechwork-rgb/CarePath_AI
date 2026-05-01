import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, Lock, ArrowLeft, KeyRound, CheckCircle, HeartPulse, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tokenFromUrl = params.get("token") || "";

  const { toast } = useToast();
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordHasLetter = /[a-zA-Z]/.test(newPassword);
  const passwordHasNumber = /[0-9]/.test(newPassword);
  const passwordLongEnough = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const allValid = passwordHasLetter && passwordHasNumber && passwordLongEnough && passwordsMatch && token.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Reset Failed", description: data.message, variant: "destructive" });
        return;
      }

      setSuccess(true);
      toast({ title: "Password Updated", description: data.message });
    } catch (err: any) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 glass-bg">
      <div className="glass-orb glass-orb-1" />
      <div className="glass-orb glass-orb-2" />
      <div className="glass-orb glass-orb-3" />
      <div className="glass-orb glass-orb-4" />
      <div className="glass-orb glass-orb-5" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-up">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <div className="icon-container h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                <Stethoscope className="h-8 w-8 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/30 animate-heartbeat">
                <HeartPulse className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-pulse">
                <ShieldCheck className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold gradient-text-health" data-testid="text-reset-title">
            CAREPATH AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Powered by Codelyne Technologies</p>
          <p className="text-muted-foreground mt-3">Set your new password</p>
        </div>

        <div className="glass-card-strong rounded-2xl p-8 animate-fade-up" style={{ animationDelay: '0.15s', opacity: 0 }}>
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="token" className="text-sm font-medium">Reset Token</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="token"
                    type="text"
                    placeholder="Paste your reset token here"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pl-10 bg-white/60 border-white/50 focus:bg-white/80 font-mono text-xs"
                    required
                    data-testid="input-reset-token"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 bg-white/60 border-white/50 focus:bg-white/80"
                    required
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword.length > 0 && (
                  <div className="space-y-1 mt-2">
                    <div className={`flex items-center gap-2 text-xs ${passwordLongEnough ? "text-emerald-600" : "text-muted-foreground"}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${passwordLongEnough ? "bg-emerald-500" : "bg-gray-300"}`} />
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordHasLetter ? "text-emerald-600" : "text-muted-foreground"}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${passwordHasLetter ? "bg-emerald-500" : "bg-gray-300"}`} />
                      At least 1 letter
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordHasNumber ? "text-emerald-600" : "text-muted-foreground"}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${passwordHasNumber ? "bg-emerald-500" : "bg-gray-300"}`} />
                      At least 1 number
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-white/60 border-white/50 focus:bg-white/80"
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:from-cyan-600 hover:via-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300 animate-gradient"
                disabled={isSubmitting || !allValid}
                data-testid="button-reset-password"
              >
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Password Updated</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Your password has been updated successfully. Please sign in with your new password.
                </p>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:from-cyan-600 hover:via-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/25"
                onClick={() => setLocation("/login")}
                data-testid="button-go-login"
              >
                Sign In
              </Button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-white/30 text-center">
            <Button
              variant="ghost"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => setLocation("/login")}
              data-testid="button-back-login"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
