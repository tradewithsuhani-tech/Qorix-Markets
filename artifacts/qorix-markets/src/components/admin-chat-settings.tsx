// Admin "AI Settings" tab for /admin/chats — Task #145, Batch C.
//
// Backed by `GET /api/admin/chat/settings` and `PUT /api/admin/chat/settings`
// (api-server routes/chat.ts). The PUT is zod-validated server-side and
// audit-logged. The 60s in-process cache on the API side is busted on save
// for THIS Fly machine instantly; other machines pick up within 60s.
//
// Surface:
//   - Kill switch (settings.enabled). Off → all replies fall back to the
//     rule-tree quick options instead of hitting OpenAI.
//   - Model + temperature + max-tokens. The server enforces a 8192-token
//     floor for gpt-5* models so dialing this down can't break replies.
//   - System prompt (override). Empty → falls back to DEFAULT_SYSTEM_PROMPT
//     baked into the api-server bundle. "Reset to default" sets it to NULL
//     server-side; "Load default" pre-fills the editor with the canonical
//     copy so the admin can tweak it instead of starting from scratch.
//   - Deposit CTA copy editor for the three variants the LLM may emit
//     (small_deposit / view_dashboard / talk_to_expert). Empty fields fall
//     back to the hardcoded defaults in routes/chat.ts → buildCtaCard().
//   - Email-followup config (delivered by the Batch D worker). Subject/body
//     plus the {{name}} / {{cta_url}} placeholders the worker substitutes.

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Settings, Save, RotateCcw, AlertCircle, CheckCircle2, Power,
  Sparkles, Zap, Mail, MousePointerClick, Loader2,
} from "lucide-react";

interface QuickReply {
  id: string;
  label: string;
  value: string;
  lang?: string;
}

interface DepositCtaOverrides {
  [variant: string]: { label?: string; ackText?: string; href?: string };
}

interface EmailFollowup2Config {
  enabled?: boolean;
  delayHours?: number;
  subject?: string;
  body?: string;
}

interface EmailFollowupConfig {
  enabled?: boolean;
  delayMinutes?: number;
  subject?: string;
  body?: string;
  fromName?: string;
  ctaUrl?: string;
  followup2?: EmailFollowup2Config;
}

interface ResolvedChatSettings {
  systemPrompt: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  quickReplies: QuickReply[];
  depositCta: DepositCtaOverrides;
  emailFollowup: EmailFollowupConfig;
  updatedAt: string | null;
}

interface SettingsResponse {
  settings: ResolvedChatSettings;
  defaults: {
    systemPrompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

// Curated list — anything else still works (server validates min 2 chars)
// but admins should normally pick from the supported families. Comment
// captures what each family is actually for.
const MODEL_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: "gpt-4o-mini", label: "gpt-4o-mini", hint: "fast • cheap • good default" },
  { value: "gpt-4o",      label: "gpt-4o",      hint: "smarter, ~10× cost" },
  { value: "gpt-5-mini",  label: "gpt-5-mini",  hint: "reasoning model, slower" },
  { value: "gpt-5",       label: "gpt-5",       hint: "best quality, expensive" },
];

const CTA_VARIANTS: Array<{ key: string; title: string; description: string }> = [
  {
    key: "small_deposit",
    title: "Start with a small deposit",
    description: "Shown to ready-to-invest leads. Drives /deposit clicks.",
  },
  {
    key: "view_dashboard",
    title: "Show me the dashboard",
    description: "Soft CTA for returning users curious about returns.",
  },
  {
    key: "talk_to_expert",
    title: "Talk to a human advisor",
    description: "Hand-off CTA — flips session to expert_requested.",
  },
];

