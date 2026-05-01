# CAREPATH AI - Setup Guide

## Prerequisites

- Node.js 20+
- PostgreSQL database
- OpenAI API key (managed via Replit AI Integrations)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes (auto-provided by Replit) |
| `PGHOST` | Database host | Yes (auto-provided) |
| `PGPORT` | Database port | Yes (auto-provided) |
| `PGUSER` | Database user | Yes (auto-provided) |
| `PGPASSWORD` | Database password | Yes (auto-provided) |
| `PGDATABASE` | Database name | Yes (auto-provided) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key | Yes (via Replit AI Integrations) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI API base URL | Yes (via Replit AI Integrations) |
| `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API access token (for WhatsApp automation) | Optional |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business phone number ID | Optional |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token (default: carepath_verify_token) | Optional |
| `NODE_ENV` | Environment (development/production) | Optional |

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd carepath-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

The PostgreSQL database is automatically provisioned by Replit. To push the schema:

```bash
npm run db:push
```

This creates all 16 tables defined in `shared/schema.ts`.

### 4. Seed Medicine Reference Database (Optional)

```bash
npx tsx server/seed-medicines.ts
```

This seeds 50,000 medicine reference records from the CSV dataset for improved AI medicine name recognition.

### 5. Start Development Server

```bash
npm run dev
```

The application will start on port 5000.

### 6. Access the Application

- Open `http://localhost:5000` in your browser
- Login with admin credentials: `admin@carepath.ai` / `admin123`

## Build for Production

```bash
npm run build
npm start
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push schema changes to database |

## Initial Admin Setup

The admin account is pre-seeded. After first login:

1. Go to Admin Dashboard
2. Review any pending doctor registrations
3. Approve doctors to allow them to start using the system

## Doctor Registration Flow

1. Doctor visits `/register` page
2. Fills in name, email, password, specialization, license number, clinic details
3. System shows "Registration successful, awaiting admin approval"
4. Admin reviews and approves the doctor
5. Doctor can now log in and start conducting visits

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` environment variable is set
- Run `npm run db:push` to ensure schema is synced

### Audio Recording Not Working
- Ensure browser has microphone permissions
- Use HTTPS in production for MediaRecorder API
- Chrome, Firefox, and Edge are supported

### AI Extraction Failures
- Check OpenAI API key is valid
- Verify `AI_INTEGRATIONS_OPENAI_API_KEY` is set
- Review server logs for error details

### WhatsApp Not Sending
- Verify `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are set correctly
- Ensure the WhatsApp Business API is properly configured in Meta Cloud

### Language Translation Issues
- Ensure the correct language is selected before starting the visit
- 12 Indian languages have full translation support
