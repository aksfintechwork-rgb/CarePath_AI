# Voice Detection & Speaker Identification — Technical Documentation

## Overview

This system captures a user's voice during registration (5 samples), stores it as a voiceprint, and then uses it during live sessions to identify the registered user's voice in real-time conversations. The architecture uses **OpenAI's GPT-4o-audio-preview** model for voice matching and **GPT-4o-mini-transcribe (Whisper)** for speech-to-text.

**Applicable to any domain**: Healthcare, Trading, Banking, Customer Support — any app where a specific registered user's voice must be verified before executing actions (e.g., "Buy 100 shares of RELIANCE").

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    PHASE 1: ENROLLMENT                  │
│                                                         │
│  User speaks 5 prompts → MediaRecorder (WebM/Base64)    │
│       → POST /api/voice-samples → Database (voice_samples table) │
│                                                         │
│  Stored per user: 5 audio clips (Base64), ~15-60 sec each │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 PHASE 2: LIVE SESSION                   │
│                                                         │
│  Live audio → MediaRecorder (10-sec chunks)             │
│       → POST /api/transcribe-chunk → Whisper STT        │
│       → Real-time transcript displayed                  │
│                                                         │
│  On finalize:                                           │
│       → Full audio sent for transcription               │
│       → POST /api/visits/:id/diarize → GPT-4o           │
│         (labels DR: / PATIENT: in transcript)           │
│       → verifyDoctorVoice() → GPT-4o-audio-preview      │
│         (compares live audio vs stored voice sample)     │
│         → Returns { isMatch, confidence, message }      │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Voice Registration (Enrollment)

### 1.1 Registration Gate (Mandatory Check)

Before a user can access the app, the system checks if voice registration is complete.

**File**: `client/src/App.tsx` (lines 79-113)

```typescript
// The AuthenticatedRouter checks voice status on every page load
const { data: voiceStatus } = useQuery({
  queryKey: ["/api/voice-samples/status"],
  queryFn: async () => {
    const res = await fetch("/api/voice-samples/status", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.json();
  },
});

// If voice samples are incomplete, redirect to voice registration page
if (!voiceComplete && location !== "/dr-voice-store") {
  return <Redirect to="/dr-voice-store" />;
}
```

**API Response** (`GET /api/voice-samples/status`):
```json
{
  "totalQuestions": 5,
  "recordedQuestions": 3,
  "questionIds": ["q1", "q2", "q3"]
}
```

### 1.2 Voice Capture UI

**File**: `client/src/pages/dr-voice-store.tsx`

The user records 5 specific voice samples. Each prompt is designed to capture different speech patterns:

| # | Prompt | Purpose |
|---|--------|---------|
| Q1 | "Introduce yourself — name, role, organization" | Identity context + natural speech |
| Q2 | "Read a scripted greeting sentence" | Controlled speech pattern |
| Q3 | "Read a prescription/order sentence" | Domain-specific vocabulary |
| Q4 | "Read a diagnostic/action sentence" | Command-style speech |
| Q5 | "Speak naturally for 15-20 seconds on any topic" | Natural rhythm & intonation |

**For a Trading App**, you would change these to:
| # | Prompt | Purpose |
|---|--------|---------|
| Q1 | "Say your full name, client ID, and broker name" | Identity context |
| Q2 | "Read: 'Buy 100 shares of Reliance Industries at market price'" | Buy order pattern |
| Q3 | "Read: 'Sell 50 shares of TCS with stop loss at 3500'" | Sell order pattern |
| Q4 | "Read: 'Place a limit order for Infosys at 1450 for 200 shares'" | Limit order pattern |
| Q5 | "Speak naturally for 15-20 seconds about your trading strategy" | Natural speech |

### 1.3 Audio Recording Mechanism

**File**: `client/src/pages/dr-voice-store.tsx` (lines 95-167)

```typescript
// Step 1: Get microphone access
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// Step 2: Create audio analyser for live visualization
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
source.connect(analyser);

// Step 3: Record audio as WebM
const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
const audioChunks: Blob[] = [];
mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0) audioChunks.push(event.data);
};
mediaRecorder.start();

// Step 4: On stop, convert to Base64 and send to server
mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
  const reader = new FileReader();
  reader.onloadend = () => {
    const base64 = (reader.result as string).split(",")[1];
    // Send to API
    fetch("/api/voice-samples", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        questionId: "q1",
        questionText: "Introduce yourself...",
        audioBase64: base64,
        durationSeconds: recordingDuration,
      }),
    });
  };
  reader.readAsDataURL(audioBlob);
};
```

### 1.4 Server-Side Storage

**File**: `server/routes.ts` (lines 2149-2177)

