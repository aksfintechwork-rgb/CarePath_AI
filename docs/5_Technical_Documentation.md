# Technical Documentation
## CarePath AI

---

## 1. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│                                                                     │
│  React 18 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui        │
│                                                                     │
│  ┌────────────┐  ┌─────────────┐  ┌───────────┐  ┌─────────────┐  │
│  │   wouter    │  │  TanStack   │  │ WebSocket │  │  MediaRec.  │  │
│  │  (Router)   │  │   Query     │  │  Client   │  │  Audio API  │  │
│  └──────┬─────┘  └──────┬──────┘  └─────┬─────┘  └──────┬──────┘  │
│         │               │               │               │          │
│  ┌──────┴───────────────┴───────────────┴───────────────┴──────┐   │
│  │                    Hooks Layer                               │   │
│  │  useAuth | usePlanFeatures | useAdminPermissions | useRealtime│  │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                      HTTPS / WSS (Port 5000)
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      SERVER (Express.js + ws)                       │
│                                                                     │
│  ┌────────────┐  ┌─────────────┐  ┌───────────┐  ┌─────────────┐  │
│  │  REST API  │  │  WebSocket  │  │   Auth    │  │ Middleware   │  │
│  │  routes.ts │  │  Server     │  │  bcrypt   │  │  RBAC/Plan  │  │
│  │  (~4600 ln)│  │  websocket  │  │  sessions │  │  loadPlan   │  │
│  └──────┬─────┘  └─────────────┘  └───────────┘  └─────────────┘  │
│         │                                                           │
│  ┌──────┴─────────────────────────────────────────────────────┐    │
│  │                   Storage Layer (IStorage)                  │    │
│  │              Drizzle ORM → PostgreSQL queries               │    │
│  └─────────────────────────┬──────────────────────────────────┘    │
│                             │                                       │
│  ┌────────────┐  ┌─────────┴───┐  ┌───────────┐  ┌─────────────┐  │
│  │ AI Medical │  │  WhatsApp   │  │   Email   │  │     PDF     │  │
│  │  GPT-4o    │  │  Cloud API  │  │ Nodemailer│  │  Generator  │  │
│  │  Whisper   │  │  Scheduler  │  │ Gmail SMTP│  │  HTML→PDF   │  │
│  └────────────┘  └─────────────┘  └───────────┘  └─────────────┘  │
│                                                                     │
│  ┌────────────┐  ┌─────────────┐  ┌───────────┐                   │
│  │ Medical    │  │ Seed Admin  │  │  Static   │                   │
│  │ Translate  │  │ Seed Meds   │  │  Serving  │                   │
│  │ 15+ langs  │  │ Price Migr. │  │           │                   │
│  └────────────┘  └─────────────┘  └───────────┘                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                    PostgreSQL (Port 5432)
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    POSTGRESQL DATABASE                               │
│                    (Replit Helium Instance)                          │
│                                                                     │
│  30 Tables: users, patients, visits, medicines, tests, followups,  │
│  care_events, adherence_logs, whatsapp_message_logs, conversations,│
│  messages, diarized_transcripts, voice_samples, medical_news,      │
│  medicine_reference, medicine_alternatives, prescription_risk_checks│
│  share_tokens, sessions, password_reset_tokens, subscription_plans,│
│  doctor_subscriptions, plan_features, regional_pricing, invoices,  │
│  invoice_line_items, coupons, upgrade_requests, admin_audit_logs,  │
│  ai_usage_logs                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                               │
│                                                                     │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │    OpenAI API   │  │  WhatsApp    │  │     Gmail SMTP        │  │
│  │  • GPT-4o       │  │  Cloud API   │  │  • OTP Emails         │  │
│  │  • Whisper      │  │  • Reminders │  │  • Password Recovery  │  │
│  │  • Vision (OCR) │  │  • Rx PDFs   │  │  • support.carepath@  │  │
│  │  • Translation  │  │  • Webhooks  │  │    gmail.com          │  │
│  └────────────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Request Flow
```
Browser → HTTPS Request → Express.js (Port 5000)
  → Auth Middleware (validateSession + loadPlanFeatures)
  → Route Handler (routes.ts)
  → Storage Layer (storage.ts + Drizzle ORM)
  → PostgreSQL Database
  → Response → JSON / PDF / HTML
```

