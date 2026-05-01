import { sql } from "drizzle-orm";
import { pgTable, serial, text, varchar, integer, boolean, timestamp, json, date, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("doctor"),
  status: text("status").notNull().default("pending"),
  specialization: text("specialization"),
  licenseNumber: text("license_number"),
  clinicName: text("clinic_name"),
  clinicAddress: text("clinic_address"),
  experience: integer("experience"),
  qualifications: text("qualifications"),
  profilePhoto: text("profile_photo"),
  adminRole: text("admin_role"),
  country: text("country"),
  subscriptionId: varchar("subscription_id"),
  selectedPlanId: varchar("selected_plan_id"),
  faceData: text("face_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// NOTE: users.subscriptionId FK to doctorSubscriptions is not declared inline
// to avoid circular reference issues. It will be enforced at the application level
// until doctor_subscriptions assignment is built in Phase 2.

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender"),
  phone: text("phone"),
  whatsappNumber: text("whatsapp_number"),
  knownConditions: text("known_conditions"),
  allergies: text("allergies"),
  pastIllnesses: text("past_illnesses"),
  chronicDiseases: text("chronic_diseases"),
  currentMedications: text("current_medications"),
  familyHistory: text("family_history"),
  lifestyleHabits: text("lifestyle_habits"),
  previousSurgeries: text("previous_surgeries"),
  pregnancyStatus: text("pregnancy_status"),
  bloodGroup: text("blood_group"),
  weight: text("weight"),
  height: text("height"),
  doctorId: varchar("doctor_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const visits = pgTable("visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  doctorId: varchar("doctor_id").references(() => users.id),
  visitDate: timestamp("visit_date").defaultNow(),
  language: text("language").default("English"),
  audioPath: text("audio_path"),
  audioBase64: text("audio_base64"),
  transcriptText: text("transcript_text"),
  aiDraftJson: json("ai_draft_json"),
  approved: boolean("approved").default(false),
  approvedAt: timestamp("approved_at"),
  status: text("status").notNull().default("draft"),
});

export const medicines = pgTable("medicines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  name: text("name").notNull(),
  dose: text("dose"),
  frequency: text("frequency"),
  timing: text("timing"),
  durationDays: integer("duration_days"),
  instructions: text("instructions"),
  saltComposition: text("salt_composition"),
  genericName: text("generic_name"),
  selectedAlternativeId: varchar("selected_alternative_id"),
});

export const tests = pgTable("tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  name: text("name").notNull(),
  whenToDo: text("when_to_do"),
  urgency: text("urgency"),
  triggerCondition: text("trigger_condition"),
  fastingRequired: boolean("fasting_required").default(false),
  status: text("status").default("recommended"),
  labName: text("lab_name"),
  reportBase64: text("report_base64"),
  reportValues: json("report_values"),
  abnormalMarkers: json("abnormal_markers"),
});

export const followups = pgTable("followups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  followupAfterDays: integer("followup_after_days"),
  followupDate: text("followup_date"),
  warningSigns: text("warning_signs").array(),
  notes: text("notes"),
});

export const careEvents = pgTable("care_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  medicineId: varchar("medicine_id").references(() => medicines.id),
  eventType: text("event_type").notNull(),
  scheduledTime: timestamp("scheduled_time"),
  status: text("status").notNull().default("pending"),
  patientResponse: text("patient_response"),
  whatsappMessageId: text("whatsapp_message_id"),
});

export const adherenceLogs = pgTable("adherence_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  medicineId: varchar("medicine_id").references(() => medicines.id),
  dayNumber: integer("day_number").notNull(),
  status: text("status").notNull().default("pending"),
  loggedAt: timestamp("logged_at").defaultNow(),
  notes: text("notes"),
});

