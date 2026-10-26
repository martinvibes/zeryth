/**
 * The donor's side. Runs entirely in the donor's browser: nothing here talks to a
 * server of ours, because there is none.
 *
 *   1. read the group's round notice off the board
 *   2. make a one-time Ironwood key, born at the chain tip
 *   3. ask 1Click for a live quote that pays ZEC to that key's address
 *   4. drop the key on the board, encrypted to the round
 *   5. only then show the deposit address
 *
 * Step 4 before step 5 is the invariant: the group can always find a key that was paid.
 */

import { fetchNotice, publishDrop, type SignedNotice } from "./board";
import type { Engine, Key } from "./engine";
import * as oneclick from "./oneclick";

export interface Donation {
  notice: SignedNotice;
  key: Key;
  quote: oneclick.QuoteResponse;
  depositAddress: string;
  depositMemo?: string;
  dropId: string;
  relays: string[];
}

export async function startDonation(args: {
  engine: Engine;
  groupPubkey: string;
  originAsset: string;
  /** Base units of the origin asset. */
  amount: string;
  refundTo: string;
  onStep?: (step: "notice" | "key" | "quote" | "drop", detail?: string) => void;
}): Promise<Donation> {
  const step = args.onStep ?? (() => {});

  step("notice");
  const notice = await fetchNotice(args.groupPubkey);
  if (!notice) throw new Error("this group has not opened a round yet");

  step("key");
  const key = await args.engine.newKey();

  step("quote");
  const quote = await oneclick.quote({
    dry: false,
    originAsset: args.originAsset,
    amount: args.amount,
    recipient: key.address,
    refundTo: args.refundTo,
  });
  const depositAddress = quote.quote.depositAddress;
  if (!depositAddress) throw new Error("1Click returned a quote without a deposit address");

  step("drop");
  const { eventId, acks } = await publishDrop(notice.drop, {
    v: 1,
    k: key.secret,
    b: key.birthday,
    d: depositAddress,
    x: quote.quote.deadline,
    o: args.originAsset,
    i: args.amount,
    e: quote.quote.amountOut,
  });

  return {
    notice,
    key,
    quote,
    depositAddress,
    depositMemo: quote.quote.depositMemo,
    dropId: eventId,
    relays: acks,
  };
}

/** Polls the swap until it settles, reporting every status change. */
export async function followSwap(
  depositAddress: string,
  onStatus: (s: oneclick.StatusResponse) => void,
  opts: { intervalMs?: number; signal?: AbortSignal } = {},
): Promise<oneclick.StatusResponse> {
  let last = "";
  for (;;) {
    if (opts.signal?.aborted) throw new Error("stopped following the swap");
    try {
      const s = await oneclick.status(depositAddress);
      if (s.status !== last) {
        last = s.status;
        onStatus(s);
      }
      if (oneclick.isFinal(s.status)) return s;
    } catch {
      // A missed poll is not a failed swap; try again on the next tick.
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs ?? 5000));
  }
}
