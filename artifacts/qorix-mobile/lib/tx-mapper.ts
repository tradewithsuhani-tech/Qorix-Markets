import type { Transaction, TransactionType, TransactionStatus } from "@/context/PortfolioContext";

export const FX_RATE = 83.42;

export interface ApiTx {
  id: number | string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  createdAt: string;
}

function mapType(t: string): TransactionType {
  switch (t) {
    case "deposit":
      return "deposit";
    case "withdrawal":
      return "withdrawal";
    case "transfer":
      return "transfer";
    case "profit":
    case "referral_bonus":
    case "bonus":
      return "income";
    default:
      return "fee";
  }
}

function mapStatus(s: string): TransactionStatus {
  if (s === "completed" || s === "success" || s === "approved") return "completed";
  if (s === "failed" || s === "rejected" || s === "cancelled") return "failed";
  return "pending";
}

export function mapApiTx(t: ApiTx): Transaction {
  return {
    id: String(t.id),
    type: mapType(t.type),
    amount: Math.abs(t.amount) * FX_RATE,
    status: mapStatus(t.status),
    description: t.description ?? mapType(t.type).toUpperCase(),
    createdAt: t.createdAt,
  };
}
