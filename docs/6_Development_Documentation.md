# Development Documentation
## CarePath AI

---

## 1. Module-wise Breakdown

### Module 1: Authentication & User Management
**Files:**
- `server/auth.ts` — Auth middleware, session validation, plan features loading, admin permissions
- `server/seed-admin.ts` — Admin account auto-seeding, plan price migration
- `server/email.ts` — Gmail SMTP email utility for OTP delivery
- `client/src/hooks/use-auth.ts` — Authentication React hook
- `client/src/pages/login.tsx` — Login page
- `client/src/pages/register.tsx` — Doctor registration page
- `client/src/pages/forgot-password.tsx` — OTP-based password recovery
- `client/src/pages/reset-password.tsx` — Token-based password reset (fallback)
- `client/src/pages/doctor-profile.tsx` — Profile management

| Feature | Description |
|---------|-------------|
| Doctor Registration | Self-registration with email, password, specialization, license, clinic details, plan selection |
| Login/Logout | Token-based sessions stored in browser sessionStorage (key: "session_token") |
| Password Recovery | 6-digit OTP via Gmail SMTP (support.carepath@gmail.com), 10-minute expiry, rate limited |
| Profile Management | Update personal info, clinic details, upload/remove profile photo |
| Admin Seeding | Auto-creates admin@carepath.ai / admin123 on every server startup |
| Plan Features Middleware | `loadPlanFeatures()` injects subscription data (plan, AI minutes, features) into every authenticated request |
| Admin Permissions | `requireAdminPermission()` middleware with granular role-based checks |
| Session Management | Server-side session tokens with database-backed validation |

### Module 2: Patient Management
**Files:**
- `client/src/pages/new-visit.tsx` — New visit page with patient creation/selection
- `client/src/pages/patient-portal.tsx` — Patient database and history viewer
- `client/src/components/patient-history-form.tsx` — Comprehensive medical history form

| Feature | Description |
|---------|-------------|
| Patient CRUD | Create, read, update patient records with full contact and medical info |
| Medical History | 14-field comprehensive form (conditions, allergies, surgeries, blood group, etc.) |
| Aadhaar OCR | AI-powered extraction from Aadhaar card images using GPT-4o vision |
| Patient Portal | Drill-down view with visit timeline and care plan details per patient |
| Doctor Scoping | Strict data isolation — each doctor sees only their own patients (enforced at query level) |
| Patient Search | Name-based search for selecting existing patients during new visits |
| First Visit Detection | API checks if patient has any previous visits to show appropriate medical history prompt |

### Module 3: Consultation & AI Extraction
**Files:**
- `client/src/pages/active-visit.tsx` — Active consultation page (recording, extraction, review, approval)
- `server/ai-medical.ts` — AI system prompt for clinical data extraction
- `server/routes.ts` — Visit processing endpoints (finalize, reextract, approve)

| Feature | Description |
|---------|-------------|
| Audio Recording | Browser MediaRecorder API with chunk-based capture |
| Real-time Transcription | OpenAI Whisper via streaming audio chunks sent to server |
| AI Extraction | GPT-4o extracts structured clinical data with expert medical system prompt |
| History Context | Patient's full medical history injected into AI prompt for safe, context-aware prescriptions |
| Speaker Diarization | Separate doctor/patient speech in transcript |
| Manual Editing | Full CRUD on AI-extracted medicines, tests, and follow-ups before approval |
| Approval Workflow | Draft → Review → Approve (creates care events on approval) |
| Re-extraction | Re-run AI extraction on existing transcript text without new recording |
| Timer Display | Real-time MM:SS timer during recording with waveform visualization |

### Module 4: Care Plan & Prescription
**Files:**
- `client/src/pages/active-visit.tsx` — buildCarePlanHtml() for print, buildShareSummary() for sharing
- `server/routes.ts` — Share endpoint, PDF endpoint, prescription template
- `server/pdf-generator.ts` — Server-side PDF generation

| Feature | Description |
|---------|-------------|
| Prescription PDF | Professional layout: doctor photo, qualifications, clinic info, patient details, medicines table, tests, follow-ups |
| Share Links | Cryptographically random tokens with configurable expiry for secure public access |
| WhatsApp Share | Opens wa.me with pre-formatted summary text (header info only) + PDF link |
| Email Share | Opens mailto: with subject line and summary body + PDF link |
| SMS Share | Opens sms: protocol with summary + PDF link |
| Print | Browser print dialog with print-optimized CSS (hides UI, formats for paper) |
| Share Format | Summary contains only: doctor name, patient name, visit date, language, status, follow-up date — no clinical details in text |

