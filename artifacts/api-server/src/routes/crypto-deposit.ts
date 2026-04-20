/**
 * crypto-deposit.ts
 * ──────────────────────────────────────────────────────
 * Public API routes for the TRON USDT deposit system.
 *
 *   POST /create-wallet         → generate a fresh deposit wallet
 *   GET  /balance/:address      → return in-memory USDT balance
 * ──────────────────────────────────────────────────────
 */

import { Router } from "express";
import { createWallet, getWallet } from "../lib/crypto-deposit/wallet.js";

const router = Router();

router.post("/create-wallet", (_req, res) => {
  const wallet = createWallet();

  res.json({
    address: wallet.address,
    balance: wallet.balance,
    message: "Send USDT (TRC20) to this address. Deposits are detected within 15 seconds.",
  });
});

router.get("/balance/:address", (req, res) => {
  const { address } = req.params;

  if (!address) {
    res.status(400).json({ error: "Address is required" });
    return;
  }

  const wallet = getWallet(address);

  if (!wallet) {
    res.status(404).json({ error: "Wallet not found. Create one with POST /create-wallet" });
    return;
  }

  res.json({
    address: wallet.address,
    balance: wallet.balance,
  });
});

export default router;