### Startup Sequence
```
bash start.sh
  → npx tsx server/index.ts
    → Connect to PostgreSQL
    → Run Drizzle schema push
    → Seed admin account (admin@carepath.ai)
    → Migrate plan prices (migratePlanPrices)
    → Start Express server on port 5000
    → Start WebSocket server
    → Start WhatsApp scheduler (1-min interval)
    → Start Invoice scheduler (hourly, runs on 1st of month)
    → Serve Vite frontend (dev) or static build (prod)
```

---

## 2. Database Schema

### 2.1 Complete Table Reference (30 Tables)

#### Core User & Patient Tables

**users**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK, default gen_random_uuid() | Unique user identifier |
| name | text | NOT NULL | Doctor/admin full name |
| email | text | NOT NULL, UNIQUE | Login email address |
| phone | text | | Contact phone number |
| passwordHash | text | NOT NULL | bcrypt hashed password |
| role | text | default "doctor" | User role: "doctor" or "admin" |
| status | text | default "pending" | Account status: pending/approved/rejected |
| specialization | text | | Medical specialization |
| licenseNumber | text | | Medical license number |
| clinicName | text | | Clinic/hospital name |
| clinicAddress | text | | Clinic address |
| experience | integer | | Years of experience |
| qualifications | text | | Degrees and qualifications |
| profilePhoto | text | | Base64 encoded photo |
| adminRole | text | | Admin sub-role (super_admin, finance, etc.) |
| country | text | | Country for regional pricing |
| subscriptionId | varchar | | Link to active subscription |
| selectedPlanId | varchar | | Plan selected during registration |
| createdAt | timestamp | default now() | Account creation timestamp |

**patients**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK, default gen_random_uuid() | Patient identifier |
| name | text | NOT NULL | Patient full name |
| age | integer | NOT NULL | Patient age |
| gender | text | | Male/Female/Other |
| phone | text | | Contact number |
| whatsappNumber | text | | WhatsApp number for reminders |
| knownConditions | text | | Existing medical conditions |
| allergies | text | | Known allergies |
| pastIllnesses | text | | Previous illnesses |
| chronicDiseases | text | | Chronic conditions |
| currentMedications | text | | Currently taking medications |
| familyHistory | text | | Family medical history |
| lifestyleHabits | text | | Smoking, alcohol, exercise |
| previousSurgeries | text | | Past surgical procedures |
| pregnancyStatus | text | | Current pregnancy status |
| bloodGroup | text | | Blood type |
| weight | text | | Weight in kg |
| height | text | | Height in cm |
| doctorId | varchar | → users.id | Owning doctor |
| createdAt | timestamp | default now() | Record creation time |

#### Visit & Clinical Data Tables

**visits**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Visit identifier |
| patientId | varchar | → patients.id | Patient reference |
| doctorId | varchar | → users.id | Doctor reference |
| visitDate | timestamp | | Date/time of visit |
| language | text | default "English" | Consultation language |
| audioPath | text | | Path to audio file |
| audioBase64 | text | | Base64 audio data |
| transcriptText | text | | Full transcript text |
| aiDraftJson | json | | AI-extracted structured data |
| approved | boolean | default false | Approval status |
| approvedAt | timestamp | | Approval timestamp |
| status | text | default "draft" | Visit status: draft/approved |

**medicines**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Medicine identifier |
| visitId | varchar | → visits.id | Parent visit |
| name | text | | Medicine name |
| dose | text | | Dosage (e.g., "500mg") |
| frequency | text | | How often (e.g., "Twice daily") |
| timing | text | | When to take (e.g., "After food") |
| durationDays | integer | | Number of days |
| instructions | text | | Additional instructions |
| saltComposition | text | | Chemical composition |
| genericName | text | | Generic medicine name |
| selectedAlternativeId | varchar | | Chosen alternative medicine |

