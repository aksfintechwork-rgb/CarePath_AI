import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import { insertPatientSchema, insertMedicineSchema, insertTestSchema, insertFollowupSchema, insertAdherenceLogSchema, registerDoctorSchema, loginSchema, medicineReference, adherenceLogs, followups, careEvents, medicines, visits, tests as testsTable, whatsappMessageLogs, aiUsageLogs, users as usersTable, patients, doctorSubscriptions, subscriptionPlans, invoices, upgradeRequests } from "@shared/schema";
import { z } from "zod";
import { extractMedicalData, generateTranscriptFromAudio, transcribeAudio, transcribeAudioChunk, scanAadhaarCard, translateTranscript, diarizeTranscript, generateMedicineAlternatives, extractPatientFromVoice, extractDoctorFromVoice, translatePatientHistoryToEnglish, transliterateNamesToEnglish } from "./ai-medical";
import { broadcastInvalidate } from "./websocket";
import { hashPassword, comparePassword, generateToken, authMiddleware, requireRole, requireApproved, extractToken, requireAdminPermission, loadPlanFeatures, requireFeature, ADMIN_ROLE_PERMISSIONS } from "./auth";
import { db } from "./db";
import { ilike, sql, eq } from "drizzle-orm";
import crypto from "crypto";
import { parseTimingToHours, parseDurationDays, processWhatsappWebhook, getWhatsappVerifyToken, startWhatsappScheduler, isWhatsappConfigured, isSchedulerRunning, sendPrescriptionPdf } from "./whatsapp";
import { generatePrescriptionPdf, generateInvoicePdf } from "./pdf-generator";
import { translateMedicalTerm, translateFreeTextBatch } from "./medical-translations";

async function buildPatientHistoryContext(patientId: string) {
  const patient = await storage.getPatient(patientId);
  const h = await storage.getPatientHistory(patientId);
  if (!h && !patient) return undefined;
  return {
    pastIllnesses: h?.pastIllnesses || undefined,
    chronicDiseases: h?.chronicDiseases || undefined,
    allergies: h?.allergies || undefined,
    currentMedications: h?.currentMedications || undefined,
    familyHistory: h?.familyHistory || undefined,
    lifestyleHabits: h?.lifestyleHabits || undefined,
    previousSurgeries: h?.previousSurgeries || undefined,
    pregnancyStatus: h?.pregnancyStatus || undefined,
    bloodGroup: h?.bloodGroup || undefined,
    weight: h?.weight ? String(h.weight) : undefined,
    height: h?.height ? String(h.height) : undefined,
    age: patient?.age ? String(patient.age) : undefined,
    gender: patient?.gender || undefined,
  };
}

