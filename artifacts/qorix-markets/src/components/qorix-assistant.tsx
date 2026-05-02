import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ChevronRight, MessageCircle, Headphones, UserCheck, CheckCheck, SquareX, RotateCcw, MessageSquarePlus, TrendingUp, Languages, Mail, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { authFetch } from "@/lib/auth-fetch";
import { getOrCreateVisitorId } from "@/lib/visitor-id";

// Lead-capture trigger: show the email form after this many user-typed
// messages in guest mode. 3 turns is enough that the visitor is engaged
// (not a one-bounce passerby) but early enough that we still catch them
// before they drift off the page.
const GUEST_LEAD_TRIGGER_TURNS = 3;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  type: "user" | "bot" | "admin";
  content: string;
  timestamp: Date;
  options?: QuickOption[];
  showInsights?: boolean;
  cta?: CtaCard | null;
}

interface CtaCard {
  variant: string;       // "small_deposit" | "view_dashboard" | "talk_to_expert"
  label: string;
  href?: string;
  action?: string;       // "request_expert"
  ackText?: string;      // language-aware "let me take you there" reply shown before navigation
}

interface QuickOption {
  label: string;
  value: string;
  icon?: string;
}

type FlowKey = "main" | "how_to_start" | "investment_guide" | "returns" | "risk" | "expert_requested";

// Language pill choices. `null` means the user has not picked one — the LLM
// then mirrors whatever language the user types in (legacy behaviour).
type LanguageChoice = "en" | "hi" | "hinglish" | null;

const LANGUAGE_OPTIONS: { value: Exclude<LanguageChoice, null>; short: string; label: string }[] = [
  { value: "en", short: "EN", label: "English" },
  { value: "hi", short: "हि", label: "हिंदी" },
  { value: "hinglish", short: "Hi-EN", label: "Hinglish" },
];

function languageShortLabel(lang: LanguageChoice): string {
  if (!lang) return "Auto";
  return LANGUAGE_OPTIONS.find((o) => o.value === lang)?.short ?? "Auto";
}

// ─── Bot Flow Definitions ─────────────────────────────────────────────────────

