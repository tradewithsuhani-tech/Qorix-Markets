import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import {
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  X,
  ArrowUpFromLine,
  ArrowDownToLine,
  UserPlus,
  Zap,
  Flame,
  PartyPopper,
} from "lucide-react";

const NAMES = [
  "Rahul S.", "Priya M.", "Arjun K.", "Vikram J.", "Anjali R.",
  "Karthik P.", "Sneha T.", "Rohan G.", "Aditya V.", "Neha B.",
  "Kabir N.", "Ishaan D.", "Meera L.", "Riya S.", "Aryan H.",
  "Aman C.", "Tara M.", "Dev R.", "Pooja K.", "Siddharth A.",
];
const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Hyderabad", "Chennai", "Dubai", "Singapore"];
const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "ARB/USDT", "AVAX/USDT"];

type EventKind = "missed_trade" | "withdraw" | "deposit" | "new_investor";

interface BannerEvent {
  kind: EventKind;
  key: number;
  // missed_trade
  pair?: string;
  pct?: number;
  minsAgo?: number;
  // withdraw / deposit / new_investor
  name?: string;
  amount?: number;
  city?: string;
  plan?: string;
}

/* ── Theme per event kind ──────────────────────────────────────── */
interface Theme {
  ring: string;          // border color
  bgGrad: string;        // bg gradient
  shadow: string;        // outer shadow color
  orb1: string;          // blur orb 1
  orb2: string;          // blur orb 2
  topAccent: string;     // top line gradient
  chip: string;          // pill bg/border/text
  iconWrap: string;      // icon tile bg/border
  iconShadow: string;    // icon glow
  iconColor: string;     // icon text color
  highlight: string;     // highlight text
  cta: string;           // CTA button classes
}

const THEMES: Record<EventKind, Theme> = {
  missed_trade: {
    ring: "border-amber-400/35",
    bgGrad: "from-[#1a0f05] via-[#1d1408] to-[#140a04]",
    shadow: "shadow-[0_10px_30px_-12px_rgba(245,158,11,0.35),0_1px_0_rgba(255,255,255,0.05)_inset]",
    orb1: "bg-amber-500/15",
    orb2: "bg-orange-500/10",
    topAccent: "from-transparent via-amber-400 to-transparent",
    chip: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    iconWrap: "from-amber-400/25 to-orange-500/20 border-amber-300/50",
    iconShadow: "shadow-[0_0_20px_rgba(245,158,11,0.4)]",
    iconColor: "text-amber-300",
    highlight: "text-amber-200",
    cta: "from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/30",
  },
  withdraw: {
    ring: "border-emerald-400/35",
    bgGrad: "from-[#04140d] via-[#061a12] to-[#03120a]",
    shadow: "shadow-[0_10px_30px_-12px_rgba(16,185,129,0.35),0_1px_0_rgba(255,255,255,0.05)_inset]",
    orb1: "bg-emerald-500/15",
    orb2: "bg-teal-500/10",
    topAccent: "from-transparent via-emerald-400 to-transparent",
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    iconWrap: "from-emerald-400/25 to-teal-500/20 border-emerald-300/50",
    iconShadow: "shadow-[0_0_20px_rgba(16,185,129,0.4)]",
    iconColor: "text-emerald-300",
    highlight: "text-emerald-200",
    cta: "from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/30",
  },
  deposit: {
    ring: "border-blue-400/35",
    bgGrad: "from-[#06101f] via-[#071427] to-[#040b17]",
    shadow: "shadow-[0_10px_30px_-12px_rgba(59,130,246,0.35),0_1px_0_rgba(255,255,255,0.05)_inset]",
    orb1: "bg-blue-500/15",
    orb2: "bg-sky-500/10",
    topAccent: "from-transparent via-blue-400 to-transparent",
    chip: "bg-blue-500/15 text-blue-300 border-blue-400/30",
    iconWrap: "from-blue-400/25 to-sky-500/20 border-blue-300/50",
    iconShadow: "shadow-[0_0_20px_rgba(59,130,246,0.4)]",
    iconColor: "text-blue-300",
    highlight: "text-blue-200",
    cta: "from-blue-500 to-sky-500 hover:from-blue-400 hover:to-sky-400 shadow-blue-500/30",
  },
  new_investor: {
    ring: "border-fuchsia-400/35",
    bgGrad: "from-[#170a1c] via-[#1c0d22] to-[#100618]",
    shadow: "shadow-[0_10px_30px_-12px_rgba(217,70,239,0.35),0_1px_0_rgba(255,255,255,0.05)_inset]",
    orb1: "bg-fuchsia-500/15",
    orb2: "bg-violet-500/10",
    topAccent: "from-transparent via-fuchsia-400 to-transparent",
    chip: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30",
    iconWrap: "from-fuchsia-400/25 to-violet-500/20 border-fuchsia-300/50",
    iconShadow: "shadow-[0_0_20px_rgba(217,70,239,0.4)]",
    iconColor: "text-fuchsia-300",
    highlight: "text-fuchsia-200",
    cta: "from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400 shadow-fuchsia-500/30",
  },
};