**tests**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| visitId | varchar | → visits.id | Parent visit |
| name | text | | Test name |
| whenToDo | text | | Timing instruction |
| urgency | text | | Priority level |
| triggerCondition | text | | Why this test is needed |
| fastingRequired | boolean | | Requires fasting |
| status | text | default "recommended" | Test status |
| labName | text | | Laboratory name |
| reportBase64 | text | | Uploaded report data |
| reportValues | json | | Extracted lab values |
| abnormalMarkers | json | | Flagged abnormal results |

**followups**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| visitId | varchar | → visits.id | Parent visit |
| followupAfterDays | integer | | Days until follow-up |
| followupDate | text | | Calculated follow-up date |
| warningSigns | text[] | | Array of warning signs |
| notes | text | | Additional notes |

#### Care Management Tables

**care_events**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Event identifier |
| visitId | varchar | → visits.id | Parent visit |
| medicineId | varchar | → medicines.id | Related medicine |
| eventType | text | | Event type (reminder, etc.) |
| scheduledTime | timestamp | | When event should fire |
| status | text | default "pending" | Event status |
| patientResponse | text | | Patient's response |
| whatsappMessageId | text | | WhatsApp message ID |

**adherence_logs**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Log identifier |
| visitId | varchar | → visits.id | Parent visit |
| patientId | varchar | → patients.id | Patient reference |
| medicineId | varchar | → medicines.id | Medicine reference |
| dayNumber | integer | | Day number in course |
| status | text | | Taken/Missed/Pending |
| loggedAt | timestamp | | When logged |
| notes | text | | Additional notes |

**whatsapp_message_logs**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Log identifier |
| careEventId | varchar | → care_events.id | Related care event |
| visitId | varchar | → visits.id | Parent visit |
| patientId | varchar | → patients.id | Recipient patient |
| medicineId | varchar | → medicines.id | Related medicine |
| whatsappNumber | text | | Recipient number |
| messagePayload | json | | Message content |
| status | text | | sent/delivered/failed/read |
| retryCount | integer | | Number of retry attempts |
| sentAt | timestamp | | Time sent |
| deliveredAt | timestamp | | Time delivered |
| responseReceivedAt | timestamp | | Time patient responded |

#### SaaS & Subscription Tables

**subscription_plans**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Plan identifier |
| name | text | | Plan name (Starter, Professional, etc.) |
| planType | text | | Plan category |
| monthlyPrice | double precision | | Monthly price in INR |
| annualPrice | double precision | | Annual price in INR |
| doctorsIncluded | integer | | Number of doctors included |
| maxDoctors | integer | | Maximum doctors allowed |
| aiMinutesPerMonth | integer | | AI minutes allocation |
| aiCarePlanLevel | text | | AI feature level |
| prescriptionChannels | text | | Available channels |
| supportLevel | text | | Support tier |
| isEnterprise | boolean | | Enterprise flag |
| whiteLabel | boolean | | White-label available |
| customIntegrations | boolean | | Custom integrations |
| isActive | boolean | default true | Plan availability |

**doctor_subscriptions**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Subscription identifier |
| doctorId | varchar | → users.id | Doctor reference |
| planId | varchar | → subscription_plans.id | Plan reference |
| status | text | default "trial" | trial/active/suspended/cancelled/expired |
| billingCycle | text | default "monthly" | monthly/annual |
| startDate | timestamp | default now() | Subscription start |
| nextBillingDate | timestamp | | Next payment due |
| expiresAt | timestamp | | Subscription expiry |
| cancelledAt | timestamp | | Cancellation timestamp |
| couponId | varchar | → coupons.id | Applied coupon |
| finalMonthlyPrice | double precision | | Price after discount |
| finalAnnualPrice | double precision | | Annual price after discount |