### Module 5: WhatsApp Integration
**Files:**
- `server/whatsapp.ts` — WhatsApp Cloud API client, scheduler, retry logic
- `server/routes.ts` — WhatsApp webhook endpoints, send prescription endpoint

| Feature | Description |
|---------|-------------|
| Message Sending | WhatsApp Cloud API with template-based messaging |
| Automated Scheduler | Runs every 1 minute, checks for pending care events, sends reminders |
| Delivery Tracking | Webhook-based status tracking (sent → delivered → read → failed) |
| Retry Mechanism | Configurable max retries with rate limit detection (stops cycle when rate limited) |
| Patient Responses | Inbound webhook handler for patient replies to reminders |
| Admin Dashboard | Delivery stats, failed message count, recent failed messages with details |
| Prescription Delivery | Send prescription PDF link directly to patient's WhatsApp |

### Module 6: Multi-Language Support
**Files:**
- `server/medical-translations.ts` — Pre-built dictionary for 15+ languages (~45 terms each)
- `server/routes.ts` — /api/translate-terms and /api/translate endpoints

| Feature | Description |
|---------|-------------|
| Pre-built Dictionary | Hand-crafted translations for medical terms: frequencies (Once daily, Twice daily, etc.), timings (Before food, After food, etc.), durations (days, weeks, months), common instructions |
| Supported Languages | English, Hindi, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Bengali, Punjabi, Urdu, Odia, Assamese, Konkani, Goan Konkani (Roman script), Malay (Bahasa Melayu) |
| Konkani Roman Script | Goan Konkani uses Roman transliteration (e.g., "Disak don favtti" instead of Devanagari) |
| AI Fallback | GPT-4o-mini translates terms not found in the pre-built dictionary |
| Prescription Language | Medicines displayed with translated frequency, timing, and duration on prescriptions |

### Module 7: SaaS Platform
**Files:**
- `client/src/pages/plan-management.tsx` — Admin: subscription plan CRUD
- `client/src/pages/doctor-subscriptions.tsx` — Admin: manage doctor subscriptions
- `client/src/pages/billing-management.tsx` — Admin: invoices and coupons
- `client/src/pages/upgrade-plan.tsx` — Doctor: view plans and request upgrade
- `client/src/hooks/use-plan-features.ts` — React hook for plan feature access
- `client/src/components/upgrade-prompt.tsx` — FeatureGate component, AI minutes warning

| Feature | Description |
|---------|-------------|
| Plan Management | Full CRUD for subscription tiers: name, pricing (INR), AI minutes, doctors included, features |
| Plan Cloning | Clone existing plan as starting point for new tier |
| Doctor Subscriptions | Assign, activate, suspend, cancel subscriptions per doctor |
| Trial System | 7-day trial with 20 AI minutes total; AI blocked after exhaustion with "Free Demo Minutes Complete" |
| Feature Gating | `FeatureGate` component wraps premium features; `usePlanFeatures()` hook provides current plan info |
| Upgrade Requests | Doctor submits request → Admin approves/rejects → Subscription updated |
| Billing & Invoices | Auto-generated monthly invoices (1st of month), manual invoice creation, payment tracking |
| Coupons | Create discount codes (percentage/fixed), set validity period, max uses, applicable plans |
| Regional Pricing | Country-based price multipliers for international markets |
| Price Migration | `migratePlanPrices()` auto-corrects plan prices on startup |

### Module 8: Admin Portal
**Files:**
- `client/src/pages/admin-dashboard.tsx` — Multi-tab admin dashboard with analytics
- `client/src/pages/admin-roles.tsx` — Admin account and role management
- `client/src/hooks/use-admin-permissions.ts` — Permission checking hook

| Feature | Description |
|---------|-------------|
| Analytics Dashboard | Real-time stats with 30-second polling: Total Doctors, Active Subscriptions, MRR, AI Minutes |
| Clickable Stat Cards | Each analytics card opens detail dialog with doctor-level breakdown table |
| Doctor Management | List all doctors, approve/reject pending registrations with credential review |
| Doctor Data Drill-down | Select any doctor → view their patients list → view their visits and care plans |
| Upgrade Notifications | Persistent violet banner across ALL admin routes when pending upgrade requests exist |
| Sidebar Badge | Pending upgrade request count with 30-second polling refresh |
| Audit Logging | Immutable trail: createAuditLog(adminId, action, targetType, targetId?, details?) |
| Admin Roles | Super Admin (full access), Finance (billing), Operations (doctors/plans), Support (verification), Read-Only (view only) |
| Admin CRUD | Create additional admin accounts, assign and change roles, delete admins |

