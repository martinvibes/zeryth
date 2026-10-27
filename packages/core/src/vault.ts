/**
 * The group's side: the collector, run from the group's own browser.
 *
 * State is one JSON-serialisable object. Every function takes it, changes it in place
 * and leaves persisting it to the caller, so the same logic runs behind the vault room
 * UI and the Node end-to-end script.
 *
 * The life of a round:
 *
 *   open ──close──> closing ──every donation settled──> payout ──> burned
 *
 * - **open**: its drop key is the one in the group's notice; donors are paying into it.
 * - **closing**: a newer round has replaced it in the notice, but gifts already paid for
 *   can still land. A quote nobody has paid can stay valid for days, so it doesn't hold
 *   the round up: at payout its key moves to the open round.
 * - **payout**: one transaction sends a round number of ZEC to the vault and carries the
 *   rest into the open round's key.
 * - **burned**: the round secret and every donation key it collected are deleted. The
 *   drops on the relays can no longer be read by anyone, and nothing the group holds
 *   ties the vault's money to a NEAR swap.
 */

import {
  fetchDrops,
  newRoundSecret,
  publishNotice,
  roundKeys,
  type Drop,
  type GroupIdentity,
} from "./board";
import { DEFAULT_PAYOUT_UNIT_ZAT } from "./config";
import type { Engine, Note, Stage } from "./engine";
import { planPayout } from "./money";
import * as oneclick from "./oneclick";

export type DonationStatus =
  | "awaiting" // quote issued, nothing deposited yet
  | "swapping" // 1Click has the deposit
  | "arrived" // ZEC is at the one-time key
  | "swept" // moved into the round key
  | "refunded"
  | "expired"
  | "failed";

export interface DonationRecord {
  dropId: string;
  seenAt: number;
  secret: string;
  birthday: number;
  address: string;
  depositAddress?: string;
  deadline?: string;
  originAsset?: string;
  amountIn?: string;
  expectedZat?: string;
  status: DonationStatus;
  arrivedZat?: string;
  sweepTxid?: string;
  error?: string;
}

export type RoundStatus = "open" | "closing" | "paid";

export interface Round {
  index: number;
  secret: string;
  dropPubkey: string;
  zcashSecret: string;
  address: string;
  birthday: number;
  openedAt: number;
  closedAt?: number;
  status: RoundStatus;
  donations: DonationRecord[];
  payout?: { txid: string; toVaultZat: string; carriedZat: string; at: number };
}

/** All that survives a burn: no key, no address, no amount per donor. */
export interface BurnRecord {
  index: number;
  openedAt: number;
  closedAt: number;
  burnedAt: number;
  donations: number;
  payoutTxid?: string;
  toVaultZat?: string;
}

export interface VaultState {
  v: 1;
  group: GroupIdentity;
  name: string;
  tagline: string;
  /** The group's long-term wallet (Zodl, Zingo, …). Zeryth only ever pays into it. */
  vaultAddress: string;
  unitZat: string;
  rounds: Round[];
  burned: BurnRecord[];
}

const now = () => Math.floor(Date.now() / 1000);

export function newVault(args: {
  group: GroupIdentity;
  name: string;
  tagline: string;
  vaultAddress: string;
  unitZat?: bigint;
}): VaultState {
  return {
    v: 1,
    group: args.group,
    name: args.name,
    tagline: args.tagline,
    vaultAddress: args.vaultAddress,
    unitZat: (args.unitZat ?? DEFAULT_PAYOUT_UNIT_ZAT).toString(),
    rounds: [],
    burned: [],
  };
}

export function openRound(state: VaultState): Round | undefined {
  return state.rounds.find((r) => r.status === "open");
}

/**
 * Opens a fresh round and points the group's notice at it. Any round that was open is
 * moved to closing: it stops taking new donors but keeps collecting the ones in flight.
 */
