// AI question generation for quiz drafts.
//
// Uses the existing Replit AI Integrations OpenAI proxy (gpt-5-mini) to
// produce 5 finance/markets/trading MCQs in a strict JSON envelope. Returns
// editable drafts to the admin — nothing auto-saves. If the LLM is offline
// or returns malformed JSON we surface a clear error rather than fabricate
// dummy questions, so the admin always knows whether generation succeeded.

import { getOpenAIClient, isLLMAvailable } from "./openai-client";
import { logger } from "./logger";

export type AiDraftQuestion = {
  prompt: string;
  options: string[]; // length 4
  correctIndex: number; // 0..3
  explanation: string;
};

const SYSTEM_PROMPT = `You write multiple-choice quiz questions for a finance/markets/trading audience.
Topics: stocks, crypto, forex, indices, fundamental + technical concepts, risk management, options basics, common chart patterns, well-known macro events.
Difficulty: intermediate (a casual retail trader should get ~3 of 5 right).

CONSTRAINTS
- Exactly 5 questions.
- Each question has EXACTLY 4 options.
- Exactly one option is correct.
- Keep prompts under 200 characters.
- Keep each option under 80 characters.
- Provide a 1-sentence explanation referencing why the correct answer is right.
- DO NOT include guarantees of profit, "this WILL go up", or specific BUY/SELL advice.
- DO NOT reference Qorix Markets internal data — questions are about general financial knowledge.
- Avoid duplicates with the prior set when "previousPrompts" is provided.

OUTPUT
Reply with PURE JSON (no markdown, no commentary) matching:
{
  "questions": [
    { "prompt": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "..." }
  ]
}`;

export async function generateQuizQuestions(opts: {
  topicHint?: string;
  previousPrompts?: string[];
}): Promise<AiDraftQuestion[]> {
  if (!isLLMAvailable()) {
    throw new Error("ai_unavailable");
  }
  const client = getOpenAIClient()!;
  const userPayload = JSON.stringify({
    topicHint: opts.topicHint ?? "general finance + markets + trading",
    previousPrompts: opts.previousPrompts ?? [],
  });

  let raw = "";
  try {
    const completion = await client.chat.completions.create({
      // gpt-5-mini matches what chat-llm.ts uses elsewhere — same model
      // family, same proxy budget.
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
      // Force JSON-shaped output so the admin doesn't see "Sure! Here you go:"
      // prefixes in the parsed payload.
      response_format: { type: "json_object" },
    });
    raw = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[quiz-ai] LLM call failed");
    throw new Error("ai_call_failed");
  }

  // Defensive parse — bad JSON or wrong shape becomes a clean error rather
  // than 500ing the admin route.
  let parsed: { questions?: AiDraftQuestion[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn({ raw: raw.slice(0, 500) }, "[quiz-ai] non-JSON response");
    throw new Error("ai_bad_json");
  }
  const arr = parsed.questions;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("ai_empty");
  }
  // Take exactly 5; validate shape. Anything malformed is dropped so we
  // surface only the parts the admin can actually edit.
  const cleaned: AiDraftQuestion[] = [];
  for (const q of arr.slice(0, 5)) {
    if (
      typeof q?.prompt !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      q.options.some((o) => typeof o !== "string" || !o.trim()) ||
      typeof q.correctIndex !== "number" ||
      q.correctIndex < 0 ||
      q.correctIndex > 3 ||
      typeof q.explanation !== "string"
    ) {
      continue;
    }
    cleaned.push({
      prompt: q.prompt.trim().slice(0, 500),
      options: q.options.map((o) => o.trim().slice(0, 200)),
      correctIndex: q.correctIndex,
      explanation: q.explanation.trim().slice(0, 500),
    });
  }
  if (cleaned.length === 0) {
    throw new Error("ai_invalid_shape");
  }
  return cleaned;
}
