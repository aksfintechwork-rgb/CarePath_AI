# CAREPATH AI - Use Cases

## Actors

| Actor | Description |
|-------|-------------|
| **Doctor** | Medical practitioner who conducts patient consultations |
| **Admin** | Platform administrator who manages doctor registrations and oversight |
| **Patient** | The recipient of care (indirect user, data subject) |
| **External Recipient** | Person receiving shared prescription links (family, pharmacist) |

---

## UC-01: Doctor Registration

**Actor**: Doctor
**Precondition**: Doctor has valid medical credentials
**Flow**:
1. Doctor navigates to `/register`
2. Fills in registration form (name, email, password, specialization, license number, clinic details, experience, qualifications)
3. System validates inputs (email format, password min 6 chars, name min 2 chars)
4. System creates user with status "pending"
5. System shows confirmation: "Registration successful. Awaiting admin approval."
6. Doctor cannot login until admin approves

**Postcondition**: Doctor account created with "pending" status

---

## UC-02: Admin Approves Doctor

**Actor**: Admin
**Precondition**: Doctor has registered with "pending" status
**Flow**:
1. Admin logs in and navigates to Admin Dashboard
2. Sees pending doctor registrations in the dashboard or Doctor Management tab
3. Clicks on a pending doctor to view full profile (credentials, specialization, license)
4. Clicks "Approve" button
5. System updates doctor status to "approved"
6. System creates audit log entry: "Approved doctor: Dr. Name (email)"
7. Doctor can now login and use the platform

**Alternate Flow**: Admin clicks "Reject" -> Doctor status set to "rejected" -> Audit log created

---

## UC-03: Doctor Conducts Patient Visit

**Actor**: Doctor
**Precondition**: Doctor is logged in and approved
**Flow**:
1. Doctor clicks "Patient Visit" in sidebar
2. Fills patient intake form:
   - Name, Age, Gender, Phone, WhatsApp number
   - Optional: Upload Aadhaar card for auto-fill (UC-04)
   - Select consultation language (50+ languages)
3. Clicks "Start Visit"
4. System creates patient record (or matches existing by phone number)
5. System creates visit record with status "recording"
6. Recording screen appears with microphone visualization

**Postcondition**: Visit created in "recording" status

---

## UC-04: Aadhaar Card Scanning

**Actor**: Doctor
**Precondition**: Doctor is on the new visit form
**Flow**:
1. Doctor clicks "Scan Aadhaar" button
2. Uploads or photographs Aadhaar card
3. Image sent to backend as base64
4. GPT-4o vision analyzes the card image
5. Extracts name, date of birth, age, gender, Aadhaar number
6. System auto-fills the patient form fields
7. Doctor verifies and adjusts if needed

**Postcondition**: Patient form pre-filled with Aadhaar data

---

## UC-05: Audio Recording & Chunked Transcription

**Actor**: Doctor
**Precondition**: Visit is in "recording" status
**Flow**:
1. Doctor clicks "Start Recording" button
2. Browser requests microphone permission
3. MediaRecorder API captures audio
4. Every 10 seconds, audio chunk is sent to backend
5. Each chunk is transcribed by OpenAI Whisper incrementally
6. Live transcript appears on screen in real-time
7. Doctor sees audio level visualization
8. Doctor clicks "Stop Recording"
9. Remaining audio chunks are flushed
10. System calls `/finalize` endpoint
11. Full audio transcribed by Whisper for best quality (replaces chunk transcript)
12. GPT-4o extracts clinical data from transcript
13. Visit status changes to "draft"
14. Doctor is redirected to review screen

**Alternate Flow**: If microphone unavailable, system generates simulated transcript using GPT-4o

---

## UC-06: Review & Edit AI-Generated Care Plan

**Actor**: Doctor
**Precondition**: Visit has been finalized with AI extraction
**Flow**:
1. Doctor sees the draft care plan with:
   - Consultation summary
   - Diagnosis/complaints
   - Prescribed medications (name, dosage, frequency, timing, duration)
   - Recommended tests
   - Follow-up instructions
   - Diet instructions, precautions, red flags
2. Doctor can edit any field:
   - Click edit icon on a medicine to change name, dose, frequency, timing, duration
   - Add new medicines, tests, or follow-ups
   - Delete incorrect entries
3. Doctor reviews the complete transcript
4. Doctor can save as draft to return later

**Postcondition**: Care plan edited to doctor's satisfaction

---

## UC-07: Approve Care Plan

