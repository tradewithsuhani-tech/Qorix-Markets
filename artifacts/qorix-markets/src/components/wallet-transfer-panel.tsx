import type { ElementType } from "react";
import { ArrowRightLeft, AlertCircle, DollarSign, Info, ShieldCheck, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";

type InvestmentLike = {
  isActive?: boolean;
  active?: boolean;
  amount?: number | string;
} | null | undefined;

export type WalletTransferPanelProps = {
  fxRate: number;
  mainBalInr: number;
  usdtBal: number;
  tradingBal: number;
  investment?: InvestmentLike;
  transferAmount: string;
  transferDirection: "toTrading" | "toMain";
  transferSource: "usdt" | "main";
  onTransferAmountChange: (value: string) => void;
  onSwapDirection: () => void;
  onSelectSource: (source: "usdt" | "main") => void;
  transferMutation: Pick<UseMutationResult<unknown, unknown, { data: Record<string, unknown> }, unknown>, "mutate" | "isPending">;
};

function safeRate(rate: number) {
  return Number.isFinite(rate) && rate > 0 ? rate : 99;
}

function isInvestmentActive(inv: InvestmentLike) {
  if (!inv) return false;
  return !!(inv.isActive ?? inv.active);
}

function investmentAmount(inv: InvestmentLike) {
  if (!inv) return 0;
  const n = Number(inv.amount);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function WalletTransferPanel({
  fxRate,
  mainBalInr,
  usdtBal,
  tradingBal,
  investment,
  transferAmount,
  transferDirection,
  transferSource,
  onTransferAmountChange,
  onSwapDirection,
  onSelectSource,
  transferMutation,
}: WalletTransferPanelProps) {
  const rate = safeRate(fxRate);
  const fromIsMain = transferDirection === "toTrading";
  const deployedAmt = isInvestmentActive(investment) && !fromIsMain ? investmentAmount(investment) : 0;
  const freeCapital = Math.max(0, tradingBal - deployedAmt);
  const hasActiveInv = isInvestmentActive(investment) && !fromIsMain && deployedAmt > 0;

  const isMainSrc = fromIsMain && transferSource === "main";
  const fromBal = fromIsMain ? (transferSource === "usdt" ? usdtBal : mainBalInr) : freeCapital;
  const inputIsInr = isMainSrc;
  const numAmt = Number(transferAmount) || 0;
  const valid = numAmt > 0 && numAmt <= fromBal;

  const usdtReceive = isMainSrc ? numAmt / rate : numAmt;
  const inrReceive = !fromIsMain ? numAmt * rate : 0;
  const mainBalUsdt = mainBalInr / rate;
  const fromDisplayAmt = isMainSrc ? mainBalUsdt : fromBal;
  const toDisplayAmt = fromIsMain ? tradingBal : mainBalUsdt;

  return (
    <div className="space-y-4 pb-2">
      {fromIsMain && (usdtBal > 0 || mainBalInr > 0) && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSelectSource("usdt")}
            className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all ${
              transferSource === "usdt"
                ? "bg-emerald-500/15 border-emerald-400/50 text-emerald-300"
                : "bg-white/[0.03] border-white/10 text-white/50 hover:border-white/20"
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider mb-0.5 opacity-70">From</div>
            USDT Wallet
            <div className="text-[11px] font-mono mt-0.5 opacity-80">${usdtBal.toFixed(2)}</div>
          </button>
          <button
            type="button"
            onClick={() => onSelectSource("main")}
            className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all ${
              transferSource === "main"
                ? "bg-amber-500/15 border-amber-400/50 text-amber-300"
                : "bg-white/[0.03] border-white/10 text-white/50 hover:border-white/20"
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider mb-0.5 opacity-70">From</div>
            Main (INR)
            <div className="text-[11px] font-mono mt-0.5 opacity-80">₹{Math.round(mainBalInr).toLocaleString("en-IN")}</div>
          </button>
        </div>
      )}

      <div className="relative">
        <TransferWalletCard
          badge="FROM"
          badgeTone="emerald"
          icon={fromIsMain ? (isMainSrc ? WalletIcon : DollarSign) : TrendingUp}
          iconTone={isMainSrc ? "amber" : "emerald"}
          name={fromIsMain ? (isMainSrc ? "Main Wallet (INR)" : "USDT Wallet") : "Funding Wallet"}
          sub={
            fromIsMain
              ? isMainSrc
                ? `₹${Math.round(mainBalInr).toLocaleString("en-IN")} available`
                : `$${usdtBal.toFixed(2)} available`
              : "Deployed capital"
          }
          amount={fromDisplayAmt}
        />
        <div className="relative h-7 flex items-center justify-center">
          <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          <button
            type="button"
            onClick={onSwapDirection}
            aria-label="Swap direction"
            className="relative z-10 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-black flex items-center justify-center shadow-lg shadow-emerald-500/40 ring-4 ring-[#0b0f12] active:scale-95 transition-all"
          >
            <ArrowRightLeft style={{ width: 15, height: 15 }} strokeWidth={2.5} />
          </button>
        </div>
        <TransferWalletCard
          badge="TO"
          badgeTone="cyan"
          icon={fromIsMain ? TrendingUp : WalletIcon}
          iconTone="cyan"
          name={fromIsMain ? "Funding Wallet" : "Main Wallet (INR)"}
          sub={fromIsMain ? "Ready to trade" : "Withdrawable balance"}
          amount={toDisplayAmt}
          incoming={isMainSrc ? usdtReceive : fromIsMain ? numAmt : inrReceive / rate}
        />
      </div>

      {hasActiveInv && (
        <div className="rounded-xl border border-white/8 bg-white/[0.025] divide-y divide-white/6 text-[12px]">
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
              <span className="text-white/60">Active Strategy (locked)</span>
            </div>
            <span className="font-semibold tabular-nums text-white/50">${deployedAmt.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-white/60">Free Capital (transferable)</span>
            </div>
            <span className="font-semibold tabular-nums text-emerald-400">${freeCapital.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-[0.18em] text-white/45">
            {inputIsInr ? "AMOUNT (INR ₹)" : "AMOUNT (USDT $)"}
          </span>
          <button
            type="button"
            onClick={() => onTransferAmountChange(fromBal > 0 ? fromBal.toFixed(inputIsInr ? 0 : 2) : "")}
            className="text-[10px] font-bold tracking-wide text-emerald-300 hover:text-emerald-200 px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/30 transition-colors"
          >
            MAX · {inputIsInr ? `₹${Math.round(fromBal).toLocaleString("en-IN")}` : `$${fromBal.toFixed(2)}`}
          </button>
        </div>
        <div
          className={`rounded-2xl border bg-white/[0.025] transition-colors overflow-hidden ${
            numAmt > 0 && !valid
              ? "border-rose-500/45"
              : valid
              ? "border-emerald-400/45 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]"
              : "border-white/[0.10]"
          }`}
        >
          <div className="px-3.5 py-2 flex items-center gap-2">
            <span className={`text-[18px] font-semibold leading-none shrink-0 select-none ${inputIsInr ? "text-amber-400" : "text-emerald-400"}`}>
              {inputIsInr ? "₹" : "$"}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={transferAmount}
              onChange={(e) => onTransferAmountChange(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              autoFocus
              className="flex-1 bg-transparent border-0 outline-none text-[20px] font-semibold tracking-[-0.01em] tabular-nums placeholder:text-white/25 min-w-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {numAmt > 0 && (
              <span className="text-[11px] text-white/45 font-mono tabular-nums shrink-0">
                {isMainSrc
                  ? `≈ $${usdtReceive.toFixed(2)} USDT`
                  : !fromIsMain
                  ? `≈ ₹${Math.round(inrReceive).toLocaleString("en-IN")}`
                  : `≈ ₹${Math.round(numAmt * rate).toLocaleString("en-IN")}`}
              </span>
            )}
          </div>
        </div>

        {(isMainSrc || !fromIsMain) && numAmt > 0 && valid && (
          <div className="mt-2 flex items-center justify-between text-[11px] px-1">
            <span className="text-white/35">Rate: ₹1 = ${(1 / rate).toFixed(4)}</span>
            {isMainSrc ? (
              <span className="text-emerald-400 font-semibold">You receive ${usdtReceive.toFixed(4)} USDT</span>
            ) : (
              <span className="text-amber-400 font-semibold">You receive ₹{Math.round(inrReceive).toLocaleString("en-IN")}</span>
            )}
          </div>
        )}

        {numAmt > fromBal && (
          <div className="mt-1.5 text-[11px] text-rose-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {hasActiveInv && freeCapital <= 0
              ? "No free capital — all funds are locked in your active strategy"
              : hasActiveInv
              ? `Only $${freeCapital.toFixed(2)} free capital available to transfer`
              : inputIsInr
              ? `Only ₹${Math.round(fromBal).toLocaleString("en-IN")} available`
              : "Exceeds available balance"}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5">
        <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[12px] text-white/70 leading-relaxed">
          {fromIsMain
            ? isMainSrc
              ? `Your INR balance converts to USDT at ₹1 = $${(1 / rate).toFixed(4)} and is deployed to your funding wallet instantly.`
              : "USDT from your wallet moves 1:1 to your funding wallet. Ready to trade in the next cycle."
            : hasActiveInv
            ? "Only free capital (not deployed in bot) can be transferred. Stop the strategy to move all funds."
            : "USDT converts to ₹ at the live rate and is credited to your main wallet instantly."}
        </p>
      </div>

      <button
        type="button"
        onClick={() =>
          transferMutation.mutate({
            data: {
              amount: isMainSrc ? usdtReceive : numAmt,
              direction: fromIsMain ? "to_trading" : "to_main",
              ...(fromIsMain ? { source: transferSource } : {}),
            },
          })
        }
        disabled={transferMutation.isPending || !valid}
        className={`w-full h-12 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all ${
          valid
            ? "bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black shadow-lg shadow-emerald-500/30 active:scale-[0.99]"
            : "bg-white/[0.04] text-white/40 cursor-not-allowed"
        }`}
      >
        {transferMutation.isPending ? (
          <>
            <span className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
            Processing…
          </>
        ) : !numAmt ? (
          "Enter Amount"
        ) : !valid ? (
          "Insufficient Balance"
        ) : isMainSrc ? (
          <>
            <ArrowRightLeft style={{ width: 14, height: 14 }} strokeWidth={2.5} />
            Convert ₹{Math.round(numAmt).toLocaleString("en-IN")} → ${usdtReceive.toFixed(2)} USDT
          </>
        ) : !fromIsMain ? (
          <>
            <ArrowRightLeft style={{ width: 14, height: 14 }} strokeWidth={2.5} />
            Convert ${numAmt.toFixed(2)} → ₹{Math.round(inrReceive).toLocaleString("en-IN")}
          </>
        ) : (
          <>
            <ArrowRightLeft style={{ width: 14, height: 14 }} strokeWidth={2.5} />
            Transfer ${numAmt.toFixed(2)} USDT
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-[11px] text-white/45">
        <ShieldCheck className="w-3 h-3 text-emerald-400/70" />
        Settled instantly · zero fees
      </div>
    </div>
  );
}

function TransferWalletCard({
  badge,
  badgeTone,
  icon: Icon,
  iconTone,
  name,
  sub,
  amount,
  incoming,
}: {
  badge: string;
  badgeTone: "emerald" | "cyan";
  icon: ElementType;
  iconTone: "emerald" | "cyan" | "amber";
  name: string;
  sub: string;
  amount: number;
  incoming?: number;
}) {
  const tones = {
    emerald: {
      iconBg: "bg-emerald-500/15 border-emerald-400/30 text-emerald-400",
      badge: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
      ring: "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] to-emerald-500/[0.02]",
    },
    cyan: {
      iconBg: "bg-cyan-500/15 border-cyan-400/30 text-cyan-400",
      badge: "border-cyan-400/40 bg-cyan-500/10 text-cyan-300",
      ring: "border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.07] to-cyan-500/[0.02]",
    },
    amber: {
      iconBg: "bg-amber-500/15 border-amber-400/30 text-amber-400",
      badge: "border-amber-400/40 bg-amber-500/10 text-amber-300",
      ring: "border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] to-amber-500/[0.02]",
    },
  } as const;

  const t = tones[iconTone] ?? tones.emerald;
  const b = tones[badgeTone] ?? tones.emerald;
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const showIncoming = !!incoming && incoming > 0;

  return (
    <div className={`rounded-2xl border ${t.ring} px-3.5 py-3 flex items-center gap-3`}>
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${t.iconBg}`}>
        <Icon style={{ width: 19, height: 19 }} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${b.badge}`}>{badge}</span>
          <span className="text-[14px] font-semibold text-white truncate">{name}</span>
        </div>
        <div className="text-[11px] text-white/50 truncate">{sub}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[15px] font-semibold tabular-nums text-white leading-none">
          ${safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {showIncoming ? (
          <div className="text-[10px] tabular-nums text-emerald-400 font-semibold mt-1">
            +${incoming!.toFixed(2)}
          </div>
        ) : (
          <div className="text-[10px] text-white/40 tabular-nums mt-1">USD</div>
        )}
      </div>
    </div>
  );
}
