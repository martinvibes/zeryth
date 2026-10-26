/**
 * Claim cards: money out, with no recipient list.
 *
 * A batch is one funding key and N card keys. The group pays the funding key once from
 * its vault wallet (a single ZIP-321 QR any Zcash wallet scans), then one transaction
 * fans it out to every card at once. Each card is a link carrying its own key in the
 * URL fragment; whoever holds the card holds the money, and the group never learns who
 * that was or where it went next.
 */

import type { Engine, Key, Stage } from "./engine";
import { networkFee } from "./money";

export type CardStatus = "unfunded" | "funded" | "claimed";

export interface Card extends Key {
  zat: string;
  status: CardStatus;
}

export interface Batch {
  id: string;
  createdAt: number;
  label: string;
  /** The funding key the vault pays. */
  funding: Key;
  cards: Card[];
  status: "awaiting-funds" | "funded" | "issued";
  fanoutTxid?: string;
}

/**
 * What the vault must send the funding key: every card's value plus the fan-out fee.
 * The last card is the fan-out's destination and absorbs any rounding, so nothing is
 * left behind on the funding key.
 */
export function fundingAmount(cards: number, perCardZat: bigint): bigint {
  return perCardZat * BigInt(cards) + networkFee(1, cards);
}

export async function newBatch(engine: Engine, label: string, cards: number, perCardZat: bigint): Promise<Batch> {
  if (cards < 1 || cards > 50) throw new Error("a batch holds between 1 and 50 cards");
  const funding = await engine.newKey();
  const keys = Array.from({ length: cards }, () =>
    engine.keyFromSecret(engine.wasm.generate_secret(), funding.birthday),
  );
  return {
    id: funding.address.slice(-10),
    createdAt: Math.floor(Date.now() / 1000),
    label,
    funding,
    cards: keys.map((k) => ({ ...k, zat: perCardZat.toString(), status: "unfunded" })),
    status: "awaiting-funds",
  };
}

/** The QR the group scans with its vault wallet. */
export function fundingUri(engine: Engine, batch: Batch): string {
  const per = BigInt(batch.cards[0].zat);
  return engine.paymentUri(batch.funding.address, fundingAmount(batch.cards.length, per), `Zeryth cards: ${batch.label}`);
}

/** Checks the funding key; once paid, fans it out to every card in one transaction. */
export async function issue(engine: Engine, batch: Batch, onStage?: Stage): Promise<string | null> {
  const opened = await engine.open(batch.funding);
  const notes = opened.notes.filter((n) => !n.spent);
  if (notes.length === 0) return null;
  batch.status = "funded";

  const [last, ...rest] = [...batch.cards].reverse();
  const outcome = await engine.sweep({
    key: batch.funding,
    notes,
    to: last.address,
    fixed: rest.reverse().map((c) => ({ address: c.address, zat: BigInt(c.zat) })),
    broadcast: true,
    onStage,
  });
  batch.status = "issued";
  batch.fanoutTxid = outcome.txid;
  for (const c of batch.cards) c.status = "funded";
  last.zat = outcome.amount_to_destination_zat;
  return outcome.txid;
}

export function cardLink(engine: Engine, origin: string, card: Key): string {
  return `${origin}/#/claim/${engine.fragment(card)}`;
}
