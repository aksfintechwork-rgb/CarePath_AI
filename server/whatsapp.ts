import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

let cachedSystemAdminId: string | null = null;
async function getSystemAdminId(): Promise<string> {
  if (cachedSystemAdminId) return cachedSystemAdminId;
  try {
    const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
    if (admin) cachedSystemAdminId = admin.id;
  } catch (_) {}
  return cachedSystemAdminId || "system";
}

async function createWhatsappAuditLog(action: string, targetId: string, details: string) {
  try {
    const adminId = await getSystemAdminId();
    if (adminId === "system") return;
    await storage.createAuditLog(adminId, action, "care_event", targetId, details);
  } catch (_) {}
}

function log(message: string, source = "whatsapp") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "carepath_verify_token";
const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

export function getWhatsappVerifyToken(): string {
  return WHATSAPP_VERIFY_TOKEN;
}

export function isWhatsappConfigured(): boolean {
  return !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
}

export function parseTimingToHours(timing: string | null | undefined): number[] {
  if (!timing) return [8];
  const t = timing.toLowerCase();

  const hours: number[] = [];

  if (t.includes("morning") || t.includes("subah") || t.includes("sakali")) hours.push(8);
  if (t.includes("afternoon") || t.includes("dopahar") || t.includes("dupari")) hours.push(13);
  if (t.includes("evening") || t.includes("sham") || t.includes("sandhyakal")) hours.push(18);
  if (t.includes("night") || t.includes("raat") || t.includes("ratri")) hours.push(20);
  if (t.includes("before breakfast") || t.includes("empty stomach")) hours.push(7);
  if (t.includes("after food") || t.includes("after meal") || t.includes("after lunch")) {
    if (!hours.includes(8) && !hours.includes(13)) hours.push(13);
  }
  if (t.includes("before bed") || t.includes("bedtime")) hours.push(21);

  if (hours.length === 0) {
    const freqCheck = t;
    if (freqCheck.includes("three times") || freqCheck.includes("thrice") || freqCheck.includes("tid")) {
      return [8, 14, 20];
    }
    if (freqCheck.includes("twice") || freqCheck.includes("two times") || freqCheck.includes("bid")) {
      return [8, 20];
    }
    return [8];
  }

  return [...new Set(hours)].sort((a, b) => a - b);
}

export function parseDurationDays(instructions: string | null | undefined, durationDays: number | null | undefined): number {
  if (durationDays && durationDays > 0) return durationDays;
  if (!instructions) return 1;

  const text = instructions.toLowerCase();
  const daysMatch = text.match(/(\d+)\s*day/);
  if (daysMatch) return parseInt(daysMatch[1]);

  const weeksMatch = text.match(/(\d+)\s*week/);
  if (weeksMatch) return parseInt(weeksMatch[1]) * 7;

  const monthsMatch = text.match(/(\d+)\s*month/);
  if (monthsMatch) return parseInt(monthsMatch[1]) * 30;

  return 1;
}

function validateWhatsappNumber(number: string): { valid: boolean; sanitized: string; error?: string } {
  const sanitized = number.replace(/[^0-9]/g, "");
  if (sanitized.length < 10) {
    return { valid: false, sanitized, error: `permanent: Invalid phone number - too short (${sanitized.length} digits): ${sanitized}` };
  }
  if (sanitized.length > 12) {
    return { valid: false, sanitized, error: `permanent: Invalid phone number - too long (${sanitized.length} digits): ${sanitized}` };
  }
  return { valid: true, sanitized };
}

function isPermanentError(error: string): boolean {
  const permanentPatterns = [
    "invalid phone",
    "recipient not valid",
    "not a valid whatsapp",
    "parameter_invalid",
    "invalid parameter",
    "permanent:",
  ];
  const lower = error.toLowerCase();
  return permanentPatterns.some(p => lower.includes(p));
}

function getRetryBackoffMs(retryCount: number): number {
  const delays = [5 * 60 * 1000, 15 * 60 * 1000, 45 * 60 * 1000];
  return delays[retryCount] || delays[delays.length - 1];
}

