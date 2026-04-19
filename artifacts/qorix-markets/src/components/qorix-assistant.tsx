import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ChevronRight, MessageCircle, Sparkles, UserCheck, ArrowLeft, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  type: "user" | "bot" | "admin";
  content: string;
  timestamp: Date;
  options?: QuickOption[];
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
    message: "Hello! I'm **Qorix Assistant** 👋\n\nI'm here to help you navigate the platform and understand how everything works. What would you like to know?",
    options: [
      { label: "🚀 How to Start", value: "how_to_start" },
      { label: "📊 Investment Guide", value: "investment_guide" },
      { label: "💹 Returns Explained", value: "returns" },
      { label: "⚠️ Risk Explained", value: "risk" },
      { label: "💬 Talk to Expert", value: "expert" },
    ],
  },
  how_to_start: {
    message: "**Getting started on Qorix Markets is simple:**\n\n1️⃣ **Register** — Create your account with email verification.\n\n2️⃣ **Deposit Funds** — Add USDT to your wallet via our secure deposit flow.\n\n3️⃣ **Activate Investing** — Go to the *Invest* section and activate your investment profile.\n\n4️⃣ **Choose Your Risk Level** — Select Low, Medium, or High based on your preference.\n\n5️⃣ **Sit Back** — Our algorithmic trading desk handles the rest. You'll receive daily performance updates.\n\n*Minimum deposit may apply. Check the Wallet section for current requirements.*",
    options: [
      { label: "📊 Investment Guide", value: "investment_guide" },
      { label: "💹 Returns Explained", value: "returns" },
      { label: "🏠 Back to Menu", value: "main_menu" },
    ],
  },
  investment_guide: {
    message: "**Qorix Investment Guide**\n\n📌 **How it works:**\nFunds in your trading balance are allocated to our quantitative strategies. Our algorithms analyze market conditions 24/7 to identify opportunities.\n\n📌 **Risk Levels:**\n• **Low** — Conservative strategies, lower drawdown limits\n• **Medium** — Balanced exposure across multiple strategies\n• **High** — Aggressive positioning for experienced investors\n\n📌 **Auto-Compounding:**\nOptionally enable auto-compounding to reinvest your performance returns automatically for compounded growth.\n\n📌 **Monthly Payouts:**\nProfits are distributed monthly to your profit balance, available for withdrawal anytime.\n\n*Performance depends on market conditions. Past results do not guarantee future returns.*",
    options: [
      { label: "💹 Returns Explained", value: "returns" },
      { label: "⚠️ Risk Explained", value: "risk" },
      { label: "🏠 Back to Menu", value: "main_menu" },
    ],
  },
  returns: {
    message: "**Understanding Returns on Qorix**\n\n💹 **Performance-Based Returns:**\nAll returns on Qorix are performance-based and depend on market conditions. We do not promise fixed or guaranteed returns.\n\n📈 **How returns are generated:**\nOur trading desk executes strategies across multiple asset classes. Daily profit runs calculate your proportional share of platform performance.\n\n📊 **Transparency:**\n• Real-time equity tracking in your Analytics section\n• Verified monthly performance reports\n• Full trade history visibility\n\n⚡ **Important:**\nReturns vary based on market volatility, your selected risk level, and overall platform performance. All figures shown are indicative of past performance only.",
    options: [
      { label: "⚠️ Risk Explained", value: "risk" },
      { label: "📊 Investment Guide", value: "investment_guide" },
      { label: "🏠 Back to Menu", value: "main_menu" },
    ],
  },
  risk: {
    message: "**Understanding Risk on Qorix**\n\n⚠️ **Market Risk:**\nAll investments carry inherent market risk. Asset prices fluctuate and your investment value may go up or down.\n\n🛡️ **Our Risk Management:**\n• Drawdown limits per risk level to cap losses\n• Diversified strategies across multiple instruments\n• Automated stop-loss mechanisms on trading positions\n• Real-time risk monitoring by our team\n\n📋 **Your Responsibility:**\nOnly invest capital you can afford to allocate for the medium term. Do not invest borrowed funds.\n\n🔐 **Platform Security:**\nFunds are held in segregated wallets. Our system uses multi-layer encryption and regular security audits.\n\n*Investing involves risk. Please make informed decisions based on your financial situation.*",
    options: [
      { label: "📊 Investment Guide", value: "investment_guide" },
      { label: "💹 Returns Explained", value: "returns" },
      { label: "💬 Talk to Expert", value: "expert" },
      { label: "🏠 Back to Menu", value: "main_menu" },
    ],
  },
  expert_requested: {
    message: "✅ **You're now connected to our expert team.**\n\nAn advisor will review your query and respond shortly.\n\n🕐 **Support Hours:** 9 AM – 6 PM (Mon–Sat)\n\nYou can type your message below and our team will reply here.",
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
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
        <Sparkles className="w-3.5 h-3.5 text-white" />
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
          : "bg-gradient-to-br from-blue-500 to-violet-600 shadow-blue-500/20"
      )}>
        {isAdmin ? <UserCheck className="w-3.5 h-3.5 text-white" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function QorixAssistant() {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [expertMode, setExpertMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 300);
      if (!sessionId && token) initSession();
    }
  }, [isOpen, token]);

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

  function showBotMessage(content: string, options?: QuickOption[]) {
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

    if (value === "expert") {
      addUserMessage("Talk to Expert");
      await saveUserMessage("Talk to Expert");
      await handleExpertRequest();
      return;
    }

    const flow = FLOWS[value as FlowKey];
    if (!flow) return;

    const label = FLOWS.main.options?.find(o => o.value === value)?.label || value;
    addUserMessage(label);
    await saveUserMessage(label);
    showBotMessage(flow.message, flow.options);
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

  if (!token) return null;

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl",
          "bg-gradient-to-br from-blue-600 to-violet-600",
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
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Sparkles className="w-4.5 h-4.5 text-white" />
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
                  {expertMode ? "Live support active" : "AI-powered financial guide"}
                </p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0 scrollbar-thin">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
              </AnimatePresence>

              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            <AnimatePresence>
              {showOptions && !isTyping && !expertMode && (
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
                            ? "bg-gradient-to-r from-violet-600/30 to-blue-600/30 border border-violet-500/30 text-violet-300 hover:border-violet-500/60 hover:bg-violet-600/40"
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
            {!expertMode && !showOptions && messages.length > 0 && !isTyping && (
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
            <div
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
                      ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/30"
                      : "bg-white/5 text-white/20"
                  )}
                >
                  <Send className="w-3.5 h-3.5" />
                </motion.button>
              </div>
              <p className="text-center text-[9px] text-white/20 mt-1.5">Powered by Qorix Markets</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
