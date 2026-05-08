import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Shield, Star, Clock, Award, Check, Zap, ChevronRight, Users } from "lucide-react";
import { P2P_AGENTS, type AgentBadge, type P2pAgent } from "@/lib/deposit-flow-data";
import { cn } from "@/lib/utils";

type Filter = "all" | "premium" | "verified";

const formatOrders = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : n.toString();
const formatLimit = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : `₹${n.toLocaleString("en-IN")}`;

export default function DepositUpiPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;
  const [filter, setFilter] = useState<Filter>("all");

  const visibleAgents = useMemo(() => {
    if (filter === "premium") return P2P_AGENTS.filter((a) => a.badge === "PREMIUM");
    if (filter === "verified")
      return P2P_AGENTS.filter((a) => a.badge === "VERIFIED" || a.badge === "PREMIUM");
    return P2P_AGENTS;
  }, [filter]);

  const handlePay = (agent: P2pAgent) => {
    navigate(`/deposit/upi/pay?agentId=${agent.id}&amount=${numAmount}`);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-[10px] font-bold tracking-[0.14em] text-emerald-400">SELECT P2P AGENT</div>
            <div className="text-xl font-bold mt-0.5">Pay ₹{numAmount.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-xs">
            Escrow-protected · <span className="text-muted-foreground">Funds released after agent confirms</span>
          </div>
        </div>

        <div className="flex gap-2">
          {([
            { id: "all", label: "All Agents" },
            { id: "premium", label: "Premium" },
            { id: "verified", label: "Verified" },
          ] as const).map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-[11px] font-bold tracking-wide transition-colors",
                  active
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                )}
                data-testid={`filter-${f.id}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {visibleAgents.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center space-y-2">
              <Users className="w-5 h-5 mx-auto text-muted-foreground" />
              <div className="text-sm text-muted-foreground">No agents match this filter</div>
              <button
                onClick={() => setFilter("all")}
                className="px-3.5 py-2 rounded-full border border-emerald-500 text-emerald-400 text-xs font-bold"
              >
                Show all agents
              </button>
            </div>
          )}
          {visibleAgents.map((agent) => {
            const eligible = numAmount >= agent.limitMin && numAmount <= agent.limitMax;
            return (
              <div
                key={agent.id}
                className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5"
                data-testid={`agent-${agent.id}`}
              >
                <div className="relative w-11 h-11 shrink-0">
                  <div
                    className="w-11 h-11 rounded-full border-[1.5px] flex items-center justify-center text-lg font-bold"
                    style={{
                      backgroundColor: agent.avatarColor + "33",
                      borderColor: agent.avatarColor + "66",
                      color: agent.avatarColor,
                    }}
                  >
                    {agent.initial}
                  </div>
                  {agent.online && (
                    <div className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0b1220]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="text-sm font-bold truncate">{agent.name}</div>
                    {agent.badge && <Badge type={agent.badge} />}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                    <Star className="w-2.5 h-2.5 text-emerald-400" />
                    <span>{agent.rating.toFixed(2)}</span>
                    <span>·</span>
                    <span>{formatOrders(agent.orderCount)} orders</span>
                    <span>·</span>
                    <Clock className="w-2.5 h-2.5" />
                    <span>{agent.responseTime}</span>
                  </div>
                  <div className="text-[10px] font-bold tracking-wider text-muted-foreground mt-1">
                    LIMIT{" "}
                    <span className={eligible ? "text-foreground/70" : "text-rose-400"}>
                      {formatLimit(agent.limitMin)} – {formatLimit(agent.limitMax)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handlePay(agent)}
                  disabled={!eligible}
                  className={cn(
                    "h-9 px-3.5 rounded-lg flex items-center gap-1 text-sm font-bold transition-opacity disabled:cursor-not-allowed",
                    eligible
                      ? "bg-emerald-500 text-white hover:opacity-90"
                      : "bg-white/5 text-muted-foreground"
                  )}
                  data-testid={`pay-${agent.id}`}
                >
                  Pay <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="text-[10px] text-muted-foreground text-center">
          All agents are KYC-verified · 24/7 dispute support · 0% gateway fees
        </div>
      </div>
    </Layout>
  );
}

function Badge({ type }: { type: NonNullable<AgentBadge> }) {
  if (type === "PREMIUM")
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-emerald-500/20 border-emerald-500/45 text-emerald-400 text-[9px] font-bold tracking-wider">
        <Award className="w-2.5 h-2.5" /> PREMIUM
      </span>
    );
  if (type === "VERIFIED")
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-emerald-500/20 border-emerald-500/45 text-emerald-400 text-[9px] font-bold tracking-wider">
        <Check className="w-2.5 h-2.5" /> VERIFIED
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-pink-500/20 border-pink-500/45 text-pink-400 text-[9px] font-bold tracking-wider">
      <Zap className="w-2.5 h-2.5" /> PRO
    </span>
  );
}
