# Software Requirement Specification (SRS)
## CarePath AI

---

## 1. Functional Requirements

### 1.1 Authentication & Authorization
| ID | Requirement | Priority |
|----|------------|----------|
| FR-001 | System shall allow doctor self-registration with email, password, name, phone, specialization, license number, clinic name, clinic address, qualifications, and experience | High |
| FR-002 | Admin must approve or reject doctor registrations before account activation (status: pending → approved/rejected) | High |
| FR-003 | System shall support token-based session authentication with bcrypt password hashing (10 rounds) | High |
| FR-004 | System shall support password recovery via 6-digit OTP sent to registered email (Gmail SMTP) | High |
| FR-005 | OTP shall expire after 10 minutes; rate limited to 5 attempts per 15 minutes per IP address | Medium |
| FR-006 | System shall support role-based access control: Doctor role and Admin role with sub-roles (Super Admin, Finance, Operations, Support, Read-Only) | High |
| FR-007 | Admin accounts shall default to super_admin role when adminRole field is null | Medium |
| FR-008 | Session tokens shall be stored in browser sessionStorage with key "session_token" | High |
| FR-009 | System shall support profile management including photo upload/deletion, personal details, and clinic information | Medium |

### 1.2 Patient Management
| ID | Requirement | Priority |
|----|------------|----------|
| FR-010 | Doctors shall create patient records with: name (required), age (required), gender, phone, WhatsApp number | High |
| FR-011 | System shall support Aadhaar card OCR to auto-fill patient details using GPT-4o vision | Medium |
| FR-012 | Patient medical history shall include: known conditions, allergies, past illnesses, chronic diseases, current medications, family history, lifestyle habits, previous surgeries, pregnancy status, blood group, weight, height | High |
| FR-013 | Each doctor shall see only their own patients (doctor-scoped data isolation enforced server-side) | High |
| FR-014 | Patient portal shall display full visit history with care plan details for each visit | High |
| FR-015 | System shall support patient search by name for existing patient selection during new visits | High |
| FR-016 | System shall detect first-time vs returning patients and prompt medical history form accordingly | Medium |

### 1.3 Consultation & Visit Flow
| ID | Requirement | Priority |
|----|------------|----------|
| FR-020 | System shall support real-time audio recording during consultation using browser MediaRecorder API | High |
| FR-021 | Audio shall be transcribed in real-time using OpenAI Whisper via chunk-based processing | High |
| FR-022 | AI (GPT-4o) shall extract structured clinical data from transcript: chief complaint, symptoms, diagnosis, medicines (name, dose, frequency, timing, duration, instructions), tests (name, urgency, fasting requirement), follow-ups (days, date, warning signs, notes) | High |
| FR-023 | AI extraction shall inject patient's complete medical history as context for accurate, safe prescription generation | High |
| FR-024 | Doctors shall manually add, edit, or delete any AI-extracted data (medicines, tests, follow-ups) before approval | High |
| FR-025 | Visit status workflow shall be: recording → draft → approved | High |
| FR-026 | Speaker diarization shall separate doctor and patient speech in the transcript | Medium |
| FR-027 | System shall support chunk-based audio processing for long consultations (streaming) | High |
| FR-028 | Visit page shall display a real-time timer during recording in MM:SS format | Medium |
| FR-029 | System shall support re-extraction: re-running AI extraction on existing transcript text | Medium |

### 1.4 Care Plan & Prescription
| ID | Requirement | Priority |
|----|------------|----------|
| FR-030 | Care plan shall include: medicines (name, dose, frequency, timing, duration in days, instructions, salt composition, generic name), tests (name, when to do, urgency, trigger condition, fasting required), follow-ups (days after, date, warning signs, notes) | High |
| FR-031 | System shall generate professional prescription PDF with: doctor photo, name, qualifications, clinic details, patient info, medicines table, tests, follow-ups, and branding | High |
| FR-032 | Prescription PDF shall be accessible via shareable link with expiring security token | High |
| FR-033 | Prescriptions shall be shareable via WhatsApp (wa.me link), Email (mailto link), and SMS (sms: protocol) | High |
| FR-034 | Share message shall contain only header information: doctor name, patient name, visit date, language, status, follow-up date, and PDF link — no clinical details in the text message | Medium |
| FR-035 | Print-optimized prescription layout for direct printing from browser | Medium |
| FR-036 | System shall track active care plans vs pending review (draft) care plans separately | Medium |

