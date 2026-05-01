# CAREPATH AI - API Documentation

## Base URL

```
http://localhost:5000/api
```

## Authentication

All protected routes require a valid `session_token` cookie. The cookie is set automatically on login.

### Authentication Headers

```
Cookie: session_token=<token>
```

---

## Auth Routes (Public)

### POST /api/auth/register

Register a new doctor account.

**Request Body:**
```json
{
  "name": "Dr. John Smith",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+91-9876543210",
  "specialization": "General Medicine",
  "licenseNumber": "MH-12345",
  "clinicName": "City Clinic",
  "clinicAddress": "123 Main Street",
  "experience": 10,
  "qualifications": "MBBS, MD"
}
```

**Response (201):**
```json
{
  "message": "Registration successful. Awaiting admin approval.",
  "user": { "id": "uuid", "name": "Dr. John Smith", "email": "john@example.com", "status": "pending" }
}
```

### POST /api/auth/login

Login with email and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "user": { "id": "uuid", "name": "Dr. John Smith", "role": "doctor", "status": "approved" }
}
```

**Error Responses:**
- `401`: Invalid email or password
- `403`: Account pending approval / Account rejected

### POST /api/auth/forgot-password

Request a password reset token. Always returns success (never reveals account existence).

**Request Body:**
```json
{
  "emailOrPhone": "doctor@example.com"
}
```

**Response (200):**
```json
{
  "message": "If an account exists, a reset link has been sent."
}
```

**Rate Limit:** 5 requests per 15 minutes per IP.

### POST /api/auth/reset-password

Reset password using a valid token.

**Request Body:**
```json
{
  "token": "<reset-token>",
  "newPassword": "newPassword123"
}
```

### POST /api/auth/logout

Logout and clear session.

**Response (200):**
```json
{ "message": "Logged out" }
```

### GET /api/auth/me

Get current authenticated user.

**Response (200):**
```json
{
  "user": { "id": "uuid", "name": "Dr. John Smith", "role": "doctor", "status": "approved" }
}
```

---

## Admin Routes (Admin Only)

All admin routes require `authMiddleware` + `requireRole("admin")`.

### GET /api/admin/stats

Get platform-wide statistics.

**Response:**
```json
{
  "totalDoctors": 3,
  "pendingDoctors": 0,
  "activeDoctors": 3,
  "totalVisits": 25,
  "totalPatients": 19,
  "approvedPlans": 10
}
```

### GET /api/admin/doctors

List all doctors with stats.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Dr. Priya Sharma",
    "email": "priya@carepath.ai",
    "status": "approved",
    "specialization": "General Medicine",
    "totalVisits": 7,
    "totalPatients": 4
  }
]
```

### GET /api/admin/doctors/:id

Get detailed doctor information with visits.

### POST /api/admin/doctors/:id/approve

Approve a pending doctor registration. Creates an audit log entry.

### POST /api/admin/doctors/:id/reject

Reject a doctor registration. Creates an audit log entry.

### GET /api/admin/doctors/:id/patients

Get all patients belonging to a specific doctor, with visit counts.

### GET /api/admin/patients/:id/visits

Get all visits for a specific patient, with medicines, tests, and follow-ups.

### GET /api/admin/audit-logs

Get admin audit log entries.

**Query Parameters:**
- `limit` (optional, default: 100): Number of entries to return

**Response:**
```json
[
  {
    "id": "uuid",
    "adminId": "uuid",
    "adminName": "Admin",
    "action": "APPROVE_DOCTOR",
    "targetType": "doctor",
    "targetId": "uuid",
    "details": "Approved doctor: Dr. Priya Sharma (priya@carepath.ai)",
    "createdAt": "2026-02-10T06:00:00.000Z"
  }
]
```

---

## Protected Routes (Auth Required)

All routes below require `authMiddleware` + `requireApproved`.

### Dashboard

#### GET /api/dashboard

Get dashboard statistics for the logged-in doctor.

**Response:**
```json
{
  "totalToday": 3,
  "activeCare": 5,
  "pendingApprovals": 8,
  "attentionNeeded": 0
}
```

### Patients

#### GET /api/patients

Get all patients (scoped by doctor).

#### GET /api/patients/:id

Get a single patient by ID.

#### POST /api/patients

Create a new patient.

