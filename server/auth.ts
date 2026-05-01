import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      planFeatures?: PlanFeaturesMap;
    }
  }
}

export interface PlanFeaturesMap {
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
}

const ADMIN_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*"],
  finance_admin: [
    "admin.stats", "admin.billing", "admin.invoices", "admin.coupons",
    "admin.subscription_plans", "admin.doctor_subscriptions", "admin.ai_usage",
    "admin.audit_logs",
  ],
  operations_admin: [
    "admin.stats", "admin.doctors", "admin.doctor_data", "admin.doctor_patients",
    "admin.doctor_subscriptions", "admin.subscription_plans",
    "admin.whatsapp", "admin.audit_logs",
  ],
  support_admin: [
    "admin.stats", "admin.doctors.view",
    "admin.audit_logs",
  ],
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.session_token;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const session = await storage.getSessionByToken(token);
  if (!session || new Date(session.expiresAt) < new Date()) {
    if (session) await storage.deleteSession(token);
    return res.status(401).json({ message: "Session expired" });
  }

  const user = await storage.getUser(session.userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  req.user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

export function requireApproved(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.user.role === "doctor" && req.user.status !== "approved") {
    return res.status(403).json({ message: "Account pending approval", status: req.user.status });
  }
  next();
}

export function requireAdminPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const adminRole = req.user.adminRole || "super_admin";
    const perms = ADMIN_ROLE_PERMISSIONS[adminRole] || [];
    if (perms.includes("*") || perms.includes(permission)) {
      return next();
    }
    const parentPermission = permission.split(".").slice(0, -1).join(".");
    if (parentPermission && perms.some(p => permission.startsWith(p))) {
      return next();
    }
    return res.status(403).json({ message: "Insufficient admin permissions" });
  };
}

export async function loadPlanFeatures(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "doctor") {
    return next();
  }

  try {
    const sub = await storage.getDoctorSubscriptionByDoctor(req.user.id);
    if (!sub || sub.status === "cancelled" || sub.status === "expired") {
      req.planFeatures = getDefaultPlanFeatures();
      return next();
    }

    const plan = await storage.getSubscriptionPlan(sub.planId);
    if (!plan) {
      req.planFeatures = getDefaultPlanFeatures();
      return next();
    }

    const TRIAL_AI_MINUTES = 20;
    req.planFeatures = {
      aiMinutesPerMonth: sub.status === "trial" ? TRIAL_AI_MINUTES : plan.aiMinutesPerMonth,
      languagesSupported: plan.languagesSupported,
      prescriptionChannels: plan.prescriptionChannels,
      calendarFeatures: plan.calendarFeatures,
      reportsLevel: plan.reportsLevel,
      adherenceTracking: plan.adherenceTracking,
      identityVerification: plan.identityVerification,
      aiCarePlanLevel: plan.aiCarePlanLevel,
      customLanguageSupport: plan.customLanguageSupport ?? false,
      whiteLabel: plan.whiteLabel ?? false,
      customIntegrations: plan.customIntegrations ?? false,
    };
    next();
  } catch (err) {
    req.planFeatures = getDefaultPlanFeatures();
    next();
  }
}

function getDefaultPlanFeatures(): PlanFeaturesMap {
  return {
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
  };
}

const FEATURE_TIER_ORDER: Record<string, string[]> = {
  calendarFeatures: ["none", "basic", "advanced", "full"],
  reportsLevel: ["none", "basic", "advanced", "full"],
  adherenceTracking: ["disabled", "basic", "advanced", "full"],
  identityVerification: ["none", "basic", "advanced"],
  aiCarePlanLevel: ["none", "basic", "standard", "advanced", "premium"],
};

export function requireFeature(featureKey: keyof PlanFeaturesMap, minLevel?: string | number | boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== "doctor") {
      return next();
    }

    const features = req.planFeatures;
    if (!features) {
      return res.status(403).json({ message: "Subscription required", upgradeRequired: true });
    }

    const value = features[featureKey];

    if (typeof value === "boolean") {
      if (!value) {
        return res.status(403).json({ message: `Feature "${featureKey}" not available on your plan`, upgradeRequired: true });
      }
      return next();
    }

    if (typeof value === "string") {
      if (value === "none" || value === "disabled") {
        return res.status(403).json({ message: `Feature "${featureKey}" not available on your plan`, upgradeRequired: true });
      }
      if (typeof minLevel === "string" && minLevel !== "none" && minLevel !== "disabled") {
        const tiers = FEATURE_TIER_ORDER[featureKey];
        if (tiers) {
          const currentIdx = tiers.indexOf(value);
          const requiredIdx = tiers.indexOf(minLevel);
          if (currentIdx >= 0 && requiredIdx >= 0 && currentIdx < requiredIdx) {
            return res.status(403).json({
              message: `Feature "${featureKey}" requires "${minLevel}" level, your plan has "${value}"`,
              upgradeRequired: true,
              currentLevel: value,
              requiredLevel: minLevel,
            });
          }
        }
      }
      return next();
    }

    if (typeof value === "number") {
      if (typeof minLevel === "number" && value < minLevel) {
        return res.status(403).json({ message: `Your plan limit for "${featureKey}" is insufficient`, upgradeRequired: true });
      }
    }

    next();
  };
}

export { ADMIN_ROLE_PERMISSIONS };