### 1.5 Lab Reports
| ID | Requirement | Priority |
|----|------------|----------|
| FR-040 | Doctors shall upload lab reports (PDF/images) for each recommended test | Medium |
| FR-041 | AI (GPT-4o) shall extract lab values and highlight abnormal markers from uploaded reports | Medium |
| FR-042 | Extracted lab report values shall be stored as structured JSON for historical trending | Medium |
| FR-043 | Lab test status shall be trackable: recommended → completed (with report) | Medium |

### 1.6 Medicine Intelligence
| ID | Requirement | Priority |
|----|------------|----------|
| FR-050 | AI shall suggest alternative medicines (generic or lower-cost) for each prescribed medicine | Medium |
| FR-051 | Medicine reference database with search by name for quick lookup during prescription | Medium |
| FR-052 | AI shall perform prescription risk checks for potential drug interactions | Low |
| FR-053 | Doctors shall be able to swap a prescribed medicine with a suggested alternative | Medium |

### 1.7 WhatsApp Automation
| ID | Requirement | Priority |
|----|------------|----------|
| FR-060 | System shall send automated medicine reminders via WhatsApp Cloud API based on care events | High |
| FR-061 | System shall send prescription PDF links via WhatsApp on doctor request | High |
| FR-062 | System shall track message delivery status: pending → sent → delivered → read → failed | High |
| FR-063 | Failed messages shall be retried automatically with configurable max retry count and rate limit detection | Medium |
| FR-064 | WhatsApp scheduler shall run every 1 minute to check pending care events | Medium |
| FR-065 | Admin dashboard shall display WhatsApp delivery statistics and failed message logs | Medium |
| FR-066 | System shall handle inbound WhatsApp webhook for delivery receipts and patient responses | Medium |

### 1.8 Adherence & Follow-up Tracking
| ID | Requirement | Priority |
|----|------------|----------|
| FR-070 | System shall track medicine adherence per patient per medicine with status: Taken / Missed / Pending | High |
| FR-071 | Adherence logs shall record: visit, patient, medicine, day number, status, timestamp, notes | High |
| FR-072 | Calendar view shall display: patient visits, follow-up appointments, and medicine end dates | Medium |
| FR-073 | Dashboard shall show performance metrics: Medicine Adherence %, Follow-up Completion %, Reduced OPD Load % | Medium |
| FR-074 | Practice reports shall be generatable for: daily, weekly, and monthly periods with export/print | Medium |

### 1.9 Multi-Language Support
| ID | Requirement | Priority |
|----|------------|----------|
| FR-080 | System shall translate medical terms (frequency, timing, duration, instructions) into 15+ languages | High |
| FR-081 | Supported languages: English, Hindi, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Bengali, Punjabi, Urdu, Odia, Assamese, Konkani, Goan Konkani, Malay | High |
| FR-082 | Konkani and Goan Konkani translations shall use Roman script (transliteration), not Devanagari | Medium |
| FR-083 | AI fallback translation via GPT-4o-mini for terms not in the pre-built dictionary | Medium |
| FR-084 | Visit language shall default to English; consultation language dropdown hidden from new-visit page | Low |

### 1.10 SaaS Subscription System
| ID | Requirement | Priority |
|----|------------|----------|
| FR-090 | System shall offer four subscription tiers: Starter (₹1,499/mo), Professional (₹3,999/mo), Clinic Pro (₹8,999/mo), Enterprise (Custom) | High |
| FR-091 | New doctors shall receive a 7-day free trial with 20 AI minutes total limit | High |
| FR-092 | After 20 trial minutes are exhausted, all AI features shall be blocked with "Free Demo Minutes Complete" message and upgrade prompt | High |
| FR-093 | Feature access shall be gated based on subscription plan tier using FeatureGate component and usePlanFeatures hook | High |
| FR-094 | Doctors shall request plan upgrades from a dedicated upgrade page; admin approves or rejects | High |
| FR-095 | Persistent violet notification banner shall appear across ALL admin routes when pending upgrade requests exist, with sidebar badge showing count and 30-second polling | Medium |
| FR-096 | Plan prices shall be auto-corrected on startup via migratePlanPrices() function | Low |
| FR-097 | Registration page shall display available plans with pricing for plan selection | Medium |

### 1.11 Admin Portal
| ID | Requirement | Priority |
|----|------------|----------|
| FR-100 | Admin dashboard shall display real-time analytics: Total Doctors, Active Subscriptions, MRR (₹), Total AI Minutes used | High |
| FR-101 | Each stat card shall be clickable, opening a detail dialog with doctor-level breakdowns | Medium |
| FR-102 | Admin shall approve or reject pending doctor registrations with credential review | High |
| FR-103 | Admin shall drill down into any doctor's data: patients list, visit details, care plans | High |
| FR-104 | Admin shall perform full CRUD on subscription plans with feature configurations | High |
| FR-105 | System shall auto-generate invoices on 1st of each month (hourly scheduler check) | Medium |
| FR-106 | Admin shall create, validate, and manage discount coupons for subscription plans | Medium |
| FR-107 | All admin actions shall be recorded in immutable audit log with: admin ID, action, target type, target ID, details, timestamp | High |
| FR-108 | Admin roles shall have granular permissions enforced server-side | Medium |
| FR-109 | Admin shall create additional admin accounts and assign roles | Medium |

