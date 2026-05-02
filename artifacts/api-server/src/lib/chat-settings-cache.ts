// In-process cache for the singleton chat_settings row.
//
// Why a cache:
//   Every /chat/llm-reply and /chat/guest-llm-reply call needs to know the
//   active system prompt, model, temperature, max_tokens, deposit_cta copy,
//   etc. Hitting Postgres on every chat turn would add a needless round-trip
//   to the hot path. The settings table is admin-edited and changes maybe
//   a few times a week, so a small TTL is fine.
//
// Cache TTL of 60 s gives admins near-immediate feedback after saving
// (worst case: settings change visible within one minute) while keeping
// per-request DB load to roughly 1 read per Fly machine per minute.
//
// `invalidateChatSettings()` is called from the admin PUT handler so an
// explicit save shows up across THIS instance immediately. Other Fly
// instances still observe the change within the 60 s TTL — acceptable for
// a config table that changes rarely.
//
// The cache survives across requests but is per-process: a fresh deploy or
// a Fly machine restart starts with an empty cache (which is fine — the
// first chat hit re-fetches).

import { db } from "@workspace/db";
import { chatSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface QuickReply {
  id: string;
  label: string;
  value: string;
  lang?: string;
}

export interface DepositCtaOverrides {
  [variant: string]: {
    label?: string;
    ackText?: string;
    href?: string;
  };
}

export interface EmailFollowupConfig {
  enabled?: boolean;
  delayMinutes?: number;
  subject?: string;
  body?: string;
  fromName?: string;
  ctaUrl?: string;
}

export interface ResolvedChatSettings {
  systemPrompt: string | null;       // null → caller falls back to DEFAULT_SYSTEM_PROMPT in chat-llm.ts
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  quickReplies: QuickReply[];
  depositCta: DepositCtaOverrides;
  emailFollowup: EmailFollowupConfig;
  updatedAt: Date | null;
}

const TTL_MS = 60_000;

let cache: { value: ResolvedChatSettings; expiresAt: number } | null = null;

const HARD_DEFAULTS: ResolvedChatSettings = {
  systemPrompt: null,
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 8192,
  enabled: true,
  quickReplies: [],
  depositCta: {},
  emailFollowup: {},
  updatedAt: null,
};

export async function getChatSettings(): Promise<ResolvedChatSettings> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  try {
    const rows = await db
      .select()
      .from(chatSettingsTable)
      .where(eq(chatSettingsTable.id, 1))
      .limit(1);
    const row = rows[0];

    const value: ResolvedChatSettings = row
      ? {
          systemPrompt: row.systemPrompt,
          model: row.model,
          temperature: Number(row.temperature),
          maxTokens: row.maxTokens,
          enabled: row.enabled,
          quickReplies: Array.isArray(row.quickReplies) ? row.quickReplies : [],
          depositCta: row.depositCta && typeof row.depositCta === "object" ? row.depositCta : {},
          emailFollowup: row.emailFollowup && typeof row.emailFollowup === "object" ? row.emailFollowup : {},
          updatedAt: row.updatedAt,
        }
      : HARD_DEFAULTS;

    cache = { value, expiresAt: now + TTL_MS };
    return value;
  } catch (err) {
    // Never let a settings-table outage take down chat. Serve hard defaults
    // and log loudly so the on-call sees the underlying DB issue.
    logger.warn(
      { err: (err as Error).message },
      "[chat-settings-cache] failed to read chat_settings — serving HARD_DEFAULTS",
    );
    return HARD_DEFAULTS;
  }
}

export function invalidateChatSettings(): void {
  cache = null;
}
