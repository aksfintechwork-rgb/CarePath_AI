import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ArrowUpCircle, Clock, AlertTriangle } from "lucide-react";
import { usePlanFeatures } from "@/hooks/use-plan-features";

interface UpgradePromptProps {
  feature: string;
  title?: string;
  description?: string;
  compact?: boolean;
}

export function UpgradePrompt({ feature, title, description, compact = false }: UpgradePromptProps) {
  const { features, isExpiredOrCancelled } = usePlanFeatures();

  const defaultTitle = isExpiredOrCancelled
    ? "Subscription Expired"
    : `Upgrade Required`;

  const defaultDescription = isExpiredOrCancelled
    ? "Your subscription has expired. Please contact your administrator to renew your plan."
    : `The "${feature}" feature is not available on your current plan (${features.planName}). Contact your administrator to upgrade.`;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm" data-testid={`upgrade-prompt-${feature}`}>
        <Lock className="h-4 w-4 flex-shrink-0" />
        <span>{title || defaultTitle}: {description || defaultDescription}</span>
      </div>
    );
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50" data-testid={`upgrade-prompt-${feature}`}>
      <CardContent className="p-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          {isExpiredOrCancelled ? (
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          ) : (
            <ArrowUpCircle className="h-8 w-8 text-amber-600" />
          )}
        </div>
        <h2 className="text-xl font-semibold text-amber-900">{title || defaultTitle}</h2>
        <p className="text-amber-700 max-w-md mx-auto">{description || defaultDescription}</p>
        <div className="flex items-center justify-center gap-2 text-xs text-amber-600">
          <Clock className="h-3 w-3" />
          <span>Current Plan: {features.planName}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface FeatureGateProps {
  feature: keyof import("@/hooks/use-plan-features").PlanFeatures;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { hasFeature, isExpiredOrCancelled } = usePlanFeatures();

  if (isExpiredOrCancelled) {
    return fallback || <UpgradePrompt feature={String(feature)} />;
  }

  if (!hasFeature(feature)) {
    return fallback || <UpgradePrompt feature={String(feature)} />;
  }

  return <>{children}</>;
}

export function AiMinutesWarning() {
  const { features, aiMinutesRemaining } = usePlanFeatures();

  if (features.planStatus === "none" || features.aiMinutesPerMonth >= 9999) return null;

  if (features.trialMinutesExhausted) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-red-50 border-2 border-red-200 text-red-800" data-testid="ai-minutes-warning-trial">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span className="font-semibold">Free Demo Minutes Complete</span>
        </div>
        <span className="text-sm text-red-600 text-center">Your 20 free trial AI minutes have been used. Please subscribe to a plan to continue using AI features.</span>
        <a href="/upgrade-plan">
          <Button size="sm" className="mt-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white" data-testid="button-subscribe-now">
            <ArrowUpCircle className="h-4 w-4 mr-1" /> Subscribe Now
          </Button>
        </a>
      </div>
    );
  }

  const percentUsed = features.aiMinutesPerMonth > 0
    ? ((features.aiMinutesUsed / features.aiMinutesPerMonth) * 100)
    : 0;

  if (percentUsed < 80) return null;

  const isOver = percentUsed >= 100;

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${isOver ? "bg-red-50 border border-red-200 text-red-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`} data-testid="ai-minutes-warning">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        {isOver
          ? `AI minutes exceeded! ${features.aiMinutesUsed.toFixed(1)}/${features.aiMinutesPerMonth} minutes used. Extra usage may incur additional charges.`
          : `${aiMinutesRemaining.toFixed(1)} AI minutes remaining this month (${percentUsed.toFixed(0)}% used).`}
      </span>
    </div>
  );
}