export default function AdminChatSettings() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Editable copies — `data.settings` is the server truth and `form` is what
  // the admin is typing. We only PUT on explicit Save so accidental keystrokes
  // never deploy a partial config.
  const [enabled, setEnabled] = useState(true);
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [depositCta, setDepositCta] = useState<DepositCtaOverrides>({});
  const [emailFollowup, setEmailFollowup] = useState<EmailFollowupConfig>({});

  const load = useCallback(async () => {
    try {
      const r = await authFetch("/api/admin/chat/settings");
      const json = (await r) as SettingsResponse;
      setData(json);
      setEnabled(json.settings.enabled);
      setModel(json.settings.model);
      setTemperature(json.settings.temperature);
      setMaxTokens(json.settings.maxTokens);
      setSystemPrompt(json.settings.systemPrompt ?? "");
      setDepositCta(json.settings.depositCta ?? {});
      setEmailFollowup(json.settings.emailFollowup ?? {});
      setError(null);
    } catch (e) {
      setError((e as Error).message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      // Empty textarea → null on the server (use baked-in default).
      const promptValue = systemPrompt.trim().length === 0 ? null : systemPrompt;
      const body = JSON.stringify({
        enabled,
        model,
        temperature,
        maxTokens,
        systemPrompt: promptValue,
        depositCta,
        emailFollowup,
      });
      const json = (await authFetch("/api/admin/chat/settings", {
        method: "PUT",
        body,
      })) as { success: boolean; settings: ResolvedChatSettings };
      if (json?.settings) {
        setData((prev) => (prev ? { ...prev, settings: json.settings } : prev));
        setSavedAt(Date.now());
        // Clear the saved-OK indicator after a few seconds.
        setTimeout(() => setSavedAt(null), 3500);
      }
    } catch (e) {
      setError((e as Error).message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleResetPromptToDefault() {
    // Empty → server stores NULL → falls back to DEFAULT_SYSTEM_PROMPT.
    setSystemPrompt("");
  }

  function handleLoadDefaultIntoEditor() {
    if (data?.defaults?.systemPrompt) {
      setSystemPrompt(data.defaults.systemPrompt);
    }
  }

  function updateCta(variant: string, field: "label" | "ackText" | "href", value: string) {
    setDepositCta((prev) => {
      const next = { ...prev };
      const current = { ...(next[variant] ?? {}) };
      if (value.trim().length === 0) {
        delete (current as Record<string, string>)[field];
      } else {
        current[field] = value;
      }
      if (Object.keys(current).length === 0) {
        delete next[variant];
      } else {
        next[variant] = current;
      }
      return next;
    });
  }

  function updateEmailField<K extends keyof EmailFollowupConfig>(
    field: K,
    value: EmailFollowupConfig[K] | undefined,
  ) {
    setEmailFollowup((prev) => {
      const next = { ...prev };
      if (value === undefined || value === "" || value === null) {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  }

  // Batch M: nested followup2 setter — keeps top-level emailFollowup keys
  // untouched and prunes empty values so the saved JSONB stays minimal.
  function updateFollowup2Field<K extends keyof EmailFollowup2Config>(
    field: K,
    value: EmailFollowup2Config[K] | undefined,
  ) {
    setEmailFollowup((prev) => {
      const nested: EmailFollowup2Config = { ...(prev.followup2 ?? {}) };
      if (value === undefined || value === "" || value === null) {
        delete nested[field];
      } else {
        nested[field] = value;
      }
      const next = { ...prev };
      if (Object.keys(nested).length === 0) {
        delete next.followup2;
      } else {
        next.followup2 = nested;
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <p className="text-sm text-rose-300">{error}</p>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70"
        >
          Retry
        </button>
      </div>
    );
  }

  const promptIsOverride = systemPrompt.trim().length > 0;
  const promptDiffersFromDefault =
    promptIsOverride && systemPrompt !== (data?.defaults?.systemPrompt ?? "");

  return (
    <div className="flex-1 overflow-y-auto px-1 pb-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Sticky save bar */}
        <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[#0a0e1a]/90 backdrop-blur-md border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">AI Chat Settings</h2>
            {data?.settings.updatedAt && (
              <span className="text-[10px] text-white/30">
                last saved {new Date(data.settings.updatedAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {savedAt && (
              <motion.div
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1 text-xs text-emerald-400"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved
              </motion.div>
            )}
            {error && (
              <span className="text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                saving
                  ? "bg-white/5 border-white/10 text-white/40 cursor-wait"
                  : "bg-blue-600/20 border-blue-500/40 text-blue-200 hover:bg-blue-600/30",
              )}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save changes
            </button>
          </div>
        </div>

        {/* Kill switch */}
        <SettingsCard
          icon={<Power className="w-4 h-4 text-emerald-400" />}
          title="LLM Replies"
          description={
            enabled
              ? "AI is answering visitor messages on landing, login and in-app chat."
              : "AI is OFF — visitors see fallback options + Talk-to-Expert hand-off."
          }
        >
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span className={cn("text-sm", enabled ? "text-emerald-300" : "text-white/40")}>
              {enabled ? "Enabled" : "Disabled (kill switch)"}
            </span>
          </div>
        </SettingsCard>

        {/* Model + temperature + max tokens */}
        <SettingsCard
          icon={<Sparkles className="w-4 h-4 text-violet-400" />}
          title="Model"
          description="Picks the OpenAI model used for every reply. gpt-5* models ignore the temperature slider (they only support the default)."
        >
          <div className="grid grid-cols-2 gap-2">
            {MODEL_OPTIONS.map((opt) => {
              const active = model === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setModel(opt.value)}
                  className={cn(
                    "text-left px-3 py-2 rounded-lg border transition-all",
                    active
                      ? "bg-violet-600/20 border-violet-500/40"
                      : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]",
                  )}
                >
                  <div className={cn("text-sm font-medium", active ? "text-violet-200" : "text-white/80")}>
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-white/40">{opt.hint}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-white/50">Temperature</label>
                <span className="text-xs font-mono text-white/70">{temperature.toFixed(2)}</span>
              </div>
              <Slider
                value={[temperature]}
                onValueChange={(v) => setTemperature(v[0] ?? 0.7)}
                min={0}
                max={2}
                step={0.05}
                disabled={/^gpt-5/i.test(model)}
              />
              <p className="text-[10px] text-white/30 mt-1">
                {/^gpt-5/i.test(model)
                  ? "gpt-5* uses default temperature only."
                  : "Lower = more focused. Higher = more creative."}
              </p>
            </div>
            <div>
              <label className="text-xs text-white/50">Max tokens</label>
              <input
                type="number"
                value={maxTokens}
                min={256}
                max={32768}
                step={256}
                onChange={(e) => setMaxTokens(parseInt(e.target.value || "0", 10) || 0)}
                className="mt-1.5 w-full px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 font-mono focus:outline-none focus:border-violet-500/40"
              />
              <p className="text-[10px] text-white/30 mt-1">
                {/^gpt-5/i.test(model)
                  ? "gpt-5* enforces 8192-token floor (reasoning budget)."
                  : "Cap on the reply length. 600–2048 typical."}
              </p>
            </div>
          </div>
        </SettingsCard>

        {/* System prompt */}
        <SettingsCard
          icon={<Zap className="w-4 h-4 text-amber-400" />}
          title="System Prompt"
          description={
            promptIsOverride
              ? promptDiffersFromDefault
                ? "Using a CUSTOM prompt (overrides the baked-in default)."
                : "Using the default prompt (loaded into the editor)."
              : "Using the baked-in DEFAULT_SYSTEM_PROMPT shipped with the app."
          }
        >
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Empty = use the baked-in default prompt."
            className="min-h-[280px] font-mono text-xs bg-white/[0.03] border-white/[0.08] resize-y"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-white/30">
              {systemPrompt.length.toLocaleString()} chars
              {data?.defaults?.systemPrompt && (
                <span className="text-white/20">
                  {" "}/ default is {data.defaults.systemPrompt.length.toLocaleString()}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLoadDefaultIntoEditor}
                className="text-[11px] px-2 py-1 rounded bg-white/[0.04] border border-white/[0.06] text-white/60 hover:text-white/90 hover:bg-white/[0.08]"
              >
                Load default into editor
              </button>
              <button
                onClick={handleResetPromptToDefault}
                disabled={!promptIsOverride}
                className={cn(
                  "flex items-center gap-1 text-[11px] px-2 py-1 rounded border",
                  promptIsOverride
                    ? "bg-white/[0.04] border-white/[0.06] text-white/60 hover:text-white/90"
                    : "bg-white/[0.02] border-white/[0.04] text-white/20 cursor-not-allowed",
                )}
              >
                <RotateCcw className="w-3 h-3" />
                Clear → use default
              </button>
            </div>
          </div>
        </SettingsCard>

        {/* Deposit CTA copy editor */}
        <SettingsCard
          icon={<MousePointerClick className="w-4 h-4 text-cyan-400" />}
          title="CTA Copy Overrides"
          description="Override the labels/href for the three CTA cards the LLM emits. Empty = use the hardcoded default."
        >
          <div className="space-y-3">
            {CTA_VARIANTS.map((variant) => {
              const cur = depositCta[variant.key] ?? {};
              return (
                <div
                  key={variant.key}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="mb-2">
                    <p className="text-xs font-medium text-white/80">{variant.title}</p>
                    <p className="text-[10px] text-white/30">{variant.description}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <FieldRow
                      label="Button label"
                      value={cur.label ?? ""}
                      placeholder={variant.title}
                      onChange={(v) => updateCta(variant.key, "label", v)}
                    />
                    <FieldRow
                      label="Acknowledgement copy"
                      value={cur.ackText ?? ""}
                      placeholder="(short bot reply after the user clicks)"
                      onChange={(v) => updateCta(variant.key, "ackText", v)}
                    />
                    {variant.key !== "talk_to_expert" && (
                      <FieldRow
                        label="Link URL"
                        value={cur.href ?? ""}
                        placeholder={variant.key === "small_deposit" ? "/deposit" : "/dashboard"}
                        onChange={(v) => updateCta(variant.key, "href", v)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsCard>

        {/* Email follow-up config */}
        <SettingsCard
          icon={<Mail className="w-4 h-4 text-pink-400" />}
          title="Lead Email Follow-up"
          description="When a guest leaves their email, send a follow-up after a delay. Worker delivery wired in Batch D."
        >
          <div className="flex items-center gap-3 mb-4">
            <Switch
              checked={emailFollowup.enabled === true}
              onCheckedChange={(v) => updateEmailField("enabled", v)}
            />
            <span className={cn("text-sm", emailFollowup.enabled ? "text-pink-300" : "text-white/40")}>
              {emailFollowup.enabled ? "Follow-up emails ON" : "Follow-up emails OFF"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <FieldRow
              label="Delay (minutes)"
              value={emailFollowup.delayMinutes != null ? String(emailFollowup.delayMinutes) : ""}
              placeholder="60"
              type="number"
              onChange={(v) => {
                const n = parseInt(v, 10);
                updateEmailField("delayMinutes", Number.isFinite(n) && n > 0 ? n : undefined);
              }}
            />
            <FieldRow
              label="From name"
              value={emailFollowup.fromName ?? ""}
              placeholder="Qorix Markets"
              onChange={(v) => updateEmailField("fromName", v || undefined)}
            />
          </div>
          <FieldRow
            label="Subject"
            value={emailFollowup.subject ?? ""}
            placeholder="Following up from Qorix Markets"
            onChange={(v) => updateEmailField("subject", v || undefined)}
          />
          <FieldRow
            label="CTA URL"
            value={emailFollowup.ctaUrl ?? ""}
            placeholder="https://qorixmarkets.com/signup"
            onChange={(v) => updateEmailField("ctaUrl", v || undefined)}
          />

          <div className="mt-3">
            <label className="text-xs text-white/50">Body (supports {"{{name}}"} {"{{cta_url}}"})</label>
            <Textarea
              value={emailFollowup.body ?? ""}
              onChange={(e) => updateEmailField("body", e.target.value || undefined)}
              placeholder="Hi {{name}}, thanks for chatting with Qorix Markets..."
              className="mt-1.5 min-h-[160px] text-xs bg-white/[0.03] border-white/[0.08] resize-y"
            />
          </div>

          {/*
            Batch M: 2nd-nudge sub-section. Lives inside the same card to make
            the chain (1st → 2nd → manual) visually obvious. Hard-capped at 2
            total attempts by the worker; CTA URL is reused from the parent.
            Disabled by default — admin must opt in.
          */}
          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs font-medium text-pink-300/90">Second nudge</div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  Sent after the first nudge if the lead hasn't converted or unsubscribed. Hard-capped at 2 total attempts.
                </div>
              </div>
              <Switch
                checked={emailFollowup.followup2?.enabled === true}
                onCheckedChange={(v) => updateFollowup2Field("enabled", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <FieldRow
                label="Delay after 1st (hours)"
                value={
                  emailFollowup.followup2?.delayHours != null
                    ? String(emailFollowup.followup2.delayHours)
                    : ""
                }
                placeholder="72"
                type="number"
                onChange={(v) => {
                  const n = parseInt(v, 10);
                  updateFollowup2Field("delayHours", Number.isFinite(n) && n > 0 ? n : undefined);
                }}
              />
              <div className="text-[10px] text-white/30 self-end pb-2">
                Reuses CTA URL & From-name from above.
              </div>
            </div>

            <FieldRow
              label="Subject"
              value={emailFollowup.followup2?.subject ?? ""}
              placeholder="Still here when you're ready"
              onChange={(v) => updateFollowup2Field("subject", v || undefined)}
            />

            <div className="mt-3">
              <label className="text-xs text-white/50">Body (supports {"{{name}}"} {"{{cta_url}}"})</label>
              <Textarea
                value={emailFollowup.followup2?.body ?? ""}
                onChange={(e) => updateFollowup2Field("body", e.target.value || undefined)}
                placeholder="Hi {{name}}, just circling back one more time..."
                className="mt-1.5 min-h-[140px] text-xs bg-white/[0.03] border-white/[0.08] resize-y"
              />
            </div>
          </div>
        </SettingsCard>

        <p className="text-[10px] text-white/20 text-center pt-2 pb-6">
          Changes are audit-logged. Other API instances pick up within 60s; this instance updates immediately.
        </p>
      </div>
    </div>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "#0f1422", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-[11px] text-white/40">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function FieldRow({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "number";
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] text-white/40">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs text-white/80 focus:outline-none focus:border-blue-500/40 placeholder:text-white/20"
      />
    </div>
  );
}
