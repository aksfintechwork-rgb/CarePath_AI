# CAREPATH AI - Database Documentation

## Database System

- **Engine**: PostgreSQL (Neon-backed via Replit)
- **ORM**: Drizzle ORM
- **Schema Definition**: `shared/schema.ts`
- **Validation**: Zod schemas via `drizzle-zod`

## Entity-Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │   sessions   │     │admin_audit   │
│              │◄────│              │     │   _logs      │
│  id (PK)     │     │  id (PK)     │     │  id (PK)     │
│  name        │     │  user_id(FK) │     │  admin_id(FK)│
│  email (UQ)  │     │  token (UQ)  │     │  action      │
│  phone       │     │  created_at  │     │  target_type │
│  password_   │     │  expires_at  │     │  target_id   │
│   hash       │     └──────────────┘     │  details     │
│  role        │                          │  created_at  │
│  status      │                          └──────────────┘
│  specializ.. │
│  license_num │
│  clinic_name │
│  clinic_addr │
│  experience  │
│  qualificat. │
│  created_at  │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐     ┌──────────────┐
│   patients   │     │share_tokens  │
│              │     │              │
│  id (PK)     │     │  id (PK)     │
│  name        │     │  visit_id(FK)│
│  age         │     │  token (UQ)  │
│  gender      │     │  created_at  │
│  phone       │     │  expires_at  │
│  whatsapp_   │     └──────────────┘
│   number     │           ▲
│  known_      │           │
│   conditions │           │
│  allergies   │           │
│  doctor_id   │───┐       │
│   (FK→users) │   │       │
│  created_at  │   │       │
└──────┬───────┘   │       │
       │ 1:N       │       │
       ▼           │       │
┌──────────────┐   │       │
│    visits    │◄──┘       │
│              │───────────┘
│  id (PK)     │
│  patient_id  │──── FK → patients
│   (FK)       │
│  doctor_id   │──── FK → users
│   (FK)       │
│  visit_date  │
│  language    │
│  audio_path  │
│  audio_base64│
│  transcript_ │
│   text       │
│  ai_draft_   │
│   json       │
│  approved    │
│  approved_at │
│  status      │
└──────┬───────┘
       │ 1:N (multiple child tables)
       ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  medicines   │  │    tests     │  │  followups   │
│              │  │              │  │              │
│  id (PK)     │  │  id (PK)     │  │  id (PK)     │
│  visit_id(FK)│  │  visit_id(FK)│  │  visit_id(FK)│
│  name        │  │  name        │  │  followup_   │
│  dose        │  │  when_to_do  │  │   after_days │
│  frequency   │  │  urgency     │  │  followup_   │
│  timing      │  │  trigger_    │  │   date       │
│  duration_   │  │   condition  │  │  warning_    │
│   days       │  │  fasting_    │  │   signs[]    │
│  instructions│  │   required   │  │  notes       │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐
│ care_events  │  │adherence_logs│
│              │  │              │
│  id (PK)     │  │  id (PK)     │
│  visit_id(FK)│  │  visit_id(FK)│
│  event_type  │  │  patient_id  │
│  scheduled_  │  │   (FK)       │
│   time       │  │  medicine_id │
│  status      │  │   (FK)       │
│  patient_    │  │  day_number  │
│   response   │  │  status      │
└──────────────┘  │  logged_at   │
                  │  notes       │
                  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│password_reset│  │medicine_     │  │medical_news  │
│  _tokens     │  │  reference   │  │              │
│              │  │              │  │  id (PK)     │
│  id (PK)     │  │  id (PK)     │  │  doctor_id   │
│  user_id(FK) │  │  name        │  │   (FK→users) │
│  token (UQ)  │  │  category    │  │  title       │
│  expires_at  │  │  dosage_form │  │  content     │
│  used        │  │  strength    │  │  category    │
│  created_at  │  │  indication  │  │  source      │
└──────────────┘  └──────────────┘  │  tags[]      │
                                    │  created_at  │
                                    └──────────────┘