const autoAltInProgress = new Set<string>();
async function autoGenerateAlternativesForVisit(visitId: string) {
  if (autoAltInProgress.has(visitId)) {
    console.log(`[AUTO-ALT] Already in progress for visit ${visitId}, skipping`);
    return;
  }
  autoAltInProgress.add(visitId);
  try {
    const meds = await storage.getMedicinesByVisit(visitId);
    for (const med of meds) {
      const existing = await storage.getAlternativesByMedicine(med.id);
      if (existing.length > 0) continue;
      try {
        const result = await generateMedicineAlternatives(med.name, med.dose || undefined, med.saltComposition || undefined);
        if (result.alternatives && result.alternatives.length > 0) {
          const altsToSave = result.alternatives.slice(0, 3);
          for (const alt of altsToSave) {
            await storage.createMedicineAlternative({
              medicineId: med.id,
              visitId,
              alternativeName: alt.name,
              saltComposition: alt.saltComposition || null,
              genericName: alt.genericName || null,
              manufacturer: alt.manufacturer || null,
              priceEstimate: alt.priceEstimate || null,
              type: alt.type || null,
              selected: false,
            });
          }
          console.log(`[AUTO-ALT] Generated ${altsToSave.length} alternatives for ${med.name}`);
        }
      } catch (err: any) {
        console.log(`[AUTO-ALT] Failed for ${med.name}: ${err.message}`);
      }
    }
    broadcastInvalidate(`/api/visits/${visitId}/alternatives`, `/api/visits/${visitId}`);
  } catch (err: any) {
    console.error("[AUTO-ALT] Error:", err.message);
  } finally {
    autoAltInProgress.delete(visitId);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.set("trust proxy", 1);
  app.use(cookieParser());

  // ══════════════════════════════════════════════
  // PUBLIC SUBSCRIPTION PLANS (no auth)
  // ══════════════════════════════════════════════

  app.get("/api/subscription-plans/public", async (_req, res) => {
    try {
      const allPlans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.status, "active")).orderBy(subscriptionPlans.sortOrder);
      const publicPlans = allPlans.map(p => ({
        id: p.id,
        name: p.name,
        monthlyPrice: p.monthlyPrice,
        annualPrice: p.annualPrice,
        currency: p.currency,
        isEnterprise: p.isEnterprise,
        targetUser: p.targetUser,
        aiMinutesPerMonth: p.aiMinutesPerMonth,
        maxDoctors: p.maxDoctors,
        languagesSupported: p.languagesSupported,
        supportLevel: p.supportLevel,
        prescriptionChannels: p.prescriptionChannels,
      }));
      res.json(publicPlans);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  // ══════════════════════════════════════════════
  // AUTH ROUTES (public)
  // ══════════════════════════════════════════════

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerDoctorSchema.parse(req.body);
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const passwordHash = await hashPassword(data.password);
      let validPlanId: string | null = null;
      if (data.planId) {
        const planCheck = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.id, data.planId)).limit(1);
        if (planCheck.length > 0) {
          validPlanId = data.planId;
        }
      }

      const faceImage = req.body.faceImage;

      const user = await storage.createUser({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        passwordHash,
        role: "doctor",
        status: "pending",
        specialization: data.specialization || null,
        licenseNumber: data.licenseNumber || null,
        clinicName: data.clinicName || null,
        clinicAddress: data.clinicAddress || null,
        experience: data.experience || null,
        qualifications: data.qualifications || null,
        selectedPlanId: validPlanId,
        faceData: (faceImage && typeof faceImage === "string" && faceImage.length < 2_000_000) ? faceImage : null,
      });
      const { passwordHash: _, faceData: _fd1, ...safeUser } = user;
      res.status(201).json({ message: "Registration successful. Awaiting admin approval.", user: safeUser });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
      console.error("Register error:", err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });

      const valid = await comparePassword(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });

      if (user.role === "doctor" && user.status === "pending") {
        return res.status(403).json({ message: "Your account is pending admin approval. Please wait for verification.", status: "pending" });
      }
      if (user.role === "doctor" && user.status === "rejected") {
        return res.status(403).json({ message: "Your registration was not approved. Please contact support.", status: "rejected" });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storage.createSession(user.id, token, expiresAt);

      if (user.role === "admin") {
        await storage.createAuditLog(user.id, "ADMIN_LOGIN", "admin", user.id, `Admin logged in: ${user.name}`);
      }

      const { passwordHash: _, faceData: _fd2, ...safeUser } = user;
      res.json({ user: { ...safeUser, faceData: user.faceData ? "registered" : null }, token });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
      console.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/face-register", authMiddleware, async (req: any, res) => {
    try {
      const { faceImage } = req.body;
      if (!faceImage || typeof faceImage !== "string") return res.status(400).json({ message: "Face image is required" });
      if (faceImage.length > 2_000_000) return res.status(400).json({ message: "Image too large (max 1.5MB)" });
      await db.update(usersTable).set({ faceData: faceImage }).where(eq(usersTable.id, req.user.id));
      res.json({ success: true, message: "Face registered successfully" });
    } catch (err) {
      console.error("Face register error:", err);
      res.status(500).json({ message: "Failed to register face" });
    }
  });

  app.post("/api/auth/face-login", async (req, res) => {
    try {
      const { faceImage } = req.body;
      if (!faceImage || typeof faceImage !== "string") return res.status(400).json({ message: "Face image is required" });
      if (faceImage.length > 2_000_000) return res.status(400).json({ message: "Image too large (max 1.5MB)" });

      const allDoctors = await db.select().from(usersTable).where(sql`${usersTable.faceData} IS NOT NULL AND ${usersTable.role} = 'doctor'`);
      const admins = await db.select().from(usersTable).where(sql`${usersTable.faceData} IS NOT NULL AND ${usersTable.role} = 'admin'`);
      const candidates = [...allDoctors, ...admins];

      if (candidates.length === 0) {
        return res.status(404).json({ message: "No face data registered. Please login with email and password." });
      }

      const candidateDescriptions = candidates.map((u, i) => `Candidate ${i + 1}: Name="${u.name}", Email="${u.email}"`).join("\n");

      const { createOpenAI } = await import("./openai-shared");
      const openaiClient = createOpenAI();
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a face matching system. Compare the login face photo against the registered face photos. Return ONLY the candidate number (1-based) that best matches the login photo, or 0 if no match is confident enough. Respond with ONLY a number, nothing else. Be strict — only match if you are highly confident the faces belong to the same person.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Login face photo:` },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${faceImage}` } },
              { type: "text", text: `\nRegistered face photos:\n${candidateDescriptions}` },
              ...candidates.map((u, i) => ({
                type: "image_url" as const,
                image_url: { url: `data:image/jpeg;base64,${u.faceData}` },
              })),
              { type: "text", text: `\nWhich candidate number matches the login face? Reply with only the number (1-${candidates.length}), or 0 if no match.` },
            ],
          },
        ],
        max_tokens: 10,
      });

      const matchStr = response.choices[0]?.message?.content?.trim() || "0";
      const matchIndex = parseInt(matchStr) - 1;

      if (matchIndex < 0 || matchIndex >= candidates.length) {
        return res.status(401).json({ message: "Face not recognized. Please try again or login with email and password." });
      }

      const matchedUser = candidates[matchIndex];

      if (matchedUser.role === "doctor" && matchedUser.status === "pending") {
        return res.status(403).json({ message: "Your account is pending admin approval." });
      }
      if (matchedUser.role === "doctor" && matchedUser.status === "rejected") {
        return res.status(403).json({ message: "Your registration was not approved." });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storage.createSession(matchedUser.id, token, expiresAt);

      const { passwordHash: _, faceData: __, ...safeUser } = matchedUser;
      res.json({ user: { ...safeUser, faceData: "registered" }, token });
    } catch (err: any) {
      console.error("Face login error:", err);
      res.status(500).json({ message: "Face login failed" });
    }
  });

  app.post("/api/auth/voice-extract-doctor", async (req, res) => {
    try {
      const { audio } = req.body;
      if (!audio || typeof audio !== "string") {
        return res.status(400).json({ message: "Audio data required" });
      }
      if (audio.length > 10 * 1024 * 1024) {
        return res.status(400).json({ message: "Audio file too large" });
      }
      const result = await extractDoctorFromVoice(audio);
      res.json({ transcript: result.transcript, data: result.data });
    } catch (err: any) {
      console.error("[Voice Extract Doctor] Error:", err.message);
      res.status(500).json({ message: "Voice extraction failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = extractToken(req);
    if (token) {
      await storage.deleteSession(token);
    }
    res.clearCookie("session_token");
    res.json({ message: "Logged out" });
  });

  const resetAttempts = new Map<string, { count: number; lastAttempt: number }>();

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier || typeof identifier !== "string") {
        return res.status(400).json({ message: "Please provide your email or phone number." });
      }

      const ip = req.ip || "unknown";
      const now = Date.now();
      const windowMs = 15 * 60 * 1000;
      const rateInfo = resetAttempts.get(ip);
      if (rateInfo && now - rateInfo.lastAttempt > windowMs) {
        resetAttempts.delete(ip);
      }
      const current = resetAttempts.get(ip);
      if (current && current.count >= 5) {
        return res.json({ message: "If the account exists, reset instructions have been sent." });
      }
      resetAttempts.set(ip, { count: (current?.count || 0) + 1, lastAttempt: now });

      let user;
      if (identifier.includes("@")) {
        user = await storage.getUserByEmail(identifier.trim().toLowerCase());
      } else {
        user = await storage.getUserByPhone(identifier.trim());
      }

      if (user && user.role === "doctor" && user.status === "approved") {
        await storage.invalidateUserResetTokens(user.id);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await storage.createPasswordResetToken(user.id, otp, expiresAt);

        const { sendOtpEmail } = await import("./email");
        const sent = await sendOtpEmail(user.email, otp, user.name || "Doctor");
        if (sent) {
          console.log(`[auth] OTP sent to ${user.email}`);
        } else {
          console.error(`[auth] Failed to send OTP to ${user.email}`);
        }
      }

      res.json({ message: "If the account exists, a verification code has been sent to your email." });
    } catch (err: any) {
      console.error("Forgot password error:", err);
      res.json({ message: "If the account exists, reset instructions have been sent." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Reset token is required." });
      }
      if (!newPassword || typeof newPassword !== "string") {
        return res.status(400).json({ message: "New password is required." });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long." });
      }
      if (!/[a-zA-Z]/.test(newPassword)) {
        return res.status(400).json({ message: "Password must contain at least one letter." });
      }
      if (!/[0-9]/.test(newPassword)) {
        return res.status(400).json({ message: "Password must contain at least one number." });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
      }

      if (new Date(resetToken.expiresAt) < new Date()) {
        await storage.markPasswordResetTokenUsed(resetToken.id);
        return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
      }

      const user = await storage.getUser(resetToken.userId);
      if (!user || user.status !== "approved") {
        await storage.markPasswordResetTokenUsed(resetToken.id);
        return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
      }

      const newHash = await hashPassword(newPassword);
      await storage.updateUserPassword(user.id, newHash);
      await storage.markPasswordResetTokenUsed(resetToken.id);
      await storage.invalidateUserResetTokens(user.id);

      console.log(`[auth] Password reset successful for ${user.email}`);

      res.json({
        status: "PASSWORD_RESET_SUCCESS",
        message: "Your password has been updated successfully. Please sign in.",
      });
    } catch (err: any) {
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Failed to reset password. Please try again." });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const session = await storage.getSessionByToken(token);
    if (!session || new Date(session.expiresAt) < new Date()) {
      if (session) await storage.deleteSession(token);
      return res.status(401).json({ message: "Session expired" });
    }

    const user = await storage.getUser(session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    const { passwordHash: _, faceData: _fd3, ...safeUser } = user;
    res.json({ user: { ...safeUser, faceData: user.faceData ? "registered" : null } });
  });

  const updateProfileSchema = z.object({
    name: z.string().min(1).optional(),
    phone: z.string().optional(),
    specialization: z.string().optional(),
    clinicName: z.string().optional(),
    clinicAddress: z.string().optional(),
    experience: z.union([z.string(), z.number(), z.null()]).optional().transform(v => {
      if (v === null || v === undefined || v === "") return null;
      const num = typeof v === "number" ? v : parseInt(String(v));
      return isNaN(num) ? null : num;
    }),
    qualifications: z.string().optional(),
    licenseNumber: z.string().optional(),
  });

  app.put("/api/auth/profile", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user!;
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid profile data", errors: parsed.error.flatten() });
      }
      const data = parsed.data;
      const updateData: Record<string, any> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.specialization !== undefined) updateData.specialization = data.specialization;
      if (data.clinicName !== undefined) updateData.clinicName = data.clinicName;
      if (data.clinicAddress !== undefined) updateData.clinicAddress = data.clinicAddress;
      if (data.experience !== undefined) updateData.experience = data.experience;
      if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;
      if (data.licenseNumber !== undefined) updateData.licenseNumber = data.licenseNumber;
      const updated = await storage.updateUser(user.id, updateData);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _, faceData: _fd4, ...safeUser } = updated;
      res.json({ user: { ...safeUser, faceData: updated.faceData ? "registered" : null } });
    } catch (err: any) {
      console.error("Profile update error:", err);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/auth/profile/photo", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user!;
      const { photo } = req.body;
      if (!photo || typeof photo !== "string") {
        return res.status(400).json({ message: "No photo provided" });
      }
      const maxSize = 2 * 1024 * 1024;
      const base64Data = photo.split(",")[1] || photo;
      if (Buffer.from(base64Data, "base64").length > maxSize) {
        return res.status(400).json({ message: "Photo must be under 2MB" });
      }
      const updated = await storage.updateUser(user.id, { profilePhoto: photo });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _, faceData: _fd5, ...safeUser } = updated;
      res.json({ user: { ...safeUser, faceData: updated.faceData ? "registered" : null } });
    } catch (err: any) {
      console.error("Photo upload error:", err);
      res.status(500).json({ message: "Failed to upload photo" });
    }
  });

  app.delete("/api/auth/profile/photo", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user!;
      const updated = await storage.updateUser(user.id, { profilePhoto: null });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _, faceData: _fd6, ...safeUser } = updated;
      res.json({ user: { ...safeUser, faceData: updated.faceData ? "registered" : null } });
    } catch (err: any) {
      console.error("Photo delete error:", err);
      res.status(500).json({ message: "Failed to remove photo" });
    }
  });

  // ══════════════════════════════════════════════
  app.get("/api/my-plan-features", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user || req.user.role !== "doctor") {
        return res.json({
          aiMinutesPerMonth: 9999, languagesSupported: 99, prescriptionChannels: "all",
          calendarFeatures: "advanced", reportsLevel: "advanced", adherenceTracking: "advanced",
          identityVerification: "aadhaar", aiCarePlanLevel: "premium", customLanguageSupport: true,
          whiteLabel: true, customIntegrations: true, planName: "Admin", planStatus: "active", aiMinutesUsed: 0,
        });
      }

      const sub = await storage.getDoctorSubscriptionByDoctor(req.user.id);
      if (!sub || sub.status === "cancelled" || sub.status === "expired") {
        return res.json({
          aiMinutesPerMonth: 60, languagesSupported: 2, prescriptionChannels: "print",
          calendarFeatures: "none", reportsLevel: "none", adherenceTracking: "disabled",
          identityVerification: "none", aiCarePlanLevel: "basic", customLanguageSupport: false,
          whiteLabel: false, customIntegrations: false,
          planName: sub ? "Expired" : "Free", planStatus: sub?.status || "none", aiMinutesUsed: 0,
        });
      }

      const plan = await storage.getSubscriptionPlan(sub.planId);
      if (!plan) {
        return res.json({
          aiMinutesPerMonth: 60, languagesSupported: 2, prescriptionChannels: "print",
          calendarFeatures: "none", reportsLevel: "none", adherenceTracking: "disabled",
          identityVerification: "none", aiCarePlanLevel: "basic", customLanguageSupport: false,
          whiteLabel: false, customIntegrations: false,
          planName: "Unknown", planStatus: sub.status, aiMinutesUsed: 0,
        });
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const usageLogs = await db.select({ total: sql<number>`COALESCE(SUM(minutes_used), 0)` })
        .from(aiUsageLogs).where(sql`doctor_id = ${req.user.id} AND created_at >= ${startOfMonth}`);
      const aiMinutesUsed = Math.round((usageLogs[0]?.total || 0) * 100) / 100;

      const TRIAL_AI_MINUTES = 20;
      const effectiveAiMinutes = sub.status === "trial" ? TRIAL_AI_MINUTES : plan.aiMinutesPerMonth;
      const trialMinutesExhausted = sub.status === "trial" && aiMinutesUsed >= TRIAL_AI_MINUTES;

      res.json({
        aiMinutesPerMonth: effectiveAiMinutes,
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
        planName: plan.name,
        planStatus: sub.status,
        aiMinutesUsed,
        billingCycle: sub.billingCycle,
        startDate: sub.startDate,
        nextBillingDate: sub.nextBillingDate,
        expiresAt: sub.expiresAt,
        monthlyPrice: sub.finalMonthlyPrice || plan.monthlyPrice,
        annualPrice: sub.finalAnnualPrice || plan.annualPrice,
        planId: plan.id,
        maxDoctors: plan.maxDoctors,
        isEnterprise: plan.isEnterprise,
        trialMinutesExhausted,
      });
    } catch (err) {
      console.error("Plan features error:", err);
      res.status(500).json({ message: "Failed to fetch plan features" });
    }
  });

  // ══════════════════════════════════════════════
  // UPGRADE REQUESTS
  // ══════════════════════════════════════════════

  app.post("/api/upgrade-request", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const { requestedPlanId } = req.body;
      if (!requestedPlanId) return res.status(400).json({ message: "requestedPlanId is required" });
      const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, requestedPlanId)).limit(1);
      if (plan.length === 0) return res.status(404).json({ message: "Plan not found" });

      const existing = await db.select().from(upgradeRequests)
        .where(sql`doctor_id = ${req.user.id} AND status = 'pending'`).limit(1);
      if (existing.length > 0) return res.status(400).json({ message: "You already have a pending upgrade request" });

      const sub = await storage.getDoctorSubscriptionByDoctor(req.user.id);
      await db.insert(upgradeRequests).values({
        doctorId: req.user.id,
        currentPlanId: sub?.planId || null,
        requestedPlanId,
        status: "pending",
      });
      res.json({ message: "Upgrade request submitted. Admin will review your request." });
    } catch (err) {
      console.error("Upgrade request error:", err);
      res.status(500).json({ message: "Failed to submit upgrade request" });
    }
  });

  app.get("/api/my-upgrade-requests", authMiddleware, async (req: any, res) => {
    try {
      const requests = await db.select().from(upgradeRequests)
        .where(eq(upgradeRequests.doctorId, req.user.id))
        .orderBy(sql`created_at DESC`).limit(5);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch upgrade requests" });
    }
  });

  app.get("/api/admin/upgrade-requests", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctor_subscriptions"), async (_req, res) => {
    try {
      const requests = await db.select().from(upgradeRequests)
        .orderBy(sql`created_at DESC`);
      const enriched = await Promise.all(requests.map(async (r) => {
        const doctor = await storage.getUser(r.doctorId);
        const reqPlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, r.requestedPlanId)).limit(1);
        let curPlan = null;
        if (r.currentPlanId) {
          const cp = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, r.currentPlanId)).limit(1);
          curPlan = cp[0] || null;
        }
        return {
          ...r,
          doctorName: doctor?.name || "Unknown",
          doctorEmail: doctor?.email || "",
          currentPlanName: curPlan?.name || "None",
          requestedPlanName: reqPlan[0]?.name || "Unknown",
          requestedPlanPrice: reqPlan[0]?.monthlyPrice || 0,
        };
      }));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch upgrade requests" });
    }
  });

  app.post("/api/admin/upgrade-requests/:id/approve", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctor_subscriptions"), async (req: any, res) => {
    try {
      const request = await db.select().from(upgradeRequests).where(eq(upgradeRequests.id, req.params.id)).limit(1);
      if (request.length === 0) return res.status(404).json({ message: "Request not found" });
      const ur = request[0];
      if (ur.status !== "pending") return res.status(400).json({ message: "Request is not pending" });

      const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, ur.requestedPlanId)).limit(1);
      if (plan.length === 0) return res.status(400).json({ message: "Requested plan not found" });

      const sub = await storage.getDoctorSubscriptionByDoctor(ur.doctorId);
      if (sub) {
        await db.update(doctorSubscriptions).set({
          planId: ur.requestedPlanId,
          finalMonthlyPrice: plan[0].monthlyPrice,
          finalAnnualPrice: plan[0].annualPrice,
          updatedAt: new Date(),
        }).where(eq(doctorSubscriptions.id, sub.id));
      } else {
        await db.insert(doctorSubscriptions).values({
          id: crypto.randomUUID(),
          doctorId: ur.doctorId,
          planId: ur.requestedPlanId,
          status: "active",
          billingCycle: "monthly",
          startDate: new Date(),
          finalMonthlyPrice: plan[0].monthlyPrice,
          finalAnnualPrice: plan[0].annualPrice,
        });
      }

      await db.update(upgradeRequests).set({ status: "approved" }).where(eq(upgradeRequests.id, ur.id));
      await storage.createAuditLog(req.user.id, "APPROVE_UPGRADE", "upgrade_request", ur.id, `Approved upgrade for doctor ${ur.doctorId}`);
      res.json({ message: "Upgrade approved" });
    } catch (err) {
      res.status(500).json({ message: "Failed to approve upgrade" });
    }
  });

  app.post("/api/admin/upgrade-requests/:id/reject", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctor_subscriptions"), async (req: any, res) => {
    try {
      const request = await db.select().from(upgradeRequests).where(eq(upgradeRequests.id, req.params.id)).limit(1);
      if (request.length === 0) return res.status(404).json({ message: "Request not found" });
      if (request[0].status !== "pending") return res.status(400).json({ message: "Request is not pending" });
      await db.update(upgradeRequests).set({ status: "rejected" }).where(eq(upgradeRequests.id, request[0].id));
      await storage.createAuditLog(req.user.id, "REJECT_UPGRADE", "upgrade_request", request[0].id, `Rejected upgrade for doctor ${request[0].doctorId}`);
      res.json({ message: "Upgrade rejected" });
    } catch (err) {
      res.status(500).json({ message: "Failed to reject upgrade" });
    }
  });

  // ══════════════════════════════════════════════
  // ADMIN ROUTES (admin only)
  // ══════════════════════════════════════════════

  app.get("/api/admin/stats", authMiddleware, requireRole("admin"), requireAdminPermission("admin.stats"), async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/analytics", authMiddleware, requireRole("admin"), requireAdminPermission("admin.stats"), async (req, res) => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [totalDoctors] = await db.select({ count: sql<number>`count(*)` })
        .from(usersTable).where(sql`role = 'doctor' AND status = 'approved'`);

      const [totalPatients] = await db.select({ count: sql<number>`count(*)` })
        .from(patients);

      const [totalVisits] = await db.select({ count: sql<number>`count(*)` })
        .from(visits);

      const [todayVisits] = await db.select({ count: sql<number>`count(*)` })
        .from(visits).where(sql`visit_date >= ${startOfDay}`);

      const [activeSubs] = await db.select({ count: sql<number>`count(*)` })
        .from(doctorSubscriptions).where(sql`status = 'active'`);

      const [trialSubs] = await db.select({ count: sql<number>`count(*)` })
        .from(doctorSubscriptions).where(sql`status = 'trial'`);

      const [expiredSubs] = await db.select({ count: sql<number>`count(*)` })
        .from(doctorSubscriptions).where(sql`status = 'expired' OR status = 'cancelled'`);

      const [mrrResult] = await db.select({
        mrr: sql<number>`COALESCE(SUM(CASE WHEN billing_cycle = 'monthly' THEN final_monthly_price ELSE final_annual_price / 12 END), 0)`
      }).from(doctorSubscriptions).where(sql`status = 'active' OR status = 'trial'`);

      const [aiMinutesToday] = await db.select({
        total: sql<number>`COALESCE(SUM(minutes_used), 0)`
      }).from(aiUsageLogs).where(sql`created_at >= ${startOfDay}`);

      const [aiMinutesMonth] = await db.select({
        total: sql<number>`COALESCE(SUM(minutes_used), 0)`
      }).from(aiUsageLogs).where(sql`created_at >= ${startOfMonth}`);

      const uniqueClinics = await db.select({
        count: sql<number>`count(DISTINCT clinic_name)`
      }).from(usersTable).where(sql`role = 'doctor' AND status = 'approved' AND clinic_name IS NOT NULL AND clinic_name != ''`);

      const topPlans = await db.select({
        planId: doctorSubscriptions.planId,
        planName: subscriptionPlans.name,
        count: sql<number>`count(*)`,
      }).from(doctorSubscriptions)
        .innerJoin(subscriptionPlans, sql`${doctorSubscriptions.planId} = ${subscriptionPlans.id}`)
        .where(sql`${doctorSubscriptions.status} IN ('active', 'trial')`)
        .groupBy(doctorSubscriptions.planId, subscriptionPlans.name)
        .orderBy(sql`count(*) DESC`)
        .limit(5);

      const monthlyRevenue = await db.select({
        month: sql<string>`TO_CHAR(created_at, 'YYYY-MM')`,
        revenue: sql<number>`COALESCE(SUM(total), 0)`,
      }).from(invoices)
        .where(sql`status = 'paid' AND created_at >= NOW() - INTERVAL '12 months'`)
        .groupBy(sql`TO_CHAR(created_at, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(created_at, 'YYYY-MM')`);

      const subscriptionDistribution = await db.select({
        planName: subscriptionPlans.name,
        status: doctorSubscriptions.status,
        count: sql<number>`count(*)`,
      }).from(doctorSubscriptions)
        .innerJoin(subscriptionPlans, sql`${doctorSubscriptions.planId} = ${subscriptionPlans.id}`)
        .groupBy(subscriptionPlans.name, doctorSubscriptions.status)
        .orderBy(sql`count(*) DESC`);

      const aiUsageTrends = await db.select({
        date: sql<string>`TO_CHAR(created_at, 'YYYY-MM-DD')`,
        minutes: sql<number>`COALESCE(SUM(minutes_used), 0)`,
        sessions: sql<number>`count(*)`,
      }).from(aiUsageLogs)
        .where(sql`created_at >= NOW() - INTERVAL '30 days'`)
        .groupBy(sql`TO_CHAR(created_at, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(created_at, 'YYYY-MM-DD')`);

      const countryDistribution = await db.select({
        country: sql<string>`COALESCE(country, 'India')`,
        count: sql<number>`count(*)`,
      }).from(usersTable)
        .where(sql`role = 'doctor' AND status = 'approved'`)
        .groupBy(sql`COALESCE(country, 'India')`)
        .orderBy(sql`count(*) DESC`);

      const doctorGrowth = await db.select({
        month: sql<string>`TO_CHAR(created_at, 'YYYY-MM')`,
        count: sql<number>`count(*)`,
      }).from(usersTable)
        .where(sql`role = 'doctor' AND status = 'approved' AND created_at >= NOW() - INTERVAL '12 months'`)
        .groupBy(sql`TO_CHAR(created_at, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(created_at, 'YYYY-MM')`);

      const topClinics = await db.select({
        clinicName: usersTable.clinicName,
        doctorCount: sql<number>`count(DISTINCT ${usersTable.id})`,
        visitCount: sql<number>`COALESCE((SELECT count(*) FROM visits WHERE doctor_id IN (SELECT id FROM users WHERE clinic_name = ${usersTable.clinicName})), 0)`,
      }).from(usersTable)
        .where(sql`role = 'doctor' AND status = 'approved' AND clinic_name IS NOT NULL AND clinic_name != ''`)
        .groupBy(usersTable.clinicName)
        .orderBy(sql`count(DISTINCT ${usersTable.id}) DESC`)
        .limit(10);

      res.json({
        summary: {
          totalDoctors: totalDoctors.count,
          totalPatients: totalPatients.count,
          totalVisits: totalVisits.count,
          todayVisits: todayVisits.count,
          activeSubscriptions: activeSubs.count,
          trialAccounts: trialSubs.count,
          expiredSubscriptions: expiredSubs.count,
          mrr: mrrResult.mrr,
          aiMinutesToday: aiMinutesToday.total,
          aiMinutesMonth: aiMinutesMonth.total,
          totalClinics: uniqueClinics[0]?.count || 0,
        },
        topPlans,
        monthlyRevenue,
        subscriptionDistribution,
        aiUsageTrends,
        countryDistribution,
        doctorGrowth,
        topClinics,
      });
    } catch (err) {
      console.error("Analytics error:", err);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/analytics/details/:type", authMiddleware, requireRole("admin"), requireAdminPermission("admin.stats"), async (req, res) => {
    try {
      const { type } = req.params;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      if (type === "active-subscriptions") {
        const rows = await db.select({
          doctorId: usersTable.id,
          doctorName: usersTable.name,
          doctorEmail: usersTable.email,
          specialization: usersTable.specialization,
          clinicName: usersTable.clinicName,
          planName: subscriptionPlans.name,
          billingCycle: doctorSubscriptions.billingCycle,
          monthlyPrice: doctorSubscriptions.finalMonthlyPrice,
          annualPrice: doctorSubscriptions.finalAnnualPrice,
          startDate: doctorSubscriptions.startDate,
          endDate: doctorSubscriptions.expiresAt,
          status: doctorSubscriptions.status,
        }).from(doctorSubscriptions)
          .innerJoin(usersTable, sql`${doctorSubscriptions.doctorId} = ${usersTable.id}`)
          .innerJoin(subscriptionPlans, sql`${doctorSubscriptions.planId} = ${subscriptionPlans.id}`)
          .where(sql`${doctorSubscriptions.status} = 'active'`)
          .orderBy(sql`${doctorSubscriptions.startDate} DESC`);
        return res.json(rows);
      }

      if (type === "trial-accounts") {
        const rows = await db.select({
          doctorId: usersTable.id,
          doctorName: usersTable.name,
          doctorEmail: usersTable.email,
          specialization: usersTable.specialization,
          planName: subscriptionPlans.name,
          startDate: doctorSubscriptions.startDate,
          endDate: doctorSubscriptions.expiresAt,
          aiMinutesUsed: sql<number>`COALESCE((SELECT SUM(minutes_used) FROM ai_usage_logs WHERE doctor_id = ${usersTable.id}), 0)`,
          status: doctorSubscriptions.status,
        }).from(doctorSubscriptions)
          .innerJoin(usersTable, sql`${doctorSubscriptions.doctorId} = ${usersTable.id}`)
          .innerJoin(subscriptionPlans, sql`${doctorSubscriptions.planId} = ${subscriptionPlans.id}`)
          .where(sql`${doctorSubscriptions.status} = 'trial'`)
          .orderBy(sql`${doctorSubscriptions.startDate} DESC`);
        return res.json(rows);
      }

      if (type === "monthly-revenue") {
        const rows = await db.select({
          doctorId: usersTable.id,
          doctorName: usersTable.name,
          doctorEmail: usersTable.email,
          planName: subscriptionPlans.name,
          billingCycle: doctorSubscriptions.billingCycle,
          monthlyPrice: doctorSubscriptions.finalMonthlyPrice,
          annualPrice: doctorSubscriptions.finalAnnualPrice,
          effectiveMRR: sql<number>`CASE WHEN ${doctorSubscriptions.billingCycle} = 'monthly' THEN ${doctorSubscriptions.finalMonthlyPrice} ELSE ${doctorSubscriptions.finalAnnualPrice} / 12 END`,
          status: doctorSubscriptions.status,
        }).from(doctorSubscriptions)
          .innerJoin(usersTable, sql`${doctorSubscriptions.doctorId} = ${usersTable.id}`)
          .innerJoin(subscriptionPlans, sql`${doctorSubscriptions.planId} = ${subscriptionPlans.id}`)
          .where(sql`${doctorSubscriptions.status} IN ('active', 'trial')`)
          .orderBy(sql`CASE WHEN ${doctorSubscriptions.billingCycle} = 'monthly' THEN ${doctorSubscriptions.finalMonthlyPrice} ELSE ${doctorSubscriptions.finalAnnualPrice} / 12 END DESC`);
        return res.json(rows);
      }

      if (type === "ai-minutes") {
        const rows = await db.select({
          doctorId: usersTable.id,
          doctorName: usersTable.name,
          doctorEmail: usersTable.email,
          specialization: usersTable.specialization,
          minutesThisMonth: sql<number>`COALESCE(SUM(${aiUsageLogs.minutesUsed}), 0)`,
          sessionsThisMonth: sql<number>`count(*)`,
          lastUsed: sql<string>`MAX(${aiUsageLogs.createdAt})`,
        }).from(aiUsageLogs)
          .innerJoin(usersTable, sql`${aiUsageLogs.doctorId} = ${usersTable.id}`)
          .where(sql`${aiUsageLogs.createdAt} >= ${startOfMonth}`)
          .groupBy(usersTable.id, usersTable.name, usersTable.email, usersTable.specialization)
          .orderBy(sql`COALESCE(SUM(${aiUsageLogs.minutesUsed}), 0) DESC`);
        return res.json(rows);
      }

      res.status(400).json({ message: "Invalid detail type" });
    } catch (err) {
      console.error("Analytics detail error:", err);
      res.status(500).json({ message: "Failed to fetch analytics details" });
    }
  });

  app.get("/api/admin/doctors", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctors.view"), async (req, res) => {
    try {
      const doctors = await storage.getAllDoctors();
      const doctorsWithStats = await Promise.all(doctors.map(async (doc) => {
        const stats = await storage.getDoctorStats(doc.id);
        const { passwordHash: _, ...safeDoc } = doc;
        return { ...safeDoc, ...stats };
      }));
      res.json(doctorsWithStats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch doctors" });
    }
  });

  app.get("/api/admin/doctors/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctors.view"), async (req, res) => {
    try {
      const doctor = await storage.getUser(req.params.id);
      if (!doctor || doctor.role !== "doctor") return res.status(404).json({ message: "Doctor not found" });
      const stats = await storage.getDoctorStats(doctor.id);
      const doctorVisits = await storage.getVisitsByDoctor(doctor.id);
      const enrichedVisits = await Promise.all(doctorVisits.map(async (visit) => {
        const patient = await storage.getPatient(visit.patientId);
        return { ...visit, patient };
      }));
      const { passwordHash: _, ...safeDoc } = doctor;
      res.json({ doctor: safeDoc, stats, visits: enrichedVisits });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch doctor details" });
    }
  });

  app.post("/api/admin/doctors/:id/approve", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctors"), async (req, res) => {
    try {
      const doctor = await storage.getUser(req.params.id);
      if (!doctor || doctor.role !== "doctor") return res.status(404).json({ message: "Doctor not found" });
      if (doctor.status !== "pending") return res.status(400).json({ message: "Doctor is not in pending status" });
      const updated = await storage.updateUser(req.params.id, { status: "approved" });
      const { passwordHash: _, ...safeDoc } = updated!;
      await storage.createAuditLog((req as any).user.id, "APPROVE_DOCTOR", "doctor", doctor.id, `Approved doctor: ${doctor.name} (${doctor.email})`);

      if (doctor.selectedPlanId) {
        try {
          const existingSub = await db.select({ id: doctorSubscriptions.id }).from(doctorSubscriptions).where(eq(doctorSubscriptions.doctorId, doctor.id)).limit(1);
          if (existingSub.length === 0) {
            const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, doctor.selectedPlanId)).limit(1);
            if (plan.length > 0) {
              const now = new Date();
              const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
              await db.insert(doctorSubscriptions).values({
                doctorId: doctor.id,
                planId: doctor.selectedPlanId,
                status: "trial",
                billingCycle: "monthly",
                startDate: now,
                nextBillingDate: trialEnd,
                expiresAt: trialEnd,
                finalMonthlyPrice: plan[0].monthlyPrice,
                finalAnnualPrice: plan[0].annualPrice,
              });
            }
          }
        } catch (subErr) {
          console.error("Auto-subscription creation failed:", subErr);
        }
      }

      res.json(safeDoc);
    } catch (err) {
      res.status(500).json({ message: "Failed to approve doctor" });
    }
  });

  app.post("/api/admin/doctors/:id/reject", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctors"), async (req, res) => {
    try {
      const doctor = await storage.getUser(req.params.id);
      if (!doctor || doctor.role !== "doctor") return res.status(404).json({ message: "Doctor not found" });
      const updated = await storage.updateUser(req.params.id, { status: "rejected" });
      const { passwordHash: _, ...safeDoc } = updated!;
      await storage.createAuditLog((req as any).user.id, "REJECT_DOCTOR", "doctor", doctor.id, `Rejected doctor: ${doctor.name} (${doctor.email})`);
      res.json(safeDoc);
    } catch (err) {
      res.status(500).json({ message: "Failed to reject doctor" });
    }
  });

  app.get("/api/admin/doctors/:id/patients", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctors.view"), async (req, res) => {
    try {
      const doctor = await storage.getUser(req.params.id);
      if (!doctor || doctor.role !== "doctor") return res.status(404).json({ message: "Doctor not found" });
      const doctorPatients = await storage.getPatientsByDoctor(req.params.id);
      const patientsWithVisitCounts = await Promise.all(doctorPatients.map(async (p) => {
        const patientVisits = await storage.getVisitsByPatient(p.id);
        const activeVisits = patientVisits.filter(v => v.status === "active").length;
        const draftVisits = patientVisits.filter(v => v.status === "draft").length;
        return { ...p, totalVisits: patientVisits.length, activeVisits, draftVisits, lastVisit: patientVisits[0]?.visitDate || null };
      }));
      res.json(patientsWithVisitCounts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch doctor patients" });
    }
  });

  app.get("/api/admin/patients/:id/visits", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctors.view"), async (req, res) => {
    try {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      const patientVisits = await storage.getVisitsByPatient(req.params.id);
      const enrichedVisits = await Promise.all(patientVisits.map(async (visit) => {
        const meds = await storage.getMedicinesByVisit(visit.id);
        const visitTests = await storage.getTestsByVisit(visit.id);
        const fups = await storage.getFollowupsByVisit(visit.id);
        return { ...visit, medicines: meds, tests: visitTests, followups: fups };
      }));
      res.json({ patient, visits: enrichedVisits });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch patient visits" });
    }
  });

  app.get("/api/admin/audit-logs", authMiddleware, requireRole("admin"), requireAdminPermission("admin.audit_logs"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogs(limit);
      const enrichedLogs = await Promise.all(logs.map(async (log) => {
        const admin = await storage.getUser(log.adminId);
        return { ...log, adminName: admin?.name || "Unknown" };
      }));
      res.json(enrichedLogs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/admin/whatsapp-status", authMiddleware, requireRole("admin"), requireAdminPermission("admin.whatsapp"), async (req, res) => {
    try {
      const configured = isWhatsappConfigured();
      const schedulerRunning = isSchedulerRunning();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const stats = await storage.getWhatsappStats(todayStart, todayEnd);

      const recentFailed = await db.select({
        id: whatsappMessageLogs.id,
        patientId: whatsappMessageLogs.patientId,
        medicineId: whatsappMessageLogs.medicineId,
        whatsappNumber: whatsappMessageLogs.whatsappNumber,
        errorMessage: whatsappMessageLogs.errorMessage,
        retryCount: whatsappMessageLogs.retryCount,
        createdAt: whatsappMessageLogs.createdAt,
        messagePayload: whatsappMessageLogs.messagePayload,
      })
        .from(whatsappMessageLogs)
        .where(eq(whatsappMessageLogs.status, "failed"))
        .orderBy(sql`${whatsappMessageLogs.createdAt} DESC`)
        .limit(10);

      const enrichedFailed = await Promise.all(recentFailed.map(async (msg) => {
        const patient = msg.patientId ? await storage.getPatient(msg.patientId) : null;
        const medicine = msg.medicineId ? await storage.getMedicine(msg.medicineId) : null;
        const payload = msg.messagePayload as any;
        return {
          id: msg.id,
          patientName: patient?.name || payload?.patientName || "Unknown",
          medicineName: medicine?.name || payload?.medicineName || "Unknown",
          whatsappNumber: msg.whatsappNumber,
          error: msg.errorMessage,
          retryCount: msg.retryCount,
          createdAt: msg.createdAt,
        };
      }));

      const totalMessages = stats.totalSent + stats.totalDelivered + stats.totalFailed + stats.totalResponded;
      const deliveryRate = totalMessages > 0 ? Math.round(((stats.totalSent + stats.totalDelivered + stats.totalResponded) / totalMessages) * 100) : 0;
      const responseRate = (stats.totalSent + stats.totalDelivered + stats.totalResponded) > 0 ? Math.round((stats.totalResponded / (stats.totalSent + stats.totalDelivered + stats.totalResponded)) * 100) : 0;

      res.json({
        configured,
        schedulerRunning,
        today: {
          totalSent: stats.totalSent,
          totalDelivered: stats.totalDelivered,
          totalFailed: stats.totalFailed,
          totalResponded: stats.totalResponded,
          deliveryRate,
          responseRate,
        },
        recentFailed: enrichedFailed,
      });
    } catch (err: any) {
      console.error("WhatsApp status error:", err);
      res.status(500).json({ message: "Failed to fetch WhatsApp status" });
    }
  });

  // ══════════════════════════════════════════════
  // SUBSCRIPTION PLAN MANAGEMENT (Admin)
  // ══════════════════════════════════════════════

  app.get("/api/admin/subscription-plans", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const plans = await storage.getSubscriptionPlans(status);
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  app.get("/api/admin/subscription-plans/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const plan = await storage.getSubscriptionPlan(req.params.id);
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      res.json(plan);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch plan" });
    }
  });

  app.post("/api/admin/subscription-plans", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const { id, createdAt, updatedAt, ...body } = req.body;
      const plan = await storage.createSubscriptionPlan(body);
      await storage.createAuditLog((req as any).user.id, "create_plan", "subscription_plan", plan.id, `Created plan: ${plan.name}`);
      res.status(201).json(plan);
    } catch (err: any) {
      console.error("Create plan error:", err);
      res.status(500).json({ message: "Failed to create plan" });
    }
  });

  app.put("/api/admin/subscription-plans/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const allowedFields = [
        "name", "planType", "monthlyPrice", "annualPrice", "currency", "status",
        "doctorsIncluded", "maxDoctors", "aiMinutesPerMonth", "extraMinuteCost",
        "languagesSupported", "customLanguageSupport", "aiCarePlanLevel",
        "prescriptionChannels", "calendarFeatures", "reportsLevel",
        "identityVerification", "adherenceTracking", "supportLevel",
        "targetUser", "isEnterprise", "whiteLabel", "customIntegrations", "sortOrder"
      ];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) sanitized[key] = req.body[key];
      }
      const plan = await storage.updateSubscriptionPlan(req.params.id, sanitized);
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      await storage.createAuditLog((req as any).user.id, "update_plan", "subscription_plan", plan.id, `Updated plan: ${plan.name}`);
      res.json(plan);
    } catch (err: any) {
      console.error("Update plan error:", err);
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  app.post("/api/admin/subscription-plans/:id/clone", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const existing = await storage.getSubscriptionPlan(req.params.id);
      if (!existing) return res.status(404).json({ message: "Plan not found" });
      const { id, createdAt, updatedAt, ...planData } = existing;
      const cloned = await storage.createSubscriptionPlan({
        ...planData,
        name: `${existing.name} (Copy)`,
        status: "draft",
      });
      await storage.createAuditLog((req as any).user.id, "clone_plan", "subscription_plan", cloned.id, `Cloned plan from: ${existing.name}`);
      res.status(201).json(cloned);
    } catch (err: any) {
      console.error("Clone plan error:", err);
      res.status(500).json({ message: "Failed to clone plan" });
    }
  });

  app.post("/api/admin/subscription-plans/:id/activate", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const plan = await storage.updateSubscriptionPlan(req.params.id, { status: "active" });
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      await storage.createAuditLog((req as any).user.id, "activate_plan", "subscription_plan", plan.id, `Activated plan: ${plan.name}`);
      res.json(plan);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to activate plan" });
    }
  });

  app.post("/api/admin/subscription-plans/:id/deactivate", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const plan = await storage.updateSubscriptionPlan(req.params.id, { status: "inactive" });
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      await storage.createAuditLog((req as any).user.id, "deactivate_plan", "subscription_plan", plan.id, `Deactivated plan: ${plan.name}`);
      res.json(plan);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to deactivate plan" });
    }
  });

  app.delete("/api/admin/subscription-plans/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const plan = await storage.getSubscriptionPlan(req.params.id);
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      const deleted = await storage.deleteSubscriptionPlan(req.params.id);
      if (deleted) {
        await storage.createAuditLog((req as any).user.id, "delete_plan", "subscription_plan", req.params.id, `Deleted plan: ${plan.name}`);
      }
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete plan" });
    }
  });

  // Plan Features
  app.get("/api/admin/subscription-plans/:planId/features", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const features = await storage.getPlanFeatures(req.params.planId);
      res.json(features);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch plan features" });
    }
  });

  app.post("/api/admin/subscription-plans/:planId/features", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const { id, ...body } = req.body;
      if (!body.featureKey || !body.featureName) {
        return res.status(400).json({ message: "featureKey and featureName are required" });
      }
      const feature = await storage.createPlanFeature({ ...body, planId: req.params.planId });
      res.status(201).json(feature);
    } catch (err: any) {
      console.error("Create plan feature error:", err);
      res.status(500).json({ message: "Failed to create plan feature" });
    }
  });

  app.put("/api/admin/plan-features/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const allowedFields = ["featureKey", "featureName", "featureCategory", "enabled", "limit", "description", "sortOrder"];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) sanitized[key] = req.body[key];
      }
      const feature = await storage.updatePlanFeature(req.params.id, sanitized);
      if (!feature) return res.status(404).json({ message: "Feature not found" });
      res.json(feature);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update plan feature" });
    }
  });

  app.delete("/api/admin/plan-features/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const deleted = await storage.deletePlanFeature(req.params.id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete plan feature" });
    }
  });

  // Regional Pricing
  app.get("/api/admin/regional-pricing", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const pricing = await storage.getRegionalPricingList();
      res.json(pricing);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch regional pricing" });
    }
  });

  app.post("/api/admin/regional-pricing", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const { id, createdAt, ...body } = req.body;
      if (!body.regionName || !body.regionCode) {
        return res.status(400).json({ message: "regionName and regionCode are required" });
      }
      const pricing = await storage.createRegionalPricing(body);
      await storage.createAuditLog((req as any).user.id, "create_regional_pricing", "regional_pricing", pricing.id, `Created region: ${pricing.regionName}`);
      res.status(201).json(pricing);
    } catch (err: any) {
      console.error("Create regional pricing error:", err);
      res.status(500).json({ message: "Failed to create regional pricing" });
    }
  });

  app.put("/api/admin/regional-pricing/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const allowedFields = ["regionName", "regionCode", "multiplier", "currency", "isActive"];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) sanitized[key] = req.body[key];
      }
      const pricing = await storage.updateRegionalPricing(req.params.id, sanitized);
      if (!pricing) return res.status(404).json({ message: "Region not found" });
      await storage.createAuditLog((req as any).user.id, "update_regional_pricing", "regional_pricing", pricing.id, `Updated region: ${pricing.regionName}`);
      res.json(pricing);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update regional pricing" });
    }
  });

  app.delete("/api/admin/regional-pricing/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const pricing = await storage.getRegionalPricing(req.params.id);
      if (!pricing) return res.status(404).json({ message: "Region not found" });
      const deleted = await storage.deleteRegionalPricing(req.params.id);
      if (deleted) {
        await storage.createAuditLog((req as any).user.id, "delete_regional_pricing", "regional_pricing", req.params.id, `Deleted region: ${pricing.regionName}`);
      }
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete regional pricing" });
    }
  });

  // Seed default plans endpoint
  app.post("/api/admin/seed-plans", authMiddleware, requireRole("admin"), requireAdminPermission("admin.subscription_plans"), async (req, res) => {
    try {
      const existing = await storage.getSubscriptionPlans();
      if (existing.length > 0) {
        return res.status(400).json({ message: "Plans already exist. Delete existing plans first." });
      }

      const defaultPlans: any[] = [
        {
          name: "Starter",
          planType: "global",
          monthlyPrice: 1499,
          annualPrice: 14999,
          currency: "INR",
          status: "active",
          doctorsIncluded: 1,
          maxDoctors: 1,
          aiMinutesPerMonth: 300,
          extraMinuteCost: 0.10,
          languagesSupported: 3,
          customLanguageSupport: false,
          aiCarePlanLevel: "basic",
          prescriptionChannels: "email",
          calendarFeatures: "basic",
          reportsLevel: "monthly",
          identityVerification: "none",
          adherenceTracking: "disabled",
          supportLevel: "email",
          targetUser: "solo_doctor",
          isEnterprise: false,
          whiteLabel: false,
          customIntegrations: false,
          sortOrder: 1,
        },
        {
          name: "Professional",
          planType: "global",
          monthlyPrice: 3999,
          annualPrice: 39999,
          currency: "INR",
          status: "active",
          doctorsIncluded: 1,
          maxDoctors: 3,
          aiMinutesPerMonth: 1000,
          extraMinuteCost: 0.08,
          languagesSupported: 8,
          customLanguageSupport: false,
          aiCarePlanLevel: "advanced",
          prescriptionChannels: "email,whatsapp",
          calendarFeatures: "advanced",
          reportsLevel: "weekly",
          identityVerification: "aadhaar",
          adherenceTracking: "basic",
          supportLevel: "priority",
          targetUser: "solo_doctor",
          isEnterprise: false,
          whiteLabel: false,
          customIntegrations: false,
          sortOrder: 2,
        },
        {
          name: "Clinic Pro",
          planType: "global",
          monthlyPrice: 8999,
          annualPrice: 89999,
          currency: "INR",
          status: "active",
          doctorsIncluded: 5,
          maxDoctors: 10,
          aiMinutesPerMonth: 3000,
          extraMinuteCost: 0.05,
          languagesSupported: 12,
          customLanguageSupport: true,
          aiCarePlanLevel: "premium",
          prescriptionChannels: "email,whatsapp,pdf",
          calendarFeatures: "premium",
          reportsLevel: "daily",
          identityVerification: "aadhaar",
          adherenceTracking: "advanced",
          supportLevel: "dedicated",
          targetUser: "clinic",
          isEnterprise: false,
          whiteLabel: false,
          customIntegrations: true,
          sortOrder: 3,
        },
        {
          name: "Enterprise",
          planType: "custom",
          monthlyPrice: 0,
          annualPrice: 0,
          currency: "INR",
          status: "active",
          doctorsIncluded: 50,
          maxDoctors: 999,
          aiMinutesPerMonth: 99999,
          extraMinuteCost: 0.02,
          languagesSupported: 12,
          customLanguageSupport: true,
          aiCarePlanLevel: "premium",
          prescriptionChannels: "email,whatsapp,pdf,api",
          calendarFeatures: "premium",
          reportsLevel: "realtime",
          identityVerification: "aadhaar",
          adherenceTracking: "advanced",
          supportLevel: "enterprise",
          targetUser: "hospital",
          isEnterprise: true,
          whiteLabel: true,
          customIntegrations: true,
          sortOrder: 4,
        },
      ];

      const created = [];
      for (const plan of defaultPlans) {
        const p = await storage.createSubscriptionPlan(plan);
        created.push(p);
      }

      await storage.createAuditLog((req as any).user.id, "seed_plans", "subscription_plan", undefined, `Seeded ${created.length} default plans`);

      // Seed default regional pricing
      const defaultRegions = [
        { regionName: "North America", regionCode: "NA", multiplier: 1.0, currency: "INR", isActive: true },
        { regionName: "Europe", regionCode: "EU", multiplier: 0.9, currency: "EUR", isActive: true },
        { regionName: "India", regionCode: "IN", multiplier: 0.25, currency: "INR", isActive: true },
        { regionName: "Southeast Asia", regionCode: "SEA", multiplier: 0.3, currency: "INR", isActive: true },
        { regionName: "Middle East", regionCode: "ME", multiplier: 0.7, currency: "INR", isActive: true },
        { regionName: "Africa", regionCode: "AF", multiplier: 0.2, currency: "INR", isActive: true },
        { regionName: "Latin America", regionCode: "LATAM", multiplier: 0.35, currency: "INR", isActive: true },
      ];

      const existingRegions = await storage.getRegionalPricingList();
      if (existingRegions.length === 0) {
        for (const region of defaultRegions) {
          await storage.createRegionalPricing(region);
        }
      }

      res.json({ plans: created, message: `Seeded ${created.length} plans and ${defaultRegions.length} regions` });
    } catch (err: any) {
      console.error("Seed plans error:", err);
      res.status(500).json({ message: "Failed to seed plans" });
    }
  });

  // ══════════════════════════════════════════════
  // DOCTOR SUBSCRIPTION MANAGEMENT (Admin)
  // ══════════════════════════════════════════════

  app.get("/api/admin/doctor-subscriptions", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctor_subscriptions"), async (req, res) => {
    try {
      const doctors = await storage.getAllDoctors();
      const allSubs = await storage.getAllDoctorSubscriptions();
      const plans = await storage.getSubscriptionPlans();

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const now = new Date();

      const usageSummaries = await storage.getAllDoctorsUsageSummary(monthStart, now);
      const usageMap = new Map(usageSummaries.map(u => [u.doctorId, u]));
      const subMap = new Map<string, any>();
      for (const s of allSubs) {
        if (!subMap.has(s.doctorId)) subMap.set(s.doctorId, s);
      }
      const planMap = new Map(plans.map(p => [p.id, p]));

      const result = doctors.map(doc => {
        const sub = subMap.get(doc.id);
        const plan = sub ? planMap.get(sub.planId) : null;
        const usage = usageMap.get(doc.id);
        const minutesUsed = usage?.totalMinutes || 0;
        const minutesLimit = plan?.aiMinutesPerMonth || 0;
        const minutesRemaining = Math.max(0, minutesLimit - minutesUsed);
        const extraMinutes = Math.max(0, minutesUsed - minutesLimit);
        const extraCost = extraMinutes * (plan?.extraMinuteCost || 0);

        return {
          doctor: { id: doc.id, name: doc.name, email: doc.email, specialization: doc.specialization, status: doc.status, country: doc.country },
          subscription: sub || null,
          plan: plan ? { id: plan.id, name: plan.name, monthlyPrice: plan.monthlyPrice, annualPrice: plan.annualPrice, aiMinutesPerMonth: plan.aiMinutesPerMonth, extraMinuteCost: plan.extraMinuteCost } : null,
          usage: { minutesUsed: Math.round(minutesUsed * 100) / 100, minutesLimit, minutesRemaining: Math.round(minutesRemaining * 100) / 100, extraMinutes: Math.round(extraMinutes * 100) / 100, extraCost: Math.round(extraCost * 100) / 100, transcriptionCount: usage?.count || 0 },
        };
      });

      res.json(result);
    } catch (err: any) {
      console.error("Doctor subscriptions error:", err);
      res.status(500).json({ message: "Failed to fetch doctor subscriptions" });
    }
  });

  app.post("/api/admin/doctor-subscriptions", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctor_subscriptions"), async (req, res) => {
    try {
      const { doctorId, planId, billingCycle, regionCode, status, couponId } = req.body;
      if (!doctorId || !planId) return res.status(400).json({ message: "doctorId and planId required" });

      const validStatuses = ["active", "trial", "suspended", "cancelled", "expired"];
      if (status && !validStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });
      const validCycles = ["monthly", "annual"];
      if (billingCycle && !validCycles.includes(billingCycle)) return res.status(400).json({ message: "Invalid billing cycle" });

      let validatedCouponId: string | null = null;
      if (couponId) {
        const coupon = await storage.getCoupon(couponId);
        if (!coupon || !coupon.isActive) return res.status(400).json({ message: "Invalid or inactive coupon" });
        const now = new Date();
        if (coupon.validFrom && new Date(coupon.validFrom) > now) return res.status(400).json({ message: "Coupon not yet valid" });
        if (coupon.validUntil && new Date(coupon.validUntil) < now) return res.status(400).json({ message: "Coupon expired" });
        if (coupon.maxUses && (coupon.currentUses || 0) >= coupon.maxUses) return res.status(400).json({ message: "Coupon usage limit reached" });
        if (coupon.applicablePlanIds && coupon.applicablePlanIds.length > 0 && !coupon.applicablePlanIds.includes(planId)) {
          return res.status(400).json({ message: "Coupon is not applicable to this plan" });
        }
        validatedCouponId = couponId;
      }

      const doctor = await storage.getUser(doctorId);
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });
      if (doctor.role !== "doctor") return res.status(400).json({ message: "User is not a doctor" });

      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });

      const existing = await storage.getDoctorSubscriptionByDoctor(doctorId);
      if (existing && existing.status !== "cancelled" && existing.status !== "expired") {
        await storage.updateDoctorSubscription(existing.id, { status: "cancelled", cancelledAt: new Date() });
      }

      let multiplier = 1.0;
      if (regionCode) {
        const regions = await storage.getRegionalPricingList();
        const region = regions.find(r => r.regionCode === regionCode);
        if (region) multiplier = region.multiplier;
      }

      const cycle = billingCycle || "monthly";
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + (cycle === "annual" ? 12 : 1));

      const sub = await storage.createDoctorSubscription({
        doctorId,
        planId,
        status: status || "active",
        billingCycle: cycle,
        startDate: new Date(),
        nextBillingDate: nextBilling,
        regionCode: regionCode || null,
        appliedMultiplier: multiplier,
        finalMonthlyPrice: plan.monthlyPrice * multiplier,
        finalAnnualPrice: plan.annualPrice * multiplier,
        couponId: validatedCouponId,
      });

      await storage.updateUser(doctorId, { subscriptionId: sub.id });
      await storage.createAuditLog((req as any).user.id, "assign_subscription", "doctor_subscription", sub.id, `Assigned ${plan.name} to ${doctor.name}`);
      res.status(201).json(sub);
    } catch (err: any) {
      console.error("Create subscription error:", err);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.put("/api/admin/doctor-subscriptions/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.doctor_subscriptions"), async (req, res) => {
    try {
      const validStatuses = ["active", "trial", "suspended", "cancelled", "expired"];
      const validCycles = ["monthly", "annual"];
      if (req.body.status && !validStatuses.includes(req.body.status)) return res.status(400).json({ message: "Invalid status" });
      if (req.body.billingCycle && !validCycles.includes(req.body.billingCycle)) return res.status(400).json({ message: "Invalid billing cycle" });

      const allowedFields = ["status", "billingCycle", "planId", "regionCode", "nextBillingDate", "expiresAt", "couponId"];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) sanitized[key] = req.body[key];
      }

      if (sanitized.status === "cancelled") sanitized.cancelledAt = new Date();

      if (sanitized.planId) {
        const plan = await storage.getSubscriptionPlan(sanitized.planId);
        if (!plan) return res.status(404).json({ message: "Plan not found" });
        const existing = await storage.getDoctorSubscription(req.params.id);
        const multiplier = existing?.appliedMultiplier || 1.0;
        sanitized.finalMonthlyPrice = plan.monthlyPrice * multiplier;
        sanitized.finalAnnualPrice = plan.annualPrice * multiplier;
      }

      if (sanitized.couponId) {
        const coupon = await storage.getCoupon(sanitized.couponId);
        if (!coupon || !coupon.isActive) return res.status(400).json({ message: "Invalid or inactive coupon" });
        const now = new Date();
        if (coupon.validFrom && new Date(coupon.validFrom) > now) return res.status(400).json({ message: "Coupon not yet valid" });
        if (coupon.validUntil && new Date(coupon.validUntil) < now) return res.status(400).json({ message: "Coupon expired" });
        if (coupon.maxUses && (coupon.currentUses || 0) >= coupon.maxUses) return res.status(400).json({ message: "Coupon usage limit reached" });
        const targetPlanId = sanitized.planId || (await storage.getDoctorSubscription(req.params.id))?.planId;
        if (targetPlanId && coupon.applicablePlanIds && coupon.applicablePlanIds.length > 0 && !coupon.applicablePlanIds.includes(targetPlanId)) {
          return res.status(400).json({ message: "Coupon is not applicable to this plan" });
        }
      }

      const sub = await storage.updateDoctorSubscription(req.params.id, sanitized);
      if (!sub) return res.status(404).json({ message: "Subscription not found" });

      await storage.createAuditLog((req as any).user.id, "update_subscription", "doctor_subscription", sub.id, `Updated subscription status to ${sub.status}`);
      res.json(sub);
    } catch (err: any) {
      console.error("Update subscription error:", err);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // AI Usage Tracking
  app.get("/api/admin/ai-usage", authMiddleware, requireRole("admin"), requireAdminPermission("admin.ai_usage"), async (req, res) => {
    try {
      const doctorId = req.query.doctorId as string | undefined;
      const period = (req.query.period as string) || "month";

      const now = new Date();
      const from = new Date();
      if (period === "today") {
        from.setHours(0, 0, 0, 0);
      } else if (period === "week") {
        from.setDate(from.getDate() - 7);
      } else {
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
      }

      if (doctorId) {
        const usage = await storage.getAiUsageByDoctor(doctorId, from, now);
        const summary = await storage.getAiUsageSummary(doctorId, from, now);
        const sub = await storage.getDoctorSubscriptionByDoctor(doctorId);
        const plan = sub ? await storage.getSubscriptionPlan(sub.planId) : null;

        const minutesLimit = plan?.aiMinutesPerMonth || 0;
        const extraMinutes = Math.max(0, summary.totalMinutes - minutesLimit);

        res.json({
          doctorId,
          period,
          summary: {
            totalMinutes: Math.round(summary.totalMinutes * 100) / 100,
            transcriptionCount: summary.count,
            minutesLimit,
            minutesRemaining: Math.round(Math.max(0, minutesLimit - summary.totalMinutes) * 100) / 100,
            extraMinutes: Math.round(extraMinutes * 100) / 100,
            extraCost: Math.round(extraMinutes * (plan?.extraMinuteCost || 0) * 100) / 100,
          },
          logs: usage.slice(0, 100),
        });
      } else {
        const allUsage = await storage.getAllDoctorsUsageSummary(from, now);
        const doctors = await storage.getAllDoctors();
        const allSubs = await storage.getAllDoctorSubscriptions();
        const plans = await storage.getSubscriptionPlans();

        const subMap = new Map<string, any>();
        for (const s of allSubs) {
          if (!subMap.has(s.doctorId)) subMap.set(s.doctorId, s);
        }
        const planMap = new Map(plans.map(p => [p.id, p]));
        const doctorMap = new Map(doctors.map(d => [d.id, d]));

        const result = allUsage.map(u => {
          const doc = doctorMap.get(u.doctorId);
          const sub = subMap.get(u.doctorId);
          const plan = sub ? planMap.get(sub.planId) : null;
          const limit = plan?.aiMinutesPerMonth || 0;
          const extra = Math.max(0, u.totalMinutes - limit);

          return {
            doctorId: u.doctorId,
            doctorName: doc?.name || "Unknown",
            totalMinutes: Math.round(u.totalMinutes * 100) / 100,
            transcriptionCount: u.count,
            minutesLimit: limit,
            extraMinutes: Math.round(extra * 100) / 100,
            extraCost: Math.round(extra * (plan?.extraMinuteCost || 0) * 100) / 100,
            planName: plan?.name || "No Plan",
          };
        });

        res.json({ period, doctors: result });
      }
    } catch (err: any) {
      console.error("AI usage error:", err);
      res.status(500).json({ message: "Failed to fetch AI usage" });
    }
  });

  // ══════════════════════════════════════════════
  // BILLING, INVOICES & COUPON MANAGEMENT (Admin)
  // ══════════════════════════════════════════════

  app.post("/api/admin/invoices/generate", authMiddleware, requireRole("admin"), requireAdminPermission("admin.billing"), async (req, res) => {
    try {
      const { doctorId, billingPeriodStart, billingPeriodEnd } = req.body;
      if (!doctorId) return res.status(400).json({ message: "doctorId required" });

      const doctor = await storage.getUser(doctorId);
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });

      const sub = await storage.getDoctorSubscriptionByDoctor(doctorId);
      if (!sub || sub.status === "cancelled" || sub.status === "expired") {
        return res.status(400).json({ message: "No active subscription for this doctor" });
      }

      const plan = await storage.getSubscriptionPlan(sub.planId);
      if (!plan) return res.status(404).json({ message: "Subscription plan not found" });

      const periodStart = billingPeriodStart ? new Date(billingPeriodStart) : (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1); d.setHours(0,0,0,0); return d; })();
      const periodEnd = billingPeriodEnd ? new Date(billingPeriodEnd) : (() => { const d = new Date(); d.setDate(0); d.setHours(23,59,59,999); return d; })();

      const existingInvoices = await storage.getInvoices({ doctorId });
      const alreadyBilled = existingInvoices.some(inv =>
        inv.billingPeriodStart && inv.billingPeriodEnd &&
        new Date(inv.billingPeriodStart).getMonth() === periodStart.getMonth() &&
        new Date(inv.billingPeriodStart).getFullYear() === periodStart.getFullYear()
      );
      if (alreadyBilled) {
        return res.status(409).json({ message: "Invoice already exists for this billing period" });
      }

      const baseCost = sub.billingCycle === "annual"
        ? (sub.finalAnnualPrice || plan.annualPrice) / 12
        : (sub.finalMonthlyPrice || plan.monthlyPrice);

      const usageSummary = await storage.getAiUsageSummary(doctorId, periodStart, periodEnd);
      const minutesLimit = plan.aiMinutesPerMonth || 0;
      const extraMinutes = Math.max(0, usageSummary.totalMinutes - minutesLimit);
      const extraCost = extraMinutes * (plan.extraMinuteCost || 0);

      let discount = 0;
      let couponId: string | null = null;
      if (sub.couponId) {
        const coupon = await storage.getCoupon(sub.couponId);
        if (coupon && coupon.isActive) {
          const now = new Date();
          const valid = (!coupon.validFrom || new Date(coupon.validFrom) <= now) &&
                        (!coupon.validUntil || new Date(coupon.validUntil) >= now) &&
                        (!coupon.maxUses || (coupon.currentUses || 0) < coupon.maxUses);
          const planApplicable = !coupon.applicablePlanIds || coupon.applicablePlanIds.length === 0 || coupon.applicablePlanIds.includes(sub.planId);
          if (valid && planApplicable) {
            couponId = coupon.id;
            if (coupon.discountType === "percentage") {
              discount = (baseCost + extraCost) * (coupon.discountValue / 100);
            } else {
              discount = Math.min(coupon.discountValue, baseCost + extraCost);
            }
          }
        }
      }

      const subtotal = Math.round((baseCost + extraCost) * 100) / 100;
      const total = Math.round(Math.max(0, subtotal - discount) * 100) / 100;
      const invoiceNumber = await storage.getNextInvoiceNumber();

      const invoice = await storage.createInvoice({
        doctorId,
        subscriptionId: sub.id,
        invoiceNumber,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        subtotal,
        discount: Math.round(discount * 100) / 100,
        tax: 0,
        total,
        currency: plan.currency || "INR",
        status: "pending",
      });

      await storage.createInvoiceLineItem({
        invoiceId: invoice.id,
        description: `${plan.name} - ${sub.billingCycle} plan`,
        quantity: 1,
        unitPrice: baseCost,
        total: baseCost,
        itemType: "plan",
      });

      if (extraMinutes > 0) {
        await storage.createInvoiceLineItem({
          invoiceId: invoice.id,
          description: `AI overage: ${Math.round(extraMinutes * 100) / 100} extra minutes @ ₹${plan.extraMinuteCost}/min`,
          quantity: Math.round(extraMinutes * 100) / 100,
          unitPrice: plan.extraMinuteCost || 0,
          total: Math.round(extraCost * 100) / 100,
          itemType: "overage",
        });
      }

      if (discount > 0 && couponId) {
        await storage.createInvoiceLineItem({
          invoiceId: invoice.id,
          description: `Discount (coupon applied)`,
          quantity: 1,
          unitPrice: -Math.round(discount * 100) / 100,
          total: -Math.round(discount * 100) / 100,
          itemType: "discount",
        });
        await storage.incrementCouponUses(couponId);
      }

      await storage.createAuditLog((req as any).user.id, "generate_invoice", "invoice", invoice.id, `Generated invoice ${invoiceNumber} for ${doctor.name}`);
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Invoice generation error:", err);
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });

  app.post("/api/admin/invoices/generate-all", authMiddleware, requireRole("admin"), requireAdminPermission("admin.billing"), async (req, res) => {
    try {
      const allSubs = await storage.getAllDoctorSubscriptions();
      const activeSubs = allSubs.filter(s => s.status === "active" || s.status === "trial");
      const generated: string[] = [];
      const errors: string[] = [];

      for (const sub of activeSubs) {
        try {
          const plan = await storage.getSubscriptionPlan(sub.planId);
          if (!plan) continue;

          const periodStart = new Date(); periodStart.setMonth(periodStart.getMonth() - 1); periodStart.setDate(1); periodStart.setHours(0,0,0,0);
          const periodEnd = new Date(); periodEnd.setDate(0); periodEnd.setHours(23,59,59,999);

          const existing = await storage.getInvoices({ doctorId: sub.doctorId });
          const alreadyBilled = existing.some(inv =>
            inv.billingPeriodStart && inv.billingPeriodEnd &&
            new Date(inv.billingPeriodStart).getMonth() === periodStart.getMonth() &&
            new Date(inv.billingPeriodStart).getFullYear() === periodStart.getFullYear()
          );
          if (alreadyBilled) continue;

          const baseCost = sub.billingCycle === "annual"
            ? (sub.finalAnnualPrice || plan.annualPrice) / 12
            : (sub.finalMonthlyPrice || plan.monthlyPrice);

          const usageSummary = await storage.getAiUsageSummary(sub.doctorId, periodStart, periodEnd);
          const extraMinutes = Math.max(0, usageSummary.totalMinutes - (plan.aiMinutesPerMonth || 0));
          const extraCost = extraMinutes * (plan.extraMinuteCost || 0);
          const subtotal = Math.round((baseCost + extraCost) * 100) / 100;

          let discount = 0;
          let bulkCouponId: string | null = null;
          if (sub.couponId) {
            const coupon = await storage.getCoupon(sub.couponId);
            if (coupon && coupon.isActive) {
              const now = new Date();
              const valid = (!coupon.validFrom || new Date(coupon.validFrom) <= now) &&
                            (!coupon.validUntil || new Date(coupon.validUntil) >= now) &&
                            (!coupon.maxUses || (coupon.currentUses || 0) < coupon.maxUses);
              const planApplicable = !coupon.applicablePlanIds || coupon.applicablePlanIds.length === 0 || coupon.applicablePlanIds.includes(sub.planId);
              if (valid && planApplicable) {
                bulkCouponId = coupon.id;
                if (coupon.discountType === "percentage") {
                  discount = subtotal * (coupon.discountValue / 100);
                } else {
                  discount = Math.min(coupon.discountValue, subtotal);
                }
              }
            }
          }
          const total = Math.round(Math.max(0, subtotal - discount) * 100) / 100;
          const invoiceNumber = await storage.getNextInvoiceNumber();

          const invoice = await storage.createInvoice({
            doctorId: sub.doctorId,
            subscriptionId: sub.id,
            invoiceNumber,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            subtotal,
            discount: Math.round(discount * 100) / 100,
            tax: 0,
            total,
            currency: plan.currency || "INR",
            status: "pending",
          });

          await storage.createInvoiceLineItem({
            invoiceId: invoice.id,
            description: `${plan.name} - ${sub.billingCycle} plan`,
            quantity: 1, unitPrice: baseCost, total: baseCost, itemType: "plan",
          });

          if (extraMinutes > 0) {
            await storage.createInvoiceLineItem({
              invoiceId: invoice.id,
              description: `AI overage: ${Math.round(extraMinutes * 100) / 100} extra min`,
              quantity: Math.round(extraMinutes * 100) / 100,
              unitPrice: plan.extraMinuteCost || 0,
              total: Math.round(extraCost * 100) / 100,
              itemType: "overage",
            });
          }

          if (discount > 0 && bulkCouponId) {
            await storage.createInvoiceLineItem({
              invoiceId: invoice.id,
              description: `Discount (coupon applied)`,
              quantity: 1,
              unitPrice: -Math.round(discount * 100) / 100,
              total: -Math.round(discount * 100) / 100,
              itemType: "discount",
            });
            await storage.incrementCouponUses(bulkCouponId);
          }

          generated.push(invoiceNumber);
        } catch (e: any) {
          errors.push(`${sub.doctorId}: ${e.message}`);
        }
      }

      await storage.createAuditLog((req as any).user.id, "bulk_generate_invoices", "invoice", undefined, `Generated ${generated.length} invoices`);
      res.json({ generated: generated.length, errors: errors.length, invoiceNumbers: generated, errorDetails: errors });
    } catch (err: any) {
      console.error("Bulk invoice generation error:", err);
      res.status(500).json({ message: "Failed to generate invoices" });
    }
  });

  app.get("/api/admin/invoices", authMiddleware, requireRole("admin"), requireAdminPermission("admin.billing"), async (req, res) => {
    try {
      const filters: { doctorId?: string; status?: string } = {};
      if (req.query.doctorId) filters.doctorId = req.query.doctorId as string;
      if (req.query.status) filters.status = req.query.status as string;
      const invs = await storage.getInvoices(filters);

      const doctors = await storage.getAllDoctors();
      const doctorMap = new Map(doctors.map(d => [d.id, d]));

      const result = invs.map(inv => ({
        ...inv,
        doctorName: doctorMap.get(inv.doctorId)?.name || "Unknown",
        doctorEmail: doctorMap.get(inv.doctorId)?.email || "",
      }));

      res.json(result);
    } catch (err: any) {
      console.error("Get invoices error:", err);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/admin/invoices/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.billing"), async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });

      const lineItems = await storage.getInvoiceLineItems(invoice.id);
      const doctor = await storage.getUser(invoice.doctorId);
      const sub = invoice.subscriptionId ? await storage.getDoctorSubscription(invoice.subscriptionId) : null;
      const plan = sub ? await storage.getSubscriptionPlan(sub.planId) : null;

      res.json({
        ...invoice,
        lineItems,
        doctor: doctor ? { id: doctor.id, name: doctor.name, email: doctor.email, clinicName: doctor.clinicName, clinicAddress: doctor.clinicAddress } : null,
        plan: plan ? { name: plan.name } : null,
      });
    } catch (err: any) {
      console.error("Get invoice detail error:", err);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get("/api/admin/invoices/:id/pdf", authMiddleware, requireRole("admin"), requireAdminPermission("admin.billing"), async (req, res) => {
    try {
      const pdfBuffer = await generateInvoicePdf(req.params.id);
      const invoice = await storage.getInvoice(req.params.id);
      const filename = `invoice-${invoice?.invoiceNumber || req.params.id}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("Invoice PDF error:", err);
      res.status(500).json({ message: "Failed to generate invoice PDF" });
    }
  });

  app.put("/api/admin/invoices/:id/status", authMiddleware, requireRole("admin"), requireAdminPermission("admin.billing"), async (req, res) => {
    try {
      const { status, refundReason } = req.body;
      const validStatuses = ["pending", "paid", "overdue", "refunded", "cancelled"];
      if (!status || !validStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

      const data: any = { status };
      if (status === "paid") data.paidAt = new Date();
      if (status === "refunded") {
        data.refundedAt = new Date();
        if (refundReason) data.refundReason = refundReason;
      }

      const updated = await storage.updateInvoice(req.params.id, data);
      if (!updated) return res.status(404).json({ message: "Invoice not found" });

      await storage.createAuditLog((req as any).user.id, `invoice_${status}`, "invoice", updated.id, `Invoice ${updated.invoiceNumber} marked as ${status}${refundReason ? `: ${refundReason}` : ""}`);
      res.json(updated);
    } catch (err: any) {
      console.error("Update invoice status error:", err);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Coupon Management
  app.get("/api/admin/coupons", authMiddleware, requireRole("admin"), requireAdminPermission("admin.coupons"), async (req, res) => {
    try {
      const allCoupons = await storage.getCoupons();
      res.json(allCoupons);
    } catch (err: any) {
      console.error("Get coupons error:", err);
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  app.post("/api/admin/coupons", authMiddleware, requireRole("admin"), requireAdminPermission("admin.coupons"), async (req, res) => {
    try {
      const { code, description, discountType, discountValue, maxUses, validFrom, validUntil, applicablePlanIds, isActive } = req.body;
      if (!code || !discountType || discountValue === undefined) return res.status(400).json({ message: "code, discountType, discountValue required" });

      const validTypes = ["percentage", "fixed"];
      if (!validTypes.includes(discountType)) return res.status(400).json({ message: "discountType must be percentage or fixed" });
      if (discountValue < 0) return res.status(400).json({ message: "Discount value must be non-negative" });
      if (discountType === "percentage" && discountValue > 100) return res.status(400).json({ message: "Percentage must be 0-100" });
      if (validFrom && validUntil && new Date(validFrom) > new Date(validUntil)) return res.status(400).json({ message: "Valid From must be before Valid Until" });

      const existing = await storage.getCouponByCode(code.toUpperCase());
      if (existing) return res.status(409).json({ message: "Coupon code already exists" });

      const coupon = await storage.createCoupon({
        code: code.toUpperCase(),
        description: description || null,
        discountType,
        discountValue,
        maxUses: maxUses || null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        applicablePlanIds: applicablePlanIds || null,
        isActive: isActive !== false,
      });

      await storage.createAuditLog((req as any).user.id, "create_coupon", "coupon", coupon.id, `Created coupon ${coupon.code}`);
      res.status(201).json(coupon);
    } catch (err: any) {
      console.error("Create coupon error:", err);
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  app.put("/api/admin/coupons/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.coupons"), async (req, res) => {
    try {
      const allowedFields = ["description", "discountType", "discountValue", "maxUses", "validFrom", "validUntil", "applicablePlanIds", "isActive"];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) {
          if ((key === "validFrom" || key === "validUntil") && req.body[key]) {
            sanitized[key] = new Date(req.body[key]);
          } else {
            sanitized[key] = req.body[key];
          }
        }
      }

      if (sanitized.discountValue !== undefined && sanitized.discountValue < 0) {
        return res.status(400).json({ message: "Discount value must be non-negative" });
      }
      if (sanitized.discountType === "percentage" && sanitized.discountValue !== undefined && sanitized.discountValue > 100) {
        return res.status(400).json({ message: "Percentage discount cannot exceed 100%" });
      }
      if (sanitized.validFrom && sanitized.validUntil && new Date(sanitized.validFrom) > new Date(sanitized.validUntil)) {
        return res.status(400).json({ message: "Valid From must be before Valid Until" });
      }
      if (sanitized.maxUses !== undefined && sanitized.maxUses !== null && sanitized.maxUses < 0) {
        return res.status(400).json({ message: "Max uses must be non-negative" });
      }

      const updated = await storage.updateCoupon(req.params.id, sanitized);
      if (!updated) return res.status(404).json({ message: "Coupon not found" });

      await storage.createAuditLog((req as any).user.id, "update_coupon", "coupon", updated.id, `Updated coupon ${updated.code}`);
      res.json(updated);
    } catch (err: any) {
      console.error("Update coupon error:", err);
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  app.delete("/api/admin/coupons/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.coupons"), async (req, res) => {
    try {
      const coupon = await storage.getCoupon(req.params.id);
      if (!coupon) return res.status(404).json({ message: "Coupon not found" });

      await storage.deleteCoupon(req.params.id);
      await storage.createAuditLog((req as any).user.id, "delete_coupon", "coupon", req.params.id, `Deleted coupon ${coupon.code}`);
      res.status(204).send();
    } catch (err: any) {
      console.error("Delete coupon error:", err);
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  app.post("/api/admin/coupons/validate", authMiddleware, requireRole("admin"), requireAdminPermission("admin.coupons"), async (req, res) => {
    try {
      const { code, planId } = req.body;
      if (!code) return res.status(400).json({ message: "Coupon code required" });

      const coupon = await storage.getCouponByCode(code.toUpperCase());
      if (!coupon) return res.status(404).json({ valid: false, message: "Coupon not found" });
      if (!coupon.isActive) return res.json({ valid: false, message: "Coupon is inactive" });

      const now = new Date();
      if (coupon.validFrom && new Date(coupon.validFrom) > now) return res.json({ valid: false, message: "Coupon not yet valid" });
      if (coupon.validUntil && new Date(coupon.validUntil) < now) return res.json({ valid: false, message: "Coupon has expired" });
      if (coupon.maxUses && (coupon.currentUses || 0) >= coupon.maxUses) return res.json({ valid: false, message: "Coupon usage limit reached" });
      if (planId && coupon.applicablePlanIds && coupon.applicablePlanIds.length > 0 && !coupon.applicablePlanIds.includes(planId)) {
        return res.json({ valid: false, message: "Coupon not applicable to this plan" });
      }

      res.json({ valid: true, coupon });
    } catch (err: any) {
      console.error("Validate coupon error:", err);
      res.status(500).json({ message: "Failed to validate coupon" });
    }
  });

  // ══════════════════════════════════════════════
  // ADMIN ROLE MANAGEMENT ROUTES (super_admin only)
  // ══════════════════════════════════════════════

  app.get("/api/admin/admins", authMiddleware, requireRole("admin"), requireAdminPermission("admin.roles"), async (req, res) => {
    try {
      const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
      const safeAdmins = admins.map(({ passwordHash, ...rest }) => rest);
      res.json(safeAdmins);
    } catch (err) {
      console.error("Get admins error:", err);
      res.status(500).json({ message: "Failed to fetch admin accounts" });
    }
  });

  app.post("/api/admin/admins", authMiddleware, requireRole("admin"), requireAdminPermission("admin.roles"), async (req, res) => {
    try {
      const { name, email, password, adminRole } = req.body;
      if (!name || !email || !password || !adminRole) {
        return res.status(400).json({ message: "Name, email, password, and admin role are required" });
      }
      const validRoles = ["super_admin", "finance_admin", "operations_admin", "support_admin"];
      if (!validRoles.includes(adminRole)) {
        return res.status(400).json({ message: "Invalid admin role" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "Email already in use" });
      }
      const hashedPassword = await hashPassword(password);
      const [newAdmin] = await db.insert(usersTable).values({
        name, email, passwordHash: hashedPassword,
        role: "admin", status: "approved", adminRole,
      }).returning();
      const { passwordHash: _, ...safeAdmin } = newAdmin;

      await storage.createAuditLog((req as any).user!.id, "admin_account_created", "admin", newAdmin.id, JSON.stringify({ name, email, adminRole }));

      res.status(201).json(safeAdmin);
    } catch (err) {
      console.error("Create admin error:", err);
      res.status(500).json({ message: "Failed to create admin account" });
    }
  });

  app.put("/api/admin/admins/:id/role", authMiddleware, requireRole("admin"), requireAdminPermission("admin.roles"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { adminRole } = req.body;
      const validRoles = ["super_admin", "finance_admin", "operations_admin", "support_admin"];
      if (!validRoles.includes(adminRole)) {
        return res.status(400).json({ message: "Invalid admin role" });
      }
      if (id === req.user!.id) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }
      const target = await storage.getUser(id);
      if (!target || target.role !== "admin") {
        return res.status(404).json({ message: "Admin account not found" });
      }
      await db.update(usersTable).set({ adminRole }).where(eq(usersTable.id, id));

      await storage.createAuditLog(req.user!.id, "admin_role_changed", "admin", id, JSON.stringify({ previousRole: target.adminRole, newRole: adminRole }));

      res.json({ message: "Admin role updated" });
    } catch (err) {
      console.error("Update admin role error:", err);
      res.status(500).json({ message: "Failed to update admin role" });
    }
  });

  app.delete("/api/admin/admins/:id", authMiddleware, requireRole("admin"), requireAdminPermission("admin.roles"), async (req: any, res) => {
    try {
      const { id } = req.params;
      if (id === req.user!.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      const target = await storage.getUser(id);
      if (!target || target.role !== "admin") {
        return res.status(404).json({ message: "Admin account not found" });
      }
      await db.delete(usersTable).where(eq(usersTable.id, id));

      await storage.createAuditLog(req.user!.id, "admin_account_deleted", "admin", id, JSON.stringify({ name: target.name, email: target.email }));

      res.json({ message: "Admin account deleted" });
    } catch (err) {
      console.error("Delete admin error:", err);
      res.status(500).json({ message: "Failed to delete admin account" });
    }
  });

  app.get("/api/admin/permissions", authMiddleware, requireRole("admin"), requireAdminPermission("admin.stats"), async (req: any, res) => {
    try {
      const adminRole = req.user!.adminRole || "super_admin";
      const permissions = ADMIN_ROLE_PERMISSIONS[adminRole] || [];
      res.json({ adminRole, permissions, allRoles: ADMIN_ROLE_PERMISSIONS });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // ══════════════════════════════════════════════
  // WHATSAPP WEBHOOK ROUTES (public — Meta verification)
  // ══════════════════════════════════════════════

  app.get("/api/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === getWhatsappVerifyToken()) {
      console.log("[whatsapp] Webhook verified");
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ message: "Verification failed" });
  });

  app.post("/api/webhooks/whatsapp", async (req, res) => {
    try {
      const result = await processWhatsappWebhook(req.body);
      console.log("[whatsapp] Webhook processed:", result.message);
      res.status(200).json(result);
    } catch (err: any) {
      console.error("[whatsapp] Webhook error:", err.message);
      res.status(200).json({ processed: false, message: err.message });
    }
  });

  startWhatsappScheduler();

  function startMonthlyInvoiceScheduler() {
    const HOUR_MS = 60 * 60 * 1000;
    const checkAndGenerate = async () => {
      try {
        const now = new Date();
        if (now.getDate() !== 1) return;

        console.log("[billing] Monthly invoice auto-generation triggered");
        const allSubs = await storage.getAllDoctorSubscriptions();
        const activeSubs = allSubs.filter(s => s.status === "active" || s.status === "trial");
        let generated = 0;

        for (const sub of activeSubs) {
          try {
            const plan = await storage.getSubscriptionPlan(sub.planId);
            if (!plan) continue;

            const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

            const existing = await storage.getInvoices({ doctorId: sub.doctorId });
            const alreadyBilled = existing.some(inv =>
              inv.billingPeriodStart &&
              new Date(inv.billingPeriodStart).getMonth() === periodStart.getMonth() &&
              new Date(inv.billingPeriodStart).getFullYear() === periodStart.getFullYear()
            );
            if (alreadyBilled) continue;

            const baseCost = sub.billingCycle === "annual"
              ? (sub.finalAnnualPrice || plan.annualPrice) / 12
              : (sub.finalMonthlyPrice || plan.monthlyPrice);

            const usageSummary = await storage.getAiUsageSummary(sub.doctorId, periodStart, periodEnd);
            const extraMinutes = Math.max(0, usageSummary.totalMinutes - (plan.aiMinutesPerMonth || 0));
            const extraCost = extraMinutes * (plan.extraMinuteCost || 0);
            const subtotal = Math.round((baseCost + extraCost) * 100) / 100;

            let discount = 0;
            let autoCouponId: string | null = null;
            if (sub.couponId) {
              const coupon = await storage.getCoupon(sub.couponId);
              if (coupon && coupon.isActive) {
                const valid = (!coupon.validFrom || new Date(coupon.validFrom) <= now) &&
                              (!coupon.validUntil || new Date(coupon.validUntil) >= now) &&
                              (!coupon.maxUses || (coupon.currentUses || 0) < coupon.maxUses);
                const planApplicable = !coupon.applicablePlanIds || coupon.applicablePlanIds.length === 0 || coupon.applicablePlanIds.includes(sub.planId);
                if (valid && planApplicable) {
                  autoCouponId = coupon.id;
                  discount = coupon.discountType === "percentage"
                    ? subtotal * (coupon.discountValue / 100)
                    : Math.min(coupon.discountValue, subtotal);
                }
              }
            }
            const total = Math.round(Math.max(0, subtotal - discount) * 100) / 100;
            const invoiceNumber = await storage.getNextInvoiceNumber();

            const invoice = await storage.createInvoice({
              doctorId: sub.doctorId, subscriptionId: sub.id, invoiceNumber,
              billingPeriodStart: periodStart, billingPeriodEnd: periodEnd,
              subtotal, discount: Math.round(discount * 100) / 100, tax: 0, total,
              currency: plan.currency || "INR", status: "pending",
            });

            await storage.createInvoiceLineItem({
              invoiceId: invoice.id, description: `${plan.name} - ${sub.billingCycle} plan`,
              quantity: 1, unitPrice: baseCost, total: baseCost, itemType: "plan",
            });

            if (extraMinutes > 0) {
              await storage.createInvoiceLineItem({
                invoiceId: invoice.id,
                description: `AI overage: ${Math.round(extraMinutes * 100) / 100} extra min`,
                quantity: Math.round(extraMinutes * 100) / 100,
                unitPrice: plan.extraMinuteCost || 0,
                total: Math.round(extraCost * 100) / 100, itemType: "overage",
              });
            }

            if (discount > 0 && autoCouponId) {
              await storage.createInvoiceLineItem({
                invoiceId: invoice.id, description: `Discount (coupon applied)`,
                quantity: 1, unitPrice: -Math.round(discount * 100) / 100,
                total: -Math.round(discount * 100) / 100, itemType: "discount",
              });
              await storage.incrementCouponUses(autoCouponId);
            }

            generated++;
          } catch (e: any) {
            console.error(`[billing] Auto-invoice error for ${sub.doctorId}:`, e.message);
          }
        }
        if (generated > 0) console.log(`[billing] Auto-generated ${generated} invoices`);
      } catch (err: any) {
        console.error("[billing] Monthly scheduler error:", err.message);
      }
    };

    setInterval(checkAndGenerate, HOUR_MS);
    console.log("[billing] Monthly invoice scheduler started (hourly check, runs on 1st of month)");
  }

  startMonthlyInvoiceScheduler();

  // ══════════════════════════════════════════════
  // PROTECTED ROUTES (auth required)
  // ══════════════════════════════════════════════

  // ── Dashboard Stats ──
  app.get("/api/dashboard", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const doctorId = user.role === "doctor" ? user.id : undefined;
      const allVisits = await storage.getVisitsLight(doctorId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayVisits = allVisits.filter(v => {
        const vDate = new Date(v.visitDate!);
        vDate.setHours(0, 0, 0, 0);
        return vDate.getTime() === today.getTime();
      });

      const activeCount = allVisits.filter(v => v.status === "active").length;
      const draftCount = allVisits.filter(v => v.status === "draft").length;
      const queue = await storage.getPatientQueue(req.user.id);
      const waitingCount = queue.filter(q => q.status === "waiting").length;

      res.json({
        totalToday: todayVisits.length,
        activeCare: activeCount,
        pendingApprovals: draftCount,
        attentionNeeded: waitingCount,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/metrics", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const doctorId = user.role === "doctor" ? user.id : undefined;

      const allVisits = await storage.getVisitsLight(doctorId);
      const visitIds = allVisits.map(v => v.id);

      let adherenceRate = 0;
      let followupCompletionRate = 0;
      let reducedOpdRate = 0;

      if (visitIds.length > 0) {
        const inClause = sql.join(visitIds.map(id => sql`${id}`), sql`, `);

        const adherenceRows = await db.select().from(adherenceLogs)
          .where(sql`${adherenceLogs.visitId} IN (${inClause})`);

        const careEventMeds = await db.select().from(careEvents)
          .where(sql`${careEvents.visitId} IN (${inClause}) AND ${careEvents.eventType} = 'medicine'`);

        const takenAdherence = adherenceRows.filter(r => r.status === "taken").length;
        const respondedCareEvents = careEventMeds.filter(e => e.status === "completed" || e.patientResponse === "taken").length;
        const totalTracked = adherenceRows.filter(r => r.status === "taken" || r.status === "missed").length
          + careEventMeds.filter(e => e.status === "completed" || e.status === "missed" || e.patientResponse === "taken" || e.patientResponse === "not_taken").length;
        const totalPositive = takenAdherence + respondedCareEvents;

        if (totalTracked > 0) {
          adherenceRate = Math.round((totalPositive / totalTracked) * 100);
        }

        const allFollowups = await db.select().from(followups)
          .where(sql`${followups.visitId} IN (${inClause})`);

        const totalFollowups = allFollowups.length;
        if (totalFollowups > 0) {
          const completedFollowups = allFollowups.filter(f => {
            const originalVisit = allVisits.find(v => v.id === f.visitId);
            if (!originalVisit) return false;
            const patientId = originalVisit.patientId;

            let targetDate: Date | null = null;
            if (f.followupDate) {
              targetDate = new Date(f.followupDate);
            } else if (f.followupAfterDays && originalVisit.visitDate) {
              targetDate = new Date(originalVisit.visitDate);
              targetDate.setDate(targetDate.getDate() + f.followupAfterDays);
            }

            return allVisits.some(v => {
              if (v.id === f.visitId) return false;
              if (v.patientId !== patientId) return false;
              if (!v.visitDate) return false;
              const vDate = new Date(v.visitDate);
              if (targetDate) {
                const dayBefore = new Date(targetDate);
                dayBefore.setDate(dayBefore.getDate() - 3);
                return vDate >= dayBefore;
              }
              const origDate = new Date(originalVisit.visitDate!);
              return vDate > origDate;
            });
          });
          followupCompletionRate = Math.round((completedFollowups.length / totalFollowups) * 100);
        }

        const approvedVisits = allVisits.filter(v => v.approved);
        const patientIds = [...new Set(allVisits.map(v => v.patientId))];
        const totalPatients = patientIds.length;

        if (totalPatients > 0 && approvedVisits.length > 0) {
          const patientsWithCarePlans = patientIds.filter(pid =>
            approvedVisits.some(v => v.patientId === pid)
          );

          let unplannedRevisits = 0;
          let totalExpectedSingleVisit = 0;

          for (const pid of patientsWithCarePlans) {
            const patientVisits = allVisits.filter(v => v.patientId === pid)
              .sort((a, b) => new Date(a.visitDate!).getTime() - new Date(b.visitDate!).getTime());

            const patientFollowups = allFollowups.filter(f =>
              patientVisits.some(v => v.id === f.visitId)
            );

            const expectedVisits = 1 + patientFollowups.length;
            const actualVisits = patientVisits.length;
            totalExpectedSingleVisit += expectedVisits;

            if (actualVisits > expectedVisits) {
              unplannedRevisits += (actualVisits - expectedVisits);
            }
          }

          if (totalExpectedSingleVisit > 0) {
            const preventedRate = Math.round(((totalExpectedSingleVisit - unplannedRevisits) / totalExpectedSingleVisit) * 100);
            reducedOpdRate = Math.min(preventedRate, 100);
          }
        }
      }

      res.json({
        medicineAdherence: adherenceRate,
        followupCompletion: followupCompletionRate,
        reducedOpdLoad: reducedOpdRate,
        details: {
          totalVisits: allVisits.length,
          approvedVisits: allVisits.filter(v => v.approved).length,
          totalPatients: [...new Set(allVisits.map(v => v.patientId))].length,
        }
      });
    } catch (err) {
      console.error("Metrics error:", err);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // ── Patients ──
  app.get("/api/patients", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const doctorId = user.role === "doctor" ? user.id : undefined;
      const allPatients = await storage.getPatients(doctorId);

      const nonAsciiIndices: number[] = [];
      const nonAsciiNames: string[] = [];
      for (let i = 0; i < allPatients.length; i++) {
        const name = allPatients[i].name || "";
        if (/[^\x00-\x7F]/.test(name)) {
          nonAsciiIndices.push(i);
          nonAsciiNames.push(name);
        }
      }

      if (nonAsciiNames.length > 0) {
        try {
          const transliterated = await transliterateNamesToEnglish(nonAsciiNames);
          for (let j = 0; j < nonAsciiIndices.length; j++) {
            const idx = nonAsciiIndices[j];
            (allPatients[idx] as any).name = transliterated[j] || allPatients[idx].name;
          }
        } catch (err: any) {
          console.error("[transliterate] Failed for patient list:", err.message);
        }
      }

      const nonAsciiGenderIndices: number[] = [];
      const nonAsciiGenders: string[] = [];
      for (let i = 0; i < allPatients.length; i++) {
        const gender = allPatients[i].gender || "";
        if (/[^\x00-\x7F]/.test(gender)) {
          nonAsciiGenderIndices.push(i);
          nonAsciiGenders.push(gender);
        }
      }
      if (nonAsciiGenders.length > 0) {
        try {
          const transliterated = await transliterateNamesToEnglish(nonAsciiGenders);
          for (let j = 0; j < nonAsciiGenderIndices.length; j++) {
            const idx = nonAsciiGenderIndices[j];
            (allPatients[idx] as any).gender = transliterated[j] || allPatients[idx].gender;
          }
        } catch (err: any) {
          console.error("[transliterate] Failed for patient genders:", err.message);
        }
      }

      const nonAsciiCondIndices: number[] = [];
      const nonAsciiConds: string[] = [];
      for (let i = 0; i < allPatients.length; i++) {
        const cond = allPatients[i].knownConditions || "";
        if (/[^\x00-\x7F]/.test(cond)) {
          nonAsciiCondIndices.push(i);
          nonAsciiConds.push(cond);
        }
      }
      if (nonAsciiConds.length > 0) {
        try {
          const transliterated = await transliterateNamesToEnglish(nonAsciiConds);
          for (let j = 0; j < nonAsciiCondIndices.length; j++) {
            const idx = nonAsciiCondIndices[j];
            (allPatients[idx] as any).knownConditions = transliterated[j] || allPatients[idx].knownConditions;
          }
        } catch (err: any) {
          console.error("[transliterate] Failed for patient conditions:", err.message);
        }
      }

      res.json(allPatients);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  app.get("/api/patients/:id", authMiddleware, requireApproved, async (req, res) => {
    try {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      res.json(patient);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch patient" });
    }
  });

  app.post("/api/patients", authMiddleware, requireApproved, async (req, res) => {
    try {
      const parsed = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(parsed);
      res.status(201).json(patient);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create patient" });
    }
  });

  app.patch("/api/patients/:id", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      if (user.role === "doctor" && patient.doctorId !== user.id) {
        return res.status(403).json({ message: "Not authorized to update this patient" });
      }
      const { name, age, gender, whatsappNumber, knownConditions, allergies } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (age !== undefined) updateData.age = parseInt(age);
      if (gender !== undefined) updateData.gender = gender || null;
      if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber?.trim() || null;
      if (knownConditions !== undefined) updateData.knownConditions = knownConditions?.trim() || null;
      if (allergies !== undefined) updateData.allergies = allergies?.trim() || null;
      const updated = await storage.updatePatient(req.params.id, updateData);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update patient" });
    }
  });

  // ── Visits ──
  app.get("/api/visits", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const doctorId = user.role === "doctor" ? user.id : undefined;
      const results = await storage.getVisitsLightWithPatients(doctorId);
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch visits" });
    }
  });

  app.get("/api/visits/:id", authMiddleware, requireApproved, async (req, res) => {
    try {
      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });

      const patient = await storage.getPatient(visit.patientId);
      const meds = await storage.getMedicinesByVisit(visit.id);
      const visitTests = await storage.getTestsByVisit(visit.id);
      const fups = await storage.getFollowupsByVisit(visit.id);
      const events = await storage.getCareEventsByVisit(visit.id);

      const { audioBase64, ...visitWithoutAudio } = visit;
      res.json({
        ...visitWithoutAudio,
        hasAudio: !!audioBase64,
        patient,
        medicines: meds,
        tests: visitTests,
        followups: fups,
        careEvents: events,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch visit" });
    }
  });

  app.get("/api/visits/:id/audio", authMiddleware, requireApproved, async (req, res) => {
    try {
      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });
      if (!visit.audioBase64) return res.status(404).json({ message: "No audio available" });
      
      let raw = visit.audioBase64;
      let contentType = "audio/webm";
      const dataUrlMatch = raw.match(/^data:(audio\/[^;]+);base64,/);
      if (dataUrlMatch) {
        contentType = dataUrlMatch[1];
        raw = raw.slice(dataUrlMatch[0].length);
      }
      const audioBuffer = Buffer.from(raw, "base64");
      res.set("Content-Type", contentType);
      res.set("Content-Length", audioBuffer.length.toString());
      res.set("Accept-Ranges", "bytes");
      res.send(audioBuffer);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch audio" });
    }
  });

  app.post("/api/visits", authMiddleware, requireApproved, async (req, res) => {
    try {
      const { patientName, patientAge, patientWhatsapp, patientGender, language } = req.body;
      const user = req.user!;
      const doctorId = user.role === "doctor" ? user.id : null;

      const errors: string[] = [];
      if (!patientName || typeof patientName !== "string" || !patientName.trim()) errors.push("Patient name is required");
      if (patientAge === undefined || patientAge === null || patientAge === "" || isNaN(parseInt(patientAge)) || parseInt(patientAge) < 0 || parseInt(patientAge) > 150) errors.push("Valid patient age is required (0-150)");

      if (errors.length > 0) {
        return res.status(400).json({ message: "Validation error", errors });
      }

      let patient = await storage.getPatientByName(patientName.trim(), doctorId || undefined);
      if (!patient) {
        patient = await storage.createPatient({
          name: patientName.trim(),
          age: parseInt(patientAge),
          phone: null,
          whatsappNumber: patientWhatsapp?.trim() || null,
          gender: patientGender || null,
          knownConditions: null,
          allergies: null,
          doctorId,
        });
      }

      const visit = await storage.createVisit({
        patientId: patient.id,
        doctorId,
        language: language || "English",
        audioPath: null,
        transcriptText: null,
        aiDraftJson: null,
        status: "recording",
      });

      broadcastInvalidate("/api/visits", "/api/dashboard");
      res.status(201).json({ ...visit, patient });
    } catch (err: any) {
      console.error("Create visit error:", err);
      res.status(500).json({ message: "Failed to create visit" });
    }
  });

  app.patch("/api/visits/:id", authMiddleware, requireApproved, async (req, res) => {
    try {
      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });

      const updated = await storage.updateVisit(req.params.id, req.body);
      broadcastInvalidate("/api/visits", "/api/dashboard", `/api/visits/${req.params.id}`);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update visit" });
    }
  });

  app.post("/api/visits/:id/approve", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });

      const updated = await storage.updateVisit(req.params.id, {
        status: "active",
        approved: true,
        approvedAt: new Date(),
      });

      const approvedMeds = await storage.getMedicinesByVisit(req.params.id);
      for (const med of approvedMeds) {
        const timingHours = parseTimingToHours(med.timing);
        const totalDays = parseDurationDays(med.instructions, med.durationDays);
        for (let day = 0; day < totalDays; day++) {
          for (const hour of timingHours) {
            const scheduledDate = new Date();
            scheduledDate.setDate(scheduledDate.getDate() + day);
            scheduledDate.setHours(hour, 0, 0, 0);
            await storage.createCareEvent({
              visitId: req.params.id,
              medicineId: med.id,
              eventType: "medicine",
              scheduledTime: scheduledDate,
              status: "pending",
              patientResponse: null,
            });
          }
        }
      }

      const visitTests = await storage.getTestsByVisit(req.params.id);
      for (const test of visitTests) {
        await storage.createCareEvent({
          visitId: req.params.id,
          eventType: "test",
          scheduledTime: new Date(),
          status: "pending",
          patientResponse: null,
        });
      }

      const fups = await storage.getFollowupsByVisit(req.params.id);
      for (const fup of fups) {
        const followupDate = new Date();
        followupDate.setDate(followupDate.getDate() + (fup.followupAfterDays || 7));
        await storage.createCareEvent({
          visitId: req.params.id,
          eventType: "followup",
          scheduledTime: followupDate,
          status: "pending",
          patientResponse: null,
        });
      }

      (async () => {
        try {
          const patient = await storage.getPatient(visit.patientId);
          if (patient?.phone && isWhatsappConfigured()) {
            const doctor = visit.doctorId ? await storage.getUser(visit.doctorId) : null;

            let shareToken = await storage.getActiveShareToken(visit.id);
            if (!shareToken) {
              const token = crypto.randomBytes(32).toString("hex");
              const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
              shareToken = await storage.createShareToken(visit.id, token, expiresAt);
            }

            const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
            const pdfUrl = `${baseUrl}/api/visits/${req.params.id}/prescription.pdf?token=${shareToken.token}`;

            await sendPrescriptionPdf(
              patient.phone,
              patient.name,
              doctor?.name || "Doctor",
              pdfUrl,
              req.params.id
            );
          }
        } catch (err: any) {
          console.error("Auto-send prescription PDF failed (non-blocking):", err.message);
        }
      })();

      broadcastInvalidate("/api/visits", "/api/dashboard", `/api/visits/${req.params.id}`);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to approve visit" });
    }
  });

  app.post("/api/visits/:id/cancel", authMiddleware, requireApproved, async (req, res) => {
    try {
      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });
      if (visit.status !== "recording") {
        return res.status(400).json({ message: "Only recording visits can be cancelled" });
      }
      const updated = await storage.updateVisit(req.params.id, { status: "cancelled" });
      broadcastInvalidate("/api/visits", "/api/dashboard");
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to cancel visit" });
    }
  });

  // ── Medicines ──
  app.post("/api/visits/:visitId/medicines", authMiddleware, requireApproved, async (req, res) => {
    try {
      const data = { ...req.body, visitId: req.params.visitId };
      if (!data.durationDays && data.instructions) {
        data.durationDays = parseDurationDays(data.instructions, null);
      }
      const med = await storage.createMedicine(data);
      broadcastInvalidate(`/api/visits/${req.params.visitId}`);
      res.status(201).json(med);
    } catch (err) {
      res.status(500).json({ message: "Failed to add medicine" });
    }
  });

  app.patch("/api/medicines/:id", authMiddleware, requireApproved, async (req, res) => {
    try {
      const updated = await storage.updateMedicine(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update medicine" });
    }
  });

  app.delete("/api/medicines/:id", authMiddleware, requireApproved, async (req, res) => {
    try {
      const deleted = await storage.deleteMedicine(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Medicine not found" });
      broadcastInvalidate("/api/visits");
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete medicine" });
    }
  });

  // ── Tests ──
  app.post("/api/visits/:visitId/tests", authMiddleware, requireApproved, async (req, res) => {
    try {
      const data = { ...req.body, visitId: req.params.visitId };
      const test = await storage.createTest(data);
      res.status(201).json(test);
    } catch (err) {
      res.status(500).json({ message: "Failed to add test" });
    }
  });

  app.patch("/api/tests/:id", authMiddleware, requireApproved, async (req, res) => {
    try {
      const updated = await storage.updateTest(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update test" });
    }
  });

  app.delete("/api/tests/:id", authMiddleware, requireApproved, async (req, res) => {
    try {
      const deleted = await storage.deleteTest(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Test not found" });
      broadcastInvalidate("/api/visits");
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete test" });
    }
  });

  // ── Followups ──
  app.post("/api/visits/:visitId/followups", authMiddleware, requireApproved, async (req, res) => {
    try {
      const data = { ...req.body, visitId: req.params.visitId };
      const fup = await storage.createFollowup(data);
      res.status(201).json(fup);
    } catch (err) {
      res.status(500).json({ message: "Failed to add followup" });
    }
  });

  app.patch("/api/followups/:id", authMiddleware, requireApproved, async (req, res) => {
    try {
      const updated = await storage.updateFollowup(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update followup" });
    }
  });

  // ── Upload Audio File ──
  app.post("/api/visits/:id/upload-audio", authMiddleware, requireApproved, loadPlanFeatures, async (req: any, res) => {
    try {
      if (req.planFeatures && req.user?.role === "doctor") {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const usageResult = await db.select({ total: sql<number>`COALESCE(SUM(minutes_used), 0)` })
          .from(aiUsageLogs).where(sql`doctor_id = ${req.user.id} AND created_at >= ${startOfMonth}`);
        const used = usageResult[0]?.total || 0;
        if (used >= req.planFeatures.aiMinutesPerMonth) {
          return res.status(403).json({ message: "AI minutes limit exceeded for this month", upgradeRequired: true });
        }
      }

      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });

      const { audio, fileName } = req.body;
      if (!audio || typeof audio !== "string" || audio.length < 100) {
        return res.status(400).json({ message: "No audio file provided or file is too small" });
      }

      const visitLanguage = visit.language || "English";

      console.log(`Upload audio: Transcribing uploaded file "${fileName || "unknown"}" (${Math.round(audio.length / 1024)}KB base64)`);

      let transcript = "";
      try {
        transcript = await transcribeAudio(audio, visitLanguage);
      } catch (err: any) {
        console.error("Upload audio transcription error:", err.message);
        return res.status(500).json({ message: "Failed to transcribe the audio file. Please try a different recording." });
      }

      const estimatedMinutes = Math.max(0.1, (audio.length * 0.75) / (16000 * 2 * 60));
      storage.createAiUsageLog({
        doctorId: visit.doctorId,
        visitId: req.params.id,
        minutesUsed: Math.round(estimatedMinutes * 100) / 100,
        usageType: "upload_transcription",
      }).catch(err => console.error("AI usage log error:", err));

      if (!transcript || transcript.trim().length < 20) {
        return res.status(400).json({ message: "Could not extract enough speech from the audio file. Please ensure the recording is clear and audible." });
      }

      console.log(`Upload audio: Transcription successful (${transcript.length} chars). Extracting clinical data...`);

      const historyCtx = await buildPatientHistoryContext(visit.patientId);
      const aiDraft = await extractMedicalData(transcript, visitLanguage, historyCtx);

      const updateData: any = {
        transcriptText: transcript,
        aiDraftJson: aiDraft,
        status: "draft",
        audioBase64: audio,
      };
      await storage.updateVisit(req.params.id, updateData);

      const existingMeds = await storage.getMedicinesByVisit(req.params.id);
      for (const m of existingMeds) await storage.deleteMedicine(m.id);
      const existingTests = await storage.getTestsByVisit(req.params.id);
      for (const t of existingTests) await storage.deleteTest(t.id);
      const existingFollowups = await storage.getFollowupsByVisit(req.params.id);
      for (const f of existingFollowups) await storage.deleteFollowup(f.id);

      for (const med of aiDraft.medicines) {
        await storage.createMedicine({
          visitId: req.params.id,
          name: med.medicine_name,
          dose: med.dosage,
          frequency: med.frequency,
          timing: med.timing || null,
          durationDays: null,
          instructions: med.duration || null,
        });
      }

      for (const testItem of aiDraft.tests) {
        const isObj = typeof testItem === "object" && testItem !== null;
        const testName = isObj ? (testItem as any).test_name : testItem;
        const whenToDo = isObj ? (testItem as any).when_to_do || null : null;
        const urgency = isObj ? (testItem as any).urgency || null : null;
        const triggerCondition = isObj ? (testItem as any).trigger_condition || null : null;
        await storage.createTest({
          visitId: req.params.id,
          name: testName,
          whenToDo,
          urgency,
          triggerCondition,
          fastingRequired: false,
        });
      }

      if (aiDraft.follow_up) {
        const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, fourteen: 14 };
        let afterDays: number | null = null;
        const daysMatch = aiDraft.follow_up.match(/(\d+)\s*(day|week|month)/i);
        const wordMatch = aiDraft.follow_up.match(/(one|two|three|four|five|six|seven|eight|ten|fourteen)\s*(day|week|month)/i);
        if (daysMatch) {
          const num = parseInt(daysMatch[1]);
          const unit = daysMatch[2].toLowerCase();
          afterDays = unit.startsWith("week") ? num * 7 : unit.startsWith("month") ? num * 30 : num;
        } else if (wordMatch) {
          const num = wordToNum[wordMatch[1].toLowerCase()] || 7;
          const unit = wordMatch[2].toLowerCase();
          afterDays = unit.startsWith("week") ? num * 7 : unit.startsWith("month") ? num * 30 : num;
        }
        await storage.createFollowup({
          visitId: req.params.id,
          followupAfterDays: afterDays,
          followupDate: null,
          warningSigns: [],
          notes: aiDraft.follow_up,
        });
      }

      const updatedVisit = await storage.getVisit(req.params.id);
      broadcastInvalidate("/api/visits", "/api/dashboard", `/api/visits/${req.params.id}`);
      res.json(updatedVisit);

      autoGenerateAlternativesForVisit(req.params.id).catch(() => {});
    } catch (err) {
      console.error("Upload audio error:", err);
      res.status(500).json({ message: "Failed to process uploaded audio" });
    }
  });

  // ── Chunked Audio Processing ──
  const chunkAudioSizeCache = new Map<string, number>();
  app.post("/api/visits/:id/chunk", authMiddleware, requireApproved, loadPlanFeatures, async (req: any, res) => {
    try {
      if (req.planFeatures && req.user?.role === "doctor") {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const usageResult = await db.select({ total: sql<number>`COALESCE(SUM(minutes_used), 0)` })
          .from(aiUsageLogs).where(sql`doctor_id = ${req.user.id} AND created_at >= ${startOfMonth}`);
        const used = usageResult[0]?.total || 0;
        if (used >= req.planFeatures.aiMinutesPerMonth) {
          return res.status(403).json({ message: "AI minutes limit exceeded for this month", upgradeRequired: true });
        }
      }

      console.log(`[CHUNK-SERVER] Received chunk for visit ${req.params.id}`);
      const visit = await storage.getVisit(req.params.id);
      if (!visit) {
        console.log(`[CHUNK-SERVER] Visit not found: ${req.params.id}`);
        return res.status(404).json({ message: "Visit not found" });
      }

      const { audio, chunkIndex } = req.body;
      if (!audio || typeof audio !== "string" || audio.length < 100) {
        console.warn(`[CHUNK-SERVER] Invalid audio chunk: type=${typeof audio}, length=${audio?.length || 0}`);
        return res.status(400).json({ message: "Invalid audio chunk" });
      }

      console.log(`[CHUNK-SERVER] Chunk #${chunkIndex}: audio base64 length=${audio.length}`);

      const lastSize = chunkAudioSizeCache.get(req.params.id) || 0;
      const currentSize = audio.length;
      const growthRatio = lastSize > 0 ? currentSize / lastSize : 2;
      if (growthRatio < 1.15 && lastSize > 0) {
        console.log(`[CHUNK-SERVER] Chunk #${chunkIndex}: Audio grew only ${Math.round((growthRatio - 1) * 100)}%, skipping re-transcription`);
        return res.json({ chunkIndex, chunkTranscript: "", fullTranscript: visit.transcriptText || "" });
      }

      chunkAudioSizeCache.set(req.params.id, currentSize);

      const visitLanguage = visit.language || "English";
      console.log(`[CHUNK-SERVER] Chunk #${chunkIndex}: Transcribing with Whisper (lang=${visitLanguage})...`);
      let fullTranscript = "";
      try {
        fullTranscript = await transcribeAudioChunk(audio, visitLanguage);
        console.log(`[CHUNK-SERVER] Chunk #${chunkIndex}: Whisper returned ${fullTranscript?.length || 0} chars`);
      } catch (err: any) {
        console.error(`[CHUNK-SERVER] Chunk #${chunkIndex} transcription error:`, err.message);
        return res.json({ chunkIndex, chunkTranscript: "", fullTranscript: visit.transcriptText || "" });
      }

      if (fullTranscript && fullTranscript.trim().length > 0) {
        await storage.updateVisit(req.params.id, { transcriptText: fullTranscript });
        console.log(`[CHUNK-SERVER] Chunk #${chunkIndex}: Transcript saved to DB`);
      }

      res.json({ chunkIndex, chunkTranscript: fullTranscript, fullTranscript: fullTranscript || visit.transcriptText || "" });
    } catch (err) {
      console.error("[CHUNK-SERVER] Processing error:", err);
      res.status(500).json({ message: "Failed to process audio chunk" });
    }
  });

  // Finalize
  app.post("/api/visits/:id/finalize", authMiddleware, requireApproved, loadPlanFeatures, async (req: any, res) => {
    try {
      if (req.planFeatures && req.user?.role === "doctor") {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const usageResult = await db.select({ total: sql<number>`COALESCE(SUM(minutes_used), 0)` })
          .from(aiUsageLogs).where(sql`doctor_id = ${req.user.id} AND created_at >= ${startOfMonth}`);
        const used = usageResult[0]?.total || 0;
        if (used >= req.planFeatures.aiMinutesPerMonth) {
          return res.status(403).json({ message: "AI minutes limit exceeded for this month", upgradeRequired: true });
        }
      }

      console.log(`[FINALIZE-SERVER] Received finalize for visit ${req.params.id}`);
      const visit = await storage.getVisit(req.params.id);
      if (!visit) {
        console.log(`[FINALIZE-SERVER] Visit not found: ${req.params.id}`);
        return res.status(404).json({ message: "Visit not found" });
      }

      const lastChunkAudioSize = chunkAudioSizeCache.get(req.params.id) || 0;
      chunkAudioSizeCache.delete(req.params.id);

      const visitLanguage = visit.language || "English";
      const { fullAudio, hadChunks } = req.body;

      let transcript = visit.transcriptText || "";
      let audioSizeForUsage = 0;
      console.log(`[FINALIZE-SERVER] hadChunks=${hadChunks}, hasFullAudio=${!!fullAudio && fullAudio.length > 100}, existingTranscript=${transcript.length} chars`);

      const hasFullAudio = fullAudio && typeof fullAudio === "string" && fullAudio.length > 100;
      const hasGoodChunkTranscript = hadChunks && transcript.trim().length >= 50;

      if (hasGoodChunkTranscript && !hasFullAudio) {
        console.log(`[FINALIZE-SERVER] Using existing chunk transcript (${transcript.length} chars) — skipping re-transcription`);
        audioSizeForUsage = lastChunkAudioSize;
      } else if (hasFullAudio) {
        console.log(`[FINALIZE-SERVER] Transcribing full audio (${fullAudio.length} base64 chars, ~${Math.round(fullAudio.length * 0.75 / 1024)}KB) with Whisper...`);
        audioSizeForUsage = fullAudio.length;
        try {
          const fullTranscript = await transcribeAudio(fullAudio, visitLanguage);
          if (fullTranscript && fullTranscript.trim().length > 0) {
            if (fullTranscript.trim().length > transcript.trim().length) {
              transcript = fullTranscript;
              console.log(`[FINALIZE-SERVER] Full audio transcription successful (${transcript.length} chars), replacing chunk transcript`);
            } else {
              console.log(`[FINALIZE-SERVER] Full audio transcript (${fullTranscript.trim().length} chars) shorter than chunk transcript (${transcript.trim().length} chars), keeping chunk transcript`);
            }
          } else {
            console.log("[FINALIZE-SERVER] Full audio transcription returned empty");
            if (hasGoodChunkTranscript) {
              console.log(`[FINALIZE-SERVER] Falling back to chunk transcript (${transcript.length} chars)`);
            }
          }
        } catch (err: any) {
          console.error("[FINALIZE-SERVER] Full audio transcription error:", err.message, err.stack?.substring(0, 200));
          if (hasGoodChunkTranscript) {
            console.log(`[FINALIZE-SERVER] Falling back to chunk transcript (${transcript.length} chars)`);
          }
        }
      } else {
        console.warn(`[FINALIZE-SERVER] No audio source available — hadChunks=${hadChunks}, fullAudio=${!!fullAudio}, existingTranscript=${transcript.length}`);
      }

      if (audioSizeForUsage > 0) {
        const estMinutes = Math.max(0.1, (audioSizeForUsage * 0.75) / (16000 * 2 * 60));
        storage.createAiUsageLog({
          doctorId: visit.doctorId,
          visitId: req.params.id,
          minutesUsed: Math.round(estMinutes * 100) / 100,
          usageType: "finalize_transcription",
        }).catch(err => console.error("AI usage log error:", err));
      }

      if (!transcript || transcript.trim().length < 20) {
        const diagnostics = {
          hadChunks,
          fullAudioReceived: !!fullAudio,
          fullAudioLength: fullAudio?.length || 0,
          existingTranscriptLength: (visit.transcriptText || "").length,
          finalTranscriptLength: transcript.trim().length,
        };
        console.error(`[FINALIZE-SERVER] Transcript too short (${transcript.trim().length} chars) — diagnostics:`, JSON.stringify(diagnostics));
        return res.status(400).json({ 
          message: `No audio was captured (transcript: ${transcript.trim().length} chars, audio: ${fullAudio ? Math.round(fullAudio.length / 1024) + 'KB' : 'none'}, chunks: ${hadChunks}). Please ensure microphone permission is granted and speak clearly during recording. If using a mobile app, open the page in Chrome browser instead.`
        });
      }

      console.log(`[FINALIZE-SERVER] Calling GPT-4o for medical extraction (transcript: ${transcript.length} chars)...`);
      const historyContext = await buildPatientHistoryContext(visit.patientId);
      const aiDraft = await extractMedicalData(transcript, visitLanguage, historyContext);
      console.log(`[FINALIZE-SERVER] GPT-4o extraction complete — medicines: ${aiDraft.medicines?.length || 0}, tests: ${aiDraft.tests?.length || 0}`);

      const updateData: any = {
        transcriptText: transcript,
        aiDraftJson: aiDraft,
        status: "draft",
      };
      if (fullAudio && typeof fullAudio === "string" && fullAudio.length > 100) {
        updateData.audioBase64 = fullAudio;
      }
      await storage.updateVisit(req.params.id, updateData);

      const existingMeds = await storage.getMedicinesByVisit(req.params.id);
      for (const m of existingMeds) await storage.deleteMedicine(m.id);
      const existingTests = await storage.getTestsByVisit(req.params.id);
      for (const t of existingTests) await storage.deleteTest(t.id);
      const existingFollowups = await storage.getFollowupsByVisit(req.params.id);
      for (const f of existingFollowups) await storage.deleteFollowup(f.id);

      for (const med of aiDraft.medicines) {
        await storage.createMedicine({
          visitId: req.params.id,
          name: med.medicine_name,
          dose: med.dosage,
          frequency: med.frequency,
          timing: med.timing || null,
          durationDays: null,
          instructions: med.duration || null,
        });
      }

      for (const testItem of aiDraft.tests) {
        const isObj = typeof testItem === "object" && testItem !== null;
        const testName = isObj ? (testItem as any).test_name : testItem;
        const whenToDo = isObj ? (testItem as any).when_to_do || null : null;
        const urgency = isObj ? (testItem as any).urgency || null : null;
        const triggerCondition = isObj ? (testItem as any).trigger_condition || null : null;
        await storage.createTest({
          visitId: req.params.id,
          name: testName,
          whenToDo,
          urgency,
          triggerCondition,
          fastingRequired: false,
        });
      }

      if (aiDraft.follow_up) {
        const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, fourteen: 14 };
        let afterDays: number | null = null;
        const daysMatch = aiDraft.follow_up.match(/(\d+)\s*(day|week|month)/i);
        const wordMatch = aiDraft.follow_up.match(/(one|two|three|four|five|six|seven|eight|ten|fourteen)\s*(day|week|month)/i);
        if (daysMatch) {
          const num = parseInt(daysMatch[1]);
          const unit = daysMatch[2].toLowerCase();
          afterDays = unit.startsWith("week") ? num * 7 : unit.startsWith("month") ? num * 30 : num;
        } else if (wordMatch) {
          const num = wordToNum[wordMatch[1].toLowerCase()] || 7;
          const unit = wordMatch[2].toLowerCase();
          afterDays = unit.startsWith("week") ? num * 7 : unit.startsWith("month") ? num * 30 : num;
        }
        await storage.createFollowup({
          visitId: req.params.id,
          followupAfterDays: afterDays,
          followupDate: null,
          warningSigns: [],
          notes: aiDraft.follow_up,
        });
      }

      const updatedVisit = await storage.getVisit(req.params.id);
      console.log(`[FINALIZE-SERVER] Complete — visit ${req.params.id} updated to status=${updatedVisit?.status}, medicines=${aiDraft.medicines?.length}, tests=${aiDraft.tests?.length}`);
      broadcastInvalidate("/api/visits", "/api/dashboard", `/api/visits/${req.params.id}`);
      res.json(updatedVisit);

      autoGenerateAlternativesForVisit(req.params.id).catch(() => {});
    } catch (err) {
      console.error("[FINALIZE-SERVER] Fatal error:", err);
      res.status(500).json({ message: "Failed to finalize visit" });
    }
  });

  // ── Re-extract AI data (re-run GPT-4o on existing transcript with updated language prompt) ──
  app.post("/api/visits/:id/reextract", authMiddleware, requireApproved, async (req, res) => {
    try {
      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });
      if (!visit.transcriptText || visit.transcriptText.length < 10) {
        return res.status(400).json({ message: "No transcript available to re-extract from" });
      }

      const requestedLanguage = req.body?.language;
      const visitLanguage = requestedLanguage || visit.language || "English";
      console.log(`[REEXTRACT] Re-extracting visit ${req.params.id} with language=${visitLanguage}, transcript=${visit.transcriptText.length} chars`);

      if (requestedLanguage && requestedLanguage !== visit.language) {
        await storage.updateVisit(req.params.id, { language: requestedLanguage });
      }

      const reextractHistory = await buildPatientHistoryContext(visit.patientId);
      const aiDraft = await extractMedicalData(visit.transcriptText, visitLanguage, reextractHistory);
      console.log(`[REEXTRACT] Complete — medicines: ${aiDraft.medicines?.length || 0}, tests: ${aiDraft.tests?.length || 0}`);

      await storage.updateVisit(req.params.id, {
        aiDraftJson: aiDraft,
        status: "draft",
      });

      const existingCareEvents = await storage.getCareEventsByVisit(req.params.id);
      for (const ce of existingCareEvents) {
        await db.delete(careEvents).where(eq(careEvents.id, ce.id));
      }
      const existingMeds = await storage.getMedicinesByVisit(req.params.id);
      for (const m of existingMeds) await storage.deleteMedicine(m.id);
      const existingTests = await storage.getTestsByVisit(req.params.id);
      for (const t of existingTests) await storage.deleteTest(t.id);
      const existingFollowups = await storage.getFollowupsByVisit(req.params.id);
      for (const f of existingFollowups) await storage.deleteFollowup(f.id);

      for (const med of aiDraft.medicines) {
        await storage.createMedicine({
          visitId: req.params.id,
          name: med.medicine_name,
          dose: med.dosage,
          frequency: med.frequency,
          timing: med.timing || null,
          durationDays: null,
          instructions: med.duration || null,
        });
      }

      for (const testItem of aiDraft.tests) {
        const isObj = typeof testItem === "object" && testItem !== null;
        const testName = isObj ? (testItem as any).test_name : testItem;
        const whenToDo = isObj ? (testItem as any).when_to_do || null : null;
        const urgency = isObj ? (testItem as any).urgency || null : null;
        const triggerCondition = isObj ? (testItem as any).trigger_condition || null : null;
        await storage.createTest({
          visitId: req.params.id,
          name: testName,
          whenToDo,
          urgency,
          triggerCondition,
          fastingRequired: false,
        });
      }

      if (aiDraft.follow_up) {
        const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, fourteen: 14 };
        let afterDays: number | null = null;
        const daysMatch = aiDraft.follow_up.match(/(\d+)\s*(day|week|month)/i);
        const wordMatch = aiDraft.follow_up.match(/(one|two|three|four|five|six|seven|eight|ten|fourteen)\s*(day|week|month)/i);
        if (daysMatch) {
          const num = parseInt(daysMatch[1]);
          const unit = daysMatch[2].toLowerCase();
          afterDays = unit.startsWith("week") ? num * 7 : unit.startsWith("month") ? num * 30 : num;
        } else if (wordMatch) {
          const num = wordToNum[wordMatch[1].toLowerCase()] || 7;
          const unit = wordMatch[2].toLowerCase();
          afterDays = unit.startsWith("week") ? num * 7 : unit.startsWith("month") ? num * 30 : num;
        }
        await storage.createFollowup({
          visitId: req.params.id,
          followupAfterDays: afterDays,
          followupDate: null,
          warningSigns: [],
          notes: aiDraft.follow_up,
        });
      }

      const updatedVisit = await storage.getVisit(req.params.id);
      broadcastInvalidate("/api/visits", "/api/dashboard", `/api/visits/${req.params.id}`);
      res.json(updatedVisit);

      autoGenerateAlternativesForVisit(req.params.id).catch(() => {});
    } catch (err) {
      console.error("[REEXTRACT] Error:", err);
      res.status(500).json({ message: "Failed to re-extract" });
    }
  });

  // ── Process Visit Audio (legacy) ──
  app.post("/api/visits/:id/process", authMiddleware, requireApproved, async (req, res) => {
    try {
      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });

      const visitLanguage = visit.language || "English";
      const { audio } = req.body;

      let transcript: string;
      const hasRealAudio = audio && typeof audio === "string" && audio.length > 100;
      if (hasRealAudio) {
        transcript = await transcribeAudio(audio, visitLanguage);
        const estMinutes = Math.max(0.1, (audio.length * 0.75) / (16000 * 2 * 60));
        storage.createAiUsageLog({
          doctorId: visit.doctorId,
          visitId: req.params.id,
          minutesUsed: Math.round(estMinutes * 100) / 100,
          usageType: "process_transcription",
        }).catch(err => console.error("AI usage log error:", err));
      } else {
        const patient = await storage.getPatient(visit.patientId);
        transcript = await generateTranscriptFromAudio(
          "General consultation",
          visitLanguage,
          patient ? { name: patient.name, age: patient.age, gender: patient.gender } : undefined
        );
      }

      const aiDraft = await extractMedicalData(transcript, visitLanguage);

      const updateData: any = {
        transcriptText: transcript,
        aiDraftJson: aiDraft,
        status: "draft",
      };
      if (hasRealAudio) {
        updateData.audioBase64 = audio;
      }
      await storage.updateVisit(req.params.id, updateData);

      const existingMeds = await storage.getMedicinesByVisit(req.params.id);
      for (const m of existingMeds) await storage.deleteMedicine(m.id);
      const existingTests = await storage.getTestsByVisit(req.params.id);
      for (const t of existingTests) await storage.deleteTest(t.id);
      const existingFollowups = await storage.getFollowupsByVisit(req.params.id);
      for (const f of existingFollowups) await storage.deleteFollowup(f.id);

      for (const med of aiDraft.medicines) {
        await storage.createMedicine({
          visitId: req.params.id,
          name: med.medicine_name,
          dose: med.dosage,
          frequency: med.frequency,
          timing: med.timing || null,
          durationDays: null,
          instructions: med.duration || null,
        });
      }

      for (const testItem of aiDraft.tests) {
        const isObj = typeof testItem === "object" && testItem !== null;
        const testName = isObj ? (testItem as any).test_name : testItem;
        const whenToDo = isObj ? (testItem as any).when_to_do || null : null;
        const urgency = isObj ? (testItem as any).urgency || null : null;
        const triggerCondition = isObj ? (testItem as any).trigger_condition || null : null;
        await storage.createTest({
          visitId: req.params.id,
          name: testName,
          whenToDo,
          urgency,
          triggerCondition,
          fastingRequired: false,
        });
      }

      if (aiDraft.follow_up) {
        const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, fourteen: 14 };
        let afterDays: number | null = null;
        const daysMatch = aiDraft.follow_up.match(/(\d+)\s*(day|week|month)/i);
        const wordMatch = aiDraft.follow_up.match(/(one|two|three|four|five|six|seven|eight|ten|fourteen)\s*(day|week|month)/i);
        if (daysMatch) {
          const num = parseInt(daysMatch[1]);
          const unit = daysMatch[2].toLowerCase();
          afterDays = unit.startsWith("week") ? num * 7 : unit.startsWith("month") ? num * 30 : num;
        } else if (wordMatch) {
          const num = wordToNum[wordMatch[1].toLowerCase()] || 7;
          const unit = wordMatch[2].toLowerCase();
          afterDays = unit.startsWith("week") ? num * 7 : unit.startsWith("month") ? num * 30 : num;
        }
        await storage.createFollowup({
          visitId: req.params.id,
          followupAfterDays: afterDays,
          followupDate: null,
          warningSigns: [],
          notes: aiDraft.follow_up,
        });
      }

      const updatedVisit = await storage.getVisit(req.params.id);
      broadcastInvalidate("/api/visits", "/api/dashboard", `/api/visits/${req.params.id}`);
      res.json(updatedVisit);

      autoGenerateAlternativesForVisit(req.params.id).catch(() => {});
    } catch (err) {
      console.error("Process error:", err);
      res.status(500).json({ message: "Failed to process visit" });
    }
  });

  // ── Search ──
  app.get("/api/search/visits", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const doctorId = user.role === "doctor" ? user.id : undefined;
      const { patientName, status, language, dateFrom, dateTo } = req.query;
      const results = await storage.searchVisitsWithPatients({
        patientName: patientName as string | undefined,
        status: status as string | undefined,
        language: language as string | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
      }, doctorId);
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Failed to search visits" });
    }
  });

  // ── Patient Portal ──
  app.get("/api/patients/:id/portal", authMiddleware, requireApproved, async (req, res) => {
    try {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Patient not found" });

      const patientVisits = await storage.getVisitsByPatient(req.params.id);
      const visitsWithDetails = await Promise.all(patientVisits.map(async (visit) => {
        const meds = await storage.getMedicinesByVisit(visit.id);
        const visitTests = await storage.getTestsByVisit(visit.id);
        const fups = await storage.getFollowupsByVisit(visit.id);
        const events = await storage.getCareEventsByVisit(visit.id);
        return { ...visit, medicines: meds, tests: visitTests, followups: fups, careEvents: events };
      }));

      res.json({ patient, visits: visitsWithDetails });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch patient portal" });
    }
  });

  // ── Calendar Events ──
  app.get("/api/calendar/events", authMiddleware, requireApproved, loadPlanFeatures, requireFeature("calendarFeatures"), async (req, res) => {
    try {
      const user = req.user!;
      const doctorId = user.role === "doctor" ? user.id : undefined;
      const allVisits = await storage.getVisitsLightWithPatients(doctorId);
      const activeVisits = allVisits.filter(v => v.status === "active" || v.status === "draft");
      const events: any[] = [];

      if (activeVisits.length === 0) {
        return res.json(events);
      }

      const activeVisitIds = activeVisits.map(v => v.id);
      const inClause = sql.join(activeVisitIds.map(id => sql`${id}`), sql`, `);
      const allFollowups = await db.select().from(followups).where(sql`${followups.visitId} IN (${inClause})`);
      const allMeds = await db.select().from(medicines).where(sql`${medicines.visitId} IN (${inClause})`);

      const followupsByVisit = new Map<string, typeof allFollowups>();
      for (const f of allFollowups) {
        const arr = followupsByVisit.get(f.visitId) || [];
        arr.push(f);
        followupsByVisit.set(f.visitId, arr);
      }
      const medsByVisit = new Map<string, typeof allMeds>();
      for (const m of allMeds) {
        const arr = medsByVisit.get(m.visitId) || [];
        arr.push(m);
        medsByVisit.set(m.visitId, arr);
      }

      for (const visit of activeVisits) {
        const patientName = visit.patient?.name || "Unknown";

        events.push({
          id: `visit-${visit.id}`,
          type: "visit",
          title: `Visit: ${patientName}`,
          date: visit.visitDate,
          status: visit.status,
          visitId: visit.id,
          patientName,
        });

        const fups = followupsByVisit.get(visit.id) || [];
        for (const fup of fups) {
          if (fup.followupAfterDays) {
            const followupDate = new Date(visit.visitDate!);
            followupDate.setDate(followupDate.getDate() + fup.followupAfterDays);
            events.push({
              id: `followup-${fup.id}`,
              type: "followup",
              title: `Follow-up: ${patientName}`,
              date: followupDate.toISOString(),
              status: visit.status,
              visitId: visit.id,
              patientName,
              notes: fup.notes,
            });
          }
        }

        const meds = medsByVisit.get(visit.id) || [];
        for (const med of meds) {
          if (med.durationDays) {
            const endDate = new Date(visit.visitDate!);
            endDate.setDate(endDate.getDate() + med.durationDays);
            events.push({
              id: `med-end-${med.id}`,
              type: "medicine_end",
              title: `${med.name} ends: ${patientName}`,
              date: endDate.toISOString(),
              status: visit.status,
              visitId: visit.id,
              patientName,
            });
          }
        }
      }

      res.json(events);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });

  // ── Adherence Tracking ──
  app.get("/api/adherence/patient/:patientId", authMiddleware, requireApproved, loadPlanFeatures, requireFeature("adherenceTracking"), async (req, res) => {
    try {
      const logs = await storage.getAdherenceLogsByPatient(req.params.patientId);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch adherence logs" });
    }
  });

  app.get("/api/adherence/visit/:visitId", authMiddleware, requireApproved, loadPlanFeatures, requireFeature("adherenceTracking"), async (req, res) => {
    try {
      const logs = await storage.getAdherenceLogsByVisit(req.params.visitId);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch adherence logs" });
    }
  });

  app.post("/api/adherence", authMiddleware, requireApproved, loadPlanFeatures, requireFeature("adherenceTracking"), async (req, res) => {
    try {
      const parsed = insertAdherenceLogSchema.parse(req.body);
      const existing = await storage.getAdherenceLogsByVisit(parsed.visitId);
      const existingLog = existing.find(l => l.dayNumber === parsed.dayNumber && l.medicineId === (parsed.medicineId || null));
      if (existingLog) {
        const updated = await storage.updateAdherenceLog(existingLog.id, { status: parsed.status, notes: parsed.notes });
        return res.json(updated);
      }
      const log = await storage.createAdherenceLog(parsed);
      res.status(201).json(log);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
      res.status(500).json({ message: "Failed to create adherence log" });
    }
  });

  // ── Aadhaar Scan ──
  app.post("/api/scan-aadhaar", authMiddleware, requireApproved, loadPlanFeatures, requireFeature("identityVerification"), async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ message: "No image provided" });
      const result = await scanAadhaarCard(image);
      res.json(result);
    } catch (err: any) {
      console.error("Aadhaar scan error:", err.message);
      res.status(500).json({ message: "Failed to scan Aadhaar card" });
    }
  });

  // ── Translate Transcript ──
  app.post("/api/translate-terms", authMiddleware, requireApproved, loadPlanFeatures, async (req: any, res) => {
    try {
      const { terms, language } = req.body;
      if (!terms || !Array.isArray(terms) || !language) {
        return res.status(400).json({ message: "Missing terms array or language" });
      }
      if (req.planFeatures && language !== "English") {
        const maxLangs = req.planFeatures.languagesSupported || 1;
        if (maxLangs <= 1) {
          return res.status(403).json({ message: "Multi-language translation not available on your plan", upgradeRequired: true });
        }
      }
      const { translateFreeTextBatch } = await import("./medical-translations");
      const uniqueTerms = [...new Set(terms.filter((t: string) => t && t.trim()))];
      const translated = await translateFreeTextBatch(uniqueTerms as string[], language);
      res.json(translated);
    } catch (err: any) {
      console.error("Batch translate error:", err.message);
      res.status(500).json({ message: "Failed to translate terms" });
    }
  });

  app.post("/api/translate", authMiddleware, requireApproved, async (req, res) => {
    try {
      const transcript = req.body.transcript || req.body.text;
      const targetLanguage = req.body.targetLanguage;
      if (!transcript || !targetLanguage) return res.status(400).json({ message: "Missing transcript or target language" });
      const translated = await translateTranscript(transcript, targetLanguage);
      res.json({ translatedText: translated });
    } catch (err: any) {
      console.error("Translation error:", err.message);
      res.status(500).json({ message: "Failed to translate transcript" });
    }
  });

  // ══════════════════════════════════════════════
  // SHARE ROUTES
  // ══════════════════════════════════════════════

  app.post("/api/visits/:id/share", authMiddleware, requireApproved, async (req, res) => {
    try {
      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });
      if (visit.status !== "active" && !visit.approved) return res.status(400).json({ message: "Only approved care plans can be shared" });

      const user = (req as any).user;
      if (user.role !== "admin" && visit.doctorId !== user.id) {
        return res.status(403).json({ message: "You can only share your own visits" });
      }

      const existing = await storage.getActiveShareToken(visit.id);
      if (existing) {
        const shareUrl = `${req.protocol}://${req.get("host")}/share/${existing.token}`;
        return res.json({ shareUrl, token: existing.token, expiresAt: existing.expiresAt });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storage.createShareToken(visit.id, token, expiresAt);

      const shareUrl = `${req.protocol}://${req.get("host")}/share/${token}`;
      res.json({ shareUrl, token, expiresAt });
    } catch (err) {
      console.error("Share token error:", err);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  app.get("/api/visits/:id/prescription.pdf", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(401).json({ message: "Token required" });

      const shareToken = await storage.getShareToken(token);
      if (!shareToken) return res.status(404).json({ message: "Invalid token" });
      if (new Date() > shareToken.expiresAt) return res.status(410).json({ message: "Token expired" });
      if (shareToken.visitId !== req.params.id) return res.status(403).json({ message: "Token mismatch" });

      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });

      const pdfBuffer = await generatePrescriptionPdf(req.params.id);
      const patient = await storage.getPatient(visit.patientId);
      const patientName = (patient?.name || "Patient").replace(/[^a-zA-Z0-9]/g, "_");
      const date = new Date().toLocaleDateString("en-IN").replace(/\//g, "-");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="Prescription_${patientName}_${date}.pdf"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("PDF generation error:", err);
      res.status(500).json({ message: "Failed to generate prescription PDF" });
    }
  });

  app.post("/api/visits/:id/send-prescription-whatsapp", authMiddleware, requireApproved, loadPlanFeatures, async (req: any, res) => {
    try {
      if (req.planFeatures && req.user?.role === "doctor") {
        const channels = (req.planFeatures.prescriptionChannels || "print").split(",");
        if (!channels.includes("whatsapp") && !channels.includes("all")) {
          return res.status(403).json({ message: "WhatsApp prescription sharing not available on your plan", upgradeRequired: true });
        }
      }

      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });
      if (!visit.approved) return res.status(400).json({ message: "Visit must be approved first" });

      const user = req.user;
      if (user.role !== "admin" && visit.doctorId !== user.id) {
        return res.status(403).json({ message: "You can only send prescriptions for your own visits" });
      }

      const patient = await storage.getPatient(visit.patientId);
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      if (!patient.phone) return res.status(400).json({ message: "Patient has no phone number" });

      const doctor = visit.doctorId ? await storage.getUser(visit.doctorId) : null;

      let shareToken = await storage.getActiveShareToken(visit.id);
      if (!shareToken) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        shareToken = await storage.createShareToken(visit.id, token, expiresAt);
      }

      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
      const pdfUrl = `${baseUrl}/api/visits/${visit.id}/prescription.pdf?token=${shareToken.token}`;

      const result = await sendPrescriptionPdf(
        patient.phone,
        patient.name,
        doctor?.name || "Doctor",
        pdfUrl,
        visit.id
      );

      if (result.success) {
        res.json({ success: true, message: "Prescription sent via WhatsApp" });
      } else {
        res.status(400).json({ success: false, message: result.error || "Failed to send" });
      }
    } catch (err: any) {
      console.error("WhatsApp prescription send error:", err);
      res.status(500).json({ message: "Failed to send prescription via WhatsApp" });
    }
  });

  const escHtml = (s: string | null | undefined): string => {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  app.get("/share/:token", async (req, res) => {
    try {
      const shareToken = await storage.getShareToken(req.params.token);
      if (!shareToken) return res.status(404).send("<html><body><h1>Link not found</h1><p>This care plan link is invalid.</p></body></html>");
      if (new Date() > shareToken.expiresAt) return res.status(410).send("<html><body><h1>Link expired</h1><p>This care plan link has expired. Please request a new one from your doctor.</p></body></html>");

      const visit = await storage.getVisit(shareToken.visitId);
      if (!visit) return res.status(404).send("<html><body><h1>Visit not found</h1></body></html>");
      if (visit.status !== "active" && !visit.approved) return res.status(403).send("<html><body><h1>Care plan unavailable</h1><p>This care plan is no longer approved. Please contact your doctor.</p></body></html>");

      const patient = await storage.getPatient(visit.patientId);
      const meds = await storage.getMedicinesByVisit(visit.id);
      const visitTests = await storage.getTestsByVisit(visit.id);
      const fups = await storage.getFollowupsByVisit(visit.id);
      const doctor = visit.doctorId ? await storage.getUser(visit.doctorId) : null;

      const drName = escHtml(doctor?.name || "Doctor");
      const drPhoto = (doctor?.profilePhoto || "").startsWith("data:image/") ? doctor!.profilePhoto : "";
      const drPhone = escHtml(doctor?.phone || "");
      const drEmail = escHtml(doctor?.email || "");
      const drClinic = escHtml(doctor?.clinicName || "");
      const drAddress = escHtml(doctor?.clinicAddress || "");
      const drQualifications = escHtml(doctor?.qualifications || "");
      const drSpecialization = escHtml(doctor?.specialization || "");

      const patientName = escHtml(patient?.name) || "Unknown";
      const patientId = visit.patientId ? "CP-" + visit.patientId.slice(-8).toUpperCase() : "N/A";
      const visitDate = visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : "Today";
      const visitDateTime = visit.visitDate ? new Date(visit.visitDate).toLocaleString() : new Date().toLocaleString();
      const langRaw = visit.language || "English";
      const lang = escHtml(langRaw);
      const aiDraft = visit.aiDraftJson as any;
      const summary = escHtml(aiDraft?.summary || "");
      const complaint = escHtml(aiDraft?.complaint || "");
      const diagnosis = escHtml(aiDraft?.diagnosis_impression || (aiDraft?.diagnosis || []).join(", ") || "");

      const allTextsToTranslate: string[] = [];
      meds.forEach(med => {
        if (med.frequency) allTextsToTranslate.push(med.frequency);
        if (med.timing) allTextsToTranslate.push(med.timing);
        if (med.instructions) allTextsToTranslate.push(med.instructions);
      });
      visitTests.forEach(t => {
        if (t.whenToDo) allTextsToTranslate.push(t.whenToDo);
        if (t.urgency) allTextsToTranslate.push(t.urgency);
        if (t.triggerCondition) allTextsToTranslate.push(t.triggerCondition);
      });
      const uniqueTexts = [...new Set(allTextsToTranslate)];
      const translationMap = await translateFreeTextBatch(uniqueTexts, langRaw);
      const tr = (text: string | null | undefined) => {
        if (!text) return "—";
        return translationMap[text] || translateMedicalTerm(text, langRaw);
      };

      let medsRows = "";
      meds.forEach((med, i) => {
        medsRows += `<tr><td>${i + 1}</td><td>${escHtml(med.name) || "—"}</td><td>${escHtml(med.dose) || "—"}</td><td>${escHtml(tr(med.frequency))}</td><td>${escHtml(tr(med.timing))}</td><td>${escHtml(tr(med.instructions))}</td></tr>`;
      });

      let testsRows = "";
      visitTests.forEach((t, i) => {
        testsRows += `<tr><td>${i + 1}</td><td>${escHtml(t.name) || "—"}</td><td>${escHtml(tr(t.whenToDo))}</td><td>${escHtml(tr(t.urgency))}</td><td>${escHtml(tr(t.triggerCondition))}</td></tr>`;
      });

      let followupHtml = "";
      fups.forEach((f) => {
        followupHtml += `<p><strong>Follow-up after:</strong> ${f.followupAfterDays || "—"} days</p>`;
        if (f.notes) followupHtml += `<p><strong>Notes:</strong> ${escHtml(f.notes)}</p>`;
        if (f.warningSigns?.length) followupHtml += `<p><strong>Warning Signs:</strong> ${escHtml(f.warningSigns.join(", "))}</p>`;
      });

      let transcriptHtml = "";
      if (visit.transcriptText) {
        const diarized = await storage.getDiarizedTranscript(visit.id);
        if (diarized?.diarizedTranscript) {
          const lines = diarized.diarizedTranscript.split('\n').filter((l: string) => l.trim());
          transcriptHtml = lines.map((line: string) => {
            const escaped = escHtml(line);
            if (line.startsWith('DR:')) {
              const content = escaped.replace('DR:', '').trim();
              return `<div style="margin-bottom:8px;display:flex;align-items:flex-start;gap:8px;"><span style="display:inline-block;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;white-space:nowrap;flex-shrink:0;">🩺 ${drName}</span><span style="flex:1">${content}</span></div>`;
            }
            const patientMatch = line.match(/^(PATIENT\s*\d*):/);
            if (patientMatch) {
              const label = patientMatch[1].trim() || "Patient";
              const content = escaped.replace(/^PATIENT\s*\d*:/, '').trim();
              return `<div style="margin-bottom:8px;display:flex;align-items:flex-start;gap:8px;"><span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;white-space:nowrap;flex-shrink:0;">👤 ${escHtml(label)}</span><span style="flex:1">${content}</span></div>`;
            }
            if (line.startsWith('PATIENT:')) {
              const content = escaped.replace('PATIENT:', '').trim();
              return `<div style="margin-bottom:8px;display:flex;align-items:flex-start;gap:8px;"><span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;white-space:nowrap;flex-shrink:0;">👤 ${escHtml(patientName)}</span><span style="flex:1">${content}</span></div>`;
            }
            return `<div style="margin-bottom:8px;">${escaped}</div>`;
          }).join('');
        } else {
          transcriptHtml = `<pre style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#374151;">${escHtml(visit.transcriptText)}</pre>`;
        }
      }

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Care Plan</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1a1a1a; font-size: 13px; line-height: 1.5; max-width: 900px; margin: 0 auto; background: #f8fafc; }
  .header { border-bottom: 3px solid #1a56db; padding-bottom: 15px; margin-bottom: 20px; background: white; padding: 20px; border-radius: 12px; }
  .header-top { display: flex; align-items: center; gap: 16px; }
  .header-top img { width: 64px; height: 64px; object-fit: cover; border-radius: 50%; border: 3px solid #1a56db; flex-shrink: 0; }
  .header-top .dr-initials { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg,#1a56db,#3b82f6); display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 700; border: 3px solid #1a56db; flex-shrink: 0; }
  .header-info { flex: 1; }
  .header-info h1 { font-size: 22px; color: #1a56db; margin: 0 0 2px 0; line-height: 1.2; }
  .header-info .dr-qual { font-size: 12px; color: #555; margin: 0 0 1px 0; line-height: 1.4; }
  .header-info .clinic-info { font-size: 13px; color: #1a56db; font-weight: 600; margin: 4px 0 0 0; }
  .header-subtitle { text-align: center; color: #555; font-size: 13px; margin-top: 10px; font-weight: 500; letter-spacing: 0.3px; }
  .patient-info { display: flex; gap: 20px; background: #f0f5ff; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .patient-info div { font-size: 13px; }
  .patient-info strong { color: #1a56db; }
  .section { margin-bottom: 22px; background: white; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .section-title { font-size: 15px; font-weight: 700; color: #1a56db; border-bottom: 2px solid #e5edff; padding-bottom: 6px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #1a56db; color: white; padding: 8px 10px; text-align: left; font-size: 12px; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
  tr:nth-child(even) { background: #f9fafb; }
  .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-top: 6px; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid #1a56db; color: #555; font-size: 11px; }
  .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 8px; }
  .footer-grid div { font-size: 12px; }
  .footer-grid strong { color: #1a56db; }
  .footer-note { text-align: center; font-size: 10px; color: #888; margin-top: 8px; }
  .print-bar { text-align: center; margin-bottom: 20px; }
  .print-bar button { background: #1a56db; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600; }
  .print-bar button:hover { background: #1544b5; }
  @media print {
    .print-bar { display: none; }
    body { padding: 15px; background: white; }
    .section { box-shadow: none; page-break-inside: auto; overflow: visible !important; max-height: none !important; }
    .section-title { page-break-after: avoid; }
    .footer { page-break-inside: avoid; }
  }
  @media (max-width: 600px) { table { font-size: 11px; } th, td { padding: 5px 6px; } .patient-info { flex-direction: column; gap: 6px; } }
</style></head><body>
<div class="print-bar">
  <button onclick="window.print()">Print / Save as PDF</button>
</div>

<div class="header">
  <div class="header-top">
    ${drPhoto ? `<img src="${drPhoto}" alt="Doctor Photo" />` : `<div class="dr-initials">${drName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2)}</div>`}
    <div class="header-info">
      <h1>${drName}</h1>
      ${drQualifications ? `<p class="dr-qual">${drQualifications}</p>` : ""}
      ${drSpecialization ? `<p class="dr-qual">${drSpecialization}</p>` : ""}
      ${drClinic ? `<p class="clinic-info">${drClinic}</p>` : ""}
    </div>
  </div>
  <p class="header-subtitle">Medical Consultation Report</p>
</div>

<div class="patient-info">
  <div><strong>Patient:</strong> ${patientName}</div>
  <div><strong>Patient ID:</strong> ${patientId}</div>
  <div><strong>Visit Date:</strong> ${visitDate}</div>
  <div><strong>Language:</strong> ${lang}</div>
  <div><strong>Status:</strong> Approved</div>
</div>

${complaint || diagnosis || summary ? `
<div class="section">
  <div class="section-title">Clinical Summary</div>
  <div class="summary-box">
    ${complaint ? `<p><strong>Complaint:</strong> ${complaint}</p>` : ""}
    ${diagnosis ? `<p><strong>Diagnosis:</strong> ${diagnosis}</p>` : ""}
    ${summary ? `<p style="margin-top:6px">${summary}</p>` : ""}
  </div>
</div>` : ""}

<div class="section">
  <div class="section-title">Prescribed Medications (${meds.length})</div>
  ${meds.length > 0 ? `
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Timing</th><th>Instructions</th></tr></thead>
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
  ${fups.length > 0 ? `<div class="summary-box">${followupHtml}</div>` : `<p style="color:#888; padding:10px 0;">No follow-up scheduled.</p>`}
</div>

${transcriptHtml ? `
<div class="section">
  <div class="section-title">Full Transcript</div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-top:6px;">${transcriptHtml}</div>
</div>` : ""}

<div class="footer">
  <div class="footer-grid">
    ${drPhone ? `<div><strong>Phone:</strong> ${drPhone}</div>` : ""}
    ${drEmail ? `<div><strong>Email:</strong> ${drEmail}</div>` : ""}
    ${drClinic ? `<div><strong>Clinic:</strong> ${drClinic}</div>` : ""}
    ${drAddress ? `<div><strong>Address:</strong> ${drAddress}</div>` : ""}
  </div>
  <p class="footer-note">Generated on ${new Date().toLocaleString()} | This is a computer-generated document. Please verify with the attending physician.</p>
</div>
</body></html>`;

      res.type("html").send(html);
    } catch (err) {
      console.error("Share view error:", err);
      res.status(500).send("<html><body><h1>Error loading care plan</h1></body></html>");
    }
  });

  // ══════════════════════════════════════════════
  // REPORTS API
  // ══════════════════════════════════════════════

  app.get("/api/reports", authMiddleware, requireApproved, loadPlanFeatures, requireFeature("reportsLevel"), async (req: any, res) => {
    try {
      const doctorId = req.user.id;
      const period = (req.query.period as string) || "daily";
      const dateStr = req.query.date as string;
      
      const now = dateStr ? new Date(dateStr) : new Date();
      let startDate: Date;
      let endDate: Date;
      
      if (period === "daily") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else if (period === "weekly") {
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }

      const allVisits = await storage.getVisitsLightWithPatients(doctorId);
      const filteredVisits = allVisits.filter((v: any) => {
        const vDate = new Date(v.visitDate);
        return vDate >= startDate && vDate < endDate;
      });

      const reportData = [];
      if (filteredVisits.length > 0) {
        const visitIds = filteredVisits.map(v => v.id);
        const inClause = sql.join(visitIds.map(id => sql`${id}`), sql`, `);
        const allMeds = await db.select().from(medicines).where(sql`${medicines.visitId} IN (${inClause})`);
        const allTests = await db.select().from(testsTable).where(sql`${testsTable.visitId} IN (${inClause})`);
        const allFollowups = await db.select().from(followups).where(sql`${followups.visitId} IN (${inClause})`);

        const medsByVisit = new Map<string, any[]>();
        for (const m of allMeds) { const arr = medsByVisit.get(m.visitId) || []; arr.push(m); medsByVisit.set(m.visitId, arr); }
        const testsByVisit = new Map<string, any[]>();
        for (const t of allTests) { const arr = testsByVisit.get(t.visitId) || []; arr.push(t); testsByVisit.set(t.visitId, arr); }
        const fupsByVisit = new Map<string, any[]>();
        for (const f of allFollowups) { const arr = fupsByVisit.get(f.visitId) || []; arr.push(f); fupsByVisit.set(f.visitId, arr); }

        for (const visit of filteredVisits) {
          reportData.push({
            visit: {
              id: visit.id,
              visitDate: visit.visitDate,
              status: visit.status,
              language: visit.language,
            },
            patient: visit.patient ? {
              id: visit.patient.id,
              name: visit.patient.name,
              age: visit.patient.age,
              gender: visit.patient.gender,
            } : null,
            medicines: medsByVisit.get(visit.id) || [],
            tests: testsByVisit.get(visit.id) || [],
            followups: fupsByVisit.get(visit.id) || [],
          });
        }
      }

      reportData.sort((a, b) => new Date(a.visit.visitDate).getTime() - new Date(b.visit.visitDate).getTime());

      const totalVisits = reportData.length;
      const activeVisits = reportData.filter(r => r.visit.status === "active").length;
      const draftVisits = reportData.filter(r => r.visit.status === "draft").length;
      const uniquePatients = new Set(reportData.map(r => r.patient?.id)).size;
      const totalMedicines = reportData.reduce((sum, r) => sum + r.medicines.length, 0);
      const totalTests = reportData.reduce((sum, r) => sum + r.tests.length, 0);

      res.json({
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          totalVisits,
          activeVisits,
          draftVisits,
          uniquePatients,
          totalMedicines,
          totalTests,
        },
        visits: reportData,
      });
    } catch (err: any) {
      console.error("Reports error:", err);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // ══════════════════════════════════════════════
  // AI PARSE MEDICAL HISTORY FROM VOICE
  // ══════════════════════════════════════════════

  app.post("/api/ai/parse-medical-history", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const { transcript } = req.body;
      if (!transcript || typeof transcript !== "string" || transcript.trim().length < 3) {
        return res.status(400).json({ message: "Transcript is required" });
      }

      const { createOpenAI } = await import("./openai-shared");
      const openai = createOpenAI();

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a medical data extraction assistant. Extract structured medical history from a voice transcript. Return a JSON object with these fields (use empty string "" if not mentioned):
- allergies: string
- knownConditions: string
- chronicDiseases: string
- pastIllnesses: string
- currentMedications: string
- familyHistory: string
- previousSurgeries: string
- lifestyleHabits: string
- bloodGroup: string (must be one of: "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", or "")
- weight: string (number in kg only, no units)
- height: string (number in cm only, no units)
- pregnancyStatus: string (must be one of: "not_applicable", "not_pregnant", "pregnant", "postpartum", or "")

Return ONLY valid JSON, no markdown.`
          },
          {
            role: "user",
            content: `Extract medical history fields from this voice transcript:\n\n"${transcript}"`
          }
        ],
        temperature: 0.2,
        max_tokens: 1000,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return res.status(422).json({ message: "AI returned invalid format. Please try again." });
      }
      const validBloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""];
      const validPregnancy = ["not_applicable", "not_pregnant", "pregnant", "postpartum", ""];
      const safe = {
        allergies: typeof parsed.allergies === "string" ? parsed.allergies : "",
        knownConditions: typeof parsed.knownConditions === "string" ? parsed.knownConditions : "",
        chronicDiseases: typeof parsed.chronicDiseases === "string" ? parsed.chronicDiseases : "",
        pastIllnesses: typeof parsed.pastIllnesses === "string" ? parsed.pastIllnesses : "",
        currentMedications: typeof parsed.currentMedications === "string" ? parsed.currentMedications : "",
        familyHistory: typeof parsed.familyHistory === "string" ? parsed.familyHistory : "",
        previousSurgeries: typeof parsed.previousSurgeries === "string" ? parsed.previousSurgeries : "",
        lifestyleHabits: typeof parsed.lifestyleHabits === "string" ? parsed.lifestyleHabits : "",
        bloodGroup: validBloodGroups.includes(parsed.bloodGroup) ? parsed.bloodGroup : "",
        weight: typeof parsed.weight === "string" ? parsed.weight.replace(/[^0-9.]/g, "") : "",
        height: typeof parsed.height === "string" ? parsed.height.replace(/[^0-9.]/g, "") : "",
        pregnancyStatus: validPregnancy.includes(parsed.pregnancyStatus) ? parsed.pregnancyStatus : "",
      };
      res.json(safe);
    } catch (err: any) {
      console.error("AI parse medical history error:", err);
      res.status(500).json({ message: "Failed to parse medical history from voice" });
    }
  });

  // ══════════════════════════════════════════════
  // MEDICINE REFERENCE API
  // ══════════════════════════════════════════════

  app.get("/api/medicine-reference/search", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (!query || query.length < 2) {
        return res.json([]);
      }
      const localResults = await db.selectDistinct({
        name: medicineReference.name,
        category: medicineReference.category,
        dosageForm: medicineReference.dosageForm,
        strength: medicineReference.strength,
        indication: medicineReference.indication,
      })
        .from(medicineReference)
        .where(ilike(medicineReference.name, `%${query}%`))
        .limit(20);

      if (localResults.length >= 5) {
        return res.json(localResults);
      }

      try {
        const fdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(query)}"&limit=10`;
        const fdaRes = await fetch(fdaUrl, { signal: AbortSignal.timeout(3000) });
        if (fdaRes.ok) {
          const fdaData = await fdaRes.json();
          const localNames = new Set(localResults.map(r => r.name.toLowerCase()));
          const fdaMeds = (fdaData.results || [])
            .filter((r: any) => r.openfda?.brand_name?.length)
            .flatMap((r: any) => {
              const names: string[] = r.openfda.brand_name || [];
              const strength = r.openfda?.strength?.join(", ") || null;
              const dosageForm = r.openfda?.dosage_form?.join(", ") || null;
              const route = r.openfda?.route?.join(", ") || null;
              const indication = r.indications_and_usage?.[0]?.substring(0, 120) || null;
              return names.map(name => ({
                name,
                category: route,
                dosageForm,
                strength,
                indication,
              }));
            })
            .filter((m: any) => !localNames.has(m.name.toLowerCase()));

          const seen = new Set<string>();
          const uniqueFda = fdaMeds.filter((m: any) => {
            const key = m.name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          return res.json([...localResults, ...uniqueFda].slice(0, 20));
        }
      } catch (fdaErr) {
      }

      res.json(localResults);
    } catch (err: any) {
      console.error("Medicine reference search error:", err);
      res.status(500).json({ message: "Failed to search medicines" });
    }
  });

  app.get("/api/medicine-reference/names", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const results = await db.selectDistinct({ name: medicineReference.name }).from(medicineReference);
      res.json(results.map(r => r.name).sort());
    } catch (err: any) {
      console.error("Medicine reference names error:", err);
      res.status(500).json({ message: "Failed to fetch medicine names" });
    }
  });

  // ══════════════════════════════════════════════
  // MEDICAL NEWS FEED API
  // ══════════════════════════════════════════════

  app.get("/api/news", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const doctorId = req.user.id;
      const category = req.query.category as string || "all";
      const articles = await storage.getMedicalNews(doctorId, category, 50);
      res.json(articles);
    } catch (err: any) {
      console.error("News fetch error:", err);
      res.status(500).json({ message: "Failed to fetch news" });
    }
  });

  app.post("/api/news/generate", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const validCategories = ["latest_research", "health_tips", "drug_updates", "clinical_guidelines", "technology"];
      const doctorId = req.user.id;
      const user = await storage.getUser(doctorId);
      const specialization = user?.specialization || "General Medicine";
      const category = validCategories.includes(req.body.category) ? req.body.category : "latest_research";

      const categoryPrompts: Record<string, string> = {
        latest_research: "latest medical research breakthroughs and clinical studies",
        health_tips: "practical health tips and wellness advice for patients",
        drug_updates: "new drug approvals, medication updates, and pharmacological advances",
        clinical_guidelines: "updated clinical guidelines and best practices",
        technology: "medical technology innovations and digital health trends",
      };

      const topicFocus = categoryPrompts[category] || categoryPrompts.latest_research;

      const openai = new (await import("openai")).default({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a medical content curator specializing in ${specialization}. Generate 5 unique, informative medical news articles about ${topicFocus} that would be relevant and useful for a doctor specializing in ${specialization}. Each article should be factual, evidence-based, and professionally written.

Return a JSON object with an "articles" key containing an array of exactly 5 articles. Each article must have:
- "title": A compelling, professional headline (50-80 chars)
- "summary": A concise 1-2 sentence summary (100-150 chars)
- "content": A detailed 3-4 paragraph article (300-500 words) with key findings, implications for clinical practice, and actionable takeaways
- "source": A realistic journal or source name (e.g., "The Lancet", "NEJM", "BMJ", "JAMA", "Nature Medicine")
- "category": "${category}"
- "imageKeyword": A single descriptive keyword for the article topic (e.g., "cardiology", "neuroscience", "surgery")
- "tags": An array of 3-4 relevant medical tags

Output ONLY the JSON object: { "articles": [...] }`
          },
          {
            role: "user",
            content: `Generate 5 ${topicFocus} articles relevant to ${specialization} practice. Today's date is ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        return res.status(500).json({ message: "Failed to parse AI response" });
      }

      const articles = Array.isArray(parsed) ? parsed : parsed.articles || [];
      const saved = [];
      for (const article of articles) {
        const created = await storage.createMedicalNewsArticle({
          doctorId,
          category: article.category || category,
          title: article.title,
          summary: article.summary,
          content: article.content,
          source: article.source || null,
          imageKeyword: article.imageKeyword || null,
          tags: article.tags || [],
          publishedAt: new Date(),
        });
        saved.push(created);
      }

      res.json(saved);
    } catch (err: any) {
      console.error("News generate error:", err);
      res.status(500).json({ message: "Failed to generate news articles" });
    }
  });

  // ══════════════════════════════════════════════
  // VOICE SAMPLES ROUTES
  // ══════════════════════════════════════════════

  app.get("/api/voice-samples", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const samples = await storage.getVoiceSamples(user.id);
      const safeSamples = samples.map(({ audioBase64, ...rest }) => ({
        ...rest,
        hasAudio: !!audioBase64,
      }));
      res.json(safeSamples);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch voice samples" });
    }
  });

  const voiceSampleCreateSchema = z.object({
    questionId: z.string().min(1),
    questionText: z.string().min(1),
    audioBase64: z.string().min(1),
    durationSeconds: z.number().nullable().optional(),
  });

  app.post("/api/voice-samples", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const parsed = voiceSampleCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });
      }
      const { questionId, questionText, audioBase64, durationSeconds } = parsed.data;

      const existing = await storage.getVoiceSamplesByQuestion(user.id, questionId);
      if (existing.length > 0) {
        await storage.deleteVoiceSample(existing[0].id);
      }

      const sample = await storage.createVoiceSample({
        doctorId: user.id,
        questionId,
        questionText,
        audioBase64,
        durationSeconds: durationSeconds || null,
      });

      const { audioBase64: _, ...safeSample } = sample;
      res.status(201).json({ ...safeSample, hasAudio: true });
    } catch (err) {
      console.error("Voice sample create error:", err);
      res.status(500).json({ message: "Failed to save voice sample" });
    }
  });

  app.delete("/api/voice-samples/:id", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const sample = await storage.getVoiceSample(req.params.id as string);
      if (!sample) return res.status(404).json({ message: "Voice sample not found" });
      if (sample.doctorId !== user.id) return res.status(403).json({ message: "Not authorized" });
      await storage.deleteVoiceSample(req.params.id as string);
      res.json({ message: "Voice sample deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete voice sample" });
    }
  });

  app.get("/api/voice-samples/status", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const samples = await storage.getVoiceSamples(user.id);
      const recorded = samples.map(s => s.questionId);
      res.json({ totalQuestions: 5, recordedQuestions: recorded.length, questionIds: recorded });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch voice status" });
    }
  });

  // ══════════════════════════════════════════════
  // DIARIZATION ROUTES
  // ══════════════════════════════════════════════

  app.post("/api/visits/:id/diarize", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const visitId = req.params.id as string;
      const visit = await storage.getVisit(visitId);
      if (!visit) return res.status(404).json({ message: "Visit not found" });
      if (visit.doctorId !== user.id) return res.status(403).json({ message: "Not authorized" });
      if (!visit.transcriptText) return res.status(400).json({ message: "No transcript available for diarization" });

      const diarizedText = await diarizeTranscript(visit.transcriptText, user.name, visit.language || "English");

      const existing = await storage.getDiarizedTranscript(visitId);
      let transcript;
      if (existing) {
        transcript = await storage.updateDiarizedTranscript(existing.id, {
          rawTranscript: visit.transcriptText,
          diarizedTranscript: diarizedText,
        });
      } else {
        transcript = await storage.createDiarizedTranscript({
          visitId,
          doctorId: user.id,
          rawTranscript: visit.transcriptText,
          diarizedTranscript: diarizedText,
        });
      }

      res.json(transcript);
    } catch (err: any) {
      console.error("Diarization error:", err);
      res.status(500).json({ message: "Failed to diarize transcript" });
    }
  });

  app.get("/api/visits/:id/diarized-transcript", authMiddleware, requireApproved, async (req, res) => {
    try {
      const user = req.user!;
      const visitId = req.params.id as string;
      const visit = await storage.getVisit(visitId);
      if (!visit) return res.status(404).json({ message: "Visit not found" });
      if (visit.doctorId !== user.id) return res.status(403).json({ message: "Not authorized" });
      const transcript = await storage.getDiarizedTranscript(visitId);
      if (!transcript) return res.status(404).json({ message: "No diarized transcript found" });
      res.json(transcript);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch diarized transcript" });
    }
  });

  // ══════════════════════════════════════════════
  // PATIENT HISTORY ROUTES
  // ══════════════════════════════════════════════

  app.put("/api/patients/:id/history", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Patient not found" });

      const historySchema = z.object({
        pastIllnesses: z.string().nullable().optional(),
        chronicDiseases: z.string().nullable().optional(),
        currentMedications: z.string().nullable().optional(),
        familyHistory: z.string().nullable().optional(),
        lifestyleHabits: z.string().nullable().optional(),
        previousSurgeries: z.string().nullable().optional(),
        pregnancyStatus: z.string().nullable().optional(),
        bloodGroup: z.string().nullable().optional(),
        weight: z.string().nullable().optional(),
        height: z.string().nullable().optional(),
        allergies: z.string().nullable().optional(),
        knownConditions: z.string().nullable().optional(),
      });

      const parsed = historySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid history data", errors: parsed.error.flatten() });
      }

      const updated = await storage.updatePatientHistory(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Patient not found" });

      await storage.createAuditLog(req.user.id, "UPDATE_PATIENT_HISTORY", "patient", req.params.id, `Updated medical history for patient: ${patient.name}`);

      res.json(updated);
    } catch (err: any) {
      console.error("Update patient history error:", err);
      res.status(500).json({ message: "Failed to update patient history" });
    }
  });

  app.get("/api/patients/:id/history", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const history = await storage.getPatientHistory(req.params.id);
      if (!history) return res.status(404).json({ message: "Patient not found" });
      res.json(history);
    } catch (err: any) {
      console.error("Get patient history error:", err);
      res.status(500).json({ message: "Failed to fetch patient history" });
    }
  });

  app.get("/api/patients/:id/details-english", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      if (patient.doctorId !== req.user.id) return res.status(403).json({ message: "Access denied" });

      const historyFields: Record<string, string> = {
        knownConditions: patient.knownConditions || "",
        allergies: patient.allergies || "",
        pastIllnesses: patient.pastIllnesses || "",
        chronicDiseases: patient.chronicDiseases || "",
        currentMedications: patient.currentMedications || "",
        familyHistory: patient.familyHistory || "",
        lifestyleHabits: patient.lifestyleHabits || "",
        previousSurgeries: patient.previousSurgeries || "",
        pregnancyStatus: patient.pregnancyStatus || "",
        name: patient.name || "",
        gender: patient.gender || "",
        bloodGroup: patient.bloodGroup || "",
      };

      let translatedHistory = historyFields;
      try {
        translatedHistory = await translatePatientHistoryToEnglish(historyFields);
      } catch (err: any) {
        console.error("[translate] Failed to translate patient history:", err.message);
      }

      const toAsciiDigits = (s: string) => s.replace(/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0E50-\u0E59\u0ED0-\u0ED9]/g, (c) => String(c.charCodeAt(0) % 10 < 10 ? c.charCodeAt(0) % 10 : 0));

      const result: Record<string, any> = {
        id: patient.id,
        name: translatedHistory.name || patient.name,
        age: patient.age,
        gender: translatedHistory.gender || patient.gender,
        phone: patient.phone,
        whatsappNumber: patient.whatsappNumber,
        bloodGroup: translatedHistory.bloodGroup || patient.bloodGroup || "",
        weight: patient.weight || "",
        height: patient.height || "",
        knownConditions: translatedHistory.knownConditions || "",
        allergies: translatedHistory.allergies || "",
        pastIllnesses: translatedHistory.pastIllnesses || "",
        chronicDiseases: translatedHistory.chronicDiseases || "",
        currentMedications: translatedHistory.currentMedications || "",
        familyHistory: translatedHistory.familyHistory || "",
        lifestyleHabits: translatedHistory.lifestyleHabits || "",
        previousSurgeries: translatedHistory.previousSurgeries || "",
        pregnancyStatus: translatedHistory.pregnancyStatus || "",
      };

      for (const key of Object.keys(result)) {
        if (typeof result[key] === "string") {
          result[key] = toAsciiDigits(result[key]);
        }
      }

      res.json(result);
    } catch (err: any) {
      console.error("Get patient details english error:", err);
      res.status(500).json({ message: "Failed to fetch patient details" });
    }
  });

  app.get("/api/patients/:id/first-visit-check", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Patient not found" });

      const patientVisits = await storage.getVisitsByPatient(req.params.id);
      const completedVisits = patientVisits.filter(v => v.status === "active" || v.approved);
      const isFirstVisit = completedVisits.length === 0;

      const hasHistory = !!(
        patient.pastIllnesses || patient.chronicDiseases || patient.currentMedications ||
        patient.familyHistory || patient.lifestyleHabits || patient.previousSurgeries ||
        patient.bloodGroup || patient.weight || patient.height
      );

      res.json({ isFirstVisit, hasHistory, patientId: patient.id, patientName: patient.name });
    } catch (err: any) {
      console.error("First visit check error:", err);
      res.status(500).json({ message: "Failed to check first visit status" });
    }
  });

  // ══════════════════════════════════════════════
  // MEDICINE ALTERNATIVES ROUTES
  // ══════════════════════════════════════════════

  app.post("/api/medicines/:id/alternatives", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const medicine = await storage.getMedicine(req.params.id);
      if (!medicine) return res.status(404).json({ message: "Medicine not found" });

      const result = await generateMedicineAlternatives(
        medicine.name,
        medicine.dose || undefined,
        medicine.saltComposition || undefined
      );

      const savedAlternatives = [];
      for (const alt of result.alternatives) {
        const saved = await storage.createMedicineAlternative({
          medicineId: medicine.id,
          visitId: medicine.visitId,
          alternativeName: alt.name,
          saltComposition: alt.saltComposition || null,
          genericName: alt.genericName || null,
          manufacturer: alt.manufacturer || null,
          priceEstimate: alt.priceEstimate || null,
          type: alt.type || null,
          selected: false,
        });
        savedAlternatives.push(saved);
      }

      res.json({ medicine: medicine.name, alternatives: savedAlternatives });
    } catch (err: any) {
      console.error("Generate alternatives error:", err);
      res.status(500).json({ message: "Failed to generate medicine alternatives" });
    }
  });

  app.get("/api/visits/:id/alternatives", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const visit = await storage.getVisit(req.params.id);
      if (!visit) return res.status(404).json({ message: "Visit not found" });

      const alternatives = await storage.getAlternativesByVisit(req.params.id);
      res.json(alternatives);
    } catch (err: any) {
      console.error("Get alternatives error:", err);
      res.status(500).json({ message: "Failed to fetch alternatives" });
    }
  });

  app.post("/api/medicines/:id/swap-alternative", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const { alternativeId } = req.body;
      if (!alternativeId) return res.status(400).json({ message: "alternativeId is required" });

      const medicine = await storage.getMedicine(req.params.id);
      if (!medicine) return res.status(404).json({ message: "Medicine not found" });

      const selected = await storage.selectAlternative(alternativeId, req.params.id);
      if (!selected) return res.status(404).json({ message: "Alternative not found" });

      await storage.updateMedicine(req.params.id, {
        selectedAlternativeId: alternativeId,
      });

      await storage.createAuditLog(
        req.user.id,
        "SWAP_MEDICINE_ALTERNATIVE",
        "medicine",
        req.params.id,
        `Swapped medicine "${medicine.name}" with alternative "${selected.alternativeName}" (ID: ${alternativeId})`
      );

      broadcastInvalidate(`/api/visits/${medicine.visitId}`);
      res.json({ medicine, selectedAlternative: selected });
    } catch (err: any) {
      console.error("Swap alternative error:", err);
      res.status(500).json({ message: "Failed to swap medicine alternative" });
    }
  });

  // ══════════════════════════════════════════════
  // TEST / LAB REPORT ROUTES
  // ══════════════════════════════════════════════

  app.post("/api/tests/:id/report", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const test = await storage.getTestReport(req.params.id);
      if (!test) return res.status(404).json({ message: "Test not found" });

      const reportSchema = z.object({
        reportBase64: z.string().optional(),
        labName: z.string().optional(),
        status: z.enum(["recommended", "booked", "completed"]).optional(),
      });

      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid report data", errors: parsed.error.flatten() });
      }

      const updateData: any = {};
      if (parsed.data.reportBase64) updateData.reportBase64 = parsed.data.reportBase64;
      if (parsed.data.labName) updateData.labName = parsed.data.labName;
      if (parsed.data.status) updateData.status = parsed.data.status;

      const updated = await storage.updateTestWithReport(req.params.id, updateData);
      res.json(updated);
    } catch (err: any) {
      console.error("Upload report error:", err);
      res.status(500).json({ message: "Failed to upload report" });
    }
  });

  app.get("/api/tests/:id/report", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const test = await storage.getTestReport(req.params.id);
      if (!test) return res.status(404).json({ message: "Test not found" });
      res.json(test);
    } catch (err: any) {
      console.error("Get report error:", err);
      res.status(500).json({ message: "Failed to fetch test report" });
    }
  });

  app.post("/api/tests/:id/extract-values", authMiddleware, requireApproved, async (req: any, res) => {
    try {
      const test = await storage.getTestReport(req.params.id);
      if (!test) return res.status(404).json({ message: "Test not found" });
      if (!test.reportBase64) return res.status(400).json({ message: "No report uploaded for this test" });

      const openaiInstance = new (await import("openai")).default({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const mediaType = test.reportBase64.startsWith("/9j") ? "image/jpeg" : "image/png";
      const dataUrl = test.reportBase64.startsWith("data:")
        ? test.reportBase64
        : `data:${mediaType};base64,${test.reportBase64}`;

      const response = await openaiInstance.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a medical lab report analyzer. Extract key values from the lab report image.

For each value found, provide:
- parameter: Name of the test parameter
- value: The measured value with units
- referenceRange: Normal reference range
- status: "normal", "high", or "low"

Also identify any abnormal markers.

Respond ONLY with valid JSON in this format:
{
  "testName": "Name of the test",
  "reportValues": [
    { "parameter": "Hemoglobin", "value": "12.5 g/dL", "referenceRange": "12-16 g/dL", "status": "normal" }
  ],
  "abnormalMarkers": [
    { "parameter": "WBC Count", "value": "15000 /μL", "referenceRange": "4000-11000 /μL", "status": "high", "significance": "May indicate infection" }
  ],
  "summary": "Brief summary of findings"
}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract all values from this lab report for test: ${test.name}` },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ message: "AI did not return extracted values" });
      }

      const extracted = JSON.parse(content);

      const updated = await storage.updateTestWithReport(req.params.id, {
        reportValues: extracted.reportValues || [],
        abnormalMarkers: extracted.abnormalMarkers || [],
        status: "completed",
      });

      res.json({ test: updated, extracted });
    } catch (err: any) {
      console.error("Extract values error:", err);
      res.status(500).json({ message: "Failed to extract report values" });
    }
  });

  // ─── Patient Queue (QR Check-in) ─────────────────────────────────

  // Public: Get doctor info for QR page (name, clinic, specialization)
  app.get("/api/qr/doctor/:doctorId", async (req, res) => {
    try {
      const doctor = await storage.getUser(req.params.doctorId);
      if (!doctor || doctor.role !== "doctor" || doctor.status !== "approved") {
        return res.status(404).json({ message: "Doctor not found" });
      }
      res.json({
        id: doctor.id,
        name: doctor.name,
        clinicName: doctor.clinicName,
        specialization: doctor.specialization,
        profilePhoto: doctor.profilePhoto,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to load doctor info" });
    }
  });

  app.post("/api/qr/voice-extract", async (req, res) => {
    try {
      const { audio, language } = req.body;
      if (!audio || typeof audio !== "string") {
        return res.status(400).json({ message: "Audio data required" });
      }
      const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
      if (audio.length > MAX_AUDIO_SIZE) {
        return res.status(400).json({ message: "Audio file too large. Please record a shorter clip." });
      }
      const result = await extractPatientFromVoice(audio, language || "English");
      res.json({ transcript: result.transcript, data: result.data });
    } catch (err: any) {
      console.error("[QR Voice Extract] Error:", err?.message || err, err?.stack);
      res.status(500).json({
        message: "Voice extraction failed",
        detail: typeof err?.message === "string" ? err.message : String(err),
      });
    }
  });

  // Public: Add patient to queue (from QR scan)
  app.post("/api/qr/queue", async (req, res) => {
    try {
      const { doctorId, name, mobile, age, gender, patientId,
        bloodGroup, weight, height, knownConditions, allergies, pastIllnesses,
        chronicDiseases, currentMedications, familyHistory, lifestyleHabits,
        previousSurgeries, pregnancyStatus } = req.body;
      if (!doctorId || !name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Doctor ID and patient name are required" });
      }
      const doctor = await storage.getUser(doctorId);
      if (!doctor || doctor.role !== "doctor" || doctor.status !== "approved") {
        return res.status(404).json({ message: "Doctor not found" });
      }

      const parsedAge = age ? parseInt(age, 10) : 0;
      const safeAge = isNaN(parsedAge) || parsedAge < 0 || parsedAge > 150 ? 0 : parsedAge;

      let linkedPatientId = patientId;

      if (linkedPatientId) {
        const existingPatient = await storage.getPatient(linkedPatientId);
        if (!existingPatient || existingPatient.doctorId !== doctorId) {
          return res.status(400).json({ message: "Invalid patient selection" });
        }
      } else {
        const patient = await storage.createPatient({
          name: name.trim(),
          age: safeAge,
          gender: gender || "",
          phone: mobile || "",
          whatsappNumber: mobile || "",
          doctorId,
          bloodGroup: bloodGroup || null,
          weight: weight || null,
          height: height || null,
          knownConditions: knownConditions || null,
          allergies: allergies || null,
          pastIllnesses: pastIllnesses || null,
          chronicDiseases: chronicDiseases || null,
          currentMedications: currentMedications || null,
          familyHistory: familyHistory || null,
          lifestyleHabits: lifestyleHabits || null,
          previousSurgeries: previousSurgeries || null,
          pregnancyStatus: pregnancyStatus || null,
        });
        linkedPatientId = patient.id;
      }

      let englishName = name.trim();
      let englishGender = gender || "";
      const nonAsciiTexts: string[] = [];
      if (/[^\x00-\x7F]/.test(englishName)) nonAsciiTexts.push(englishName);
      if (/[^\x00-\x7F]/.test(englishGender)) nonAsciiTexts.push(englishGender);
      if (nonAsciiTexts.length > 0) {
        try {
          const transliterated = await transliterateNamesToEnglish(nonAsciiTexts);
          let idx = 0;
          if (/[^\x00-\x7F]/.test(englishName)) englishName = transliterated[idx++] || englishName;
          if (/[^\x00-\x7F]/.test(englishGender)) englishGender = transliterated[idx] || englishGender;
        } catch {}
      }

      const entry = await storage.addToPatientQueue({
        doctorId,
        patientId: linkedPatientId,
        name: englishName,
        mobile: mobile || "",
        age: safeAge || null,
        gender: englishGender || null,
        status: "waiting",
      });

      res.json({ message: "Added to queue", entry, patientId: linkedPatientId });
    } catch (err: any) {
      console.error("Queue add error:", err);
      res.status(500).json({ message: "Failed to add to queue" });
    }
  });

  // Public: Search patients for a specific doctor (QR existing patient flow)
  app.get("/api/qr/patients/:doctorId", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string" || q.length < 2) {
        return res.json([]);
      }
      const results = await storage.searchPatientsByDoctor(req.params.doctorId, q);
      res.json(results.map(p => ({
        id: p.id, name: p.name, age: p.age, gender: p.gender, phone: p.phone,
        whatsappNumber: p.whatsappNumber,
        knownConditions: p.knownConditions, allergies: p.allergies, pastIllnesses: p.pastIllnesses,
        chronicDiseases: p.chronicDiseases, currentMedications: p.currentMedications,
        familyHistory: p.familyHistory, lifestyleHabits: p.lifestyleHabits,
        previousSurgeries: p.previousSurgeries, pregnancyStatus: p.pregnancyStatus,
        bloodGroup: p.bloodGroup, weight: p.weight, height: p.height,
      })));
    } catch (err) {
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Public: Update patient medical history from QR flow (scoped to recently queued patients)
  app.put("/api/qr/patients/:id/history", async (req, res) => {
    try {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      const allowedFields = ["knownConditions", "allergies", "pastIllnesses", "chronicDiseases",
        "currentMedications", "familyHistory", "lifestyleHabits", "previousSurgeries",
        "pregnancyStatus", "bloodGroup", "weight", "height"];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined && typeof req.body[key] === "string") {
          sanitized[key] = req.body[key].trim();
        }
      }
      const updated = await storage.updatePatientHistory(req.params.id, sanitized);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update history" });
    }
  });

  const translitCache = new Map<string, string>();

  app.get("/api/patient-queue", authMiddleware, async (req: any, res) => {
    try {
      const queue = await storage.getPatientQueue(req.user.id);
      const toTranslate: string[] = [];

      for (const entry of queue as any[]) {
        for (const field of ["name", "gender"]) {
          const v = entry[field] || "";
          if (/[^\x00-\x7F]/.test(v) && !translitCache.has(v)) {
            toTranslate.push(v);
          }
        }
      }

      if (toTranslate.length > 0) {
        try {
          const unique = [...new Set(toTranslate)];
          const results = await transliterateNamesToEnglish(unique);
          for (let i = 0; i < unique.length; i++) {
            translitCache.set(unique[i], results[i] || unique[i]);
          }
        } catch {}
      }

      const genderMap: Record<string, string> = {
        "purush": "Male", "purus": "Male", "mahila": "Female", "stree": "Female", "aurat": "Female",
        "ladka": "Male", "ladki": "Female", "male": "Male", "female": "Female",
        "पुरुष": "Male", "महिला": "Female", "स्त्री": "Female", "औरत": "Female",
      };

      for (const entry of queue as any[]) {
        for (const field of ["name", "gender"]) {
          const v = entry[field] || "";
          if (translitCache.has(v)) {
            entry[field] = translitCache.get(v);
          }
        }
        if (entry.gender) {
          const gLower = entry.gender.toLowerCase().trim();
          if (genderMap[gLower]) {
            entry.gender = genderMap[gLower];
          }
        }
      }

      res.json(queue);
    } catch (err) {
      res.status(500).json({ message: "Failed to load queue" });
    }
  });

  // Authenticated: Update queue entry status
  app.patch("/api/patient-queue/:id/status", authMiddleware, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!["waiting", "in_progress", "completed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const entry = await storage.getPatientQueueEntry(req.params.id);
      if (!entry) return res.status(404).json({ message: "Queue entry not found" });
      if (entry.doctorId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updatePatientQueueStatus(req.params.id, status);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  return httpServer;
}
