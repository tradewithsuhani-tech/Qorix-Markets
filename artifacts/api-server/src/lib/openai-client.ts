import OpenAI from "openai";
import { logger } from "./logger";

// Two equally-valid configurations are supported, in order of preference:
//
//   (A) OPENAI_API_KEY              — direct OpenAI account key (production
//                                     default; user pays OpenAI directly).
//   (B) AI_INTEGRATIONS_OPENAI_*    — Replit AI Integrations proxy (legacy /
//                                     dev-only; both BASE_URL and API_KEY
//                                     must be present).
//
// We deliberately do NOT throw at module load — the api-server boots many
// features and the chat assistant being unavailable should never crash
// unrelated routes. Callers should consult `isLLMAvailable()` and serve
// the rule-tree fallback when it returns false.
const directKey = process.env["OPENAI_API_KEY"];
const proxyBaseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
const proxyKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

let client: OpenAI | null = null;
let mode: "direct" | "proxy" | "disabled" = "disabled";

if (directKey) {
  client = new OpenAI({ apiKey: directKey });
  mode = "direct";
} else if (proxyBaseURL && proxyKey) {
  client = new OpenAI({ baseURL: proxyBaseURL, apiKey: proxyKey });
  mode = "proxy";
} else {
  logger.warn(
    {
      hasOpenAIKey: Boolean(directKey),
      hasProxyBaseUrl: Boolean(proxyBaseURL),
      hasProxyKey: Boolean(proxyKey),
    },
    "[openai-client] no OpenAI credentials configured — chat assistant LLM disabled",
  );
}

if (client) {
  logger.info({ mode }, "[openai-client] OpenAI client initialised");
}

export function getOpenAIClient(): OpenAI | null {
  return client;
}

export function isLLMAvailable(): boolean {
  return client !== null;
}

export function getLLMMode(): "direct" | "proxy" | "disabled" {
  return mode;
}
