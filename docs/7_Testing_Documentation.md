# Testing Documentation
## CarePath AI

---

## 1. Test Cases

### 1.1 Authentication Module

| TC ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-001 | Doctor Registration | 1. Go to /register 2. Fill all required fields (name, email, password, specialization, license) 3. Select subscription plan 4. Click Register | Account created with "pending" status; redirected to login with success message | High |
| TC-002 | Registration with Missing Fields | 1. Go to /register 2. Leave required fields empty 3. Submit | Validation errors shown; form not submitted | High |
| TC-003 | Duplicate Email Registration | 1. Register with existing email | Error message "Email already registered" | High |
| TC-004 | Doctor Login (Approved Account) | 1. Go to /login 2. Enter valid email/password 3. Click Sign In | Session token created and stored in sessionStorage; redirected to doctor dashboard | High |
| TC-005 | Login with Invalid Password | 1. Enter correct email + wrong password | Error toast "Invalid credentials" | High |
| TC-006 | Login with Non-existent Email | 1. Enter unregistered email | Error toast "Invalid credentials" (same message, no email enumeration) | High |
| TC-007 | Pending Doctor Login | 1. Register new doctor (status: pending) 2. Try to login before admin approval | Error "Your registration is pending admin approval" | High |
| TC-008 | Rejected Doctor Login | 1. Admin rejects a doctor 2. Doctor tries to login | Error "Your account has been rejected" | High |
| TC-009 | Admin Login | 1. Login with admin@carepath.ai / admin123 | Redirected to admin dashboard | High |
| TC-010 | Forgot Password — Send OTP | 1. Click "Forgot Password?" on login page 2. Enter registered email 3. Click "Send Verification Code" | OTP email sent from support.carepath@gmail.com; UI shows step 2 (OTP entry) | High |
| TC-011 | Forgot Password — Non-existent Email | 1. Enter unregistered email 2. Click Send | Same success message displayed (no email enumeration for security) | Medium |
| TC-012 | Reset Password with Valid OTP | 1. Enter correct 6-digit OTP 2. Enter new password (8+ chars, letter + number) 3. Confirm password matches 4. Click "Reset Password" | Password updated; success message shown; "Sign In" button appears | High |
| TC-013 | Reset Password with Expired OTP | 1. Wait 10+ minutes after OTP sent 2. Enter OTP and new password 3. Submit | Error "Invalid or expired reset link" | Medium |
| TC-014 | Reset Password with Wrong OTP | 1. Enter incorrect 6-digit code 2. Submit | Error "Invalid or expired reset link" | Medium |
| TC-015 | Password Validation | 1. Enter password less than 8 characters 2. Enter password without letter 3. Enter password without number | Validation indicators show red; submit button disabled | Medium |
| TC-016 | Password Confirmation Mismatch | 1. Enter password in both fields with different values | "Passwords don't match" indicator; submit disabled | Medium |
| TC-017 | Resend OTP | 1. On OTP entry step, click "Didn't receive OTP? Resend" | New OTP sent; old OTP invalidated; confirmation shown | Medium |
| TC-018 | Rate Limiting on Forgot Password | 1. Request 6+ password resets in 15 minutes from same IP | Silently rate limited (returns success message but may not send email) | Low |
| TC-019 | Logout | 1. Click user menu / logout in sidebar | Session terminated; sessionStorage cleared; redirected to login page | High |
| TC-020 | Profile Update | 1. Go to /profile 2. Update name, phone, clinic details 3. Save | Profile data updated and reflected in sidebar | Medium |
| TC-021 | Profile Photo Upload | 1. Upload profile photo (JPEG/PNG) | Photo displayed in sidebar, profile page, and prescription PDFs | Medium |
| TC-022 | Profile Photo Delete | 1. Click delete photo button | Photo removed; default avatar shown | Low |

### 1.2 Patient Management

