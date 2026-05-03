export type BankAccountInfo = {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
};

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

const HOLDER = "AutoTrade Markets Pvt Ltd";

export const BANKS: Bank[] = [
  {
    id: "hdfc",
    name: "HDFC Bank",
    shortName: "HDFC",
    initial: "H",
    color: "#004C8F",
    tagline: "Instant · Most popular",
    popular: true,
    account: {
      accountHolder: HOLDER,
      accountNumber: "50100 4823 916742",
      ifsc: "HDFC0000123",
      branch: "Mumbai · Bandra Kurla Complex",
    },
  },
  {
    id: "icici",
    name: "ICICI Bank",
    shortName: "ICICI",
    initial: "I",
    color: "#F58220",
    tagline: "Instant transfer",
    popular: true,
    account: {
      accountHolder: HOLDER,
      accountNumber: "0123 4567 8901",
      ifsc: "ICIC0001234",
      branch: "Mumbai · BKC Branch",
    },
  },
  {
    id: "sbi",
    name: "State Bank of India",
    shortName: "SBI",
    initial: "S",
    color: "#1F4E79",
    tagline: "Trusted · 24/7",
    popular: true,
    account: {
      accountHolder: HOLDER,
      accountNumber: "3012 3456 7892",
      ifsc: "SBIN0011234",
      branch: "Mumbai · Main Branch (Fort)",
    },
  },
  {
    id: "axis",
    name: "Axis Bank",
    shortName: "Axis",
    initial: "A",
    color: "#97144D",
    tagline: "Instant · Net Banking",
    popular: true,
    account: {
      accountHolder: HOLDER,
      accountNumber: "9120 1001 2345 678",
      ifsc: "UTIB0000234",
      branch: "Mumbai · Worli",
    },
  },
  {
    id: "kotak",
    name: "Kotak Mahindra Bank",
    shortName: "Kotak",
    initial: "K",
    color: "#ED1C24",
    tagline: "Net Banking",
    popular: true,
    account: {
      accountHolder: HOLDER,
      accountNumber: "1234 5678 9012",
      ifsc: "KKBK0000123",
      branch: "Mumbai · BKC",
    },
  },
  {
    id: "yes",
    name: "Yes Bank",
    shortName: "Yes",
    initial: "Y",
    color: "#0033A0",
    tagline: "Net Banking",
    account: {
      accountHolder: HOLDER,
      accountNumber: "0123 4567 8901",
      ifsc: "YESB0000123",
      branch: "Mumbai · Lower Parel",
    },
  },
  {
    id: "idfc",
    name: "IDFC FIRST Bank",
    shortName: "IDFC FIRST",
    initial: "ID",
    color: "#5C2D91",
    tagline: "Net Banking",
    account: {
      accountHolder: HOLDER,
      accountNumber: "1001 2345 6782",
      ifsc: "IDFB0040123",
      branch: "Mumbai · BKC",
    },
  },
  {
    id: "pnb",
    name: "Punjab National Bank",
    shortName: "PNB",
    initial: "P",
    color: "#A02226",
    tagline: "Net Banking",
    account: {
      accountHolder: HOLDER,
      accountNumber: "0123 4567 8923",
      ifsc: "PUNB0123400",
      branch: "Mumbai · Fort",
    },
  },
  {
    id: "bob",
    name: "Bank of Baroda",
    shortName: "BoB",
    initial: "B",
    color: "#F37021",
    tagline: "Net Banking",
    account: {
      accountHolder: HOLDER,
      accountNumber: "1234 0100 1234 5",
      ifsc: "BARB0MUMBAI",
      branch: "Mumbai · Main Branch",
    },
  },
  {
    id: "indusind",
    name: "IndusInd Bank",
    shortName: "IndusInd",
    initial: "II",
    color: "#990033",
    tagline: "Net Banking",
    account: {
      accountHolder: HOLDER,
      accountNumber: "1001 2345 6789",
      ifsc: "INDB0000123",
      branch: "Mumbai · BKC",
    },
  },
  {
    id: "federal",
    name: "Federal Bank",
    shortName: "Federal",
    initial: "F",
    color: "#005AAB",
    tagline: "Net Banking",
    account: {
      accountHolder: HOLDER,
      accountNumber: "1234 0100 1234 56",
      ifsc: "FDRL0001234",
      branch: "Mumbai · BKC",
    },
  },
  {
    id: "rbl",
    name: "RBL Bank",
    shortName: "RBL",
    initial: "R",
    color: "#E2231A",
    tagline: "Net Banking",
    account: {
      accountHolder: HOLDER,
      accountNumber: "3090 1234 5678",
      ifsc: "RATN0000123",
      branch: "Mumbai · Lower Parel",
    },
  },
];
