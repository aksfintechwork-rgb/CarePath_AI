import puppeteer from "puppeteer-core";
import { storage } from "./storage";
import { translateFreeTextBatch } from "./medical-translations";
import { translateMedicalTerm } from "./medical-translations";
import { execSync } from "child_process";

function findChromiumPath(): string {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try {
    const result = execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null || echo ''", { encoding: "utf-8" }).trim();
    if (result) return result;
  } catch {}
  const nixPaths = [
    "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
  ];
  for (const p of nixPaths) {
    try { require("fs").accessSync(p); return p; } catch {}
  }
  return "chromium";
}

const CHROMIUM_PATH = findChromiumPath();

const escHtml = (s: string | null | undefined): string => {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};

export async function generatePrescriptionPdf(visitId: string): Promise<Buffer> {
  const visit = await storage.getVisit(visitId);
  if (!visit) throw new Error("Visit not found");

  const patient = await storage.getPatient(visit.patientId);
  const meds = await storage.getMedicinesByVisit(visit.id);
  const visitTests = await storage.getTestsByVisit(visit.id);
  const fups = await storage.getFollowupsByVisit(visit.id);
  const doctor = visit.doctorId ? await storage.getUser(visit.doctorId) : null;

  const drName = escHtml(doctor?.name || "Doctor");
  const drPhone = escHtml(doctor?.phone || "");
  const drEmail = escHtml(doctor?.email || "");
  const drClinic = escHtml(doctor?.clinicName || "");
  const drAddress = escHtml(doctor?.clinicAddress || "");
  const drQualifications = escHtml(doctor?.qualifications || "");
  const drSpecialization = escHtml(doctor?.specialization || "");

  const patientName = escHtml(patient?.name) || "Unknown";
  const patientId = visit.patientId ? "CP-" + visit.patientId.slice(-8).toUpperCase() : "N/A";
  const visitDate = visit.visitDate ? new Date(visit.visitDate).toLocaleDateString("en-IN") : "Today";
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
  for (const [i, med] of meds.entries()) {
    const alts = await storage.getAlternativesByMedicine(med.id);
    const altNames = alts.filter(a => a.alternativeName).map(a => escHtml(a.alternativeName)).join(" / ");
    medsRows += `<tr>
      <td>${i + 1}</td>
      <td><strong>${escHtml(med.name) || "—"}</strong>${altNames ? `<div style="font-size:10px;color:#666;margin-top:2px">Alt: ${altNames}</div>` : ""}</td>
      <td>${escHtml(med.dose) || "—"}</td>
      <td>${escHtml(tr(med.frequency))}</td>
      <td>${escHtml(tr(med.timing))}</td>
      <td>${escHtml(tr(med.instructions))}</td>
    </tr>`;
  }

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

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Prescription</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px 40px; color: #1a1a1a; font-size: 13px; line-height: 1.5; }
  .header { text-align: center; border-bottom: 3px solid #1a56db; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { font-size: 22px; color: #1a56db; margin-bottom: 2px; }
  .header .dr-qual { font-size: 12px; color: #555; margin-bottom: 2px; }
  .header p { color: #555; font-size: 13px; }
  .header .clinic-info { font-size: 12px; color: #1a56db; font-weight: 600; margin-top: 2px; }
  .patient-info { display: flex; gap: 20px; background: #f0f5ff; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .patient-info div { font-size: 13px; }
  .patient-info strong { color: #1a56db; }
  .section { margin-bottom: 22px; }
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
  .rx-symbol { font-size: 28px; color: #1a56db; font-weight: 800; margin-right: 8px; }
</style></head><body>

<div class="header">
  <h1>${drName}</h1>
  ${drQualifications ? `<p class="dr-qual">${drQualifications}</p>` : ""}
  ${drSpecialization ? `<p class="dr-qual">${drSpecialization}</p>` : ""}
  ${drClinic ? `<p class="clinic-info">${drClinic}</p>` : ""}
  ${drAddress ? `<p style="font-size:11px;color:#777">${drAddress}</p>` : ""}
  <p style="margin-top:4px">Medical Prescription</p>
</div>

<div class="patient-info">
  <div><strong>Patient:</strong> ${patientName}</div>
  <div><strong>Patient ID:</strong> ${patientId}</div>
  <div><strong>Visit Date:</strong> ${visitDate}</div>
  <div><strong>Language:</strong> ${lang}</div>
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
  <div class="section-title"><span class="rx-symbol">℞</span> Prescribed Medications (${meds.length})</div>
  ${meds.length > 0 ? `
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Timing</th><th>Instructions</th></tr></thead>
    <tbody>${medsRows}</tbody>
  </table>` : `<p style="color:#888; padding:10px 0;">No medicines prescribed.</p>`}
</div>

${visitTests.length > 0 ? `
<div class="section">
  <div class="section-title">Lab Tests & Diagnostics (${visitTests.length})</div>
  <table>
    <thead><tr><th>#</th><th>Test Name</th><th>When to Do</th><th>Urgency</th><th>Trigger Condition</th></tr></thead>
    <tbody>${testsRows}</tbody>
  </table>
</div>` : ""}

${fups.length > 0 ? `
<div class="section">
  <div class="section-title">Follow-Up</div>
  <div class="summary-box">${followupHtml}</div>
</div>` : ""}

<div class="footer">
  <div class="footer-grid">
    ${drPhone ? `<div><strong>Phone:</strong> ${drPhone}</div>` : ""}
    ${drEmail ? `<div><strong>Email:</strong> ${drEmail}</div>` : ""}
    ${drClinic ? `<div><strong>Clinic:</strong> ${drClinic}</div>` : ""}
    ${drAddress ? `<div><strong>Address:</strong> ${drAddress}</div>` : ""}
  </div>
  <p class="footer-note">Generated on ${new Date().toLocaleString("en-IN")} | This is a computer-generated prescription. Please verify with the attending physician.</p>
  <p class="footer-note" style="margin-top:4px;color:#1a56db;font-weight:600">Powered by Carepath AI</p>
</div>
</body></html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const invoice = await storage.getInvoice(invoiceId);
  if (!invoice) throw new Error("Invoice not found");

  const lineItems = await storage.getInvoiceLineItems(invoiceId);
  const doctor = invoice.doctorId ? await storage.getUser(invoice.doctorId) : null;

  const periodStart = invoice.billingPeriodStart ? new Date(invoice.billingPeriodStart).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
  const periodEnd = invoice.billingPeriodEnd ? new Date(invoice.billingPeriodEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
  const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : new Date().toLocaleDateString("en-IN");
  const currency = invoice.currency || "INR";
  const symbol = currency === "INR" ? "₹" : "$";

  const itemsHtml = lineItems.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escHtml(item.description)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${symbol}${Number(item.unitPrice).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${symbol}${Number(item.total).toFixed(2)}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin:0; padding:40px; color:#1a1a1a; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; border-bottom:3px solid #1e5fad; padding-bottom:20px; }
    .logo { font-size:24px; font-weight:700; color:#1e5fad; }
    .logo-sub { font-size:12px; color:#666; }
    .invoice-title { font-size:28px; font-weight:700; color:#1e5fad; text-align:right; }
    .invoice-number { font-size:14px; color:#666; text-align:right; }
    .details { display:flex; justify-content:space-between; margin-bottom:30px; }
    .detail-box { width:48%; }
    .detail-label { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .detail-value { font-size:14px; color:#333; margin-bottom:12px; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    th { background:#f3f6fb; color:#1e5fad; padding:10px 12px; text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align:right; }
    th:nth-child(2) { text-align:center; }
    .totals { text-align:right; margin-top:10px; }
    .total-row { display:flex; justify-content:flex-end; gap:30px; padding:4px 0; font-size:14px; }
    .total-final { font-size:18px; font-weight:700; color:#1e5fad; border-top:2px solid #1e5fad; padding-top:8px; margin-top:8px; }
    .status-badge { display:inline-block; padding:4px 12px; border-radius:12px; font-size:12px; font-weight:600; }
    .status-pending { background:#fef3c7; color:#92400e; }
    .status-paid { background:#d1fae5; color:#065f46; }
    .status-overdue { background:#fee2e2; color:#991b1b; }
    .status-refunded { background:#ede9fe; color:#5b21b6; }
    .footer { margin-top:40px; padding-top:15px; border-top:1px solid #e5e7eb; text-align:center; font-size:11px; color:#999; }
  </style></head><body>
  <div class="header">
    <div><div class="logo">CAREPATH AI</div><div class="logo-sub">Healthcare Platform</div></div>
    <div><div class="invoice-title">INVOICE</div><div class="invoice-number">#${escHtml(invoice.invoiceNumber)}</div></div>
  </div>
  <div class="details">
    <div class="detail-box">
      <div class="detail-label">Bill To</div>
      <div class="detail-value"><strong>${escHtml(doctor?.name || "Doctor")}</strong></div>
      <div class="detail-value">${escHtml(doctor?.email || "")}</div>
      <div class="detail-value">${escHtml(doctor?.phone || "")}</div>
      ${doctor?.clinicName ? `<div class="detail-value">${escHtml(doctor.clinicName)}</div>` : ""}
    </div>
    <div class="detail-box" style="text-align:right;">
      <div class="detail-label">Invoice Date</div>
      <div class="detail-value">${invoiceDate}</div>
      <div class="detail-label">Billing Period</div>
      <div class="detail-value">${periodStart} - ${periodEnd}</div>
      <div class="detail-label">Status</div>
      <div class="detail-value"><span class="status-badge status-${invoice.status}">${invoice.status.toUpperCase()}</span></div>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal:</span><span>${symbol}${Number(invoice.subtotal).toFixed(2)}</span></div>
    ${Number(invoice.discount) > 0 ? `<div class="total-row" style="color:#059669;"><span>Discount:</span><span>-${symbol}${Number(invoice.discount).toFixed(2)}</span></div>` : ""}
    ${Number(invoice.tax) > 0 ? `<div class="total-row"><span>Tax:</span><span>${symbol}${Number(invoice.tax).toFixed(2)}</span></div>` : ""}
    <div class="total-row total-final"><span>Total:</span><span>${symbol}${Number(invoice.total).toFixed(2)}</span></div>
  </div>
  <div class="footer">This is a computer-generated invoice from Carepath AI. For queries, contact support@carepath.in</div>
  </body></html>`;

  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) await browser.close();
  }
}
