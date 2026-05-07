import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, X } from "lucide-react";
import { trackCta } from "@/lib/analytics";
import { withRef } from "@/lib/referral";

/**
 * Floating "Join Now" pill that pins to the bottom of the viewport on
 * marketing pages once the user has scrolled past the hero. Designed to
 * be the always-available conversion shortcut without blocking content.
 */
export function StickyJoinButton() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full backdrop-blur-md shadow-2xl"
        style={{
          background: "rgba(5,8,20,0.85)",
          border: "1px solid rgba(139,92,246,0.35)",
          boxShadow: "0 16px 50px -16px rgba(139,92,246,0.55)",
        }}
      >
        <Link
          href={withRef("/signup")}
          onClick={() => trackCta("Join Now", "sticky_bar")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white"
          style={{ background: "linear-gradient(90deg,#8b5cf6,#6366f1)" }}
        >
          Join Now <ArrowRight size={14} />
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