### Module 9: Additional Features
| Feature | File | Description |
|---------|------|-------------|
| Lab Report Analysis | `client/src/components/lab-report-upload.tsx` | Upload PDF/image reports, AI extracts values, highlights abnormal markers |
| Medicine Alternatives | `client/src/components/medicine-alternatives.tsx` | AI suggests generic/cheaper alternatives for each prescribed medicine |
| Adherence Tracking | `client/src/pages/adherence.tsx` | Daily medicine compliance per patient per medicine (Taken/Missed/Pending) |
| Calendar | `client/src/pages/calendar.tsx` | Visual calendar of visits, follow-ups, and medicine end dates |
| Reports | `client/src/pages/reports.tsx` | Daily/weekly/monthly practice summary with export/print |
| Telehealth | `client/src/pages/telehealth.tsx` | Video consultation interface with integrated note-taking |
| Voice Store | `client/src/pages/dr-voice-store.tsx` | Doctor voice sample recording for AI speaker identification training |
| News Feed | `client/src/pages/news-feed.tsx` | AI-curated medical news articles and research updates |
| Search | `client/src/pages/search.tsx` | Full-text search across patients, visits, and care plans |

---

## 2. Complete Feature List

| # | Feature | Status | Module | Priority |
|---|---------|--------|--------|----------|
| 1 | Doctor Registration with Plan Selection | Done | Auth | High |
| 2 | Token-based Login/Logout | Done | Auth | High |
| 3 | Admin Approval for Doctors | Done | Auth | High |
| 4 | Password Recovery via Email OTP | Done | Auth | High |
| 5 | Profile Management with Photo | Done | Auth | Medium |
| 6 | Role-based Access Control | Done | Auth | High |
| 7 | Patient CRUD with Medical History | Done | Patient | High |
| 8 | Aadhaar Card OCR | Done | Patient | Medium |
| 9 | Patient Portal with Visit History | Done | Patient | High |
| 10 | Doctor-scoped Data Isolation | Done | Patient | High |
| 11 | Real-time Audio Recording | Done | Consultation | High |
| 12 | OpenAI Whisper Transcription | Done | Consultation | High |
| 13 | GPT-4o Clinical Extraction | Done | Consultation | High |
| 14 | Context-aware Prescription Generation | Done | Consultation | High |
| 15 | Speaker Diarization | Done | Consultation | Medium |
| 16 | Manual Medicine/Test/Follow-up Editing | Done | Consultation | High |
| 17 | Care Plan Approval Workflow | Done | Consultation | High |
| 18 | Professional Prescription PDF | Done | Care Plan | High |
| 19 | Shareable Prescription Links | Done | Care Plan | High |
| 20 | WhatsApp/Email/SMS Sharing | Done | Care Plan | High |
| 21 | Header-only Share Format | Done | Care Plan | Medium |
| 22 | Print-optimized Prescriptions | Done | Care Plan | Medium |
| 23 | Lab Report Upload & AI Analysis | Done | Lab Reports | Medium |
| 24 | AI Medicine Alternatives | Done | Intelligence | Medium |
| 25 | Drug Interaction Checks | Done | Intelligence | Low |
| 26 | WhatsApp Automated Reminders | Done | WhatsApp | High |
| 27 | Message Delivery Tracking | Done | WhatsApp | High |
| 28 | Retry with Rate Limit Detection | Done | WhatsApp | Medium |
| 29 | WhatsApp Webhook Handler | Done | WhatsApp | Medium |
| 30 | 15+ Language Translations | Done | Translation | High |
| 31 | Konkani Roman Script | Done | Translation | Medium |
| 32 | AI Fallback Translation | Done | Translation | Medium |
| 33 | Medicine Adherence Tracking | Done | Adherence | High |
| 34 | Calendar View | Done | Calendar | Medium |
| 35 | Practice Reports (Daily/Weekly/Monthly) | Done | Reports | Medium |
| 36 | Subscription Plan Management | Done | SaaS | High |
| 37 | Trial System (7 days, 20 min) | Done | SaaS | High |
| 38 | Feature Gating & Upgrade Prompts | Done | SaaS | High |
| 39 | Upgrade Request Flow | Done | SaaS | High |
| 40 | Billing & Invoice Management | Done | SaaS | Medium |
| 41 | Coupon System | Done | SaaS | Medium |
| 42 | Regional Pricing | Done | SaaS | Low |
| 43 | Admin Analytics Dashboard | Done | Admin | High |
| 44 | Clickable Stat Card Details | Done | Admin | Medium |
| 45 | Admin Roles & Permissions | Done | Admin | Medium |
| 46 | Audit Logging | Done | Admin | High |
| 47 | Upgrade Request Notifications | Done | Admin | Medium |
| 48 | Telehealth Video Consultations | Done | Telehealth | Medium |
| 49 | Doctor Voice Store | Done | Voice | Medium |
| 50 | Medical News Feed | Done | News | Low |
| 51 | Full-text Search | Done | Search | Medium |