const FLOWS: Record<FlowKey, { message: string; options?: QuickOption[] }> = {
  main: {
    message: "Hello! I'm **Qorix Assistant** 👋\n\nWelcome to **Qorix Markets** — where everyday investors access the same professional trading infrastructure used by institutional desks.\n\n📊 Our platform delivers consistent monthly returns through three active trading strategies, with built-in capital protection and a live investor dashboard.\n\n💡 Simple to join, transparent to monitor, and professionally managed 24/7.\n\nWhat would you like to explore?",
    options: [
      { label: "🚀 How to Start", value: "how_to_start" },
      { label: "📊 Investment Guide", value: "investment_guide" },
      { label: "💹 Returns Explained", value: "returns" },
      { label: "🛡️ Capital Protection", value: "risk" },
      { label: "💬 Talk to Expert", value: "expert" },
    ],
  },
  how_to_start: {
    message: "**Getting started on Qorix Markets is simple:**\n\n1️⃣ **Create Your Account** — Sign up with your email in under 2 minutes.\n\n2️⃣ **Fund Your Wallet** — Add USD securely to your investor wallet. Check the Wallet section for minimum deposit details.\n\n3️⃣ **Activate Investing** — Head to the *Invest* tab and activate your profile in one click.\n\n4️⃣ **Choose Your Tier** — Pick Conservative, Balanced, or Growth based on your goals. Your drawdown ceiling is locked in before any capital moves.\n\n5️⃣ **Earn While You Sleep** — Our professional trading desk operates 24/7. You receive daily performance updates and monthly profit payouts automatically.\n\n🎯 *Most investors are fully set up and earning in under 10 minutes.*",
    options: [
      { label: "🚀 Start Investing", value: "start_investing" },
      { label: "📊 Investment Guide", value: "investment_guide" },
      { label: "💹 Returns Explained", value: "returns" },
      { label: "💬 Talk to Expert", value: "expert" },
    ],
  },
  investment_guide: {
    message: "**Qorix Investment Guide**\n\n📌 **Professional Trading Desk:**\nYour funds are deployed across three active strategies — scalping, swing, and arbitrage — executed 24/7 by our 43-strong professional desk.\n\n📌 **Strong Monthly Performance:**\n• 🟢 **Conservative** → ~1.5% – 5% monthly\n• 🟡 **Balanced** → ~3% – 8% monthly\n• 🔴 **Growth** → ~5% – 10%+ monthly\n\n📌 **Auto-Compounding:**\nReinvest your returns automatically to accelerate growth over time — activated in one click.\n\n📌 **Monthly Payouts:**\nProfits flow into your dedicated profit wallet every month, available to withdraw on your own schedule — anytime.",
    options: [
      { label: "🚀 Start Investing", value: "start_investing" },
      { label: "💹 Returns Explained", value: "returns" },
      { label: "🛡️ Capital Protection", value: "risk" },
      { label: "💬 Talk to Expert", value: "expert" },
    ],
  },
  returns: {
    message: "**Returns at Qorix Markets**\n\n💹 **Consistent Monthly Performance:**\nQorixMarkets has delivered positive returns across 10 consecutive months through disciplined desk execution and active profit management.\n\n📈 **Typical Monthly Return Ranges:**\n• 🟢 **Conservative** → ~1.5% – 5% monthly\n• 🟡 **Balanced** → ~3% – 8% monthly\n• 🔴 **Growth** → ~5% – 10%+ monthly\n\nPeak periods have seen strong double-digit performance under Growth settings when market conditions aligned with our desk strategies.\n\n📊 **Full Profit Transparency:**\n• Daily profit updates in your Dashboard\n• Real-time equity tracking in Analytics\n• Monthly performance reports\n• Complete payout and withdrawal history",
    options: [
      { label: "🚀 Start Investing", value: "start_investing" },
      { label: "🛡️ Capital Protection", value: "risk" },
      { label: "📊 Investment Guide", value: "investment_guide" },
      { label: "💬 Talk to Expert", value: "expert" },
    ],
  },
  risk: {
    message: "**Your Capital Protection System**\n\n🛡️ **Protection-First Architecture:**\nEvery investment begins with a defined drawdown ceiling — locked before a single dollar is traded.\n\n✅ **Three protection tiers to match your goals:**\n• 🟢 **Conservative (3% ceiling)** — stable, low-volatility growth\n• 🟡 **Balanced (5% ceiling)** — optimised returns with controlled exposure\n• 🔴 **Growth (10% ceiling)** — maximum performance potential\n\n🔒 **How it works:**\n• Real-time equity monitoring on all active positions\n• Auto-pause triggers if your ceiling is approached\n• Profits held in a dedicated wallet — separate from trading capital\n• 24/7 desk oversight by our professional risk team\n\n🏦 **Platform Security:**\nFunds held in segregated wallets. End-to-end encryption, multi-factor authentication, and regular security audits.",
    options: [
      { label: "🚀 Start Investing", value: "start_investing" },
      { label: "📊 Investment Guide", value: "investment_guide" },
      { label: "💹 Returns Explained", value: "returns" },
      { label: "💬 Talk to Expert", value: "expert" },
    ],
  },
  expert_requested: {
    message: "✅ **You're now connected to our expert team.**\n\nAn advisor will review your query and respond shortly. Feel free to type your question below.\n\n🕐 **Support Hours:** 9 AM – 6 PM (Mon–Sat)\n\nWe typically respond within a few minutes during business hours.",
    options: [],
  },
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiPost(path: string, body: object) {
  return authFetch(`/api${path}`, { method: "POST", body: JSON.stringify(body) });
}

async function apiGet(path: string) {
  return authFetch(`/api${path}`);
}

// Guest variants. Identical wire format but every call carries the
// `x-visitor-id` header — that's how the API server scopes the
// unauthenticated session to *this* browser. authFetch picks up the
// custom header from `init.headers` and merges it with its own (CSRF,
// device-id), so all the protections that apply to authed endpoints also
// apply here.
async function guestPost(path: string, body: object) {
  return authFetch(`/api${path}`, {
    method: "POST",
    headers: { "x-visitor-id": getOrCreateVisitorId() },
    body: JSON.stringify(body),
  });
}

async function guestGet(path: string) {
  return authFetch(`/api${path}`, {
    headers: { "x-visitor-id": getOrCreateVisitorId() },
  });
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
        <Headphones className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-[#1a1f2e] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-blue-400"
              animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Live Insights Card ───────────────────────────────────────────────────────

const LIVE_INVESTORS = [412, 438, 455, 467, 489, 501, 524];
const LIVE_STRATEGIES = [7, 8, 9];

function LiveInsightsCard() {
  const [investors] = useState(() => LIVE_INVESTORS[Math.floor(Math.random() * LIVE_INVESTORS.length)]);
  const [strategies] = useState(() => LIVE_STRATEGIES[Math.floor(Math.random() * LIVE_STRATEGIES.length)]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.3 }}
      className="mb-3 ml-9"
    >
      <div
        className="rounded-xl px-3.5 py-2.5 text-xs"
        style={{
          background: "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(124,58,237,0.08) 100%)",
          border: "1px solid rgba(99,102,241,0.15)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Live Platform Insights</span>
        </div>
        <div className="flex gap-4">
          <div>
            <p className="text-white font-bold">{investors.toLocaleString()}</p>
            <p className="text-white/40 text-[10px]">Active Investors</p>
          </div>
          <div>
            <p className="text-white font-bold">{strategies}</p>
            <p className="text-white/40 text-[10px]">Strategies Running</p>
          </div>
          <div>
            <p className="text-emerald-400 font-bold">Live</p>
            <p className="text-white/40 text-[10px]">Updated Daily</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── CTA Card (LLM-driven persuasive next step) ──────────────────────────────

function ctaIconForVariant(variant: string) {
  if (variant === "view_dashboard") return <TrendingUp className="w-4 h-4" />;
  if (variant === "talk_to_expert") return <UserCheck className="w-4 h-4" />;
  return <ChevronRight className="w-4 h-4" />;
}

function CtaCardButton({ cta, onClick }: { cta: CtaCard; onClick: (cta: CtaCard) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.25 }}
      className="ml-9 mb-3"
    >
      <motion.button
        onClick={() => onClick(cta)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full max-w-[260px] flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(37,99,235,0.18) 0%, rgba(124,58,237,0.18) 100%)",
          border: "1px solid rgba(99,102,241,0.35)",
          color: "rgb(199,210,254)",
          boxShadow: "0 4px 14px rgba(99,102,241,0.18)",
        }}
        data-cta-variant={cta.variant}
      >
        <span className="flex items-center gap-2">
          {ctaIconForVariant(cta.variant)}
          <span>{cta.label}</span>
        </span>
        <ChevronRight className="w-4 h-4 opacity-60" />
      </motion.button>
    </motion.div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

// XSS hardening: bot replies originate from the LLM and the LLM's input is
// (transitively) attacker-controlled (the user types whatever they want).
// We escape every HTML-significant character FIRST, then run the small
// markdown substitution set against the escaped string — so any raw HTML
// the model is coerced into emitting becomes inert text, while our own
// `<strong>`, `<em>`, and `<br />` tags remain the only live HTML.
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.type === "user";
  const isAdmin = msg.type === "admin";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="flex justify-end mb-3"
      >
        <div className="max-w-[75%]">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-lg shadow-blue-500/20">
            <p className="text-sm leading-relaxed">{msg.content}</p>
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-[10px] text-white/30 flex items-center gap-1">
              <CheckCheck className="w-3 h-3" />
              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-end gap-2 mb-3"
    >
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg",
        isAdmin
          ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20"
          : "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20"
      )}>
        {isAdmin ? <UserCheck className="w-3.5 h-3.5 text-white" /> : <Headphones className="w-3.5 h-3.5 text-white" />}
      </div>
      <div className="max-w-[80%]">
        {isAdmin && (
          <p className="text-[10px] text-emerald-400 font-medium mb-1 ml-1">Qorix Expert</p>
        )}
        <div className="bg-[#1a1f2e] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-2.5">
          <p
            className="text-sm text-white/90 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
          />
        </div>
        <span className="text-[10px] text-white/30 mt-1 ml-1 block">
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Nudge Messages ───────────────────────────────────────────────────────────

const NUDGE_MESSAGES = [
  "👋 Hi! I'm Qorix Assistant — ask me anything about investing!",
  "💹 Want to know your potential earnings? I can show you in seconds!",
  "🚀 Ready to grow your money? I'll guide you step by step.",
  "🛡️ Wondering if your funds are safe? Let's talk about our protection system.",
  "💰 Our investors earned up to 10% last month. Want to know how?",
  "⏰ New month, new profits — don't miss the next payout cycle!",
  "🌍 Thousands of investors are earning daily on Qorix Markets. Join them!",
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function QorixAssistant({ guestMode = false }: { guestMode?: boolean } = {}) {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [expertMode, setExpertMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeIndex, setNudgeIndex] = useState(0);
  // Header language pill state. `null` = no explicit choice (LLM mirrors
  // whatever the user typed in). When set, persisted to the session row so
  // the LLM and CTA acknowledgements both honour it.
  const [language, setLanguage] = useState<LanguageChoice>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  // ── Guest lead-capture state (Batch D). Triggered after the visitor has
  // sent ≥ GUEST_LEAD_TRIGGER_TURNS messages without having signed up. The
  // form lives inline above the message input so it's not a hard modal that
  // breaks reading flow. Once submitted (or skipped) we never show it again
  // for this session.
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadDismissed, setLeadDismissed] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  // Nudge bubble: show every 15s when chat is closed
  // Use a ref so the recursive setTimeout always calls the latest version
  const scheduleNudgeRef = useRef<() => void>(() => {});

  scheduleNudgeRef.current = () => {
    // Nudge bubble disabled — was distracting users.
    // Chat button stays visible; users open it when they want.
  };

  const scheduleNudge = useCallback(() => scheduleNudgeRef.current(), []);

  useEffect(() => {
    scheduleNudge();
    return () => {
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
      if (nudgeHideTimerRef.current) clearTimeout(nudgeHideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShowNudge(false);
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
      if (nudgeHideTimerRef.current) clearTimeout(nudgeHideTimerRef.current);
    } else {
      scheduleNudge();
    }
  }, [isOpen]);

  const dismissNudge = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowNudge(false);
    if (nudgeHideTimerRef.current) clearTimeout(nudgeHideTimerRef.current);
    scheduleNudge();
  };

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 300);
      if (guestMode && !sessionId) {
        // Server-backed guest session — visitor's chat survives reload and
        // shows up in /admin/chats. initGuestSession() also rehydrates any
        // prior history from a previous tab/session (Resume policy). The
        // welcome bubble is only shown for *brand-new* sessions.
        initGuestSession();
      } else if (!sessionId && token) {
        initSession();
      }
    }
  }, [isOpen, token, guestMode]);

  // Poll for admin replies in expert mode
  useEffect(() => {
    if (expertMode && sessionId && isOpen) {
      const timer = setInterval(() => pollMessages(), 5000);
      setPollTimer(timer);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [expertMode, sessionId, isOpen]);

  // Guest counterpart of initSession() — same resume policy, but every call
  // is keyed on the visitor's localStorage UUID instead of a JWT.
  async function initGuestSession() {
    try {
      const { session } = await guestPost("/chat/guest-session", {
        visitorId: getOrCreateVisitorId(),
      });
      setSessionId(session.id);
      if (session.preferredLanguage) {
        setLanguage(session.preferredLanguage as LanguageChoice);
      } else {
        setLanguage(null);
      }
      const { messages: existing } = await guestGet(
        `/chat/guest-session/${session.id}/messages`,
      );
      if (Array.isArray(existing) && existing.length > 0) {
        setMessages(existing.map((m: any) => ({
          id: String(m.id),
          type: m.senderType as "user" | "bot" | "admin",
          content: m.content,
          timestamp: new Date(m.createdAt),
        })));
        return;
      }
      // Fresh session — show the canned welcome and DO persist the bot
      // message server-side so the admin panel sees the same opening
      // line that the visitor saw.
      showBotMessage(FLOWS.main.message, FLOWS.main.options);
      void guestPost("/chat/guest-bot-message", {
        sessionId: session.id,
        content: FLOWS.main.message,
        visitorId: getOrCreateVisitorId(),
      }).catch(() => {});
    } catch {
      // Network down / API misconfigured — degrade to a purely client-side
      // welcome so the visitor still sees a chat experience.
      showBotMessage(FLOWS.main.message, FLOWS.main.options);
    }
  }

  async function initSession() {
    if (!token) return;
    try {
      const { session } = await apiPost("/chat/session", {});
      setSessionId(session.id);
      if (session.status === "expert_requested") setExpertMode(true);
      // Hydrate the language pill from whatever the server has on the
      // session row — preserves the user's previous choice across visits.
      if (session.preferredLanguage) {
        setLanguage(session.preferredLanguage as LanguageChoice);
      } else {
        setLanguage(null);
      }

      // Resume policy (Task 104): if the resumed session already has
      // messages, load them all instead of dumping the user back at the
      // welcome screen. Only sessions with zero history get the welcome
      // bubble — that covers brand-new sessions and the ambient "I just
      // signed up" first-time case.
      const { messages: existing } = await apiGet(`/chat/session/${session.id}/messages`);
      if (existing.length > 0) {
        setMessages(existing.map((m: any) => ({
          id: String(m.id),
          type: m.senderType as "user" | "bot" | "admin",
          content: m.content,
          timestamp: new Date(m.createdAt),
        })));
        return;
      }
      showBotMessage(FLOWS.main.message, FLOWS.main.options);
    } catch (err) {
      // Ignore
    }
  }

  async function persistLanguage(next: LanguageChoice) {
    setLanguage(next);
    setShowLangMenu(false);
    if (!sessionId) return;
    try {
      if (guestMode) {
        await guestPost(`/chat/guest-session/${sessionId}/language`, {
          language: next,
          visitorId: getOrCreateVisitorId(),
        });
      } else if (token) {
        await apiPost(`/chat/session/${sessionId}/language`, { language: next });
      }
    } catch {
      // Non-fatal: the LLM falls back to mirror mode if persistence fails.
    }
  }

  async function pollMessages() {
    if (!sessionId) return;
    try {
      const { messages: serverMessages } = await apiGet(`/chat/session/${sessionId}/messages`);
      const newMessages: Message[] = serverMessages.map((m: any) => ({
        id: String(m.id),
        type: m.senderType as "user" | "bot" | "admin",
        content: m.content,
        timestamp: new Date(m.createdAt),
      }));

      setMessages(prev => {
        const prevIds = new Set(prev.map(m => m.id));
        const incoming = newMessages.filter(m => !prevIds.has(m.id) && m.type === "admin");
        if (incoming.length > 0 && !isOpen) setHasUnread(true);
        return newMessages;
      });
    } catch { }
  }

  function showBotMessage(content: string, options?: QuickOption[], showInsights = false) {
    setIsTyping(true);
    const delay = Math.min(600 + content.length * 8, 1800);
    setTimeout(() => {
      setIsTyping(false);
      const msg: Message = {
        id: `bot-${Date.now()}`,
        type: "bot",
        content,
        timestamp: new Date(),
        options,
        showInsights,
      };
      setMessages(prev => [...prev, msg]);
    }, delay);
  }

  async function handleOptionClick(value: string) {
    if (value === "main_menu") {
      addUserMessage("Back to menu");
      await saveUserMessage("Back to menu");
      showBotMessage(FLOWS.main.message, FLOWS.main.options);
      saveBotMessage(FLOWS.main.message);
      return;
    }

    if (value === "start_investing") {
      addUserMessage("Start Investing");
      await saveUserMessage("Start Investing");
      const msg = guestMode
        ? "Great! To get started, you'll need to create a free account or sign in. 🚀\n\nIt only takes 2 minutes — then you can activate your investment profile and begin earning."
        : "Great! Let me take you to the investment dashboard. 🚀\n\nFrom there you can activate your investment profile, choose your risk level, and begin your journey with Qorix Markets.";
      showBotMessage(msg, guestMode ? [{ label: "🔐 Sign In / Register", value: "go_login" }] : []);
      saveBotMessage(msg);
      if (!guestMode) {
        setTimeout(() => {
          setIsOpen(false);
          navigate("/invest");
        }, 1800);
      }
      return;
    }

    if (value === "go_login") {
      addUserMessage("Sign In / Register");
      setTimeout(() => {
        setIsOpen(false);
        navigate("/login");
      }, 400);
      return;
    }

    if (value === "expert") {
      if (guestMode) {
        addUserMessage("Talk to Expert");
        showBotMessage("To connect with our expert team, please create a free account first. Our advisors are standing by! 💬\n\nSign up takes under 2 minutes.", [{ label: "🔐 Sign In / Register", value: "go_login" }, { label: "🏠 Back to Menu", value: "main_menu" }]);
        return;
      }
      addUserMessage("Talk to Expert");
      await saveUserMessage("Talk to Expert");
      await handleExpertRequest();
      return;
    }

    const flow = FLOWS[value as FlowKey];
    if (!flow) return;

    const INSIGHTS_FLOWS = ["how_to_start", "investment_guide", "returns", "risk"];
    const showInsights = INSIGHTS_FLOWS.includes(value);

    const label = FLOWS.main.options?.find(o => o.value === value)?.label || value;
    addUserMessage(label);
    await saveUserMessage(label);
    showBotMessage(flow.message, flow.options, showInsights);
    saveBotMessage(flow.message);
  }

  function addUserMessage(content: string) {
    const msg: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);
  }

  async function saveUserMessage(content: string) {
    if (!sessionId) return;
    try {
      if (guestMode) {
        await guestPost("/chat/guest-message", {
          sessionId,
          content,
          visitorId: getOrCreateVisitorId(),
        });
      } else if (token) {
        await apiPost("/chat/message", { sessionId, content });
      }
    } catch { }
  }

  async function saveBotMessage(content: string) {
    if (!sessionId) return;
    try {
      if (guestMode) {
        await guestPost("/chat/guest-bot-message", {
          sessionId,
          content,
          visitorId: getOrCreateVisitorId(),
        });
      } else if (token) {
        await apiPost("/chat/bot-message", { sessionId, content });
      }
    } catch { }
  }

  async function handleExpertRequest() {
    if (!sessionId || !token) return;
    try {
      await apiPost("/chat/expert", { sessionId });
      setExpertMode(true);
      showBotMessage(FLOWS.expert_requested.message, []);
    } catch {
      showBotMessage("Unable to connect right now. Please try again in a moment.", []);
    }
  }

  async function handleEndChat() {
    setShowEndConfirm(false);
    if (sessionId) {
      try {
        if (guestMode) {
          await guestPost(`/chat/guest-session/${sessionId}/end`, {
            visitorId: getOrCreateVisitorId(),
          });
        } else if (token) {
          await apiPost(`/chat/session/${sessionId}/end`, {});
        }
      } catch { }
    }
    setChatEnded(true);
    setExpertMode(false);
  }

  function handleStartNewChat() {
    setMessages([]);
    setSessionId(null);
    setChatEnded(false);
    setExpertMode(false);
    setInputText("");
    setShowEndConfirm(false);
    // Drop the in-memory language pill back to "Auto" so the new session
    // starts cleanly. initSession() will rehydrate from the new server-side
    // session row (which starts with preferredLanguage = null).
    setLanguage(null);
    setShowLangMenu(false);
    // Reset the lead-capture surface too — a brand-new conversation should
    // get a fresh chance at capturing the visitor's email if they engage.
    // `leadCaptured` is intentionally NOT reset: once we have the address
    // we don't ask a second time in the same browser.
    setShowLeadForm(false);
    setLeadDismissed(false);
    setLeadEmail("");
    setLeadName("");
    setLeadError(null);
    if (guestMode) {
      setTimeout(() => initGuestSession(), 100);
    } else if (token) {
      setTimeout(() => initSession(), 100);
    }
  }

  async function handleLeadSubmit() {
    if (leadSubmitting) return;
    const email = leadEmail.trim();
    const name = leadName.trim();
    // Cheap client-side validation. The API also validates with zod, but a
    // local check stops the obvious typos from causing a network round-trip.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLeadError("Please enter a valid email address.");
      return;
    }
    if (!sessionId) {
      setLeadError("Hold on a second — still connecting.");
      return;
    }
    setLeadSubmitting(true);
    setLeadError(null);
    try {
      await guestPost("/chat/guest-lead", {
        sessionId,
        email,
        name: name || undefined,
        visitorId: getOrCreateVisitorId(),
      });
      setLeadCaptured(true);
      setShowLeadForm(false);
      // Drop a confirmation bubble into the chat so the visitor sees a
      // tangible response to handing over their address — feels like a
      // human acknowledgement rather than a silent form submit.
      showBotMessage(
        name
          ? `Thanks ${name}! I've got your details. Whenever you're ready, sign up and I'll have full context — wallet, KYC, the works.`
          : "Got it — thanks! Whenever you're ready, sign up and I'll have full context to help you start.",
        [
          { label: "🔐 Sign Up Now", value: "go_login" },
          { label: "🏠 Keep Browsing", value: "main_menu" },
        ],
      );
    } catch (err: any) {
      const msg = typeof err?.message === "string" && err.message.length < 200 ? err.message : null;
      setLeadError(msg ?? "Couldn't save your details. Please try again.");
    } finally {
      setLeadSubmitting(false);
    }
  }

  function handleLeadDismiss() {
    setShowLeadForm(false);
    setLeadDismissed(true);
    setLeadError(null);
  }

  async function handleSendMessage() {
    const content = inputText.trim();
    if (!content || isSending) return;

    setInputText("");
    addUserMessage(content);
    setIsSending(true);

    try {
      // ── Guest mode: route through the dedicated guest LLM endpoint.
      // Server-side it talks to the same model as the authed path but with a
      // tighter system prompt (no wallet/KYC context, focused on landing-page
      // questions) and rate-limited per visitor-id. After the visitor has
      // typed `GUEST_LEAD_TRIGGER_TURNS` messages we surface the email form
      // so we can follow up by email if they bounce off the page.
      if (guestMode) {
        if (!sessionId) {
          // Session creation lost a race — kick it off and skip this turn.
          // The text the user typed is preserved in `content` and they can
          // re-send. In practice this only fires if they type before the
          // initial fetch settles (sub-second window).
          await initGuestSession();
          showBotMessage(
            "Sorry, just getting set up — please try sending that again.",
          );
          return;
        }

        setIsTyping(true);
        try {
          const data = await guestPost("/chat/guest-llm-reply", {
            sessionId,
            content,
            visitorId: getOrCreateVisitorId(),
          });
          setIsTyping(false);
          if (data?.reply?.content) {
            if (Array.isArray(data.quickOptions) && data.quickOptions.length) {
              showBotMessage(data.reply.content, data.quickOptions);
            } else {
              const botMsg: Message = {
                id: `bot-${data.reply.id ?? Date.now()}`,
                type: "bot",
                content: data.reply.content,
                timestamp: new Date(data.reply.createdAt ?? Date.now()),
                cta: data.cta ?? null,
              };
              setMessages((prev) => [...prev, botMsg]);
            }
          }
        } catch (err: any) {
          setIsTyping(false);
          const msg = typeof err?.message === "string" && err.message.length < 240 ? err.message : null;
          showBotMessage(
            msg ??
              "I'm having trouble responding right now. You can try again, or sign up to keep chatting with full context.",
            [
              { label: "🔐 Sign In / Register", value: "go_login" },
              { label: "🏠 Back to Menu", value: "main_menu" },
            ],
          );
        }

        // Lead capture trigger. Counts the user message we *just* added to
        // local state — `messages` snapshot here predates the addUserMessage
        // call, so we add 1 to bring it level with the actually-rendered
        // count. We only show the form once per session; once dismissed or
        // submitted we never bring it back.
        const userTurnsAfter = messages.filter((m) => m.type === "user").length + 1;
        if (
          !leadCaptured &&
          !leadDismissed &&
          !showLeadForm &&
          userTurnsAfter >= GUEST_LEAD_TRIGGER_TURNS
        ) {
          setShowLeadForm(true);
        }

        return;
      }

      if (!sessionId || !token) {
        await saveUserMessage(content);
        setTimeout(() => {
          showBotMessage(
            "I understand your query! Please pick an option below or talk to our expert team.",
            [
              { label: "🚀 How to Start", value: "how_to_start" },
              { label: "💬 Talk to Expert", value: "expert" },
            ],
          );
        }, 300);
        return;
      }

      // ── Expert mode: humans handle the conversation. The LLM endpoint
      // server-side detects this and only persists the user message
      // without generating a reply — but we still call it so the
      // message lands on the admin panel via the same code path.
      //
      // We briefly flash the typing indicator so the user gets the same
      // "your message was received and someone's reading it" feedback
      // they get on the LLM path. Without this the message just sits
      // there with no acknowledgement and the chat feels broken.
      // 1.8s matches the natural rhythm of "person opens chat, glances at
      // message" — long enough to read as a real beat, short enough that
      // it doesn't pretend an instant human reply is coming.
      if (expertMode) {
        setIsTyping(true);
        try {
          await saveUserMessage(content);
        } finally {
          setTimeout(() => setIsTyping(false), 1800);
        }
        return;
      }

      // ── LLM-driven reply.
      setIsTyping(true);
      try {
        const data = await apiPost("/chat/llm-reply", { sessionId, content });
        setIsTyping(false);

        if (data?.expertMode) {
          // Server flipped us into expert mode mid-stream — sync up.
          setExpertMode(true);
          return;
        }

        if (data?.reply?.content) {
          // When the server supplies `quickOptions` (LLM bypassed because of
          // budget/availability), render them as buttons via the same
          // showBotMessage path the rule-tree uses. This keeps the chat
          // navigable instead of degrading to a dead-end fallback string.
          if (Array.isArray(data.quickOptions) && data.quickOptions.length) {
            showBotMessage(data.reply.content, data.quickOptions);
          } else {
            const botMsg: Message = {
              id: `bot-${data.reply.id ?? Date.now()}`,
              type: "bot",
              content: data.reply.content,
              timestamp: new Date(data.reply.createdAt ?? Date.now()),
              cta: data.cta ?? null,
            };
            setMessages((prev) => [...prev, botMsg]);
          }
        }
      } catch (err: any) {
        setIsTyping(false);
        // Rate-limit messages and other 4xx errors come through `err.message`
        // (authFetch flattens the body's `error`/`message` field there). For
        // anything else we fall back to a gentle generic message — the user
        // should never see a stack trace.
        const msg = typeof err?.message === "string" && err.message.length < 240 ? err.message : null;
        showBotMessage(
          msg ??
            "I'm having trouble pulling that up right now. You can try again or tap **Talk to Expert** for a human advisor.",
          [
            { label: "🚀 How to Start", value: "how_to_start" },
            { label: "📊 Investment Plans", value: "investment_guide" },
            { label: "💬 Talk to Expert", value: "expert" },
            { label: "🏠 Back to Menu", value: "main_menu" },
          ],
        );
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleCtaClick(cta: CtaCard) {
    if (!sessionId || !token) return;
    // Fire-and-forget audit log; do NOT block the navigation on the network.
    apiPost("/chat/cta-click", { sessionId, variant: cta.variant }).catch(() => {});

    if (cta.action === "request_expert") {
      addUserMessage(cta.label);
      // Server-provided ackText keeps the bot's voice consistent across
      // languages; fall back to a sensible English line if the server didn't
      // ship one (older payloads).
      if (cta.ackText) {
        showBotMessage(cta.ackText);
      }
      await handleExpertRequest();
      return;
    }

    if (cta.href) {
      // Append attribution params so the deposit page (and dashboard) can
      // detect the chat-driven funnel and POST conversion events back.
      const url = new URL(cta.href, window.location.origin);
      url.searchParams.set("src", "chat");
      url.searchParams.set("sid", String(sessionId));

      // Echo the user's tap as a chat message so the conversation reads like
      // a real exchange ("I'll show you the dashboard" → user clicks → user
      // line "Show me the dashboard" → bot's warm acknowledgement → navigate).
      // This is the difference between feeling like a bot redirect and
      // feeling like a human concierge actually walking you over.
      addUserMessage(cta.label);
      const ack = cta.ackText
        ?? "On it — taking you there now. Ping me back here whenever you'd like to chat.";
      showBotMessage(ack);

      // Brief pause so the user actually reads the acknowledgement before
      // the page transitions. 900ms matches the "typing" rhythm elsewhere
      // in the chat — long enough to register, short enough to not feel slow.
      await new Promise((resolve) => setTimeout(resolve, 900));

      setIsOpen(false);
      navigate(url.pathname + url.search);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  // Get current quick options from last bot message.
  // UX rule: quick-reply buttons appear ONLY on the initial welcome state —
  // once the user has typed anything (or tapped a quick-reply), the chat is
  // a real conversation and the persistent button rail starts feeling like
  // a menu the bot keeps shoving back. After the very first user message we
  // suppress quick replies for the rest of the session.
  const hasUserMessage = messages.some(m => m.type === "user");
  const lastBotMessage = [...messages].reverse().find(m => m.type === "bot" && m.options && m.options.length > 0);
  const showOptions = !hasUserMessage && Boolean(lastBotMessage?.options && lastBotMessage.options.length > 0);

  if (!token && !guestMode) return null;

  return (
    <>
      {/* Nudge Bubble */}
      <AnimatePresence>
        {showNudge && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="fixed bottom-40 right-4 md:bottom-24 md:right-6 z-40 max-w-[260px] cursor-pointer"
            onClick={() => { setShowNudge(false); setIsOpen(true); }}
          >
            <div
              className="relative rounded-2xl rounded-br-sm px-4 py-3 shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #1a1f2e 0%, #0f1422 100%)",
                border: "1px solid rgba(99,102,241,0.25)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)",
              }}
            >
              {/* Close X */}
              <button
                onClick={dismissNudge}
                className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[#1e2436] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-2.5 h-2.5 text-white/60" />
              </button>

              {/* Pulse dot */}
              <div className="flex items-start gap-2.5">
                <div className="relative mt-0.5 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <motion.div
                    className="absolute inset-0 rounded-full bg-emerald-400"
                    animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                </div>
                <p className="text-sm text-white/90 leading-snug font-medium">
                  {NUDGE_MESSAGES[nudgeIndex]}
                </p>
              </div>

              {/* Tail */}
              <div
                className="absolute -bottom-2 right-5 w-3 h-3 rotate-45"
                style={{
                  background: "#0f1422",
                  border: "1px solid rgba(99,102,241,0.25)",
                  clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-2 md:bottom-6 md:right-6 z-40 w-10 h-10 md:w-14 md:h-14 rounded-full shadow-2xl",
          "bg-gradient-to-br from-blue-600 to-blue-700",
          "flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-transform",
          isOpen && "hidden"
        )}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, delay: 1 }}
        style={{ boxShadow: "0 0 30px rgba(99, 102, 241, 0.4)" }}
        aria-label="Open Qorix Assistant"
      >
        <MessageCircle className="w-6 h-6 text-white" />
        {hasUnread && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#0a0d14]"
          />
        )}
        {/* Pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-blue-500/40"
          animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-24px)] flex flex-col"
            style={{
              height: "min(600px, calc(100vh - 100px))",
              borderRadius: "20px",
              background: "linear-gradient(180deg, #0f1422 0%, #0a0d18 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(124,58,237,0.1) 100%)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "20px 20px 0 0",
              }}
            >
              {/* Bot Avatar */}
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Headphones className="w-4 h-4 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f1422]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-white">Qorix Assistant</p>
                  {expertMode && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-1.5 py-0.5 font-medium">
                      Expert Connected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/40">
                  {expertMode ? "Live support active" : "Customer support"}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Language pill — flips the LLM's reply language. The
                    selection is persisted on the session and respected
                    across visits. Hidden in guest mode (no session to
                    persist on) and once the chat has ended. */}
                {!chatEnded && !guestMode && (
                  <div className="relative">
                    <button
                      onClick={() => setShowLangMenu((v) => !v)}
                      title="Reply language"
                      className="h-7 px-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-1 transition-colors"
                      data-testid="chat-language-pill"
                    >
                      <Languages className="w-3 h-3 text-white/60" />
                      <span className="text-[10px] font-semibold text-white/80 leading-none">
                        {languageShortLabel(language)}
                      </span>
                    </button>
                    <AnimatePresence>
                      {showLangMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-9 w-44 z-20 rounded-xl overflow-hidden"
                          style={{
                            background: "#151b2d",
                            border: "1px solid rgba(99,102,241,0.25)",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                          }}
                        >
                          <div className="px-3 py-2 border-b border-white/[0.06]">
                            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Reply Language</p>
                          </div>
                          <button
                            onClick={() => persistLanguage(null)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors",
                              language === null
                                ? "bg-blue-500/15 text-blue-300"
                                : "text-white/70 hover:bg-white/5 hover:text-white",
                            )}
                          >
                            <span>Auto (mirror me)</span>
                            {language === null && <span className="text-[10px]">✓</span>}
                          </button>
                          {LANGUAGE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => persistLanguage(opt.value)}
                              className={cn(
                                "w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors",
                                language === opt.value
                                  ? "bg-blue-500/15 text-blue-300"
                                  : "text-white/70 hover:bg-white/5 hover:text-white",
                              )}
                              data-testid={`chat-language-option-${opt.value}`}
                            >
                              <span>{opt.label}</span>
                              {language === opt.value && <span className="text-[10px]">✓</span>}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* End Chat button — only if chat is active */}
                {!chatEnded && messages.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowEndConfirm(v => !v)}
                      title="End Chat"
                      className="w-7 h-7 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center transition-colors"
                    >
                      <SquareX className="w-3.5 h-3.5 text-red-400" />
                    </button>

                    {/* Confirmation popover */}
                    <AnimatePresence>
                      {showEndConfirm && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-9 w-48 z-10 rounded-xl overflow-hidden"
                          style={{
                            background: "#151b2d",
                            border: "1px solid rgba(239,68,68,0.2)",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                          }}
                        >
                          <div className="px-3.5 py-3">
                            <p className="text-xs font-semibold text-white mb-0.5">End this chat?</p>
                            <p className="text-[10px] text-white/40 leading-relaxed">You can start a new conversation anytime.</p>
                          </div>
                          <div className="flex border-t border-white/[0.06]">
                            <button
                              onClick={() => setShowEndConfirm(false)}
                              className="flex-1 py-2 text-[11px] text-white/50 hover:text-white hover:bg-white/5 transition-colors font-medium"
                            >
                              Cancel
                            </button>
                            <div className="w-px bg-white/[0.06]" />
                            <button
                              onClick={handleEndChat}
                              className="flex-1 py-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-semibold"
                            >
                              End Chat
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <button
                  onClick={() => { setIsOpen(false); setShowEndConfirm(false); }}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>
            </div>

            {/* Chat Ended Screen */}
            <AnimatePresence>
              {chatEnded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center px-6 gap-5"
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    <SquareX className="w-8 h-8 text-red-400" />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white mb-1">Chat Ended</p>
                    <p className="text-xs text-white/40 leading-relaxed">Your conversation has been closed. Start a new chat whenever you need help.</p>
                  </div>
                  <motion.button
                    onClick={handleStartNewChat}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                      boxShadow: "0 6px 20px rgba(99,102,241,0.3)",
                      color: "white",
                    }}
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                    Start New Chat
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            {!chatEnded && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0 scrollbar-thin">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <React.Fragment key={msg.id}>
                    <MessageBubble msg={msg} />
                    {msg.showInsights && <LiveInsightsCard />}
                    {msg.cta && <CtaCardButton cta={msg.cta} onClick={handleCtaClick} />}
                  </React.Fragment>
                ))}
              </AnimatePresence>

              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
            )}

            {/* Quick Replies */}
            <AnimatePresence>
              {!chatEnded && showOptions && !isTyping && !expertMode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="px-4 pb-3 flex flex-col gap-1.5 flex-shrink-0"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <p className="text-[10px] text-white/30 font-medium mt-2 mb-0.5 uppercase tracking-wider">Quick replies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lastBotMessage?.options?.map((opt) => (
                      <motion.button
                        key={opt.value}
                        onClick={() => handleOptionClick(opt.value)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        className={cn(
                          "text-xs px-3 py-1.5 rounded-xl font-medium transition-all duration-150",
                          opt.value === "expert"
                            ? "bg-gradient-to-r from-emerald-600/25 to-teal-600/25 border border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60 hover:bg-emerald-600/40"
                            : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20"
                        )}
                      >
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expert CTA (shown at bottom if not yet in expert mode) */}
            {!chatEnded && !expertMode && !showOptions && messages.length > 0 && !isTyping && (
              <div className="px-4 pb-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <motion.button
                  onClick={() => handleOptionClick("expert")}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-2.5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(37,99,235,0.2) 100%)",
                    border: "1px solid rgba(124,58,237,0.3)",
                    color: "rgb(167,139,250)",
                  }}
                >
                  <UserCheck className="w-4 h-4" />
                  Talk to Expert
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            )}

            {/* Lead capture form (guest mode only). Surfaced inline above
                the input rather than as a hard modal so it doesn't break the
                conversational flow — visitor can see the chat continuing
                behind it and feel free to dismiss. */}
            {!chatEnded && guestMode && showLeadForm && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="px-3 pt-3 pb-2 flex-shrink-0"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(124,58,237,0.12) 100%)",
                    border: "1px solid rgba(96,165,250,0.25)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-300" />
                      <p className="text-xs font-medium text-white/90">Stay in the loop</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLeadDismiss}
                      aria-label="Dismiss"
                      className="text-white/40 hover:text-white/70 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-white/60 mb-2.5 leading-snug">
                    Drop your email and we'll send a quick recap so you can pick up where you left off.
                  </p>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="Your name (optional)"
                      maxLength={80}
                      className="w-full rounded-md px-2.5 py-1.5 text-xs text-white/85 placeholder:text-white/30 outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="you@example.com"
                      maxLength={120}
                      className="w-full rounded-md px-2.5 py-1.5 text-xs text-white/85 placeholder:text-white/30 outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleLeadSubmit();
                        }
                      }}
                    />
                    {leadError && (
                      <p className="text-[11px] text-rose-300/90">{leadError}</p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="flex items-center gap-1 text-[10px] text-white/40">
                        <Shield className="w-3 h-3" />
                        We never share your email.
                      </p>
                      <motion.button
                        type="button"
                        onClick={handleLeadSubmit}
                        disabled={leadSubmitting || !leadEmail.trim()}
                        whileTap={{ scale: 0.96 }}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5",
                          leadEmail.trim() && !leadSubmitting
                            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/20"
                            : "bg-white/5 text-white/30 cursor-not-allowed",
                        )}
                      >
                        {leadSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {leadSubmitting ? "Saving…" : "Send recap"}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Input */}
            {!chatEnded && <div
              className="px-3 pb-3 pt-2 flex-shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <input
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={expertMode ? "Type your message to our expert…" : "Ask anything…"}
                  className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none"
                />
                <motion.button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isSending}
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                    inputText.trim()
                      ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
                      : "bg-white/5 text-white/20"
                  )}
                >
                  <Send className="w-3.5 h-3.5" />
                </motion.button>
              </div>
              <p className="text-center text-[9px] text-white/20 mt-1.5">Powered by Qorix Markets</p>
            </div>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
