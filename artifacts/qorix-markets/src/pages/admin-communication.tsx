import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import {
  Bell,
  Send,
  MessageSquare,
  Megaphone,
  Mail,
  MonitorSmartphone,
  Users,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  FileText,
  Zap,
  AlertTriangle,
  Info,
  ShieldAlert,
  Wrench,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function token() {
  try { return localStorage.getItem("qorix_token"); } catch { return null; }
}

async function adminFetch(path: string, init?: RequestInit) {
  const t = token();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function SectionCard({ icon: Icon, color, title, subtitle, children }: {
  icon: any; color: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className={`p-5 border-b border-white/8 flex items-center gap-3`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-white">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

const EMAIL_TEMPLATES = [
  {
    id: "announcement",
    icon: Megaphone,
    label: "Announcement",
    color: "text-blue-400 bg-blue-500/10",
    defaultTitle: "Important Platform Announcement",
    defaultMessage: "Dear Investor,\n\nWe have an important update to share with you regarding the Qorix Markets platform...",
  },
  {
    id: "promotion",
    icon: Zap,
    label: "Promotion",
    color: "text-amber-400 bg-amber-500/10",
    defaultTitle: "Exclusive Opportunity for You",
    defaultMessage: "Dear Investor,\n\nWe're excited to share an exclusive promotion available to our valued investors...",
  },
  {
    id: "alert",
    icon: AlertTriangle,
    label: "Alert / Warning",
    color: "text-red-400 bg-red-500/10",
    defaultTitle: "Important Security Notice",
    defaultMessage: "Dear Investor,\n\nWe want to inform you about an important security matter that requires your attention...",
  },
  {
    id: "info",
    icon: Info,
    label: "Info Update",
    color: "text-emerald-400 bg-emerald-500/10",
    defaultTitle: "Platform Update",
    defaultMessage: "Dear Investor,\n\nHere is a brief update on platform performance and upcoming changes...",
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

export default function AdminCommunicationPage() {
  const { toast } = useToast();

  const [settings, setSettings] = useState<any>(null);
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "", audience: "all" });
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [emailForm, setEmailForm] = useState({ title: "", message: "", audience: "all" });
  const [emailLoading, setEmailLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [kycReminderLoading, setKycReminderLoading] = useState(false);

  async function loadSettings() {
    try {
      const data = await adminFetch("/admin/settings");
      setSettings(data);
    } catch {}
  }

  useEffect(() => { loadSettings(); }, []);

  async function saveSettings(patch: any) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSettingsSaving(true);
    try {
      await adminFetch("/admin/settings", { method: "POST", body: JSON.stringify(patch) });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSettingsSaving(false);
    }
  }

  async function sendBroadcast() {
    if (!broadcastForm.title || !broadcastForm.message) return;
    setBroadcastLoading(true);
    try {
      const result = await adminFetch("/admin/broadcast", { method: "POST", body: JSON.stringify(broadcastForm) });
      toast({ title: "Broadcast sent", description: `${result.recipients} users notified.` });
      setBroadcastForm({ title: "", message: "", audience: "all" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBroadcastLoading(false);
    }
  }

  function applyTemplate(templateId: string) {
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplate(templateId);
    setEmailForm({ ...emailForm, title: tpl.defaultTitle, message: tpl.defaultMessage });
  }

  async function sendKycReminder() {
    if (!confirm("Send KYC reminder email to ALL users with incomplete KYC (not_submitted + rejected)?")) return;
    setKycReminderLoading(true);
    try {
      const result = await adminFetch("/admin/kyc-reminder", { method: "POST", body: JSON.stringify({}) });
      toast({
        title: "KYC reminders sent",
        description: `${result.emailsSent ?? 0} email(s) sent${result.emailsFailed ? `, ${result.emailsFailed} failed` : ""} (out of ${result.recipients} pending users).`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setKycReminderLoading(false);
    }
  }

  async function sendEmailBroadcast() {
    if (!emailForm.title || !emailForm.message) return;
    setEmailLoading(true);
    try {
      const result = await adminFetch("/admin/broadcast", { method: "POST", body: JSON.stringify({ ...emailForm, channel: "email" }) });
      toast({
        title: "Email broadcast sent",
        description: `${result.emailsSent ?? 0} email(s) sent${result.emailsFailed ? `, ${result.emailsFailed} failed` : ""} (out of ${result.recipients} recipients).`,
      });
      setEmailForm({ title: "", message: "", audience: "all" });
      setSelectedTemplate(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  }

  const popupModeLabel: Record<string, string> = {
    off: "Off — no popup shown",
    once: "Show once per user",
    always: "Show every visit",
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Communication System</h1>
            <p className="text-sm text-muted-foreground">Popup notifications, in-app broadcasts, and email templates.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-2">
          <div className="glass-card p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
            <div className="text-xs text-muted-foreground mb-1">Popup Status</div>
            <div className="text-xl font-bold text-blue-400 capitalize">{settings?.popupMode ?? "—"}</div>
            <div className="text-xs text-muted-foreground mt-1">{popupModeLabel[settings?.popupMode ?? "off"] ?? ""}</div>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
            <div className="text-xs text-muted-foreground mb-1">Broadcast Channel</div>
            <div className="text-xl font-bold text-emerald-400">In-App</div>
            <div className="text-xs text-muted-foreground mt-1">Notifications sent to user inbox</div>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-violet-500/20 bg-violet-500/5">
            <div className="text-xs text-muted-foreground mb-1">Email Templates</div>
            <div className="text-xl font-bold text-violet-400">{EMAIL_TEMPLATES.length} Ready</div>
            <div className="text-xs text-muted-foreground mt-1">Announcement, Promo, Alert, Info</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard icon={MonitorSmartphone} color="text-indigo-400 bg-indigo-500/10 border border-indigo-500/20" title="Popup Notification System" subtitle="Create a popup shown on the user dashboard">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Display Mode</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {["off", "once", "always"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => saveSettings({ popupMode: mode })}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      settings?.popupMode === mode
                        ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300"
                        : "bg-white/3 border-white/10 text-muted-foreground hover:bg-white/8"
                    }`}
                  >
                    {mode === "off" ? "Off" : mode === "once" ? "Once" : "Always"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Popup Title</label>
                <input
                  value={settings?.popupTitle ?? ""}
                  onChange={(e) => setSettings({ ...settings, popupTitle: e.target.value })}
                  onBlur={() => saveSettings({ popupTitle: settings?.popupTitle ?? "" })}
                  placeholder="Enter popup title"
                  className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Popup Message</label>
                <textarea
                  value={settings?.popupMessage ?? ""}
                  onChange={(e) => setSettings({ ...settings, popupMessage: e.target.value })}
                  onBlur={() => saveSettings({ popupMessage: settings?.popupMessage ?? "" })}
                  placeholder="Enter popup message"
                  rows={3}
                  className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm resize-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Button Text</label>
                  <input
                    value={settings?.popupButtonText ?? ""}
                    onChange={(e) => setSettings({ ...settings, popupButtonText: e.target.value })}
                    onBlur={() => saveSettings({ popupButtonText: settings?.popupButtonText ?? "" })}
                    placeholder="e.g. Learn More"
                    className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Redirect Link</label>
                  <input
                    value={settings?.popupRedirectLink ?? ""}
                    onChange={(e) => setSettings({ ...settings, popupRedirectLink: e.target.value })}
                    onBlur={() => saveSettings({ popupRedirectLink: settings?.popupRedirectLink ?? "" })}
                    placeholder="e.g. /invest"
                    className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500/50"
                  />
                </div>
              </div>
            </div>
            {(settings?.popupTitle || settings?.popupMessage) && (
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                <div className="text-xs text-indigo-400 font-semibold uppercase tracking-wider mb-2">Preview</div>
                <div className="font-semibold text-white text-sm">{settings.popupTitle || "(no title)"}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{settings.popupMessage || "(no message)"}</div>
                {settings.popupButtonText && (
                  <div className="mt-3">
                    <span className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
                      {settings.popupButtonText}
                    </span>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Bell} color="text-blue-400 bg-blue-500/10 border border-blue-500/20" title="Broadcast Notification" subtitle="Send instant in-app message to users">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Audience</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { v: "all", label: "All", icon: Users },
                  { v: "users", label: "Users", icon: Users },
                  { v: "admins", label: "Admins", icon: CheckCircle },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setBroadcastForm({ ...broadcastForm, audience: v })}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      broadcastForm.audience === v
                        ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                        : "bg-white/3 border-white/10 text-muted-foreground hover:bg-white/8"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Title</label>
              <input
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                placeholder="Notification title"
                className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Message</label>
              <textarea
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                placeholder="Enter your message..."
                rows={4}
                className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm resize-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
            <button
              onClick={sendBroadcast}
              disabled={broadcastLoading || !broadcastForm.title || !broadcastForm.message}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-all"
            >
              <Send className="w-4 h-4" />
              {broadcastLoading ? "Sending..." : "Send Broadcast"}
            </button>
          </SectionCard>
        </div>

        <SectionCard
          icon={ShieldAlert}
          color="text-amber-400 bg-amber-500/10 border border-amber-500/20"
          title="KYC Reminder Email"
          subtitle="Email all users who signed up but have not completed KYC verification"
        >
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90 leading-relaxed">
            Sends a branded reminder email to users with KYC status of{" "}
            <span className="font-semibold text-amber-300">not_submitted</span> or{" "}
            <span className="font-semibold text-amber-300">rejected</span>.
            <br />
            <span className="text-xs text-muted-foreground">
              Skips users already approved or pending review. The email explains required documents and links to the KYC submission page.
            </span>
          </div>
          <button
            onClick={sendKycReminder}
            disabled={kycReminderLoading}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-all text-white"
          >
            <ShieldAlert className="w-4 h-4" />
            {kycReminderLoading ? "Sending KYC reminders..." : "Send KYC Reminder to All Pending Users"}
          </button>
        </SectionCard>


        <SectionCard icon={Mail} color="text-violet-400 bg-violet-500/10 border border-violet-500/20" title="Email Broadcast Templates" subtitle="Select a template and customize before sending to all users">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {EMAIL_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => applyTemplate(tpl.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedTemplate === tpl.id
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tpl.color}`}>
                  <tpl.icon className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-white">{tpl.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{tpl.defaultTitle}</div>
              </button>
            ))}
          </div>
          {(
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2 border-t border-white/8 mt-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-violet-400" />
                <span className="font-semibold text-sm text-violet-300">Edit Template & Send</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Subject</label>
                  <input
                    value={emailForm.title}
                    onChange={(e) => setEmailForm({ ...emailForm, title: e.target.value })}
                    className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Audience</label>
                  <select
                    value={emailForm.audience}
                    onChange={(e) => setEmailForm({ ...emailForm, audience: e.target.value })}
                    className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                  >
                    <option value="all">All users</option>
                    <option value="users">Users only</option>
                    <option value="admins">Admins only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Message Body</label>
                <textarea
                  value={emailForm.message}
                  onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                  rows={5}
                  className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm resize-none focus:ring-1 focus:ring-violet-500/50 font-mono"
                />
              </div>
              <button
                onClick={sendEmailBroadcast}
                disabled={emailLoading || !emailForm.title || !emailForm.message}
                className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 flex items-center gap-2 font-medium transition-all"
              >
                <Mail className="w-4 h-4" />
                {emailLoading ? "Sending..." : "Send Email Broadcast"}
              </button>
            </motion.div>
          )}
        </SectionCard>
      </motion.div>
    </Layout>
  );
}
