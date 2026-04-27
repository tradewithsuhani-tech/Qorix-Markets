import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Globe, Smartphone, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type PendingAttempt = {
  id: number;
  ip: string | null;
  browser: string | null;
  os: string | null;
  createdAt: string;
  expiresAt: string;
};

async function authFetch(path: string, init: RequestInit = {}) {
  const token = (() => { try { return localStorage.getItem("qorix_token"); } catch { return null; } })();
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || "Request failed"), { data, status: res.status });
  return data;
}

// Poll cadence — 5s is responsive enough for the new device's countdown
// (60s before OTP fallback) without spamming the API.
const POLL_INTERVAL_MS = 5_000;

export function LoginApprovalGate() {
  const { token, user, logout } = useAuth();
  const [attempt, setAttempt] = useState<PendingAttempt | null>(null);
  const [responding, setResponding] = useState(false);
  const { toast } = useToast();
  // IDs the user has already responded to (or dismissed) in this session.
  // Without this, the next 5-second poll would re-fetch the same row
  // before the backend has settled the status change and the modal
  // would pop right back up — feels like a stuck loop to the user.
  const handledIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    // Only poll when authenticated. Avoid running on login/landing pages
    // and avoid running for admins (admins legitimately span devices).
    if (!token || !user || user.isAdmin) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const data = await authFetch("/auth/login-attempts/pending");
        if (!cancelled) {
          const next: PendingAttempt | null =
            (data.attempts as PendingAttempt[] | undefined)?.find(
              (a) => !handledIds.current.has(a.id),
            ) ?? null;
          // Avoid clobbering an open dialog with a stale list — only
          // surface the next un-handled attempt once the current one
          // is dismissed.
          setAttempt((cur) => cur ?? next);
        }
      } catch {
        // Silent: a 401 here means our session was revoked (e.g. user
        // approved another login somewhere); the auth provider's own
        // /me check will catch that and bounce them.
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, user]);

  const respond = async (decision: "approve" | "deny") => {
    if (!attempt || responding) return;
    const handledId = attempt.id;
    setResponding(true);

    // Helper: drop local auth state and hard-reload to /login. We use a
    // full navigation (not wouter's setLocation) so React state, the
    // dialog, all React-Query caches and the auth poll loops are wiped
    // — leaving zero chance of the modal getting stuck on the page after
    // the server has already killed our JWT.
    const bounceToLogin = () => {
      handledIds.current.add(handledId);
      setAttempt(null);
      try { logout(); } catch { /* ignore */ }
      window.location.assign(`${BASE_URL}/login`);
    };

    try {
      await authFetch(`/auth/login-attempts/${handledId}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      handledIds.current.add(handledId);
      if (decision === "approve") {
        toast({
          variant: "success",
          title: "Login approved",
          description: "Signing you out of this device — the other device can continue.",
        });
        // Per the user's "single active device" rule, approving a new
        // device kicks this one. Bounce to /login right away so the
        // modal can never sit on a "stuck" stale page after the server
        // has already invalidated our session via forceLogoutAfter.
        setAttempt(null);
        setTimeout(bounceToLogin, 600);
      } else {
        toast({
          variant: "success",
          title: "Login denied",
          description: "The other device has been blocked.",
        });
        setAttempt(null);
      }
    } catch (err: any) {
      const status: number | undefined = err?.status;
      // Map common backend failure modes to clear, user-friendly alerts
      // with the right variant (warning vs destructive) rather than
      // surfacing raw "Unauthorized" / 5xx text in a generic red toast.
      if (status === 401) {
        // Our JWT is already dead — typically because the other device
        // was approved earlier (or our session was rotated). Show a
        // warning, then bounce to /login instead of leaving the user
        // staring at a dialog that can no longer act.
        toast({
          variant: "warning",
          title: "Session expired",
          description: "You've been signed out on this device. Redirecting to login…",
        });
        setTimeout(bounceToLogin, 800);
        return;
      }
      if (status === 404) {
        // Attempt row was already decided/expired by the time we
        // clicked — close the modal cleanly and tell the user why.
        toast({
          variant: "warning",
          title: "Request expired",
          description: "This login request has already been answered or has timed out.",
        });
        handledIds.current.add(handledId);
        setAttempt(null);
        return;
      }
      if (status === 400) {
        toast({
          variant: "destructive",
          title: "Could not record your choice",
          description: "The request looked invalid. Please reload and try again.",
        });
        return;
      }
      if (typeof status === "number" && status >= 500) {
        toast({
          variant: "destructive",
          title: "Server is having trouble",
          description: "We couldn't reach the server. Please try again in a moment.",
        });
        return;
      }
      // Network failure / unknown status
      toast({
        variant: "destructive",
        title: "Could not record your choice",
        description: err?.message
          ? `Please try again. (${err.message})`
          : "Please check your connection and try again.",
      });
    } finally {
      setResponding(false);
    }
  };

  if (!attempt) return null;
  return (
    <Dialog open={true} onOpenChange={(open) => {
      if (!open && !responding) {
        // Treat a dismissal the same as "I'll deal with it later" —
        // mark it handled for this session so the next 5s poll doesn't
        // immediately re-open the same dialog.
        handledIds.current.add(attempt.id);
        setAttempt(null);
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500">
            <ShieldAlert className="w-5 h-5" />
            <DialogTitle>New login attempt</DialogTitle>
          </div>
          <DialogDescription>
            Someone is trying to sign in to your account from a different device.
            If this isn't you, deny and change your password right away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm bg-muted/40 rounded-lg p-3 my-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{attempt.browser || "Unknown browser"}</span>
            <span className="text-muted-foreground">on {attempt.os || "unknown device"}</span>
          </div>
          {attempt.ip ? (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">IP {attempt.ip}</span>
            </div>
          ) : null}
          <div className="text-xs text-muted-foreground">
            Requested {new Date(attempt.createdAt).toLocaleTimeString()}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => respond("deny")}
            disabled={responding}
            className="flex-1"
          >
            {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deny"}
          </Button>
          <Button
            onClick={() => respond("approve")}
            disabled={responding}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve & sign out here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