/* ── Generators ────────────────────────────────────────────────── */
function randName() { return NAMES[Math.floor(Math.random() * NAMES.length)]; }
function randCity() { return CITIES[Math.floor(Math.random() * CITIES.length)]; }
function randPair() { return PAIRS[Math.floor(Math.random() * PAIRS.length)]; }

function pickWithdrawAmount() {
  const r = Math.random();
  if (r < 0.55) return Math.floor(220 + Math.random() * 1800);
  if (r < 0.88) return Math.floor(2100 + Math.random() * 5900);
  return Math.floor(8500 + Math.random() * 11500);
}
function pickDepositAmount() {
  const r = Math.random();
  if (r < 0.55) return Math.floor(120 + Math.random() * 880);
  if (r < 0.88) return Math.floor(1000 + Math.random() * 4500);
  return Math.floor(5500 + Math.random() * 9500);
}
function pickInvestorAmount() {
  const r = Math.random();
  if (r < 0.6) return Math.floor(100 + Math.random() * 900);
  if (r < 0.9) return Math.floor(1000 + Math.random() * 4000);
  return Math.floor(5000 + Math.random() * 10000);
}

function pickEvent(): BannerEvent {
  // Weighted: missed_trade 30%, withdraw 30%, deposit 20%, new_investor 20%
  const r = Math.random();
  const now = Date.now();
  if (r < 0.3) {
    return {
      kind: "missed_trade",
      key: now,
      pair: randPair(),
      pct: +(0.8 + Math.random() * 3.4).toFixed(2),
      minsAgo: Math.floor(Math.random() * 8) + 1,
    };
  }
  if (r < 0.6) {
    return {
      kind: "withdraw",
      key: now,
      name: randName(),
      amount: pickWithdrawAmount(),
      city: randCity(),
    };
  }
  if (r < 0.8) {
    return {
      kind: "deposit",
      key: now,
      name: randName(),
      amount: pickDepositAmount(),
      city: randCity(),
    };
  }
  return {
    kind: "new_investor",
    key: now,
    name: randName(),
    amount: pickInvestorAmount(),
    city: randCity(),
  };
}

/* ── Per-event content ─────────────────────────────────────────── */
function EventContent({ evt }: { evt: BannerEvent }) {
  if (evt.kind === "missed_trade") {
    return (
      <>
        <p className="text-sm md:text-[15px] font-semibold text-white leading-snug">
          You missed a{" "}
          <span className="inline-flex items-center gap-1 text-emerald-300 font-bold tabular-nums">
            <TrendingUp className="w-3.5 h-3.5" />
            +{evt.pct}%
          </span>{" "}
          signal on <span className="text-amber-200 font-bold">{evt.pair}</span>{" "}
          <span className="text-white/50 font-normal">· {evt.minsAgo}m ago</span>
        </p>
        <p className="mt-1 text-xs md:text-[13px] text-white/65 leading-snug">
          Don't worry — top up now and grab the{" "}
          <span className="text-amber-300 font-semibold">next potential trade</span>. A $1,000 fund
          would have earned{" "}
          <span className="text-emerald-300 font-bold tabular-nums">
            +${((1000 * (evt.pct ?? 0)) / 100).toFixed(2)}
          </span>
          .
        </p>
      </>
    );
  }
  if (evt.kind === "withdraw") {
    return (
      <>
        <p className="text-sm md:text-[15px] font-semibold text-white leading-snug">
          <span className="text-white/90">{evt.name}</span> from{" "}
          <span className="text-white/70">{evt.city}</span> just withdrew{" "}
          <span className="text-emerald-300 font-bold tabular-nums">
            ${evt.amount?.toLocaleString()}
          </span>{" "}
          <span className="text-white/50 font-normal">· TRC20 payout</span>
        </p>
        <p className="mt-1 text-xs md:text-[13px] text-white/65 leading-snug">
          Real payouts happening 24/7. Investors are{" "}
          <span className="text-emerald-300 font-semibold">cashing out profits</span> — fund your
          account to start earning yours.
        </p>
      </>
    );
  }
  if (evt.kind === "deposit") {
    return (
      <>
        <p className="text-sm md:text-[15px] font-semibold text-white leading-snug">
          <span className="text-white/90">{evt.name}</span> from{" "}
          <span className="text-white/70">{evt.city}</span> deposited{" "}
          <span className="text-blue-300 font-bold tabular-nums">
            ${evt.amount?.toLocaleString()}
          </span>{" "}
          <span className="text-white/50 font-normal">· USDT TRC20</span>
        </p>
        <p className="mt-1 text-xs md:text-[13px] text-white/65 leading-snug">
          Smart investors are{" "}
          <span className="text-blue-300 font-semibold">stacking capital</span> before the next
          high-conviction trade. Don't miss the window.
        </p>
      </>
    );
  }
  // new_investor
  return (
    <>
      <p className="text-sm md:text-[15px] font-semibold text-white leading-snug">
        <span className="text-white/90">{evt.name}</span> from{" "}
        <span className="text-white/70">{evt.city}</span> just joined with{" "}
        <span className="text-fuchsia-300 font-bold tabular-nums">
          ${evt.amount?.toLocaleString()}
        </span>{" "}
        <span className="text-white/50 font-normal">· new investor</span>
      </p>
      <p className="mt-1 text-xs md:text-[13px] text-white/65 leading-snug">
        <span className="text-fuchsia-300 font-semibold">310+ active investors</span> trusting the
        desk. Join the cohort while onboarding is open.
      </p>
    </>
  );
}

