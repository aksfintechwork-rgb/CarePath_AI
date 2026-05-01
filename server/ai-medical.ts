import { toFile } from "openai";
import { ensureCompatibleFormat, detectAudioFormat, speechToText } from "./replit_integrations/audio/client";
import { createOpenAI } from "./openai-shared";
import { db } from "./db";
import { medicineReference } from "@shared/schema";
import { sql } from "drizzle-orm";

const openai = createOpenAI();

function getMedicalSystemPrompt(language: string = "English") {
  return `You are a clinical medical documentation assistant inside a Hospital Management System.

The transcription is generated using OpenAI Whisper.

Your task is to analyze Whisper transcript text from doctor–patient conversations and convert it into structured medical data.

CRITICAL LANGUAGE RULE: ALL output text (except medicine_name and test_name) MUST be written in ${language}. This is mandatory — every string value in your JSON response must be in ${language}. medicine_name and test_name should remain in standard medical/English form.

STRICT RULES:

1. Do NOT guess any medical information.
2. Extract ONLY what is explicitly spoken during the MEDICAL CONSULTATION portion.
3. Preserve exact medicine names, dosage, and frequency.
4. If something is not mentioned, return null.
5. Write ALL descriptive text, instructions, conditions, and labels in ${language}. Do NOT use English for any field except medicine_name and test_name.
6. Output must ALWAYS be valid JSON.
7. If medicine names are unclear in Whisper transcript, mark as "uncertain".
8. CRITICAL: The recording may contain NON-MEDICAL conversation AFTER the consultation ends (e.g., personal calls, background chatter, unrelated discussions about worksheets, homework, scheduling, etc.). You MUST IGNORE all non-medical content. Only extract from the doctor-patient medical conversation. Look for the natural end of the consultation (e.g., "Thank you doctor", "OK doctor", farewell phrases) and IGNORE everything after that point.
9. If the transcript contains repeated segments (same sentences appearing multiple times), treat them as ONE occurrence — do not duplicate medicines or tests.

You understand and process doctor speech in:
- English
- Hindi
- Marathi
- Hinglish (mixed English + Hindi)
- Mixed Indian languages spoken naturally
- Any other language worldwide

Extract the following (ALL text output MUST be in ${language} except medicine_name and test_name):

A) Consultation Summary (short paragraph in ${language}. ALWAYS use patient's FULL NAME, e.g. "Mr. Rajesh Kumar" not "Mr. Kumar")

B) Diagnosis / Complaints (array of diagnosed conditions — in ${language})

C) Medicines:
   - medicine_name (exact name as spoken, normalized to standard medical name — keep in English)
   - dosage (e.g. "40mg", "500mg")
   - frequency (in ${language} — ONLY how often, e.g. "दिवसातून दोनदा" for Marathi / "Twice daily" for English)
   - timing (in ${language} — WHEN to take, e.g. "जेवणानंतर" for Marathi / "After food" for English)
   - duration (in ${language} — REQUIRED, e.g. "५ दिवस" for Marathi / "5 days" for English. NEVER return null.)

D) Medical Tests Recommended (array of objects):
   - test_name (standard medical name — keep in English)
   - when_to_do (in ${language} — WHEN to do the test)
   - urgency (in ${language} — e.g. "नियमित" for Marathi / "Routine" for English)
   - trigger_condition (in ${language} — WHY or UNDER WHAT CONDITION)

E) Diet Instructions (array in ${language})

F) Lifestyle / Precautions (array in ${language})

G) Follow-up Instructions (string in ${language}, or null)

H) Emergency / Red Flags (in ${language}, or null)

FAILURE CONDITIONS:
- If ANY field requires guessing, EXCLUDE it
- If transcript is short / unclear / noisy, set needs_doctor_review to true
- If doctor gives no instruction, return EMPTY arrays

FINAL VALIDATION:
Before including any item, ask:
"Did the doctor clearly say this in ANY language?"
If NO, DO NOT include it.

Return EXACTLY this JSON format (remember: ALL text values in ${language} except medicine_name and test_name):

{
  "summary": "Detailed consultation summary in ${language}",
  "diagnosis": ["Conditions in ${language}"],
  "needs_doctor_review": false,
  "medicines": [
    {
      "medicine_name": "Drug name (English)",
      "dosage": "Dose with units",
      "frequency": "How often — in ${language}",
      "timing": "When to take — in ${language}",
      "duration": "How long — in ${language}"
    }
  ],
  "tests": [
    {
      "test_name": "Test name (English)",
      "when_to_do": "When to do — in ${language}",
      "urgency": "Urgency level — in ${language}",
      "trigger_condition": "Under what condition — in ${language}"
    }
  ],
  "diet": ["Diet instruction in ${language}"],
  "precautions": ["Precaution in ${language}"],
  "follow_up": "Follow-up instruction in ${language} or null",
  "red_flags": "Emergency advice in ${language} or null"
}`;
}

export interface MedicalAIDraft {
  summary: string;
  diagnosis: string[];
  needs_doctor_review?: boolean;
  language?: string;
  medicines: {
    medicine_name: string;
    dosage: string;
    frequency: string;
    timing: string;
    duration: string;
  }[];
  tests: (string | { test_name: string; when_to_do?: string; trigger_condition?: string })[];
  diet: string[];
  precautions: string[];
  follow_up: string | null;
  red_flags: string | null;
}

export interface PatientHistoryContext {
  pastIllnesses?: string | null;
  chronicDiseases?: string | null;
  currentMedications?: string | null;
  allergies?: string | null;
  familyHistory?: string | null;
  lifestyleHabits?: string | null;
  previousSurgeries?: string | null;
  pregnancyStatus?: string | null;
  bloodGroup?: string | null;
  weight?: string | null;
  height?: string | null;
  age?: number;
  gender?: string | null;
}

