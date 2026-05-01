# CAREPATH AI

## Overview
CarePath AI is a multi-doctor care plan execution platform built for Indian healthcare practices. It streamlines medical consultations through AI-powered audio transcription, clinical data extraction, and structured care plan generation. The platform supports multi-language interactions (12 Indian languages), robust patient data management, QR-based patient self-registration with Voice AI, WhatsApp automation for follow-ups, and a full SaaS admin portal with subscription management. Production domain: carepath.in. All prices in INR (₹).

## User Preferences
- Medical Blue color scheme (HSL 215 90% 45%) for trust and professionalism
- Plus Jakarta Sans font
- Doctor-first workflow with audio recording and AI extraction capabilities
- Clean, professional UI with shadcn/ui components
- Glass morphism theme with gradient icons and animated stat cards
- Fully responsive design across all devices

## System Architecture
Full-stack application: React frontend, Express.js backend, PostgreSQL database.

**Startup**: `bash start.sh` → runs `npx tsx server/index.ts`

### Frontend
- React 18, Vite, Tailwind v4, wouter (routing), TanStack Query (data fetching)
- WebSockets for real-time queue updates
- shadcn/ui component library

### Backend
- Express.js REST API with integrated WebSocket server
- Token-based auth with bcrypt, role-based access control (doctor, admin)
- Session tokens stored in `sessionStorage` under key `"session_token"`
- Doctor registrations require admin approval

### Database
- PostgreSQL with Drizzle ORM
- 28+ tables: users, sessions, patients, visits, medicines, tests, followups, care_events, adherence_logs, whatsapp_message_logs, share_tokens, voice_samples, diarized_transcripts, prescription_risk_checks, medicine_alternatives, subscription_plans, plan_features, regional_pricing, doctor_subscriptions, ai_usage_logs, invoices, invoice_line_items, coupons, upgrade_requests, admin_audit_logs, password_reset_tokens, medical_news, medicine_reference, conversations, messages

### AI Integration
- OpenAI GPT-4o: clinical extraction, translation, prescriptions, medicine alternatives, lab report analysis, medical news, Aadhaar OCR
- OpenAI Whisper (gpt-4o-mini-transcribe): real-time audio transcription
- Multi-language support: English, Hindi, Marathi, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Urdu, Odia, Assamese, Konkani

## Routes

### Doctor Portal
| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Overview stats, performance metrics, recent visits, QR code |
| Patient Visit | `/new-visit` | Create new visit with patient selection |
| Active Visit | `/visit/:id` | Audio recording, AI extraction, care plan generation |
| Active Care | `/active-care` | Active care plans, pending reviews, upcoming patients (tabs via `?tab=`) |
| Calendar | `/calendar` | Appointment and follow-up calendar |
| Adherence | `/adherence` | Medicine adherence tracking |
| Patient Portal | `/patient-portal` | Patient management and history |
| Telehealth | `/telehealth` | Video consultations |
| Reports | `/reports` | Clinical and practice reports |
| News Feed | `/news-feed` | AI-generated medical news |
| Dr Voice Store | `/dr-voice-store` | Voice samples for speaker diarization |
| Search | `/search` | Full-text patient/visit search |
| Profile | `/profile` | Doctor profile management |
| Upgrade Plan | `/upgrade-plan` | Subscription plan upgrade |

### Admin Portal
| Page | Route | Description |
|------|-------|-------------|
| Admin Dashboard | `/admin` | Platform stats (clickable cards), overview |
| Doctor Management | `/admin/doctors` | Registration verification, approvals |
| Doctor-wise Data | `/admin/doctor-data` | Drill-down into doctor patients/visits |
| Subscription Plans | `/admin/plans` | Plan CRUD management |
| Doctor Subscriptions | `/admin/subscriptions` | Active subscription tracking |
| Billing & Invoices | `/admin/billing` | Invoice generation, coupon management |
| Audit Log | `/admin/audit-log` | Admin action tracking |
| Admin Roles | `/admin/roles` | Granular permission management |

### Public Pages
| Page | Route | Description |
|------|-------|-------------|
| QR Check-in | `/qr/:doctorId` | Patient self-registration with Voice AI |
| Login | `/login` | Doctor/Admin login |
| Register | `/register` | Doctor registration |
| Forgot Password | `/forgot-password` | Password reset request |
| Reset Password | `/reset-password` | Password reset with token |

## Dashboard Navigation
- **Doctor Dashboard** stat cards open **sidebars** (slide-in from right):
  - Total Patients Today → sidebar with today's visits
  - Active Care Plans → sidebar with active status visits
  - Pending Reviews → sidebar with draft status visits
  - Upcoming Patient → sidebar with QR check-in queue
  - Performance Metrics → `/adherence`
- **Admin Dashboard** stat cards are clickable:
  - Total Doctors / Active Doctors → `/admin/doctors`
  - Total Patients / Total Visits → `/admin/doctor-data`

## External Dependencies
- **OpenAI GPT-4o**: AI extraction, transcription, translation, medical news, Aadhaar OCR, medicine alternatives, lab report analysis
- **PostgreSQL**: Primary database
- **WhatsApp Cloud API**: Automated patient follow-ups, prescription PDF delivery
- **Replit AI Integrations**: `javascript_openai_ai_integrations==2.0.0`

## Key Credentials (secrets)
- `GMAIL_APP_PASSWORD`: For email-based password reset (sender: support.carepath@gmail.com)
- Admin login: admin@carepath.ai / admin123

## SaaS Pricing (INR)
- Starter: ₹1,499/mo
- Professional: ₹3,999/mo
- Clinic Pro: ₹8,999/mo
- Enterprise: Custom pricing
- All plans include 7-day free trial with AI minutes limit
