# CAREPATH AI - Project Overview

## About

CAREPATH AI is a multi-doctor care plan execution platform designed for Indian healthcare settings. It streamlines the doctor-patient consultation workflow by leveraging AI to automatically transcribe audio recordings, extract clinical information, and generate structured care plans.

## Key Features

### Core Medical Workflow
- **Real-time Audio Recording**: Capture doctor-patient consultations using the browser microphone via MediaRecorder API
- **Chunked Audio Processing**: Audio is sent to the backend in 10-second chunks, transcribed incrementally using OpenAI Whisper
- **AI Clinical Extraction**: GPT-4o extracts medicines, tests, follow-ups, diagnosis, diet instructions, and precautions from transcripts
- **Structured Care Plans**: Generated care plans include medicines (with dosage, frequency, timing, duration), lab tests, and follow-up instructions
- **Doctor Review & Approval**: Doctors review AI-generated drafts, edit if needed, and approve care plans
- **Medicine Reference Database**: 50,000 medicine records with fuzzy/phonetic matching for improved AI recognition from Whisper transcripts
- **Conditional Lab Test Instructions**: Tests include structured fields — when_to_do, urgency, trigger_condition, fasting_required — for precise clinical guidance

### Multilingual Support
- Supports 50+ languages including English, Hindi, Marathi, Hinglish (mixed), and all Indian regional languages
- Language selection per visit
- AI understands code-switching (mixing languages naturally)
- Dynamic language-aware AI prompts via `getMedicalSystemPrompt(language)` ensuring all output fields are in the consultation language
- Client-side medical term translation system (`translateMedicalTerm()`) covering 12 Indian languages (Hindi, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Bengali, Punjabi, Urdu, Odia, Assamese)
- Complete output localization: ALL patient-facing fields (medicine frequency, timing, test urgency, when_to_do, trigger_condition) translated to consultation language
- 21 test-specific translations per language (Routine, Urgent, trigger conditions, etc.)

### Aadhaar Card Scanning
- Upload or photograph an Aadhaar card
- GPT-4o vision extracts name, age, gender, and Aadhaar number
- Auto-fills patient intake form

### Authentication & Access Control
- Role-based access: Admin and Doctor roles
- Doctor registration flow with admin approval (register -> pending -> approved/rejected)
- Session-based authentication with httpOnly cookies (7-day expiry)
- Bcrypt password hashing with 12 salt rounds

### Admin Portal
- Dashboard with 6 stat cards (total doctors, pending, active, visits, patients, approved plans)
- Doctor Management: view, approve, reject, re-approve doctors
- Doctor-wise Data Access: drill down from Doctor -> Patients -> Visits -> Care Plans
- System Audit Log: tracks all admin actions with timestamps

### Patient Management
- Patient Portal with visit history and care plan summaries
- Patient profile editing (name, age, gender, phone, WhatsApp, conditions, allergies)
- Doctor-scoped data isolation (doctors only see their own patients)

### Reports
- Generate Daily, Weekly, or Monthly reports
- Date navigation with period selector
- Summary stat cards (total visits, unique patients, approved plans, drafts, medicines, tests)
- Detailed visit table with patient info, date/time, status, complaint, diagnosis
- Prescription summary grouped by visit
- Print / Download PDF support

### Shareable Prescriptions
- Generate secure shareable links for approved care plans
- Share via WhatsApp, Email, or Text Message
- Public link with crypto token, 7-day expiry
- Recipients can view and print/save as PDF without login

### Additional Features
- **Calendar View**: Monthly grid with color-coded events (visits, follow-ups, medication end dates)
- **Medication Adherence Tracking**: Daily status grid with compliance stats (taken/missed/pending)
- **Telehealth**: Virtual consultation interface (simulated)
- **Advanced Search**: Filter visits by patient name, status, language, and date range
- **Real-time Updates**: WebSocket push for live query invalidation across all clients
- **Medical News Feed**: AI-curated personalized medical news by specialization (5 categories)
- **Forgot Password**: Secure token-based password reset (10-min expiry, rate-limited)
- **WhatsApp Automation**: Automatic patient follow-up reminders with interactive Taken/Not Taken buttons
- **Responsive Design**: Full mobile responsiveness with collapsible sidebar, responsive tables, single-column forms on mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui, Glass morphism design |
| Routing | Wouter |
| Data Fetching | TanStack Query (React Query) |
| Backend | Express.js 5, TypeScript |
| Database | PostgreSQL (Neon-backed via Replit) |
| ORM | Drizzle ORM |
| Validation | Zod + drizzle-zod |
| AI | OpenAI GPT-4o (extraction, Aadhaar scan), Whisper (transcription) |
| Auth | bcryptjs, httpOnly cookies, custom session management |
| Real-time | WebSocket (ws library) |
| Font | Plus Jakarta Sans |

## Color Scheme

- Primary: Medical Blue (HSL 215 90% 45%) for trust and professionalism
- Glass morphism UI with glass-card, glass-card-strong variants
- Gradient icons and animated stat cards

## Project Structure

```
carepath-ai/
├── client/                  # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   ├── layout.tsx   # Sidebar layout with role-based navigation
│   │   │   └── ui/          # shadcn/ui components
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── use-auth.ts  # Authentication state & actions
│   │   │   └── use-realtime.ts  # WebSocket real-time sync
│   │   ├── pages/           # Route pages (14+ pages)
│   │   │   └── news-feed.tsx  # AI-curated medical news
│   │   ├── lib/             # Utility functions
│   │   │   └── medical-translations.ts  # Client-side medical term translations
│   │   └── App.tsx          # Router setup
│   └── index.html           # HTML entry point
├── server/                  # Backend (Express)
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # All API routes
│   ├── storage.ts           # Database storage interface + Drizzle implementation
│   ├── auth.ts              # Authentication middleware
│   ├── ai-medical.ts        # AI integration (GPT-4o, Whisper)
│   ├── websocket.ts         # WebSocket server
│   ├── whatsapp.ts          # WhatsApp automation & reminders
│   ├── seed-medicines.ts    # Medicine reference database seeder
│   └── db.ts                # Database connection
├── shared/
│   └── schema.ts            # Database schema + Zod types
├── documentation/           # Project documentation
└── package.json             # Dependencies
```

## Credentials (Development)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@carepath.ai | admin123 |
| Admin | admin1@carepath.ai | admin123 |
| Doctor | priya@carepath.ai | doctor123 |
| Doctor | anita@carepath.ai | doctor123 |
| Doctor | rahul@carepath.ai | doctor123 |

## License

MIT
