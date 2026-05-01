# CAREPATH AI - AI Integration Documentation

## Overview

CAREPATH AI uses OpenAI's API for four core AI capabilities:
1. **Audio Transcription** (Whisper) - Converting doctor speech to text
2. **Clinical Data Extraction** (GPT-4o) - Extracting structured medical data from transcripts
3. **Aadhaar Card Scanning** (GPT-4o Vision) - Reading patient ID documents
4. **Medical News Generation** (GPT-4o) - Generating personalized medical articles by specialization

## Configuration

**File**: `server/ai-medical.ts`

```typescript
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
```

API keys are managed through Replit AI Integrations for automatic key rotation and security.

## 1. Audio Transcription (Whisper)

### Chunked Transcription

Audio is processed in 10-second chunks during recording for real-time transcript display.

```typescript
transcribeAudioChunk(base64Audio: string): Promise<string>
```

**Process:**
1. Convert base64 to Buffer
2. Skip if buffer < 100 bytes
3. Convert to compatible audio format using `ensureCompatibleFormat()`
4. Send to Whisper via `speechToText()`
5. Return transcript text

### Full Audio Transcription

After recording stops, the complete audio is transcribed for best quality.

```typescript
transcribeAudio(base64Audio: string): Promise<string>
```

**Process:**
1. Convert base64 to Buffer
2. Ensure compatible format
3. Transcribe via speechToText
4. Return full transcript

### Supported Languages

Whisper supports 50+ languages including:
- English, Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Punjabi
- Hinglish (mixed Hindi-English) and other code-switching patterns
- All major world languages

## 2. Clinical Data Extraction (GPT-4o)

### Function

```typescript
extractMedicalData(transcript: string, language: string): Promise<MedicalAIDraft>
```

### System Prompt

The system prompt establishes GPT-4o as a **clinical medical documentation assistant** with strict extraction rules.

### Dynamic Language-Aware Prompt

The system prompt is now generated dynamically via `getMedicalSystemPrompt(language)`:

- **CRITICAL LANGUAGE RULE** placed at the very top of the prompt enforcing all output in the consultation language
- Every field description explicitly states the target language (e.g., "frequency in ${language}", "timing in ${language}")
- Medicine names remain in English/standard form; all other fields translated
- Test fields (when_to_do, urgency, trigger_condition) are also translated

### Medicine Reference Database Integration

- 50,000 medicine records seeded from CSV dataset (64 unique medicine names)
- AI prompt dynamically loads known medicine names from DB
- GPT-4o instructed to use fuzzy/phonetic matching for better recognition from Whisper transcripts
- Categories: tablets, capsules, syrups, injections, etc.

### Key Extraction Rules
1. Extract ONLY what is explicitly spoken
2. Do NOT guess any medical information
3. Preserve exact medicine names, dosage, and frequency
4. If something is not mentioned, return null (except duration — see below)
5. Output must ALWAYS be valid JSON
6. If medicine names are unclear in Whisper transcript, mark as "uncertain"
7. **Duration is REQUIRED**: NEVER return null for medicine duration — always provide a reasonable clinical duration even if not explicitly stated (e.g., "5 days", "7 days", "1 month")

### Extraction Fields

