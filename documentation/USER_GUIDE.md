# CAREPATH AI - User Guide

## Getting Started

### For Doctors

#### Step 1: Register Your Account

1. Open the application and click "Register" on the login page
2. Fill in your details:
   - Full name
   - Email address
   - Password (minimum 6 characters)
   - Phone number
   - Specialization (e.g., General Medicine, Pediatrics)
   - Medical license number
   - Clinic name and address
   - Years of experience
   - Qualifications (e.g., MBBS, MD)
3. Click "Register"
4. You'll see a confirmation message: "Registration successful. Awaiting admin approval."
5. Wait for the admin to approve your account before logging in

#### Step 2: Login

1. Go to the login page
2. Enter your registered email and password
3. Click "Login"
4. You'll be taken to your dashboard

### For Admins

1. Login with admin credentials
2. You'll see the Admin Dashboard with platform statistics
3. Use the sidebar to navigate between Admin sections

---

## Doctor Features

### Dashboard

Your landing page shows:
- **Today's Visits**: Number of consultations today
- **Active Care Plans**: Total approved care plans
- **Pending Approvals**: Drafts awaiting your review
- **Attention Needed**: Items requiring urgent action
- **Recent Visits**: List of your latest patient visits

### Starting a New Patient Visit

1. Click "Patient Visit" in the sidebar
2. Fill in the patient form:
   - **Patient Name**: Full name
   - **Age**: Patient's age
   - **Gender**: Male / Female / Other
   - **Phone Number**: Primary contact
   - **WhatsApp Number**: For prescription sharing (optional)
   - **Language**: Select consultation language (50+ languages supported)
3. **Aadhaar Scan** (optional): Click the Aadhaar scan button to photograph or upload an Aadhaar card - the system will auto-fill name, age, and gender
4. Click "Start Visit"

### Recording a Consultation

1. After starting the visit, you'll see the recording screen
2. Click "Start Recording" - your browser will ask for microphone permission
3. Speak naturally in any supported language
4. You'll see:
   - Audio level visualization (waveform)
   - Live transcript appearing as you speak
5. Click "Stop Recording" when done
6. The system will:
   - Complete the transcription
   - Extract clinical information using AI
   - Generate a draft care plan
7. You'll be redirected to the review screen

### Language & Translation

- When a consultation language other than English is selected, the AI generates the entire care plan in that language
- Medicine frequencies (e.g., "दिवसातून दोनदा"), timings (e.g., "सकाळी आणि रात्री"), test urgency (e.g., "नियमित"), and trigger conditions are all shown in the selected language
- 12 Indian languages are fully supported for output localization: Hindi, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Bengali, Punjabi, Urdu, Odia, Assamese

### Reviewing the Care Plan

After recording, the AI generates a draft care plan with:

**Consultation Summary**: AI-generated summary using the patient's full name

**Prescribed Medications Table**:
| Column | Description |
|--------|-------------|
| Medicine | Drug name |
| Dosage | Amount (e.g., 650mg) |
| Frequency | How often (e.g., Twice daily) |
| Timing | When to take (e.g., Morning and night, After food) |
| Duration | How long (e.g., 5 days) |

**Actions you can take**:
- **Edit**: Click the pencil icon to modify any medicine's details
- **Delete**: Click the minus icon to remove a medicine
- **Add Medicine**: Click "+ Add Medicine" to add manually
- **Save Draft**: Save changes without approving
- **Approve**: Finalize the care plan (makes it active)

### Approving a Care Plan

1. Review all medicines, tests, and follow-ups
2. Make any necessary edits
3. Click "Approve Care Plan"
4. The plan becomes active and:
   - Care events are created for tracking
   - You can now share the prescription

### Sharing Prescriptions

After approving a care plan:

1. Click "Print/Share" button
2. A share modal appears with options:
   - **WhatsApp**: Opens WhatsApp with pre-filled message + prescription link
   - **Email**: Opens email client with subject and body
   - **Text Message**: Opens SMS with message
   - **Print / Download PDF**: Opens browser print dialog (choose "Save as PDF")
