import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Lock, Search, X, ChevronDown, ChevronUp, ChevronRight, Info } from "lucide-react";
import { BANKS, type Bank } from "@/lib/deposit-flow-data";
import { cn } from "@/lib/utils";

const COLLAPSED = 3;

export default function DepositNetBankingPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;

  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const { popular, others } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? BANKS.filter((b) => b.name.toLowerCase().includes(q) || b.shortName.toLowerCase().includes(q))
      : BANKS;
    return {
      popular: filtered.filter((b) => b.popular),
      others: filtered.filter((b) => !b.popular),
    };
  }, [search]);

  const select = (bank: Bank) => {
    navigate(`/deposit/netbanking/details?bankId=${bank.id}&amount=${numAmount}`);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-[10px] font-bold tracking-[0.14em] text-emerald-400">SELECT YOUR BANK</div>
            <div className="text-xl font-bold mt-0.5">Pay ₹{numAmount.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-xs">
            RBI-compliant · <span className="text-muted-foreground">Secure NEFT/IMPS transfer to verified beneficiary</span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 h-11 rounded-xl bg-white/5 border border-white/10">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bank"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            data-testid="input-search-bank"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {popular.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground">POPULAR BANKS</div>
            <div className="space-y-2">
              {popular.map((b) => <BankRow key={b.id} bank={b} onClick={() => select(b)} />)}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold tracking-widest text-muted-foreground">ALL BANKS</div>
              {!search.trim() && others.length > COLLAPSED && (
                <button
                  onClick={() => setShowAll((p) => !p)}
                  className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold"
                >
                  {!showAll && <span>+{others.length - COLLAPSED}</span>}
                  {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {(search.trim() || showAll ? others : others.slice(0, COLLAPSED)).map((b) => (
                <BankRow key={b.id} bank={b} onClick={() => select(b)} />
              ))}
            </div>
          </div>
        )}

        {popular.length === 0 && others.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center space-y-2">
            <Search className="w-5 h-5 mx-auto text-muted-foreground" />
            <div className="text-sm text-muted-foreground">No banks found for "{search}"</div>
            <button onClick={() => setSearch("")} className="px-3.5 py-2 rounded-full border border-emerald-500 text-emerald-400 text-xs font-bold">
              Clear search
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
          <Info className="w-3 h-3" />
          All banks are RBI-licensed · 256-bit SSL encryption · 0% gateway fees
        </div>
      </div>
    </Layout>
  );
}

function BankRow({ bank, onClick }: { bank: Bank; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-left"
      data-testid={`bank-${bank.id}`}
    >
      <div
        className="w-10 h-10 rounded-xl border-[1.5px] flex items-center justify-center text-sm font-bold shrink-0"
        style={{ backgroundColor: bank.color + "22", borderColor: bank.color + "66", color: bank.color }}
      >
        {bank.initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{bank.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{bank.tagline}</div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </button>
  );
}