export async function sendWhatsappReminder(
  whatsappNumber: string,
  patientName: string,
  medicineName: string,
  careEventId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isWhatsappConfigured()) {
    return { success: false, error: "WhatsApp not configured" };
  }

  const validation = validateWhatsappNumber(whatsappNumber);
  if (!validation.valid) {
    log(`Phone validation failed for ${patientName}: ${validation.error}`, "whatsapp");
    return { success: false, error: validation.error };
  }

  const formattedNumber = validation.sanitized;
  const toNumber = formattedNumber.startsWith("91") ? formattedNumber : `91${formattedNumber}`;

  const payload = {
    messaging_product: "whatsapp",
    to: toNumber,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: `Hi ${patientName}, have you taken your medicine ${medicineName}?`
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: `TAKEN_${careEventId}`,
              title: "Taken"
            }
          },
          {
            type: "reply",
            reply: {
              id: `MISSED_${careEventId}`,
              title: "Not Taken"
            }
          }
        ]
      }
    }
  };

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      const errorMsg = data?.error?.message || `HTTP ${response.status}`;
      const errorCode = data?.error?.code;
      const prefix = (errorCode === 100 || errorCode === 190 || isPermanentError(errorMsg)) ? "permanent: " : "";
      return { success: false, error: `${prefix}${errorMsg}` };
    }

    const messageId = data?.messages?.[0]?.id || null;
    return { success: true, messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const MAX_MESSAGES_PER_CYCLE = 20;

async function processScheduledEvents() {
  try {
    const allPendingEvents = await storage.getPendingCareEventsForWhatsapp();
    const pendingEvents = allPendingEvents.slice(0, MAX_MESSAGES_PER_CYCLE);

    let sentCount = 0;
    for (const event of pendingEvents) {
      if (!event.medicineId) continue;

      const visit = await storage.getVisit(event.visitId);
      if (!visit || visit.status === "cancelled") {
        await storage.updateCareEvent(event.id, { status: "cancelled" });
        continue;
      }

      const patient = await storage.getPatient(visit.patientId);
      if (!patient || !patient.whatsappNumber) {
        continue;
      }

      const medicine = await storage.getMedicine(event.medicineId);
      if (!medicine) continue;

      const existingLog = await storage.getWhatsappMessageLogByCareEvent(event.id);
      if (existingLog && (existingLog.status === "sent" || existingLog.status === "delivered")) {
        continue;
      }

      const result = await sendWhatsappReminder(
        patient.whatsappNumber,
        patient.name,
        medicine.name,
        event.id
      );

      const messageLog = await storage.createWhatsappMessageLog({
        careEventId: event.id,
        visitId: event.visitId,
        patientId: patient.id,
        medicineId: event.medicineId,
        whatsappNumber: patient.whatsappNumber,
        messagePayload: {
          patientName: patient.name,
          medicineName: medicine.name,
        },
        whatsappMessageId: result.messageId || null,
        status: result.success ? "sent" : "failed",
        retryCount: 0,
        sentAt: result.success ? new Date() : null,
        deliveredAt: null,
        responseReceivedAt: null,
        patientResponse: null,
        errorMessage: result.error || null,
      });

      if (result.success) {
        await storage.updateCareEvent(event.id, {
          status: "sent",
          whatsappMessageId: result.messageId || null,
        });
        log(`WhatsApp sent to ${patient.name} for ${medicine.name} (event: ${event.id})`, "whatsapp");
        await createWhatsappAuditLog("WHATSAPP_REMINDER_SENT", event.id, `Reminder sent to ${patient.name} for medicine: ${medicine.name}`);
        sentCount++;
        await sleep(2000);
      } else {
        log(`WhatsApp FAILED for ${patient.name}: ${result.error} (event: ${event.id})`, "whatsapp");
        await createWhatsappAuditLog("WHATSAPP_REMINDER_FAILED", event.id, `Reminder failed for ${patient.name}, medicine: ${medicine.name}, error: ${result.error}`);
        if (result.error && result.error.includes("rate limit")) {
          log(`Rate limit hit, stopping this cycle after ${sentCount} messages`, "whatsapp");
          break;
        }
      }
    }

    const retryable = await storage.getRetryableWhatsappMessages();
    for (const msg of retryable) {
      const currentRetry = msg.retryCount || 0;
      if (currentRetry >= 3) {
        continue;
      }
      const backoffMs = getRetryBackoffMs(currentRetry);
      const lastAttempt = msg.sentAt || msg.createdAt;
      if (lastAttempt && (Date.now() - new Date(lastAttempt).getTime()) < backoffMs) {
        continue;
      }

      if (msg.errorMessage && isPermanentError(msg.errorMessage)) {
        log(`Skipping permanent failure for message ${msg.id}: ${msg.errorMessage}`, "whatsapp");
        continue;
      }

      const event = await storage.getCareEvent(msg.careEventId);
      if (!event || event.status !== "pending") continue;

      const visit = await storage.getVisit(msg.visitId);
      if (!visit || visit.status === "cancelled") continue;

      const patient = await storage.getPatient(msg.patientId);
      if (!patient || !patient.whatsappNumber) continue;

      const medicine = msg.medicineId ? await storage.getMedicine(msg.medicineId) : null;
      if (!medicine) continue;

      const result = await sendWhatsappReminder(
        patient.whatsappNumber,
        patient.name,
        medicine.name,
        event.id
      );

      const newRetryCount = currentRetry + 1;
      const isPermanent = result.error ? isPermanentError(result.error) : false;

      await storage.updateWhatsappMessageLog(msg.id, {
        retryCount: newRetryCount,
        status: result.success ? "sent" : "failed",
        sentAt: result.success ? new Date() : new Date(),
        whatsappMessageId: result.messageId || msg.whatsappMessageId,
        errorMessage: result.error || null,
      });

      if (result.success) {
        await storage.updateCareEvent(event.id, {
          status: "sent",
          whatsappMessageId: result.messageId || null,
        });
        log(`WhatsApp RETRY #${newRetryCount} success for event ${event.id}`, "whatsapp");
        await createWhatsappAuditLog("WHATSAPP_RETRY_SENT", event.id, `Retry #${newRetryCount} succeeded for ${patient.name}, medicine: ${medicine.name}`);
        await sleep(2000);
      } else {
        const status = isPermanent ? "permanent failure" : `will retry (${newRetryCount}/3)`;
        log(`WhatsApp RETRY #${newRetryCount} failed for event ${event.id}: ${result.error} — ${status}`, "whatsapp");
        await createWhatsappAuditLog("WHATSAPP_RETRY_FAILED", event.id, `Retry #${newRetryCount} failed for ${patient.name}, medicine: ${medicine.name}, error: ${result.error}`);
        if (result.error && result.error.includes("rate limit")) {
          log(`Rate limit hit during retries, stopping this cycle`, "whatsapp");
          break;
        }
      }
    }
  } catch (err: any) {
    log(`WhatsApp scheduler error: ${err.message}`, "whatsapp");
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startWhatsappScheduler() {
  if (schedulerInterval) return;

  if (!isWhatsappConfigured()) {
    log("WhatsApp not configured (missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID). Scheduler disabled.", "whatsapp");
    return;
  }

  log("WhatsApp scheduler started (1-minute interval)", "whatsapp");

  schedulerInterval = setInterval(processScheduledEvents, 60 * 1000);

  setTimeout(processScheduledEvents, 5000);
}

export function stopWhatsappScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log("WhatsApp scheduler stopped", "whatsapp");
  }
}

export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}