---

## 3. Versioning

| Version | Codename | Key Changes |
|---------|----------|-------------|
| **v1.0** | Foundation | Core platform: Authentication, patient management, visit creation, basic UI |
| **v1.1** | Recording | Audio recording, real-time transcription via Whisper, AI extraction via GPT-4o |
| **v1.2** | Care Plans | Medicine/test/follow-up management, care plan approval workflow |
| **v2.0** | Prescriptions | Professional prescription PDFs, shareable links, WhatsApp/Email/SMS sharing |
| **v2.1** | WhatsApp | WhatsApp Cloud API integration, automated reminders, delivery tracking, webhooks |
| **v2.2** | Tracking | Adherence tracking, calendar view, practice reports, dashboard metrics |
| **v2.3** | Intelligence | Lab report analysis, medicine alternatives, drug interaction checks |
| **v2.4** | Languages | Multi-language support (12 Indian languages), medical term translations |
| **v3.0** | SaaS Platform | Subscription plans, billing, invoices, coupons, feature gating, trial system |
| **v3.1** | Admin Portal | Admin dashboard, doctor management, analytics, audit logs, admin roles |
| **v3.2** | Refinements | Clickable stat cards, upgrade notifications, sidebar badges, regional pricing |
| **v3.3** | Recovery | Email OTP password recovery, Konkani/Malay translations, UI text updates |
| **v3.4** | Current | Lab reports, telehealth, voice store, news feed, full-text search, Aadhaar OCR |

---

## 4. Git Workflow

### Repository
- **GitHub**: https://github.com/codelynetechnologies/CarePath-AI
- **Primary Branch**: `main` (single branch workflow)
- **Development Environment**: Replit (live development with auto-checkpoints)
- **Production Environment**: Replit Deployments (autoscale)

### Development Process
```
1. Developer makes changes on Replit
2. Replit auto-creates checkpoints (can rollback if needed)
3. Changes tested via Preview pane on Replit
4. Publish to production via Replit Deployments
5. Push to GitHub for backup: git push -u origin main
```

