# CAREPATH AI — Complete Project Documentation

---

## Table of Contents

1. [Project Overview Document (POD)](#1-project-overview-document-pod)
2. [Business Requirement Document (BRD)](#2-business-requirement-document-brd)
3. [Software Requirement Specification (SRS)](#3-software-requirement-specification-srs)
4. [UI/UX Documentation](#4-uiux-documentation)
5. [Technical Documentation](#5-technical-documentation)
6. [Development Documentation](#6-development-documentation)
7. [Testing Documentation](#7-testing-documentation)

---

# 1. Project Overview Document (POD)

## Project Name
**CarePath AI** — Multi-Doctor Care Plan Execution Platform

## Objective
Build a comprehensive medical care management system tailored for Indian healthcare practices that streamlines patient visits, automates care plan generation using AI, manages prescriptions, enables lab report analysis, sends WhatsApp follow-up reminders, and provides a full SaaS admin portal with subscription management.

## Scope

### Included
- Multi-doctor environment with role-based access (Doctor, Admin)
- AI-powered audio transcription (OpenAI Whisper) and clinical data extraction (GPT-4o)
- Multi-language support (14 Indian languages including English, Hindi, Marathi, Tamil, Telugu, etc.)
- Patient registration via QR code with Voice AI auto-fill
- Care plan generation, approval, and execution workflow
- Prescription management with medicine alternatives and autocomplete
- Lab report upload and AI analysis
- WhatsApp Cloud API integration for automated patient reminders
- Medicine adherence tracking
- SaaS subscription management with tiered pricing in INR
- Admin portal for doctor management, billing, analytics, and audit logging
- Printable/downloadable reports with branded footers
- Face-based biometric login using GPT-4o vision
- Speaker diarization for doctor-patient transcript separation
- Email-based password reset
- Real-time patient queue via WebSockets

### Excluded
- Video telehealth (page exists but not fully implemented)
- Native mobile applications
- Integration with government health registries (e.g., ABDM)
- Payment gateway integration (subscriptions managed manually by admin)

## Timeline
| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Core platform: Auth, patients, visits, AI extraction | Completed |
| Phase 2 | Care plans, prescriptions, WhatsApp automation | Completed |
| Phase 3 | SaaS admin portal, subscriptions, billing | Completed |
| Phase 4 | Advanced features: Face login, voice fill, diarization, lab reports | Completed |
| Phase 5 | Polish: Print reports, medicine autocomplete, UI refinements | Completed |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v4, shadcn/ui |
| Routing | wouter |
| Data Fetching | TanStack Query (React Query) |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL with Drizzle ORM |
| AI/ML | OpenAI GPT-4o (extraction, translation, vision), Whisper (transcription) |
| Real-time | WebSocket (ws library) |
| Messaging | WhatsApp Cloud API (Meta Business) |
| Email | Nodemailer with Gmail SMTP |
| PDF | jsPDF (client-side generation) |
| Authentication | Token-based sessions with bcrypt password hashing |
| Hosting | Replit (development), carepath.in (production domain) |

---

# 2. Business Requirement Document (BRD)

## Client Requirements
1. Indian doctors need a digital platform to manage patient consultations efficiently
2. Support for multi-language patient interactions (14 Indian languages)
3. AI-assisted clinical data extraction from audio recordings to reduce manual entry
4. Automated patient follow-up reminders via WhatsApp
5. Prescription generation with drug alternatives and risk checking
6. SaaS model with tiered subscription plans priced in INR
7. Admin portal for platform-wide management and analytics
8. Patient self-registration via QR code scanning

## Business Goals
- Reduce doctor consultation documentation time by 70% through AI automation
- Improve patient adherence to prescribed medications via WhatsApp reminders
- Reduce OPD load through structured follow-up scheduling
- Enable scalable multi-doctor onboarding with subscription management
- Provide actionable practice analytics for doctors and platform admins

## User Types

### 1. Doctor (Primary User)
- Registers and awaits admin approval
- Manages patients, conducts visits with audio recording
- Reviews AI-generated care plans and approves them
- Views dashboard with performance metrics
- Accesses reports, adherence tracking, and calendar
- Manages profile, voice samples, and subscription

### 2. Admin (Platform Manager)
- Approves/rejects doctor registrations
- Manages subscription plans and pricing
- Monitors platform-wide analytics and WhatsApp delivery status
- Generates invoices and manages coupons
- Views audit logs for all administrative actions
- Manages admin roles and permissions

### 3. Patient (Passive User)
- Self-registers via QR code scan at doctor's clinic
- Receives WhatsApp reminders for medicines and follow-ups
- Responds to adherence check messages
- Views shared care plans via public share links

## Pain Points Addressed
| Pain Point | Solution |
|-----------|----------|
| Doctors spend too long on documentation | AI transcription and auto-extraction from audio |
| Patients forget to take medicines | Automated WhatsApp reminders with adherence tracking |
| Manual patient registration is slow | QR-based self-registration with Voice AI auto-fill |
| No standardized care plans | AI-generated structured care plans from consultation audio |
| Difficulty tracking practice performance | Dashboard analytics, reports, and adherence metrics |
| Language barriers with patients | Support for 14 Indian languages with AI translation |
| Prescription errors | Medicine alternatives, salt composition lookup, risk checks |

---

# 3. Software Requirement Specification (SRS)

## Functional Requirements

### FR-01: User Authentication & Authorization
- Token-based session authentication with bcrypt password hashing
- Role-based access control (doctor, admin, super_admin)
- Doctor registration requires admin approval
- Face-based biometric login using GPT-4o vision model
- Email-based password reset with OTP tokens
- Session tokens stored in `sessionStorage` under key `"session_token"`

### FR-02: Patient Management
- CRUD operations for patient records
- Medical history management (allergies, chronic diseases, medications, surgeries, etc.)
- Voice-based auto-fill for patient details and medical history
- Aadhaar card OCR for auto-filling name, age, and gender
- Patient search with full-text filtering
- QR-based patient self-registration

### FR-03: Visit Management
- Create new visits linked to patients
- Real-time audio recording with chunked upload
- AI transcription using OpenAI Whisper (gpt-4o-mini-transcribe)
- Speaker diarization (doctor vs. patient voice separation)
- AI extraction of clinical data: complaint, diagnosis, vitals, medicines, tests, follow-ups
- Multi-language transcription and translation support
- Visit status workflow: recording → draft → active → completed

### FR-04: Care Plan Generation
- AI-powered care plan generation from transcribed consultation audio
- Structured output: medicines, dosages, tests, follow-up schedules, warning signs
- Doctor review and approval workflow
- Patient-language translation of care plans
- Shareable care plan links with expiring tokens

### FR-05: Prescription Management
- AI-extracted prescription data with editable fields
- Medicine autocomplete from local database and OpenFDA API
- Generic/salt composition lookup
- Medicine alternative suggestions with selection
- Prescription risk checking
- PDF prescription generation and download

### FR-06: Lab Report Analysis
- Lab report file upload (images/PDFs)
- AI-powered analysis of lab report values
- Abnormal marker identification
- Integration with visit records

### FR-07: WhatsApp Automation
- Automated medicine reminders via WhatsApp Cloud API
- Follow-up appointment reminders
- Patient response tracking
- Delivery status monitoring (sent, delivered, read, failed)
- Retry logic with exponential backoff (max 3 retries)
- Rate limit handling

### FR-08: Adherence Tracking
- Daily medicine adherence logging
- Patient response tracking via WhatsApp
- Adherence metrics visualization
- Per-patient and per-medicine tracking

### FR-09: Reports & Analytics
- Daily, weekly, monthly, and custom date range reports
- Visit summary, prescription details, and patient statistics
- Printable reports with branded footer ("carepath.ai powered by Codelyne Technologies")
- Downloadable HTML reports
- Practice performance metrics (adherence rate, follow-up completion, OPD load reduction)

### FR-10: Dashboard
- Today's summary: total visits, active care plans, pending reviews, upcoming patients
- Interactive stat cards opening slide-in sidebars with detailed lists
- Performance metrics visualization
- Real-time patient queue with WebSocket updates
- Auto-refresh every 5 seconds

### FR-11: SaaS Subscription Management
- Tiered subscription plans (Starter, Professional, Clinic Pro, Enterprise)
- 7-day free trial with AI minutes limit
- Monthly and annual billing cycles
- Regional pricing multipliers
- Coupon/discount code support
- Upgrade request workflow (doctor requests → admin approves)
- Invoice generation with PDF download

### FR-12: Admin Portal
- Doctor registration approval/rejection
- Platform-wide analytics dashboard
- Subscription and billing management
- Plan CRUD operations
- Audit logging for all admin actions
- Admin role management with granular permissions
- WhatsApp delivery monitoring

### FR-13: Voice AI Features
- Voice sample recording for speaker diarization training
- Voice-based patient detail auto-fill
- Voice-based medical history auto-fill
- AI parsing of spoken medical history into structured form fields

## Non-Functional Requirements

### Performance
- API response time: < 100ms for standard queries (achieved: 2-50ms typical)
- Dashboard polling interval: 5 seconds
- Patient queue updates: Real-time via WebSocket
- AI processing: < 30 seconds for transcription and extraction
- Concurrent user support: Multiple doctors simultaneously

### Security
- Password hashing with bcrypt (salt rounds: 10)
- Token-based session authentication
- Role-based access control on all API endpoints
- Input validation with Zod schemas
- SQL injection prevention via Drizzle ORM parameterized queries
- CORS and origin validation
- Secrets managed via environment variables (never exposed in code)
- Session expiry after 7 days
- Face data stored securely, raw base64 stripped from API responses

### Scalability
- Database-driven architecture supporting horizontal scaling
- Stateless API design (sessions in database)
- Modular route and storage architecture
- SaaS multi-tenant design with per-doctor data isolation

### Reliability
- WhatsApp retry with exponential backoff (max 3 retries)
- Rate limit detection and automatic pause
- Graceful error handling with user-friendly messages
- Database transaction support for atomic operations
- Automatic admin user seeding on startup

### Usability
- Responsive design across all devices (mobile, tablet, desktop)
- Glass morphism UI theme with gradient icons
- Medical Blue color scheme (HSL 215 90% 45%) for trust and professionalism
- Plus Jakarta Sans font family
- Intuitive doctor-first workflow

## System Features Summary
| # | Feature | Status |
|---|---------|--------|
| 1 | User Authentication (Email + Face) | Active |
| 2 | Patient Management | Active |
| 3 | Visit Management with Audio | Active |
| 4 | AI Transcription & Extraction | Active |
| 5 | Care Plan Generation | Active |
| 6 | Prescription Management | Active |
| 7 | Medicine Autocomplete & Alternatives | Active |
| 8 | Lab Report Analysis | Active |
| 9 | WhatsApp Automation | Active |
| 10 | Adherence Tracking | Active |
| 11 | Reports & Print | Active |
| 12 | Dashboard & Analytics | Active |
| 13 | QR Patient Registration | Active |
| 14 | SaaS Subscriptions & Billing | Active |
| 15 | Admin Portal | Active |
| 16 | Voice AI Auto-Fill | Active |
| 17 | Speaker Diarization | Active |
| 18 | Medical News Feed | Active |
| 19 | Calendar & Follow-ups | Active |
| 20 | Telehealth | Planned |

## Use Cases

### UC-01: Doctor Conducts a Patient Visit
**Actor:** Doctor  
**Precondition:** Doctor is logged in and approved  
**Flow:**
1. Doctor navigates to "New Visit"
2. Selects existing patient or creates new one (optionally using Voice Fill or Aadhaar OCR)
3. Reviews/updates patient medical history (optionally using Voice Fill)
4. Starts audio recording of consultation
5. System transcribes audio in real-time using Whisper
6. Doctor stops recording
7. System extracts clinical data using GPT-4o (complaint, diagnosis, medicines, tests, follow-ups)
8. Doctor reviews AI-generated draft care plan
9. Doctor edits if needed, then approves
10. System generates care plan, schedules WhatsApp reminders, and creates follow-up events

### UC-02: Patient Self-Registration via QR
**Actor:** Patient  
**Precondition:** Doctor has QR code displayed in clinic  
**Flow:**
1. Patient scans QR code with phone
2. QR check-in page loads with doctor's info
3. Patient enters details (name, age, gender, WhatsApp number) or uses Voice AI
4. Patient is added to doctor's waiting queue
5. Doctor sees patient appear in real-time queue on dashboard

### UC-03: Admin Manages Doctor Registrations
**Actor:** Admin  
**Precondition:** Admin is logged in  
**Flow:**
1. Admin views pending doctor registrations
2. Reviews doctor credentials (license, specialization, experience)
3. Approves or rejects registration
4. Action is logged in audit trail
5. Approved doctor can now log in and use the platform

### UC-04: WhatsApp Medicine Reminder
**Actor:** System (automated)  
**Precondition:** Visit approved with medicines prescribed  
**Flow:**
1. System creates care events for each prescribed medicine
2. WhatsApp scheduler runs every minute
3. For pending events with scheduled time in past, system sends WhatsApp reminder
4. Patient receives message with medicine name and instructions
5. Patient replies (taken/skipped)
6. System logs adherence response
7. On failure, system retries up to 3 times with exponential backoff

### UC-05: Doctor Generates Practice Report
**Actor:** Doctor  
**Flow:**
1. Doctor navigates to Reports page
2. Selects period (daily/weekly/monthly/custom)
3. Selects date
4. System generates report with visit summaries, prescriptions, and statistics
5. Doctor can Print (opens browser print dialog) or Download as HTML
6. Printed report includes branded footer: "carepath.ai powered by Codelyne Technologies"

---

# 4. UI/UX Documentation

## Design System

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| Primary (Medical Blue) | HSL(215, 90%, 45%) / #0B6BCB | Headers, buttons, links, accents |
| Background | White with glass morphism overlays | Cards, panels |
| Text Primary | #1E293B (Slate 800) | Body text |
| Text Secondary | #64748B (Slate 500) | Muted text, labels |
| Success | #16A34A (Green 600) | Active status, approvals |
| Warning | #EAB308 (Yellow 500) | Draft status, alerts |
| Destructive | #EF4444 (Red 500) | Errors, stop recording, deletions |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Font Family | Plus Jakarta Sans | — | — |
| Headings (H1) | Plus Jakarta Sans | 22-28px | 700 (Bold) |
| Headings (H2) | Plus Jakarta Sans | 18-20px | 600 (Semibold) |
| Body | Plus Jakarta Sans | 14px | 400 (Regular) |
| Small/Labels | Plus Jakarta Sans | 11-12px | 500 (Medium) |

### Design Patterns
- **Glass Morphism**: Cards use `glass-card-strong` with translucent backgrounds and blur
- **Gradient Icons**: Navigation and feature icons use gradient fills
- **Animated Stat Cards**: Dashboard stats with hover animations
- **Slide-in Sidebars**: Dashboard stat cards open detail sidebars from the right
- **Badge System**: Status indicators (First Visit, On File, Active, Draft)
- **Rounded corners**: Consistent `rounded-xl` (12px) on cards and buttons

### Component Library
Built on **shadcn/ui** with custom styling:
- Button (variants: default, outline, destructive, ghost)
- Input, Textarea, Label
- Select, SelectContent, SelectItem
- Card, CardHeader, CardContent
- Badge
- Dialog, Sheet (sidebars)
- Tabs, TabsContent
- Separator
- Toast notifications

## User Flow

### Doctor Flow
```
Login/Face Login
    ↓
Dashboard (Stats, Queue, Recent Visits)
    ↓
New Visit → Select/Create Patient → Medical History → Audio Recording
    ↓
AI Extraction → Review Draft → Approve Care Plan
    ↓
Active Care → Monitor Adherence → Reports
```

### Admin Flow
```
Login
    ↓
Admin Dashboard (Platform Stats)
    ↓
├── Doctor Management (Approve/Reject)
├── Subscription Plans (CRUD)
├── Billing & Invoices
├── Analytics & Reports
├── Audit Logs
└── Admin Roles
```

### Patient Flow (via QR)
```
Scan QR Code
    ↓
Enter Details (Name, Age, Gender, WhatsApp)
    ↓
Join Waiting Queue
    ↓
Doctor Starts Visit
    ↓
Receive WhatsApp Reminders
    ↓
Respond to Adherence Checks
```

## Screens List

### Doctor Portal (15 screens)
| # | Screen | Route | Description |
|---|--------|-------|-------------|
| 1 | Dashboard | `/` | Stats cards, performance metrics, recent visits, QR code, patient queue |
| 2 | New Visit | `/new-visit` | Patient selection/creation, Aadhaar scan, Voice Fill |
| 3 | Active Visit | `/visit/:id` | Audio recording, transcription, AI extraction, care plan review |
| 4 | Active Care | `/active-care` | Active plans, pending reviews, upcoming patients (tabbed) |
| 5 | Patient Portal | `/patient-portal` | Patient list, search, history management |
| 6 | Calendar | `/calendar` | Appointment and follow-up calendar view |
| 7 | Adherence | `/adherence` | Medicine adherence tracking dashboard |
| 8 | Search | `/search` | Full-text patient and visit search |
| 9 | Reports | `/reports` | Daily/weekly/monthly practice reports with print/download |
| 10 | News Feed | `/news-feed` | AI-generated medical news personalized to specialization |
| 11 | Dr Voice Store | `/dr-voice-store` | Voice sample recording for speaker diarization |
| 12 | Profile | `/profile` | Doctor profile management, face registration |
| 13 | Upgrade Plan | `/upgrade-plan` | Subscription plan comparison and upgrade request |
| 14 | Telehealth | `/telehealth` | Video consultations (planned) |
| 15 | Login | `/login` | Email/password login with face login option |

### Admin Portal (8 screens)
| # | Screen | Route | Description |
|---|--------|-------|-------------|
| 1 | Admin Dashboard | `/admin` | Platform-wide stats with clickable cards |
| 2 | Doctor Management | `/admin/doctors` | Registration approvals, doctor list |
| 3 | Doctor-wise Data | `/admin/doctor-data` | Drill-down into individual doctor's patients/visits |
| 4 | Plan Management | `/admin/plans` | Subscription plan CRUD |
| 5 | Doctor Subscriptions | `/admin/subscriptions` | Active subscription tracking |
| 6 | Billing & Invoices | `/admin/billing` | Invoice generation, coupon management |
| 7 | Audit Log | `/admin/audit-log` | Administrative action tracking |
| 8 | Admin Roles | `/admin/roles` | Permission management |

### Public Pages (5 screens)
| # | Screen | Route | Description |
|---|--------|-------|-------------|
| 1 | QR Check-in | `/qr/:doctorId` | Patient self-registration |
| 2 | Register | `/register` | Doctor registration form |
| 3 | Forgot Password | `/forgot-password` | Password reset request |
| 4 | Reset Password | `/reset-password` | Password reset with OTP |
| 5 | Shared Care Plan | `/share/:token` | Public care plan view |

---

# 5. Technical Documentation

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                      │
│  React 18 + Vite + TypeScript + Tailwind v4 + shadcn/ui │
│  wouter (routing) + TanStack Query (data fetching)       │
│  WebSocket client (real-time queue)                      │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP REST + WebSocket
                         ▼
┌─────────────────────────────────────────────────────────┐
│                EXPRESS.JS SERVER (Node.js)                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  REST API    │  │  WebSocket   │  │  Schedulers    │  │
│  │  (routes.ts) │  │  Server      │  │  (WhatsApp,    │  │
│  │             │  │  (queue)     │  │   Billing)     │  │
│  └──────┬──────┘  └──────────────┘  └────────────────┘  │
│         │                                                │
│  ┌──────┴──────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Storage    │  │  AI Medical  │  │  WhatsApp      │  │
│  │  Interface  │  │  (GPT-4o,    │  │  Cloud API     │  │
│  │  (Drizzle)  │  │   Whisper)   │  │  Integration   │  │
│  └──────┬──────┘  └──────────────┘  └────────────────┘  │
└─────────┼───────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────────────┐
│    PostgreSQL DB     │     │   External Services      │
│  (28+ tables)        │     │  - OpenAI API            │
│  Drizzle ORM         │     │  - WhatsApp Cloud API    │
│                     │     │  - OpenFDA API            │
│                     │     │  - Gmail SMTP             │
└─────────────────────┘     └─────────────────────────┘
```

## Database Schema

### Entity Relationship Overview

```
users (doctors/admins)
  ├── sessions (auth tokens)
  ├── patients
  │     └── adherence_logs
  ├── visits
  │     ├── medicines
  │     │     ├── medicine_alternatives
  │     │     └── care_events
  │     │           └── whatsapp_message_logs
  │     ├── tests
  │     ├── followups
  │     ├── share_tokens
  │     ├── diarized_transcripts
  │     └── prescription_risk_checks
  ├── voice_samples
  ├── medical_news
  ├── doctor_subscriptions
  │     └── invoices
  │           └── invoice_line_items
  ├── upgrade_requests
  └── password_reset_tokens

subscription_plans (standalone)
  ├── plan_features
  └── doctor_subscriptions

coupons (standalone)
regional_pricing (standalone)
medicine_reference (standalone)
admin_audit_logs
conversations → messages
```

### Table Details

#### Core Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| **users** | id (UUID PK), name, email (unique), phone, passwordHash, role, status, specialization, licenseNumber, clinicName, clinicAddress, experience, qualifications, profilePhoto, adminRole, country, subscriptionId, selectedPlanId, faceData, createdAt | Doctors and administrators |
| **sessions** | id (UUID PK), userId (FK→users), token, createdAt, expiresAt | Authentication sessions |
| **patients** | id (UUID PK), name, age, gender, phone, whatsappNumber, knownConditions, allergies, pastIllnesses, chronicDiseases, currentMedications, familyHistory, lifestyleHabits, previousSurgeries, pregnancyStatus, bloodGroup, weight, height, doctorId (FK→users), createdAt | Patient records |
| **visits** | id (UUID PK), patientId (FK→patients), doctorId (FK→users), visitDate, language, audioPath, audioBase64, transcriptText, aiDraftJson, approved, approvedAt, status | Consultation records |

#### Clinical Data Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| **medicines** | id (UUID PK), visitId (FK→visits), name, dose, frequency, timing, durationDays, instructions, saltComposition, genericName, selectedAlternativeId | Prescribed medicines |
| **tests** | id (UUID PK), visitId (FK→visits), name, whenToDo, urgency, triggerCondition, fastingRequired, status, labName, reportBase64, reportValues, abnormalMarkers | Diagnostic tests |
| **followups** | id (UUID PK), visitId (FK→visits), followupAfterDays, followupDate, warningSigns (array), notes | Follow-up schedules |
| **medicine_alternatives** | id (UUID PK), medicineId (FK→medicines), visitId (FK→visits), alternativeName, saltComposition, genericName, manufacturer, priceEstimate, type, selected | Alternative medicine suggestions |

#### Care & Adherence Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| **care_events** | id (UUID PK), visitId, medicineId, eventType, scheduledTime, status, patientResponse, whatsappMessageId | Scheduled reminder events |
| **adherence_logs** | id (UUID PK), visitId, patientId, medicineId, dayNumber, status, loggedAt, notes | Medicine adherence tracking |
| **whatsapp_message_logs** | id (UUID PK), careEventId, visitId, patientId, medicineId, whatsappNumber, messagePayload, whatsappMessageId, status, retryCount, sentAt, deliveredAt, responseReceivedAt, patientResponse, errorMessage, createdAt | WhatsApp message tracking |

#### SaaS Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| **subscription_plans** | id (UUID PK), name, planType, monthlyPrice, annualPrice, currency, status, doctorsIncluded, maxDoctors, aiMinutesPerMonth, extraMinuteCost, languagesSupported, customLanguageSupport, aiCarePlanLevel, prescriptionChannels, calendarFeatures, reportsLevel, identityVerification, adherenceTracking, supportLevel, targetUser, isEnterprise, whiteLabel, customIntegrations, sortOrder, createdAt, updatedAt | Plan definitions |
| **plan_features** | id (UUID PK), planId (FK→subscription_plans), featureKey, featureName, featureCategory, enabled, limit, description, sortOrder | Granular plan features |
| **doctor_subscriptions** | id (UUID PK), doctorId (FK→users), planId (FK→subscription_plans), status, billingCycle, startDate, nextBillingDate, expiresAt, cancelledAt, regionCode, appliedMultiplier, finalMonthlyPrice, finalAnnualPrice, couponId, createdAt, updatedAt | Active subscriptions |
| **invoices** | id (UUID PK), doctorId, subscriptionId, invoiceNumber, subtotal, total, status, etc. | Billing records |
| **invoice_line_items** | id (UUID PK), invoiceId (FK→invoices), description, quantity, unitPrice, total, itemType | Invoice details |
| **coupons** | id (UUID PK), code (unique), discountType, discountValue, maxUses, currentUses, expiresAt, status, createdAt | Discount codes |
| **regional_pricing** | id (UUID PK), regionCode, regionName, currencyCode, multiplier, isActive | Regional price multipliers |
| **upgrade_requests** | id (UUID PK), doctorId, currentPlanId, requestedPlanId, status, createdAt | Plan upgrade requests |

#### Utility Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| **share_tokens** | id (UUID PK), visitId, token (unique), expiresAt, createdAt | Public care plan sharing |
| **voice_samples** | id (UUID PK), doctorId, questionId, audioBase64, duration, createdAt | Voice training data |
| **diarized_transcripts** | id (UUID PK), visitId, segments (JSON), createdAt | Speaker-separated transcripts |
| **prescription_risk_checks** | id (UUID PK), visitId, riskLevel, findings (JSON), checkedAt | AI risk analysis |
| **password_reset_tokens** | id (UUID PK), userId, token, expiresAt, used, createdAt | Password recovery |
| **admin_audit_logs** | id (UUID PK), adminId, action, targetType, targetId, details, createdAt | Admin action logging |
| **medical_news** | id (UUID PK), doctorId, title, summary, content, category, source, publishedAt, createdAt | News feed content |
| **medicine_reference** | id (UUID PK), name, genericName, saltComposition, manufacturer, category | Medicine master database |
| **conversations** | id (UUID PK), userId, title, createdAt, updatedAt | Chat/support threads |
| **messages** | id (UUID PK), conversationId (FK→conversations), role, content, createdAt | Chat messages |
| **ai_usage_logs** | id (UUID PK), doctorId, feature, tokensUsed, durationSeconds, model, createdAt | AI usage tracking |

## API Documentation

### Authentication APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register new doctor account |
| POST | `/api/auth/login` | Public | Login with email/password |
| POST | `/api/auth/face-login` | Public | Login with face biometrics |
| POST | `/api/auth/face-register` | Token | Register face for biometric login |
| POST | `/api/auth/voice-extract-doctor` | Public | Extract registration data from voice |
| POST | `/api/auth/logout` | Token | Invalidate session |
| POST | `/api/auth/forgot-password` | Public | Request password reset OTP |
| POST | `/api/auth/reset-password` | Public | Reset password with OTP |
| GET | `/api/auth/me` | Token | Get current user profile |
| PUT | `/api/auth/profile` | Token | Update profile |
| POST | `/api/auth/profile/photo` | Token | Upload profile photo |
| DELETE | `/api/auth/profile/photo` | Token | Remove profile photo |

### Doctor APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard summary stats |
| GET | `/api/dashboard/metrics` | Performance metrics |
| GET | `/api/patients` | List/search patients |
| POST | `/api/patients` | Create patient |
| GET | `/api/patients/:id/history` | Get patient medical history |
| PUT | `/api/patients/:id/history` | Update patient medical history |
| GET | `/api/patients/:id/details-english` | Get patient details in English |
| GET | `/api/visits` | List visits |
| POST | `/api/visits` | Create new visit |
| GET | `/api/visits/:id` | Get visit details with medicines, tests, followups |
| POST | `/api/visits/:id/finalize` | AI extraction from audio |
| POST | `/api/visits/:id/approve` | Approve care plan |
| POST | `/api/visits/:id/chunk` | Upload audio chunk |
| POST | `/api/visits/:id/diarize` | Speaker diarization |
| GET | `/api/visits/:id/prescription/pdf` | Generate prescription PDF |
| GET | `/api/reports` | Generate practice reports |
| GET | `/api/patient-queue` | Get live patient queue |
| PATCH | `/api/patient-queue/:id/status` | Update queue status |
| POST | `/api/ai/parse-medical-history` | AI parse voice to medical history fields |
| GET | `/api/medicine-reference/search` | Medicine autocomplete search |
| GET | `/api/news` | Medical news feed |
| GET | `/api/voice-samples/status` | Voice sample recording status |
| GET | `/api/my-plan-features` | Current subscription features |

### Admin APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/analytics` | Detailed analytics |
| GET | `/api/admin/analytics/details/:type` | Time-series data |
| GET | `/api/admin/doctors` | List all doctors |
| GET | `/api/admin/doctors/:id` | Doctor details |
| POST | `/api/admin/doctors/:id/approve` | Approve doctor |
| POST | `/api/admin/doctors/:id/reject` | Reject doctor |
| GET | `/api/admin/subscription-plans` | List plans |
| POST | `/api/admin/subscription-plans` | Create plan |
| PUT | `/api/admin/subscription-plans/:id` | Update plan |
| DELETE | `/api/admin/subscription-plans/:id` | Delete plan |
| GET | `/api/admin/invoices` | List invoices |
| GET | `/api/admin/invoices/:id/pdf` | Download invoice PDF |
| GET | `/api/admin/coupons` | List coupons |
| GET | `/api/admin/audit-logs` | Audit log |
| GET | `/api/admin/whatsapp-status` | WhatsApp health status |
| GET | `/api/admin/upgrade-requests` | Pending upgrades |
| POST | `/api/admin/upgrade-requests/:id/approve` | Approve upgrade |
| POST | `/api/admin/upgrade-requests/:id/reject` | Reject upgrade |
| GET | `/api/admin/admins` | List admins |
| POST | `/api/admin/admins` | Create admin |
| POST | `/api/admin/seed-plans` | Seed default plans |

### Public APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription-plans/public` | Public plan listing |
| GET | `/api/qr/doctor/:doctorId` | QR check-in doctor info |
| POST | `/api/qr/queue` | QR queue registration |
| GET | `/api/qr/patients/:doctorId` | Search patients for QR |
| GET | `/api/webhooks/whatsapp` | WhatsApp webhook verify |
| POST | `/api/webhooks/whatsapp` | WhatsApp status updates |
| GET | `/share/:token` | Public care plan view |

---

# 6. Development Documentation

## Module-wise Breakdown

### Module 1: Authentication & User Management
- **Files:** `server/routes.ts` (auth routes), `server/storage.ts` (user CRUD), `client/src/pages/login.tsx`, `register.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `doctor-profile.tsx`
- **Features:** Login, registration, face login, password reset, profile management

### Module 2: Patient Management
- **Files:** `server/routes.ts` (patient routes), `client/src/pages/new-visit.tsx`, `patient-portal.tsx`, `client/src/components/patient-history-form.tsx`
- **Features:** Patient CRUD, medical history, voice fill, QR registration

### Module 3: Visit & Clinical Data
- **Files:** `server/routes.ts` (visit routes), `server/ai-medical.ts`, `client/src/pages/active-visit.tsx`
- **Features:** Audio recording, transcription, AI extraction, care plan generation

### Module 4: Prescription & Medicines
- **Files:** `server/routes.ts`, `server/pdf-generator.ts`, `client/src/components/medicine-autocomplete.tsx`, `medicine-alternatives.tsx`
- **Features:** Prescription management, medicine search, alternatives, PDF generation

### Module 5: Lab Reports
- **Files:** `server/routes.ts`, `client/src/components/lab-report-upload.tsx`
- **Features:** Report upload, AI analysis, abnormal marker detection

### Module 6: WhatsApp Automation
- **Files:** `server/whatsapp.ts`, `server/routes.ts` (webhook routes)
- **Features:** Automated reminders, delivery tracking, patient responses, retry logic

### Module 7: Adherence & Follow-ups
- **Files:** `server/routes.ts`, `client/src/pages/adherence.tsx`, `active-care.tsx`, `calendar.tsx`
- **Features:** Medicine adherence tracking, follow-up scheduling, calendar view

### Module 8: Reports & Analytics
- **Files:** `server/routes.ts`, `client/src/pages/reports.tsx`
- **Features:** Practice reports, print/download, branded footer

### Module 9: SaaS & Billing
- **Files:** `server/routes.ts`, `client/src/pages/plan-management.tsx`, `doctor-subscriptions.tsx`, `billing-management.tsx`, `upgrade-plan.tsx`
- **Features:** Plan management, subscriptions, invoices, coupons

### Module 10: Admin Portal
- **Files:** `server/routes.ts`, `client/src/pages/admin-dashboard.tsx`, `admin-roles.tsx`
- **Features:** Platform management, doctor approvals, analytics, audit logs

### Module 11: AI Integration
- **Files:** `server/ai-medical.ts`, `server/routes.ts`
- **Features:** GPT-4o extraction, Whisper transcription, translation, news generation, face matching

## Feature List

| Feature | Version | Module |
|---------|---------|--------|
| Email/Password Authentication | v1.0 | Auth |
| Doctor Registration with Approval | v1.0 | Auth |
| Patient CRUD | v1.0 | Patient |
| Visit with Audio Recording | v1.0 | Visit |
| AI Transcription (Whisper) | v1.0 | AI |
| AI Clinical Extraction (GPT-4o) | v1.0 | AI |
| Multi-language Support (14 languages) | v1.0 | AI |
| Care Plan Generation | v1.0 | Visit |
| Prescription PDF | v1.0 | Prescription |
| WhatsApp Reminders | v1.0 | WhatsApp |
| Dashboard with Stats | v1.0 | Dashboard |
| Admin Portal | v1.0 | Admin |
| Subscription Plans (SaaS) | v2.0 | Billing |
| Invoice Generation | v2.0 | Billing |
| Coupon Management | v2.0 | Billing |
| QR Patient Registration | v2.0 | Patient |
| Medicine Alternatives | v2.0 | Prescription |
| Lab Report Analysis | v2.0 | Lab |
| Speaker Diarization | v2.0 | AI |
| Adherence Tracking | v2.0 | Adherence |
| Medical News Feed | v2.0 | AI |
| Voice Store (Diarization Training) | v2.0 | AI |
| Face-based Login (GPT-4o Vision) | v3.0 | Auth |
| Voice Fill (Patient Details) | v3.0 | Patient |
| Voice Fill (Medical History) | v3.0 | Patient |
| Aadhaar OCR | v3.0 | Patient |
| Medicine Autocomplete (OpenFDA) | v3.0 | Prescription |
| Dashboard Sidebars | v3.0 | Dashboard |
| Branded Print Reports | v3.0 | Reports |
| Prescription Risk Checks | v3.0 | Prescription |

## Versioning

| Version | Focus | Status |
|---------|-------|--------|
| v1.0 | Core platform — Auth, visits, AI, WhatsApp, admin | Released |
| v2.0 | SaaS features — Subscriptions, billing, QR, adherence | Released |
| v3.0 | Advanced AI — Face login, voice fill, autocomplete, branded reports | Released |
| v4.0 | Telehealth, mobile app, ABDM integration | Planned |

## Git Workflow
- **Main Branch:** All production code on `main`
- **Checkpoints:** Automatic checkpoint creation on each significant change
- **Rollback:** Checkpoint-based rollback available via Replit
- **Commit Messages:** Descriptive messages with feature/fix context

## Project Structure
```
├── client/
│   ├── src/
│   │   ├── pages/              # 25 page components
│   │   ├── components/         # 9 shared components + ui/
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   ├── layout.tsx      # Main layout with sidebar
│   │   │   ├── patient-history-form.tsx
│   │   │   ├── medicine-autocomplete.tsx
│   │   │   ├── medicine-alternatives.tsx
│   │   │   ├── lab-report-upload.tsx
│   │   │   ├── page-header.tsx
│   │   │   ├── pagination.tsx
│   │   │   └── upgrade-prompt.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utilities (queryClient, etc.)
│   │   ├── App.tsx             # Route definitions
│   │   └── main.tsx            # Entry point
│   └── index.html
├── server/
│   ├── index.ts                # Server entry point
│   ├── routes.ts               # All API routes
│   ├── storage.ts              # Database operations (IStorage)
│   ├── ai-medical.ts           # AI integration helpers
│   ├── whatsapp.ts             # WhatsApp Cloud API
│   ├── email.ts                # Nodemailer configuration
│   ├── pdf-generator.ts        # PDF generation
│   └── replit_integrations/    # Replit AI integration modules
├── shared/
│   └── schema.ts               # Drizzle ORM schema (28+ tables)
├── start.sh                    # Startup script
├── drizzle.config.ts           # Database configuration
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

---

# 7. Testing Documentation

## Test Cases

### TC-01: Authentication
| # | Test Case | Expected Result | Priority |
|---|-----------|----------------|----------|
| 1.1 | Login with valid credentials | Redirect to dashboard, session token set | Critical |
| 1.2 | Login with invalid password | Error message displayed | Critical |
| 1.3 | Login with unapproved account | "Pending approval" message | High |
| 1.4 | Face login with registered face | Successful authentication | High |
| 1.5 | Face login with unregistered face | Error message | High |
| 1.6 | Register new doctor | "Pending approval" confirmation | Critical |
| 1.7 | Password reset flow | Reset email sent, new password works | High |
| 1.8 | Session expiry after 7 days | User redirected to login | Medium |

### TC-02: Patient Management
| # | Test Case | Expected Result | Priority |
|---|-----------|----------------|----------|
| 2.1 | Create new patient with all fields | Patient appears in list | Critical |
| 2.2 | Voice Fill patient details | Name, age, gender, WhatsApp auto-filled | High |
| 2.3 | Aadhaar OCR scan | Name, age, gender extracted | Medium |
| 2.4 | Update medical history | Changes saved and reflected | Critical |
| 2.5 | Voice Fill medical history | All history fields auto-filled | High |
| 2.6 | QR check-in registration | Patient added to queue | High |
| 2.7 | Search patients by name | Matching results returned | Medium |

### TC-03: Visit Workflow
| # | Test Case | Expected Result | Priority |
|---|-----------|----------------|----------|
| 3.1 | Create new visit | Visit created with "recording" status | Critical |
| 3.2 | Record audio and transcribe | Transcript displayed in real-time | Critical |
| 3.3 | AI extraction from transcript | Medicines, tests, followups extracted | Critical |
| 3.4 | Edit AI-generated draft | Changes saved | High |
| 3.5 | Approve care plan | Status changes to "active", reminders scheduled | Critical |
| 3.6 | Multi-language transcription | Correct translation to English | High |
| 3.7 | Speaker diarization | Doctor and patient segments separated | Medium |

### TC-04: Prescription
| # | Test Case | Expected Result | Priority |
|---|-----------|----------------|----------|
| 4.1 | Medicine autocomplete search | Results from local DB and OpenFDA | High |
| 4.2 | View medicine alternatives | Alternative medicines listed | Medium |
| 4.3 | Generate prescription PDF | Valid PDF downloaded | High |
| 4.4 | Print prescription | Browser print dialog opens | High |

### TC-05: WhatsApp Integration
| # | Test Case | Expected Result | Priority |
|---|-----------|----------------|----------|
| 5.1 | Send medicine reminder | WhatsApp message delivered | Critical |
| 5.2 | Retry on failure | Retries up to 3 times with backoff | High |
| 5.3 | Rate limit handling | Scheduler pauses on rate limit | High |
| 5.4 | Patient response tracking | Response logged in adherence | Medium |
| 5.5 | Delivery status webhook | Status updated (delivered/read) | Medium |

### TC-06: Reports
| # | Test Case | Expected Result | Priority |
|---|-----------|----------------|----------|
| 6.1 | Generate daily report | Correct visit count and details | High |
| 6.2 | Print report | Print dialog with branded footer | High |
| 6.3 | Download report | HTML file downloaded | Medium |
| 6.4 | Footer shows branding | "carepath.ai powered by Codelyne Technologies" visible | Medium |
| 6.5 | Footer pinned to bottom | Footer at page bottom regardless of content | Medium |

### TC-07: Admin Portal
| # | Test Case | Expected Result | Priority |
|---|-----------|----------------|----------|
| 7.1 | Approve doctor registration | Doctor status changes to "approved" | Critical |
| 7.2 | Reject doctor registration | Doctor status changes to "rejected" | High |
| 7.3 | Create subscription plan | Plan appears in list | High |
| 7.4 | View analytics dashboard | Stats displayed correctly | Medium |
| 7.5 | Generate invoice | Invoice created with correct amounts | High |
| 7.6 | Audit log records actions | Admin actions logged with timestamp | Medium |

### TC-08: Dashboard
| # | Test Case | Expected Result | Priority |
|---|-----------|----------------|----------|
| 8.1 | Stat cards show correct counts | Numbers match actual data | Critical |
| 8.2 | Click stat card opens sidebar | Sidebar slides in with detailed list | High |
| 8.3 | Patient queue real-time update | New QR check-in appears without refresh | High |
| 8.4 | Performance metrics display | Adherence, follow-up, OPD metrics shown | Medium |

## QA Checklist

### Pre-Release Checklist
- [ ] All authentication flows working (login, register, face login, password reset)
- [ ] Patient CRUD operations functional
- [ ] Visit workflow end-to-end (create → record → extract → approve)
- [ ] AI transcription producing accurate results
- [ ] AI extraction generating valid care plans
- [ ] WhatsApp reminders sending successfully
- [ ] WhatsApp retry logic capped at 3 retries
- [ ] Dashboard stats displaying correctly
- [ ] Dashboard sidebar interactions working
- [ ] Reports generating with correct data
- [ ] Print function opening print dialog (not blocked by popup blocker)
- [ ] Report footer shows "carepath.ai powered by Codelyne Technologies"
- [ ] Report footer pinned to bottom of page
- [ ] Medicine autocomplete returning results
- [ ] Prescription PDF generation working
- [ ] Admin portal accessible and functional
- [ ] Subscription plans displaying with correct INR pricing
- [ ] QR check-in flow working
- [ ] Voice Fill working on patient details page
- [ ] Voice Fill working on medical history page
- [ ] Multi-language support functional
- [ ] Responsive design on mobile, tablet, desktop
- [ ] No console errors (excluding Vite HMR WebSocket — known Replit environment issue)
- [ ] API response times under 100ms for standard queries
- [ ] Database queries optimized (no N+1 patterns)
- [ ] Secrets not exposed in client code or API responses
- [ ] Face data stripped from API responses (shows "registered" instead of base64)

### Security Checklist
- [ ] Passwords hashed with bcrypt
- [ ] Token-based authentication on all protected routes
- [ ] Role-based access control enforced
- [ ] Input validation with Zod on all endpoints
- [ ] SQL injection prevention via parameterized queries
- [ ] Session tokens have expiry
- [ ] Admin actions logged in audit trail
- [ ] Sensitive data (faceData) not exposed in API responses

## UAT (User Acceptance Testing)

### UAT Scenarios

| # | Scenario | Steps | Acceptance Criteria |
|---|----------|-------|-------------------|
| UAT-01 | Doctor onboarding | Register → Await approval → Login → Setup profile → Record voice samples | Doctor can access all portal features |
| UAT-02 | First patient visit | Create patient (Voice Fill) → Fill medical history (Voice Fill) → Record consultation → Review AI draft → Approve care plan | Care plan is active, WhatsApp reminders scheduled |
| UAT-03 | Returning patient visit | Select existing patient → Update history if needed → Record → Extract → Approve | Previous history available, new visit linked |
| UAT-04 | QR check-in flow | Patient scans QR → Enters details → Joins queue → Doctor sees in real-time → Starts visit | Seamless queue management |
| UAT-05 | Daily reporting | Navigate to Reports → Select today → View summary → Print report | Printed report has correct data and branded footer at bottom |
| UAT-06 | Admin management | Login as admin → View dashboard → Approve pending doctor → Manage plans → View audit log | All admin functions accessible |
| UAT-07 | Subscription upgrade | Doctor requests upgrade → Admin approves → Features unlocked | Plan features match new tier |
| UAT-08 | WhatsApp reminder cycle | Approve visit with medicines → Wait for scheduler → Patient receives WhatsApp → Patient responds → Adherence logged | Full reminder loop completed |

---

## SaaS Pricing Reference (INR)

| Plan | Monthly | Annual | AI Minutes | Languages |
|------|---------|--------|-----------|-----------|
| Starter | ₹1,499 | ₹14,990 | 20 min/mo | 3 |
| Professional | ₹3,999 | ₹39,990 | 1,000 min/mo | 8 |
| Clinic Pro | ₹8,999 | ₹89,990 | 5,000 min/mo | 14 |
| Enterprise | Custom | Custom | Unlimited | 14+ Custom |

All plans include a 7-day free trial.

---

## Contact & Credentials

| Item | Value |
|------|-------|
| Production Domain | carepath.in |
| Support Email | support.carepath@gmail.com |
| Admin Login | admin@carepath.ai / admin123 |
| Powered By | Codelyne Technologies |

---

*Document generated on April 7, 2026*  
*CarePath AI v3.0 — carepath.ai powered by Codelyne Technologies*