---

## 2. Non-Functional Requirements

### 2.1 Performance
| ID | Requirement | Target |
|----|------------|--------|
| NFR-001 | API response time for standard CRUD queries | < 500ms |
| NFR-002 | Audio transcription chunk processing latency | < 5 seconds per chunk |
| NFR-003 | Full AI extraction processing time per visit | < 30 seconds |
| NFR-004 | Dashboard data refresh interval (polling) | 30 seconds |
| NFR-005 | Concurrent active doctor sessions | 50+ |
| NFR-006 | Database query optimization | Indexed on doctorId, patientId, visitId |
| NFR-007 | PDF generation time | < 3 seconds |

### 2.2 Security
| ID | Requirement |
|----|------------|
| NFR-010 | All passwords hashed with bcrypt (10 rounds salt) |
| NFR-011 | Session tokens stored in sessionStorage (cleared on tab close), not localStorage |
| NFR-012 | Shareable prescription links use cryptographically random tokens with configurable expiry |
| NFR-013 | Rate limiting on authentication endpoints (login, forgot-password) |
| NFR-014 | Doctor data isolation enforced at database query level (WHERE doctorId = ?) |
| NFR-015 | Admin permissions enforced server-side via requireAdminPermission() middleware |
| NFR-016 | All API keys, passwords, and tokens stored as environment secrets (never hardcoded) |
| NFR-017 | OTP codes expire after 10 minutes and are single-use |
| NFR-018 | No SQL injection — all queries parameterized via Drizzle ORM |

### 2.3 Reliability
| ID | Requirement |
|----|------------|
| NFR-020 | WhatsApp message retry mechanism with configurable max retries and rate limit detection |
| NFR-021 | Graceful error handling with user-friendly toast messages on frontend |
| NFR-022 | Database transactions used for atomic multi-table operations |
| NFR-023 | Admin account auto-seeded on every server startup |
| NFR-024 | Plan prices auto-migrated on startup to correct any inconsistencies |
| NFR-025 | WebSocket reconnection handling on frontend |

### 2.4 Usability
| ID | Requirement |
|----|------------|
| NFR-030 | Fully responsive design for desktop (1440px+), tablet (768px+), and mobile (375px+) |
| NFR-031 | Glass morphism UI theme with Medical Blue (HSL 215 90% 45%) color scheme |
| NFR-032 | Plus Jakarta Sans font used consistently throughout the application |
| NFR-033 | shadcn/ui component library (50+ atomic components) for design consistency |
| NFR-034 | Toast notifications for all user actions (success, error, loading states) |
| NFR-035 | Loading skeletons for data-heavy pages |

### 2.5 Scalability
| ID | Requirement |
|----|------------|
| NFR-040 | PostgreSQL database supports horizontal read scaling |
| NFR-041 | Stateless API design allows horizontal server scaling |
| NFR-042 | Autoscale deployment via Replit Deployments |

---

## 3. System Features Summary

| # | Feature | Type | Description |
|---|---------|------|-------------|
| 1 | AI Audio Transcription | Core | Real-time Whisper transcription with chunk-based streaming |
| 2 | AI Clinical Extraction | Core | GPT-4o extracts structured clinical data from transcripts |
| 3 | Care Plan Generation | Core | Automated care plans with medicines, tests, follow-ups |
| 4 | Prescription PDF | Core | Professional PDF with doctor branding and secure shareable links |
| 5 | WhatsApp Automation | Core | Automated medicine reminders and prescription delivery |
| 6 | Multi-Language Support | Core | 15+ language translations for medical terms and prescriptions |
| 7 | Lab Report Analysis | Advanced | AI value extraction and abnormal marker detection from lab reports |
| 8 | Medicine Alternatives | Advanced | AI-powered generic/cost-effective alternative medicine suggestions |
| 9 | Adherence Tracking | Advanced | Daily medicine compliance monitoring per patient per medicine |
| 10 | SaaS Subscription Platform | Platform | Subscription plans, billing, invoices, coupons, feature gating |
| 11 | Admin Analytics Dashboard | Platform | Real-time platform metrics with drill-down doctor-level details |
| 12 | Telehealth | Advanced | Video consultations with integrated clinical note-taking |
| 13 | Voice Store | Advanced | Doctor voice registration for AI speaker identification |
| 14 | Aadhaar OCR | Advanced | Auto-fill patient details from Aadhaar card images via AI vision |
| 15 | Email OTP Recovery | Core | Password recovery via 6-digit OTP with branded email template |
| 16 | Practice Reports | Standard | Daily/weekly/monthly summary reports with export and print |
| 17 | Medical News Feed | Standard | AI-curated medical news articles and research updates |
| 18 | Full-text Search | Standard | Search across patients, visits, and care plans |