**invoices**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Invoice identifier |
| doctorId | varchar | → users.id | Billed doctor |
| subscriptionId | varchar | → doctor_subscriptions.id | Related subscription |
| invoiceNumber | text | | Sequential invoice number |
| amount | double precision | | Total amount in INR |
| tax | double precision | | Tax amount |
| totalAmount | double precision | | Amount + tax |
| status | text | | draft/sent/paid/overdue |
| dueDate | timestamp | | Payment due date |
| paidAt | timestamp | | Payment timestamp |
| createdAt | timestamp | | Invoice creation date |

**coupons**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Coupon identifier |
| code | text | UNIQUE | Discount code |
| discountType | text | | percentage/fixed |
| discountValue | double precision | | Discount amount |
| maxUses | integer | | Maximum redemptions |
| currentUses | integer | default 0 | Current redemptions |
| validFrom | timestamp | | Start date |
| validUntil | timestamp | | Expiry date |
| applicablePlans | text | | Comma-separated plan IDs |
| isActive | boolean | default true | Coupon availability |

#### Admin & System Tables

**admin_audit_logs**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Log identifier |
| adminId | varchar | → users.id | Admin who performed action |
| action | text | | Action type (approve_doctor, etc.) |
| targetType | text | | Target entity type |
| targetId | varchar | | Target entity ID |
| details | text | | Additional action details |
| createdAt | timestamp | default now() | Action timestamp |

**ai_usage_logs**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar | PK | Log identifier |
| doctorId | varchar | → users.id | Doctor who used AI |
| minutesUsed | double precision | | AI minutes consumed |
| feature | text | | Feature used (transcription, extraction) |
| createdAt | timestamp | default now() | Usage timestamp |

### 2.2 Entity Relationship Diagram

```
users (Doctor/Admin)
  │
  ├──→ patients (1:N via doctorId)
  │      │
  │      └──→ visits (1:N via patientId + doctorId)
  │             │
  │             ├──→ medicines (1:N via visitId)
  │             │      ├──→ medicine_alternatives (1:N via medicineId)
  │             │      ├──→ care_events (1:N via medicineId + visitId)
  │             │      │      └──→ whatsapp_message_logs (1:N via careEventId)
  │             │      └──→ adherence_logs (1:N via medicineId)
  │             │
  │             ├──→ tests (1:N via visitId)
  │             ├──→ followups (1:N via visitId)
  │             ├──→ diarized_transcripts (1:1 via visitId)
  │             ├──→ share_tokens (1:N via visitId)
  │             └──→ prescription_risk_checks (1:N via visitId)
  │
  ├──→ doctor_subscriptions (1:N via doctorId)
  │      ├──→ subscription_plans (N:1 via planId)
  │      ├──→ coupons (N:1 via couponId)
  │      └──→ invoices (1:N via subscriptionId)
  │             └──→ invoice_line_items (1:N via invoiceId)
  │
  ├──→ sessions (1:N via userId)
  ├──→ password_reset_tokens (1:N via userId)
  ├──→ voice_samples (1:N via doctorId)
  ├──→ ai_usage_logs (1:N via doctorId)
  ├──→ upgrade_requests (1:N via doctorId)
  ├──→ conversations (1:N via userId)
  │      └──→ messages (1:N via conversationId)
  ├──→ medical_news (1:N via doctorId)
  └──→ admin_audit_logs (1:N via adminId)

Standalone Tables:
  ├── subscription_plans
  │      ├──→ plan_features (1:N via planId)
  │      └──→ regional_pricing (1:N via planId)
  └── medicine_reference (global lookup)
```

---

## 3. API Documentation

### 3.1 Authentication APIs

#### POST /api/auth/register
Register a new doctor account.
- **Auth**: Public
- **Body**: `{ name, email, phone, password, specialization, licenseNumber, clinicName, clinicAddress, qualifications, experience, country, selectedPlanId }`
- **Response**: `{ message: "Registration successful. Please wait for admin approval.", user: { id, name, email } }`
- **Notes**: Creates user with status "pending". Creates trial subscription if plan selected.

#### POST /api/auth/login
Authenticate and create session.
- **Auth**: Public
- **Body**: `{ email, password }`
- **Response**: `{ token, user: { id, name, email, role, status } }`
- **Errors**: 401 Invalid credentials, 403 Pending approval, 403 Account rejected

