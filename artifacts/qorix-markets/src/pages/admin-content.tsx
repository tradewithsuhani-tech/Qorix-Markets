import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Globe, FileEdit, BarChart3, Megaphone, Save, RefreshCw, TrendingUp, Users, Wallet, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";

async function adminFetch(path: string, init?: RequestInit) {
  return authFetch(`/api${path}`, init);
}

function FieldRow({ label, icon: Icon, children }: { label: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </label>
      {children}
    </div>
  );
}

export default function AdminContentPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [content, setContent] = useState({
    homepageHeadline: "",
    homepageSubheadline: "",
    displayAUM: "",
    displayInvestors: "",
    displayReturnRate: "",
    displayMinDeposit: "",
    platformAnnouncement: "",
    announcementActive: "false",
    footerTagline: "",
  });

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/settings");
      setSettings(data);
      setContent({
        homepageHeadline: data.homepageHeadline ?? "",
        homepageSubheadline: data.homepageSubheadline ?? "",
        displayAUM: data.displayAUM ?? "",
        displayInvestors: data.displayInvestors ?? "",
        displayReturnRate: data.displayReturnRate ?? "",
        displayMinDeposit: data.displayMinDeposit ?? "",
        platformAnnouncement: data.platformAnnouncement ?? "",
        announcementActive: data.announcementActive ?? "false",
        footerTagline: data.footerTagline ?? "",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveAll() {
    setSaving(true);
    try {
      await adminFetch("/admin/settings", { method: "POST", body: JSON.stringify(content) });
      toast({ title: "Content saved", description: "Platform content has been updated." });
    } catch (e: any) {
      toast({ title: "Error saving", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function set(key: keyof typeof content, value: string) {
    setContent((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-primary">Content Control</h1>
              <p className="text-sm text-muted-foreground">Manage homepage text, platform stats, and announcements.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Reload
            </button>
            <button onClick={saveAll} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium transition-all">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/8 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <FileEdit className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-white">Homepage Text</h2>
                <p className="text-xs text-muted-foreground">Hero section headline and subheadline</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <FieldRow label="Hero Headline" icon={TrendingUp}>
                <input
                  value={content.homepageHeadline}
                  onChange={(e) => set("homepageHeadline", e.target.value)}
                  placeholder="e.g. Institutional-Grade Trading Returns"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </FieldRow>
              <FieldRow label="Hero Subheadline">
                <textarea
                  value={content.homepageSubheadline}
                  onChange={(e) => set("homepageSubheadline", e.target.value)}
                  placeholder="e.g. Join thousands of investors earning consistent daily returns..."
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm resize-none focus:ring-1 focus:ring-blue-500/50"
                />
              </FieldRow>
              <FieldRow label="Footer Tagline">
                <input
                  value={content.footerTagline}
                  onChange={(e) => set("footerTagline", e.target.value)}
                  placeholder="e.g. Secure. Transparent. Institutional."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-blue-500/50"
                />
              </FieldRow>
            </div>
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/8 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="font-bold text-white">Display Stats</h2>
                <p className="text-xs text-muted-foreground">Numbers shown on the homepage / landing page</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="AUM Display" icon={Wallet}>
                  <input
                    value={content.displayAUM}
                    onChange={(e) => set("displayAUM", e.target.value)}
                    placeholder="e.g. $24.5M+"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-amber-500/50"
                  />
                </FieldRow>
                <FieldRow label="Investors Display" icon={Users}>
                  <input
                    value={content.displayInvestors}
                    onChange={(e) => set("displayInvestors", e.target.value)}
                    placeholder="e.g. 12,500+"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-amber-500/50"
                  />
                </FieldRow>
                <FieldRow label="Return Rate Display" icon={TrendingUp}>
                  <input
                    value={content.displayReturnRate}
                    onChange={(e) => set("displayReturnRate", e.target.value)}
                    placeholder="e.g. 0.5–3.5% daily"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-amber-500/50"
                  />
                </FieldRow>
                <FieldRow label="Min Deposit Display" icon={Shield}>
                  <input
                    value={content.displayMinDeposit}
                    onChange={(e) => set("displayMinDeposit", e.target.value)}
                    placeholder="e.g. $50 USDT"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-amber-500/50"
                  />
                </FieldRow>
              </div>
              {(content.displayAUM || content.displayInvestors || content.displayReturnRate || content.displayMinDeposit) && (
                <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
                  <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-3">Live Preview</div>
                  <div className="grid grid-cols-2 gap-3">
                    {content.displayAUM && (
                      <div>
                        <div className="text-lg font-bold text-white">{content.displayAUM}</div>
                        <div className="text-xs text-muted-foreground">Assets Under Management</div>
                      </div>
                    )}
                    {content.displayInvestors && (
                      <div>
                        <div className="text-lg font-bold text-white">{content.displayInvestors}</div>
                        <div className="text-xs text-muted-foreground">Active Investors</div>
                      </div>
                    )}
                    {content.displayReturnRate && (
                      <div>
                        <div className="text-lg font-bold text-emerald-400">{content.displayReturnRate}</div>
                        <div className="text-xs text-muted-foreground">Daily Return Rate</div>
                      </div>
                    )}
                    {content.displayMinDeposit && (
                      <div>
                        <div className="text-lg font-bold text-white">{content.displayMinDeposit}</div>
                        <div className="text-xs text-muted-foreground">Minimum Deposit</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Megaphone className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h2 className="font-bold text-white">Platform Announcement Banner</h2>
                <p className="text-xs text-muted-foreground">Sticky banner shown to all logged-in users</p>
              </div>
            </div>
            <button
              onClick={() => set("announcementActive", content.announcementActive === "true" ? "false" : "true")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                content.announcementActive === "true"
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
              }`}
            >
              {content.announcementActive === "true" ? "Active" : "Inactive"}
            </button>
          </div>
          <div className="p-5 space-y-4">
            <textarea
              value={content.platformAnnouncement}
              onChange={(e) => set("platformAnnouncement", e.target.value)}
              placeholder="e.g. 🚀 New feature launched: Monthly payout reports are now available in your dashboard!"
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm resize-none focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50"
            />
            {content.platformAnnouncement && content.announcementActive === "true" && (
              <div className="rounded-xl bg-rose-500/8 border border-rose-500/20 px-4 py-3 flex items-center gap-3">
                <Megaphone className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-sm text-white/90">{content.platformAnnouncement}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveAll}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-medium transition-all"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving changes..." : "Save All Content"}
          </button>
        </div>
      </motion.div>
    </Layout>
  );
}