export async function rotate(state: VaultState, engine: Engine): Promise<Round> {
  const keys = roundKeys(newRoundSecret());
  const birthday = await engine.tip();
  const address = engine.keyFromSecret(keys.zcashSecret, birthday).address;
  const index = Math.max(0, ...state.rounds.map((r) => r.index), ...state.burned.map((b) => b.index)) + 1;
  const round: Round = {
    index,
    secret: keys.roundSecret,
    dropPubkey: keys.dropPubkey,
    zcashSecret: keys.zcashSecret,
    address,
    birthday,
    openedAt: now(),
    status: "open",
    donations: [],
  };

  const { acks } = await publishNotice(state.group, {
    v: 1,
    round: index,
    drop: keys.dropPubkey,
    name: state.name,
    tagline: state.tagline,
    opened: round.openedAt,
  });
  if (acks.length === 0) throw new Error("no relay accepted the round notice");

  for (const r of state.rounds) {
    if (r.status === "open") {
      r.status = "closing";
      r.closedAt = round.openedAt;
    }
  }
  state.rounds.push(round);
  return round;
}

/** Reads the board for every live round and adds the drops it has not seen. */
export async function readBoard(state: VaultState): Promise<DonationRecord[]> {
  const added: DonationRecord[] = [];
  for (const round of state.rounds) {
    if (round.status === "paid") continue;
    const keys = roundKeys(round.secret);
    // A little slack before the round opened: clocks disagree.
    const drops: Drop[] = await fetchDrops(keys.dropSecret, round.openedAt - 600);
    for (const drop of drops) {
      // A drop can sit in a later round: payout moves unpaid quotes forward.
      if (state.rounds.some((r) => r.donations.some((d) => d.dropId === drop.eventId))) continue;
      const p = drop.payload;
      const record: DonationRecord = {
        dropId: drop.eventId,
        seenAt: drop.createdAt,
        secret: p.k,
        birthday: p.b,
        address: "",
        depositAddress: p.d,
        deadline: p.x,
        originAsset: p.o,
        amountIn: p.i,
        expectedZat: p.e,
        status: "awaiting",
      };
      round.donations.push(record);
      added.push(record);
    }
  }
  return added;
}

/**
 * Brings every unsettled donation up to date: what 1Click says about the swap, and
 * what the chain says about the one-time key.
 */
export async function track(state: VaultState, engine: Engine): Promise<void> {
  for (const round of state.rounds) {
    if (round.status === "paid") continue;
    for (const d of round.donations) {
      if (d.status === "swept" || d.status === "refunded" || d.status === "failed") continue;
      if (!d.address) d.address = engine.keyFromSecret(d.secret, d.birthday).address;

      if (d.depositAddress && d.status !== "arrived") {
        try {
          const s = await oneclick.status(d.depositAddress);
          if (s.status === "REFUNDED") d.status = "refunded";
          else if (s.status === "FAILED") d.status = "failed";
          else if (s.status === "PROCESSING" || s.status === "KNOWN_DEPOSIT_TX") d.status = "swapping";
          else if (s.status === "PENDING_DEPOSIT" && d.deadline && Date.parse(d.deadline) < Date.now()) {
            d.status = "expired";
          }
          if (s.status !== "SUCCESS") continue;
        } catch (e) {
          d.error = String(e);
        }
      }

      const opened = await engine.open(d);
      if (opened.all_spent) {
        d.status = "swept";
      } else if (BigInt(opened.total_zat) > 0n) {
        d.status = "arrived";
        d.arrivedZat = opened.total_zat;
      }
    }
  }
}

/** Moves one arrived donation into its round's key. */
export async function sweepDonation(
  round: Round,
  d: DonationRecord,
  engine: Engine,
  onStage?: Stage,
): Promise<string> {
  const opened = await engine.open(d);
  const notes: Note[] = opened.notes.filter((n) => !n.spent);
  if (notes.length === 0) {
    d.status = opened.all_spent ? "swept" : d.status;
    throw new Error("this donation key holds nothing to sweep");
  }
  const outcome = await engine.sweep({ key: d, notes, to: round.address, broadcast: true, onStage });
  d.status = "swept";
  d.sweepTxid = outcome.txid;
  return outcome.txid;
}