**Request Body:**
```json
{
  "name": "Rajesh Kumar",
  "age": 45,
  "gender": "Male",
  "phone": "9876543210",
  "whatsappNumber": "9876543210",
  "knownConditions": "Diabetes",
  "allergies": "Penicillin",
  "doctorId": "uuid"
}
```

#### PATCH /api/patients/:id

Update patient details. Doctor ownership enforced.

### Visits

#### GET /api/visits

Get all visits (scoped by doctor). Includes patient data.

#### GET /api/visits/:id

Get visit details with patient, medicines, tests, follow-ups, and care events.

#### GET /api/visits/:id/audio

Stream the recorded audio for a visit.

#### POST /api/visits

Create a new visit with patient intake.

**Request Body:**
```json
{
  "patientName": "Rajesh Kumar",
  "patientAge": 45,
  "patientPhone": "9876543210",
  "patientWhatsapp": "9876543210",
  "patientGender": "Male",
  "language": "English"
}
```

#### PATCH /api/visits/:id

Update visit fields.

#### POST /api/visits/:id/approve

Approve a draft care plan. Creates care events for medicines, tests, and follow-ups.

#### POST /api/visits/:id/cancel

Cancel a recording visit.

### Audio Processing

#### POST /api/visits/:id/chunk

Send an audio chunk for incremental transcription.

**Request Body:**
```json
{
  "audio": "<base64-encoded-audio>",
  "chunkIndex": 0
}
```

**Response:**
```json
{
  "chunkIndex": 0,
  "chunkTranscript": "Patient says...",
  "fullTranscript": "Complete transcript so far..."
}
```

#### POST /api/visits/:id/finalize

Finalize visit: complete Whisper transcription + GPT-4o clinical extraction.

**Request Body:**
```json
{
  "fullAudio": "<base64-encoded-full-audio>",
  "hadChunks": true
}
```

#### POST /api/visits/:id/process

Legacy: process visit audio in one step (transcription + extraction).

### Re-Extract Clinical Data

#### POST /api/visits/:id/reextract

Re-process an existing visit with updated AI prompt and language. Deletes existing care_events, medicines, tests, and follow-ups, then re-extracts from the stored transcript.

**Request Body:**
```json
{
  "language": "Marathi"
}
```

**Response (200):**
```json
{
  "message": "Re-extraction complete",
  "visit": { "..." }
}
```

### Medicines

#### POST /api/visits/:visitId/medicines

Add a medicine to a visit.

**Request Body:**
```json
{
  "name": "Paracetamol",
  "dose": "650mg",
  "frequency": "Twice daily",
  "timing": "Morning and night after food",
  "durationDays": 5,
  "instructions": "5 days"
}
```

#### PATCH /api/medicines/:id

Update a medicine.

#### DELETE /api/medicines/:id

Delete a medicine.

### Tests

#### POST /api/visits/:visitId/tests

Add a test to a visit.

#### PATCH /api/tests/:id

Update a test.

#### DELETE /api/tests/:id

Delete a test.

### Follow-ups

#### POST /api/visits/:visitId/followups

Add a follow-up to a visit.

#### PATCH /api/followups/:id

Update a follow-up.

### Search

#### GET /api/search/visits

Search visits with filters.

**Query Parameters:**
- `patientName`: Filter by patient name (partial match)
- `status`: Filter by visit status (draft/active/cancelled)
- `language`: Filter by consultation language
- `dateFrom`: Filter visits after this date
- `dateTo`: Filter visits before this date

### Calendar

#### GET /api/calendar/events

Get calendar events (visits, follow-ups, medication end dates).

### Adherence Tracking

#### GET /api/adherence/patient/:patientId

Get adherence logs for a patient.

#### GET /api/adherence/visit/:visitId

Get adherence logs for a visit.

#### POST /api/adherence

Create or update an adherence log.

**Request Body:**
```json
{
  "visitId": "uuid",
  "patientId": "uuid",
  "medicineId": "uuid",
  "dayNumber": 1,
  "status": "taken",
  "notes": "Taken on time"
}
```

### Aadhaar Scanning

#### POST /api/scan-aadhaar

Scan an Aadhaar card image using GPT-4o vision.

**Request Body:**
```json
{
  "image": "<base64-encoded-image>"
}
```

**Response:**
```json
{
  "name": "Rajesh Kumar",
  "dateOfBirth": "15/03/1980",
  "age": 45,
  "gender": "Male",
  "aadhaarNumber": "1234 5678 9012"
}
```