| Field | Type | Description |
|-------|------|-------------|
| summary | string | Consultation summary paragraph (uses patient's full name) |
| diagnosis | string[] | Array of diagnosed conditions |
| needs_doctor_review | boolean | True if transcript is unintelligible |
| medicines | object[] | Array of prescribed medications |
| tests | object[] | Array of test objects with name, when_to_do, urgency, trigger_condition, fasting_required |
| diet | string[] | Array of dietary advice |
| precautions | string[] | Array of lifestyle changes/precautions |
| follow_up | string | Follow-up instructions |
| red_flags | string | Emergency/warning signs |

### Medicine Object Structure

| Field | Description | Example |
|-------|-------------|---------|
| medicine_name | Drug name (normalized) | "Paracetamol" |
| dosage | Dose with units | "650mg" |
| frequency | How often (only) | "Twice daily" |
| timing | When to take (only) | "Morning and night, after food" |
| duration | How long to take | "5 days" |

### Model Parameters

```typescript
{
  model: "gpt-4o",
  response_format: { type: "json_object" },
  temperature: 0.1,  // Low temperature for consistent extraction
  max_tokens: 4096
}
```

### User Prompt Template

The user prompt:
1. Identifies the consultation language
2. Instructs to handle code-switching (Hindi-English mixing)
3. Provides medical term mappings (e.g., "goli" = tablet, "dawai" = medicine, "jaanch" = test, "aushadh" = medicine in Marathi)
4. Instructs to normalize medicine names to standard English (e.g., "paracetamol ki goli" -> Paracetamol)
5. Sets `needs_doctor_review` to true ONLY if transcript is genuinely unintelligible or extremely short; otherwise false
6. Uses patient's full name in the summary

### Fallback Behavior

If real audio is unavailable or transcript is too short (< 20 chars), the system generates a simulated consultation transcript:

```typescript
generateTranscriptFromAudio(description, language, patientInfo): Promise<string>
```

## 3. Aadhaar Card Scanning (GPT-4o Vision)

### Function

```typescript
scanAadhaarCard(base64Image: string): Promise<AadhaarScanResult>
```

### Extracted Fields

| Field | Type | Description |
|-------|------|-------------|
| name | string | Full name as printed |
| dateOfBirth | string | DD/MM/YYYY format |
| age | number | Calculated from DOB |
| gender | string | Male/Female/Other |
| aadhaarNumber | string | 12-digit number (XXXX XXXX XXXX) |

### Model Parameters

```typescript
{
  model: "gpt-4o",
  response_format: { type: "json_object" },
  temperature: 0.1,
  max_tokens: 500
}
```

### Image Handling

- Supports JPEG and PNG formats
- Auto-detects format from base64 prefix
- Uses `detail: "high"` for maximum accuracy
- Constructs proper data URL for the API

## 4. Transcript Translation

### Function

```typescript
translateTranscript(text: string, targetLanguage: string): Promise<string>
```

### Parameters

```typescript
{
  model: "gpt-4o",
  temperature: 0.2,
  max_tokens: 4096
}
```

Preserves all medical terminology, drug names, dosages, and clinical details during translation.

## Processing Pipeline

```
Recording Start
    │
    ▼
10-sec Audio Chunks ──► Whisper (chunk) ──► Live Transcript Display
    │
    ▼ (on stop)
Full Audio ──► Whisper (full) ──► Complete Transcript
    │                                    │
    ▼                                    ▼
                    Medicine Reference DB ──► Known medicine names loaded
                              │
                              ▼
                    getMedicalSystemPrompt(language)
                              │
                              ▼
                    GPT-4o Extraction (language-aware)
                              │
                    ┌─────────┼─────────────────┐
                    ▼         ▼                  ▼
              Medicines    Tests              Follow-ups
              (name, dose, (name, when_to_do, (days, date,
              frequency,   urgency,           warning signs)
              timing,      trigger_condition,
              duration)    fasting_required)
                    │         │                  │
                    ▼         ▼                  ▼
              Database Insert (all fields in consultation language)
                    │
                    ▼
              Visit status → "draft"
              Doctor reviews and approves
```

## Client-Side Medical Translation

**File**: `client/src/lib/medical-translations.ts`

The `translateMedicalTerm(term, language)` function provides client-side translation for medical terms displayed in care plans:

- Covers 12 Indian languages: Hindi, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Bengali, Punjabi, Urdu, Odia, Assamese
- Translates: medicine frequencies, timings, test urgency levels, trigger conditions, schedule terms
- 21 test-specific translations per language (Routine, Urgent, Immediately, trigger conditions, etc.)
- Matching strategy: exact match → lowercase match → alias dictionary → duration pattern parsing
- Used in active-visit review page, print view, and patient-facing displays

## Error Handling

1. **Chunk transcription failure**: Returns empty transcript, keeps previous chunks
2. **Full transcription failure**: Falls back to chunk transcript
3. **No audio at all**: Generates simulated consultation transcript
4. **AI parsing failure**: Throws error with truncated response content
5. **Empty arrays**: Auto-initialized if missing from AI response

## Rate Limits & Costs

- Whisper transcription: Per audio duration
- GPT-4o extraction: Per consultation (one call)
- GPT-4o vision (Aadhaar): Per scan (one call)
- Translation: Per transcript (one call)

All API calls go through Replit AI Integrations proxy for automatic key management.
