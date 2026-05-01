# Carepath AI — WhatsApp Automation Setup Guide

This guide walks you through connecting WhatsApp to Carepath AI so that:
- Prescription PDFs are automatically sent to patients when a doctor approves a visit
- Medicine reminders are sent to patients at the right times every day
- Patients can tap "Taken" or "Not Taken" buttons to track their adherence
- Doctors and admins can monitor delivery and response rates

---

## Prerequisites

Before you begin, make sure you have:

1. **A Meta (Facebook) Business Account** — [Create one here](https://business.facebook.com/)
2. **A phone number** that will send WhatsApp messages to patients (this number cannot already be registered on WhatsApp — use a new number or deregister the existing one)
3. **Your Carepath AI app deployed** on a public domain (e.g., `https://carepath.in`)

---

## Step 1: Create a Meta App with WhatsApp

### 1.1 Go to Meta Developer Portal
- Visit [https://developers.facebook.com/apps/](https://developers.facebook.com/apps/)
- Click **"Create App"**
- Choose **"Business"** as the app type
- Give it a name (e.g., "Carepath WhatsApp") and select your Meta Business Account
- Click **"Create App"**

### 1.2 Add WhatsApp Product
- On your app dashboard, scroll down and find **"WhatsApp"**
- Click **"Set Up"**
- This will take you to the WhatsApp configuration page

### 1.3 Get Your Phone Number ID
- Go to **WhatsApp > API Setup** in the left sidebar
- You'll see a section called **"From"** with a phone number dropdown
- If you don't have a number yet, click **"Add phone number"** and follow the verification process
- Once your number is set up, note the **Phone Number ID** displayed below the number
- It looks something like: `123456789012345`

### 1.4 Get Your Access Token
- On the same **API Setup** page, you'll see a **"Temporary access token"** section
- For production, you need a **Permanent Token**. To create one:
  1. Go to **Business Settings > System Users** in your Meta Business Suite
  2. Create a System User (Admin role)
  3. Click **"Generate Token"** for that System User
  4. Select your WhatsApp app
  5. Grant these permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
  6. Copy the generated token — **save it securely, you won't see it again**

---

## Step 2: Set Environment Variables

You need to set these environment variables in your Carepath AI deployment:

| Variable | Value | Example |
|----------|-------|---------|
| `WHATSAPP_ACCESS_TOKEN` | Your permanent System User token from Step 1.4 | `EAABx...long_token...xyz` |
| `WHATSAPP_PHONE_NUMBER_ID` | Your phone number ID from Step 1.3 | `123456789012345` |
| `PUBLIC_BASE_URL` | Your app's public URL (must be HTTPS) | `https://carepath.in` |

### How to set them in Replit:
1. Open your Replit project
2. Click the **"Secrets"** (lock icon) in the left sidebar
3. Add each variable:
   - Key: `WHATSAPP_ACCESS_TOKEN`, Value: *(paste your token)*
   - Key: `WHATSAPP_PHONE_NUMBER_ID`, Value: *(paste your phone number ID)*
   - Key: `PUBLIC_BASE_URL`, Value: `https://carepath.in`
4. Restart the application

### How to set them on other hosting (e.g., Hostinger, VPS):
- Add them to your `.env` file or server environment configuration
- Make sure they're loaded before the app starts

---

## Step 3: Configure the Webhook

The webhook is how WhatsApp tells Carepath AI when a patient responds to a message (clicks "Taken" or "Not Taken").

### 3.1 Set the Webhook URL in Meta
1. Go to your Meta app dashboard → **WhatsApp > Configuration**
2. In the **"Webhook"** section, click **"Edit"**
3. Enter these values:
   - **Callback URL:** `https://carepath.in/api/webhooks/whatsapp`
   - **Verify Token:** `carepath_whatsapp_verify_2024`
4. Click **"Verify and Save"**
5. Meta will send a verification request to your server — if your app is running, it should verify automatically

### 3.2 Subscribe to Webhook Fields
After verification:
1. On the same Configuration page, find **"Webhook fields"**
2. Click **"Manage"**
3. Subscribe to: **`messages`**
4. Click **"Done"**

---

## Step 4: Verify the Setup

### 4.1 Check the Server Logs
After restarting the app, look for this log message:
```
[whatsapp] WhatsApp configured. Phone Number ID: 123456... Scheduler started (60s interval).
```

If you see this instead, the environment variables are missing:
```
[whatsapp] WhatsApp not configured (missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID). Scheduler disabled.
```

### 4.2 Check the Admin Dashboard
1. Log in as admin (`admin@carepath.ai`)
2. Go to the Admin Dashboard
3. Scroll down to the **"WhatsApp Reminders"** panel
4. You should see:
   - **Green dot** with "Active" — scheduler is running
   - Stats: Sent Today, Responded, Failed, Delivery Rate

### 4.3 Send a Test
1. Create a test patient with a valid WhatsApp phone number (10 digits, e.g., `9876543210`)
2. Start a visit, add a medicine, and approve the visit
3. The patient should receive:
   - A **prescription PDF** on WhatsApp (sent immediately on approval)
   - A **medicine reminder** at the scheduled time (e.g., 8:00 AM for "morning" medicines)

---

## How the Automation Works

Here's the complete flow from doctor's consultation to patient receiving messages:

### Flow Diagram

```
Doctor approves visit
        │
        ▼
┌─────────────────────────────┐
│  1. CARE EVENTS CREATED     │
│  Parse each medicine:       │
│  • Timing → hours           │
│    morning = 8:00 AM        │
│    afternoon = 1:00 PM      │
│    evening = 6:00 PM        │
│    night = 8:00 PM          │
│    twice daily = 8AM + 8PM  │
│    thrice daily = 8+1+8     │
│  • Duration → days          │
│    "5 days" → 5             │
│    "1 week" → 7             │
│    "1 month" → 30           │
│                             │
│  Creates one care event per │
│  dose per day               │
│  (e.g., 3 medicines × 2x   │
│   daily × 5 days = 30       │
│   care events)              │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  2. PRESCRIPTION PDF SENT   │
│  (Immediately on approval)  │
│                             │
│  • PDF generated on server  │
│    (Puppeteer/Chromium)     │
│  • Includes: doctor header, │
│    medicines, tests,        │
│    follow-ups, alternatives │
│  • Sent as WhatsApp         │
│    document attachment      │
│  • Filename: Prescription_  │
│    PatientName_Date.pdf     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  3. SCHEDULER RUNS          │
│  (Every 60 seconds)         │
│                             │
│  Checks: are there any      │
│  pending care events where  │
│  scheduledTime ≤ now?       │
│                             │
│  For each due event:        │
│  • Verify visit not         │
│    cancelled                │
│  • Validate patient phone   │
│    (10-12 digits)           │
│  • Check for duplicates     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  4. WHATSAPP MESSAGE SENT   │
│                             │
│  "Hi Rahul, have you taken  │
│   your medicine Amoxicillin │
│   500mg?"                   │
│                             │
│  [ ✅ Taken ] [ ❌ Not Taken]│
│                             │
│  • Logged in message_logs   │
│  • Care event → "sent"      │
│  • Audit log created        │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  5. PATIENT RESPONDS        │
│  (Taps a button)            │
│                             │
│  WhatsApp → Meta servers →  │
│  Webhook POST to            │
│  /api/webhooks/whatsapp     │
│                             │
│  • Care event → "completed" │
│  • Adherence log created    │
│    (taken or missed)        │
│  • Message log → "responded"│
│  • Day number calculated    │
│  • Audit log created        │
└─────────────────────────────┘
```

### What Happens if a Message Fails?

```
Message fails to send
        │
        ▼
┌─────────────────────────────┐
│  ERROR TYPE CHECK           │
│                             │
│  Permanent errors (skip):   │
│  • Invalid phone number     │
│  • Number not on WhatsApp   │
│  • Account blocked          │
│                             │
│  Temporary errors (retry):  │
│  • Network timeout          │
│  • Rate limit exceeded      │
│  • Server error             │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  RETRY WITH BACKOFF         │
│                             │
│  Retry 1: after 5 minutes   │
│  Retry 2: after 15 minutes  │
│  Retry 3: after 45 minutes  │
│                             │
│  After 3 retries → marked   │
│  as permanently failed      │
│  (visible in admin panel)   │
└─────────────────────────────┘
```

---

## Admin Monitoring

### WhatsApp Status Panel (Admin Dashboard)
The admin dashboard shows a real-time WhatsApp panel with:
- **Scheduler Status** — Green dot (Active) or Red dot (Stopped)
- **Sent Today** — Number of messages sent
- **Responded** — How many patients responded
- **Failed** — Number of failed deliveries
- **Delivery Rate** — Percentage of successful sends
- **Recent Failures** — Table showing last 10 failed messages with patient name, medicine, error reason, and retry count

### WhatsApp Status API
Admins can also query the status programmatically:
```
GET /api/admin/whatsapp-status
Authorization: Bearer <admin_token>
```

Returns:
```json
{
  "configured": true,
  "schedulerRunning": true,
  "today": {
    "totalSent": 45,
    "totalDelivered": 38,
    "totalFailed": 2,
    "totalResponded": 31,
    "deliveryRate": 96,
    "responseRate": 72
  },
  "recentFailed": [...]
}
```

---

## Manual Actions

### Send Prescription PDF via WhatsApp (Doctor)
If a prescription PDF needs to be re-sent:
1. Open the approved visit
2. Click **"Send PDF via WhatsApp"** button (green button, visible only on approved visits)
3. The system generates a fresh PDF and sends it to the patient

### API Endpoint for Manual Send
```
POST /api/visits/:id/send-prescription-whatsapp
Authorization: Bearer <doctor_token>
```

---

## Troubleshooting

### "WhatsApp not configured" in logs
- **Cause:** `WHATSAPP_ACCESS_TOKEN` or `WHATSAPP_PHONE_NUMBER_ID` environment variables are missing
- **Fix:** Add them in Replit Secrets and restart the app

### Webhook verification fails
- **Cause:** App is not running, or the URL is incorrect
- **Fix:** Make sure the app is deployed and accessible at `https://carepath.in/api/webhooks/whatsapp`
- **Check:** The verify token must be exactly `carepath_whatsapp_verify_2024`

### Messages not being sent
- **Check 1:** Is the scheduler running? (Admin Dashboard → WhatsApp panel → green dot)
- **Check 2:** Does the patient have a valid phone number? (10-12 digits, Indian format)
- **Check 3:** Is the phone number on WhatsApp?
- **Check 4:** Check the admin dashboard for recent failures and error messages

### Patient doesn't receive the PDF
- **Cause 1:** Patient has no phone number in the system → add phone when creating/editing the patient
- **Cause 2:** WhatsApp can't fetch the PDF URL → make sure `PUBLIC_BASE_URL` is set correctly (must be `https://`)
- **Cause 3:** Token expired → the PDF link is valid for 7 days

### "Permanent: Invalid phone number" error
- **Cause:** The phone number is too short, too long, or contains invalid characters
- **Fix:** Phone numbers should be 10-12 digits (e.g., `9876543210` or `919876543210`)

### Messages sent but patient doesn't see buttons
- **Cause:** The patient's WhatsApp version might be too old
- **Fix:** Ask the patient to update WhatsApp to the latest version

### Access token expired
- **Cause:** You used a temporary test token instead of a permanent System User token
- **Fix:** Follow Step 1.4 to generate a permanent token from Meta Business Settings

---

## Quick Reference

| Item | Value |
|------|-------|
| Webhook URL | `https://carepath.in/api/webhooks/whatsapp` |
| Verify Token | `carepath_whatsapp_verify_2024` |
| Scheduler Interval | Every 60 seconds |
| Max Retries | 3 (backoff: 5min → 15min → 45min) |
| Phone Format | 10-12 digits (Indian numbers) |
| PDF Token Expiry | 7 days |
| Admin Credentials | `admin@carepath.ai` / `admin123` |
| WhatsApp API Version | v21.0 |
| Required Env Vars | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `PUBLIC_BASE_URL` |
