import { storage } from "./storage";
import { hashPassword } from "./auth";
import type { User } from "@shared/schema";

const CORRECT_PLAN_PRICES: Record<string, { monthlyPrice: number; annualPrice: number }> = {
  "Starter": { monthlyPrice: 1499, annualPrice: 14999 },
  "Professional": { monthlyPrice: 3999, annualPrice: 39999 },
  "Clinic Pro": { monthlyPrice: 8999, annualPrice: 89999 },
};

export async function seedAdminUser() {
  try {
    const existing = await storage.getUserByEmail("admin@carepath.ai");
    if (!existing) {
      const passwordHash = await hashPassword("admin123");
      await storage.createUser({
        name: "Admin",
        email: "admin@carepath.ai",
        phone: null,
        passwordHash,
        role: "admin",
        status: "approved",
        specialization: null,
        licenseNumber: null,
        clinicName: null,
        clinicAddress: null,
        experience: null,
        qualifications: null,
      });
      console.log("Admin user seeded: admin@carepath.ai / admin123");
    } else {
      console.log("Admin user already exists");
    }
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}

/**
 * If SEED_DOCTOR_EMAIL and SEED_DOCTOR_PASSWORD are set (or DOCTOR_EMAIL / DOCTOR_PASSWORD),
 * creates an approved doctor or updates the existing account so you can sign in at /login.
 * Optional: SEED_DOCTOR_NAME, SEED_DOCTOR_PHONE, SEED_DOCTOR_SPECIALIZATION, SEED_DOCTOR_LICENSE,
 * SEED_DOCTOR_CLINIC, SEED_DOCTOR_CLINIC_ADDRESS, SEED_DOCTOR_EXPERIENCE, SEED_DOCTOR_QUALIFICATIONS
 * (same names with DOCTOR_ prefix are also read as fallbacks).
 */
export async function seedDoctorFromEnv() {
  const email = (process.env.SEED_DOCTOR_EMAIL || process.env.DOCTOR_EMAIL)?.trim();
  const password = process.env.SEED_DOCTOR_PASSWORD || process.env.DOCTOR_PASSWORD;
  if (!email || !password) return;

  const pick = (a: string | undefined, b: string | undefined) => (a ?? b)?.trim();
  const name = pick(process.env.SEED_DOCTOR_NAME, process.env.DOCTOR_NAME) || "Doctor";
  const phone = pick(process.env.SEED_DOCTOR_PHONE, process.env.DOCTOR_PHONE) || null;
  const specialization = pick(process.env.SEED_DOCTOR_SPECIALIZATION, process.env.DOCTOR_SPECIALIZATION) || null;
  const licenseNumber = pick(process.env.SEED_DOCTOR_LICENSE, process.env.DOCTOR_LICENSE) || null;
  const clinicName = pick(process.env.SEED_DOCTOR_CLINIC, process.env.DOCTOR_CLINIC) || null;
  const clinicAddress = pick(process.env.SEED_DOCTOR_CLINIC_ADDRESS, process.env.DOCTOR_CLINIC_ADDRESS) || null;
  const qualifications = pick(process.env.SEED_DOCTOR_QUALIFICATIONS, process.env.DOCTOR_QUALIFICATIONS) || null;
  const expRaw = pick(process.env.SEED_DOCTOR_EXPERIENCE, process.env.DOCTOR_EXPERIENCE);
  let experience: number | null = null;
  if (expRaw) {
    const n = parseInt(expRaw, 10);
    experience = Number.isFinite(n) ? n : null;
  }

  try {
    const passwordHash = await hashPassword(password);
    const existing = await storage.getUserByEmail(email);

    if (existing) {
      if (existing.role === "admin") {
        console.warn("Doctor seed skipped: email belongs to an admin account.");
        return;
      }
      const patch: Partial<User> = {
        passwordHash,
        status: "approved",
        name,
        phone,
        specialization,
        licenseNumber,
        clinicName,
        clinicAddress,
        qualifications,
      };
      if (expRaw !== undefined && expRaw !== "") {
        patch.experience = experience;
      }
      await storage.updateUser(existing.id, patch);
      console.log(`Doctor account synced from .env: ${email}`);
      return;
    }

    await storage.createUser({
      name,
      email,
      phone,
      passwordHash,
      role: "doctor",
      status: "approved",
      specialization,
      licenseNumber,
      clinicName,
      clinicAddress,
      experience,
      qualifications,
    });
    console.log(`Doctor user created from .env: ${email}`);
  } catch (error) {
    console.error("Error seeding doctor from env:", error);
  }
}

export async function migratePlanPrices() {
  try {
    const plans = await storage.getSubscriptionPlans();
    for (const plan of plans) {
      const correct = CORRECT_PLAN_PRICES[plan.name];
      if (correct) {
        const currentMonthly = Number(plan.monthlyPrice);
        const currentAnnual = Number(plan.annualPrice);
        if (currentMonthly !== correct.monthlyPrice || currentAnnual !== correct.annualPrice) {
          await storage.updateSubscriptionPlan(plan.id, {
            monthlyPrice: correct.monthlyPrice,
            annualPrice: correct.annualPrice,
          });
          console.log(`[migration] Updated ${plan.name} prices: ₹${currentMonthly} → ₹${correct.monthlyPrice}/mo, ₹${currentAnnual} → ₹${correct.annualPrice}/yr`);
        }
      }
    }
  } catch (error) {
    console.error("Error migrating plan prices:", error);
  }
}
