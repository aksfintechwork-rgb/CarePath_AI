import { useQuery } from "@tanstack/react-query";
import { getSessionToken } from "@/lib/queryClient";
import { useAuth } from "./use-auth";

export interface PlanFeatures {
  aiMinutesPerMonth: number;
  languagesSupported: number;
  prescriptionChannels: string;
  calendarFeatures: string;
  reportsLevel: string;
  adherenceTracking: string;
  identityVerification: string;
  aiCarePlanLevel: string;
  customLanguageSupport: boolean;
  whiteLabel: boolean;
  customIntegrations: boolean;
  planName: string;
  planStatus: string;
  aiMinutesUsed: number;
  trialMinutesExhausted?: boolean;
}

const DEFAULT_FEATURES: PlanFeatures = {
  aiMinutesPerMonth: 60,
  languagesSupported: 2,
  prescriptionChannels: "print",
  calendarFeatures: "none",
  reportsLevel: "none",
  adherenceTracking: "disabled",
  identityVerification: "none",
  aiCarePlanLevel: "basic",
  customLanguageSupport: false,
  whiteLabel: false,
  customIntegrations: false,
  planName: "Free",
  planStatus: "none",
  aiMinutesUsed: 0,
};

export function usePlanFeatures() {
  const { isDoctor, user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/my-plan-features"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/my-plan-features", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return DEFAULT_FEATURES;
      return res.json() as Promise<PlanFeatures>;
    },
    enabled: isDoctor,
    staleTime: 5 * 60 * 1000,
  });

  const features = data || DEFAULT_FEATURES;

  function hasFeature(key: keyof PlanFeatures): boolean {
    const val = features[key];
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val !== "none" && val !== "disabled";
    if (typeof val === "number") return val > 0;
    return false;
  }

  function isFeatureLimited(key: keyof PlanFeatures, required?: string | number): boolean {
    const val = features[key];
    if (typeof val === "string" && typeof required === "string") {
      const levels = ["none", "disabled", "basic", "standard", "advanced", "premium", "unlimited"];
      return levels.indexOf(val) < levels.indexOf(required);
    }
    if (typeof val === "number" && typeof required === "number") {
      return val < required;
    }
    return false;
  }

  const isExpiredOrCancelled = features.planStatus === "cancelled" || features.planStatus === "expired";
  const hasActivePlan = features.planStatus === "active" || features.planStatus === "trial";
  const aiMinutesRemaining = Math.max(0, features.aiMinutesPerMonth - features.aiMinutesUsed);

  return {
    features,
    isLoading,
    hasFeature,
    isFeatureLimited,
    isExpiredOrCancelled,
    hasActivePlan,
    aiMinutesRemaining,
  };
}
