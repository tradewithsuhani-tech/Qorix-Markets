import { useState } from "react";
import { MarketingShell, MarketingHero } from "@/components/marketing/marketing-shell";
import { useSeo } from "@/lib/seo";
import { Mail, MessageCircle, Send, Clock, MapPin } from "lucide-react";

export default function ContactPage() {
  useSeo({
    title: "Contact Qorix Markets — Support and Sales",
    description:
      "Get in touch with the Qorix Markets team. Email support, live chat, and partnership inquiries answered within 24 hours.",
    canonical: "/contact",
    keywords: "contact qorix markets, support, sales, partnerships",
  });

  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  return (
    <MarketingShell>
      <MarketingHero
        badge="Contact"
        title={<>We are <span className="text-emerald-300">here to help</span></>}
        subtitle="Questions about the platform, your account, or partnership opportunities? Reach out and we will respond within 24 hours."
      />

      <section className="max-w-6xl mx-auto px-4 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <ContactCard icon={<Mail size={16} className="text-emerald-300" />} title="Email" body="support@qorixmarkets.com" />
          <ContactCard icon={<MessageCircle size={16} className="text-emerald-300" />} title="Live chat" body="Available 24/7 from your dashboard." />
          <ContactCard icon={<Clock size={16} className="text-emerald-300" />} title="Response time" body="Under 24 hours, usually under 2." />
          <ContactCard icon={<MapPin size={16} className="text-emerald-300" />} title="Headquarters" body="Operating globally · Remote-first" />
        </div>

        <form
          className="lg:col-span-2 rounded-2xl p-6 md:p-8 space-y-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          onSubmit={(e) => {
            e.preventDefault();
            const subject = encodeURIComponent(`Contact from ${form.name}`);
            const body = encodeURIComponent(`${form.message}\n\nReply to: ${form.email}`);
            window.location.href = `mailto:support@qorixmarkets.com?subject=${subject}&body=${body}`;
            setSent(true);
          }}
        >
          <h2 className="text-xl font-bold text-white">Send us a message</h2>
          <Field label="Your name" required>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40"
            />
          </Field>
          <Field label="Email" required>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40"
            />
          </Field>
          <Field label="Message" required>
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40 resize-none"
            />
          </Field>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white"
            style={{ background: "linear-gradient(90deg,#10b981,#22c55e)" }}
          >
            <Send size={14} />
            {sent ? "Opening your email..." : "Send message"}
          </button>
        </form>
      </section>
    </MarketingShell>
  );
}

function ContactCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
          {icon}
        </div>
        <h3 className="text-white font-semibold text-sm">{title}</h3>
      </div>
      <p className="text-slate-400 text-sm">{body}</p>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">
        {label}{required && <span className="text-emerald-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
