# UI/UX Documentation
## CarePath AI

---

## 1. Wireframes & Design Descriptions

### 1.1 Login Page
- Full-screen gradient background with animated glass orbs (floating gradient spheres)
- Centered glass-morphism card with semi-transparent background
- CarePath AI logo: Activity (heartbeat) icon + Stethoscope icon + Shield icon
- "CarePath AI" title with gradient text (cyan → blue → violet)
- "Powered by Codelyne Technologies" subtitle
- Email input field with Mail icon prefix
- Password input field with Lock icon prefix and show/hide toggle
- "Forgot Password?" link (right-aligned, blue text)
- Full-width gradient "Sign In" button (cyan-500 → blue-600 → violet-600)
- "New doctor? Register as Doctor" link at bottom
- Glass morphism styling: bg-white/60, border-white/50, backdrop-blur

### 1.2 Registration Page
- Similar glass-morphism layout to login
- Multi-field form: Name, Email, Phone, Password, Specialization, License Number, Clinic Name, Clinic Address, Qualifications, Experience
- Plan selection cards showing available subscription tiers with pricing
- Country/Region selector for regional pricing
- Gradient "Register" button
- "Already have an account? Sign In" link

### 1.3 Forgot Password (OTP Flow)
- **Step 1 — Email Entry**: Email input with "Send Verification Code" button
- **Step 2 — OTP + Reset**: Blue info banner showing "Verification code sent to [email]", 6-digit OTP input (monospace font, centered, large text), New Password field with validation indicators (8+ chars, letter + number), Confirm Password field with match indicator, "Reset Password" button, "Didn't receive OTP? Resend" link
- **Step 3 — Success**: Green checkmark animation, "Password Reset Successful" message, "Sign In" button

### 1.4 Doctor Dashboard
- **Sidebar**: CarePath AI branding, doctor name + photo, navigation links with icons, gradient active state indicator
- **Stats Row**: 4 animated stat cards — Total Patients, Today's Visits, Active Care Plans, Adherence Rate
  - Each card: gradient icon container, large number, label, subtle animation on data change
- **Performance Metrics**: 3 circular/bar metrics — Medicine Adherence %, Follow-up Completion %, Reduced OPD Load %
- **Today's Patients**: List with patient name, time, status badge, quick-action buttons (View, Start Visit)
- **Recent Activity**: Timeline of recent actions (new visits, approvals, shares)

### 1.5 New Visit Page
- Patient selection: "New Patient" vs "Existing Patient" toggle cards
- **New Patient**: Manual entry form (name, age, gender, phone, WhatsApp) + "Scan Aadhaar" button
- **Existing Patient**: Search input with live results dropdown
- Consent checkbox before proceeding
- After patient selected → Medical History Form (expandable sections for each category)
- Language defaults to English (selector hidden)
- "Continue to Consultation" button

### 1.6 Active Visit (Consultation Page)
- **Header**: Patient name, age, gender badge, language indicator, visit status badge
- **Pre-Recording State**: Large microphone card with "Start Consultation" button, doctor photo, instructions
- **Recording State**: 
  - Red pulsing recording indicator
  - Real-time timer in large monospace font (00:00)
  - Audio waveform visualization (animated bars)
  - "Consultation in Progress" label
  - "Stop & Process" button (primary) + "Cancel" button (secondary)
- **Processing State**: AI extraction animation with rotating stages (Analyzing transcript → Extracting symptoms → Identifying medicines → Generating care plan)
- **Review State**: Tabbed interface:
  - **Medicines Tab**: Editable table (name, dose, frequency, timing, duration, instructions) + Add button
  - **Tests Tab**: Editable table (name, urgency, when to do, fasting) + Add button
  - **Follow Up Tab**: Days input, date picker, warning signs tags, notes textarea
  - **Transcript Tab**: Full transcript text, speaker diarization toggle
- **Bottom Bar**: "Approve" button (green), "Print / Share" modal trigger
- **Share Modal**: WhatsApp, Email, SMS buttons with pre-formatted messages; Copy Link button

### 1.7 Admin Dashboard
- **Sidebar**: "CarePath Admin" branding with admin profile, navigation with badge counts
- **Top Banner**: Violet alert when pending upgrade requests exist (persistent across all admin routes)
- **Stats Row**: Total Doctors, Pending Approvals, Total Patients, Total Visits, Today's Visits
- **Analytics Cards** (clickable): Active Subscriptions, Trial Accounts, Monthly Revenue (₹), AI Minutes Used
  - Click → Detail dialog with doctor-level breakdown table
- **Tabs**: Overview | Doctors | Doctor Data | Care Plans | WhatsApp Status
  - **Doctors Tab**: Table with name, email, specialization, status badge, approve/reject buttons
  - **Doctor Data Tab**: Select doctor → see their patients and visits
  - **WhatsApp Tab**: Delivery stats, failed message logs with retry info

