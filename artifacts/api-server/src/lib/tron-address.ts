import { randomBytes, createHash } from "crypto";
import * as secp256k1 from "@noble/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3.js";
import bs58 from "bs58";

function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(data).digest());
}

function base58check(payload: Uint8Array): string {
  const checksum = sha256(sha256(payload)).slice(0, 4);
  const full = new Uint8Array(payload.length + 4);
  full.set(payload);
  full.set(checksum, payload.length);
  return bs58.encode(full);
}

export function generateTronAddress(): { address: string; privateKey: string } {
  const privKeyBytes = randomBytes(32);
  const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, false);
  const pubKeyNoPrefix = pubKeyBytes.slice(1);
  const addressBytes = keccak_256(pubKeyNoPrefix).slice(12);
  const payload = new Uint8Array(21);
  payload[0] = 0x41;
  payload.set(addressBytes, 1);
  const address = base58check(payload);
  const privateKey = Buffer.from(privKeyBytes).toString("hex");
  return { address, privateKey };
}

export function isValidTronAddress(address: string): boolean {
  try {
    const decoded = bs58.decode(address);
    if (decoded.length !== 25) return false;
    const payload = decoded.slice(0, 21);
    const checksum = decoded.slice(21);
    const expected = sha256(sha256(payload)).slice(0, 4);
    return checksum.every((b, i) => b === expected[i]);
  } catch {
    return false;
  }
}
