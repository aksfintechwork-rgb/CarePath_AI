# CAREPATH AI - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  React   │  │ TanStack │  │  Wouter  │  │ WebSocket│       │
│  │  19 +    │  │  Query   │  │  Router  │  │  Client  │       │
│  │  Vite 7  │  │          │  │          │  │          │       │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └────┬─────┘       │
│       │              │                           │              │
│       │              │    HTTP REST API           │  WS Push    │
└───────┼──────────────┼───────────────────────────┼──────────────┘
        │              │                           │
        ▼              ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVER (Express.js)                          │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Auth    │  │  Route   │  │  Storage │  │ WebSocket│       │
│  │ Middle-  │  │ Handlers │  │ Interface│  │  Server  │       │
│  │  ware    │  │          │  │          │  │   (ws)   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘       │
│       │              │             │                            │
│       │              │             │                            │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐                     │
│  │  bcrypt  │  │   AI     │  │  Drizzle │                     │
│  │  Session │  │ Medical  │  │   ORM    │                     │
│  │  Mgmt    │  │ Module   │  │          │                     │
│  └──────────┘  └────┬─────┘  └────┬─────┘                     │
│                     │             │                            │
└─────────────────────┼─────────────┼────────────────────────────┘
                      │             │
                      ▼             ▼
              ┌──────────┐  ┌──────────┐
              │  OpenAI  │  │PostgreSQL│
              │  API     │  │ Database │
              │(GPT-4o,  │  │  (Neon)  │
              │ Whisper) │  │          │
              └──────────┘  └──────────┘