export interface MedicineAlternativeResult {
  originalMedicine: string;
  alternatives: {
    name: string;
    saltComposition: string;
    genericName: string;
    manufacturer: string;
    priceEstimate: string;
    type: "generic" | "branded" | "lower-cost" | "same-salt";
    reason: string;
  }[];
}

export interface RiskCheckResult {
  riskLevel: "Low" | "Moderate" | "High";
  flaggedMedicines: {
    medicineName: string;
    riskType: string;
    severity: "low" | "moderate" | "high";
    explanation: string;
  }[];
  interactions: {
    drug1: string;
    drug2: string;
    interactionType: string;
    severity: "low" | "moderate" | "high";
    explanation: string;
  }[];
  overallSummary: string;
}

const LANGUAGE_TO_ISO: Record<string, string> = {
  "English": "en", "Hindi": "hi", "Marathi": "mr", "Tamil": "ta", "Telugu": "te",
  "Kannada": "kn", "Malayalam": "ml", "Bengali": "bn", "Gujarati": "gu", "Punjabi": "pa",
  "Urdu": "ur", "Spanish": "es", "French": "fr", "German": "de", "Portuguese": "pt",
  "Arabic": "ar", "Russian": "ru", "Japanese": "ja", "Korean": "ko", "Mandarin Chinese": "zh",
};

type TranscriptionFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg";

async function speechToTextWithLanguage(audioBuffer: Buffer, format: TranscriptionFormat, language?: string): Promise<string> {
  const isoLang = language ? LANGUAGE_TO_ISO[language] : undefined;
  console.log(`[AI] speechToTextWithLanguage: format=${format}, bufferSize=${audioBuffer.length}, language=${language}, isoLang=${isoLang || 'none'}`);
  if (isoLang) {
    const file = await toFile(audioBuffer, `audio.${format}`);
    console.log(`[AI] Calling Whisper (gpt-4o-mini-transcribe) with lang=${isoLang}...`);
    const response = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
      language: isoLang,
    });
    console.log(`[AI] Whisper response: ${response.text?.length || 0} chars`);
    return response.text;
  }
  return speechToText(audioBuffer, format);
}

async function smartFormatConvert(rawBuffer: Buffer): Promise<{ buffer: Buffer; format: TranscriptionFormat }> {
  const detected = detectAudioFormat(rawBuffer);
  console.log(`[AI] smartFormatConvert: detected=${detected}, bufferSize=${rawBuffer.length} bytes, first4bytes=${rawBuffer.slice(0, 4).toString('hex')}`);
  if (detected === "webm") {
    return { buffer: rawBuffer, format: "webm" };
  }
  if (detected === "wav") {
    return { buffer: rawBuffer, format: "wav" };
  }
  if (detected === "mp3") {
    return { buffer: rawBuffer, format: "mp3" };
  }
  // MP4/M4A (Safari, many mobile browsers, some Edge recordings): OpenAI accepts mp4; avoid mislabeling as webm when ffmpeg is missing.
  if (detected === "mp4") {
    try {
      const result = await ensureCompatibleFormat(rawBuffer);
      return { buffer: result.buffer, format: result.format };
    } catch (err: any) {
      console.warn(`[AI] MP4→WAV via ffmpeg failed (${err.message}); sending MP4 to transcription API as-is`);
      return { buffer: rawBuffer, format: "mp4" };
    }
  }
  if (detected === "ogg") {
    try {
      const result = await ensureCompatibleFormat(rawBuffer);
      return { buffer: result.buffer, format: result.format };
    } catch (err: any) {
      console.warn(`[AI] OGG convert failed (${err.message}); sending OGG as-is`);
      return { buffer: rawBuffer, format: "ogg" };
    }
  }
  try {
    const result = await ensureCompatibleFormat(rawBuffer);
    return { buffer: result.buffer, format: result.format };
  } catch (err: any) {
    console.error(`[AI] ensureCompatibleFormat failed: ${err.message}, trying direct webm submit`);
    return { buffer: rawBuffer, format: "webm" };
  }
}

export async function transcribeAudio(base64Audio: string, language?: string): Promise<string> {
  console.log(`[AI] transcribeAudio: base64 length=${base64Audio.length}, language=${language || 'auto'}`);
  const rawBuffer = Buffer.from(base64Audio, "base64");
  console.log(`[AI] transcribeAudio: raw buffer=${rawBuffer.length} bytes`);
  const { buffer: audioBuffer, format } = await smartFormatConvert(rawBuffer);
  console.log(`[AI] transcribeAudio: format=${format}, audioBuffer=${audioBuffer.length} bytes`);
  const result = await speechToTextWithLanguage(audioBuffer, format, language);
  console.log(`[AI] transcribeAudio: result=${result?.length || 0} chars — "${result?.substring(0, 100)}"`);
  return result;
}

export async function transcribeAudioChunk(base64Audio: string, language?: string): Promise<string> {
  console.log(`[AI] transcribeAudioChunk: base64 length=${base64Audio.length}, language=${language || 'auto'}`);
  const rawBuffer = Buffer.from(base64Audio, "base64");
  if (rawBuffer.length < 100) {
    console.log(`[AI] transcribeAudioChunk: buffer too small (${rawBuffer.length} bytes), returning empty`);
    return "";
  }
  const { buffer: audioBuffer, format } = await smartFormatConvert(rawBuffer);
  console.log(`[AI] transcribeAudioChunk: format=${format}, audioBuffer=${audioBuffer.length} bytes`);
  const result = await speechToTextWithLanguage(audioBuffer, format, language);
  console.log(`[AI] transcribeAudioChunk: result=${result?.length || 0} chars — "${result?.substring(0, 100)}"`);
  return result;
}

