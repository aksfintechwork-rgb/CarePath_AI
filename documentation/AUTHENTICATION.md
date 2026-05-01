# CAREPATH AI - Authentication & Authorization

## Overview

CAREPATH AI uses a custom session-based authentication system with role-based access control (RBAC). The system supports two roles: **Doctor** and **Admin**.

## Authentication Module

**File**: `server/auth.ts`

### Password Hashing

- Algorithm: bcrypt
- Salt Rounds: 12
- Library: bcryptjs

```typescript
hashPassword(password: string): Promise<string>
comparePassword(password: string, hash: string): Promise<boolean>
```

### Session Token Generation

- Method: `crypto.randomBytes(32).toString("hex")`
- Result: 64-character hexadecimal token
- Storage: Database `sessions` table
- Client: httpOnly cookie named `session_token`

### Cookie Configuration

| Property | Value |
|----------|-------|
| Name | session_token |
| httpOnly | true |
| secure | false (development) |
| sameSite | lax |
| maxAge | 7 days (604,800,000 ms) |
| path | / |

## Middleware Chain

### authMiddleware

Validates the session token and loads the user.

```
Request → Extract cookie → Lookup session → Check expiry → Load user → Set req.user → Next
```

**Error Responses:**
- No cookie: `401 Not authenticated`
- Expired session: `401 Session expired` (session deleted from DB)
- User not found: `401 User not found`

### requireRole(...roles)

Checks if the authenticated user has one of the required roles.

```typescript
requireRole("admin")  // Only admins
requireRole("admin", "doctor")  // Both roles
```

**Error Responses:**
- No user: `401 Not authenticated`
- Wrong role: `403 Access denied`

### requireApproved

Ensures doctor accounts are approved before accessing protected resources.

```
Check → If doctor AND status !== "approved" → 403 Account pending approval
```

## Roles & Permissions

### Doctor Role

| Permission | Access Level |
|------------|-------------|
| View own patients | Full |
| Create/edit own patients | Full |
| Conduct visits | Full |
| Record audio | Full |
| Review/edit care plans | Full |
| Approve care plans | Full |
| Share prescriptions | Own visits only |
| Generate reports | Own data only |
| View calendar | Own events only |
| Track adherence | Own patients only |
| Search visits | Own visits only |
| View other doctors' data | None |
| Admin functions | None |

### Admin Role

| Permission | Access Level |
|------------|-------------|
| View all doctors | Full |
| Approve/reject doctors | Full |
| View doctor-wise data | Read-only |
| View audit logs | Full |
| Platform statistics | Full |
| Edit clinical data | None (read-only) |
| Conduct visits | None |

## Registration Flow

```
1. POST /api/auth/register
   ├── Validate input (Zod: name min 2, email format, password min 6)
   ├── Check email uniqueness
   ├── Hash password (bcrypt, 12 rounds)
   ├── Create user with role="doctor", status="pending"
   └── Return success message

2. Admin reviews (GET /api/admin/doctors)
   └── Admin approves (POST /api/admin/doctors/:id/approve)
       ├── Update status to "approved"
       └── Create audit log entry

3. Doctor can now login
   └── POST /api/auth/login
       ├── Verify credentials
       ├── Check status is "approved"
       ├── Create session
       └── Set cookie
```

## Login Flow

```
POST /api/auth/login
├── Parse & validate request body (Zod)
├── Look up user by email
│   └── Not found → 401 "Invalid email or password"
├── Compare password with hash
│   └── Mismatch → 401 "Invalid email or password"
├── Check doctor status
│   ├── pending → 403 "Your account is pending admin approval"
│   └── rejected → 403 "Your registration was not approved"
├── Generate session token (crypto.randomBytes(32))
├── Create session in DB (7-day expiry)
├── If admin: create audit log (ADMIN_LOGIN)
├── Set httpOnly cookie
└── Return user data (without passwordHash)
```

## Logout Flow

```
POST /api/auth/logout
├── Extract session_token from cookie
├── Delete session from database
├── Clear cookie
└── Return success
```

## Password Reset Flow

### Forgot Password

```
POST /api/auth/forgot-password
├── Rate limiting: 5 requests per 15 minutes per IP
├── Parse & validate request body (email or phone)
├── Look up user by email or phone
│   └── Not found → Return generic success message (no account enumeration)
├── Generate reset token: crypto.randomBytes(32).toString("hex")
├── Store token in passwordResetTokens table (10-minute expiry)
├── Send reset link with token (logged to console in development mode)
└── Return success message
```

### Reset Password

```
POST /api/auth/reset-password
├── Parse & validate request body (token, newPassword)
├── Validate password requirements:
│   ├── Minimum 8 characters
│   ├── At least 1 letter
│   └── At least 1 number
├── Look up token in passwordResetTokens table
│   └── Not found or expired → 400 "Invalid or expired reset token"
├── Hash new password (bcrypt, 12 rounds)
├── Update user's passwordHash in database
├── Delete the used token (invalidation after use)
├── Delete all existing sessions for the user (force re-login)
└── Return success message (no auto-login after reset)
```

### Password Reset Token Schema

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| userId | integer | Foreign key to users table |
| token | varchar(255) | Unique reset token |
| expiresAt | timestamp | Token expiry (10 minutes from creation) |
| createdAt | timestamp | Token creation time |

**Table**: `passwordResetTokens`

## Session Validation (GET /api/auth/me)

```
GET /api/auth/me
├── Extract session_token from cookie
│   └── No cookie → 401
├── Look up session by token
│   └── Not found or expired → 401 (delete if expired)
├── Look up user by session.userId
│   └── Not found → 401
└── Return user data (without passwordHash)
```

## Data Isolation

Doctors are isolated from each other's data through query-level filtering:

```typescript
// In route handlers:
const doctorId = user.role === "doctor" ? user.id : undefined;
const patients = await storage.getPatients(doctorId);
const visits = await storage.getVisits(doctorId);

// In storage layer:
if (doctorId) {
  return db.select().from(patients).where(eq(patients.doctorId, doctorId));
}
```

## Audit Logging

Admin actions are logged in the `admin_audit_logs` table:

| Action | When |
|--------|------|
| ADMIN_LOGIN | Admin logs in |
| APPROVE_DOCTOR | Admin approves a doctor |
| REJECT_DOCTOR | Admin rejects a doctor |

Each entry records: admin_id, action, target_type, target_id, details, created_at

## Security Best Practices Implemented

1. Passwords never stored in plaintext (bcrypt 12 rounds)
2. Session tokens are cryptographically random (32 bytes)
3. Cookies are httpOnly (no JavaScript access)
4. User data returned without passwordHash field
5. Expired sessions auto-cleaned on next access
6. Doctor status checked on every login attempt
7. Admin actions audited with full trail
8. Query-level data isolation prevents cross-doctor access
