/**
 * Typed wrappers over the wasm engine (crates/engine). The engine module is handed in
 * already initialised, so the same code runs in a browser worker and under Node.
 */

import type * as Wasm from "@zeryth/zeryth-engine";
import { LIGHTWALLETD, NETWORK } from "./config";

export type EngineModule = typeof Wasm;

export interface Note {
  txid: string;
  height: number;
  action_index: number;
  amount_zat: string;
  memo: string | null;
  pool: string;
  spent: boolean;
  spent_txid: string | null;
  spent_height: number | null;
  spent_time: number | null;
}

export interface Opened {
  found: boolean;
  all_spent: boolean;
  notes: Note[];
  /** Unspent total, zatoshi. */
  total_zat: string;
  spent_zat: string;
  tip_height: number;
  birthday: number;
  scanned_blocks: number;
  gateway: string;
}

export interface Swept {
  txid: string;
  broadcast: boolean;
  amount_to_destination_zat: string;
  fee_zat: string;
  network_fee_zat: string;
  anchor_height: number;
  raw_tx_hex: string | null;
  gateway: string;
  error_code: number | null;
  error_message: string | null;
}

export interface Key {
  secret: string;
  birthday: number;
  address: string;
}

export type Progress = (scanned: number, total: number, info?: unknown) => void;
export type Stage = (stage: string, detail: string) => void;

export class Engine {
  constructor(readonly wasm: EngineModule, readonly lightwalletd = LIGHTWALLETD) {}

  async tip(): Promise<number> {
    return (await this.wasm.chain_tip(this.lightwalletd)) as number;
  }

  /** A fresh one-time key, born at the current tip. */
  async newKey(): Promise<Key> {
    const birthday = await this.tip();
    return this.keyFromSecret(this.wasm.generate_secret(), birthday);
  }

  keyFromSecret(secret: string, birthday: number): Key {
    const derived = this.wasm.derive(secret, NETWORK);
    const address = derived.address;
    derived.free();
    return { secret, birthday, address };
  }

  async open(key: Pick<Key, "secret" | "birthday">, onProgress?: Progress): Promise<Opened> {
    return (await this.wasm.open_envelope(
      key.secret,
      key.birthday,
      NETWORK,
      this.lightwalletd,
      onProgress ?? null,
    )) as Opened;
  }

  /**
   * Spends every unspent note the key holds in one transaction.
   *
   * `fixed` outputs are each paid exactly their amount; `to` takes whatever is left after
   * them and the network fee. A round payout is `fixed = [vault, round number]`,
   * `to = next round`; a card batch is one fixed output per card.
   */
  async sweep(args: {
    key: Pick<Key, "secret">;
    notes: Note[];
    to: string;
    fixed?: { address: string; zat: bigint }[];
    memo?: string;
    broadcast: boolean;
    onStage?: Stage;
  }): Promise<Swept> {
    const unspent = args.notes.filter((n) => !n.spent);
    if (unspent.length === 0) throw new Error("nothing unspent to sweep");
    const [first, ...rest] = args.fixed ?? [];
    const outcome = (await this.wasm.sweep_envelope(
      args.key.secret,
      NETWORK,
      this.lightwalletd,
      unspent.map((n) => ({ txid: n.txid, height: n.height, action_index: n.action_index })),
      args.to,
      first?.address ?? "",
      (first?.zat ?? 0n).toString(),
      rest.map((s) => ({ address: s.address, zat: s.zat.toString() })),
      args.memo ?? null,
      args.broadcast,
      args.onStage ?? null,
    )) as Swept;
    if (outcome.broadcast && outcome.error_code !== null && outcome.error_code !== 0) {
      throw new Error(`the network refused the transaction: ${outcome.error_message ?? outcome.error_code}`);
    }
    return outcome;
  }

  paymentUri(address: string, zat: bigint, memo?: string): string {
    return this.wasm.payment_uri(address, zat.toString(), memo ?? null);
  }

  fragment(key: Pick<Key, "secret" | "birthday">): string {
    return this.wasm.build_fragment(key.secret, key.birthday);
  }

  parseFragment(fragment: string): { secret: string; birthday: number | undefined } {
    const parsed = this.wasm.parse_fragment(fragment);
    const out = { secret: parsed.secret, birthday: parsed.birthday ?? undefined };
    parsed.free();
    return out;
  }

  /** Warms the halo2 proving key so the first sweep does not pay for building it. */
  warm(): Promise<unknown> {
    return this.wasm.warm_proving_key();
  }
}