let cachedMedicineNames: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function getMedicineReferenceNames(): Promise<string[]> {
  const now = Date.now();
  if (cachedMedicineNames && now - cacheTimestamp < CACHE_TTL) {
    return cachedMedicineNames;
  }
  try {
    const results = await db.selectDistinct({ name: medicineReference.name }).from(medicineReference);
    cachedMedicineNames = results.map(r => r.name).sort();
    cacheTimestamp = now;
    return cachedMedicineNames;
  } catch (e) {
    console.warn("Could not load medicine reference names:", e);
    return cachedMedicineNames || [];
  }
}

export async function extractMedicalData(
  transcript: string,
  language: string = "English",
  patientHistory?: PatientHistoryContext
): Promise<MedicalAIDraft> {
  console.log(`[AI] extractMedicalData: transcript=${transcript.length} chars, language=${language}, hasHistory=${!!patientHistory}`);
  const knownMedicines = await getMedicineReferenceNames();
  console.log(`[AI] extractMedicalData: ${knownMedicines.length} known medicines loaded`);
  const medicineListStr = knownMedicines.length > 0
    ? `\n\nKNOWN MEDICINE DATABASE (${knownMedicines.length} medicines):\nWhen the doctor mentions a medicine, match it to the closest name from this list. Use fuzzy matching — Whisper may misspell or phonetically approximate medicine names. If no close match is found, use the name as spoken.\n\nMedicine Names: ${knownMedicines.join(", ")}`
    : "";

  let patientHistoryStr = "";
  if (patientHistory) {
    const historyParts: string[] = [];
    if (patientHistory.age) historyParts.push(`Age: ${patientHistory.age}`);
    if (patientHistory.gender) historyParts.push(`Gender: ${patientHistory.gender}`);
    if (patientHistory.bloodGroup) historyParts.push(`Blood Group: ${patientHistory.bloodGroup}`);
    if (patientHistory.weight) historyParts.push(`Weight: ${patientHistory.weight}`);
    if (patientHistory.height) historyParts.push(`Height: ${patientHistory.height}`);
    if (patientHistory.allergies) historyParts.push(`Known Allergies: ${patientHistory.allergies}`);
    if (patientHistory.pastIllnesses) historyParts.push(`Past Illnesses: ${patientHistory.pastIllnesses}`);
    if (patientHistory.chronicDiseases) historyParts.push(`Chronic Diseases: ${patientHistory.chronicDiseases}`);
    if (patientHistory.currentMedications) historyParts.push(`Current Medications: ${patientHistory.currentMedications}`);
    if (patientHistory.familyHistory) historyParts.push(`Family History: ${patientHistory.familyHistory}`);
    if (patientHistory.lifestyleHabits) historyParts.push(`Lifestyle: ${patientHistory.lifestyleHabits}`);
    if (patientHistory.previousSurgeries) historyParts.push(`Previous Surgeries: ${patientHistory.previousSurgeries}`);
    if (patientHistory.pregnancyStatus) historyParts.push(`Pregnancy Status: ${patientHistory.pregnancyStatus}`);
    if (historyParts.length > 0) {
      patientHistoryStr = `\n\nPATIENT MEDICAL HISTORY (use this context when generating prescriptions — flag any conflicts with allergies, chronic conditions, or current medications):\n${historyParts.join("\n")}`;
    }
  }

  const userPrompt = `The following is a transcript of a doctor-patient consultation conducted in ${language}. 
The transcript was generated by OpenAI Whisper from real audio. The doctor may speak in ${language}, English, or a mix of languages (code-switching is common in Indian medical practice).

IMPORTANT INSTRUCTIONS:
1. Extract ONLY what the doctor explicitly said during the medical consultation. Do NOT guess or add anything.
2. If medicine names are unclear in the Whisper transcript, mark as "uncertain".
3. In the summary, always use the patient's FULL NAME as it appears in the transcript.
4. Understand medical terms in Hindi (e.g. "goli" = tablet, "dawai" = medicine, "jaanch" = test), Marathi (e.g. "goli" = tablet, "aushadh" = medicine, "tapasni" = test), and mixed language speech.
5. Set needs_doctor_review to true ONLY if the transcript is genuinely unintelligible or extremely short (< 3 sentences). If the transcript has clear medical content in any language, set it to false.
6. MEDICINE NAME MATCHING: When the doctor says a medicine name, match it to the closest known medicine from the database below. Use phonetic/fuzzy matching since Whisper may transcribe names imprecisely. For example, "Acetomycin" spoken as "Aceto-mycin" or "aseto maisin" should resolve to "Acetomycin".${medicineListStr}
7. IGNORE NON-MEDICAL CONTENT: The recording may continue after the consultation ends. Any conversation about non-medical topics (worksheets, homework, scheduling calls, personal discussions, file sharing, etc.) must be completely ignored. Only extract from the medical consultation portion.
8. HANDLE REPEATED TRANSCRIPTION: Due to chunked audio processing, the same sentences may appear multiple times in the transcript. Deduplicate — extract each medicine, test, and instruction only ONCE.
9. LANGUAGE OUTPUT: All patient-facing text fields MUST be in ${language}. This includes: summary, diagnosis, diet instructions, precautions, follow_up, red_flags, medicine timing/frequency/duration, and test when_to_do, urgency, and trigger_condition. Keep medicine_name and test_name in their standard medical/English form, but write all instructions, conditions, urgency levels, and descriptions in ${language}. For example, if language is Marathi, write "नियमित" instead of "Routine", "औषध घेतल्यानंतर बरे न वाटल्यास" instead of "If not feeling well after medicine".${patientHistoryStr}

TRANSCRIPT:
${transcript}

Respond ONLY with valid JSON. Extract explicitly stated information. Use the patient's full name in the summary.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: getMedicalSystemPrompt(language) },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  console.log(`[AI] GPT-4o response: ${content ? content.length : 0} chars, usage: prompt=${response.usage?.prompt_tokens}, completion=${response.usage?.completion_tokens}`);
  if (!content) {
    console.error("[AI] GPT-4o returned no content");
    throw new Error("AI did not return a response");
  }

  try {
    const parsed = JSON.parse(content) as MedicalAIDraft;
    parsed.language = language;
    if (!parsed.medicines) parsed.medicines = [];
    if (!parsed.tests) parsed.tests = [];
    if (!parsed.diet) parsed.diet = [];
    if (!parsed.precautions) parsed.precautions = [];
    if (!parsed.diagnosis) parsed.diagnosis = [];
    console.log(`[AI] Extracted: ${parsed.medicines.length} medicines, ${parsed.tests.length} tests, summary=${parsed.summary?.length || 0} chars`);
    return parsed;
  } catch (parseError) {
    console.error("[AI] Failed to parse AI response as JSON:", content.substring(0, 500));
    throw new Error("AI returned invalid response format. Please try again.");
  }
}

export async function generateTranscriptFromAudio(
  description: string,
  language: string = "English",
  patientInfo?: { name: string; age: number; gender: string | null }
): Promise<string> {
  const patientDesc = patientInfo 
    ? `The patient is ${patientInfo.name}, a ${patientInfo.age}-year-old ${patientInfo.gender || "patient"}.`
    : "Use a realistic Indian patient name.";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a medical transcription AI. Generate a realistic doctor-patient consultation transcript in ${language}. ${patientDesc} The transcript should be clinically detailed, include proper medical history taking, examination findings, and the doctor's assessment and plan. Include realistic dialogue with medical terminology appropriate for a clinical setting. Use the patient's actual name throughout the transcript.`,
      },
      {
        role: "user",
        content: `Generate a realistic doctor-patient consultation transcript in ${language}. ${patientDesc}
The consultation should cover common primary care complaints. Make it detailed with proper clinical dialogue including:
- Patient greeting and chief complaint (use the patient's real name)
- History of present illness (onset, duration, severity, associated symptoms)
- Past medical history, medications, allergies
- Doctor's examination findings
- Doctor's assessment and treatment plan discussion with specific medicine names, doses, frequencies, AND specific durations (e.g. "Take this for 5 days", "Continue for 2 weeks", "7 days course")
- Diet and lifestyle advice
- Follow-up instructions
- Any warning signs to watch for

IMPORTANT: Every medicine prescribed MUST have a specific duration (e.g. "5 days", "7 days", "2 weeks", "1 month"). Do NOT say "as needed" without a duration.
Make it realistic and clinically accurate, as if recorded during an actual consultation. The doctor should prescribe at least 2-3 medicines with specific dosages, frequencies, and durations.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });

  return response.choices[0]?.message?.content || "Consultation transcript unavailable.";
}

export interface AadhaarScanResult {
  name: string | null;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  aadhaarNumber: string | null;
}

export async function scanAadhaarCard(
  base64Image: string
): Promise<AadhaarScanResult> {
  const mediaType = base64Image.startsWith("/9j") ? "image/jpeg" : "image/png";
  const dataUrl = base64Image.startsWith("data:")
    ? base64Image
    : `data:${mediaType};base64,${base64Image}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert document reader specializing in Indian Aadhaar cards. Extract the following fields from the Aadhaar card image:
- Full name (as printed on the card)
- Date of birth (in DD/MM/YYYY format)
- Gender (Male, Female, or Other)
- Aadhaar number (12-digit number, usually formatted as XXXX XXXX XXXX)

If you cannot read a field clearly, set it to null. Calculate age from date of birth if available using today's date.

IMPORTANT: Only extract data visible on the card. Do not fabricate any information.

Respond ONLY with valid JSON in this exact format:
{
  "name": "Full Name",
  "dateOfBirth": "DD/MM/YYYY",
  "age": 35,
  "gender": "Male",
  "aadhaarNumber": "XXXX XXXX XXXX"
}`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please read this Aadhaar card and extract the name, date of birth, age, and gender.",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI did not return a response for Aadhaar scan");
  }

  try {
    const parsed = JSON.parse(content) as AadhaarScanResult;
    if (parsed.dateOfBirth && !parsed.age) {
      const parts = parsed.dateOfBirth.split("/");
      if (parts.length === 3) {
        const dob = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        parsed.age = age;
      }
    }
    return parsed;
  } catch {
    throw new Error("Failed to parse Aadhaar scan result");
  }
}

export async function diarizeTranscript(rawTranscript: string, doctorName: string, language: string = "English"): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a medical consultation transcript analyzer specializing in speaker diarization.

Your task is to take a raw transcript from a doctor-patient consultation and identify who is speaking at each point in the conversation.

The doctor's name is: ${doctorName}

RULES:
1. Format output EXACTLY as:
   DR: <what the doctor said>
   PATIENT: <what the patient said>
2. MULTIPLE PATIENTS: If there are multiple distinct patient voices (e.g. a patient and a family member, or two patients), label them as:
   PATIENT1: <first patient's speech>
   PATIENT2: <second patient's speech>
   PATIENT3: <third patient's speech> (and so on)
   - Detect different patient voices by analyzing conversation context: different names, pronouns referring to different people, multiple people describing different symptoms, someone speaking on behalf of another, etc.
   - If only one patient is present, use "PATIENT:" (no number).
   - Never mix one patient's speech into another patient's label.
3. Each speaker change must be on a new line with the correct label.
4. Use context clues to determine who is speaking:
   - The doctor typically: greets, asks about symptoms/complaints, examines, prescribes medicines, orders tests, gives instructions, schedules follow-ups
   - The patient typically: describes symptoms, answers questions, asks about treatment, expresses concerns
   - A companion/family member: may describe the patient's condition, translate, or add information
5. If a line is ambiguous, use the flow of conversation to determine the speaker.
6. Keep the original language of the transcript (${language}). Do NOT translate.
7. Preserve ALL medical information exactly as spoken.
8. Ignore non-medical chatter at the end of the consultation.
9. Do NOT add any content that wasn't in the original transcript.
10. Output ONLY the diarized transcript, no additional commentary.`
      },
      {
        role: "user",
        content: rawTranscript
      }
    ],
    temperature: 0.2,
    max_tokens: 8192,
  });

  return response.choices[0]?.message?.content || rawTranscript;
}