| TC ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-030 | Create New Patient | 1. New Visit → "New Patient" 2. Fill name, age, gender 3. Continue | Patient created in database; proceed to medical history | High |
| TC-031 | Create Patient with WhatsApp Number | 1. Enter WhatsApp number during creation | Number saved; enables WhatsApp prescription sharing | High |
| TC-032 | Search Existing Patient | 1. New Visit → "Existing Patient" 2. Type patient name | Matching patients displayed with age, gender, last visit | High |
| TC-033 | Patient Medical History Form | 1. Fill all 14 medical history fields 2. Save | All fields saved and visible in patient portal | High |
| TC-034 | Partial Medical History | 1. Fill only some history fields 2. Save | Partial data saved; empty fields remain blank | Medium |
| TC-035 | Aadhaar OCR | 1. Click "Scan Aadhaar" 2. Upload Aadhaar card image | AI extracts name, age, gender; auto-fills form fields | Medium |
| TC-036 | Patient Portal View | 1. Go to /patients 2. Click on a patient | Full patient info + all visit history shown chronologically | High |
| TC-037 | Patient Visit Timeline | 1. In patient portal, view visits | Each visit shows date, status badge, medicines count, tests count | Medium |
| TC-038 | Doctor Data Isolation | 1. Login as Doctor A 2. List patients | Only Doctor A's patients visible; Doctor B's patients not shown | High |
| TC-039 | Update Patient Details | 1. Edit patient info (name, phone, etc.) 2. Save | Changes saved and reflected | Medium |

### 1.3 Consultation & AI Extraction

| TC ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-050 | Start Consultation | 1. Select patient → Start visit 2. Click "Start Consultation" | Microphone permission requested; recording begins; timer starts | High |
| TC-051 | Microphone Permission Denied | 1. Click "Start Consultation" 2. Deny microphone permission | Error message explaining microphone is required | High |
| TC-052 | Audio Recording Timer | 1. Start recording 2. Wait 30 seconds | Timer shows 00:30; waveform visualization active | High |
| TC-053 | Stop & Process | 1. Record for 1+ minutes 2. Click "Stop & Process" | Recording stops; AI processing animation starts; extraction begins | High |
| TC-054 | AI Medicine Extraction | 1. Mention "Tab Paracetamol 500mg twice daily after food for 5 days" 2. Process | Medicine extracted: name=Paracetamol, dose=500mg, frequency=Twice daily, timing=After food, duration=5 days | High |
| TC-055 | AI Multiple Medicines | 1. Mention 3+ medicines in consultation 2. Process | All medicines extracted in separate rows | High |
| TC-056 | AI Test Extraction | 1. Mention "Get a CBC test done urgently" 2. Process | Test extracted: name=CBC, urgency=Urgent | High |
| TC-057 | AI Follow-up Extraction | 1. Say "Come back in 5 days if symptoms persist" 2. Process | Follow-up: days=5, warning signs populated | High |
| TC-058 | Manual Add Medicine | 1. After extraction 2. Click "Add Medicine" 3. Fill details | New medicine added to the care plan | High |
| TC-059 | Manual Edit Medicine | 1. Click edit on an extracted medicine 2. Change dose to "250mg" 3. Save | Dose updated to 250mg | High |
| TC-060 | Delete Medicine | 1. Click delete on a medicine row 2. Confirm | Medicine removed from care plan | Medium |
| TC-061 | Manual Add Test | 1. Click "Add Test" 2. Fill test name and details | Test added to care plan | Medium |
| TC-062 | Manual Add Follow-up | 1. Add follow-up with days, date, notes | Follow-up saved with calculated date | Medium |
| TC-063 | Approve Care Plan | 1. Review all extracted/edited data 2. Click "Approve" | Visit status changes to "approved"; care events created for reminders | High |
| TC-064 | Cancel Visit | 1. Click "Cancel" during recording | Visit deleted; redirected to dashboard | Medium |
| TC-065 | Re-extract from Transcript | 1. On an existing visit 2. Click re-extract | AI re-processes existing transcript; new extraction results shown | Medium |
| TC-066 | AI Minutes Consumption | 1. Process a visit 2. Check AI usage | AI minutes deducted from doctor's allocation | High |
| TC-067 | Trial AI Limit Exceeded | 1. Use 20 AI minutes on trial account 2. Try another extraction | 403 error; "Free Demo Minutes Complete" message; upgrade prompt shown | High |

### 1.4 Prescription & Sharing