```

## Component Architecture

### Frontend Components

```
App.tsx
├── AppRouter (auth check, route protection)
│   ├── LoginPage (/login)
│   ├── RegisterPage (/register)
│   └── AuthenticatedRouter
│       └── Layout (sidebar + main content)
│           ├── Dashboard (/)
│           ├── NewVisit (/new-visit)
│           ├── ActiveVisit (/visit/:id)
│           ├── ActiveCare (/active-care)
│           ├── PatientPortal (/patient-portal)
│           ├── CalendarPage (/calendar)
│           ├── Telehealth (/telehealth)
│           ├── Adherence (/adherence)
│           ├── ReportsPage (/reports)
│           ├── SearchPage (/search)
│           ├── NewsFeedPage (/news-feed)
│           ├── ForgotPassword (/forgot-password)
│           ├── ResetPassword (/reset-password)
│           └── AdminDashboard (/admin/*)
│               ├── Dashboard Tab
│               ├── Doctor Management Tab
│               ├── Doctor-wise Data Tab
│               └── Audit Log Tab
```

### Backend Modules

```
server/
├── index.ts          # Entry point: creates HTTP server, registers routes, starts WS
├── routes.ts         # All API route handlers (thin controllers)
├── storage.ts        # IStorage interface + DatabaseStorage implementation
├── auth.ts           # Authentication: hash, compare, middleware, role checks
├── ai-medical.ts     # OpenAI integration: transcription, extraction, Aadhaar scan
├── websocket.ts      # WebSocket server setup and broadcast helpers
├── whatsapp.ts       # WhatsApp Cloud API, timing parser, scheduler
├── seed-medicines.ts # Medicine reference database seeder
└── db.ts             # Drizzle database connection
```

## Data Flow Diagrams

### Visit Recording Flow

```
Doctor clicks          MediaRecorder         10-sec chunks        Whisper
"Start Recording" ──► captures audio ──► sent to backend ──► transcribes
                                              │                    │
                                              │                    ▼
                                              │            Live transcript
                                              │            shown on screen
                                              │
Doctor clicks                                 │
"Stop Recording" ──► Flush remaining ──► /finalize endpoint
                      chunks                   │
                                              ▼
                                    Full audio re-transcribed
                                    by Whisper (best quality)
                                              │
                                              ▼
                                    GPT-4o extracts clinical
                                    data from transcript
                                              │
                                              ▼
                                    Creates medicines, tests,
                                    follow-ups in database
                                              │
                                              ▼
                                    Visit status → "draft"
                                    Doctor redirected to review
```

### Authentication Flow

```
Registration:
  Doctor ──► POST /api/auth/register ──► Create user (pending) ──► Wait for admin

Login:
  User ──► POST /api/auth/login
           ├── Verify email exists
           ├── Compare password (bcrypt)
           ├── Check status (pending/rejected → 403)
           ├── Generate 64-char hex token
           ├── Create session (7-day expiry)
           ├── Set httpOnly cookie
           └── Return user data

Request:
  Client ──► Cookie: session_token ──► authMiddleware
             ├── Extract token from cookie
             ├── Lookup session in DB
             ├── Check expiry
             ├── Load user
             └── Set req.user ──► requireApproved ──► Route handler
```

### WebSocket Real-time Sync

```
Server Event (e.g., visit updated):
  Route handler ──► broadcastInvalidate(["/api/visits", "/api/dashboard"])
                          │
                          ▼
                    WebSocket server sends to ALL connected clients:
                    { type: "invalidate", keys: ["/api/visits", "/api/dashboard"] }
                          │
                          ▼
                    Client useRealtime() hook receives message
                    ──► queryClient.invalidateQueries({ queryKey: [key] })
                    ──► TanStack Query refetches affected queries
                    ──► UI updates automatically
```

### Translation System

```
Server-side (AI Prompt):
  getMedicalSystemPrompt(language) ──► Dynamic prompt with CRITICAL LANGUAGE RULE
                                       ──► Embeds ${language} in every field instruction
                                       ──► Loads medicine names from reference DB

Client-side (Display):
  translateMedicalTerm(term, language) ──► Lookup in translation dictionary
                                          ──► 12 Indian languages
                                          ──► Covers frequencies, timings, urgency, conditions
                                          ──► Fallback: returns original term if no match
```

## Security Architecture

### Access Control Matrix

| Resource | Doctor (own) | Doctor (other's) | Admin | Public |
|----------|:------------:|:----------------:|:-----:|:------:|
| Own patients | CRUD | - | Read | - |
| Own visits | CRUD | - | Read | - |
| Other doctor's data | - | - | Read | - |
| Medicines/Tests | CRUD | - | Read | - |
| Admin dashboard | - | - | Full | - |
| Doctor management | - | - | Full | - |
| Shared prescription | - | - | - | Read |
| Password reset tokens | - | - | - | Via email/phone |
| Reports | Read (own) | - | - | - |

### Security Measures

1. **Password Storage**: bcrypt with 12 salt rounds
2. **Session Management**: httpOnly cookies (XSS protection), 7-day expiry
3. **Input Validation**: Zod schemas on all request bodies
4. **Data Isolation**: Doctor-scoped queries filter by doctor_id
5. **XSS Prevention**: HTML-escaped output in shared prescriptions
6. **Token Security**: crypto.randomBytes(32) for session and share tokens
7. **Audit Trail**: All admin actions logged with timestamps

## Performance Optimizations

1. **Chunked Audio**: 10-second chunks avoid long upload waits
2. **Optimistic UI Updates**: Immediate visual feedback before server confirms
3. **TanStack Query Caching**: 30s staleTime, refetch on focus
4. **WebSocket Push**: Real-time invalidation instead of polling
5. **GPU-Accelerated CSS**: Hardware-accelerated animations
6. **Audio Base64 Stripping**: audioBase64 excluded from visit list responses
7. **Medicine Reference Fuzzy Matching**: Fuzzy matching against medicine reference DB for AI accuracy
8. **Responsive Design**: Mobile-first breakpoints for phone and tablet access

## Deployment Architecture

```
Replit Environment
├── Nix Runtime (Node.js 20)
├── PostgreSQL (Neon-backed)
├── Express.js (port 5000)
│   ├── Vite dev server (proxied in development)
│   └── Static files (built assets in production)
└── WebSocket server (same HTTP server, upgrade)
```

## Design System

- **Theme**: Glass morphism with Medical Blue (HSL 215 90% 45%)
- **Card Variants**: `glass-card` (light), `glass-card-strong` (prominent)
- **Backgrounds**: `glass-bg` with animated gradient orbs
- **Font**: Plus Jakarta Sans
- **Icons**: Lucide React with gradient backgrounds
- **Component Library**: shadcn/ui (Radix UI primitives + Tailwind CSS)