export async function verifyDoctorVoice(visitAudioBase64: string, voiceSampleAudioBase64: string): Promise<{ isMatch: boolean; confidence: string; message: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-audio-preview",
      messages: [
        {
          role: "system",
          content: `You are a voice verification expert. You will receive two audio samples. The first is a reference voice sample from a registered doctor. The second is from a medical consultation recording.

Your task: Determine if the doctor's voice in the consultation matches the reference voice sample.

Respond in EXACTLY this JSON format (no other text):
{"isMatch": true/false, "confidence": "high"/"medium"/"low", "message": "brief explanation"}`
        },
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: voiceSampleAudioBase64,
                format: "wav"
              }
            },
            {
              type: "text",
              text: "Above is the reference doctor voice sample. Below is the consultation recording. Does the doctor's voice in the consultation match the reference sample?"
            },
            {
              type: "input_audio",
              input_audio: {
                data: visitAudioBase64,
                format: "wav"
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { isMatch: true, confidence: "low", message: "Could not determine voice match" };
  } catch (err: any) {
    console.error("Voice verification error:", err.message);
    return { isMatch: true, confidence: "low", message: "Voice verification unavailable" };
  }
}

export async function translateTranscript(text: string, targetLanguage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a professional medical translator. Translate the given medical consultation transcript accurately into ${targetLanguage}. 
CRITICAL RULES:
1. Preserve all medical terminology, drug names, dosages, and clinical details exactly.
2. If the transcript has speaker labels like "DR:", "PATIENT:", "PATIENT1:", "PATIENT2:", etc., you MUST keep those exact prefixes unchanged in English. Only translate the spoken content after the prefix.
3. Keep the same line-by-line structure and formatting.
4. Only output the translated text, nothing else.
Example input:
DR: Take this medicine twice daily.
PATIENT1: Okay, doctor.
PATIENT2: What about my mother's dosage?
Example output (Hindi):
DR: यह दवाई दिन में दो बार लें।
PATIENT1: ठीक है, डॉक्टर।
PATIENT2: मेरी माँ की खुराक के बारे में क्या?`
      },
      {
        role: "user",
        content: text
      }
    ],
    temperature: 0.2,
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content || text;
}

export async function generateMedicineAlternatives(
  medicineName: string,
  dosage?: string,
  saltComposition?: string
): Promise<MedicineAlternativeResult> {
  console.log(`[AI] generateMedicineAlternatives: medicine=${medicineName}, dosage=${dosage}, salt=${saltComposition}`);

  async function callAlternativesAI(retrySimplified = false): Promise<string> {
    const systemPrompt = retrySimplified
      ? `You are a pharmacist assistant for the Indian market. Given a medicine name, list 3-5 equivalent or similar products available in India with their brand names, active ingredients, manufacturers, and approximate prices in INR. Respond with valid JSON only.`
      : `You are a pharmaceutical expert AI assistant specializing in medicine alternatives in the Indian market.

Given a prescribed medicine, suggest alternatives in these categories:
1. GENERIC equivalent (same salt, unbranded, lower cost)
2. BRANDED alternatives (same salt composition, different brand)
3. LOWER-COST options (similar therapeutic effect, more affordable)
4. SAME-SALT variations (same active ingredient, different formulations or strengths)

For each alternative provide:
- name: Full medicine name
- saltComposition: Active ingredient(s)
- genericName: Generic/INN name
- manufacturer: Pharmaceutical company
- priceEstimate: Approximate price range in INR (e.g., "₹30-50 for 10 tablets")
- type: One of "generic", "branded", "lower-cost", "same-salt"
- reason: Brief explanation of why this is a good alternative

RULES:
1. Only suggest real, commercially available medicines in India
2. Ensure salt compositions match or are therapeutically equivalent
3. Include at least one generic option if available
4. Provide 3-5 alternatives total
5. Respond ONLY with valid JSON`;

    const userContent = `List alternative products for: ${medicineName}${dosage ? ` (${dosage})` : ""}${saltComposition ? ` containing ${saltComposition}` : ""}

JSON format: { "originalMedicine": "${medicineName}", "alternatives": [{ "name": "...", "saltComposition": "...", "genericName": "...", "manufacturer": "...", "priceEstimate": "₹XX-XX", "type": "generic|branded|lower-cost|same-salt", "reason": "..." }] }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2048,
    });
    return response.choices[0]?.message?.content || "";
  }

  let content: string;
  try {
    content = await callAlternativesAI(false);
  } catch (err: any) {
    if (err?.code === 'content_filter' || err?.status === 400) {
      console.log(`[AI] Content filter triggered for ${medicineName}, retrying with simplified prompt...`);
      content = await callAlternativesAI(true);
    } else {
      throw err;
    }
  }

  if (!content) {
    throw new Error("AI did not return alternatives");
  }

  try {
    const parsed = JSON.parse(content) as MedicineAlternativeResult;
    if (!parsed.alternatives) parsed.alternatives = [];
    console.log(`[AI] Generated ${parsed.alternatives.length} alternatives for ${medicineName}`);
    return parsed;
  } catch {
    throw new Error("Failed to parse medicine alternatives response");
  }
}

