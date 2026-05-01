# Business Requirement Document (BRD)
## CarePath AI

---

## 1. Client Requirements

### Primary Client: Indian Doctors & Clinics
CarePath AI is built for individual doctors and multi-doctor clinics in India who need to:

1. **Digitize consultations** — Record doctor-patient conversations and extract clinical data automatically using AI, eliminating manual note-taking during visits
2. **Generate structured prescriptions** — Create professional care plans with medicines, tests, and follow-ups that can be shared digitally via multiple channels
3. **Automate patient follow-ups** — Send WhatsApp reminders for medicines and follow-up appointments without any manual effort from staff
4. **Track medication adherence** — Monitor whether patients are taking prescribed medicines on time
5. **Manage practice efficiently** — View dashboards, reports, and patient history in one centralized platform
6. **Support regional languages** — Handle consultations and prescriptions in Hindi, Marathi, Tamil, Telugu, Konkani, and 10+ other Indian languages
7. **Access from anywhere** — Web-based platform accessible on desktop, tablet, and mobile browsers without installation

### Admin/Platform Requirements
1. **Doctor onboarding** — Approve/reject new doctor registrations with credential verification (license number, specialization)
2. **Subscription management** — Manage SaaS plans, assign subscriptions, handle upgrade requests
3. **Revenue tracking** — Monitor Monthly Recurring Revenue (MRR), billing, invoices, and coupon usage
4. **Platform analytics** — Track total doctors, patients, visits, AI usage, and WhatsApp delivery rates
5. **Audit trail** — Immutable log of all administrative actions for compliance

---

## 2. Business Goals

| Goal | Metric | Target |
|------|--------|--------|
| Reduce consultation documentation time | Time per visit | 50% reduction via AI extraction |
| Improve patient follow-up compliance | Follow-up completion rate | >80% with WhatsApp automation |
| Increase medication adherence | Adherence rate tracking | Visible tracking per medicine per patient |
| Scale to multi-doctor clinics | Doctors per clinic | Up to unlimited (Enterprise plan) |
| Generate recurring revenue | Monthly Recurring Revenue (MRR) | SaaS subscription model in INR |
| Reduce OPD load | Repeat visits for same issue | Track via adherence and follow-up metrics |
| Support vernacular healthcare | Languages supported | 15+ Indian and international languages |
| Minimize prescription errors | Drug interaction detection | AI-powered risk checks before approval |

---

## 3. User Types

### 3.1 Doctor (Primary User)
- **Role in System**: `doctor`
- **Access**: All clinical features (patients, visits, prescriptions, care plans, lab reports, adherence, calendar, reports, telehealth)
- **Registration**: Self-registration → Admin approval required before access is granted
- **Subscription**: Must have an active plan; starts with 7-day trial (20 AI minutes)
- **Key Actions**: Record consultations, generate care plans, share prescriptions, manage patients, view reports, request plan upgrades
- **Data Isolation**: Each doctor sees only their own patients and visits

### 3.2 Admin (Platform Administrator)
- **Role in System**: `admin`
- **Access**: Full admin portal with analytics, doctor management, subscription management
- **Sub-Roles**: 
  - **Super Admin** — Full access to all admin functions
  - **Finance Admin** — Billing, invoices, revenue, coupons
  - **Operations Admin** — Doctor management, subscriptions, plans
  - **Support Admin** — Doctor verification, basic management
  - **Read-Only Admin** — View-only access to analytics and data
- **Key Actions**: Approve doctors, manage subscriptions, view analytics, handle billing, manage coupons, create admin accounts
- **Permissions**: Granular role-based access enforced server-side via `requireAdminPermission()` middleware

### 3.3 Patient (Indirect User)
- **Access**: Receives prescriptions via WhatsApp/Email/SMS; no direct platform login
- **Interaction**: 
  - Views shared prescription PDF via secure, expiring link
  - Receives WhatsApp medicine reminders
  - Responds to WhatsApp messages (Taken/Missed)
- **No Account**: Patients do not have login accounts in the system

---

## 4. Pain Points Addressed

| Pain Point | Current Problem | CarePath AI Solution |
|------------|----------------|---------------------|
| **Manual documentation** | Doctors spend 15-20 minutes per visit writing clinical notes manually | AI auto-extracts symptoms, diagnosis, medicines from audio conversation in seconds |
| **Lost prescriptions** | Paper prescriptions get lost or damaged by patients | Digital PDFs with shareable links accessible anytime via WhatsApp or web |
| **No follow-up tracking** | Patients forget follow-up appointments, doctors have no way to track | Automated WhatsApp reminders with patient response tracking |
| **Language barriers** | Medical records maintained only in English, patients speak regional languages | Multi-language support — prescriptions generated in patient's preferred language |
| **Medicine adherence** | No mechanism to track if patients actually take their prescribed medicines | Daily adherence logging with Taken/Missed/Pending status per medicine |
| **Scattered patient data** | Records spread across multiple paper files, systems, or notebooks | Centralized patient portal with complete visit history and care plan details |
| **Clinic billing chaos** | Manual billing and tracking for multi-doctor clinics is error-prone | Automated invoicing, plan management, revenue tracking, coupon system |
| **Drug interactions** | Doctors may miss dangerous drug combinations, especially in complex cases | AI-powered prescription risk checks and alternative medicine suggestions |
| **Lab report management** | Paper lab reports are hard to track, compare, and reference over time | Digital upload with AI value extraction, abnormal marker detection, and trending |
| **Scalability** | Single-doctor tools do not scale to multi-doctor clinics or hospital chains | Multi-doctor platform with clinic-level subscriptions and admin controls |
| **Password recovery** | Users locked out with no self-service recovery option | Email-based OTP verification for secure password reset |

---

## 5. Revenue Model

### Subscription Plans (INR)

| Plan | Monthly Price | AI Minutes/Month | Doctors Included | Key Features |
|------|--------------|-------------------|------------------|--------------|
| **Trial** | Free (7 days) | 20 minutes total | 1 | Basic features, limited AI |
| **Starter** | ₹1,499/mo | 120 min | 1 | Full features, WhatsApp, PDF prescriptions |
| **Professional** | ₹3,999/mo | 500 min | 3 | Multi-doctor, advanced analytics, priority support |
| **Clinic Pro** | ₹8,999/mo | 2,000 min | 10 | Full clinic management, all features, priority support |
| **Enterprise** | Custom pricing | Unlimited | Unlimited | White-label, custom integrations, dedicated support |

### Additional Revenue Mechanisms
- **Annual billing discount** — Reduced rate for yearly commitment
- **Regional pricing multipliers** — Adjusted pricing for different countries/regions
- **Coupon/discount system** — Promotional codes for targeted campaigns
- **Plan upgrade upsells** — Feature gating encourages upgrades from lower tiers

### Trial to Paid Conversion Flow
1. Doctor registers → 7-day trial with 20 AI minutes
2. After 20 minutes exhausted → "Free Demo Minutes Complete" banner blocks AI features
3. Doctor sees upgrade prompt with plan comparison
4. Doctor submits upgrade request
5. Admin reviews and approves
6. Subscription activated, AI features unlocked