```typescript
// POST /api/voice-samples
app.post("/api/voice-samples", authMiddleware, async (req, res) => {
  const { questionId, questionText, audioBase64, durationSeconds } = req.body;

  // Replace existing sample for this question (re-recording)
  const existing = await storage.getVoiceSamplesByQuestion(user.id, questionId);
  if (existing.length > 0) {
    await storage.deleteVoiceSample(existing[0].id);
  }

  // Store new sample
  const sample = await storage.createVoiceSample({
    doctorId: user.id,   // In trading app: `userId` or `traderId`
    questionId,
    questionText,
    audioBase64,          // Raw Base64 audio data
    durationSeconds,
  });

  res.status(201).json(sample);
});
```

### 1.5 Database Schema

**File**: `shared/schema.ts` (lines 195-203)

```typescript
export const voiceSamples = pgTable("voice_samples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  questionId: text("question_id").notNull(),      // "q1", "q2", etc.
  questionText: text("question_text").notNull(),    // The prompt text
  audioBase64: text("audio_base64").notNull(),      // Raw audio in Base64
  durationSeconds: integer("duration_seconds"),     // Recording length
  createdAt: timestamp("created_at").defaultNow(),
});
```

**For a Trading App**, rename `doctorId` to `traderId` or `userId`.

---

## Phase 2: Voice Detection & Verification

### 2.1 Real-Time Audio Capture (During Live Session)

During a live session, audio is captured in 10-second chunks for real-time transcription:

**Frontend** sends chunks every 10 seconds:
```typescript
// Every 10 seconds, the recorded audio chunk is sent
const chunk = await recorder.requestData(); // 10-sec audio segment
const base64Chunk = await blobToBase64(chunk);

// POST to server for incremental transcription
const response = await fetch("/api/transcribe-chunk", {
  method: "POST",
  body: JSON.stringify({ audioBase64: base64Chunk, language: "English" }),
});
const { text } = await response.json();
// Append text to live transcript display
```

### 2.2 Speech-to-Text (Whisper Transcription)

**File**: `server/ai-medical.ts` (lines 134-195)

```typescript
// Uses OpenAI Whisper for speech-to-text
async function speechToTextWithLanguage(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm",
  language?: string
): Promise<string> {
  const isoLang = language ? LANGUAGE_TO_ISO[language] : undefined;

  const file = await toFile(audioBuffer, `audio.${format}`);
  const response = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",  // Fast Whisper model
    language: isoLang,                  // e.g., "en", "hi", "mr"
  });

  return response.text;
}
```

**Supported Languages**: English, Hindi, Marathi, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Urdu, Spanish, French, German, Portuguese, Arabic, Russian, Japanese, Korean, Mandarin Chinese.

### 2.3 Voice Verification (The Core Detection)

**File**: `server/ai-medical.ts` (lines 453-505)

This is the key function that compares a live audio recording against the stored voice sample to verify identity. It uses **GPT-4o-audio-preview**, which can process raw audio input.

```typescript
export async function verifyDoctorVoice(
  visitAudioBase64: string,          // Live session audio
  voiceSampleAudioBase64: string     // Stored reference voice sample
): Promise<{ isMatch: boolean; confidence: string; message: string }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-audio-preview",   // Audio-capable model
    messages: [
      {
        role: "system",
        content: `You are a voice verification expert. You will receive two audio samples.
The first is a reference voice sample from a registered user.
The second is from a live session recording.

Your task: Determine if the user's voice in the live session matches the reference voice sample.

Respond in EXACTLY this JSON format (no other text):
{"isMatch": true/false, "confidence": "high"/"medium"/"low", "message": "brief explanation"}`
      },
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: voiceSampleAudioBase64,   // Reference sample from DB
              format: "wav"
            }
          },
          {
            type: "text",
            text: "Above is the reference voice sample. Below is the live recording. Does the voice match?"
          },
          {
            type: "input_audio",
            input_audio: {
              data: visitAudioBase64,         // Live audio to verify
              format: "wav"
            }
          }
        ]
      }
    ],
    temperature: 0.1,   // Low temperature for deterministic matching
    max_tokens: 200,
  });

  const content = response.choices[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return { isMatch: true, confidence: "low", message: "Could not determine voice match" };
}
```

**Response Format**:
```json
{
  "isMatch": true,
  "confidence": "high",
  "message": "Voice characteristics, pitch, and speaking patterns closely match the reference sample"
}
```

### 2.4 Speaker Diarization (Who Said What)

**File**: `server/ai-medical.ts` (lines 406-451)

After transcription, GPT-4o labels each line of the transcript with the speaker:

