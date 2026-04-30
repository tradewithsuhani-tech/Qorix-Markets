import {
  Megaphone,
  Zap,
  AlertTriangle,
  Info,
  Wrench,
  TrendingUp,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type EmailTemplate = {
  id: string;
  icon: LucideIcon;
  label: string;
  color: string;
  defaultTitle: string;
  defaultMessage: string;
};

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "announcement",
    icon: Megaphone,
    label: "Announcement",
    color: "text-blue-400 bg-blue-500/10",
    defaultTitle: "Important Platform Announcement",
    defaultMessage:
      "Dear Investor,\n\nWe have an important update to share with you regarding the Qorix Markets platform...",
  },
  {
    id: "promotion",
    icon: Zap,
    label: "Promotion",
    color: "text-amber-400 bg-amber-500/10",
    defaultTitle: "Exclusive Opportunity for You",
    defaultMessage:
      "Dear Investor,\n\nWe're excited to share an exclusive promotion available to our valued investors...",
  },
  {
    id: "alert",
    icon: AlertTriangle,
    label: "Alert / Warning",
    color: "text-red-400 bg-red-500/10",
    defaultTitle: "Important Security Notice",
    defaultMessage:
      "Dear Investor,\n\nWe want to inform you about an important security matter that requires your attention...",
  },
  {
    id: "info",
    icon: Info,
    label: "Info Update",
    color: "text-emerald-400 bg-emerald-500/10",
    defaultTitle: "Platform Update",
    defaultMessage:
      "Dear Investor,\n\nHere is a brief update on platform performance and upcoming changes...",
  },
  {
    id: "maintenance",
    icon: Wrench,
    label: "Maintenance",
    color: "text-orange-400 bg-orange-500/10",
    defaultTitle: "🛠 Scheduled Maintenance — Brief Service Pause",
    defaultMessage:
      "Dear Investor,\n\n" +
      "We're briefly upgrading the Qorix Markets platform to serve you better.\n\n" +
      "⏸  Trading temporarily paused\n" +
      "🔒  Your funds are 100% safe\n" +
      "💸  Deposits & withdrawals will queue automatically\n" +
      "✅  Everything resumes the moment we're back\n\n" +
      "You'll receive an instant notification as soon as trading goes live again.\n\n" +
      "Thank you for your patience.\n\n" +
      "Qorix Markets\n" +
      "AI-Powered Trading System",
  },
  {
    id: "trade_alert",
    icon: TrendingUp,
    label: "Trade Alert (FOMO)",
    color: "text-rose-400 bg-rose-500/10",
    defaultTitle: "🚨 Trade Alert — Profit Just Booked. You're Not In.",
    defaultMessage:
      "⚡ A trade just executed on Qorix.\n\n" +
      "💰 Active users booked profit in minutes.\n" +
      "📉 Your account is sitting idle.\n\n" +
      "🔍 Next signal: scanning the market right now\n" +
      "⏳ Window: closes the moment it fires\n" +
      "🔒 Only funded accounts participate\n\n" +
      "Your seat is reserved — your balance isn't.\n\n" +
      "👉 Top up in under 2 minutes and ride the next move.\n\n" +
      "✔ Start from as low as $10\n" +
      "✔ Fully automated — zero work\n" +
      "✔ Withdraw anytime\n\n" +
      "Don't watch the next profit happen to someone else.\n\n" +
      "Qorix Markets\n" +
      "AI-Powered Trading System",
  },
  {
    id: "kyc",
    icon: ShieldCheck,
    label: "KYC Verification",
    color: "text-cyan-400 bg-cyan-500/10",
    defaultTitle: "🛡 Action Needed — Verify Your KYC to Continue Trading",
    defaultMessage:
      "Dear Investor,\n\n" +
      "To keep your Qorix Markets account secure and unlock the full trading experience, we need to verify your identity (KYC).\n\n" +
      "🛡  Why KYC is required\n" +
      "   • Protects your funds from unauthorized access\n" +
      "   • Required by global financial compliance standards\n" +
      "   • Unlocks higher withdrawal limits and faster processing\n\n" +
      "📋  What you'll need (takes under 3 minutes)\n" +
      "   • A government-issued photo ID (Passport / Driving Licence / Aadhaar / National ID)\n" +
      "   • A clear selfie holding the same ID\n" +
      "   • A recent address proof (utility bill / bank statement)\n\n" +
      "⚡  How to complete it\n" +
      "   1. Open the Qorix Markets app or website\n" +
      "   2. Go to Profile → KYC Verification\n" +
      "   3. Upload the documents above\n" +
      "   4. Submit — most reviews complete within 24 hours\n\n" +
      "🔒  Your data is end-to-end encrypted and used ONLY for identity verification. We never share it with third parties.\n\n" +
      "Once verified, you'll receive the official ✅ Verified badge on your profile and instant access to:\n" +
      "   • Higher daily withdrawal limits\n" +
      "   • Priority support\n" +
      "   • Exclusive verified-only promotions\n\n" +
      "Need help? Reply to this email and our compliance team will guide you personally.\n\n" +
      "Qorix Markets\n" +
      "AI-Powered Trading System",
  },
  {
    id: "next_trade",
    icon: Zap,
    label: "Next Trade FOMO",
    color: "text-violet-400 bg-violet-500/10",
    defaultTitle: "⚡ Next Trade Coming Soon — Don't Miss It",
    defaultMessage:
      "Dear Investor,\n\n" +
      "You just joined Qorix — great decision.\n\n" +
      "But here's something important:\n\n" +
      "⚡ A trade was executed today…\n" +
      "And users already booked profits.\n\n" +
      "You're not in yet.\n\n" +
      "Right now, the system is actively scanning the market for the next opportunity.\n\n" +
      "⏳ Next trade is expected soon.\n\n" +
      "Once it executes, entries close — and only active accounts participate.\n\n" +
      "💡 What you can do now:\n\n" +
      "• Activate your trading\n" +
      "• Start from as low as $10\n" +
      "• Let the system handle execution\n\n" +
      "🚀 Why users are joining Qorix:\n\n" +
      "✔ Fully automated trading\n" +
      "✔ No emotions, no missed entries\n" +
      "✔ Risk-managed system\n" +
      "✔ Withdraw anytime\n\n" +
      "👉 Don't miss the next trade.\n\n" +
      "Start now and be part of the next profit.\n\n" +
      "Qorix Markets\n" +
      "AI-Powered Trading System",
  },
];
