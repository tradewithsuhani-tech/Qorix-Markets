import OpenAI from "openai";
import { logger } from "./logger";

// Replit AI Integrations proxy provisions both BASE_URL and a dummy API key.
// Both must be present; if either is missing the assistant LLM endpoint
// returns a clean 503 (handled by the caller). We deliberately do NOT throw
// at module load — the api-server boots many features and the chat assistant
// being unavailable should never crash unrelated routes.
const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

let client: OpenAI | null = null;

if (baseURL && apiKey) {
  client = new OpenAI({ baseURL, apiKey });
} else {
  logger.warn(
    {
      hasBaseUrl: Boolean(baseURL),
      hasApiKey: Boolean(apiKey),
    },
    "[openai-client] AI_INTEGRATIONS_OPENAI_* env vars missing — chat assistant LLM disabled",
  );
}

export function getOpenAIClient(): OpenAI | null {
  return client;
}

export function isLLMAvailable(): boolean {
  return client !== null;
}
