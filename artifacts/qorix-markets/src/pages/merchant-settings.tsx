import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, IndianRupee } from "lucide-react";
import { MerchantLayout } from "@/components/merchant-layout";
import { merchantApiUrl, merchantAuthFetch } from "@/lib/merchant-auth-fetch";
import { useToast } from "@/hooks/use-toast";

export default function MerchantSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rate, setRate] = useState("");

  const { data } = useQuery<{ rate: string }>({
    queryKey: ["merchant-inr-rate"],
    queryFn: () => merchantAuthFetch(merchantApiUrl("/merchant/inr-rate")),
  });

  // Hydrate the input once when the server value first arrives, but don't
  // overwrite mid-edit on every refetch (otherwise typing feels broken).
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
    onError: (e) => toast({ title: "Save failed", description: String(e), variant: "destructive" }),
  });

  return (
    <MerchantLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Platform-wide INR conversion rate.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <IndianRupee className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-semibold">INR → USDT rate</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Used to compute USDT credit when you approve an INR deposit, and the held USDT when a user
          requests an INR withdrawal. Changing this affects future deposits/withdrawals only.
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
              ₹ per 1 USDT
            </label>
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
              placeholder="85.0"
            />
          </div>
          <button
            onClick={() => {
              const n = parseFloat(rate);
              if (!Number.isFinite(n) || n <= 0) {
                toast({ title: "Rate must be a positive number", variant: "destructive" });
                return;
              }
              save.mutate();
            }}
            disabled={save.isPending}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 max-w-md">
        <h2 className="text-sm font-semibold mb-2">Need credentials reset?</h2>
        <p className="text-xs text-slate-400">
          Password and email changes are admin-controlled. Contact the platform admin to update them.
        </p>
      </div>
    </MerchantLayout>
  );
}