/**
 * True when no gift is mid-swap or waiting to be collected. Quotes nobody has paid don't
 * count: payout moves them to the open round.
 */
export function settled(round: Round): boolean {
  return round.donations.every((d) => ["awaiting", "swept", "refunded", "expired", "failed"].includes(d.status));
}

/**
 * Pays a closing round out: a round number to the vault, the rest into the open round.
 * With nothing worth a unit, everything is carried. With nothing at all, there is no
 * transaction and the round is simply marked paid.
 */
export async function payout(
  state: VaultState,
  round: Round,
  engine: Engine,
  onStage?: Stage,
): Promise<Round["payout"]> {
  const next = openRound(state);
  if (!next || next === round) throw new Error("open a new round first: the carry needs somewhere to go");

  // The open round keeps the keys of quotes nobody has paid yet, so a late payment is
  // still collected after this round burns.
  next.donations.push(...round.donations.filter((d) => d.status === "awaiting"));
  round.donations = round.donations.filter((d) => d.status !== "awaiting");

  const opened = await engine.open({ secret: round.zcashSecret, birthday: round.birthday });
  const notes = opened.notes.filter((n) => !n.spent);
  const total = BigInt(opened.total_zat);
  if (notes.length === 0 || total === 0n) {
    round.status = "paid";
    round.payout = { txid: "", toVaultZat: "0", carriedZat: "0", at: now() };
    return round.payout;
  }

  const plan = planPayout(total, notes.length, BigInt(state.unitZat));
  const outcome = await engine.sweep({
    key: { secret: round.zcashSecret },
    notes,
    to: next.address,
    fixed: plan.toVault > 0n ? [{ address: state.vaultAddress, zat: plan.toVault }] : [],
    broadcast: true,
    onStage,
  });
  round.status = "paid";
  round.payout = {
    txid: outcome.txid,
    toVaultZat: plan.toVault.toString(),
    carriedZat: outcome.amount_to_destination_zat,
    at: now(),
  };
  return round.payout;
}

/**
 * Forgets a paid round. What is left is a count and a payout: nothing that opens a
 * drop, derives an address or names an amount any donor sent.
 */
export function burn(state: VaultState, round: Round): BurnRecord {
  if (round.status !== "paid") throw new Error("only a paid round can be burned");
  const record: BurnRecord = {
    index: round.index,
    openedAt: round.openedAt,
    closedAt: round.closedAt ?? now(),
    burnedAt: now(),
    donations: round.donations.filter((d) => d.status === "swept").length,
    payoutTxid: round.payout?.txid || undefined,
    toVaultZat: round.payout?.toVaultZat,
  };
  // Overwrite before dropping the reference, so a stale copy of this object (an undo
  // stack, a devtools snapshot) does not keep the secrets either.
  round.secret = round.zcashSecret = "";
  for (const d of round.donations) d.secret = "";
  state.rounds = state.rounds.filter((r) => r !== round);
  state.burned.push(record);
  return record;
}

/**
 * What a raid finds: every secret the group's device holds right now, laid out the way
 * an adversary who copied the storage would see it.
 */
export function raidView(state: VaultState) {
  return {
    groupIdentity: state.group.npub,
    vaultAddress: state.vaultAddress,
    liveRounds: state.rounds.map((r) => ({
      round: r.index,
      status: r.status,
      donationKeysHeld: r.donations.filter((d) => d.secret).length,
    })),
    burnedRounds: state.burned.map((b) => ({
      round: b.index,
      donations: b.donations,
      keysHeld: 0,
      canOpenDrops: false,
    })),
  };
}
