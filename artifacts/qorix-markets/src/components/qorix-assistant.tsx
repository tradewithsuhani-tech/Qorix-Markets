import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ChevronRight, MessageCircle, Headphones, UserCheck, CheckCheck, SquareX, RotateCcw, MessageSquarePlus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  type: "user" | "bot" | "admin";
  content: string;
  timestamp: Date;
  options?: QuickOption[];
  showInsights?: boolean;
}

interface QuickOption {
  label: string;
  value: string;
  icon?: string;
}

type FlowKey = "main" | "how_to_start" | "investment_guide" | "returns" | "risk" | "expert_requested";

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

function getToken() {
  try { return localStorage.getItem("qorix_token"); } catch { return null; }
}

async function apiPost(path: string, body: object) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiGet(path: string) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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

// ─── Message Bubble ───────────────────────────────────────────────────────────

function parseMarkdown(text: string) {
  return text
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
      if (guestMode && messages.length === 0) {
        showBotMessage(FLOWS.main.message, FLOWS.main.options);
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
  }, [expertMode, sessionId, isOpen]);

  async function initSession() {
    if (!token) return;
    try {
      const { session } = await apiPost("/chat/session", {});
      setSessionId(session.id);
      if (session.status === "expert_requested") {
        setExpertMode(true);
        // Load existing messages
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
      }
      // Show welcome message
      showBotMessage(FLOWS.main.message, FLOWS.main.options);
    } catch (err) {
      // Ignore
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
    if (!sessionId || !token) return;
    try { await apiPost("/chat/message", { sessionId, content }); } catch { }
  }

  async function saveBotMessage(content: string) {
    if (!sessionId || !token) return;
    try { await apiPost("/chat/bot-message", { sessionId, content }); } catch { }
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
    if (sessionId && token) {
      try { await apiPost(`/chat/session/${sessionId}/end`, {}); } catch { }
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
    if (guestMode) {
      setTimeout(() => showBotMessage(FLOWS.main.message, FLOWS.main.options), 100);
    } else if (token) {
      setTimeout(() => initSession(), 100);
    }
  }

  async function handleSendMessage() {
    const content = inputText.trim();
    if (!content || isSending) return;

    setInputText("");
    addUserMessage(content);
    setIsSending(true);

    try {
      await saveUserMessage(content);
      if (!expertMode) {
        // Auto-reply for free-text in bot mode
        setTimeout(() => {
          showBotMessage(
            "I understand your query! For the best help, please select one of the options below, or connect with our expert team for personalized assistance.",
            [
              { label: "🚀 How to Start", value: "how_to_start" },
              { label: "📊 Investment Guide", value: "investment_guide" },
              { label: "💬 Talk to Expert", value: "expert" },
            ]
          );
        }, 300);
      }
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  // Get current quick options from last bot message
  const lastBotMessage = [...messages].reverse().find(m => m.type === "bot" && m.options && m.options.length > 0);
  const showOptions = lastBotMessage?.options && lastBotMessage.options.length > 0;

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
          "fixed bottom-28 right-3 md:bottom-6 md:right-6 z-40 w-11 h-11 md:w-14 md:h-14 rounded-full shadow-2xl",
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