**Actor**: Doctor
**Precondition**: Care plan is in "draft" status and reviewed
**Flow**:
1. Doctor clicks "Approve Care Plan" button
2. System updates visit status to "active", sets approved=true, records approved_at
3. System creates care events for:
   - Each medicine (daily events for duration_days)
   - Each test (one-time event)
   - Each follow-up (scheduled event after followup_after_days)
4. WebSocket broadcasts update to all connected clients
5. Care plan is now active for patient tracking

**Postcondition**: Visit status = "active", care events created

---

## UC-08: Share Prescription via WhatsApp/Email/SMS

**Actor**: Doctor
**Precondition**: Care plan is approved (active status)
**Flow**:
1. Doctor clicks "Print/Share" button on the care plan
2. Share modal appears with options: WhatsApp, Email, Text Message, Print/Download PDF
3. System generates a secure share token (64-char hex, 7-day expiry)
4. System creates shareable URL: `/share/<token>`
5. **WhatsApp**: Opens WhatsApp web with pre-filled message including care plan summary and link
6. **Email**: Opens email client with subject, body, and link
7. **SMS**: Opens SMS app with message and link
8. **Print**: Opens print dialog for PDF download
9. Token is reused if sharing the same visit again (no duplicates)

**Postcondition**: Shareable link created and sent

---

## UC-09: View Shared Prescription (External)

**Actor**: External Recipient (family member, pharmacist)
**Precondition**: Has received a valid share link
**Flow**:
1. Recipient clicks the share link
2. System validates token exists and is not expired
3. System verifies the visit is still approved
4. Displays a styled HTML page with:
   - Patient name, visit date, language
   - Clinical summary, diagnosis
   - Medicines table (name, dosage, frequency, timing, instructions)
   - Tests table
   - Follow-up instructions
5. Recipient can print or save as PDF using browser
6. No login required

**Alternate Flow**: If token expired (410) or invalid (404), shows appropriate error message

---

## UC-10: Track Medication Adherence

**Actor**: Doctor
**Precondition**: Care plan is active with prescribed medicines
**Flow**:
1. Doctor navigates to "Adherence" page
2. Selects a patient from the list
3. Sees daily adherence grid for each medicine
4. Marks each day as "Taken", "Missed", or "Pending"
5. System persists adherence log with day_number and status
6. Compliance statistics are calculated:
   - Overall compliance percentage
   - Taken count, Missed count, Pending count
7. Doctor can add notes for individual entries

**Postcondition**: Adherence data recorded and compliance tracked

---

## UC-11: View Reports

**Actor**: Doctor
**Precondition**: Doctor is logged in
**Flow**:
1. Doctor clicks "Reports" in sidebar
2. Reports page loads with daily view (default)
3. Doctor selects period: Daily, Weekly, or Monthly
4. Uses date navigation arrows to browse different dates
5. Sees 6 summary stat cards:
   - Total Visits, Unique Patients, Approved Plans, Drafts, Medicines Prescribed, Tests Ordered
6. Below, detailed visit table shows:
   - Patient name, age, gender
   - Date and time of visit
   - Status (active/draft/cancelled)
   - Chief complaint
   - Diagnosis
   - Number of medicines and tests
7. Prescription summary section shows medicines grouped by visit
8. Doctor clicks "Print / Download PDF" to generate printable report
9. Browser print dialog opens with formatted report

**Postcondition**: Report viewed and optionally downloaded

---

## UC-12: Admin Views Doctor-wise Data

**Actor**: Admin
**Precondition**: Admin is logged in
**Flow**:
1. Admin navigates to "Doctor-wise Data" tab
2. Sees list of all doctors with patient/visit counts
3. Clicks on a doctor to see their patients
4. Clicks on a patient to see their visits
5. Clicks on a visit to see full care plan (medicines, tests, follow-ups)
6. Admin can view but not edit clinical data (read-only enforcement)

**Postcondition**: Admin has viewed complete drill-down of clinical data

---

## UC-13: View Calendar

**Actor**: Doctor
**Precondition**: Doctor is logged in with existing visits
**Flow**:
1. Doctor navigates to "Calendar" page
2. Sees monthly grid with color-coded events:
   - Blue: Patient visits
   - Green: Follow-up appointments
   - Orange: Medication end dates
3. Clicks on a day to see event details
4. Can navigate between months

**Postcondition**: Calendar viewed with all scheduled events

---

## UC-14: Search Visits