| TC ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-070 | Generate Prescription PDF | 1. Approve a visit 2. Click "Print / Share" 3. Download PDF | PDF contains: doctor photo, name, qualifications, clinic info, patient details, medicines table, tests, follow-ups | High |
| TC-071 | Share via WhatsApp | 1. Approved visit → Share → WhatsApp | WhatsApp opens with pre-formatted summary (doctor, patient, date, follow-up) + PDF link | High |
| TC-072 | Share Message Format Check | 1. Click any share option 2. Verify message content | Message contains ONLY: Doctor name, Patient name, Visit date, Language, Status, Follow-up date + link. NO clinical details (no medicines, no diagnosis) | High |
| TC-073 | Share via Email | 1. Share → Email | Email client opens with subject and summary body + PDF link | Medium |
| TC-074 | Share via SMS | 1. Share → SMS | SMS app opens with summary + PDF link | Medium |
| TC-075 | Share Link Access (Public) | 1. Copy share link 2. Open in incognito/new browser | Prescription page renders without login required | High |
| TC-076 | Share Link Expiry | 1. Access share link after token expiry | Error page "This link has expired" | Medium |
| TC-077 | Print Prescription | 1. Click "Print / Share" → Print | Browser print dialog with formatted prescription layout (no UI elements) | Medium |

### 1.5 Multi-Language Support

| TC ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-080 | Hindi Translation | 1. Set visit language to Hindi 2. View medicines | "Twice daily" → "दिन में दो बार"; "After food" → "खाने के बाद" | High |
| TC-081 | Marathi Translation | 1. Set to Marathi 2. View | "Once daily" → "दिवसातून एकदा" | High |
| TC-082 | Tamil Translation | 1. Set to Tamil 2. View | "Before food" → "உணவுக்கு முன்" | Medium |
| TC-083 | Goan Konkani (Roman Script) | 1. Set to Goan Konkani 2. View | "Twice daily" → "Disak don favtti" (Roman script, NOT Devanagari) | High |
| TC-084 | Standard Konkani (Devanagari) | 1. Set to Konkani 2. View | Uses Devanagari script for Konkani | Medium |
| TC-085 | Malay (Bahasa Melayu) | 1. Set to Malay 2. View | "After food" → "Selepas makan" | Medium |
| TC-086 | Duration Translation | 1. Hindi selected 2. Check "5 days" duration | "5 दिन" (number preserved, unit translated) | Medium |
| TC-087 | Default Language is English | 1. Start a new visit | Language defaults to "English" automatically | High |
| TC-088 | AI Fallback Translation | 1. Request translation of unusual medical term not in dictionary | AI translates using GPT-4o-mini; result returned | Medium |
| TC-089 | Translation on Prescription PDF | 1. Set language to Hindi 2. Generate PDF | Prescription PDF shows Hindi translated terms | High |

### 1.6 SaaS & Subscriptions

| TC ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-090 | Trial Account Creation | 1. Register new doctor 2. Admin approves | Doctor gets 7-day trial with 20 AI minutes | High |
| TC-091 | Trial AI Minutes Display | 1. Login as trial doctor 2. Check dashboard | Shows "X/20 AI minutes used" | High |
| TC-092 | Trial Limit Enforcement | 1. Use 20 AI minutes on trial 2. Try another extraction | AI features blocked; "Free Demo Minutes Complete" banner | High |
| TC-093 | Feature Gating | 1. Trial user accesses premium-only feature | FeatureGate component shows upgrade message with plan comparison | High |
| TC-094 | View Available Plans | 1. Go to /upgrade-plan | All active plans shown with pricing, features, and comparison | High |
| TC-095 | Submit Upgrade Request | 1. Select target plan 2. Click "Request Upgrade" | Upgrade request created with status "pending" | High |
| TC-096 | View My Upgrade Requests | 1. After submitting request 2. Check recent requests | Shows request status (pending/approved/rejected) | Medium |
| TC-097 | Admin Sees Upgrade Notification | 1. Doctor submits upgrade request 2. Admin views dashboard | Violet notification banner appears at top of all admin pages | High |
| TC-098 | Admin Approves Upgrade | 1. Admin clicks upgrade notification 2. Reviews request 3. Clicks "Approve" | Doctor's subscription updated; features unlocked; audit log recorded | High |
| TC-099 | Admin Rejects Upgrade | 1. Admin clicks "Reject" on upgrade request | Request status changed to "rejected"; doctor notified | Medium |
| TC-100 | Plan Price Display | 1. View plans | Starter=₹1,499/mo, Professional=₹3,999/mo, Clinic Pro=₹8,999/mo | High |

