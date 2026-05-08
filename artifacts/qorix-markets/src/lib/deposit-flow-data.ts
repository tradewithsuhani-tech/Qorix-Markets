export type AgentBadge = "PREMIUM" | "VERIFIED" | "PRO" | null;

export type P2pAgent = {
  id: string;
  name: string;
  initial: string;
  avatarColor: string;
  badge: AgentBadge;
  rating: number;
  orderCount: number;
  responseTime: string;
  limitMin: number;
  limitMax: number;
  upiId: string;
  online: boolean;
};

export const P2P_AGENTS: P2pAgent[] = [
  { id: "rahul-k", name: "Rahul K.", initial: "R", avatarColor: "#10B981", badge: "PREMIUM", rating: 4.96, orderCount: 2847, responseTime: "20s", limitMin: 100, limitMax: 500000, upiId: "rahulk.trader@oksbi", online: true },
  { id: "priya-s", name: "Priya S.", initial: "P", avatarColor: "#14B8A6", badge: "VERIFIED", rating: 4.92, orderCount: 1923, responseTime: "30s", limitMin: 50, limitMax: 250000, upiId: "priyas.upi@axisbank", online: true },
  { id: "aman-t", name: "Aman T.", initial: "A", avatarColor: "#06B6D4", badge: "PRO", rating: 4.89, orderCount: 1456, responseTime: "45s", limitMin: 100, limitMax: 1000000, upiId: "amantrades@hdfcbank", online: true },
  { id: "sneha-r", name: "Sneha R.", initial: "S", avatarColor: "#3B82F6", badge: "VERIFIED", rating: 4.87, orderCount: 1102, responseTime: "1m", limitMin: 100, limitMax: 300000, upiId: "sneha.r@ybl", online: true },
  { id: "neha-j", name: "Neha J.", initial: "N", avatarColor: "#EC4899", badge: null, rating: 4.82, orderCount: 728, responseTime: "1m 30s", limitMin: 50, limitMax: 200000, upiId: "nehaj@paytm", online: true },
  { id: "rohit-p", name: "Rohit P.", initial: "R", avatarColor: "#06B6D4", badge: null, rating: 4.78, orderCount: 612, responseTime: "2m", limitMin: 100, limitMax: 150000, upiId: "rohitp.tx@icici", online: false },
  { id: "kavya-d", name: "Kavya D.", initial: "K", avatarColor: "#22C55E", badge: null, rating: 4.74, orderCount: 487, responseTime: "2m", limitMin: 100, limitMax: 100000, upiId: "kavyad@oksbi", online: false },
  { id: "vikram-m", name: "Vikram M.", initial: "V", avatarColor: "#14B8A6", badge: "VERIFIED", rating: 4.72, orderCount: 401, responseTime: "2m 30s", limitMin: 100, limitMax: 250000, upiId: "vikramm@hdfcbank", online: false },
];

export type BankAccountInfo = { accountHolder: string; accountNumber: string; ifsc: string; branch: string };
export type Bank = {
  id: string;
  name: string;
  shortName: string;
  initial: string;
  color: string;
  tagline: string;
  popular?: boolean;
  account: BankAccountInfo;
};

const HOLDER = "Qorix Markets Pvt Ltd";

