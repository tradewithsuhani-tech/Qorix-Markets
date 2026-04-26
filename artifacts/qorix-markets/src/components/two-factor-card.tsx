// ──────────────────────────────────────────────────────────────────────────
// Two-Factor Auth row + enable/disable modals for the Settings page.
// Talks to the /security/2fa/* endpoints in the api-server.
//
// Three states for the row UI:
//   1. Loading — neutral placeholder pill
//   2. Disabled — "Enable" button → opens enrolment modal (QR + verify)
//   3. Enabled — "Disabled" button + green checkmark + "View backup codes"
// ──────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, X, Copy, CheckCircle2, Loader2, Eye, EyeOff,
  AlertTriangle, KeyRound,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const apiUrl = (path: string) => `${BASE_URL}/api${path}`;

interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining: number;
  enabledAt: string | null;
}

interface SetupResponse {
  qrDataUrl: string;
  manualCode: string;
  issuer: string;
  accountName: string;
}

interface VerifySetupResponse {
  enabled: boolean;
  backupCodes: string[];
}

export function TwoFactorCard() {
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [postEnableCodes, setPostEnableCodes] = useState<string[] | null>(null);

  const { data: status, isLoading } = useQuery<TwoFactorStatus>({
    queryKey: ["/security/2fa/status"],
    queryFn: () => authFetch<TwoFactorStatus>(apiUrl("/security/2fa/status")),
    staleTime: 15_000,
  });

  const enabled = status?.enabled === true;

  return (
    <>
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] gap-3">
        <div className="min-w-0 pr-1 flex-1">
          <div className="text-sm font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="whitespace-nowrap">Two-Factor Auth</span>
            {isLoading ? (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground border border-white/10 whitespace-nowrap shrink-0">
                Loading…
              </span>
            ) : enabled ? (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap shrink-0 inline-flex items-center gap-1">
                <CheckCircle2 style={{ width: 9, height: 9 }} />
                Enabled
              </span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {enabled
              ? `${status?.backupCodesRemaining ?? 0} backup ${status?.backupCodesRemaining === 1 ? "code" : "codes"} remaining`
              : "Adds extra login protection via authenticator app"}
          </div>
        </div>
        {enabled ? (
          <button
            onClick={() => setShowDisableModal(true)}
            className="btn btn-ghost text-xs px-3 py-1.5 shrink-0 text-rose-400 hover:text-rose-300"
          >
            Disable
          </button>
        ) : (
          <button
            onClick={() => setShowEnableModal(true)}
            disabled={isLoading}
            className="btn btn-ghost text-xs px-3 py-1.5 shrink-0 disabled:opacity-40"
          >
            Enable
          </button>
        )}
      </div>

      {showEnableModal && (
        <EnableModal
          onClose={() => setShowEnableModal(false)}
          onSuccess={(codes) => {
            setShowEnableModal(false);
            setPostEnableCodes(codes);
          }}
        />
      )}
      {showDisableModal && (
        <DisableModal onClose={() => setShowDisableModal(false)} />
      )}
      {postEnableCodes && (
        <BackupCodesModal codes={postEnableCodes} onClose={() => setPostEnableCodes(null)} />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Enable modal — three-step flow
//   Step 1: server generates secret + QR (we POST /setup on mount)
//   Step 2: user scans QR (or types manual code), enters first 6-digit code
//   Step 3: server confirms + returns 8 backup codes (handed to parent)
// ──────────────────────────────────────────────────────────────────────────
function EnableModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (codes: string[]) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [copiedManual, setCopiedManual] = useState(false);

  // Kick off setup as soon as the modal mounts.
  const setupQuery = useQuery<SetupResponse>({
    queryKey: ["/security/2fa/setup"],
    queryFn: () =>
      authFetch<SetupResponse>(apiUrl("/security/2fa/setup"), { method: "POST" }),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });

  const verifyMutation = useMutation({
    mutationFn: (codeIn: string) =>
      authFetch<VerifySetupResponse>(apiUrl("/security/2fa/verify-setup"), {
        method: "POST",
        body: JSON.stringify({ code: codeIn }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/security/2fa/status"] });
      onSuccess(data.backupCodes);
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't verify code",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast({ title: "Enter the 6-digit code from your app", variant: "destructive" });
      return;
    }
    verifyMutation.mutate(code);
  };

  const copyManual = async () => {
    if (!setupQuery.data?.manualCode) return;
    try {
      await navigator.clipboard.writeText(setupQuery.data.manualCode);
      setCopiedManual(true);
      setTimeout(() => setCopiedManual(false), 1500);
    } catch {
      // clipboard write can throw on insecure origin / iOS — silent
    }
  };

  return (
    <ModalShell onClose={onClose} title="Enable Two-Factor Auth">
      {setupQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" style={{ width: 24, height: 24 }} />
        </div>
      ) : setupQuery.error ? (
        <div className="text-sm text-rose-400 py-6 text-center">
          Could not start setup. {(setupQuery.error as Error).message || "Please try again."}
        </div>
      ) : setupQuery.data ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4">
            <li>Install Google Authenticator, Authy, or 1Password on your phone.</li>
            <li>Scan this QR code (or tap "Show key" to type it manually).</li>
            <li>Enter the 6-digit code your app shows.</li>
          </ol>

          <div className="flex justify-center">
            <div className="bg-white p-2 rounded-xl">
              <img
                src={setupQuery.data.qrDataUrl}
                alt="Two-factor authenticator QR code"
                width={200}
                height={200}
                className="block"
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
            >
              {showManual ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />}
              {showManual ? "Hide" : "Show"} key (if you can't scan)
            </button>
            {showManual && (
              <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <code className="text-xs font-mono tracking-wider flex-1 break-all">
                  {setupQuery.data.manualCode}
                </code>
                <button
                  type="button"
                  onClick={copyManual}
                  className="btn btn-ghost text-xs px-2 py-1 shrink-0"
                >
                  {copiedManual ? <CheckCircle2 style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8 text-center text-lg font-mono tracking-[0.4em] focus:outline-none focus:border-blue-500/50"
              autoFocus
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost text-sm flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifyMutation.isPending || code.length !== 6}
              className="btn btn-primary text-sm flex-1 disabled:opacity-50"
            >
              {verifyMutation.isPending ? (
                <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
              ) : (
                "Verify & Enable"
              )}
            </button>
          </div>
        </form>
      ) : null}
    </ModalShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Disable modal — requires password AND a fresh code
// ──────────────────────────────────────────────────────────────────────────
function DisableModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPw, setShowPw] = useState(false);

  const disableMutation = useMutation({
    mutationFn: (vars: { password: string; code: string }) =>
      authFetch(apiUrl("/security/2fa/disable"), {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/security/2fa/status"] });
      toast({ title: "Two-factor auth disabled" });
      onClose();
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't disable",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !code) {
      toast({ title: "Both fields are required", variant: "destructive" });
      return;
    }
    disableMutation.mutate({ password, code: code.trim() });
  };

  return (
    <ModalShell onClose={onClose} title="Disable Two-Factor Auth">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          <AlertTriangle style={{ width: 14, height: 14 }} className="shrink-0 mt-0.5" />
          <div>
            Turning off 2FA will weaken your account security. We'll require both your password and a fresh code to confirm it's really you.
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Password
          </label>
          <div className="mt-1 relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2.5 pr-10 rounded-xl bg-white/[0.04] border border-white/8 text-sm focus:outline-none focus:border-blue-500/50"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white p-1"
            >
              {showPw ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Authenticator code (or backup code)
          </label>
          <input
            type="text"
            inputMode="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456 or XXXX-XXXX"
            className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8 text-sm font-mono tracking-wider focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost text-sm flex-1">
            Keep enabled
          </button>
          <button
            type="submit"
            disabled={disableMutation.isPending}
            className="btn text-sm flex-1 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 disabled:opacity-50"
          >
            {disableMutation.isPending ? (
              <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
            ) : (
              "Disable 2FA"
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Backup codes modal — shown ONCE after successful enrolment
// ──────────────────────────────────────────────────────────────────────────
function BackupCodesModal({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const downloadTxt = () => {
    const blob = new Blob(
      [
        `Qorix Markets — Two-Factor Auth Backup Codes\n`,
        `Generated: ${new Date().toISOString()}\n\n`,
        `Each code works ONCE. Use them if you lose access to your authenticator app.\n`,
        `Keep this file in a safe place.\n\n`,
        codes.join("\n"),
        "\n",
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qorix-2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalShell onClose={acknowledged ? onClose : () => {}} title="Save your backup codes">
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          <KeyRound style={{ width: 14, height: 14 }} className="shrink-0 mt-0.5" />
          <div>
            Save these <strong>now</strong> — they will not be shown again. Each code works once if you lose access to your authenticator app.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {codes.map((c) => (
            <code key={c} className="text-sm font-mono tracking-wider text-center py-1.5 bg-white/[0.04] rounded">
              {c}
            </code>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={copyAll} className="btn btn-ghost text-xs flex-1">
            {copied ? <CheckCircle2 style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
            <span className="ml-1.5">{copied ? "Copied" : "Copy all"}</span>
          </button>
          <button onClick={downloadTxt} className="btn btn-ghost text-xs flex-1">
            Download .txt
          </button>
        </div>

        <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          I have saved these codes somewhere safe.
        </label>

        <button
          onClick={onClose}
          disabled={!acknowledged}
          className="btn btn-primary text-sm w-full disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </ModalShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Shared modal shell
// ──────────────────────────────────────────────────────────────────────────
function ModalShell({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[#0f1218] border border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="text-blue-400" style={{ width: 16, height: 16 }} />
            {title}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white p-1">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div className="p-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
