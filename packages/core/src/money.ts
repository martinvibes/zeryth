/** Zatoshi arithmetic. Every amount is a bigint; nothing passes through a float. */

import { COIN, GRACE_ACTIONS, MARGINAL_FEE_ZAT } from "./config";

export function zec(zat: bigint | string, digits = 8): string {
  const v = BigInt(zat);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / COIN;
  const frac = (abs % COIN).toString().padStart(8, "0").slice(0, digits).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

export function parseZec(text: string): bigint {
  const m = /^\s*(\d+)(?:\.(\d{0,8}))?\s*$/.exec(text);
  if (!m) throw new Error(`${JSON.stringify(text)} is not a ZEC amount`);
  return BigInt(m[1]) * COIN + BigInt((m[2] ?? "").padEnd(8, "0"));
}

/**
 * The ZIP-317 fee for an Ironwood-only transaction. Ironwood pairs a spend with an
 * output in one action, so the count is the larger of the two.
 */
export function networkFee(spends: number, outputs: number): bigint {
  const actions = Math.max(spends, outputs, GRACE_ACTIONS);
  return MARGINAL_FEE_ZAT * BigInt(actions);
}

/**
 * The fee for spending `spends` notes to one transparent address and nothing else: the
 * claim-card cash-out, which pays a 1Click `t1` deposit address. Ironwood still pads to
 * two actions, and the transparent output is charged on top (crates/engine spend.rs).
 */
export function feeToTransparent(spends: number): bigint {
  const ironwood = Math.max(spends, GRACE_ACTIONS);
  return MARGINAL_FEE_ZAT * BigInt(ironwood + 1);
}

export interface PayoutPlan {
  /** Paid to the vault: a whole number of units, or 0. */
  toVault: bigint;
  /** Carried into the next round's key. */
  carried: bigint;
  fee: bigint;
}

/**
 * Splits a round's balance into a round-number payout and a carry.
 *
 * The vault only ever sees multiples of `unit`. A vault that saw each round's exact
 * total would hold a sum that NEAR's public swap amounts could be matched against.
 */
export function planPayout(total: bigint, spends: number, unit: bigint): PayoutPlan {
  const twoOutputs = networkFee(spends, 2);
  if (total <= twoOutputs) {
    return { toVault: 0n, carried: total - networkFee(spends, 1), fee: networkFee(spends, 1) };
  }
  let toVault = ((total - twoOutputs) / unit) * unit;
  // The carry output must hold something: a zero-value note is not an output the
  // engine will build. Give up one unit rather than drop the carry.
  if (toVault > 0n && total - twoOutputs - toVault === 0n) toVault -= unit;
  if (toVault === 0n) {
    const fee = networkFee(spends, 1);
    return { toVault: 0n, carried: total - fee, fee };
  }
  return { toVault, carried: total - twoOutputs - toVault, fee: twoOutputs };
}