### 1.7 Admin Portal

| TC ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-110 | Admin Dashboard Load | 1. Login as admin 2. Navigate to /admin | Dashboard loads with stats, analytics cards, multi-tab interface | High |
| TC-111 | Stats Accuracy | 1. Compare dashboard stats with actual data | Total Doctors, Active Subscriptions, MRR, AI Minutes match database | High |
| TC-112 | Click Active Subscriptions Card | 1. Click "Active Subscriptions" analytics card | Detail dialog opens showing each doctor with plan, status, dates | High |
| TC-113 | Click Trial Accounts Card | 1. Click "Trial Accounts" card | Dialog shows trial doctors with days remaining, AI minutes used | High |
| TC-114 | Click Monthly Revenue Card | 1. Click "Monthly Revenue" card | Dialog shows revenue breakdown by doctor | Medium |
| TC-115 | Click AI Minutes Card | 1. Click "AI Minutes" card | Dialog shows AI usage per doctor | Medium |
| TC-116 | Approve Pending Doctor | 1. Go to Doctors tab 2. Find pending doctor 3. Click "Approve" | Doctor status → "approved"; audit log created; doctor can now login | High |
| TC-117 | Reject Pending Doctor | 1. Click "Reject" on pending doctor | Doctor status → "rejected"; audit log created | High |
| TC-118 | Doctor Data Drill-down | 1. Go to Doctor Data tab 2. Select a doctor from dropdown | Doctor's patients listed; click patient → see their visits | High |
| TC-119 | Create Subscription Plan | 1. Go to Plan Management 2. Click "Create Plan" 3. Fill all fields 4. Save | New plan created and visible in plan list | High |
| TC-120 | Edit Subscription Plan | 1. Click edit on existing plan 2. Change price 3. Save | Plan updated with new pricing | Medium |
| TC-121 | Clone Subscription Plan | 1. Click clone on existing plan | New plan created as copy with "(Copy)" suffix | Medium |
| TC-122 | Deactivate/Activate Plan | 1. Deactivate a plan | Plan hidden from public listings; 2. Reactivate → visible again | Medium |
| TC-123 | Manage Doctor Subscription | 1. Go to Doctor Subscriptions 2. Click dropdown on a doctor | Options: View Details, Suspend, Cancel, Activate, Extend | Medium |
| TC-124 | Suspend Doctor Subscription | 1. Click "Suspend" on active subscription | Status changes to "suspended"; doctor loses access to paid features | Medium |
| TC-125 | Create Coupon | 1. Go to Billing → Coupons 2. Fill code, discount, validity 3. Save | Coupon created and active | Medium |
| TC-126 | Validate Coupon | 1. Apply coupon code to a plan | Discount calculated and shown | Medium |
| TC-127 | Audit Log Verification | 1. Perform admin action (approve doctor) 2. Check audit logs | Action recorded with: admin ID, "approve_doctor", "doctor", doctor ID, timestamp | High |
| TC-128 | Create Admin Account | 1. Go to Admin Roles 2. Create new admin 3. Assign role | New admin can login with assigned permissions | Medium |
| TC-129 | Admin Role Permissions | 1. Login as Finance Admin 2. Try doctor management | Access denied (Finance Admin cannot manage doctors) | Medium |
| TC-130 | WhatsApp Status Tab | 1. Go to WhatsApp Status tab | Shows today's sent/delivered/failed counts, recent failed messages | Medium |

### 1.8 WhatsApp Integration

| TC ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-140 | Send Prescription via WhatsApp API | 1. Approve visit 2. Click "Send to WhatsApp" 3. Enter patient WhatsApp number | Message sent via WhatsApp Cloud API with prescription link | High |
| TC-141 | WhatsApp Delivery Tracking | 1. Send WhatsApp message 2. Check whatsapp_message_logs | Status tracked: pending → sent → delivered | High |
| TC-142 | WhatsApp Failed Message | 1. Send to invalid number | Status marked as "failed"; retry scheduled | Medium |
| TC-143 | WhatsApp Retry Mechanism | 1. Message fails 2. Wait for scheduler cycle | System retries with incremented retryCount | Medium |
| TC-144 | WhatsApp Rate Limit Detection | 1. Multiple rapid messages trigger rate limit | "Rate limit hit during retries, stopping this cycle" logged; cycle paused | Medium |
| TC-145 | WhatsApp Admin Stats | 1. Admin → WhatsApp tab | Today's counts (sent, delivered, failed) and recent failed messages displayed | Medium |

