// ─────────────────────────────────────────────────────────────────────────────
// TelegramAlertsCard — settings card for opt-in Telegram bot alerts.
//
// State machine:
//   1. NOT LINKED, idle      → "Link Telegram" button.
//   2. NOT LINKED, code shown → 8-char code + "Open Telegram" deep link, polls
//                               /status every 3s; when linked === true, advances.
//   3. LINKED                 → username, Mute/Unmute toggle, Unlink button.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { Send, ExternalLink, Loader2, Unlink, Copy, CheckCircle2 } from "lucide-react";

type Status = {
  linked: boolean;
  username: string | null;
  linkedAt: string | null;
  optIn: boolean;
  configured: boolean;
};

type LinkResp = {
  code: string;
  deepLink: string; // legacy alias of httpsUrl
  httpsUrl: string;
  tgUrl: string;
  botUsername: string;
  expiresAt: string;
};

export function TelegramAlertsCard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [linkData, setLinkData] = useState<LinkResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  const refresh = async () => {
    try {
      const r = await authFetch<Status>("/api/telegram/status");
      setStatus(r);
      // If we were waiting for a link to land and the user is now linked,
      // close the deep-link panel and celebrate.
      if (r.linked && linkData) {
        setLinkData(null);
        toast({ title: "Telegram linked!", description: "Alerts are on." });
      }
      return r;
    } catch (err) {
      // Silent — settings page may load before auth is fully hot.
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While the deep-link panel is open, poll status every 3s so the UI flips
  // automatically the moment the user finishes /start in Telegram.
  useEffect(() => {
    if (!linkData) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = window.setInterval(() => void refresh(), 3000);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkData]);

  async function startLink() {
    setWorking(true);
    try {
      const r = await authFetch<LinkResp>("/api/telegram/link/start", { method: "POST" });
      setLinkData(r);
    } catch (err) {
      toast({
        title: "Could not start linking",
        description: (err as Error).message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  }

  async function unlink() {
    if (!confirm("Disconnect Telegram alerts? You can re-link any time.")) return;
    setWorking(true);
    try {
      await authFetch("/api/telegram/link", { method: "DELETE" });
      toast({ title: "Telegram disconnected" });
      await refresh();
    } catch (err) {
      toast({
        title: "Unlink failed",
        description: (err as Error).message ?? "Try again.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  }

  async function toggleOptIn(next: boolean) {
    if (!status) return;
    // Optimistic update for snappy toggle feel.
    setStatus({ ...status, optIn: next });
    try {
      await authFetch("/api/telegram/opt-in", {
        method: "POST",
        body: JSON.stringify({ optIn: next }),
      });
      toast({ title: next ? "Telegram alerts enabled" : "Telegram alerts muted" });
    } catch (err) {
      // Revert on failure.
      setStatus({ ...status, optIn: !next });
      toast({
        title: "Could not update preference",
        description: (err as Error).message ?? "Try again.",
        variant: "destructive",
      });
    }
  }

  // Smart Telegram open: try the native `tg://` scheme first (instant in-app
  // jump if Telegram is installed). After a short timeout, fall back to the
  // universal https://t.me link which opens the browser → Telegram handoff.
  // Same-window navigation lets iOS/Android Universal Links engage cleanly.
  function openTelegram() {
    if (!linkData) return;
    const fellBack = { current: false };
    const fallback = window.setTimeout(() => {
      fellBack.current = true;
      window.location.href = linkData.httpsUrl;
    }, 900);
    // If the page becomes hidden, the tg:// scheme worked — cancel fallback.
    const onHide = () => {
      if (document.hidden) {
        window.clearTimeout(fallback);
        document.removeEventListener("visibilitychange", onHide);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    try {
      window.location.href = linkData.tgUrl;
    } catch {
      if (!fellBack.current) {
        window.clearTimeout(fallback);
        window.location.href = linkData.httpsUrl;
      }
    }
  }

  async function copyCode() {
    if (!linkData) return;
    try {
      await navigator.clipboard.writeText(linkData.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed — long-press the code to copy", variant: "destructive" });
    }
  }

  // ── Hidden if the server isn't configured (no bot token) ───────────────────
  if (!loading && status && !status.configured) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
          <Send style={{ width: 15, height: 15 }} />
        </div>
        <h3 className="font-semibold">Telegram Alerts</h3>
      </div>

      {loading ? (
        <div className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
      ) : status?.linked ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex-1 min-w-0 pr-3">
              <div className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 style={{ width: 14, height: 14 }} className="text-emerald-400" />
                Connected{status.username ? ` as @${status.username}` : ""}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Deposits, withdrawals, milestones and promo updates will arrive on Telegram.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex-1 min-w-0 pr-3">
              <div className="text-sm font-medium">Receive alerts</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Mute without unlinking — toggle back on whenever you want.
              </div>
            </div>
            <button
              onClick={() => toggleOptIn(!status.optIn)}
              role="switch"
              aria-checked={status.optIn}
              className={`relative w-12 h-7 rounded-full transition-colors duration-200 shrink-0 ${
                status.optIn ? "bg-sky-500" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                  status.optIn ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <button
            onClick={unlink}
            disabled={working}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-sm font-medium transition-all disabled:opacity-50"
          >
            <Unlink style={{ width: 14, height: 14 }} />
            Disconnect Telegram
          </button>
        </div>
      ) : linkData ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Tap below — Telegram will open straight to the bot. Hit <span className="font-semibold text-white">START</span> once and you're linked. This page refreshes automatically.
          </p>

          <button
            onClick={openTelegram}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-all"
          >
            <ExternalLink style={{ width: 15, height: 15 }} />
            Open Telegram & link
          </button>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
              Manual code (if the button doesn't open Telegram)
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-base tracking-[0.25em] font-bold text-white bg-black/40 rounded-lg px-3 py-2 text-center">
                {linkData.code}
              </code>
              <button
                onClick={copyCode}
                className="p-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] transition-all"
                title="Copy code"
              >
                {codeCopied ? (
                  <CheckCircle2 style={{ width: 14, height: 14 }} className="text-emerald-400" />
                ) : (
                  <Copy style={{ width: 14, height: 14 }} />
                )}
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Open the bot in Telegram and send <code className="font-mono">/start {linkData.code}</code>. Code expires in 15 minutes.
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
            Waiting for confirmation…
          </div>

          <button
            onClick={() => setLinkData(null)}
            className="w-full text-xs text-muted-foreground hover:text-white py-1 transition"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Get instant alerts on Telegram for deposits, withdrawals, promo bonuses, milestones and important account events. No phone number needed — just one tap to link.
          </p>
          <button
            onClick={startLink}
            disabled={working}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 font-semibold text-sm transition-all disabled:opacity-50"
          >
            {working ? (
              <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
            ) : (
              <Send style={{ width: 15, height: 15 }} />
            )}
            Link Telegram
          </button>
        </div>
      )}
    </div>
  );
}