### 1.8 Plan Management (Admin)
- Plan cards with: name, type, monthly/annual price, AI minutes, doctors included
- Create/Edit plan modal with all configuration fields
- Feature management per plan (add/edit/remove plan features)
- Regional pricing table with country, region, multiplier, currency
- Plan activation/deactivation toggle

### 1.9 Doctor Subscriptions (Admin)
- Table: Doctor name, plan, status badge, billing cycle, start date, expiry, AI usage
- Action dropdown per row: View Details, Suspend, Cancel, Activate, Extend
- Status badges: Active (green), Trial (blue), Suspended (amber), Cancelled (red), Expired (gray)

### 1.10 Patient Portal
- Search/filter bar at top
- Patient cards or table with: name, age, gender, phone, visit count, last visit date
- Click patient → Detailed view with:
  - Patient info summary
  - Medical history accordion
  - Visit timeline (all visits chronologically)
  - Each visit expandable: medicines, tests, follow-ups, transcript

---

## 2. Design System

### 2.1 Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| **Primary (Medical Blue)** | HSL(215, 90%, 45%) / #0B6BCB | Primary buttons, links, active states, branding |
| **Gradient Primary** | cyan-500 → blue-600 → violet-600 | Login/Register buttons, card headers, hero elements |
| **Gradient Accent** | emerald-400 → teal-500 → cyan-500 | Success states, health indicators |
| **Success** | Emerald-500 | Approved status, adherence "Taken", successful actions |
| **Warning** | Amber/Yellow-500 | Trial warnings, pending states, expiry alerts |
| **Destructive** | Red-500/600 | Delete actions, errors, "Missed" adherence, recording active |
| **Violet** | Violet-600 | Upgrade prompts, subscription notifications |
| **Background** | Glass morphism (white/60 to white/80 overlays) | Cards, modals, form inputs |
| **Glass Orbs** | Animated gradient spheres (blue, purple, cyan) | Background decoration on auth pages |
| **Muted** | Slate-400/500 | Secondary text, labels, borders |

### 2.2 Typography
| Element | Font | Weight | Size |
|---------|------|--------|------|
| **Primary Font** | Plus Jakarta Sans | — | — |
| **Page Titles** | Plus Jakarta Sans | 700 (Bold) | 2xl-3xl (1.5-1.875rem) |
| **Section Headers** | Plus Jakarta Sans | 600 (Semi-Bold) | lg-xl (1.125-1.25rem) |
| **Body Text** | Plus Jakarta Sans | 400 (Regular) | sm-base (0.875-1rem) |
| **Small Text/Labels** | Plus Jakarta Sans | 500 (Medium) | xs-sm (0.75-0.875rem) |
| **Mono (Timer/OTP)** | System Monospace / Courier New | 800 (Extra-Bold) | 4xl-6xl |
| **Gradient Text** | Plus Jakarta Sans + gradient-text-health CSS class | 700 | Varies |

### 2.3 Component Library (shadcn/ui)
| Component | Usage |
|-----------|-------|
| Button | Primary, secondary, destructive, ghost, outline variants |
| Card | Glass-morphism containers with CardHeader, CardContent, CardFooter |
| Dialog | Modal overlays for detail views, confirmations, forms |
| Input | Form fields with icon prefixes and validation states |
| Select | Dropdown selectors (language, plan, status filters) |
| Tabs | Tabbed navigation (visit data, admin dashboard sections) |
| Badge | Status indicators (Approved, Draft, Active, Trial, Expired) |
| Table | Data tables with sortable columns and action buttons |
| Toast | Success/error/info notifications (via Sonner) |
| Alert | Inline messages (info banners, warning prompts) |
| Accordion | Expandable sections (medical history, patient details) |
| Calendar | Date picker for follow-ups and reports |
| Skeleton | Loading placeholder animations |
| Progress | AI processing progress, adherence percentages |
| Tooltip | Hover information for icons and abbreviated text |
| DropdownMenu | Action menus (subscription management, share options) |

### 2.4 Design Principles
1. **Glass Morphism**: Semi-transparent cards (bg-white/60) with backdrop-blur and gradient orb backgrounds
2. **Gradient Icons**: Icon containers with multi-color gradients (cyan→blue→violet) on stat cards and page headers
3. **Animated Elements**: Heartbeat animation on health icons, pulse on status indicators, hover scale on cards
4. **Medical Trust**: Blue-dominant palette conveying professionalism, reliability, and healthcare authority
5. **Mobile-First Responsive**: All layouts adapt from mobile (375px) to desktop (1440px+)
6. **Consistent Spacing**: 4px grid system, 16px base padding, 24px section gaps
7. **Visual Hierarchy**: Large stat numbers → section headers → body text → muted labels