export const BANKS: Bank[] = [
  { id: "hdfc", name: "HDFC Bank", shortName: "HDFC", initial: "H", color: "#004C8F", tagline: "Instant · Most popular", popular: true, account: { accountHolder: HOLDER, accountNumber: "50100 4823 916742", ifsc: "HDFC0000123", branch: "Mumbai · Bandra Kurla Complex" } },
  { id: "icici", name: "ICICI Bank", shortName: "ICICI", initial: "I", color: "#F58220", tagline: "Instant transfer", popular: true, account: { accountHolder: HOLDER, accountNumber: "0123 4567 8901", ifsc: "ICIC0001234", branch: "Mumbai · BKC Branch" } },
  { id: "sbi", name: "State Bank of India", shortName: "SBI", initial: "S", color: "#1F4E79", tagline: "Trusted · 24/7", popular: true, account: { accountHolder: HOLDER, accountNumber: "3012 3456 7892", ifsc: "SBIN0011234", branch: "Mumbai · Main Branch (Fort)" } },
  { id: "axis", name: "Axis Bank", shortName: "Axis", initial: "A", color: "#97144D", tagline: "Instant · Net Banking", popular: true, account: { accountHolder: HOLDER, accountNumber: "9120 1001 2345 678", ifsc: "UTIB0000234", branch: "Mumbai · Worli" } },
  { id: "kotak", name: "Kotak Mahindra Bank", shortName: "Kotak", initial: "K", color: "#ED1C24", tagline: "Net Banking", popular: true, account: { accountHolder: HOLDER, accountNumber: "1234 5678 9012", ifsc: "KKBK0000123", branch: "Mumbai · BKC" } },
  { id: "yes", name: "Yes Bank", shortName: "Yes", initial: "Y", color: "#0033A0", tagline: "Net Banking", account: { accountHolder: HOLDER, accountNumber: "0123 4567 8901", ifsc: "YESB0000123", branch: "Mumbai · Lower Parel" } },
  { id: "idfc", name: "IDFC FIRST Bank", shortName: "IDFC FIRST", initial: "ID", color: "#374151", tagline: "Net Banking", account: { accountHolder: HOLDER, accountNumber: "1001 2345 6782", ifsc: "IDFB0040123", branch: "Mumbai · BKC" } },
  { id: "pnb", name: "Punjab National Bank", shortName: "PNB", initial: "P", color: "#A02226", tagline: "Net Banking", account: { accountHolder: HOLDER, accountNumber: "0123 4567 8923", ifsc: "PUNB0123400", branch: "Mumbai · Fort" } },
  { id: "bob", name: "Bank of Baroda", shortName: "BoB", initial: "B", color: "#F37021", tagline: "Net Banking", account: { accountHolder: HOLDER, accountNumber: "1234 0100 1234 5", ifsc: "BARB0MUMBAI", branch: "Mumbai · Main Branch" } },
  { id: "indusind", name: "IndusInd Bank", shortName: "IndusInd", initial: "II", color: "#990033", tagline: "Net Banking", account: { accountHolder: HOLDER, accountNumber: "1001 2345 6789", ifsc: "INDB0000123", branch: "Mumbai · BKC" } },
  { id: "federal", name: "Federal Bank", shortName: "Federal", initial: "F", color: "#005AAB", tagline: "Net Banking", account: { accountHolder: HOLDER, accountNumber: "1234 0100 1234 56", ifsc: "FDRL0001234", branch: "Mumbai · BKC" } },
  { id: "rbl", name: "RBL Bank", shortName: "RBL", initial: "R", color: "#E2231A", tagline: "Net Banking", account: { accountHolder: HOLDER, accountNumber: "3090 1234 5678", ifsc: "RATN0000123", branch: "Mumbai · Lower Parel" } },
];

export type CryptoMethod = {
  id: string;
  symbol: string;
  label: string;
  sub: string;
  color: string;
  network: string;
  address: string;
  tag?: string;
};

export const CRYPTO_METHODS: CryptoMethod[] = [
  { id: "usdt", symbol: "₮", label: "USDT", sub: "Tether · TRC20", color: "#26A17B", network: "TRC20 (Tron)", address: "TRX7H8jL2nP9KqM3vB4cN5xY6zR1sT2dF3" },
  { id: "btc", symbol: "₿", label: "BTC", sub: "Bitcoin · On-chain", color: "#F7931A", network: "Bitcoin Mainnet", address: "bc1q9h7jl2np9kqm3vb4cn5xy6zr1st2df3a4b5c6" },
  { id: "eth", symbol: "Ξ", label: "ETH", sub: "Ethereum · ERC20", color: "#3B82F6", network: "Ethereum (ERC20)", address: "0x742d35Cc6634C0532925a3b8D4C9db96590c4C87" },
  { id: "sol", symbol: "◎", label: "SOL", sub: "Solana · SPL", color: "#22C55E", network: "Solana Mainnet", address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
  { id: "xrp", symbol: "✕", label: "XRP", sub: "Ripple · XRPL", color: "#00AAE4", network: "XRP Ledger", address: "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh", tag: "1284507" },
];

export const FX_RATE = 83.42;