### 1.9 Additional Features

| TC ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-150 | Lab Report Upload | 1. On approved visit → test section 2. Upload report image/PDF | Report saved and displayed | Medium |
| TC-151 | Lab Report AI Analysis | 1. Upload report 2. Click "Extract Values" | AI extracts lab values; abnormal markers highlighted in red | Medium |
| TC-152 | Medicine Alternatives | 1. On medicine row, click "Find Alternatives" | AI returns 3-5 generic/cheaper alternatives with salt composition | Medium |
| TC-153 | Swap Medicine Alternative | 1. Select an alternative 2. Click "Use This" | Original medicine replaced with selected alternative | Medium |
| TC-154 | Adherence Logging | 1. Go to /adherence 2. Select patient 3. Mark medicine as "Taken" | Adherence log created with status, day number, timestamp | High |
| TC-155 | Calendar View | 1. Go to /calendar | Shows visits (blue), follow-ups (green), medicine end dates (amber) | Medium |
| TC-156 | Daily Report | 1. Go to /reports 2. Select "Daily" 3. Choose date | Report shows patients seen, medicines prescribed, tests ordered | Medium |
| TC-157 | Search Visits | 1. Go to /search 2. Enter patient name 3. Filter by status/date | Matching visits displayed with patient, doctor, date, status | Medium |

---

## 2. Known Issues & Bug Reports

| ID | Issue | Severity | Status | Root Cause | Resolution |
|----|-------|----------|--------|------------|------------|
| BUG-001 | Active Subscriptions detail API returned 500 error | High | Fixed | Incorrect column name: used `doctorSubscriptions.endDate` instead of `doctorSubscriptions.expiresAt` | Updated column reference to `expiresAt` in admin analytics detail endpoints |
| BUG-002 | Trial Accounts detail API returned 500 error | High | Fixed | Same column name issue as BUG-001 | Same fix applied |
| BUG-003 | WhatsApp rate limiting causes retry storms | Medium | Mitigated | Rapid retries trigger Meta API rate limits, causing cascading failures | Added rate limit detection: "Rate limit hit during retries, stopping this cycle" |
| BUG-004 | Konkani translations showed Devanagari script | Low | Fixed | Konkani translations used Devanagari script instead of Roman transliteration | Updated medical-translations.ts with Roman script entries (e.g., "Disak don favtti") |
| BUG-005 | Gmail SMTP "Missing credentials for PLAIN" | High | Fixed | GMAIL_APP_PASSWORD secret was requested but not saved in Replit Secrets | Re-requested and saved the secret; server restarted |
| BUG-006 | Share message included full clinical details | Low | Fixed | Share text message contained medicines, tests, diagnosis | Created `buildShareSummary()` with header-only format (doctor name, patient, date only) |
| BUG-007 | Vite HMR WebSocket connection failing | Low | Known | Replit proxy configuration doesn't support Vite's WebSocket HMR path | Does not affect production; HMR works via page reload |

---

## 3. QA Checklist

### Pre-Release Checklist

#### Authentication & Access
- [ ] Doctor registration creates account with "pending" status
- [ ] Admin can approve and reject doctors
- [ ] Approved doctors can login; pending/rejected cannot
- [ ] Password recovery OTP email sends correctly from support.carepath@gmail.com
- [ ] OTP expires after 10 minutes
- [ ] Password validation enforces 8+ chars with letter + number
- [ ] Logout clears session and redirects to login
- [ ] Admin login works with admin@carepath.ai / admin123
- [ ] Role-based access enforced (doctors cannot access /admin routes)

#### Patient & Visit Management
- [ ] New patient creation works with all fields
- [ ] Existing patient search returns correct results
- [ ] Medical history form saves all 14 fields
- [ ] Audio recording starts, shows timer, and waveform works
- [ ] "Start Consultation" / "Consultation in Progress" text (not "Recording")
- [ ] AI extraction produces medicines, tests, and follow-ups from transcript
- [ ] Manual add/edit/delete works for medicines, tests, follow-ups
- [ ] Care plan approval changes visit status to "approved"
- [ ] Patient portal shows full visit history