### Environment Configuration
| Variable | Type | Environment | Purpose |
|----------|------|-------------|---------|
| DATABASE_URL | Secret | Auto | PostgreSQL connection string |
| PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE | Secret | Auto | Individual PG connection params |
| SESSION_SECRET | Secret | Auto | Session token signing key |
| AI_INTEGRATIONS_OPENAI_API_KEY | Secret | Auto | OpenAI API key (via Replit integrations) |
| AI_INTEGRATIONS_OPENAI_BASE_URL | Secret | Auto | OpenAI API base URL |
| GMAIL_APP_PASSWORD | Secret | Shared | Gmail SMTP app password for OTP emails |
| WHATSAPP_ACCESS_TOKEN | Env | Shared | WhatsApp Cloud API bearer token |
| WHATSAPP_PHONE_NUMBER_ID | Env | Shared | WhatsApp sender phone number ID |
| PUBLIC_BASE_URL | Env | Shared | Production URL (https://carepathai.in) |
| NODE_ENV | Env | Production | Set to "production" in deployed environment |

### Startup Script (start.sh)
```bash
#!/bin/bash
npx tsx server/index.ts
```

### Startup Sequence
1. Connect to PostgreSQL database
2. Push Drizzle schema (create/update tables)
3. Seed admin account (admin@carepath.ai / admin123)
4. Migrate plan prices to correct values
5. Start Express server on port 5000
6. Start WebSocket server
7. Start WhatsApp scheduler (1-minute interval)
8. Start invoice scheduler (hourly, runs on 1st of month)
9. Serve Vite frontend (dev mode) or static files (production)

---

## 5. Project Structure

```
carepath-ai/
│
├── client/                          # Frontend application
│   ├── src/
│   │   ├── pages/                   # 24 page components
│   │   │   ├── login.tsx            # Doctor/admin login
│   │   │   ├── register.tsx         # Doctor registration with plan selection
│   │   │   ├── forgot-password.tsx  # OTP-based password recovery
│   │   │   ├── reset-password.tsx   # Token-based password reset
│   │   │   ├── dashboard.tsx        # Doctor dashboard with stats
│   │   │   ├── new-visit.tsx        # New patient visit flow
│   │   │   ├── active-visit.tsx     # Consultation recording & AI extraction
│   │   │   ├── active-care.tsx      # Active care plans list
│   │   │   ├── patient-portal.tsx   # Patient database with history
│   │   │   ├── adherence.tsx        # Medicine adherence tracking
│   │   │   ├── calendar.tsx         # Appointments and follow-ups
│   │   │   ├── reports.tsx          # Practice reports (daily/weekly/monthly)
│   │   │   ├── search.tsx           # Full-text search
│   │   │   ├── telehealth.tsx       # Video consultations
│   │   │   ├── dr-voice-store.tsx   # Voice sample registration
│   │   │   ├── news-feed.tsx        # Medical news articles
│   │   │   ├── doctor-profile.tsx   # Profile management
│   │   │   ├── upgrade-plan.tsx     # Plan upgrade page
│   │   │   ├── admin-dashboard.tsx  # Admin analytics (multi-tab)
│   │   │   ├── admin-roles.tsx      # Admin role management
│   │   │   ├── plan-management.tsx  # Subscription plan CRUD
│   │   │   ├── doctor-subscriptions.tsx  # Doctor subscription management
│   │   │   ├── billing-management.tsx    # Invoices and coupons
│   │   │   └── not-found.tsx        # 404 page
│   │   │
│   │   ├── components/              # Shared components
│   │   │   ├── ui/                  # 50+ shadcn/ui atomic components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   └── ... (50+ components)
│   │   │   ├── layout.tsx           # Main layout with sidebar navigation
│   │   │   ├── upgrade-prompt.tsx   # FeatureGate & AI minutes warning
│   │   │   ├── lab-report-upload.tsx    # Lab report upload & AI analysis
│   │   │   ├── medicine-alternatives.tsx # AI alternative medicine suggestions
│   │   │   ├── patient-history-form.tsx  # Medical history form
│   │   │   ├── page-header.tsx      # Reusable page header with icon
│   │   │   └── pagination.tsx       # Pagination component
│   │   │
│   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── use-auth.ts          # Authentication state & methods
│   │   │   ├── use-plan-features.ts # Plan feature access & gating
│   │   │   ├── use-admin-permissions.ts  # Admin permission checks
│   │   │   ├── use-realtime.ts      # WebSocket real-time updates
│   │   │   └── use-toast.ts         # Toast notification hook
│   │   │
│   │   ├── lib/
│   │   │   └── queryClient.ts       # TanStack Query configuration
│   │   │
│   │   └── App.tsx                  # Route definitions & app shell
│   │
│   ├── index.html                   # HTML entry point with meta tags
│   └── replit_integrations/audio/   # Audio recording worklets
│
├── server/                          # Backend application
│   ├── index.ts                     # Server entry point (startup sequence)
│   ├── routes.ts                    # All API routes (~4600 lines)
│   ├── auth.ts                      # Auth middleware, plan features, permissions
│   ├── storage.ts                   # IStorage interface & Drizzle implementation
│   ├── db.ts                        # PostgreSQL connection (Drizzle + pg)
│   ├── ai-medical.ts                # GPT-4o system prompt for clinical extraction
│   ├── email.ts                     # Gmail SMTP utility (Nodemailer)
│   ├── whatsapp.ts                  # WhatsApp Cloud API client + scheduler
│   ├── pdf-generator.ts             # HTML-to-PDF prescription generation
│   ├── websocket.ts                 # WebSocket server for real-time events
│   ├── medical-translations.ts      # Multi-language dictionary (15+ languages)
│   ├── seed-admin.ts                # Admin seeding & plan price migration
│   ├── seed-medicines.ts            # Medicine reference database seeding
│   ├── static.ts                    # Static file serving configuration
│   ├── vite.ts                      # Vite dev server integration (READ-ONLY)
│   └── replit_integrations/         # Replit AI integration utilities
│
├── shared/
│   └── schema.ts                    # Drizzle ORM schema (30 tables + Zod schemas)
│
├── docs/                            # Project documentation (7 documents)
│   ├── 1_Project_Overview_Document.md
│   ├── 2_Business_Requirement_Document.md
│   ├── 3_Software_Requirement_Specification.md
│   ├── 4_UI_UX_Documentation.md
│   ├── 5_Technical_Documentation.md
│   ├── 6_Development_Documentation.md
│   └── 7_Testing_Documentation.md
│
├── start.sh                         # Startup script (bash start.sh)
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
├── drizzle.config.ts                # Drizzle ORM configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── components.json                  # shadcn/ui configuration
└── replit.md                        # Project memory file
```