### Translation

#### POST /api/translate

Translate a transcript to another language.

**Request Body:**
```json
{
  "transcript": "Doctor says...",
  "targetLanguage": "Hindi"
}
```

### Reports

#### GET /api/reports

Generate reports for the logged-in doctor.

**Query Parameters:**
- `period`: `daily`, `weekly`, or `monthly` (default: `daily`)
- `date`: ISO date string (default: today)

**Response:**
```json
{
  "period": "weekly",
  "startDate": "2026-02-09T00:00:00.000Z",
  "endDate": "2026-02-16T00:00:00.000Z",
  "summary": {
    "totalVisits": 7,
    "activeVisits": 3,
    "draftVisits": 4,
    "uniquePatients": 5,
    "totalMedicines": 15,
    "totalTests": 8
  },
  "visits": [
    {
      "visit": { "id": "uuid", "visitDate": "...", "status": "active", "complaint": "...", "diagnosis": [...] },
      "patient": { "id": "uuid", "name": "Rajesh Kumar", "age": 45, "gender": "Male", "phone": "..." },
      "medicines": [...],
      "tests": [...],
      "followups": [...]
    }
  ]
}
```

### Shareable Links

#### POST /api/visits/:id/share

Generate a shareable link for an approved care plan.

**Response:**
```json
{
  "shareUrl": "https://domain.com/share/<token>",
  "token": "<64-char-hex-token>",
  "expiresAt": "2026-02-17T00:00:00.000Z"
}
```

#### GET /share/:token (Public)

View a shared care plan (HTML page, no auth required).

### Password Reset

See [POST /api/auth/forgot-password](#post-apiauthforgot-password) and [POST /api/auth/reset-password](#post-apiauthreset-password) under Auth Routes above.

### Medicine Reference

#### GET /api/medicine-reference/search?q=para

Search medicine reference database. Returns matching medicines.

#### GET /api/medicine-reference/names

Get all unique medicine names from the reference database.

### Medical News

#### GET /api/news

Get cached medical news articles for the logged-in doctor.

#### POST /api/news/generate

Generate fresh AI-curated medical news based on doctor's specialization.

---

### WhatsApp Automation

#### GET /api/webhooks/whatsapp (Public)

Meta webhook verification endpoint. Returns the `hub.challenge` value when `hub.verify_token` matches.

**Query Parameters:**
- `hub.mode` — Must be `subscribe`
- `hub.verify_token` — Must match `WHATSAPP_VERIFY_TOKEN` env var
- `hub.challenge` — Challenge string returned on success

#### POST /api/webhooks/whatsapp (Public)

Receives button reply webhooks from Meta Cloud API. Processes patient responses (Taken / Not Taken) to medicine reminders.

**Webhook Payload** (from Meta):
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "interactive": {
            "type": "button_reply",
            "button_reply": {
              "id": "TAKEN_<careEventId>" | "MISSED_<careEventId>"
            }
          }
        }]
      }
    }]
  }]
}
```

**Processing:**
1. Extracts button ID (`TAKEN_xxx` or `MISSED_xxx`)
2. Updates care_event status to `completed` with patient response
3. Creates adherence_log entry automatically
4. Updates whatsapp_message_log with response timestamp

**Response:**
```json
{
  "processed": true,
  "message": "Response recorded: taken"
}
```

---

### WhatsApp Scheduler

The WhatsApp scheduler runs every 60 seconds and:
1. Finds pending care_events where `scheduled_time <= now()` and `event_type = 'medicine'`
2. Sends interactive WhatsApp messages with Taken/Not Taken buttons
3. Creates whatsapp_message_logs for each sent message
4. Retries failed messages once after 5 minutes

**Environment Variables Required:**
- `WHATSAPP_ACCESS_TOKEN` — Meta Cloud API access token
- `WHATSAPP_PHONE_NUMBER_ID` — WhatsApp Business phone number ID
- `WHATSAPP_VERIFY_TOKEN` — Webhook verification token (default: `carepath_verify_token`)

---

## Error Responses

All errors follow this format:

```json
{
  "message": "Human-readable error message",
  "errors": [] // Optional: Zod validation errors
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (insufficient permissions or pending approval) |
| 404 | Not Found |
| 410 | Gone (expired share link) |
| 500 | Internal Server Error |
