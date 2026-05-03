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
  {
    id: "rahul-k",
    name: "Rahul K.",
    initial: "R",
    avatarColor: "#6366F1",
    badge: "PREMIUM",
    rating: 4.96,
    orderCount: 2847,
    responseTime: "20s",
    limitMin: 100,
    limitMax: 500000,
    upiId: "rahulk.trader@oksbi",
    online: true,
  },
  {
    id: "priya-s",
    name: "Priya S.",
    initial: "P",
    avatarColor: "#A855F7",
    badge: "VERIFIED",
    rating: 4.92,
    orderCount: 1923,
    responseTime: "30s",
    limitMin: 50,
    limitMax: 250000,
    upiId: "priyas.upi@axisbank",
    online: true,
  },
  {
    id: "aman-t",
    name: "Aman T.",
    initial: "A",
    avatarColor: "#10B981",
    badge: "PRO",
    rating: 4.89,
    orderCount: 1456,
    responseTime: "45s",
    limitMin: 100,
    limitMax: 1000000,
    upiId: "amantrades@hdfcbank",
    online: true,
  },
  {
    id: "sneha-r",
    name: "Sneha R.",
    initial: "S",
    avatarColor: "#3B82F6",
    badge: "VERIFIED",
    rating: 4.87,
    orderCount: 1102,
    responseTime: "1m",
    limitMin: 100,
    limitMax: 300000,
    upiId: "sneha.r@ybl",
    online: true,
  },
  {
    id: "neha-j",
    name: "Neha J.",
    initial: "N",
    avatarColor: "#EC4899",
    badge: null,
    rating: 4.82,
    orderCount: 728,
    responseTime: "1m 30s",
    limitMin: 50,
    limitMax: 200000,
    upiId: "nehaj@paytm",
    online: true,
  },
  {
    id: "rohit-p",
    name: "Rohit P.",
    initial: "R",
    avatarColor: "#06B6D4",
    badge: null,
    rating: 4.78,
    orderCount: 612,
    responseTime: "2m",
    limitMin: 100,
    limitMax: 150000,
    upiId: "rohitp.tx@icici",
    online: false,
  },
  {
    id: "kavya-d",
    name: "Kavya D.",
    initial: "K",
    avatarColor: "#22C55E",
    badge: null,
    rating: 4.74,
    orderCount: 487,
    responseTime: "2m",
    limitMin: 100,
    limitMax: 100000,
    upiId: "kavyad@oksbi",
    online: false,
  },
  {
    id: "vikram-m",
    name: "Vikram M.",
    initial: "V",
    avatarColor: "#8B5CF6",
    badge: "VERIFIED",
    rating: 4.72,
    orderCount: 401,
    responseTime: "2m 30s",
    limitMin: 100,
    limitMax: 250000,
    upiId: "vikramm@hdfcbank",
    online: false,
  },
];
