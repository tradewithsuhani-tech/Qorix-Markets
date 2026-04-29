import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, IndianRupee, Lock, Info } from "lucide-react";
import { MerchantLayout } from "@/components/merchant-layout";
import { merchantApiUrl, merchantAuthFetch } from "@/lib/merchant-auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  PageHeader,
  PremiumCard,
  SectionLabel,
  GoldButton,
} from "@/components/merchant-ui";

export default function MerchantSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rate, setRate] = useState("");

  const { data } = useQuery<{ rate: string }>({
    queryKey: ["merchant-inr-rate"],
    queryFn: () => merchantAuthFetch(merchantApiUrl("/merchant/inr-rate")),
  });

  useEffect(() => {
    if (data?.rate && !rate) setRate(data.rate);
  }, [data?.rate, rate]);

  const save = useMutation({
    mutationFn: async () =>
      merchantAuthFetch(merchantApiUrl("/merchant/inr-rate"), {
        method: "POST",
        body: JSON.stringify({ rate }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-inr-rate"] });
      toast({ title: `INR rate updated to ₹${rate} / USDT` });
    },
    onError: (e) =>
      toast({
        title: "Save failed",
        description: String(e),
        variant: "destructive",
      }),
  });

  return (
    <MerchantLayout>
      <PageHeader
        title="Settings"
        subtitle="Platform-wide INR conversion rate and account info."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* INR Rate card */}
        <PremiumCard className="p-6" glow>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-300 to-amber-500 text-slate-950 shadow-[0_4px_14px_-2px_rgba(252,213,53,0.45)]">
              <IndianRupee className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                INR → USDT Rate
              </h2>
              <SectionLabel>Platform-wide</SectionLabel>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Used to compute USDT credit when you approve an INR deposit, and the
            held USDT when a user requests an INR withdrawal. Changes affect{" "}
            <span className="text-slate-200">future</span> deposits/withdrawals
            only.
          </p>

          <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <SectionLabel>₹ per 1 USDT</SectionLabel>
            <div className="mt-2 flex items-end gap-3">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-amber-400">
                  ₹
                </span>
                <input
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-slate-950/50 py-2.5 pl-7 pr-3 text-lg font-bold tabular-nums text-white placeholder-slate-600 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="85.00"
                />
              </div>
              <GoldButton
                onClick={() => {
                  const n = parseFloat(rate);
                  if (!Number.isFinite(n) || n <= 0) {
                    toast({
                      title: "Rate must be a positive number",
                      variant: "destructive",
                    });
                    return;
                  }
                  save.mutate();
                }}
                disabled={save.isPending}
                className="px-5 py-2.5"
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </GoldButton>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5 text-[11px] text-sky-200">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              In-flight deposits and pending withdrawals continue to use the
              rate they were submitted with — never re-priced.
            </div>
          </div>
        </PremiumCard>

        {/* Credentials card */}
        <PremiumCard className="p-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-slate-300">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Account credentials
              </h2>
              <SectionLabel>Admin-controlled</SectionLabel>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Password and email changes are admin-controlled. Contact the platform
            admin to update them. There is no self-service password reset by
            design — protects you from social-engineering attacks targeting
            high-value merchant accounts.
          </p>

          <div className="mt-5 space-y-3">
            <CredRow label="Password reset" value="Contact admin" />
            <CredRow label="Email change" value="Contact admin" />
            <CredRow label="2FA" value="Coming soon" muted />
          </div>
        </PremiumCard>
      </div>
    </MerchantLayout>
  );
}

function CredRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span
        className={
          muted
            ? "text-xs text-slate-500"
            : "text-xs font-medium text-amber-300"
        }
      >
        {value}
      </span>
    </div>
  );
}