export async function runPrescriptionRiskCheck(
  medicines: { name: string; dosage?: string; frequency?: string; duration?: string }[],
  patientHistory: PatientHistoryContext,
  diagnosis?: string[]
): Promise<RiskCheckResult> {
  console.log(`[AI] runPrescriptionRiskCheck: ${medicines.length} medicines, hasHistory=${!!patientHistory}`);

  const patientProfileParts: string[] = [];
  if (patientHistory.age) patientProfileParts.push(`Age: ${patientHistory.age}`);
  if (patientHistory.gender) patientProfileParts.push(`Gender: ${patientHistory.gender}`);
  if (patientHistory.bloodGroup) patientProfileParts.push(`Blood Group: ${patientHistory.bloodGroup}`);
  if (patientHistory.weight) patientProfileParts.push(`Weight: ${patientHistory.weight}`);
  if (patientHistory.height) patientProfileParts.push(`Height: ${patientHistory.height}`);
  if (patientHistory.allergies) patientProfileParts.push(`Known Allergies: ${patientHistory.allergies}`);
  if (patientHistory.pastIllnesses) patientProfileParts.push(`Past Illnesses: ${patientHistory.pastIllnesses}`);
  if (patientHistory.chronicDiseases) patientProfileParts.push(`Chronic Diseases: ${patientHistory.chronicDiseases}`);
  if (patientHistory.currentMedications) patientProfileParts.push(`Current Medications (already taking): ${patientHistory.currentMedications}`);
  if (patientHistory.familyHistory) patientProfileParts.push(`Family History: ${patientHistory.familyHistory}`);
  if (patientHistory.lifestyleHabits) patientProfileParts.push(`Lifestyle: ${patientHistory.lifestyleHabits}`);
  if (patientHistory.previousSurgeries) patientProfileParts.push(`Previous Surgeries: ${patientHistory.previousSurgeries}`);
  if (patientHistory.pregnancyStatus) patientProfileParts.push(`Pregnancy Status: ${patientHistory.pregnancyStatus}`);

  const medicinesList = medicines.map((m, i) =>
    `${i + 1}. ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.frequency ? ` - ${m.frequency}` : ""}${m.duration ? ` for ${m.duration}` : ""}`
  ).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a clinical pharmacology expert AI performing prescription safety validation.

Your task is to analyze a prescription against the patient's medical history and detect:
1. DRUG-DRUG INTERACTIONS between prescribed medicines and between prescribed medicines and current medications the patient is already taking
2. DRUG-DISEASE CONFLICTS where a prescribed medicine may worsen an existing condition
3. ALLERGY RISKS where a prescribed medicine or its salt composition matches known allergies
4. PREGNANCY RISKS if the patient is pregnant or possibly pregnant
5. LIVER/KIDNEY RISK FACTORS based on patient history and conditions
6. AGE-RELATED RISKS (pediatric or geriatric concerns)
7. DOSAGE CONCERNS (unusually high or low doses)

RISK LEVEL DETERMINATION:
- "Low": No significant interactions or risks found. Safe to proceed.
- "Moderate": Minor interactions or precautions exist. Doctor should review but can proceed.
- "High": Serious interactions, allergy risks, contraindications, or pregnancy risks detected. Must not proceed without doctor override.

RULES:
1. Be thorough but avoid false positives — only flag clinically significant risks
2. Consider the Indian pharmaceutical context
3. If patient history is sparse, note limitations but still check inter-drug interactions
4. Always check all prescribed medicines against each other AND against current medications
5. Respond ONLY with valid JSON`
      },
      {
        role: "user",
        content: `Perform a prescription safety check for the following:

PATIENT PROFILE:
${patientProfileParts.length > 0 ? patientProfileParts.join("\n") : "No detailed history available"}

${diagnosis && diagnosis.length > 0 ? `CURRENT DIAGNOSIS:\n${diagnosis.join(", ")}` : ""}

PRESCRIBED MEDICINES:
${medicinesList}

Respond with JSON in this format:
{
  "riskLevel": "Low|Moderate|High",
  "flaggedMedicines": [
    {
      "medicineName": "Drug name",
      "riskType": "allergy|drug-disease|pregnancy|liver-kidney|age-related|dosage",
      "severity": "low|moderate|high",
      "explanation": "Detailed explanation of the risk"
    }
  ],
  "interactions": [
    {
      "drug1": "First drug",
      "drug2": "Second drug",
      "interactionType": "Type of interaction",
      "severity": "low|moderate|high",
      "explanation": "What happens and clinical significance"
    }
  ],
  "overallSummary": "Brief summary of the risk assessment"
}`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 3000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI did not return risk check results");
  }

  try {
    const parsed = JSON.parse(content) as RiskCheckResult;
    if (!parsed.flaggedMedicines) parsed.flaggedMedicines = [];
    if (!parsed.interactions) parsed.interactions = [];
    if (!parsed.riskLevel) parsed.riskLevel = "Low";
    if (!parsed.overallSummary) parsed.overallSummary = "Risk assessment completed.";
    console.log(`[AI] Risk check result: level=${parsed.riskLevel}, flagged=${parsed.flaggedMedicines.length}, interactions=${parsed.interactions.length}`);
    return parsed;
  } catch {
    throw new Error("Failed to parse risk check response");
  }
}

export interface PatientVoiceData {
  name: string;
  age: string;
  gender: string;
  mobile: string;
  knownConditions: string;
  allergies: string;
  pastIllnesses: string;
  chronicDiseases: string;
  currentMedications: string;
  familyHistory: string;
  lifestyleHabits: string;
  previousSurgeries: string;
  pregnancyStatus: string;
  bloodGroup: string;
  weight: string;
  height: string;
}

export async function extractPatientFromVoice(base64Audio: string, language: string = "English"): Promise<{ transcript: string; data: PatientVoiceData }> {
  console.log(`[AI] extractPatientFromVoice: base64 length=${base64Audio.length}, language=${language}`);
  const rawBuffer = Buffer.from(base64Audio, "base64");
  const { buffer: audioBuffer, format } = await smartFormatConvert(rawBuffer);

  const file = await toFile(audioBuffer, `audio.${format}`);
  const whisperResponse = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    prompt: `This is a patient speaking their personal and medical details for hospital registration. They may speak in English, Hindi, Marathi, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Urdu, or any Indian language, or a mix of languages. Transcribe EXACTLY what they say — preserve the original language, do NOT translate. Listen carefully for: patient name, age, gender, phone number (10-digit Indian mobile number like 9876543210), medical conditions, allergies, medications, surgeries, blood group, weight, height.`,
  });
  const transcript = whisperResponse.text;
  console.log(`[AI] Voice transcript received: ${transcript.length} chars`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert multilingual AI assistant for a hospital patient registration system in India.

You will receive a transcript of a patient speaking about themselves. The patient may speak in ANY language or mix of languages, including but not limited to:
- Hindi (हिंदी), English, Marathi (मराठी), Tamil (தமிழ்), Telugu (తెలుగు)
- Kannada (ಕನ್ನಡ), Malayalam (മലയാളം), Bengali (বাংলা), Gujarati (ગુજરાતી)
- Punjabi (ਪੰਜਾਬੀ), Urdu (اردو), Odia (ଓଡ଼ିଆ), Assamese (অসমীয়া)
- Hinglish (Hindi-English mix), Tanglish (Tamil-English mix), or any code-switched speech

You MUST understand all Indian languages and their transliterated/romanized forms.
Common transliterated terms to recognize:
- "mera naam" / "mera name" = my name (Hindi)
- "umr" / "umar" = age (Hindi/Urdu)
- "dawai" / "dawa" = medicine (Hindi)
- "bimari" / "rog" = disease (Hindi)
- "allergy" is commonly used as-is across all Indian languages
- "BP" / "sugar" / "thyroid" are commonly used in English across all languages
- "khoon ka group" = blood group (Hindi)
- "wajan" / "vazan" = weight (Hindi)
- "lambai" / "kaddi" = height (Hindi)
- Phone numbers may be spoken as individual digits or in groups

Your task is to extract structured patient registration data from the transcript.

CRITICAL LANGUAGE RULE:
First, detect the PRIMARY language used in the transcript. The user's preferred display language is "${language}", but the ACTUAL spoken language in the transcript takes priority.

Rules:
1. If the transcript is primarily in English (even if the display language is Hindi/Marathi/etc.), output ALL field values in English. Example: "Typhoid" stays "Typhoid", "Dust" stays "Dust", "no surgeries" stays as English.
2. If the transcript is primarily in Hindi, output ALL text field values in Hindi (Devanagari script). Example: "टाइफाइड", "धूल", "कोई नहीं".
3. If the transcript is primarily in Marathi, output in Marathi. Similarly for Tamil, Telugu, Kannada, etc.
4. If the transcript is mixed (e.g., Hinglish), use the DOMINANT language for output.
5. NEVER mix languages within the output — ALL text fields must be in the SAME language.

For numeric/standard fields (age, mobile, weight, height, bloodGroup), always use numbers/standard format regardless of language.
Gender: use the transcript's language ("Male"/"Female" for English, "पुरुष"/"स्त्री"/"महिला" for Hindi, etc.)

Extract the following fields (return empty string "" if not mentioned):
- name: Patient's full name (in the same language/script as spoken)
- age: Age in years (number as string)
- gender: Gender in the spoken language
- mobile: Mobile phone number (digits only, combine all spoken digits into one continuous 10-digit number for Indian numbers. E.g. "nine eight seven six five four three two one zero" = "9876543210")
- knownConditions: Known medical conditions (in spoken language)
- allergies: Allergies (in spoken language)
- pastIllnesses: Past illnesses (in spoken language)
- chronicDiseases: Chronic diseases (in spoken language)
- currentMedications: Current medications with dosages (in spoken language)
- familyHistory: Family medical history (in spoken language)
- lifestyleHabits: Lifestyle details (in spoken language)
- previousSurgeries: Past surgeries with year if mentioned (in spoken language). If the patient says "none" or "no surgeries", write that in the spoken language (e.g., "None" in English, "कोई नहीं" in Hindi). Do NOT leave empty if they explicitly said none.
- pregnancyStatus: Pregnancy status if applicable (in spoken language), else ""
- bloodGroup: Blood group (e.g., "B+", "O-", "A+")
- weight: Weight in kg (number as string)
- height: Height in cm (number as string). Convert feet/inches to cm if needed (5'6" = 168cm)

IMPORTANT: Only fill fields that the patient actually mentioned. If a field was NOT mentioned at all, return empty string "". Do NOT guess or infer values that weren't spoken.

Return ONLY valid JSON in exactly this format:
{
  "name": "",
  "age": "",
  "gender": "",
  "mobile": "",
  "knownConditions": "",
  "allergies": "",
  "pastIllnesses": "",
  "chronicDiseases": "",
  "currentMedications": "",
  "familyHistory": "",
  "lifestyleHabits": "",
  "previousSurgeries": "",
  "pregnancyStatus": "",
  "bloodGroup": "",
  "weight": "",
  "height": ""
}`
      },
      {
        role: "user",
        content: `Patient voice transcript (may be in any Indian language or mixed languages):\n\n${transcript}`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  console.log(`[AI] Patient voice extraction completed: ${raw.length} chars`);
  try {
    const parsed = JSON.parse(raw);
    const data: PatientVoiceData = {
      name: parsed.name || "",
      age: parsed.age || "",
      gender: parsed.gender || "",
      mobile: parsed.mobile || "",
      knownConditions: parsed.knownConditions || "",
      allergies: parsed.allergies || "",
      pastIllnesses: parsed.pastIllnesses || "",
      chronicDiseases: parsed.chronicDiseases || "",
      currentMedications: parsed.currentMedications || "",
      familyHistory: parsed.familyHistory || "",
      lifestyleHabits: parsed.lifestyleHabits || "",
      previousSurgeries: parsed.previousSurgeries || "",
      pregnancyStatus: parsed.pregnancyStatus || "",
      bloodGroup: parsed.bloodGroup || "",
      weight: parsed.weight || "",
      height: parsed.height || "",
    };
    return { transcript, data };
  } catch {
    throw new Error("Failed to parse patient voice extraction");
  }
}

