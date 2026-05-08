export type WithdrawCurrency = "usdt" | "inr";
export type WithdrawSource = "main" | "profit";
export type WithdrawPayoutMethod = "upi" | "bank";

export interface WithdrawFlowState {
  currency: WithdrawCurrency;
  source: WithdrawSource;
  amount: string;
  walletAddress?: string;
  usePoints?: boolean;
  payoutMethod?: WithdrawPayoutMethod;
  upiId?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  pointsToSpend?: number;
  idempotencyKey: string;
}

export interface WithdrawSuccessPayload {
  currency: WithdrawCurrency;
  id: string;
  createdAt: string;
  // USDT
  source?: WithdrawSource;
  amount?: number;
  netAmount?: number;
  walletAddress?: string;
  // INR
  amountInr?: number;
  amountUsdt?: number;
  rateUsed?: number;
  payoutMethod?: WithdrawPayoutMethod;
  upiId?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
}

const SUCCESS_KEY = "qm:withdraw:success";

export function writeWithdrawSuccess(p: WithdrawSuccessPayload) {
  sessionStorage.setItem(SUCCESS_KEY, JSON.stringify(p));
}

export function readWithdrawSuccess(): WithdrawSuccessPayload | null {
  try {
    const raw = sessionStorage.getItem(SUCCESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WithdrawSuccessPayload;
  } catch {
    return null;
  }
}

export function clearWithdrawSuccess() {
  sessionStorage.removeItem(SUCCESS_KEY);
}

const KEY = "qm:withdraw:state";

export function newIdemKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `wd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readWithdrawState(): WithdrawFlowState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WithdrawFlowState;
  } catch {
    return null;
  }
}

export function writeWithdrawState(s: WithdrawFlowState) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function patchWithdrawState(patch: Partial<WithdrawFlowState>): WithdrawFlowState {
  const cur = readWithdrawState() ?? {
    currency: "usdt",
    source: "profit",
    amount: "",
    idempotencyKey: newIdemKey(),
  } as WithdrawFlowState;
  const next = { ...cur, ...patch };
  writeWithdrawState(next);
  return next;
}

export function clearWithdrawState() {
  sessionStorage.removeItem(KEY);
}
