/**
 * wallet.ts
 * ──────────────────────────────────────────────────────
 * Generates new TRON deposit wallets and stores them in
 * memory (a simple Map). Each entry holds the address,
 * encrypted private key, and a running USDT balance.
 * ──────────────────────────────────────────────────────
 */

import { generateTronAddress } from "../tron-address.js";

export interface DepositWallet {
  address: string;
  privateKey: string;
  balance: number;
}

const walletStore = new Map<string, DepositWallet>();

export function createWallet(): DepositWallet {
  const { address, privateKey } = generateTronAddress();

  const wallet: DepositWallet = {
    address,
    privateKey,
    balance: 0,
  };

  walletStore.set(address, wallet);

  console.log(`[wallet] New deposit wallet created: ${address}`);

  return wallet;
}

export function getWallet(address: string): DepositWallet | undefined {
  return walletStore.get(address);
}

export function getAllWallets(): DepositWallet[] {
  return [...walletStore.values()];
}

export function creditBalance(address: string, amount: number): void {
  const wallet = walletStore.get(address);
  if (!wallet) {
    console.warn(`[wallet] creditBalance: address not found — ${address}`);
    return;
  }
  wallet.balance += amount;
  walletStore.set(address, wallet);
}
