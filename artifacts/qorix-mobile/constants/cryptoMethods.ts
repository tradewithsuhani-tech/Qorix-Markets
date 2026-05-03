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
  {
    id: "usdt",
    symbol: "₮",
    label: "USDT",
    sub: "Tether · TRC20 / ERC20",
    color: "#26A17B",
    network: "TRC20 (Tron)",
    address: "TRX7H8jL2nP9KqM3vB4cN5xY6zR1sT2dF3",
  },
  {
    id: "btc",
    symbol: "₿",
    label: "BTC",
    sub: "Bitcoin · On-chain",
    color: "#F7931A",
    network: "Bitcoin Mainnet",
    address: "bc1q9h7jl2np9kqm3vb4cn5xy6zr1st2df3a4b5c6",
  },
  {
    id: "eth",
    symbol: "Ξ",
    label: "ETH",
    sub: "Ethereum · ERC20",
    color: "#627EEA",
    network: "Ethereum (ERC20)",
    address: "0x742d35Cc6634C0532925a3b8D4C9db96590c4C87",
  },
  {
    id: "sol",
    symbol: "◎",
    label: "SOL",
    sub: "Solana · SPL",
    color: "#9945FF",
    network: "Solana Mainnet",
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  },
  {
    id: "xrp",
    symbol: "✕",
    label: "XRP",
    sub: "Ripple · XRPL",
    color: "#00AAE4",
    network: "XRP Ledger",
    address: "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh",
    tag: "1284507",
  },
];

export const FX_RATE = 83.42;
