import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, TrendingUp, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    // iOS detection — no beforeinstallprompt event
    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window.navigator as any).standalone;

    if (isIOS) {
      const dismissed = sessionStorage.getItem("pwa-ios-dismissed");
      if (!dismissed) {
        setTimeout(() => setShowIOSGuide(true), 3000);
      }
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 2000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem("pwa-install-dismissed", "1");
    sessionStorage.setItem("pwa-ios-dismissed", "1");
  };

  if (installed) return null;

  return (
    <>
      {/* Android / Desktop install banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
            className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:max-w-sm z-50"
          >
            <div className="rounded-2xl border border-white/10 bg-[#0e1628]/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none" />

              <div className="relative p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white leading-tight">
                          Install Qorix Markets
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Add to home screen for the best experience
                        </p>
                      </div>
                      <button
                        onClick={handleDismiss}
                        className="text-muted-foreground hover:text-white transition-colors p-0.5 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={handleInstall}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Install App
                      </button>
                      <button
                        onClick={handleDismiss}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
                      >
                        Not now
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Accent bar */}
              <div className="h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS install guide */}
      <AnimatePresence>
        {showIOSGuide && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
            className="fixed bottom-20 left-3 right-3 z-50"
          >
            <div className="rounded-2xl border border-white/10 bg-[#0e1628]/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none" />

              <div className="relative p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <p className="text-sm font-semibold text-white">Add to Home Screen</p>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="text-muted-foreground hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <ol className="space-y-1.5">
                  {[
                    <>Tap the <span className="inline-flex items-center gap-0.5 text-blue-400 font-medium">Share ↑</span> button in Safari</>,
                    <>Scroll down and tap <span className="text-blue-400 font-medium">"Add to Home Screen"</span></>,
                    <>Tap <span className="text-blue-400 font-medium">"Add"</span> to install</>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] flex items-center justify-center font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
