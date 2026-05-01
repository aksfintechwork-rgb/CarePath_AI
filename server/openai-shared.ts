import OpenAI from "openai";

/**
 * Builds an OpenAI client. Uses a non-empty placeholder apiKey when unset so the
 * process can boot without credentials; AI routes will fail at request time until configured.
 */
export function createOpenAI(): OpenAI {
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "carepath-dev-missing-openai-key";
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}