3. The shared link:
   - Is valid for 7 days
   - Can be viewed without login
   - Shows the complete care plan in a printable format

### Generating Reports

1. Click "Reports" in the sidebar
2. Select the period: **Daily**, **Weekly**, or **Monthly**
3. Use the arrow buttons to navigate to different dates
4. View summary statistics:
   - Total Visits, Unique Patients, Approved Plans, Drafts, Medicines, Tests
5. Scroll down to see detailed visit table and prescription summary
6. Click **"Print / Download PDF"** to save the report

### Calendar View

1. Click "Calendar" in the sidebar
2. See a monthly grid with color-coded events:
   - **Blue**: Patient visits
   - **Green**: Follow-up appointments
   - **Orange**: Medication course end dates
3. Navigate between months using arrows

### Medication Adherence Tracking

1. Click "Adherence" in the sidebar
2. Select a patient from the dropdown
3. See a daily grid for each prescribed medicine
4. Mark each day as:
   - **Taken** (green)
   - **Missed** (red)
   - **Pending** (gray)
5. View compliance percentage and statistics

### Patient Portal

1. Click "Patient Portal" in the sidebar
2. See all your patients listed
3. Click on a patient to view:
   - Complete visit history
   - Care plan details for each visit
   - Medicines, tests, and follow-ups
4. Click "Edit" to update patient details (phone, conditions, allergies)

### Advanced Search

1. Click "Search" in the sidebar
2. Filter visits by:
   - Patient name (partial match)
   - Status (Draft / Active / Cancelled)
   - Language
   - Date range
3. Results show matching visits with patient details

### Medical News Feed

1. Click "News Feed" in the sidebar
2. See personalized medical articles filtered by your specialization
3. Articles are organized into 5 categories:
   - **Research**: Latest medical research and studies
   - **Health Tips**: Practical health advice and wellness tips
   - **Drug Updates**: New drug approvals, recalls, and safety alerts
   - **Guidelines**: Updated clinical guidelines and protocols
   - **Med Tech**: Medical technology innovations and digital health
4. Click on any article to expand and read the full content

### Forgot Password

1. Click "Forgot Password?" on the login page
2. Enter your registered email address or phone number
3. Receive a password reset link (logged to console in development mode)
4. Click the reset link to open the password reset page
5. Create a new password (minimum 8 characters, at least 1 letter and 1 number)
6. After resetting, return to the login page to sign in with your new password

---

## Admin Features

### Admin Dashboard

- **Platform Statistics**: 6 stat cards showing total doctors, pending, active, visits, patients, approved plans
- **Pending Approvals**: Quick list of doctors waiting for approval

### Doctor Management

1. Go to "Doctor Management" in the sidebar
2. Filter doctors by status: All / Pending / Active / Rejected
3. Click on a doctor to view their full profile
4. Available actions:
   - **Approve**: Allow the doctor to access the platform
   - **Reject**: Deny access
   - **Re-approve**: Re-enable a previously rejected doctor

### Doctor-wise Data Access

1. Go to "Doctor-wise Data" in the sidebar
2. See all doctors with patient and visit counts
3. Click on a doctor to see their patients
4. Click on a patient to see their visits
5. Click on a visit to see the full care plan
6. All data is read-only (admins cannot modify clinical records)

### Audit Log

1. Go to "Audit Log" in the sidebar
2. View a chronological list of all admin actions:
   - Doctor approvals with timestamps
   - Doctor rejections with timestamps
   - Admin login events
3. Each entry shows who performed the action and when

---

## Tips

- **Language Selection**: Choose the correct language before recording for best transcription accuracy
- **Clear Speech**: Speak clearly and mention medicine names, dosages, and durations explicitly
- **Review AI Output**: Always review the AI-generated care plan before approving
- **Save Drafts**: You can save and return to drafts later
- **Share via WhatsApp**: The most popular option for Indian patients
- **Print Reports**: Use the "Print / Download PDF" button for monthly summaries
- **Language Localization**: The entire care plan output (medicines, tests, follow-ups) will be in the language you select during visit creation
- **Mobile Access**: The app is fully responsive — use it on your phone or tablet
