import { eq, desc, and, gte, lte, ilike, or, sql, count } from "drizzle-orm";
import { db } from "./db";
import {
  users, sessions, patients, visits, medicines, tests, followups, careEvents, adherenceLogs, shareTokens, adminAuditLogs, whatsappMessageLogs, passwordResetTokens, medicalNews, voiceSamples, diarizedTranscripts, prescriptionRiskChecks, medicineAlternatives,
  subscriptionPlans, planFeatures, regionalPricing, doctorSubscriptions, aiUsageLogs, invoices, invoiceLineItems, coupons, patientQueue,
  type User, type InsertUser, type Session,
  type Patient, type InsertPatient,
  type Visit, type InsertVisit,
  type Medicine, type InsertMedicine,
  type Test, type InsertTest,
  type Followup, type InsertFollowup,
  type CareEvent, type InsertCareEvent,
  type AdherenceLog, type InsertAdherenceLog,
  type ShareToken, type AdminAuditLog,
  type WhatsappMessageLog, type InsertWhatsappMessageLog,
  type PasswordResetToken, type MedicalNews,
  type VoiceSample, type InsertVoiceSample,
  type DiarizedTranscript, type InsertDiarizedTranscript,
  type PrescriptionRiskCheck, type InsertPrescriptionRiskCheck,
  type MedicineAlternative, type InsertMedicineAlternative,
  type SubscriptionPlan, type InsertSubscriptionPlan,
  type PlanFeature, type InsertPlanFeature,
  type RegionalPricing as RegionalPricingType, type InsertRegionalPricing,
  type DoctorSubscription, type InsertDoctorSubscription,
  type AiUsageLog, type InsertAiUsageLog,
  type Invoice, type InsertInvoice,
  type InvoiceLineItem, type InsertInvoiceLineItem,
  type Coupon, type InsertCoupon,
  type PatientQueue, type InsertPatientQueue,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllDoctors(): Promise<User[]>;
  getPendingDoctors(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Sessions
  createSession(userId: string, token: string, expiresAt: Date): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;
  deleteSessionsByUser(userId: string): Promise<void>;
  
  // Patients
  getPatients(doctorId?: string): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | undefined>;
  getPatientByPhone(phone: string, doctorId?: string): Promise<Patient | undefined>;
  getPatientByName(name: string, doctorId?: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: string, data: Partial<Patient>): Promise<Patient | undefined>;
  
  // Visits
  getVisits(doctorId?: string): Promise<Visit[]>;
  getVisit(id: string): Promise<Visit | undefined>;
  getVisitsByPatient(patientId: string): Promise<Visit[]>;
  getVisitsByDoctor(doctorId: string): Promise<Visit[]>;
  createVisit(visit: InsertVisit): Promise<Visit>;
  updateVisit(id: string, data: Partial<Visit>): Promise<Visit | undefined>;
  
  // Medicines
  getMedicinesByVisit(visitId: string): Promise<Medicine[]>;
  createMedicine(medicine: InsertMedicine): Promise<Medicine>;
  updateMedicine(id: string, data: Partial<Medicine>): Promise<Medicine | undefined>;
  deleteMedicine(id: string): Promise<boolean>;
  
  // Tests
  getTestsByVisit(visitId: string): Promise<Test[]>;
  createTest(test: InsertTest): Promise<Test>;
  updateTest(id: string, data: Partial<Test>): Promise<Test | undefined>;
  deleteTest(id: string): Promise<boolean>;
  
  // Followups
  getFollowupsByVisit(visitId: string): Promise<Followup[]>;
  createFollowup(followup: InsertFollowup): Promise<Followup>;
  updateFollowup(id: string, data: Partial<Followup>): Promise<Followup | undefined>;
  deleteFollowup(id: string): Promise<boolean>;
  
  // Care Events
  getCareEventsByVisit(visitId: string): Promise<CareEvent[]>;
  getAllCareEvents(): Promise<CareEvent[]>;
  createCareEvent(event: InsertCareEvent): Promise<CareEvent>;
  updateCareEvent(id: string, data: Partial<CareEvent>): Promise<CareEvent | undefined>;

  // Adherence Logs
  getAdherenceLogsByPatient(patientId: string): Promise<AdherenceLog[]>;
  getAdherenceLogsByVisit(visitId: string): Promise<AdherenceLog[]>;
  createAdherenceLog(log: InsertAdherenceLog): Promise<AdherenceLog>;
  updateAdherenceLog(id: string, data: Partial<AdherenceLog>): Promise<AdherenceLog | undefined>;

  // Search
  searchVisitsWithPatients(filters: {
    patientName?: string;
    status?: string;
    language?: string;
    dateFrom?: string;
    dateTo?: string;
  }, doctorId?: string): Promise<Array<Visit & { patient: Patient | null }>>;

  // Admin stats
  getDoctorStats(doctorId: string): Promise<{ patientCount: number; visitCount: number; todayVisits: number }>;
  getAdminStats(): Promise<{ totalDoctors: number; pendingDoctors: number; totalPatients: number; totalVisits: number; todayVisits: number }>;

  // Share tokens
  createShareToken(visitId: string, token: string, expiresAt: Date): Promise<ShareToken>;
  getShareToken(token: string): Promise<ShareToken | undefined>;
  getActiveShareToken(visitId: string): Promise<ShareToken | undefined>;

  // Admin Audit Logs
  createAuditLog(adminId: string, action: string, targetType: string, targetId?: string, details?: string): Promise<AdminAuditLog>;
  getAuditLogs(limit?: number): Promise<AdminAuditLog[]>;

  // Admin doctor data drill-down
  getPatientsByDoctor(doctorId: string): Promise<Patient[]>;
  getVisitWithCarePlan(visitId: string): Promise<{ visit: Visit; patient?: Patient; medicines: Medicine[]; tests: Test[]; followups: Followup[] } | undefined>;

  // WhatsApp Message Logs
  createWhatsappMessageLog(log: InsertWhatsappMessageLog): Promise<WhatsappMessageLog>;
  getWhatsappMessageLog(id: string): Promise<WhatsappMessageLog | undefined>;
  getWhatsappMessageLogByCareEvent(careEventId: string): Promise<WhatsappMessageLog | undefined>;
  updateWhatsappMessageLog(id: string, data: Partial<WhatsappMessageLog>): Promise<WhatsappMessageLog | undefined>;
  getPendingCareEventsForWhatsapp(): Promise<CareEvent[]>;
  getRetryableWhatsappMessages(): Promise<WhatsappMessageLog[]>;
  getCareEvent(id: string): Promise<CareEvent | undefined>;
  getMedicine(id: string): Promise<Medicine | undefined>;

  // Password Reset Tokens
  getUserByPhone(phone: string): Promise<User | undefined>;
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  invalidateUserResetTokens(userId: string): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;

  // Medical News
  getMedicalNews(doctorId?: string, category?: string, limit?: number): Promise<MedicalNews[]>;
  createMedicalNewsArticle(article: Omit<MedicalNews, "id" | "createdAt">): Promise<MedicalNews>;
  getMedicalNewsCount(doctorId?: string): Promise<number>;

  // Voice Samples
  getVoiceSamples(doctorId: string): Promise<VoiceSample[]>;
  getVoiceSample(id: string): Promise<VoiceSample | undefined>;
  createVoiceSample(sample: InsertVoiceSample): Promise<VoiceSample>;
  deleteVoiceSample(id: string): Promise<void>;
  getVoiceSamplesByQuestion(doctorId: string, questionId: string): Promise<VoiceSample[]>;

  // Diarized Transcripts
  getDiarizedTranscript(visitId: string): Promise<DiarizedTranscript | undefined>;
  createDiarizedTranscript(transcript: InsertDiarizedTranscript): Promise<DiarizedTranscript>;
  updateDiarizedTranscript(id: string, data: Partial<DiarizedTranscript>): Promise<DiarizedTranscript | undefined>;

  // Patient History
  updatePatientHistory(id: string, history: Partial<Patient>): Promise<Patient | undefined>;
  getPatientHistory(id: string): Promise<Pick<Patient, "id" | "pastIllnesses" | "chronicDiseases" | "currentMedications" | "familyHistory" | "lifestyleHabits" | "previousSurgeries" | "pregnancyStatus" | "bloodGroup" | "weight" | "height" | "allergies" | "knownConditions"> | undefined>;

  // Medicine Alternatives
  createMedicineAlternative(alt: InsertMedicineAlternative): Promise<MedicineAlternative>;
  getAlternativesByMedicine(medicineId: string): Promise<MedicineAlternative[]>;
  getAlternativesByVisit(visitId: string): Promise<MedicineAlternative[]>;
  selectAlternative(alternativeId: string, medicineId: string): Promise<MedicineAlternative | undefined>;

  // Prescription Risk Checks
  createRiskCheck(check: InsertPrescriptionRiskCheck): Promise<PrescriptionRiskCheck>;
  getRiskCheckByVisit(visitId: string): Promise<PrescriptionRiskCheck | undefined>;
  confirmRiskOverride(id: string, reason: string): Promise<PrescriptionRiskCheck | undefined>;

  // WhatsApp Stats
  getWhatsappStats(dateFrom: Date, dateTo: Date): Promise<{ totalSent: number; totalDelivered: number; totalFailed: number; totalResponded: number }>;

  // Test Reports
  updateTestWithReport(id: string, data: { reportBase64?: string; reportValues?: any; abnormalMarkers?: any; status?: string; labName?: string }): Promise<Test | undefined>;
  getTestReport(id: string): Promise<Test | undefined>;

  // Subscription Plans
  getSubscriptionPlans(status?: string): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  deleteSubscriptionPlan(id: string): Promise<boolean>;

  // Plan Features
  getPlanFeatures(planId: string): Promise<PlanFeature[]>;
  createPlanFeature(feature: InsertPlanFeature): Promise<PlanFeature>;
  updatePlanFeature(id: string, data: Partial<PlanFeature>): Promise<PlanFeature | undefined>;
  deletePlanFeature(id: string): Promise<boolean>;
  deletePlanFeaturesByPlan(planId: string): Promise<number>;

  // Regional Pricing
  getRegionalPricingList(): Promise<RegionalPricingType[]>;
  getRegionalPricing(id: string): Promise<RegionalPricingType | undefined>;
  createRegionalPricing(pricing: InsertRegionalPricing): Promise<RegionalPricingType>;
  updateRegionalPricing(id: string, data: Partial<RegionalPricingType>): Promise<RegionalPricingType | undefined>;
  deleteRegionalPricing(id: string): Promise<boolean>;

  // Doctor Subscriptions
  getDoctorSubscription(id: string): Promise<DoctorSubscription | undefined>;
  getDoctorSubscriptionByDoctor(doctorId: string): Promise<DoctorSubscription | undefined>;
  getAllDoctorSubscriptions(): Promise<DoctorSubscription[]>;
  createDoctorSubscription(sub: InsertDoctorSubscription): Promise<DoctorSubscription>;
  updateDoctorSubscription(id: string, data: Partial<DoctorSubscription>): Promise<DoctorSubscription | undefined>;

  // AI Usage Logs
  createAiUsageLog(log: InsertAiUsageLog): Promise<AiUsageLog>;
  getAiUsageByDoctor(doctorId: string, from?: Date, to?: Date): Promise<AiUsageLog[]>;
  getAiUsageSummary(doctorId: string, from: Date, to: Date): Promise<{ totalMinutes: number; count: number }>;
  getAllDoctorsUsageSummary(from: Date, to: Date): Promise<Array<{ doctorId: string; totalMinutes: number; count: number }>>;

  // Invoices
  createInvoice(inv: InsertInvoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoices(filters?: { doctorId?: string; status?: string }): Promise<Invoice[]>;
  updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice | undefined>;
  createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  getNextInvoiceNumber(): Promise<string>;

  // Coupons
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  getCoupon(id: string): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  getCoupons(): Promise<Coupon[]>;
  updateCoupon(id: string, data: Partial<Coupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<boolean>;
  incrementCouponUses(id: string): Promise<void>;

  getPatientQueue(doctorId: string): Promise<PatientQueue[]>;
  addToPatientQueue(entry: InsertPatientQueue): Promise<PatientQueue>;
  updatePatientQueueStatus(id: string, status: string): Promise<PatientQueue | undefined>;
  getPatientQueueEntry(id: string): Promise<PatientQueue | undefined>;
  searchPatientsByDoctor(doctorId: string, query: string): Promise<Patient[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllDoctors(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "doctor")).orderBy(desc(users.createdAt));
  }

  async getPendingDoctors(): Promise<User[]> {
    return db.select().from(users).where(and(eq(users.role, "doctor"), eq(users.status, "pending"))).orderBy(desc(users.createdAt));
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  // Sessions
  async createSession(userId: string, token: string, expiresAt: Date): Promise<Session> {
    const [session] = await db.insert(sessions).values({ userId, token, expiresAt }).returning();
    return session;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    return session;
  }

  async deleteSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  async deleteSessionsByUser(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  // Patients
  async getPatients(doctorId?: string): Promise<Patient[]> {
    if (doctorId) {
      return db.select().from(patients).where(eq(patients.doctorId, doctorId)).orderBy(desc(patients.createdAt));
    }
    return db.select().from(patients).orderBy(desc(patients.createdAt));
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient;
  }

  async getPatientByPhone(phone: string, doctorId?: string): Promise<Patient | undefined> {
    if (doctorId) {
      const [patient] = await db.select().from(patients).where(and(eq(patients.phone, phone), eq(patients.doctorId, doctorId)));
      return patient;
    }
    const [patient] = await db.select().from(patients).where(eq(patients.phone, phone));
    return patient;
  }

  async getPatientByName(name: string, doctorId?: string): Promise<Patient | undefined> {
    if (doctorId) {
      const [patient] = await db.select().from(patients).where(and(eq(patients.name, name), eq(patients.doctorId, doctorId)));
      return patient;
    }
    const [patient] = await db.select().from(patients).where(eq(patients.name, name));
    return patient;
  }

  async updatePatient(id: string, data: Partial<Patient>): Promise<Patient | undefined> {
    const [updated] = await db.update(patients).set(data).where(eq(patients.id, id)).returning();
    return updated;
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
    const [created] = await db.insert(patients).values(patient).returning();
    return created;
  }

  // Visits
  private get visitsLightColumns() {
    return {
      id: visits.id,
      patientId: visits.patientId,
      doctorId: visits.doctorId,
      visitDate: visits.visitDate,
      language: visits.language,
      audioPath: visits.audioPath,
      approved: visits.approved,
      approvedAt: visits.approvedAt,
      status: visits.status,
    };
  }

  async getVisits(doctorId?: string): Promise<Visit[]> {
    if (doctorId) {
      return db.select().from(visits).where(eq(visits.doctorId, doctorId)).orderBy(desc(visits.visitDate));
    }
    return db.select().from(visits).orderBy(desc(visits.visitDate));
  }

  async getVisitsLight(doctorId?: string) {
    const cols = this.visitsLightColumns;
    if (doctorId) {
      return db.select(cols).from(visits).where(eq(visits.doctorId, doctorId)).orderBy(desc(visits.visitDate));
    }
    return db.select(cols).from(visits).orderBy(desc(visits.visitDate));
  }

  async getVisitsLightWithPatients(doctorId?: string) {
    const condition = doctorId ? eq(visits.doctorId, doctorId) : undefined;
    const rows = await db
      .select({
        id: visits.id,
        patientId: visits.patientId,
        doctorId: visits.doctorId,
        visitDate: visits.visitDate,
        language: visits.language,
        audioPath: visits.audioPath,
        approved: visits.approved,
        approvedAt: visits.approvedAt,
        status: visits.status,
        patientName: patients.name,
        patientAge: patients.age,
        patientGender: patients.gender,
        patientPhone: patients.phone,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.patientId, patients.id))
      .where(condition)
      .orderBy(desc(visits.visitDate));

    return rows.map(r => ({
      id: r.id,
      patientId: r.patientId,
      doctorId: r.doctorId,
      visitDate: r.visitDate,
      language: r.language,
      audioPath: r.audioPath,
      approved: r.approved,
      approvedAt: r.approvedAt,
      status: r.status,
      patient: r.patientName ? { id: r.patientId, name: r.patientName, age: r.patientAge, gender: r.patientGender, phone: r.patientPhone } : null,
    }));
  }

  async getVisit(id: string): Promise<Visit | undefined> {
    const [visit] = await db.select().from(visits).where(eq(visits.id, id));
    return visit;
  }

  async getVisitsByPatient(patientId: string): Promise<Visit[]> {
    return db.select().from(visits).where(eq(visits.patientId, patientId)).orderBy(desc(visits.visitDate));
  }

  async getVisitsByDoctor(doctorId: string): Promise<Visit[]> {
    return db.select().from(visits).where(eq(visits.doctorId, doctorId)).orderBy(desc(visits.visitDate));
  }

  async createVisit(visit: InsertVisit): Promise<Visit> {
    const [created] = await db.insert(visits).values(visit).returning();
    return created;
  }

  async updateVisit(id: string, data: Partial<Visit>): Promise<Visit | undefined> {
    const [updated] = await db.update(visits).set(data).where(eq(visits.id, id)).returning();
    return updated;
  }

  // Medicines
  async getMedicinesByVisit(visitId: string): Promise<Medicine[]> {
    return db.select().from(medicines).where(eq(medicines.visitId, visitId));
  }

  async createMedicine(medicine: InsertMedicine): Promise<Medicine> {
    const [created] = await db.insert(medicines).values(medicine).returning();
    return created;
  }

  async updateMedicine(id: string, data: Partial<Medicine>): Promise<Medicine | undefined> {
    const [updated] = await db.update(medicines).set(data).where(eq(medicines.id, id)).returning();
    return updated;
  }

  async deleteMedicine(id: string): Promise<boolean> {
    const result = await db.delete(medicines).where(eq(medicines.id, id)).returning();
    return result.length > 0;
  }

  // Tests
  async getTestsByVisit(visitId: string): Promise<Test[]> {
    return db.select().from(tests).where(eq(tests.visitId, visitId));
  }

  async createTest(test: InsertTest): Promise<Test> {
    const [created] = await db.insert(tests).values(test).returning();
    return created;
  }

  async updateTest(id: string, data: Partial<Test>): Promise<Test | undefined> {
    const [updated] = await db.update(tests).set(data).where(eq(tests.id, id)).returning();
    return updated;
  }

  async deleteTest(id: string): Promise<boolean> {
    const result = await db.delete(tests).where(eq(tests.id, id)).returning();
    return result.length > 0;
  }

  // Followups
  async getFollowupsByVisit(visitId: string): Promise<Followup[]> {
    return db.select().from(followups).where(eq(followups.visitId, visitId));
  }

  async createFollowup(followup: InsertFollowup): Promise<Followup> {
    const [created] = await db.insert(followups).values(followup).returning();
    return created;
  }

  async updateFollowup(id: string, data: Partial<Followup>): Promise<Followup | undefined> {
    const [updated] = await db.update(followups).set(data).where(eq(followups.id, id)).returning();
    return updated;
  }

  async deleteFollowup(id: string): Promise<boolean> {
    const result = await db.delete(followups).where(eq(followups.id, id)).returning();
    return result.length > 0;
  }

  // Care Events
  async getCareEventsByVisit(visitId: string): Promise<CareEvent[]> {
    return db.select().from(careEvents).where(eq(careEvents.visitId, visitId));
  }

  async getAllCareEvents(): Promise<CareEvent[]> {
    return db.select().from(careEvents).orderBy(desc(careEvents.scheduledTime));
  }

  async createCareEvent(event: InsertCareEvent): Promise<CareEvent> {
    const [created] = await db.insert(careEvents).values(event).returning();
    return created;
  }

  async updateCareEvent(id: string, data: Partial<CareEvent>): Promise<CareEvent | undefined> {
    const [updated] = await db.update(careEvents).set(data).where(eq(careEvents.id, id)).returning();
    return updated;
  }

  // Adherence Logs
  async getAdherenceLogsByPatient(patientId: string): Promise<AdherenceLog[]> {
    return db.select().from(adherenceLogs).where(eq(adherenceLogs.patientId, patientId)).orderBy(desc(adherenceLogs.loggedAt));
  }

  async getAdherenceLogsByVisit(visitId: string): Promise<AdherenceLog[]> {
    return db.select().from(adherenceLogs).where(eq(adherenceLogs.visitId, visitId)).orderBy(desc(adherenceLogs.loggedAt));
  }

  async createAdherenceLog(log: InsertAdherenceLog): Promise<AdherenceLog> {
    const [created] = await db.insert(adherenceLogs).values(log).returning();
    return created;
  }

  async updateAdherenceLog(id: string, data: Partial<AdherenceLog>): Promise<AdherenceLog | undefined> {
    const [updated] = await db.update(adherenceLogs).set(data).where(eq(adherenceLogs.id, id)).returning();
    return updated;
  }

  // Search
  async searchVisitsWithPatients(filters: {
    patientName?: string;
    status?: string;
    language?: string;
    dateFrom?: string;
    dateTo?: string;
  }, doctorId?: string): Promise<Array<Visit & { patient: Patient | null }>> {
    const conditions = [];

    if (doctorId) {
      conditions.push(eq(visits.doctorId, doctorId));
    }
    if (filters.status) {
      conditions.push(eq(visits.status, filters.status));
    }
    if (filters.language) {
      conditions.push(eq(visits.language, filters.language));
    }
    if (filters.dateFrom) {
      conditions.push(gte(visits.visitDate, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(visits.visitDate, endDate));
    }
    if (filters.patientName) {
      conditions.push(ilike(patients.name, `%${filters.patientName}%`));
    }

    const rows = await db
      .select({
        id: visits.id,
        patientId: visits.patientId,
        doctorId: visits.doctorId,
        visitDate: visits.visitDate,
        language: visits.language,
        status: visits.status,
        approved: visits.approved,
        patientName: patients.name,
        patientAge: patients.age,
        patientGender: patients.gender,
        patientPhone: patients.phone,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.patientId, patients.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(visits.visitDate))
      .limit(100);

    return rows.map(r => ({
      id: r.id,
      patientId: r.patientId,
      doctorId: r.doctorId,
      visitDate: r.visitDate,
      language: r.language,
      status: r.status,
      approved: r.approved,
      patient: r.patientName ? { id: r.patientId, name: r.patientName, age: r.patientAge, gender: r.patientGender, phone: r.patientPhone } : null,
    })) as any;
  }

  // Admin stats
  async getDoctorStats(doctorId: string): Promise<{ patientCount: number; visitCount: number; todayVisits: number }> {
    const doctorVisits = await db.select().from(visits).where(eq(visits.doctorId, doctorId));
    const doctorPatients = await db.select().from(patients).where(eq(patients.doctorId, doctorId));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayVisits = doctorVisits.filter(v => {
      const vDate = new Date(v.visitDate!);
      vDate.setHours(0, 0, 0, 0);
      return vDate.getTime() === today.getTime();
    }).length;

    return {
      patientCount: doctorPatients.length,
      visitCount: doctorVisits.length,
      todayVisits,
    };
  }

  async getAdminStats(): Promise<{ totalDoctors: number; pendingDoctors: number; totalPatients: number; totalVisits: number; todayVisits: number }> {
    const allDoctors = await db.select().from(users).where(eq(users.role, "doctor"));
    const pendingDoctors = allDoctors.filter(d => d.status === "pending");
    const allPatients = await db.select().from(patients);
    const allVisits = await db.select().from(visits);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayVisits = allVisits.filter(v => {
      const vDate = new Date(v.visitDate!);
      vDate.setHours(0, 0, 0, 0);
      return vDate.getTime() === today.getTime();
    }).length;

    return {
      totalDoctors: allDoctors.length,
      pendingDoctors: pendingDoctors.length,
      totalPatients: allPatients.length,
      totalVisits: allVisits.length,
      todayVisits,
    };
  }

  async createShareToken(visitId: string, token: string, expiresAt: Date): Promise<ShareToken> {
    const [created] = await db.insert(shareTokens).values({ visitId, token, expiresAt }).returning();
    return created;
  }

  async getShareToken(token: string): Promise<ShareToken | undefined> {
    const [found] = await db.select().from(shareTokens).where(eq(shareTokens.token, token));
    return found;
  }

  async getActiveShareToken(visitId: string): Promise<ShareToken | undefined> {
    const [found] = await db.select().from(shareTokens)
      .where(and(eq(shareTokens.visitId, visitId), gte(shareTokens.expiresAt, new Date())))
      .orderBy(desc(shareTokens.createdAt));
    return found;
  }

  async createAuditLog(adminId: string, action: string, targetType: string, targetId?: string, details?: string): Promise<AdminAuditLog> {
    const [created] = await db.insert(adminAuditLogs).values({ adminId, action, targetType, targetId, details }).returning();
    return created;
  }

  async getAuditLogs(limit: number = 100): Promise<AdminAuditLog[]> {
    return db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit);
  }

  async getPatientsByDoctor(doctorId: string): Promise<Patient[]> {
    return db.select().from(patients).where(eq(patients.doctorId, doctorId)).orderBy(desc(patients.createdAt));
  }

  async getVisitWithCarePlan(visitId: string): Promise<{ visit: Visit; patient?: Patient; medicines: Medicine[]; tests: Test[]; followups: Followup[] } | undefined> {
    const [visit] = await db.select().from(visits).where(eq(visits.id, visitId));
    if (!visit) return undefined;
    const patient = visit.patientId ? await this.getPatient(visit.patientId) : undefined;
    const meds = await this.getMedicinesByVisit(visitId);
    const testsList = await this.getTestsByVisit(visitId);
    const fups = await this.getFollowupsByVisit(visitId);
    return { visit, patient, medicines: meds, tests: testsList, followups: fups };
  }

  // WhatsApp Message Logs
  async createWhatsappMessageLog(log: InsertWhatsappMessageLog): Promise<WhatsappMessageLog> {
    const [created] = await db.insert(whatsappMessageLogs).values(log).returning();
    return created;
  }

  async getWhatsappMessageLog(id: string): Promise<WhatsappMessageLog | undefined> {
    const [found] = await db.select().from(whatsappMessageLogs).where(eq(whatsappMessageLogs.id, id));
    return found;
  }

  async getWhatsappMessageLogByCareEvent(careEventId: string): Promise<WhatsappMessageLog | undefined> {
    const [found] = await db.select().from(whatsappMessageLogs)
      .where(eq(whatsappMessageLogs.careEventId, careEventId))
      .orderBy(desc(whatsappMessageLogs.createdAt));
    return found;
  }

  async updateWhatsappMessageLog(id: string, data: Partial<WhatsappMessageLog>): Promise<WhatsappMessageLog | undefined> {
    const [updated] = await db.update(whatsappMessageLogs).set(data).where(eq(whatsappMessageLogs.id, id)).returning();
    return updated;
  }

  async getPendingCareEventsForWhatsapp(): Promise<CareEvent[]> {
    return db.select().from(careEvents)
      .where(and(
        eq(careEvents.eventType, "medicine"),
        eq(careEvents.status, "pending"),
        lte(careEvents.scheduledTime, new Date())
      ))
      .orderBy(careEvents.scheduledTime);
  }

  async getRetryableWhatsappMessages(): Promise<WhatsappMessageLog[]> {
    return db.select().from(whatsappMessageLogs)
      .where(and(
        eq(whatsappMessageLogs.status, "failed"),
        sql`${whatsappMessageLogs.retryCount} < 3`,
        sql`${whatsappMessageLogs.errorMessage} IS NULL OR ${whatsappMessageLogs.errorMessage} NOT LIKE '%permanent:%'`
      ));
  }

  async getCareEvent(id: string): Promise<CareEvent | undefined> {
    const [found] = await db.select().from(careEvents).where(eq(careEvents.id, id));
    return found;
  }

  async getMedicine(id: string): Promise<Medicine | undefined> {
    const [found] = await db.select().from(medicines).where(eq(medicines.id, id));
    return found;
  }

  // Password Reset Tokens
  async getUserByPhone(phone: string): Promise<User | undefined> {
    const cleaned = phone.replace(/[^0-9]/g, "");
    const allResults = await db.select().from(users);
    return allResults.find(u => u.phone && u.phone.replace(/[^0-9]/g, "").endsWith(cleaned));
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [created] = await db.insert(passwordResetTokens).values({ userId, token, expiresAt }).returning();
    return created;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [found] = await db.select().from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.token, token), eq(passwordResetTokens.used, false)));
    return found;
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, id));
  }

  async invalidateUserResetTokens(userId: string): Promise<void> {
    await db.update(passwordResetTokens).set({ used: true })
      .where(and(eq(passwordResetTokens.userId, userId), eq(passwordResetTokens.used, false)));
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  }

  async getMedicalNews(doctorId?: string, category?: string, limit_?: number): Promise<MedicalNews[]> {
    const conditions = [];
    if (doctorId) conditions.push(eq(medicalNews.doctorId, doctorId));
    if (category && category !== "all") conditions.push(eq(medicalNews.category, category));
    const query = conditions.length > 0
      ? db.select().from(medicalNews).where(and(...conditions)).orderBy(desc(medicalNews.publishedAt))
      : db.select().from(medicalNews).orderBy(desc(medicalNews.publishedAt));
    if (limit_) return query.limit(limit_);
    return query;
  }

  async createMedicalNewsArticle(article: Omit<MedicalNews, "id" | "createdAt">): Promise<MedicalNews> {
    const [created] = await db.insert(medicalNews).values(article).returning();
    return created;
  }

  async getMedicalNewsCount(doctorId?: string): Promise<number> {
    const conditions = doctorId ? [eq(medicalNews.doctorId, doctorId)] : [];
    const [result] = conditions.length > 0
      ? await db.select({ count: count() }).from(medicalNews).where(and(...conditions))
      : await db.select({ count: count() }).from(medicalNews);
    return result?.count || 0;
  }

  async getVoiceSamples(doctorId: string): Promise<VoiceSample[]> {
    return db.select().from(voiceSamples).where(eq(voiceSamples.doctorId, doctorId)).orderBy(desc(voiceSamples.createdAt));
  }

  async getVoiceSample(id: string): Promise<VoiceSample | undefined> {
    const [sample] = await db.select().from(voiceSamples).where(eq(voiceSamples.id, id));
    return sample;
  }

  async createVoiceSample(sample: InsertVoiceSample): Promise<VoiceSample> {
    const [created] = await db.insert(voiceSamples).values(sample).returning();
    return created;
  }

  async deleteVoiceSample(id: string): Promise<void> {
    await db.delete(voiceSamples).where(eq(voiceSamples.id, id));
  }

  async getVoiceSamplesByQuestion(doctorId: string, questionId: string): Promise<VoiceSample[]> {
    return db.select().from(voiceSamples).where(and(eq(voiceSamples.doctorId, doctorId), eq(voiceSamples.questionId, questionId)));
  }

  async getDiarizedTranscript(visitId: string): Promise<DiarizedTranscript | undefined> {
    const [transcript] = await db.select().from(diarizedTranscripts).where(eq(diarizedTranscripts.visitId, visitId));
    return transcript;
  }

  async createDiarizedTranscript(transcript: InsertDiarizedTranscript): Promise<DiarizedTranscript> {
    const [created] = await db.insert(diarizedTranscripts).values(transcript).returning();
    return created;
  }

  async updateDiarizedTranscript(id: string, data: Partial<DiarizedTranscript>): Promise<DiarizedTranscript | undefined> {
    const [updated] = await db.update(diarizedTranscripts).set(data).where(eq(diarizedTranscripts.id, id)).returning();
    return updated;
  }

  // Patient History
  async updatePatientHistory(id: string, history: Partial<Patient>): Promise<Patient | undefined> {
    const historyFields: Partial<Patient> = {};
    const allowedKeys: (keyof Patient)[] = [
      "pastIllnesses", "chronicDiseases", "currentMedications", "familyHistory",
      "lifestyleHabits", "previousSurgeries", "pregnancyStatus", "bloodGroup",
      "weight", "height", "allergies", "knownConditions",
    ];
    for (const key of allowedKeys) {
      if (key in history) {
        (historyFields as any)[key] = (history as any)[key];
      }
    }
    const [updated] = await db.update(patients).set(historyFields).where(eq(patients.id, id)).returning();
    return updated;
  }

  async getPatientHistory(id: string): Promise<Pick<Patient, "id" | "pastIllnesses" | "chronicDiseases" | "currentMedications" | "familyHistory" | "lifestyleHabits" | "previousSurgeries" | "pregnancyStatus" | "bloodGroup" | "weight" | "height" | "allergies" | "knownConditions"> | undefined> {
    const [patient] = await db.select({
      id: patients.id,
      pastIllnesses: patients.pastIllnesses,
      chronicDiseases: patients.chronicDiseases,
      currentMedications: patients.currentMedications,
      familyHistory: patients.familyHistory,
      lifestyleHabits: patients.lifestyleHabits,
      previousSurgeries: patients.previousSurgeries,
      pregnancyStatus: patients.pregnancyStatus,
      bloodGroup: patients.bloodGroup,
      weight: patients.weight,
      height: patients.height,
      allergies: patients.allergies,
      knownConditions: patients.knownConditions,
    }).from(patients).where(eq(patients.id, id));
    return patient;
  }

  // Medicine Alternatives
  async createMedicineAlternative(alt: InsertMedicineAlternative): Promise<MedicineAlternative> {
    const [created] = await db.insert(medicineAlternatives).values(alt).returning();
    return created;
  }

  async getAlternativesByMedicine(medicineId: string): Promise<MedicineAlternative[]> {
    return db.select().from(medicineAlternatives).where(eq(medicineAlternatives.medicineId, medicineId));
  }

  async getAlternativesByVisit(visitId: string): Promise<MedicineAlternative[]> {
    return db.select().from(medicineAlternatives).where(eq(medicineAlternatives.visitId, visitId));
  }

  async selectAlternative(alternativeId: string, medicineId: string): Promise<MedicineAlternative | undefined> {
    await db.update(medicineAlternatives)
      .set({ selected: false })
      .where(eq(medicineAlternatives.medicineId, medicineId));
    const [selected] = await db.update(medicineAlternatives)
      .set({ selected: true })
      .where(eq(medicineAlternatives.id, alternativeId))
      .returning();
    if (selected) {
      await db.update(medicines)
        .set({ selectedAlternativeId: alternativeId })
        .where(eq(medicines.id, medicineId));
    }
    return selected;
  }

  // Prescription Risk Checks
  async createRiskCheck(check: InsertPrescriptionRiskCheck): Promise<PrescriptionRiskCheck> {
    const [created] = await db.insert(prescriptionRiskChecks).values(check).returning();
    return created;
  }

  async getRiskCheckByVisit(visitId: string): Promise<PrescriptionRiskCheck | undefined> {
    const [found] = await db.select().from(prescriptionRiskChecks)
      .where(eq(prescriptionRiskChecks.visitId, visitId))
      .orderBy(desc(prescriptionRiskChecks.createdAt));
    return found;
  }

  async confirmRiskOverride(id: string, reason: string): Promise<PrescriptionRiskCheck | undefined> {
    const [updated] = await db.update(prescriptionRiskChecks)
      .set({ overrideConfirmed: true, overrideReason: reason })
      .where(eq(prescriptionRiskChecks.id, id))
      .returning();
    return updated;
  }

  // WhatsApp Stats
  async getWhatsappStats(dateFrom: Date, dateTo: Date): Promise<{ totalSent: number; totalDelivered: number; totalFailed: number; totalResponded: number }> {
    const rows = await db.select({
      status: whatsappMessageLogs.status,
      cnt: count(),
    })
      .from(whatsappMessageLogs)
      .where(and(
        gte(whatsappMessageLogs.createdAt, dateFrom),
        lte(whatsappMessageLogs.createdAt, dateTo)
      ))
      .groupBy(whatsappMessageLogs.status);

    let totalSent = 0, totalDelivered = 0, totalFailed = 0, totalResponded = 0;
    for (const row of rows) {
      const c = Number(row.cnt);
      if (row.status === "sent") totalSent += c;
      if (row.status === "delivered") totalDelivered += c;
      if (row.status === "failed") totalFailed += c;
      if (row.status === "responded") totalResponded += c;
    }
    return { totalSent, totalDelivered, totalFailed, totalResponded };
  }

  // Test Reports
  async updateTestWithReport(id: string, data: { reportBase64?: string; reportValues?: any; abnormalMarkers?: any; status?: string; labName?: string }): Promise<Test | undefined> {
    const [updated] = await db.update(tests).set(data).where(eq(tests.id, id)).returning();
    return updated;
  }

  async getTestReport(id: string): Promise<Test | undefined> {
    const [test] = await db.select().from(tests).where(eq(tests.id, id));
    return test;
  }

  // Plan Features
  async getPlanFeatures(planId: string): Promise<PlanFeature[]> {
    return db.select().from(planFeatures).where(eq(planFeatures.planId, planId)).orderBy(planFeatures.sortOrder);
  }

  async createPlanFeature(feature: InsertPlanFeature): Promise<PlanFeature> {
    const [created] = await db.insert(planFeatures).values(feature).returning();
    return created;
  }

  async updatePlanFeature(id: string, data: Partial<PlanFeature>): Promise<PlanFeature | undefined> {
    const [updated] = await db.update(planFeatures).set(data).where(eq(planFeatures.id, id)).returning();
    return updated;
  }

  async deletePlanFeature(id: string): Promise<boolean> {
    const result = await db.delete(planFeatures).where(eq(planFeatures.id, id)).returning();
    return result.length > 0;
  }

  async deletePlanFeaturesByPlan(planId: string): Promise<number> {
    const result = await db.delete(planFeatures).where(eq(planFeatures.planId, planId)).returning();
    return result.length;
  }

  // Subscription Plans
  async getSubscriptionPlans(status?: string): Promise<SubscriptionPlan[]> {
    if (status) {
      return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.status, status)).orderBy(subscriptionPlans.sortOrder);
    }
    return db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [created] = await db.insert(subscriptionPlans).values(plan).returning();
    return created;
  }

  async updateSubscriptionPlan(id: string, data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db.update(subscriptionPlans).set({ ...data, updatedAt: new Date() }).where(eq(subscriptionPlans.id, id)).returning();
    return updated;
  }

  async deleteSubscriptionPlan(id: string): Promise<boolean> {
    const result = await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id)).returning();
    return result.length > 0;
  }

  // Regional Pricing
  async getRegionalPricingList(): Promise<RegionalPricingType[]> {
    return db.select().from(regionalPricing).orderBy(regionalPricing.regionName);
  }

  async getRegionalPricing(id: string): Promise<RegionalPricingType | undefined> {
    const [pricing] = await db.select().from(regionalPricing).where(eq(regionalPricing.id, id));
    return pricing;
  }

  async createRegionalPricing(pricing: InsertRegionalPricing): Promise<RegionalPricingType> {
    const [created] = await db.insert(regionalPricing).values(pricing).returning();
    return created;
  }

  async updateRegionalPricing(id: string, data: Partial<RegionalPricingType>): Promise<RegionalPricingType | undefined> {
    const [updated] = await db.update(regionalPricing).set(data).where(eq(regionalPricing.id, id)).returning();
    return updated;
  }

  async deleteRegionalPricing(id: string): Promise<boolean> {
    const result = await db.delete(regionalPricing).where(eq(regionalPricing.id, id)).returning();
    return result.length > 0;
  }

  // Doctor Subscriptions
  async getDoctorSubscription(id: string): Promise<DoctorSubscription | undefined> {
    const [sub] = await db.select().from(doctorSubscriptions).where(eq(doctorSubscriptions.id, id));
    return sub;
  }

  async getDoctorSubscriptionByDoctor(doctorId: string): Promise<DoctorSubscription | undefined> {
    const [sub] = await db.select().from(doctorSubscriptions)
      .where(eq(doctorSubscriptions.doctorId, doctorId))
      .orderBy(desc(doctorSubscriptions.createdAt))
      .limit(1);
    return sub;
  }

  async getAllDoctorSubscriptions(): Promise<DoctorSubscription[]> {
    return db.select().from(doctorSubscriptions).orderBy(desc(doctorSubscriptions.createdAt));
  }

  async createDoctorSubscription(sub: InsertDoctorSubscription): Promise<DoctorSubscription> {
    const [created] = await db.insert(doctorSubscriptions).values(sub).returning();
    return created;
  }

  async updateDoctorSubscription(id: string, data: Partial<DoctorSubscription>): Promise<DoctorSubscription | undefined> {
    const [updated] = await db.update(doctorSubscriptions).set({ ...data, updatedAt: new Date() }).where(eq(doctorSubscriptions.id, id)).returning();
    return updated;
  }

  // AI Usage Logs
  async createAiUsageLog(log: InsertAiUsageLog): Promise<AiUsageLog> {
    const [created] = await db.insert(aiUsageLogs).values(log).returning();
    return created;
  }

  async getAiUsageByDoctor(doctorId: string, from?: Date, to?: Date): Promise<AiUsageLog[]> {
    const conditions = [eq(aiUsageLogs.doctorId, doctorId)];
    if (from) conditions.push(gte(aiUsageLogs.createdAt, from));
    if (to) conditions.push(lte(aiUsageLogs.createdAt, to));
    return db.select().from(aiUsageLogs).where(and(...conditions)).orderBy(desc(aiUsageLogs.createdAt));
  }

  async getAiUsageSummary(doctorId: string, from: Date, to: Date): Promise<{ totalMinutes: number; count: number }> {
    const [result] = await db.select({
      totalMinutes: sql<number>`COALESCE(SUM(${aiUsageLogs.minutesUsed}), 0)`,
      count: count(),
    }).from(aiUsageLogs).where(and(
      eq(aiUsageLogs.doctorId, doctorId),
      gte(aiUsageLogs.createdAt, from),
      lte(aiUsageLogs.createdAt, to),
    ));
    return { totalMinutes: Number(result?.totalMinutes || 0), count: Number(result?.count || 0) };
  }

  async getAllDoctorsUsageSummary(from: Date, to: Date): Promise<Array<{ doctorId: string; totalMinutes: number; count: number }>> {
    const results = await db.select({
      doctorId: aiUsageLogs.doctorId,
      totalMinutes: sql<number>`COALESCE(SUM(${aiUsageLogs.minutesUsed}), 0)`,
      count: count(),
    }).from(aiUsageLogs).where(and(
      gte(aiUsageLogs.createdAt, from),
      lte(aiUsageLogs.createdAt, to),
    )).groupBy(aiUsageLogs.doctorId);
    return results.map(r => ({ doctorId: r.doctorId, totalMinutes: Number(r.totalMinutes), count: Number(r.count) }));
  }

  // Invoices
  async createInvoice(inv: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(inv).returning();
    return created;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
    return inv;
  }

  async getInvoices(filters?: { doctorId?: string; status?: string }): Promise<Invoice[]> {
    const conditions = [];
    if (filters?.doctorId) conditions.push(eq(invoices.doctorId, filters.doctorId));
    if (filters?.status) conditions.push(eq(invoices.status, filters.status));
    return db.select().from(invoices).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(invoices.createdAt));
  }

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return updated;
  }

  async createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const [created] = await db.insert(invoiceLineItems).values(item).returning();
    return created;
  }

  async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    return db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  }

  async getNextInvoiceNumber(): Promise<string> {
    const [result] = await db.select({ cnt: count() }).from(invoices);
    const num = (Number(result?.cnt) || 0) + 1;
    const prefix = new Date().toISOString().slice(0, 7).replace("-", "");
    return `INV-${prefix}-${String(num).padStart(4, "0")}`;
  }

  // Coupons
  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [created] = await db.insert(coupons).values(coupon).returning();
    return created;
  }

  async getCoupon(id: string): Promise<Coupon | undefined> {
    const [c] = await db.select().from(coupons).where(eq(coupons.id, id));
    return c;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [c] = await db.select().from(coupons).where(eq(coupons.code, code));
    return c;
  }

  async getCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async updateCoupon(id: string, data: Partial<Coupon>): Promise<Coupon | undefined> {
    const [updated] = await db.update(coupons).set(data).where(eq(coupons.id, id)).returning();
    return updated;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    const result = await db.delete(coupons).where(eq(coupons.id, id)).returning();
    return result.length > 0;
  }

  async incrementCouponUses(id: string): Promise<void> {
    await db.update(coupons).set({ currentUses: sql`COALESCE(${coupons.currentUses}, 0) + 1` }).where(eq(coupons.id, id));
  }

  async getPatientQueue(doctorId: string): Promise<PatientQueue[]> {
    return db.select().from(patientQueue)
      .where(and(eq(patientQueue.doctorId, doctorId), or(eq(patientQueue.status, "waiting"), eq(patientQueue.status, "in_progress"))))
      .orderBy(desc(patientQueue.entryTime));
  }

  async addToPatientQueue(entry: InsertPatientQueue): Promise<PatientQueue> {
    const [result] = await db.insert(patientQueue).values(entry).returning();
    return result;
  }

  async updatePatientQueueStatus(id: string, status: string): Promise<PatientQueue | undefined> {
    const [result] = await db.update(patientQueue).set({ status }).where(eq(patientQueue.id, id)).returning();
    return result;
  }

  async getPatientQueueEntry(id: string): Promise<PatientQueue | undefined> {
    const [result] = await db.select().from(patientQueue).where(eq(patientQueue.id, id));
    return result;
  }

  async searchPatientsByDoctor(doctorId: string, query: string): Promise<Patient[]> {
    return db.select().from(patients)
      .where(and(
        eq(patients.doctorId, doctorId),
        or(
          ilike(patients.name, `%${query}%`),
          ilike(patients.phone, `%${query}%`)
        )
      ))
      .orderBy(desc(patients.createdAt))
      .limit(20);
  }
}

export const storage = new DatabaseStorage();
