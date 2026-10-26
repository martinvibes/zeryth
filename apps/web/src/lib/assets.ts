/**
 * What a donor can give with. 1Click lists a hundred-odd assets; the picker leads with
 * the handful most people actually hold and keeps the rest one tap away.
 */

import { oneclick } from "@zeryth/core";

export type Token = oneclick.Token;

export const CHAIN_NAMES: Record<string, string> = {
  base: "Base",
  arb: "Arbitrum",
  eth: "Ethereum",
  op: "Optimism",
  pol: "Polygon",
  bsc: "BNB Chain",
  avax: "Avalanche",
  gnosis: "Gnosis",
  sol: "Solana",
  btc: "Bitcoin",
  tron: "Tron",
  near: "NEAR",
  doge: "Dogecoin",
  ltc: "Litecoin",
  xrp: "XRP Ledger",
  ton: "TON",
  sui: "Sui",
  stellar: "Stellar",
  aptos: "Aptos",
  cardano: "Cardano",
  bch: "Bitcoin Cash",
  starknet: "Starknet",
  monad: "Monad",
  bera: "Berachain",
  scroll: "Scroll",
};

export function chainName(blockchain: string): string {
  return CHAIN_NAMES[blockchain] ?? blockchain.charAt(0).toUpperCase() + blockchain.slice(1);
}

/** The first row of the picker, in order. */
export const FEATURED = [
  "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", // USDC on Base
  "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near", // USDC on Solana
  "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", // USDC on Arbitrum
  "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near", // USDT on Tron
  "nep141:eth.omft.near", // ETH
  "nep141:base.omft.near", // ETH on Base
  "nep141:sol.omft.near", // SOL
  "nep141:btc.omft.near", // BTC
];

/** Chains a donor can pay on straight from a browser wallet extension. */
export const EVM_CHAINS = new Set(["base", "arb", "eth", "op", "pol", "bsc", "avax", "gnosis"]);

export async function givable(): Promise<Token[]> {
  const all = await oneclick.tokens();
  return all.filter((t) => t.blockchain !== "zec" && t.price > 0);
}

export function label(t: Token): string {
  return `${t.symbol} on ${chainName(t.blockchain)}`;
}

/**
 * A payment link wallets understand, where the chain has one: EIP-681 for EVM chains,
 * Solana Pay, BIP-21. Anything else gets the bare address.
 */
export function paymentLink(t: Token, to: string, baseUnits: bigint, decimals = t.decimals, chainId?: number): string {
  const amount = formatUnitsPlain(baseUnits, decimals);
  if (EVM_CHAINS.has(t.blockchain) && chainId) {
    return t.contractAddress
      ? `ethereum:${t.contractAddress}@${chainId}/transfer?address=${to}&uint256=${baseUnits}`
      : `ethereum:${to}@${chainId}?value=${baseUnits}`;
  }
  if (t.blockchain === "sol") {
    return t.contractAddress ? `solana:${to}?amount=${amount}&spl-token=${t.contractAddress}` : `solana:${to}?amount=${amount}`;
  }
  if (t.blockchain === "btc") return `bitcoin:${to}?amount=${amount}`;
  if (t.blockchain === "ltc") return `litecoin:${to}?amount=${amount}`;
  if (t.blockchain === "doge") return `dogecoin:${to}?amount=${amount}`;
  return to;
}

export function formatUnitsPlain(v: bigint, decimals: number): string {
  const s = v.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export function parseUnitsPlain(text: string, decimals: number): bigint | null {
  const m = /^\s*(\d*)(?:\.(\d*))?\s*$/.exec(text);
  if (!m || (!m[1] && !m[2])) return null;
  const frac = m[2] ?? "";
  if (frac.length > decimals) return null;
  return BigInt(m[1] || "0") * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}