#### Prescription & Sharing
- [ ] Prescription PDF generates with doctor photo and clinic branding
- [ ] Share link works in incognito browser (public access)
- [ ] WhatsApp share opens with correct summary format
- [ ] Share message has NO clinical details (only header info + link)
- [ ] Print produces clean, paper-formatted output
- [ ] Email and SMS share options work correctly

#### Multi-Language
- [ ] Hindi translations display correctly
- [ ] Goan Konkani shows Roman script (not Devanagari)
- [ ] Standard Konkani shows Devanagari correctly
- [ ] Malay (Bahasa Melayu) translations work
- [ ] Default language is English when starting new visit
- [ ] Consultation Language dropdown is hidden from new-visit page

#### SaaS Platform
- [ ] Trial accounts have 20 AI minutes limit
- [ ] AI features block after trial minutes exhausted
- [ ] "Free Demo Minutes Complete" message shows with upgrade prompt
- [ ] Feature gating blocks premium features for lower tiers
- [ ] Upgrade request flow works (doctor request → admin approve)
- [ ] Plan prices correct: Starter ₹1,499, Professional ₹3,999, Clinic Pro ₹8,999
- [ ] Admin sees violet notification banner for pending upgrades
- [ ] Sidebar badge shows pending upgrade count

#### Admin Portal
- [ ] Dashboard stats load correctly with 30-second polling
- [ ] All 4 analytics cards are clickable with correct detail data
- [ ] Doctor approval/rejection works with audit logging
- [ ] Doctor data drill-down shows correct patients and visits
- [ ] Subscription plan CRUD works
- [ ] Coupon create/validate/apply works
- [ ] Invoice management works
- [ ] Audit logs record all admin actions

#### WhatsApp Integration
- [ ] WhatsApp messages send via Cloud API
- [ ] Delivery tracking works (pending → sent → delivered)
- [ ] Failed messages retry automatically
- [ ] Rate limit detection stops retry storms
- [ ] Admin WhatsApp status tab shows correct stats

### Security Checklist
- [ ] Passwords hashed with bcrypt (not stored in plaintext)
- [ ] Session tokens in sessionStorage (not localStorage)
- [ ] No session tokens in URL parameters
- [ ] Doctor data isolation enforced (WHERE doctorId = ?)
- [ ] Admin endpoints require admin role (middleware check)
- [ ] Admin sub-roles enforced (Finance cannot manage doctors)
- [ ] Share tokens are cryptographically random
- [ ] OTP is 6 digits, expires in 10 minutes, single-use
- [ ] API keys stored as Replit Secrets (not in source code)
- [ ] No SQL injection (Drizzle ORM parameterized queries)
- [ ] Rate limiting on login and forgot-password endpoints
- [ ] CORS configured appropriately

### Performance Checklist
- [ ] Dashboard loads in < 2 seconds
- [ ] Patient list loads in < 1 second
- [ ] AI extraction completes in < 30 seconds
- [ ] PDF generation completes in < 3 seconds
- [ ] No memory leaks on long recording sessions
- [ ] WebSocket reconnects after disconnect

---

## 4. User Acceptance Testing (UAT)

### Scenario 1: Complete Doctor Consultation Workflow
**Tester:** Doctor role user
**Duration:** 10-15 minutes
**Steps:**
1. Login with approved doctor account
2. Verify dashboard loads with stats and today's patients
3. Click "New Visit" → select "New Patient"
4. Enter: Name="Test Patient", Age=35, Gender=Male, Phone=9876543210
5. Fill medical history: Known Conditions="Hypertension", Allergies="Penicillin"
6. Click "Start Consultation"
7. Speak for 1-2 minutes: "Patient complains of headache and fever since 3 days. Prescribed Tab Paracetamol 500mg twice daily after food for 5 days. Also prescribing Tab Cetirizine 10mg once daily at bedtime for 3 days. Get a CBC test done. Follow up after 5 days."
8. Click "Stop & Process" → wait for AI extraction
9. Verify: 2 medicines extracted (Paracetamol 500mg, Cetirizine 10mg), 1 test (CBC), 1 follow-up (5 days)
10. Edit Paracetamol instructions to "Take with warm water"
11. Click "Approve"
12. Click "Print / Share" → Share via WhatsApp
13. Verify share message: shows doctor name, patient name, date, follow-up date, and PDF link only
14. Open PDF link in new tab → verify prescription format
15. Go to /patients → find Test Patient → verify visit in history
16. Go to /adherence → verify patient's medicines appear
17. Go to /calendar → verify follow-up date is shown

