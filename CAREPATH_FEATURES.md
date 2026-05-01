# CarePath AI — Complete Feature Documentation

**Version**: 1.0  
**Last Updated**: April 2026  
**Production Domain**: carepath.in  
**Currency**: INR (₹)

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Authentication & Access Control](#2-authentication--access-control)
3. [Doctor Portal](#3-doctor-portal)
   - [Dashboard](#31-dashboard)
   - [Patient Visit Flow](#32-patient-visit-flow)
   - [Active Care Management](#33-active-care-management)
   - [Patient Portal](#34-patient-portal)
   - [Adherence Tracking](#35-adherence-tracking)
   - [Calendar](#36-calendar)
   - [Telehealth](#37-telehealth)
   - [Reports](#38-reports)
   - [Medical News Feed](#39-medical-news-feed)
   - [Dr Voice Store](#310-dr-voice-store)
   - [Search](#311-search)
   - [Doctor Profile](#312-doctor-profile)
   - [Subscription & Upgrade](#313-subscription--upgrade)
4. [QR Code Patient Self-Registration](#4-qr-code-patient-self-registration)
5. [AI-Powered Features](#5-ai-powered-features)
6. [WhatsApp Integration](#6-whatsapp-integration)
7. [Admin Portal](#7-admin-portal)
   - [Admin Dashboard](#71-admin-dashboard)
   - [Doctor Management](#72-doctor-management)
   - [Doctor-wise Data](#73-doctor-wise-data)
   - [Subscription Plan Management](#74-subscription-plan-management)
   - [Doctor Subscriptions](#75-doctor-subscriptions)
   - [Billing & Invoices](#76-billing--invoices)
   - [Audit Log](#77-audit-log)
   - [Admin Roles & Permissions](#78-admin-roles--permissions)
8. [SaaS & Subscription System](#8-saas--subscription-system)
9. [Multi-Language Support](#9-multi-language-support)
10. [Technical Architecture](#10-technical-architecture)
11. [Database Schema](#11-database-schema)
12. [API Reference](#12-api-reference)

---

## 1. Platform Overview

CarePath AI is a multi-doctor care plan execution platform designed for Indian healthcare practices. It enables doctors to conduct patient visits with AI-powered audio recording, clinical data extraction, and structured care plan generation. The platform supports a full SaaS model with tiered subscriptions, admin management, and WhatsApp-based patient communication.

**Key Value Propositions**:
- Reduce consultation documentation time by 70% with AI transcription
- Improve patient adherence through automated WhatsApp follow-ups
- Streamline clinic operations with QR-based patient self-registration
- Support 14 Indian languages for diverse patient populations
- Complete SaaS infrastructure for scaling across multiple clinics

---

## 2. Authentication & Access Control

### Registration & Login
- **Doctor Registration**: Doctors register with name, email, password, phone, license number, specialization, and experience. Registration is held in "pending" status until admin approval.
- **Admin Login**: Admin users have a separate role with granular permission-based access.
- **Password Security**: Passwords are hashed using bcrypt.
- **Session Management**: Token-based authentication stored in browser `sessionStorage`.

### Password Recovery
- **Forgot Password**: Sends a time-limited reset token to the doctor's registered email.
- **Reset Password**: Uses the token to set a new password securely.
- **Email Service**: Sent via Gmail SMTP (support.carepath@gmail.com).

### Role-Based Access
| Role | Access Level |
|------|-------------|
| **Doctor** (pending) | Login only, cannot access features until approved |
| **Doctor** (approved) | Full doctor portal access based on subscription plan |
| **Doctor** (rejected) | Account rejected, cannot access |
| **Admin** | Admin portal access based on assigned permissions |

---

## 3. Doctor Portal

### 3.1 Dashboard

The doctor dashboard provides a real-time overview of clinical activity.

**Stat Cards** (all clickable with navigation):
| Card | Data | Navigates To |
|------|------|-------------|
| Total Patients Today | Patients seen today | Patient Visit page |
| Active Care Plans | Running care plans | Active Care → Active tab |
| Pending Reviews | Care plans needing review | Active Care → Pending tab |
| Upcoming Patient | Queue / upcoming patients | Active Care → Upcoming tab |

**Performance Metrics** (clickable → Adherence page):
- **Medicine Adherence**: Percentage of patients following prescriptions
- **Follow-up Completion**: Percentage of scheduled follow-ups completed
- **Reduced Repeat OPD**: Patients managed without repeat visits

**Additional Dashboard Features**:
- Recent visits list with patient details, dates, and status
- QR code display for patient self-registration
- Copy link and download QR code options
- "New Patient Visit" quick-start button
- Real-time data refresh (1-second polling)

### 3.2 Patient Visit Flow

The core clinical workflow follows this sequence:

#### Step 1: Start Visit
- **Direct Consultation**: Click "Start Consultation" on dashboard → auto-creates visit and goes directly to recording page
- **New Visit**: Select existing patient or create new patient → proceeds to visit

#### Step 2: Audio Recording
- Real-time audio recording during consultation
- Supports pause/resume
- Audio stored as base64 for processing
- Visual waveform display during recording

#### Step 3: AI Transcription & Extraction
- Audio transcribed using OpenAI Whisper (gpt-4o-mini-transcribe)
- GPT-4o extracts structured clinical data:
  - **Symptoms**: Chief complaints with severity and duration
  - **Diagnosis**: Primary and differential diagnoses
  - **Vitals**: Blood pressure, temperature, pulse, SpO2, weight
  - **Medicines**: Drug name, dosage, frequency, timing, duration, instructions
  - **Lab Tests**: Test name, urgency, fasting requirements
  - **Follow-ups**: Next visit date, instructions, warning signs
- Multi-language support — doctor can speak in any Indian language

#### Step 4: Review & Edit
- Doctor reviews AI-extracted data
- Can edit any extracted field manually
- Add/remove medicines, tests, follow-ups

#### Step 5: Care Plan Generation
- Structured care plan created from visit data
- Prescription PDF generation
- Share via WhatsApp or shareable link
- Prescription risk checks (drug interactions, dosage alerts)

#### Medicine Alternatives
- AI suggests generic/alternative medicines for each prescription
- Shows price comparisons and availability
- Doctor can swap alternatives with one click

#### Lab Report Analysis
- Upload lab report images
- AI extracts test values and provides interpretation
- Flags abnormal results with clinical significance

### 3.3 Active Care Management

Three tabs accessible via `/active-care` (supports `?tab=active|pending|upcoming`):

| Tab | Description |
|-----|-------------|
| **Active Care Plans** | All visits with active care plans. Shows patient name, date, age, status. |
| **Pending Review** | Care plans requiring doctor review or approval. |
| **Upcoming Patients** | Patients in the queue (from QR check-in). Includes complete/start actions. |

### 3.4 Patient Portal

Complete patient management:
- Patient listing with search and filters
- Patient profile with full medical history
- Visit history per patient
- Medical history editing (conditions, allergies, medications, surgeries, family history)
- Patient demographic details (name, age, gender, phone, blood group, weight, height)

### 3.5 Adherence Tracking

- Track medicine adherence per patient per visit
- Daily status tracking: taken, missed, pending
- Adherence percentage calculations
- Visit-level and patient-level adherence views
- Gated by subscription plan feature flag

### 3.6 Calendar

- Visual calendar showing appointments and follow-ups
- Follow-up reminders and scheduling
- Day/week/month views

### 3.7 Telehealth

- Video consultation support
- Integration with telehealth workflows

### 3.8 Reports

- Clinical reports and analytics
- Practice performance metrics
- Patient outcome tracking
- Report generation based on subscription tier (basic/advanced)

### 3.9 Medical News Feed

- AI-generated medical news articles
- Category-based filtering
- Title, summary, and full content views
- Auto-generation on demand

### 3.10 Dr Voice Store

- Upload voice samples for speaker diarization
- Voice sample management (add/delete)
- Status tracking for voice training
- Enables doctor/patient speaker separation in transcripts

### 3.11 Search

- Full-text search across patients and visits
- Search by patient name, phone, conditions
- Quick access to patient records from search results

### 3.12 Doctor Profile

- Edit personal and professional details
- Profile photo upload/delete (base64)
- License number and specialization management
- View current subscription plan details

### 3.13 Subscription & Upgrade

- View current plan features and limits
- Compare available plans
- Submit upgrade requests (requires admin approval)
- Track upgrade request status

---

## 4. QR Code Patient Self-Registration

### Overview
Each doctor gets a unique QR code. Patients scan it on their phone to self-register and check in for their appointment — no app download required.

### Flow
1. **Patient scans QR code** → Opens `/qr/:doctorId` in browser
2. **Language selection** → Choose from 14 Indian languages
3. **Registration method**:
   - **New Patient**: Enter details manually or use Voice AI
   - **Returning Patient**: Search by phone number
4. **Voice AI Registration** (optional):
   - Patient taps mic and speaks their details naturally in any language
   - AI transcribes and extracts: name, age, gender, phone, blood group, weight, height, conditions, allergies, medications, surgeries, family history, lifestyle, pregnancy status
   - Comprehensive voice prompt examples guide patients in all 14 languages
5. **Medical History Form**: Fill or review extracted medical history
6. **Queue Submission**: Patient added to doctor's real-time queue
7. **Confirmation**: Patient sees check-in confirmation with queue status

### Voice AI Example Prompts
Each language includes a comprehensive example showing patients what to say:
> "My name is Priya Sharma, I am 28 years old, female. My number is 9876543210. Blood group B positive, weight 55 kg, height 5 feet 4 inches. I have dust allergy and diabetes. I take Metformin daily. No surgeries. My father has BP. I am vegetarian, non-smoker."

### Real-time Queue
- Doctor dashboard shows queue in real-time via WebSocket
- Queue entries include patient details and medical history
- Doctor can start consultation directly from queue

---

## 5. AI-Powered Features

| Feature | Model | Description |
|---------|-------|-------------|
| **Audio Transcription** | Whisper (gpt-4o-mini-transcribe) | Real-time speech-to-text in any Indian language |
| **Clinical Data Extraction** | GPT-4o | Extract symptoms, diagnosis, vitals, medicines, tests from transcript |
| **Care Plan Generation** | GPT-4o | Structured care plan from visit data |
| **Prescription Risk Check** | GPT-4o | Drug interaction warnings, dosage alerts |
| **Medicine Alternatives** | GPT-4o | Generic/alternative medicine suggestions with pricing |
| **Lab Report Analysis** | GPT-4o | Extract values from lab report images, flag abnormals |
| **Patient Voice Registration** | Whisper + GPT-4o | Extract patient details from spoken voice in any language |
| **Speaker Diarization** | GPT-4o | Separate doctor/patient speech in visit recordings |
| **Multi-language Translation** | GPT-4o | Translate clinical terms between languages |
| **Medical News Generation** | GPT-4o | Generate relevant medical news articles |
| **Aadhaar OCR** | GPT-4o | Extract identity details from Aadhaar card images |
| **Transliteration** | GPT-4o | Convert regional language names to English for doctor display |

### AI Minutes Tracking
- Each AI operation consumes "AI minutes"
- Usage tracked per doctor in `ai_usage_logs` table
- Monthly limits based on subscription plan
- Admin can monitor usage across all doctors

---

## 6. WhatsApp Integration

### Patient Communication
- **Prescription Delivery**: Send prescription PDFs to patients via WhatsApp
- **Follow-up Reminders**: Automated reminders before follow-up dates
- **Medicine Reminders**: Daily reminders for medicine schedules
- **Care Events**: Scheduled WhatsApp messages for care plan events

### Technical Details
- Uses WhatsApp Cloud API
- Webhook verification and message handling
- Message delivery status tracking
- Incoming message processing for patient responses
- All messages logged in `whatsapp_message_logs` table

---

## 7. Admin Portal

### 7.1 Admin Dashboard

**Overview Stats** (clickable cards):
| Card | Navigates To |
|------|-------------|
| Total Doctors | Doctor Management |
| Active Doctors | Doctor Management |
| Total Patients | Doctor-wise Data |
| Total Visits | Doctor-wise Data |

**SaaS Analytics** (expandable detail views):
- Active Subscriptions with breakdown
- Trial Accounts tracking
- Monthly Recurring Revenue (MRR)
- AI Minutes consumption (monthly + daily)

**Pending Approvals Section**:
- Shows doctors awaiting approval with quick approve/reject actions

### 7.2 Doctor Management

- View all registered doctors with status filters (all, pending, approved, rejected)
- Doctor profile details: name, email, phone, license, specialization, experience
- **Approve/Reject** doctor registrations
- Rejection with reason (communicated to doctor)
- Doctor status badges (PENDING, ACTIVE, REJECTED)

### 7.3 Doctor-wise Data

- Select any doctor to view their data
- **Doctor Stats**: Total patients, total visits, today's visits
- **Patient List**: All patients under selected doctor with visit counts
- **Visit Drill-down**: View individual visit details for any patient
- Complete visit data: transcript, medicines, tests, follow-ups, care plan

### 7.4 Subscription Plan Management

Full CRUD for subscription plans:
- **Plan Fields**: Name, description, monthly/annual pricing, trial days, AI minutes limit
- **Feature Configuration**: Toggle features per plan (adherence tracking, reports level, telehealth, WhatsApp automation, etc.)
- **Clone Plans**: Duplicate existing plans as templates
- **Regional Pricing**: Set price multipliers per region

### 7.5 Doctor Subscriptions

- View all active doctor subscriptions
- Subscription details: plan, billing cycle, start date, status
- Upgrade request management (approve/reject)
- Discount and coupon application tracking

### 7.6 Billing & Invoices

- **Invoice Generation**: Generate invoices per doctor or bulk for all doctors
- **Invoice Details**: Line items, taxes (GST), discounts, total
- **PDF Download**: Generate and download invoice PDFs
- **Status Management**: Mark invoices as paid, pending, overdue, cancelled
- **Coupon Management**:
  - Create/edit/delete discount coupons
  - Coupon types: percentage or flat discount
  - Usage limits and expiry dates
  - Coupon validation

### 7.7 Audit Log

- Comprehensive logging of all admin actions
- Action types: LOGIN, APPROVE, REJECT, CREATE, UPDATE, DELETE
- Target tracking: which entity was affected
- Timestamp and admin user tracking
- Filterable and searchable

### 7.8 Admin Roles & Permissions

Granular permission system:

| Permission | Controls |
|-----------|----------|
| `admin.stats` | Dashboard & analytics access |
| `admin.doctors` | Doctor approve/reject actions |
| `admin.doctors.view` | View doctor list and profiles |
| `admin.subscription_plans` | Manage subscription plans |
| `admin.doctor_subscriptions` | Manage doctor subscriptions |
| `admin.billing` | Invoice and billing management |
| `admin.coupons` | Coupon management |
| `admin.audit_logs` | View audit logs |
| `admin.whatsapp` | WhatsApp automation settings |
| `admin.ai_usage` | Monitor AI usage |
| `admin.roles` | Manage admin users and permissions |

- Create new admin users
- Assign/modify roles and permissions
- Delete admin accounts (cannot delete self)

---

## 8. SaaS & Subscription System

### Plans

| Plan | Monthly Price | Annual Price | Target |
|------|--------------|-------------|--------|
| **Starter** | ₹1,499 | ₹14,990 | Individual practitioners |
| **Professional** | ₹3,999 | ₹39,990 | Growing practices |
| **Clinic Pro** | ₹8,999 | ₹89,990 | Multi-doctor clinics |
| **Enterprise** | Custom | Custom | Hospital chains |

### Trial System
- 7-day free trial on registration
- Trial includes limited AI minutes
- Auto-prompts for upgrade after trial
- Trial status tracked per doctor

### Feature Gating
Features are gated per subscription plan:
- Adherence tracking
- Report levels (basic/advanced)
- Telehealth
- WhatsApp automation
- Identity verification (Aadhaar)
- Lab report analysis
- Medicine alternatives
- AI minutes allocation

### Upgrade Flow
1. Doctor views plan comparison on Upgrade Plan page
2. Submits upgrade request with target plan
3. Admin reviews request in Doctor Subscriptions
4. Admin approves/rejects with optional notes
5. On approval, doctor's plan and features are updated

---

## 9. Multi-Language Support

### Supported Languages (14)
| Language | Script | Code |
|----------|--------|------|
| English | Latin | `en` |
| Hindi | Devanagari | `hi` |
| Marathi | Devanagari | `mr` |
| Tamil | Tamil | `ta` |
| Telugu | Telugu | `te` |
| Kannada | Kannada | `kn` |
| Malayalam | Malayalam | `ml` |
| Bengali | Bengali | `bn` |
| Gujarati | Gujarati | `gu` |
| Punjabi | Gurmukhi | `pa` |
| Urdu | Arabic | `ur` |
| Odia | Odia | `od` |
| Assamese | Bengali | `as` |
| Konkani | Devanagari | `ko` |

### Language Usage
- **QR Check-in**: Full UI translation in all 14 languages
- **Voice AI**: Patients can speak in any language; AI transcribes and extracts
- **Visit Transcription**: Doctor can speak in any language during consultation
- **Clinical Translation**: AI translates clinical terms between languages
- **Transliteration**: Regional names auto-converted to English for doctor display
- **Doctor Dashboard**: Always displays patient info in English (auto-translated)

---

## 10. Technical Architecture

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| Routing | wouter |
| Data Fetching | TanStack Query (React Query) |
| Backend | Express.js, TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| AI | OpenAI GPT-4o, Whisper |
| Real-time | WebSocket (ws) |
| Auth | bcrypt + session tokens |
| Email | Nodemailer (Gmail SMTP) |
| Messaging | WhatsApp Cloud API |

### Key Configuration
- **Startup**: `bash start.sh` → `npx tsx server/index.ts`
- **Port**: 5000 (Express serves both API and static frontend)
- **WebSocket**: Integrated with Express HTTP server
- **Session Storage Key**: `"session_token"`

### Project Structure
```
├── client/
│   ├── src/
│   │   ├── pages/          # All page components
│   │   ├── components/     # Reusable UI components
│   │   ├── lib/            # Utilities, translations, query client
│   │   └── hooks/          # Custom React hooks
│   └── index.html
├── server/
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # All API routes
│   ├── storage.ts          # Database operations (Drizzle)
│   ├── ai-medical.ts       # AI integration functions
│   └── whatsapp.ts         # WhatsApp API integration
├── shared/
│   └── schema.ts           # Drizzle ORM schema (all tables)
└── start.sh                # Startup script
```

---

## 11. Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Doctor and admin accounts with profile, credentials, status |
| `sessions` | Authentication sessions with tokens and expiry |
| `patients` | Patient demographics, contact info, medical history |
| `visits` | Clinical visits linking patients to doctors with AI data |
| `medicines` | Prescribed medications per visit |
| `tests` | Recommended lab tests per visit |
| `followups` | Follow-up instructions and dates |

### Clinical Intelligence

| Table | Purpose |
|-------|---------|
| `voice_samples` | Doctor voice recordings for diarization training |
| `diarized_transcripts` | Speaker-separated transcripts (doctor vs patient) |
| `prescription_risk_checks` | AI drug interaction and risk assessments |
| `medicine_alternatives` | Generic/alternative medicine suggestions |
| `medicine_reference` | Master medicine database with compositions |
| `medical_news` | AI-generated medical articles |

### Communication & Tracking

| Table | Purpose |
|-------|---------|
| `care_events` | Scheduled care events (reminders, follow-ups) |
| `adherence_logs` | Daily medicine adherence tracking |
| `whatsapp_message_logs` | WhatsApp message history and delivery status |
| `share_tokens` | Secure tokens for sharing prescriptions/visits |
| `conversations` | Chat threads |
| `messages` | Individual chat messages |

### SaaS & Billing

| Table | Purpose |
|-------|---------|
| `subscription_plans` | Plan definitions with pricing |
| `plan_features` | Feature flags per plan |
| `regional_pricing` | Price multipliers by region |
| `doctor_subscriptions` | Active subscriptions per doctor |
| `ai_usage_logs` | AI minutes consumption tracking |
| `invoices` | Billing invoices |
| `invoice_line_items` | Invoice line items |
| `coupons` | Discount codes |
| `upgrade_requests` | Plan upgrade requests |

### Administration

| Table | Purpose |
|-------|---------|
| `admin_audit_logs` | Admin action audit trail |
| `password_reset_tokens` | Password reset tokens |

---

## 12. API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Doctor registration |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| POST | `/api/auth/profile/photo` | Upload profile photo |
| DELETE | `/api/auth/profile/photo` | Delete profile photo |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### Dashboard & Metrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard statistics |
| GET | `/api/dashboard/metrics` | Performance metrics |

### Patients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients` | List doctor's patients |
| GET | `/api/patients/:id` | Get patient details |
| POST | `/api/patients` | Create patient |
| PATCH | `/api/patients/:id` | Update patient |
| GET | `/api/patients/:id/history` | Get medical history |
| PUT | `/api/patients/:id/history` | Update medical history |
| GET | `/api/patients/:id/details-english` | Get English-translated details |
| GET | `/api/patients/:id/first-visit-check` | Check if first visit |

### Visits
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/visits` | List visits |
| GET | `/api/visits/:id` | Get visit details |
| POST | `/api/visits` | Create visit |
| PATCH | `/api/visits/:id` | Update visit |
| POST | `/api/visits/:id/transcribe` | Transcribe visit audio |
| POST | `/api/visits/:id/extract` | AI extract clinical data |
| POST | `/api/visits/:id/share` | Generate share link |
| GET | `/api/visits/:id/prescription.pdf` | Download prescription PDF |
| POST | `/api/visits/:id/send-prescription-whatsapp` | Send prescription via WhatsApp |
| POST | `/api/visits/:id/diarize` | Run speaker diarization |
| GET | `/api/visits/:id/diarized-transcript` | Get diarized transcript |

### Medicines & Alternatives
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/medicines/:id/alternatives` | Generate alternative suggestions |
| GET | `/api/visits/:id/alternatives` | Get visit medicine alternatives |
| POST | `/api/medicines/:id/swap-alternative` | Swap to alternative medicine |
| GET | `/api/medicine-reference/search` | Search medicine database |
| GET | `/api/medicine-reference/names` | Get medicine name suggestions |

### AI Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scan-aadhaar` | OCR Aadhaar card image |
| POST | `/api/translate-terms` | Translate clinical terms |
| POST | `/api/translate` | General translation |

### Adherence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/adherence/patient/:patientId` | Patient adherence data |
| GET | `/api/adherence/visit/:visitId` | Visit adherence data |
| POST | `/api/adherence` | Log adherence entry |

### Reports & News
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports` | Generate reports |
| GET | `/api/news` | Get medical news |
| POST | `/api/news/generate` | Generate new articles |

### Voice Store
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/voice-samples` | List voice samples |
| POST | `/api/voice-samples` | Upload voice sample |
| DELETE | `/api/voice-samples/:id` | Delete voice sample |
| GET | `/api/voice-samples/status` | Check diarization readiness |

### QR Check-in (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/qr/doctor/:id` | Get doctor info for QR page |
| POST | `/api/qr/voice-extract` | Extract patient data from voice |
| POST | `/api/qr/queue` | Add patient to queue |
| GET | `/api/qr/search/:doctorId` | Search returning patients |

### Subscriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription-plans/public` | List available plans |
| GET | `/api/my-plan-features` | Get current plan features |
| POST | `/api/upgrade-request` | Submit upgrade request |
| GET | `/api/my-upgrade-requests` | View upgrade request history |

### Admin APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/analytics` | SaaS analytics |
| GET | `/api/admin/analytics/details/:type` | Detailed analytics |
| GET | `/api/admin/doctors` | List all doctors |
| GET | `/api/admin/doctors/:id` | Get doctor details |
| POST | `/api/admin/doctors/:id/approve` | Approve doctor |
| POST | `/api/admin/doctors/:id/reject` | Reject doctor |
| GET | `/api/admin/doctors/:id/patients` | Doctor's patients |
| GET | `/api/admin/patients/:id/visits` | Patient's visits |
| GET | `/api/admin/audit-logs` | Audit log entries |
| GET | `/api/admin/subscription-plans` | List plans |
| POST | `/api/admin/subscription-plans` | Create plan |
| PUT | `/api/admin/subscription-plans/:id` | Update plan |
| POST | `/api/admin/subscription-plans/:id/clone` | Clone plan |
| GET | `/api/admin/invoices` | List invoices |
| POST | `/api/admin/invoices/generate` | Generate invoice |
| POST | `/api/admin/invoices/generate-all` | Bulk generate invoices |
| GET | `/api/admin/invoices/:id/pdf` | Download invoice PDF |
| PUT | `/api/admin/invoices/:id/status` | Update invoice status |
| GET | `/api/admin/coupons` | List coupons |
| POST | `/api/admin/coupons` | Create coupon |
| PUT | `/api/admin/coupons/:id` | Update coupon |
| DELETE | `/api/admin/coupons/:id` | Delete coupon |
| POST | `/api/admin/coupons/validate` | Validate coupon code |
| GET | `/api/admin/admins` | List admin users |
| POST | `/api/admin/admins` | Create admin user |
| PUT | `/api/admin/admins/:id/role` | Update admin permissions |
| DELETE | `/api/admin/admins/:id` | Delete admin user |
| GET | `/api/admin/permissions` | Get current admin permissions |
| GET | `/api/admin/upgrade-requests` | List upgrade requests |
| POST | `/api/admin/upgrade-requests/:id/approve` | Approve upgrade |
| POST | `/api/admin/upgrade-requests/:id/reject` | Reject upgrade |
| GET | `/api/admin/whatsapp-status` | WhatsApp integration status |
| GET | `/api/admin/ai-usage` | AI usage analytics |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/webhooks/whatsapp` | WhatsApp webhook verification |
| POST | `/api/webhooks/whatsapp` | WhatsApp incoming messages |

---

*This documentation covers all features of CarePath AI as of April 2026. For technical queries, refer to the codebase at the referenced file paths.*
