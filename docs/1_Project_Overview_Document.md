# Project Overview Document (POD)
## CarePath AI — Multi-Doctor Care Plan Execution Platform

---

## 1. Project Name
**CarePath AI** (formerly Kaary AI)
- Production Domain: carepath.in / carepathai.in
- Organization: Codelyne Technologies
- GitHub Repository: https://github.com/codelynetechnologies/CarePath-AI

---

## 2. Objective
CarePath AI is a comprehensive medical care management platform designed for Indian doctors and clinics. It streamlines the entire patient consultation lifecycle — from visit recording and AI-powered clinical data extraction, to structured care plan generation, prescription delivery, and patient follow-up management.

**Key Goals:**
- Digitize doctor-patient consultations with real-time AI transcription
- Auto-extract symptoms, diagnosis, medicines, and tests from audio conversations
- Generate structured, multi-language care plans and shareable prescription PDFs
- Automate patient follow-up reminders via WhatsApp
- Provide a full SaaS platform with subscription management, billing, and admin analytics
- Support multi-doctor clinics with role-based access control
- Track medication adherence and reduce OPD load through proactive care

---

## 3. Scope

### In Scope
| Area | Details |
|------|---------|
| Patient Management | Registration, medical history, visit tracking, patient portal |
| AI Consultation | Real-time audio recording, transcription (Whisper), AI extraction (GPT-4o), speaker diarization |
| Care Plans | Medicine prescriptions, lab tests, follow-ups, approval workflows |
| Prescription Sharing | PDF generation, shareable links, WhatsApp/Email/SMS delivery |
| Lab Reports | Upload, AI value extraction, abnormal marker highlighting |
| Multi-Language | 15+ languages including Hindi, Marathi, Tamil, Telugu, Konkani, Malay |
| Medicine Intelligence | Alternative suggestions, salt composition lookup, drug interaction checks |
| WhatsApp Automation | Automated reminders, prescription delivery, patient response tracking |
| SaaS Platform | Subscription plans (Starter/Professional/Clinic Pro/Enterprise), billing, invoices |
| Admin Portal | Doctor management, analytics, audit logs, subscription management, coupon system |
| Adherence Tracking | Medicine compliance monitoring (Taken/Missed/Pending) |
| Telehealth | Video consultation with side-by-side note-taking |
| Reports | Daily/Weekly/Monthly practice summary reports with export |
| Password Recovery | Email-based OTP verification via Gmail SMTP |

### Out of Scope
- Patient-facing mobile app (current system is doctor-facing web app)
- Insurance/claims processing
- Pharmacy inventory management
- EHR/EMR interoperability (HL7/FHIR)
- Appointment booking for walk-in patients
- Laboratory information system (LIS) integration

---

## 4. Timeline

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Core platform: Auth, patients, visits, AI extraction | Completed |
| Phase 2 | Care plans, prescription PDFs, WhatsApp integration | Completed |
| Phase 3 | SaaS: Subscriptions, billing, admin portal | Completed |
| Phase 4 | Advanced features: Lab reports, adherence, telehealth, voice store | Completed |
| Phase 5 | Multi-language support, medicine alternatives, Aadhaar OCR | Completed |
| Phase 6 | OTP email recovery, analytics detail views, UI refinements | Completed |
| Phase 7 | Production deployment, domain setup (carepath.in) | Deployed |

---

## 5. Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS v4, shadcn/ui |
| **Routing** | wouter (client-side) |
| **State Management** | TanStack Query (React Query) |
| **Real-time** | WebSockets (native ws) |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL (Replit Helium) |
| **ORM** | Drizzle ORM with drizzle-zod for validation |
| **AI/ML** | OpenAI GPT-4o (extraction), Whisper (transcription) |
| **Email** | Nodemailer + Gmail SMTP |
| **WhatsApp** | WhatsApp Cloud API (Meta) |
| **PDF Generation** | Server-side HTML-to-PDF rendering |
| **Authentication** | Token-based auth, bcrypt password hashing |
| **Deployment** | Replit Deployments (autoscale) |
| **Font** | Plus Jakarta Sans |
| **Design System** | Glass morphism theme, Medical Blue (HSL 215 90% 45%) |