#### POST /api/auth/logout
Terminate current session.
- **Auth**: Token required
- **Response**: `{ message: "Logged out" }`

#### POST /api/auth/forgot-password
Request password reset OTP.
- **Auth**: Public
- **Body**: `{ identifier: "email@example.com" }`
- **Response**: `{ message: "If the account exists, a verification code has been sent to your email." }`
- **Notes**: Always returns success (no email enumeration). OTP is 6 digits, expires in 10 minutes. Sends via Gmail SMTP from support.carepath@gmail.com.

#### POST /api/auth/reset-password
Reset password using OTP.
- **Auth**: Public
- **Body**: `{ token: "123456", password: "newpassword" }`
- **Response**: `{ message: "Password reset successfully" }`
- **Errors**: 400 Invalid or expired reset link

#### GET /api/auth/me
Get current authenticated user.
- **Auth**: Token required
- **Response**: Full user object with subscription and plan details

#### PUT /api/auth/profile
Update doctor profile.
- **Auth**: Token required
- **Body**: `{ name?, phone?, specialization?, clinicName?, clinicAddress?, qualifications?, experience? }`
- **Response**: Updated user object

#### POST /api/auth/profile/photo
Upload profile photo.
- **Auth**: Token required
- **Body**: `{ photo: "base64_data" }`

#### DELETE /api/auth/profile/photo
Remove profile photo.
- **Auth**: Token required

### 3.2 Patient APIs

#### GET /api/patients
List doctor's patients.
- **Auth**: Token required
- **Response**: Array of patient objects (filtered by doctorId)

#### POST /api/patients
Create new patient.
- **Auth**: Token required
- **Body**: `{ name, age, gender?, phone?, whatsappNumber? }`
- **Response**: Created patient object

#### GET /api/patients/:id
Get patient details with medical history.
- **Auth**: Token required

#### PATCH /api/patients/:id
Update patient details.
- **Auth**: Token required

#### PUT /api/patients/:id/history
Update patient medical history.
- **Auth**: Token required
- **Body**: `{ knownConditions?, allergies?, pastIllnesses?, chronicDiseases?, currentMedications?, familyHistory?, lifestyleHabits?, previousSurgeries?, pregnancyStatus?, bloodGroup?, weight?, height? }`

#### GET /api/patients/:id/first-visit-check
Check if patient is visiting for the first time.
- **Auth**: Token required
- **Response**: `{ isFirstVisit: boolean }`

#### GET /api/patients/:id/portal
Get comprehensive patient portal data with all visits.
- **Auth**: Token required

### 3.3 Visit APIs

#### POST /api/visits
Start a new visit.
- **Auth**: Token required
- **Body**: `{ patientId, language? }`
- **Response**: Created visit object with status "draft"

#### GET /api/visits
List doctor's visits.
- **Auth**: Token required
- **Query**: `?status=draft|approved&limit=10&offset=0`

#### GET /api/visits/:id
Get full visit details including medicines, tests, follow-ups, transcript.
- **Auth**: Token required

#### POST /api/visits/:id/finalize
Process audio and run AI extraction.
- **Auth**: Token required
- **Body**: `{ audioBase64?, transcriptText? }`
- **Response**: Extracted data `{ symptoms, diagnosis, medicines[], tests[], followup }`
- **Notes**: Consumes AI minutes. Returns 403 with `upgradeRequired: true` if trial minutes exhausted.

#### POST /api/visits/:id/reextract
Re-run AI extraction on existing transcript.
- **Auth**: Token required

#### POST /api/visits/:id/approve
Approve and finalize care plan.
- **Auth**: Token required
- **Response**: Updated visit with approved=true, care events created

#### POST /api/visits/:id/share
Generate shareable prescription link.
- **Auth**: Token required
- **Response**: `{ shareUrl: "https://domain/share/token123" }`

#### GET /api/visits/:id/prescription.pdf
Generate and download prescription PDF.
- **Auth**: Token required