export const shareTokens = pgTable("share_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const whatsappMessageLogs = pgTable("whatsapp_message_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  careEventId: varchar("care_event_id").notNull().references(() => careEvents.id),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  medicineId: varchar("medicine_id").references(() => medicines.id),
  whatsappNumber: text("whatsapp_number").notNull(),
  messagePayload: json("message_payload"),
  whatsappMessageId: text("whatsapp_message_id"),
  status: text("status").notNull().default("pending"),
  retryCount: integer("retry_count").notNull().default(0),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  responseReceivedAt: timestamp("response_received_at"),
  patientResponse: text("patient_response"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const medicalNews = pgTable("medical_news", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id").references(() => users.id),
  category: text("category").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  source: text("source"),
  imageKeyword: text("image_keyword"),
  tags: text("tags").array(),
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const medicineReference = pgTable("medicine_reference", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category"),
  dosageForm: text("dosage_form"),
  strength: text("strength"),
  indication: text("indication"),
  saltComposition: text("salt_composition"),
  genericName: text("generic_name"),
  manufacturer: text("manufacturer"),
  priceRange: text("price_range"),
  type: text("type"),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const voiceSamples = pgTable("voice_samples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  questionId: text("question_id").notNull(),
  questionText: text("question_text").notNull(),
  audioBase64: text("audio_base64").notNull(),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const diarizedTranscripts = pgTable("diarized_transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  rawTranscript: text("raw_transcript"),
  diarizedTranscript: text("diarized_transcript"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const prescriptionRiskChecks = pgTable("prescription_risk_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  riskLevel: text("risk_level").notNull(),
  flaggedMedicines: json("flagged_medicines"),
  interactions: json("interactions"),
  overrideConfirmed: boolean("override_confirmed").default(false),
  overrideReason: text("override_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const medicineAlternatives = pgTable("medicine_alternatives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  medicineId: varchar("medicine_id").notNull().references(() => medicines.id),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  alternativeName: text("alternative_name").notNull(),
  saltComposition: text("salt_composition"),
  genericName: text("generic_name"),
  manufacturer: text("manufacturer"),
  priceEstimate: text("price_estimate"),
  type: text("type"),
  selected: boolean("selected").default(false),
});

// ===== SaaS Subscription Tables =====

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  planType: text("plan_type").notNull().default("global"),
  monthlyPrice: doublePrecision("monthly_price").notNull().default(0),
  annualPrice: doublePrecision("annual_price").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("active"),
  doctorsIncluded: integer("doctors_included").notNull().default(1),
  maxDoctors: integer("max_doctors").notNull().default(1),
  aiMinutesPerMonth: integer("ai_minutes_per_month").notNull().default(300),
  extraMinuteCost: doublePrecision("extra_minute_cost").notNull().default(0.10),
  languagesSupported: integer("languages_supported").notNull().default(5),
  customLanguageSupport: boolean("custom_language_support").default(false),
  aiCarePlanLevel: text("ai_care_plan_level").notNull().default("basic"),
  prescriptionChannels: text("prescription_channels").notNull().default("email"),
  calendarFeatures: text("calendar_features").notNull().default("basic"),
  reportsLevel: text("reports_level").notNull().default("monthly"),
  identityVerification: text("identity_verification").notNull().default("none"),
  adherenceTracking: text("adherence_tracking").notNull().default("disabled"),
  supportLevel: text("support_level").notNull().default("email"),
  targetUser: text("target_user").notNull().default("solo_doctor"),
  isEnterprise: boolean("is_enterprise").default(false),
  whiteLabel: boolean("white_label").default(false),
  customIntegrations: boolean("custom_integrations").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const planFeatures = pgTable("plan_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }),
  featureKey: text("feature_key").notNull(),
  featureName: text("feature_name").notNull(),
  featureCategory: text("feature_category").notNull().default("general"),
  enabled: boolean("enabled").default(true),
  limit: integer("limit"),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
});

export const regionalPricing = pgTable("regional_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  regionName: text("region_name").notNull(),
  regionCode: text("region_code").notNull().unique(),
  multiplier: doublePrecision("multiplier").notNull().default(1.0),
  currency: text("currency").notNull().default("INR"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const doctorSubscriptions = pgTable("doctor_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  status: text("status").notNull().default("trial"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  startDate: timestamp("start_date").defaultNow(),
  nextBillingDate: timestamp("next_billing_date"),
  expiresAt: timestamp("expires_at"),
  cancelledAt: timestamp("cancelled_at"),
  regionCode: text("region_code"),
  appliedMultiplier: doublePrecision("applied_multiplier").default(1.0),
  finalMonthlyPrice: doublePrecision("final_monthly_price"),
  finalAnnualPrice: doublePrecision("final_annual_price"),
  couponId: varchar("coupon_id").references(() => coupons.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  visitId: varchar("visit_id").references(() => visits.id),
  minutesUsed: doublePrecision("minutes_used").notNull().default(0),
  usageType: text("usage_type").notNull().default("transcription"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  subscriptionId: varchar("subscription_id").references(() => doctorSubscriptions.id),
  invoiceNumber: text("invoice_number").notNull(),
  billingPeriodStart: timestamp("billing_period_start"),
  billingPeriodEnd: timestamp("billing_period_end"),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  discount: doublePrecision("discount").default(0),
  tax: doublePrecision("tax").default(0),
  total: doublePrecision("total").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  refundedAt: timestamp("refunded_at"),
  refundReason: text("refund_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity").notNull().default(1),
  unitPrice: doublePrecision("unit_price").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
  itemType: text("item_type").notNull().default("plan"),
});

export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: text("discount_type").notNull().default("percentage"),
  discountValue: doublePrecision("discount_value").notNull().default(0),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").default(0),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  applicablePlanIds: text("applicable_plan_ids").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const upgradeRequests = pgTable("upgrade_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  currentPlanId: varchar("current_plan_id"),
  requestedPlanId: varchar("requested_plan_id").notNull().references(() => subscriptionPlans.id),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertPatientSchema = createInsertSchema(patients).omit({ id: true, createdAt: true });
export const insertVisitSchema = createInsertSchema(visits).omit({ id: true, visitDate: true, approved: true, approvedAt: true });
export const insertMedicineSchema = createInsertSchema(medicines).omit({ id: true });
export const insertTestSchema = createInsertSchema(tests).omit({ id: true });
export const insertFollowupSchema = createInsertSchema(followups).omit({ id: true });
export const insertCareEventSchema = createInsertSchema(careEvents).omit({ id: true });
export const insertAdherenceLogSchema = createInsertSchema(adherenceLogs).omit({ id: true, loggedAt: true }).extend({
  status: z.enum(["taken", "missed", "pending"]),
});

export const insertWhatsappMessageLogSchema = createInsertSchema(whatsappMessageLogs).omit({ id: true, createdAt: true });
export const insertVoiceSampleSchema = createInsertSchema(voiceSamples).omit({ id: true, createdAt: true });
export const insertDiarizedTranscriptSchema = createInsertSchema(diarizedTranscripts).omit({ id: true, createdAt: true });
export const insertPrescriptionRiskCheckSchema = createInsertSchema(prescriptionRiskChecks).omit({ id: true, createdAt: true });
export const insertMedicineAlternativeSchema = createInsertSchema(medicineAlternatives).omit({ id: true });

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlanFeatureSchema = createInsertSchema(planFeatures).omit({ id: true });
export const insertRegionalPricingSchema = createInsertSchema(regionalPricing).omit({ id: true, createdAt: true });
export const insertDoctorSubscriptionSchema = createInsertSchema(doctorSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiUsageLogSchema = createInsertSchema(aiUsageLogs).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({ id: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, currentUses: true });

export const registerDoctorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  licenseNumber: z.string().optional(),
  clinicName: z.string().optional(),
  clinicAddress: z.string().optional(),
  experience: z.number().optional(),
  qualifications: z.string().optional(),
  planId: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type ShareToken = typeof shareTokens.$inferSelect;

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Session = typeof sessions.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Visit = typeof visits.$inferSelect;
export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Medicine = typeof medicines.$inferSelect;
export type InsertMedicine = z.infer<typeof insertMedicineSchema>;
export type Test = typeof tests.$inferSelect;
export type InsertTest = z.infer<typeof insertTestSchema>;
export type Followup = typeof followups.$inferSelect;
export type InsertFollowup = z.infer<typeof insertFollowupSchema>;
export type CareEvent = typeof careEvents.$inferSelect;
export type InsertCareEvent = z.infer<typeof insertCareEventSchema>;
export type AdherenceLog = typeof adherenceLogs.$inferSelect;
export type InsertAdherenceLog = z.infer<typeof insertAdherenceLogSchema>;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type WhatsappMessageLog = typeof whatsappMessageLogs.$inferSelect;
export type InsertWhatsappMessageLog = z.infer<typeof insertWhatsappMessageLogSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type MedicalNews = typeof medicalNews.$inferSelect;
export type MedicineReference = typeof medicineReference.$inferSelect;
export type VoiceSample = typeof voiceSamples.$inferSelect;
export type InsertVoiceSample = z.infer<typeof insertVoiceSampleSchema>;
export type DiarizedTranscript = typeof diarizedTranscripts.$inferSelect;
export type InsertDiarizedTranscript = z.infer<typeof insertDiarizedTranscriptSchema>;
export type PrescriptionRiskCheck = typeof prescriptionRiskChecks.$inferSelect;
export type InsertPrescriptionRiskCheck = z.infer<typeof insertPrescriptionRiskCheckSchema>;
export type MedicineAlternative = typeof medicineAlternatives.$inferSelect;
export type InsertMedicineAlternative = z.infer<typeof insertMedicineAlternativeSchema>;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type PlanFeature = typeof planFeatures.$inferSelect;
export type InsertPlanFeature = z.infer<typeof insertPlanFeatureSchema>;
export type RegionalPricing = typeof regionalPricing.$inferSelect;
export type InsertRegionalPricing = z.infer<typeof insertRegionalPricingSchema>;
export type DoctorSubscription = typeof doctorSubscriptions.$inferSelect;
export type InsertDoctorSubscription = z.infer<typeof insertDoctorSubscriptionSchema>;
export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

export const patientQueue = pgTable("patient_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  name: text("name").notNull(),
  mobile: text("mobile"),
  age: integer("age"),
  gender: text("gender"),
  status: text("status").notNull().default("waiting"),
  entryTime: timestamp("entry_time").defaultNow(),
});

export const insertPatientQueueSchema = createInsertSchema(patientQueue).omit({ id: true, entryTime: true });
export type PatientQueue = typeof patientQueue.$inferSelect;
export type InsertPatientQueue = z.infer<typeof insertPatientQueueSchema>;