**Pass Criteria:** All steps complete without errors. AI extracts at least the medicines mentioned. PDF is professional with doctor branding. Share message does NOT contain clinical details. Patient appears in portal and adherence tracking.

### Scenario 2: Admin Platform Management Workflow
**Tester:** Admin role user (admin@carepath.ai)
**Duration:** 10 minutes
**Steps:**
1. Login as admin
2. Verify dashboard shows: Total Doctors, Active Subscriptions, MRR (₹), AI Minutes
3. Click "Active Subscriptions" card → verify detail dialog shows doctor list
4. Click "Trial Accounts" card → verify trial doctors shown
5. Click "Monthly Revenue" card → verify revenue data
6. Click "AI Minutes" card → verify usage data
7. Navigate to Doctors tab → find pending doctor → click "Approve"
8. Verify audit log records the approval action
9. Navigate to Doctor Data tab → select an approved doctor → verify patients and visits listed
10. Navigate to Plan Management → create a new plan: "Test Plan", ₹999/mo, 50 AI min, 1 doctor
11. Verify plan appears in the list
12. Navigate to Billing → create a coupon: code="TEST10", 10% discount
13. Verify coupon appears in coupon list
14. Check WhatsApp Status tab for delivery statistics

**Pass Criteria:** All stat cards show correct data and are clickable. Doctor approval works. Drill-down shows correct data. Plan and coupon creation succeed. Audit log records actions.

### Scenario 3: Subscription Trial & Upgrade Flow
**Tester:** New doctor + Admin
**Duration:** 15 minutes
**Steps:**
1. Register a new doctor with email=test@example.com
2. Admin approves the doctor
3. Login as test doctor → verify "Trial" badge and "20 AI minutes" shown
4. Complete a few visits to use some AI minutes
5. Verify AI minutes counter decreases correctly
6. Continue until 20 minutes exhausted
7. Try another AI extraction → verify "Free Demo Minutes Complete" message
8. Verify upgrade prompt appears with plan options
9. Navigate to /upgrade-plan → select "Starter" plan → submit upgrade request
10. Switch to admin account → verify violet notification banner appears
11. Find the upgrade request → click "Approve"
12. Switch back to test doctor → verify features unlocked
13. Try AI extraction → verify it works now

**Pass Criteria:** Trial enforcement works correctly. AI blocks after 20 minutes. Upgrade request flows through admin. Features unlock after approval.

### Scenario 4: Multi-Language Prescription
**Tester:** Doctor
**Duration:** 5 minutes
**Steps:**
1. Create a visit and complete consultation (or use existing approved visit)
2. View the visit in Active Visit page
3. Set language to "Hindi" → verify all medical terms translated to Hindi
4. Verify: "Twice daily" → "दिन में दो बार", "After food" → "खाने के बाद"
5. Change language to "Goan Konkani" → verify Roman script used
6. Verify: "Twice daily" → "Disak don favtti" (NOT Devanagari)
7. Change to "Tamil" → verify Tamil script translations
8. Generate prescription PDF → verify translations appear in PDF
9. Share via WhatsApp → verify message is clean

**Pass Criteria:** All languages show correct translations. Goan Konkani uses Roman script exclusively. Prescription PDF includes translated terms. No mixing of scripts.

### Scenario 5: Password Recovery
**Tester:** Any registered doctor
**Duration:** 3 minutes
**Steps:**
1. Go to login page → click "Forgot Password?"
2. Enter registered email address → click "Send Verification Code"
3. Check email inbox for OTP from support.carepath@gmail.com
4. Verify email has CarePath AI branding with 6-digit code
5. Enter OTP on the recovery page
6. Enter new password meeting requirements (8+ chars, letter + number)
7. Confirm password
8. Click "Reset Password"
9. Verify success message appears
10. Click "Sign In" → login with new password

**Pass Criteria:** OTP email arrives within 30 seconds. Email template is professionally branded. OTP works on first try. New password accepted. Can login with new password.