#### GET /share/:token
View shared prescription (public).
- **Auth**: Public
- **Response**: HTML rendered prescription page

#### POST /api/visits/:id/audio-chunk
Stream audio chunk for real-time transcription.
- **Auth**: Token required
- **Body**: `{ audioChunk: "base64_audio_data" }`
- **Response**: `{ transcript: "partial transcript text" }`

#### POST /api/visits/:id/send-prescription-whatsapp
Send prescription via WhatsApp.
- **Auth**: Token required
- **Body**: `{ whatsappNumber }`

### 3.4 Clinical Data APIs

#### POST /api/medicines
Add medicine to visit.
- **Auth**: Token required
- **Body**: `{ visitId, name, dose?, frequency?, timing?, durationDays?, instructions? }`

#### PATCH /api/medicines/:id
Update medicine.
- **Auth**: Token required

#### DELETE /api/medicines/:id
Remove medicine.
- **Auth**: Token required

#### POST /api/medicines/:id/alternatives
Generate AI medicine alternatives.
- **Auth**: Token required
- **Response**: Array of alternative medicines with salt composition

#### POST /api/medicines/:id/swap-alternative
Replace medicine with alternative.
- **Auth**: Token required
- **Body**: `{ alternativeId }`

#### POST /api/tests
Add test to visit.
- **Auth**: Token required
- **Body**: `{ visitId, name, urgency?, whenToDo?, fastingRequired? }`

#### POST /api/tests/:id/report
Upload lab report.
- **Auth**: Token required
- **Body**: `{ reportBase64 }`

#### POST /api/tests/:id/extract-values
AI extraction of lab report values.
- **Auth**: Token required
- **Response**: `{ reportValues: {...}, abnormalMarkers: [...] }`

#### POST /api/followups
Add follow-up to visit.
- **Auth**: Token required
- **Body**: `{ visitId, followupAfterDays?, followupDate?, warningSigns?, notes? }`

#### POST /api/adherence
Log medicine adherence.
- **Auth**: Token required
- **Body**: `{ visitId, patientId, medicineId, dayNumber, status, notes? }`

#### POST /api/translate-terms
Translate medical terms.
- **Auth**: Token required
- **Body**: `{ terms: ["Twice daily", "After food"], language: "Hindi" }`
- **Response**: `{ translations: { "Twice daily": "दिन में दो बार", "After food": "खाने के बाद" } }`

### 3.5 Admin APIs

#### GET /api/admin/stats
Get platform statistics.
- **Auth**: Admin required
- **Response**: `{ totalDoctors, pendingDoctors, totalPatients, totalVisits, todayVisits }`

#### GET /api/admin/analytics
Get detailed analytics.
- **Auth**: Admin required
- **Response**: `{ activeSubscriptions, trialAccounts, monthlyRevenue, aiMinutesUsed }`

#### GET /api/admin/analytics/details/:type
Get drill-down data for specific metric.
- **Auth**: Admin required
- **Params**: type = "active-subscriptions" | "trial-accounts" | "monthly-revenue" | "ai-minutes"
- **Response**: Array of doctor-level detail objects

#### GET /api/admin/doctors
List all registered doctors.
- **Auth**: Admin required
- **Response**: Array of doctor objects with subscription info

#### POST /api/admin/doctors/:id/approve
Approve pending doctor registration.
- **Auth**: Admin required (Operations or Super Admin)
- **Side Effects**: Creates audit log, updates user status to "approved"

#### POST /api/admin/doctors/:id/reject
Reject doctor registration.
- **Auth**: Admin required

#### GET /api/admin/upgrade-requests
List all upgrade requests.
- **Auth**: Admin required
- **Response**: Array of upgrade request objects with doctor and plan details

#### POST /api/admin/upgrade-requests/:id/approve
Approve plan upgrade.
- **Auth**: Admin required
- **Side Effects**: Creates/updates subscription, creates audit log

#### POST /api/admin/upgrade-requests/:id/reject
Reject plan upgrade.
- **Auth**: Admin required