---

## 3. User Flows

### 3.1 Doctor Onboarding Flow
```
Register Page → Fill Details → Select Plan → Submit
        ↓
  Status: "Pending"
        ↓
Admin Reviews → Approve / Reject
        ↓ (if approved)
Doctor Logs In → Dashboard → 7-Day Trial Active
        ↓
First Visit → Record → AI Extract → Review → Approve → Share Prescription
```

### 3.2 Full Consultation Flow
```
Dashboard → "New Visit" Button
        ↓
New Patient (Manual Entry / Aadhaar OCR)  OR  Existing Patient (Search)
        ↓
Medical History Form → Consent Checkbox
        ↓
"Start Consultation" → Microphone Permission
        ↓
Audio Recording → Real-time Timer → Waveform Visualization
        ↓
"Stop & Process" → AI Processing Animation
        ↓
Review: Medicines Tab | Tests Tab | Follow-Up Tab | Transcript Tab
        ↓
Add / Edit / Delete Items → "Approve" Care Plan
        ↓
Print / Share Modal → WhatsApp / Email / SMS / Copy Link / Print
```

### 3.3 Admin Management Flow
```
Admin Login → Admin Dashboard (Stats + Analytics)
        ↓
Check Notifications → Pending Doctors / Upgrade Requests
        ↓
Approve/Reject Doctors → View Doctor Data → Manage Subscriptions
        ↓
Plan Management → Create/Edit Plans → Configure Features
        ↓
Billing → Generate Invoices → Manage Coupons
        ↓
Audit Logs → Review All Actions
```

### 3.4 Password Recovery Flow
```
Login Page → "Forgot Password?" Link
        ↓
Enter Email → "Send Verification Code"
        ↓
Check Email → Enter 6-Digit OTP
        ↓
Enter New Password + Confirm → "Reset Password"
        ↓
Success → "Sign In" → Login Page
```

### 3.5 Subscription Upgrade Flow
```
Trial Expires / AI Minutes Exhausted
        ↓
"Free Demo Minutes Complete" Banner → "Upgrade" Button
        ↓
Upgrade Plan Page → Compare Plans → Select Plan → Submit Request
        ↓
Admin Notification Banner → Review Request → Approve/Reject
        ↓ (if approved)
Subscription Updated → Features Unlocked → AI Available
```

---

## 4. Screen List

### Doctor Screens (18 screens)
| # | Screen Name | Route | Description |
|---|-------------|-------|-------------|
| 1 | Login | `/login` | Email/password authentication with glass-morphism design |
| 2 | Register | `/register` | Doctor registration with plan selection |
| 3 | Forgot Password | `/forgot-password` | 2-step OTP recovery flow |
| 4 | Reset Password | `/reset-password` | Token-based password reset (fallback) |
| 5 | Dashboard | `/` | Stats, today's patients, performance metrics, recent activity |
| 6 | New Visit | `/new-visit` | Patient selection, medical history, consultation start |
| 7 | Active Visit | `/visit/:id` | Recording, AI extraction, care plan editing, approval, sharing |
| 8 | Active Care | `/active-care` | List of active care plans and pending drafts |
| 9 | Patient Portal | `/patients` | Patient database with drill-down visit history |
| 10 | Adherence | `/adherence` | Medicine compliance tracking per patient per medicine |
| 11 | Calendar | `/calendar` | Appointments, follow-ups, medicine end dates |
| 12 | Reports | `/reports` | Daily/weekly/monthly practice reports with export |
| 13 | Search | `/search` | Full-text search across patients, visits, care plans |
| 14 | Doctor Profile | `/profile` | Personal info, clinic details, photo management |
| 15 | Upgrade Plan | `/upgrade-plan` | Plan comparison and upgrade request submission |
| 16 | Telehealth | `/telehealth` | Video consultation with integrated notes |
| 17 | Dr Voice Store | `/voice-store` | Voice sample recording for AI training |
| 18 | News Feed | `/news` | Medical news, research updates, health tips |

### Admin Screens (6 screens)
| # | Screen Name | Route | Description |
|---|-------------|-------|-------------|
| 1 | Admin Dashboard | `/admin` | Platform analytics, doctor management, multi-tab interface |
| 2 | Plan Management | `/admin/plans` | Subscription plan CRUD, regional pricing management |
| 3 | Doctor Subscriptions | `/admin/subscriptions` | Individual doctor subscription management |
| 4 | Billing Management | `/admin/billing` | Invoices, revenue tracking, coupon management |
| 5 | Admin Roles | `/admin/roles` | Admin account creation and role assignment |
| 6 | 404 Not Found | `*` | Standard error page with return link |