```typescript
export async function diarizeTranscript(
  rawTranscript: string,
  userName: string,
  language: string = "English"
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a conversation transcript analyzer specializing in speaker diarization.
The registered user's name is: ${userName}

RULES:
1. Format output as:
   USER: <what the registered user said>
   OTHER: <what someone else said>
2. Use context clues to determine who is speaking.
3. Keep the original language. Do NOT translate.
4. Output ONLY the diarized transcript.`
      },
      { role: "user", content: rawTranscript }
    ],
    temperature: 0.2,
    max_tokens: 8192,
  });

  return response.choices[0]?.message?.content || rawTranscript;
}
```

**Output Example**:
```
USER: Buy 100 shares of Reliance at market price
SYSTEM: Order confirmed. Reliance Industries, 100 shares at market.
USER: Also place a stop loss at 2450
SYSTEM: Stop loss placed at 2450 for Reliance.
```

---

## Adapting for a Trading App

### Trading App Voice Order Flow

```
┌─────────────────────────────────────────────────────┐
│  STEP 1: One-Time Voice Registration                │
│  Trader records 5 voice samples at signup            │
│  Stored in DB as Base64 audio                        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  STEP 2: Voice Command Captured                     │
│  User says: "Buy 100 shares of RELIANCE"            │
│  Audio captured via MediaRecorder (few seconds)      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  STEP 3: Parallel Processing (milliseconds)          │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ Voice Verify     │  │ Speech-to-Text (Whisper) │ │
│  │ GPT-4o-audio     │  │ gpt-4o-mini-transcribe   │ │
│  │                  │  │                          │ │
│  │ Compare live     │  │ "Buy 100 shares of       │ │
│  │ audio vs stored  │  │  Reliance"               │ │
│  │ sample           │  │                          │ │
│  │                  │  │                          │ │
│  │ Result:          │  │ Result:                  │ │
│  │ {isMatch: true,  │  │ Parsed order:            │ │
│  │  confidence:     │  │ {action: "BUY",          │ │
│  │  "high"}         │  │  qty: 100,               │ │
│  └──────────────────┘  │  stock: "RELIANCE"}      │ │
│                         └──────────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  STEP 4: Execute or Reject                          │
│                                                      │
│  IF isMatch=true AND confidence="high":              │
│     → Execute trade order                            │
│     → Confirm to user                                │
│                                                      │
│  IF isMatch=false OR confidence="low":               │
│     → REJECT order                                   │
│     → "Voice not recognized. Please verify identity" │
└─────────────────────────────────────────────────────┘
```

### Key Implementation Notes for Trading

1. **Latency**: Voice verification via GPT-4o-audio-preview takes ~1-3 seconds. For millisecond trading, you could:
   - Pre-verify voice at session start (verify once, trust for session)
   - Use verification only for high-value orders (above threshold)
   - Run verification in parallel with order parsing

2. **Security**: Voice alone should NOT be the only authentication. Combine with:
   - Session token (already authenticated via login)
   - 2FA for orders above a certain value
   - Voice as an additional verification layer

3. **Accuracy**: GPT-4o-audio-preview returns confidence levels:
   - `"high"` — Strong match, safe to proceed
   - `"medium"` — Possible match, may want additional verification
   - `"low"` — Weak match, should require manual confirmation

---

## Complete File Reference

| File | Purpose |
|------|---------|
| `client/src/pages/dr-voice-store.tsx` | Voice registration UI — microphone capture, recording, playback, Base64 conversion |
| `client/src/App.tsx` (lines 79-113) | Authentication gate — redirects to voice registration if incomplete |
| `server/routes.ts` (lines 2128-2201) | API endpoints — CRUD for voice samples + status check |
| `server/routes.ts` (lines 2207-2258) | Diarization API — speaker labeling endpoint |
| `server/ai-medical.ts` (lines 134-195) | Whisper transcription — speech-to-text with language support |
| `server/ai-medical.ts` (lines 406-451) | Speaker diarization — GPT-4o labels who said what |
| `server/ai-medical.ts` (lines 453-505) | Voice verification — GPT-4o-audio-preview compares two audio samples |
| `shared/schema.ts` (lines 195-212) | Database schema — voice_samples and diarized_transcripts tables |
| `server/storage.ts` | Storage interface — CRUD operations for voice samples |

---

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/voice-samples` | List user's recorded voice samples (without audio data) |
| `POST` | `/api/voice-samples` | Upload a new voice sample (Base64 audio) |
| `DELETE` | `/api/voice-samples/:id` | Delete a specific voice sample |
| `GET` | `/api/voice-samples/status` | Check how many samples are recorded (gating) |
| `POST` | `/api/visits/:id/diarize` | Run speaker diarization on a transcript |

---

## Technology Stack

| Component | Technology | Model |
|-----------|------------|-------|
| Audio Capture | Browser MediaRecorder API | WebM format |
| Speech-to-Text | OpenAI Whisper | `gpt-4o-mini-transcribe` |
| Voice Verification | OpenAI Audio | `gpt-4o-audio-preview` |
| Speaker Diarization | OpenAI Chat | `gpt-4o` |
| Audio Visualization | Web Audio API (AnalyserNode) | FFT-based |
| Database | PostgreSQL + Drizzle ORM | — |
| Frontend | React + TanStack Query | — |