```

## Tables Detail

### 1. users

Stores all user accounts (doctors and admins).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Unique identifier |
| name | text | No | - | Full name |
| email | text (UNIQUE) | No | - | Email address |
| phone | text | Yes | null | Phone number |
| password_hash | text | No | - | Bcrypt hashed password (12 rounds) |
| role | text | No | 'doctor' | Role: 'doctor' or 'admin' |
| status | text | No | 'pending' | Status: 'pending', 'approved', 'rejected' |
| specialization | text | Yes | null | Medical specialization |
| license_number | text | Yes | null | Medical license number |
| clinic_name | text | Yes | null | Clinic/hospital name |
| clinic_address | text | Yes | null | Clinic address |
| experience | integer | Yes | null | Years of experience |
| qualifications | text | Yes | null | Medical qualifications |
| created_at | timestamp | Yes | now() | Registration timestamp |

### 2. sessions

Active user sessions for authentication.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Session ID |
| user_id | varchar (FK -> users) | No | - | Associated user |
| token | text (UNIQUE) | No | - | 64-character hex session token |
| created_at | timestamp | Yes | now() | Session creation time |
| expires_at | timestamp | No | - | Session expiry (7 days from creation) |

### 3. patients

Patient records, scoped to individual doctors.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Patient ID |
| name | text | No | - | Full name |
| age | integer | No | - | Age in years |
| gender | text | Yes | null | Gender (Male/Female/Other) |
| phone | text | No | - | Phone number (used for dedup) |
| whatsapp_number | text | Yes | null | WhatsApp number for sharing |
| known_conditions | text | Yes | null | Pre-existing medical conditions |
| allergies | text | Yes | null | Known allergies |
| doctor_id | varchar (FK -> users) | Yes | null | Owning doctor |
| created_at | timestamp | Yes | now() | Record creation time |

### 4. visits

Doctor-patient consultation records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Visit ID |
| patient_id | varchar (FK -> patients) | No | - | Associated patient |
| doctor_id | varchar (FK -> users) | Yes | null | Attending doctor |
| visit_date | timestamp | Yes | now() | Visit date and time |
| language | text | Yes | 'English' | Consultation language |
| audio_path | text | Yes | null | Legacy audio file path |
| audio_base64 | text | Yes | null | Base64-encoded audio recording |
| transcript_text | text | Yes | null | Whisper-generated transcript |
| ai_draft_json | json | Yes | null | GPT-4o extracted clinical data |
| approved | boolean | Yes | false | Whether care plan is approved |
| approved_at | timestamp | Yes | null | Approval timestamp |
| status | text | No | 'draft' | Status: recording, draft, active, cancelled |

### 5. medicines

Prescribed medications for a visit.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Medicine ID |
| visit_id | varchar (FK -> visits) | No | - | Associated visit |
| name | text | No | - | Medicine name |
| dose | text | Yes | null | Dosage (e.g., "650mg") |
| frequency | text | Yes | null | How often (e.g., "Twice daily") |
| timing | text | Yes | null | When to take (e.g., "Morning and night") |
| duration_days | integer | Yes | null | Duration in days |
| instructions | text | Yes | null | Additional instructions / duration text |

### 6. tests

Recommended lab tests and diagnostics.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Test ID |
| visit_id | varchar (FK -> visits) | No | - | Associated visit |
| name | text | No | - | Test name |
| when_to_do | text | Yes | null | When to perform the test |
| urgency | text | Yes | null | Priority: Routine, Urgent, Emergency |
| trigger_condition | text | Yes | null | Condition that triggers the test |
| fasting_required | boolean | Yes | false | Whether fasting is required |

### 7. followups

Follow-up instructions for a visit.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Follow-up ID |
| visit_id | varchar (FK -> visits) | No | - | Associated visit |
| followup_after_days | integer | Yes | null | Days until follow-up |
| followup_date | text | Yes | null | Specific follow-up date |
| warning_signs | text[] | Yes | null | Array of warning signs to watch |
| notes | text | Yes | null | Follow-up instructions |

### 8. care_events

Scheduled care events created on visit approval.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Event ID |
| visit_id | varchar (FK -> visits) | No | - | Associated visit |
| medicine_id | varchar (FK -> medicines) | Yes | null | Specific medicine for this event |
| event_type | text | No | - | Type: medicine, test, followup |
| scheduled_time | timestamp | Yes | null | When the event is scheduled |
| status | text | No | 'pending' | Status: pending, sent, completed, cancelled, failed |
| patient_response | text | Yes | null | Patient's response (taken/missed) |
| whatsapp_message_id | text | Yes | null | Meta API message ID for tracking |

### 9. adherence_logs

Daily medication adherence tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Log ID |
| visit_id | varchar (FK -> visits) | No | - | Associated visit |
| patient_id | varchar (FK -> patients) | No | - | Patient being tracked |
| medicine_id | varchar (FK -> medicines) | Yes | null | Specific medicine |
| day_number | integer | No | - | Day number in the treatment course |
| status | text | No | 'pending' | Status: taken, missed, pending |
| logged_at | timestamp | Yes | now() | When the log was created |
| notes | text | Yes | null | Additional notes |

### 10. share_tokens

Secure shareable links for care plans.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Token ID |
| visit_id | varchar (FK -> visits) | No | - | Associated visit |
| token | text (UNIQUE) | No | - | 64-character hex share token |
| created_at | timestamp | Yes | now() | Token creation time |
| expires_at | timestamp | No | - | Token expiry (7 days from creation) |

### 11. admin_audit_logs

Audit trail for admin actions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Log ID |
| admin_id | varchar (FK -> users) | No | - | Admin who performed the action |
| action | text | No | - | Action type (APPROVE_DOCTOR, REJECT_DOCTOR, ADMIN_LOGIN) |
| target_type | text | No | - | Target entity type (doctor, admin) |
| target_id | varchar | Yes | null | Target entity ID |
| details | text | Yes | null | Human-readable description |
| created_at | timestamp | Yes | now() | Action timestamp |

### 12. whatsapp_message_logs

Tracks all WhatsApp messages sent for medicine reminders.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Log ID |
| care_event_id | varchar (FK -> care_events) | No | - | Associated care event |
| visit_id | varchar (FK -> visits) | No | - | Associated visit |
| patient_id | varchar (FK -> patients) | No | - | Target patient |
| medicine_id | varchar (FK -> medicines) | Yes | null | Medicine being reminded |
| whatsapp_number | text | No | - | Patient's WhatsApp number |
| message_payload | json | Yes | null | Message content sent |
| whatsapp_message_id | text | Yes | null | Meta API message ID |
| status | text | No | 'pending' | pending/sent/delivered/responded/failed |
| retry_count | integer | No | 0 | Number of retry attempts (max 1) |
| sent_at | timestamp | Yes | null | When message was sent |
| delivered_at | timestamp | Yes | null | When message was delivered |
| response_received_at | timestamp | Yes | null | When patient responded |
| patient_response | text | Yes | null | 'taken' or 'missed' |
| error_message | text | Yes | null | Error details if failed |
| created_at | timestamp | Yes | now() | Record creation time |

### 13. conversations

Chat conversations (system use).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | serial (PK) | No | auto-increment | Conversation ID |
| title | text | No | - | Conversation title |
| created_at | timestamp | No | CURRENT_TIMESTAMP | Creation time |

### 13. messages

Messages within conversations (system use).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | serial (PK) | No | auto-increment | Message ID |
| conversation_id | integer (FK -> conversations) | No | - | Parent conversation (CASCADE delete) |
| role | text | No | - | Message role (user, assistant) |
| content | text | No | - | Message content |
| created_at | timestamp | No | CURRENT_TIMESTAMP | Message timestamp |

### 14. password_reset_tokens

Password reset tokens for forgot password flow.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Token ID |
| user_id | varchar (FK -> users) | No | - | User requesting reset |
| token | text (UNIQUE) | No | - | Random hex token |
| expires_at | timestamp | No | - | Token expiry (10 minutes) |
| used | boolean | No | false | Whether token has been used |
| created_at | timestamp | Yes | now() | Creation time |

### 15. medicine_reference

Reference database of 50,000 medicine records for AI matching.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Record ID |
| name | text | No | - | Medicine name |
| category | text | Yes | null | Category (tablet, capsule, syrup, etc.) |
| dosage_form | text | Yes | null | Dosage form |
| strength | text | Yes | null | Strength (e.g., 500mg) |
| indication | text | Yes | null | Primary indication |

### 16. medical_news

AI-generated medical news articles cached per doctor.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar (PK) | No | gen_random_uuid() | Article ID |
| doctor_id | varchar (FK -> users) | No | - | Target doctor |
| title | text | No | - | Article title |
| content | text | No | - | Article body |
| category | text | No | - | Category (Research, Health Tips, etc.) |
| source | text | Yes | null | Attributed source |
| tags | text[] | Yes | null | Article tags |
| created_at | timestamp | Yes | now() | Generation time |

## Key Relationships

| Parent Table | Child Table | Relationship | Foreign Key |
|--------------|-------------|--------------|-------------|
| users | patients | 1:N | patients.doctor_id |
| users | visits | 1:N | visits.doctor_id |
| users | sessions | 1:N | sessions.user_id |
| users | admin_audit_logs | 1:N | admin_audit_logs.admin_id |
| patients | visits | 1:N | visits.patient_id |
| patients | adherence_logs | 1:N | adherence_logs.patient_id |
| visits | medicines | 1:N | medicines.visit_id |
| visits | tests | 1:N | tests.visit_id |
| visits | followups | 1:N | followups.visit_id |
| visits | care_events | 1:N | care_events.visit_id |
| visits | adherence_logs | 1:N | adherence_logs.visit_id |
| visits | share_tokens | 1:N | share_tokens.visit_id |
| visits | whatsapp_message_logs | 1:N | whatsapp_message_logs.visit_id |
| medicines | care_events | 1:N | care_events.medicine_id |
| medicines | adherence_logs | 1:N | adherence_logs.medicine_id |
| medicines | whatsapp_message_logs | 1:N | whatsapp_message_logs.medicine_id |
| patients | whatsapp_message_logs | 1:N | whatsapp_message_logs.patient_id |
| care_events | whatsapp_message_logs | 1:N | whatsapp_message_logs.care_event_id |
| conversations | messages | 1:N | messages.conversation_id (CASCADE) |
| users | password_reset_tokens | 1:N | password_reset_tokens.user_id |
| users | medical_news | 1:N | medical_news.doctor_id |

## Data Isolation

- **Doctor Scope**: Doctors only see patients and visits where `doctor_id` matches their user ID
- **Admin Scope**: Admins can view all data but cannot modify clinical records
- **Patient Dedup**: Patients are matched by phone number within the same doctor's scope

## Schema Migration

```bash
npm run db:push
```

This uses Drizzle Kit to push schema changes to the database. The schema is defined in `shared/schema.ts` and the connection in `server/db.ts`.