#### CRUD /api/admin/subscription-plans
Full CRUD for subscription plans.
- GET (list), GET /:id (detail), POST (create), PUT /:id (update), DELETE /:id
- POST /:id/clone, POST /:id/activate, POST /:id/deactivate

#### CRUD /api/admin/coupons
Full CRUD for discount coupons.
- GET (list), POST (create), PUT /:id (update), DELETE /:id
- POST /validate (validate coupon code)

#### GET /api/admin/doctor-subscriptions
List all doctor subscriptions.
- **Auth**: Admin required

#### POST /api/admin/doctor-subscriptions
Create/modify doctor subscription.
- **Auth**: Admin required

#### GET /api/admin/audit-logs
View admin audit trail.
- **Auth**: Admin required

#### GET /api/admin/whatsapp-status
Check WhatsApp integration health.
- **Auth**: Admin required
- **Response**: Today's stats, failed messages, retry counts

#### CRUD /api/admin/admins
Manage admin accounts.
- GET (list), POST (create), PUT /:id/role (update role), DELETE /:id

### 3.6 Integration APIs

#### GET /api/webhooks/whatsapp
WhatsApp webhook verification (Meta challenge).
- **Auth**: Public
- **Query**: `hub.mode`, `hub.verify_token`, `hub.challenge`

#### POST /api/webhooks/whatsapp
Inbound WhatsApp message/status handler.
- **Auth**: Public (Meta webhook)
- **Handles**: Delivery receipts, patient responses

#### POST /api/scan-aadhaar
Extract patient data from Aadhaar card image.
- **Auth**: Token required
- **Body**: `{ imageBase64 }`
- **Response**: `{ name, age, gender, address }`

---

## 4. Tech Stack Details

### 4.1 Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.x | UI component framework |
| Vite | 5.x | Build tool, dev server, HMR |
| TypeScript | 5.x | Static type safety |
| Tailwind CSS | 4.x | Utility-first CSS framework |
| shadcn/ui | Latest | Pre-built accessible UI components (50+) |
| wouter | Latest | Lightweight client-side routing |
| TanStack Query | 5.x | Server state management, caching, refetching |
| Lucide React | Latest | Icon library (200+ icons used) |
| WebSocket API | Native | Real-time server notifications |
| MediaRecorder API | Native | Browser audio recording |

### 4.2 Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20.x | JavaScript runtime |
| Express.js | 4.x | HTTP server framework |
| TypeScript | 5.x | Type-safe server code |
| Drizzle ORM | Latest | Type-safe SQL ORM for PostgreSQL |
| drizzle-zod | Latest | Auto-generate Zod schemas from Drizzle tables |
| bcrypt | Latest | Password hashing (10 rounds) |
| nodemailer | Latest | Email sending via Gmail SMTP |
| ws | Latest | WebSocket server for real-time events |
| openai | Latest | GPT-4o and Whisper API client |
| multer | Latest | File upload handling |
| cors | Latest | Cross-origin resource sharing |

### 4.3 Database
| Detail | Value |
|--------|-------|
| Engine | PostgreSQL 15+ |
| Hosting | Replit Helium (managed instance) |
| Tables | 30 tables |
| ORM | Drizzle ORM (PostgreSQL dialect) |
| Schema Definition | `shared/schema.ts` |
| Schema Sync | `drizzle-kit push` (schema-first, no manual migrations) |
| Connection | SSL disabled (internal network) |

### 4.4 External Services
| Service | Provider | Purpose | Auth Method |
|---------|----------|---------|-------------|
| GPT-4o | OpenAI | Clinical extraction, translation, OCR, news, alternatives | API Key via Replit AI Integrations |
| Whisper | OpenAI | Audio transcription | API Key via Replit AI Integrations |
| WhatsApp Cloud API | Meta | Patient messaging, reminders | Bearer token (WHATSAPP_ACCESS_TOKEN) |
| Gmail SMTP | Google | OTP password recovery emails | App Password (GMAIL_APP_PASSWORD) |
| Replit Deployments | Replit | Production hosting (autoscale) | Platform-managed |