export interface DoctorVoiceData {
  name: string;
  email: string;
  phone: string;
  specialization: string;
  licenseNumber: string;
  clinicName: string;
  clinicAddress: string;
  experience: string;
  qualifications: string;
}

export async function extractDoctorFromVoice(base64Audio: string): Promise<{ transcript: string; data: DoctorVoiceData }> {
  console.log(`[AI] extractDoctorFromVoice: base64 length=${base64Audio.length}`);
  const rawBuffer = Buffer.from(base64Audio, "base64");
  const { buffer: audioBuffer, format } = await smartFormatConvert(rawBuffer);

  const file = await toFile(audioBuffer, `audio.${format}`);
  const whisperResponse = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    prompt: `This is a doctor speaking their professional details for registration on a medical platform. They may speak in English, Hindi, Marathi, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Urdu, or any Indian language, or a mix. Transcribe EXACTLY what they say. Listen for: doctor name, email, phone number, specialization, license number (like MCI number), clinic name, clinic address, years of experience, qualifications (MBBS, MD, etc).`,
  });
  const transcript = whisperResponse.text;
  console.log(`[AI] Doctor voice transcript: ${transcript.length} chars`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert multilingual AI assistant for a doctor registration system in India.

You will receive a transcript of a doctor speaking their professional details. The doctor may speak in ANY Indian language or mix of languages.

Your task: Extract structured doctor registration data from the transcript and OUTPUT EVERYTHING IN ENGLISH. Regardless of what language the doctor speaks, ALL values must be in English (transliterate names, translate specializations, etc).

Rules:
1. Name: Transliterate to English if spoken in another language. Add "Dr." prefix if not present.
2. Email: Extract if spoken (e.g., "my email is priya at gmail dot com" → "priya@gmail.com")
3. Phone: Extract digits only. Combine spoken digits into one number.
4. Specialization: Translate to standard English medical specialization (e.g., "सामान्य चिकित्सा" → "General Medicine", "हृदय रोग" → "Cardiology")
5. License Number: Extract as-is (e.g., "MCI-12345", "KMC-9876")
6. Clinic Name: Transliterate/translate to English
7. Clinic Address: Transliterate/translate to English
8. Experience: Extract number of years as a string (e.g., "5")
9. Qualifications: Use standard English abbreviations (MBBS, MD, MS, DM, MCh, DNB, etc.)

IMPORTANT: Only fill fields that the doctor actually mentioned. If not mentioned, return empty string "".

Return ONLY valid JSON:
{
  "name": "",
  "email": "",
  "phone": "",
  "specialization": "",
  "licenseNumber": "",
  "clinicName": "",
  "clinicAddress": "",
  "experience": "",
  "qualifications": ""
}`
      },
      {
        role: "user",
        content: `Doctor voice transcript:\n\n${transcript}`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  console.log(`[AI] Doctor voice extraction completed: ${raw.length} chars`);
  try {
    const parsed = JSON.parse(raw);
    const data: DoctorVoiceData = {
      name: parsed.name || "",
      email: parsed.email || "",
      phone: parsed.phone || "",
      specialization: parsed.specialization || "",
      licenseNumber: parsed.licenseNumber || "",
      clinicName: parsed.clinicName || "",
      clinicAddress: parsed.clinicAddress || "",
      experience: parsed.experience || "",
      qualifications: parsed.qualifications || "",
    };
    return { transcript, data };
  } catch {
    throw new Error("Failed to parse doctor voice extraction");
  }
}

export async function transliterateNamesToEnglish(names: string[]): Promise<string[]> {
  const nonAsciiNames = names.filter(n => /[^\x00-\x7F]/.test(n));
  if (nonAsciiNames.length === 0) return names;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a transliteration expert. Convert the given non-English names (written in scripts like Devanagari, Tamil, Telugu, etc.) into their English/Roman script equivalent. Keep names that are already in English unchanged. Return a JSON object with key "names" containing an array of transliterated names in the same order as input.`
        },
        {
          role: "user",
          content: JSON.stringify(names)
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.names) && parsed.names.length === names.length) {
      return parsed.names;
    }
    return names;
  } catch {
    return names;
  }
}

export async function translatePatientHistoryToEnglish(history: Record<string, string>): Promise<Record<string, string>> {
  const fieldsToTranslate = Object.entries(history).filter(([_, v]) => v && v.trim().length > 0);
  if (fieldsToTranslate.length === 0) return history;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a medical translator. Translate the given patient medical history fields to English. Keep medical terms accurate. If a value is already in English, keep it as-is. If a value is "NA", "None", empty, or a number, keep it unchanged. Return the same JSON structure with translated values.`
      },
      {
        role: "user",
        content: JSON.stringify(Object.fromEntries(fieldsToTranslate))
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  try {
    const translated = JSON.parse(raw);
    const result = { ...history };
    for (const key of Object.keys(translated)) {
      if (translated[key]) result[key] = translated[key];
    }
    return result;
  } catch {
    return history;
  }
}