function eventLabel(kind: EventKind): { text: string; icon: typeof Zap } {
  switch (kind) {
    case "missed_trade": return { text: "Trade Detected", icon: Zap };
    case "withdraw":     return { text: "Live Withdrawal", icon: Flame };
    case "deposit":      return { text: "New Deposit", icon: ArrowDownToLine };
    case "new_investor": return { text: "New Investor", icon: PartyPopper };
  }
}

function eventIcon(kind: EventKind) {
  switch (kind) {
    case "missed_trade": return AlertTriangle;
    case "withdraw":     return ArrowUpFromLine;
    case "deposit":      return ArrowDownToLine;
    case "new_investor": return UserPlus;
  }
}

function eventCta(kind: EventKind): { label: string; href: string } {
  switch (kind) {
    case "missed_trade": return { label: "Top Up Now", href: "/deposit" };
    case "withdraw":     return { label: "Start Earning", href: "/invest" };
    case "deposit":      return { label: "Deposit Now",  href: "/deposit" };
    case "new_investor": return { label: "Join Now",     href: "/invest" };
  }
}

/* ── Component ─────────────────────────────────────────────────── */
/**
 * Rotating FOMO banner on the main dashboard (not a popup).
 * Cycles through missed-trade, withdrawal, deposit, and new-investor events
 * every ~12s. Each event kind has its own color theme and CTA.
 * Dismissible — hides for 30 minutes via sessionStorage.
 */
export function MissedTradeBanner() {
  const [evt, setEvt] = useState<BannerEvent>(() => pickEvent());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const until = Number(sessionStorage.getItem("missedTradeBannerHideUntil") ?? 0);
    return until > Date.now();
  });

  useEffect(() => {
    if (dismissed) return;
    const id = setInterval(() => setEvt(pickEvent()), 12000);
    return () => clearInterval(id);
  }, [dismissed]);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(
        "missedTradeBannerHideUntil",
        String(Date.now() + 30 * 60 * 1000),
      );
    } catch {}
    setDismissed(true);
  };

  const theme = THEMES[evt.kind];
  const { text: labelText, icon: LabelIcon } = useMemo(() => eventLabel(evt.kind), [evt.kind]);
  const MainIcon = eventIcon(evt.kind);
  const cta = eventCta(evt.kind);

  if (dismissed) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={evt.key}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={`relative overflow-hidden rounded-2xl border ${theme.ring} bg-gradient-to-r ${theme.bgGrad} ${theme.shadow}`}
      >
        {/* Animated top accent */}
        <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${theme.topAccent}`} />
        {/* Glow orbs */}
        <div className={`absolute -top-16 -left-10 w-48 h-48 ${theme.orb1} rounded-full blur-3xl pointer-events-none`} />
        <div className={`absolute -bottom-16 -right-10 w-48 h-48 ${theme.orb2} rounded-full blur-3xl pointer-events-none`} />

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="relative px-4 sm:px-5 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Icon */}
          <div className="shrink-0 flex items-center gap-3">
            <div className="relative">
              <div className={`absolute inset-0 ${theme.orb1} blur-xl rounded-full animate-pulse`} />
              <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${theme.iconWrap} border flex items-center justify-center ${theme.iconShadow}`}>
                <MainIcon className={`w-6 h-6 ${theme.iconColor}`} strokeWidth={2} />
              </div>
            </div>
            <span className={`sm:hidden text-[10px] font-extrabold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border ${theme.chip}`}>
              {labelText}
            </span>
          </div>

          {/* Message */}
          <div className="min-w-0 flex-1">
            <div className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-[0.18em] mb-1.5 ${theme.chip}`}>
              <LabelIcon className="w-3 h-3" /> {labelText}
            </div>
            <EventContent evt={evt} />
          </div>

          {/* CTA */}
          <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
            <Link
              href={cta.href}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r ${theme.cta} text-black text-sm font-bold shadow-lg transition-all`}
            >
              {cta.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
