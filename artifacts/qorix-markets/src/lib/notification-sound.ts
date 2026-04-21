// Lightweight WebAudio-based notification sound engine.
// Zero file dependencies — synthesized tones. Works on mobile browsers.
// Respects browser autoplay policies (resumes context only after a user gesture).

const STORAGE_KEY = "qorix-notif-sound";
const DEBOUNCE_MS = 1500; // min gap between sounds to prevent spam

export type SoundKind = "profit" | "loss" | "generic";

let ctx: AudioContext | null = null;
let unlocked = false;
let lastPlay = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

// Wire up one-time listeners that "unlock" audio on first user gesture.
export function initNotificationSound() {
  if (typeof window === "undefined") return;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    unlocked = true;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
}

// Play a tone using oscillator + envelope. Multi-note for richness.
function playTone(notes: { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number }[]) {
  const c = getCtx();
  if (!c || !unlocked) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  const now = c.currentTime;
  const master = c.createGain();
  master.gain.value = 0.18;
  master.connect(c.destination);

  for (const n of notes) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.value = n.freq;
    const t0 = now + n.start;
    const peak = n.gain ?? 1;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
    osc.connect(env).connect(master);
    osc.start(t0);
    osc.stop(t0 + n.dur + 0.05);
  }
}

const PRESETS: Record<SoundKind, Parameters<typeof playTone>[0]> = {
  // Profit: cheerful two-note rising chime (C6 → E6)
  profit: [
    { freq: 1046.5, start: 0, dur: 0.22, type: "sine", gain: 1 },
    { freq: 1318.5, start: 0.12, dur: 0.32, type: "sine", gain: 0.9 },
  ],
  // Loss: lower descending alert (A4 → F4)
  loss: [
    { freq: 440, start: 0, dur: 0.18, type: "triangle", gain: 1 },
    { freq: 349.2, start: 0.14, dur: 0.28, type: "triangle", gain: 0.9 },
  ],
  // Generic: short single click/ping (A5)
  generic: [{ freq: 880, start: 0, dur: 0.18, type: "sine", gain: 1 }],
};

export function playNotificationSound(kind: SoundKind = "generic") {
  if (!isSoundEnabled()) return;
  const now = Date.now();
  if (now - lastPlay < DEBOUNCE_MS) return;
  lastPlay = now;
  try {
    playTone(PRESETS[kind]);
  } catch {
    // silent fail — sound is non-critical
  }
}

// Map server notification type → sound kind
export function soundKindForType(type: string): SoundKind {
  switch (type) {
    case "daily_profit":
    case "monthly_payout":
    case "deposit":
      return "profit";
    case "drawdown_alert":
    case "withdrawal":
      return "loss";
    default:
      return "generic";
  }
}
