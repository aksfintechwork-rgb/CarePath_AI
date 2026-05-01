import { storage } from "./storage";
import { hashPassword } from "./auth";

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