**Actor**: Doctor
**Precondition**: Doctor is logged in
**Flow**:
1. Doctor navigates to "Search" page
2. Enters search criteria:
   - Patient name (partial match)
   - Visit status (draft/active/cancelled)
   - Consultation language
   - Date range (from/to)
3. Results display matching visits with patient info
4. Doctor can click on a result to view full visit details

**Postcondition**: Filtered visit results displayed

---

## UC-15: Patient Portal Access

**Actor**: Doctor
**Precondition**: Doctor has patients with visits
**Flow**:
1. Doctor navigates to "Patient Portal"
2. Sees list of all their patients
3. Clicks on a patient to view:
   - Complete visit history
   - Care plan summaries for each visit
   - Medicines, tests, and follow-ups per visit
4. Can update patient details (name, phone, conditions, allergies)

**Postcondition**: Patient information and history viewed/updated

---

## UC-16: Admin Audit Log Review

**Actor**: Admin
**Precondition**: Admin is logged in
**Flow**:
1. Admin navigates to "Audit Log" tab
2. Sees chronological list of all admin actions:
   - Doctor approvals with timestamp
   - Doctor rejections with timestamp
   - Admin login events
3. Each entry shows admin name, action type, target, details, and timestamp

**Postcondition**: Complete audit trail reviewed

---

## UC-17: Telehealth Consultation (Simulated)

**Actor**: Doctor
**Precondition**: Doctor is logged in
**Flow**:
1. Doctor navigates to "Telehealth" page
2. Virtual consultation interface is displayed
3. Doctor can simulate video call experience
4. Interface shows consultation tools and controls

**Note**: This is currently a simulated interface for demonstration purposes.

---

## UC-18: Medical News Feed

**Actor**: Doctor
**Precondition**: Doctor is logged in and approved
**Flow**:
1. Doctor clicks "News Feed" in the sidebar
2. System fetches AI-curated medical news articles filtered by the doctor's specialization
3. Articles are displayed organized by 5 categories: Research, Health Tips, Drug Updates, Guidelines, Med Tech
4. Doctor clicks on an article to expand and read the full content
5. Articles are personalized based on the doctor's registered specialization

**Postcondition**: Doctor has viewed personalized medical news articles

---

## UC-19: Forgot Password

**Actor**: Doctor
**Precondition**: Doctor has a registered account
**Flow**:
1. Doctor clicks "Forgot Password?" on the login page
2. Doctor enters their registered email address or phone number
3. System validates the email/phone exists in the database
4. System generates a secure reset token (crypto.randomBytes, 10-minute expiry)
5. System sends a password reset link (logged to console in development mode)
6. Doctor clicks the reset link
7. Doctor enters a new password (minimum 8 characters, at least 1 letter and 1 number)
8. System validates the token, updates the password, and invalidates the token
9. Doctor is redirected to the login page to sign in with the new password

**Alternate Flow**: If email/phone not found, system shows generic message (does not reveal account existence)

**Postcondition**: Doctor's password is updated and reset token is invalidated

---

## UC-20: WhatsApp Patient Follow-up

**Actor**: System (automated), Patient
**Precondition**: Care plan is approved and patient has a WhatsApp number on file
**Flow**:
1. System schedules automated medicine reminders based on the care plan
2. At the appropriate time, system sends a WhatsApp message via Cloud API with medicine name, dosage, and timing
3. Message includes interactive buttons: "Taken" and "Not Taken"
4. Patient taps the appropriate button to respond
5. System receives the webhook callback and logs the adherence status
6. Adherence data is automatically recorded in the adherence tracking system

**Postcondition**: Patient medication adherence is logged automatically via WhatsApp interaction

---

## UC-21: Multi-Language Care Plan Output

**Actor**: Doctor
**Precondition**: Doctor is on the new visit form
**Flow**:
1. Doctor selects a consultation language (e.g., Hindi, Marathi, Tamil) during visit creation
2. After recording and finalizing, the AI generates the entire care plan in the selected language
3. Medicine frequencies (e.g., "दिवसातून दोनदा"), timings (e.g., "सकाळी आणि रात्री"), test urgency (e.g., "नियमित"), and trigger conditions are output in the selected language
4. Client-side translation dictionary provides additional display translations for medical terms
5. 12 Indian languages are fully supported: Hindi, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Bengali, Punjabi, Urdu, Odia, Assamese
6. If a translation is not available, the original English term is displayed as fallback

**Postcondition**: Complete care plan displayed in the doctor's selected language