---

## 4. Use Cases

### UC-001: New Patient Consultation
**Actor:** Doctor
**Precondition:** Doctor is logged in with active subscription and available AI minutes
**Main Flow:**
1. Doctor clicks "New Visit" from dashboard or sidebar
2. Doctor selects "New Patient" and enters patient details (or uses Aadhaar OCR)
3. Doctor fills the medical history form (conditions, allergies, surgeries, etc.)
4. Patient gives consent; doctor clicks "Start Consultation"
5. System requests microphone permission and begins audio recording
6. Real-time timer displays in MM:SS format; waveform visualization shows audio input
7. Doctor conducts consultation (speaks naturally with patient)
8. Doctor clicks "Stop & Process"
9. System sends audio chunks to OpenAI Whisper for transcription
10. System sends transcript + patient history to GPT-4o for clinical extraction
11. AI returns structured data: symptoms, diagnosis, medicines, tests, follow-ups
12. Doctor reviews extracted data in tabbed view (Medicines | Tests | Follow-up | Transcript)
13. Doctor adds, edits, or removes items as needed
14. Doctor clicks "Approve" to finalize the care plan
15. System creates care events for medicine reminders
16. Doctor opens Print/Share modal and shares via WhatsApp, Email, or SMS

**Postcondition:** Visit saved as "approved", care events created, prescription shareable

### UC-002: Returning Patient Visit
**Actor:** Doctor
**Precondition:** Patient exists in doctor's database
**Main Flow:**
1. Doctor clicks "New Visit"
2. Doctor selects "Existing Patient" and searches by name
3. System shows matching patients with basic info
4. Doctor selects the patient
5. System detects returning patient and shows previous visit context
6. Consultation proceeds same as UC-001 steps 4-16
7. AI extraction includes previous medical history for continuity

### UC-003: Password Recovery via OTP
**Actor:** Doctor
**Precondition:** Doctor has a registered account with valid email
**Main Flow:**
1. Doctor clicks "Forgot Password?" on login page
2. Doctor enters registered email address
3. System generates 6-digit OTP, stores it with 10-minute expiry
4. System sends OTP via Gmail SMTP in branded email template
5. Doctor receives email and enters OTP on the recovery page
6. Doctor enters new password (minimum 8 characters, must contain letter + number)
7. Doctor confirms new password
8. System validates OTP, hashes new password, updates account
9. Doctor redirected to login page with success message

**Alternative Flow:**
- 3a. Email not found → System returns generic success message (security: no email enumeration)
- 5a. OTP expired → Error message, doctor can click "Resend OTP"
- 5b. Wrong OTP → Error message "Invalid or expired reset link"

### UC-004: Admin Manages Doctor Registrations
**Actor:** Admin (Super Admin or Operations Admin)
**Main Flow:**
1. Admin logs in and views dashboard
2. Dashboard shows count of pending doctor registrations
3. Admin navigates to Doctors tab
4. Admin sees list of pending doctors with details: name, email, specialization, license number, qualifications
5. Admin reviews credentials
6. Admin clicks "Approve" to activate the doctor's account
7. System records action in audit log: `createAuditLog(adminId, 'approve_doctor', 'doctor', doctorId)`
8. Doctor can now log in and access the platform

**Alternative Flow:**
- 6a. Admin clicks "Reject" → Doctor status set to "rejected", audit log recorded

### UC-005: Subscription Upgrade Flow
**Actor:** Doctor + Admin
**Main Flow:**
1. Doctor's trial expires or AI minutes exhausted
2. Doctor sees "Free Demo Minutes Complete" banner with upgrade prompt
3. Doctor navigates to Upgrade Plan page
4. Doctor views available plans with feature comparison
5. Doctor selects desired plan and submits upgrade request
6. System creates upgrade_request record with status "pending"
7. Admin sees persistent violet notification banner across all admin pages
8. Admin sidebar badge shows pending request count (refreshed every 30 seconds)
9. Admin navigates to upgrade requests section
10. Admin reviews the request and clicks "Approve"
11. System creates/updates doctor_subscription record
12. Doctor's plan features are immediately updated
13. AI features become accessible again
14. Audit log records the approval action
