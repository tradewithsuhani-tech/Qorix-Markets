import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, X, Share, Plus } from "lucide-react";

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
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window.navigator as any).standalone;

    if (isIOS) {
      const dismissed = sessionStorage.getItem("pwa-ios-dismissed");
      if (!dismissed) setTimeout(() => setShowIOSGuide(true), 4000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) setTimeout(() => setShowBanner(true), 3000);
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
    if (outcome === "accepted") setInstalled(true);
    setShowBanner(false);
    setDeferredPrompt(null);
    if ("vibrate" in navigator) navigator.vibrate(30);
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
      {/* Android / Desktop – bottom sheet */}
      <AnimatePresence>
        {showBanner && (
          <>
            <motion.div
              key="install-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
              onClick={handleDismiss}
            />
            <motion.div
              key="install-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
              className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl overflow-hidden"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <div className="bg-[#0e1628] border-t border-white/10 px-6 pt-5 pb-6">
                {/* Drag handle */}
                <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />

                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-white leading-tight">Qorix Markets</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Install for the best experience</p>
                    <div className="flex items-center gap-3 mt-2">
                      {["Offline Access", "Push Alerts", "Fullscreen"].map((f) => (
                        <span key={f} className="text-[10px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleDismiss} className="text-muted-foreground hover:text-white p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={handleInstall}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold text-base shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-transform"
                >
                  Add to Home Screen
                </button>

                <button
                  onClick={handleDismiss}
                  className="w-full mt-3 py-2.5 rounded-2xl text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* iOS install guide – bottom sheet */}
      <AnimatePresence>
        {showIOSGuide && (
          <>
            <motion.div
              key="ios-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
              onClick={handleDismiss}
            />
            <motion.div
              key="ios-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
              className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl overflow-hidden"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <div className="bg-[#0e1628] border-t border-white/10 px-6 pt-5 pb-6">
                <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />

                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-lg font-bold text-white">Add to Home Screen</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Install Qorix Markets on your iPhone</p>
                  </div>
                  <button onClick={handleDismiss} className="text-muted-foreground hover:text-white p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      icon: <Share className="w-5 h-5 text-blue-400" />,
                      text: <>Tap the <strong className="text-white">Share</strong> button <span className="text-blue-400">↑</span> at the bottom of Safari</>,
                    },
                    {
                      icon: <Plus className="w-5 h-5 text-blue-400" />,
                      text: <>Scroll and tap <strong className="text-white">"Add to Home Screen"</strong></>,
                    },
                    {
                      icon: <TrendingUp className="w-5 h-5 text-blue-400" />,
                      text: <>Tap <strong className="text-white">"Add"</strong> to install the app</>,
                    },
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/4 border border-white/6">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                        {step.icon}
                      </div>
                      <p className="text-sm text-muted-foreground leading-snug pt-1">{step.text}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleDismiss}
                  className="w-full mt-4 py-2.5 rounded-2xl text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