export async function processWhatsappWebhook(body: any): Promise<{ processed: boolean; message: string }> {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageData = value?.messages?.[0];

    if (!messageData) {
      return { processed: false, message: "No message data" };
    }

    const interactive = messageData?.interactive;
    if (!interactive || interactive.type !== "button_reply") {
      return { processed: false, message: "Not a button reply — ignored" };
    }

    const buttonId = interactive.button_reply?.id;
    if (!buttonId) {
      return { processed: false, message: "No button ID" };
    }

    const parts = buttonId.split("_");
    if (parts.length < 2) {
      return { processed: false, message: "Invalid button ID format" };
    }

    const action = parts[0];
    const careEventId = parts.slice(1).join("_");

    if (action !== "TAKEN" && action !== "MISSED") {
      return { processed: false, message: `Unknown action: ${action}` };
    }

    const careEvent = await storage.getCareEvent(careEventId);
    if (!careEvent) {
      return { processed: false, message: `Care event not found: ${careEventId}` };
    }

    if (careEvent.status === "completed") {
      return { processed: false, message: "Already completed — ignoring duplicate" };
    }

    const visit = await storage.getVisit(careEvent.visitId);
    if (!visit || visit.status === "cancelled") {
      return { processed: false, message: "Visit cancelled — ignoring" };
    }

    const patientResponse = action === "TAKEN" ? "taken" : "missed";

    await storage.updateCareEvent(careEventId, {
      status: "completed",
      patientResponse,
    });

    const patient = await storage.getPatient(visit.patientId);

    let dayNumber = 1;
    if (visit.approvedAt && careEvent.scheduledTime) {
      const approvedDate = new Date(visit.approvedAt);
      approvedDate.setHours(0, 0, 0, 0);
      const eventDate = new Date(careEvent.scheduledTime);
      eventDate.setHours(0, 0, 0, 0);
      dayNumber = Math.floor((eventDate.getTime() - approvedDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      if (dayNumber < 1) dayNumber = 1;
    }

    await storage.createAdherenceLog({
      visitId: careEvent.visitId,
      patientId: visit.patientId,
      medicineId: careEvent.medicineId || null,
      dayNumber,
      status: patientResponse as "taken" | "missed" | "pending",
      notes: `WhatsApp response: ${patientResponse}`,
    });

    const msgLog = await storage.getWhatsappMessageLogByCareEvent(careEventId);
    if (msgLog) {
      await storage.updateWhatsappMessageLog(msgLog.id, {
        status: "responded",
        responseReceivedAt: new Date(),
        patientResponse,
      });
    }

    log(`WhatsApp response: ${patientResponse} for event ${careEventId} (patient: ${patient?.name})`, "whatsapp");

    const medicineName = careEvent.medicineId ? (await storage.getMedicine(careEvent.medicineId))?.name : "unknown";
    await createWhatsappAuditLog("WHATSAPP_PATIENT_RESPONSE", careEventId, `Patient ${patient?.name || "unknown"} responded "${patientResponse}" for medicine: ${medicineName || "unknown"}`);

    return { processed: true, message: `Response recorded: ${patientResponse}` };
  } catch (err: any) {
    log(`Webhook processing error: ${err.message}`, "whatsapp");
    return { processed: false, message: err.message };
  }
}

export async function sendPrescriptionPdf(
  whatsappNumber: string,
  patientName: string,
  doctorName: string,
  pdfUrl: string,
  visitId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isWhatsappConfigured()) {
    return { success: false, error: "WhatsApp not configured" };
  }

  const validation = validateWhatsappNumber(whatsappNumber);
  if (!validation.valid) {
    log(`Prescription PDF send: phone validation failed for ${patientName}: ${validation.error}`, "whatsapp");
    return { success: false, error: validation.error };
  }

  const formattedNumber = validation.sanitized;
  const toNumber = formattedNumber.startsWith("91") ? formattedNumber : `91${formattedNumber}`;

  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const filename = `Prescription_${patientName.replace(/[^a-zA-Z0-9]/g, "_")}_${today.replace(/\s+/g, "_")}.pdf`;

  const payload = {
    messaging_product: "whatsapp",
    to: toNumber,
    type: "document",
    document: {
      link: pdfUrl,
      filename: filename,
      caption: `Hi ${patientName}, your prescription from Dr. ${doctorName} is ready. Please follow the prescribed medications as directed. This document is valid for 7 days.`
    }
  };

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      const errorMsg = data?.error?.message || `HTTP ${response.status}`;
      log(`Prescription PDF send failed for ${patientName}: ${errorMsg}`, "whatsapp");
      await createWhatsappAuditLog("WHATSAPP_PRESCRIPTION_FAILED", visitId, `Failed to send prescription PDF to ${patientName}: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const messageId = data?.messages?.[0]?.id || null;
    log(`Prescription PDF sent to ${patientName} (${toNumber}), messageId: ${messageId}`, "whatsapp");
    await createWhatsappAuditLog("WHATSAPP_PRESCRIPTION_SENT", visitId, `Prescription PDF sent to ${patientName} (${toNumber})`);

    const visitRow = await storage.getVisit(visitId);
    const careEvents = visitRow ? await storage.getCareEventsByVisit(visitId) : [];
    const careEventId = careEvents[0]?.id;
    if (visitRow && careEventId) {
      await storage.createWhatsappMessageLog({
        visitId,
        patientId: visitRow.patientId,
        medicineId: null,
        careEventId,
        whatsappNumber: toNumber,
        whatsappMessageId: messageId ?? undefined,
        status: "sent",
        messagePayload: { type: "prescription_pdf", patientName, doctorName, filename },
        retryCount: 0,
      });
    }

    return { success: true, messageId: messageId ?? undefined };
  } catch (err: any) {
    log(`Prescription PDF send error for ${patientName}: ${err.message}`, "whatsapp");
    await createWhatsappAuditLog("WHATSAPP_PRESCRIPTION_FAILED", visitId, `Error sending prescription PDF to ${patientName}: ${err.message}`);
    return { success: false, error: err.message };
  }
}
