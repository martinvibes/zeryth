/**
 * The board: Nostr as a dead-drop for donation keys, with no server of ours anywhere.
 *
 * A group publishes a signed round notice naming the round's drop key. A donor's
 * browser encrypts its one-time donation key to that drop key (NIP-44 v2) and posts it
 * from a throwaway Nostr identity, with no `p` tag, under the board tag every Zeryth
 * group shares. Only the holder of the round's drop secret can tell which drops are
 * theirs, by trying to decrypt each one. When the round is burned, so is that secret,
 * and the drops on the relays become noise to everyone, the group included.
 */

import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type Event } from "nostr-tools/pure";
import { SimplePool } from "nostr-tools/pool";
import * as nip44 from "nostr-tools/nip44";
import * as nip19 from "nostr-tools/nip19";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { BOARD_TAG, DROP_KIND, LISTED_TAG, MIN_RELAY_ACKS, NOTICE_D_TAG, NOTICE_KIND, RELAYS } from "./config";

let sharedPool: SimplePool | null = null;
export function pool(): SimplePool {
  sharedPool ??= new SimplePool();
  return sharedPool;
}

export function closePool(relays = RELAYS): void {
  sharedPool?.close(relays);
  sharedPool = null;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export interface GroupIdentity {
  /** Hex secret key. The group's long-lived signing identity; it signs round notices. */
  secret: string;
  pubkey: string;
  npub: string;
}

export function newGroupIdentity(): GroupIdentity {
  return groupIdentityFromSecret(bytesToHex(generateSecretKey()));
}

export function groupIdentityFromSecret(secret: string): GroupIdentity {
  const pubkey = getPublicKey(hexToBytes(secret));
  return { secret, pubkey, npub: nip19.npubEncode(pubkey) };
}

export function npubFromPubkey(pubkey: string): string {
  return nip19.npubEncode(pubkey);
}

export function pubkeyFromNpub(npubOrHex: string): string {
  if (/^[0-9a-f]{64}$/.test(npubOrHex)) return npubOrHex;
  const decoded = nip19.decode(npubOrHex);
  if (decoded.type !== "npub") throw new Error("that is not an npub");
  return decoded.data;
}

/**
 * A round's two keys come out of one 32-byte round secret, so burning the round is
 * forgetting one value: the drop key that reads the board and the Zcash key that holds
 * the round's money.
 */
export interface RoundKeys {
  roundSecret: string;
  dropSecret: string;
  dropPubkey: string;
  /** base64url, the engine's secret format. */
  zcashSecret: string;
}

export function newRoundSecret(): string {
  return bytesToHex(randomBytes(32));
}

export function roundKeys(roundSecret: string): RoundKeys {
  const ikm = hexToBytes(roundSecret);
  const dropSecret = hkdf(sha256, ikm, undefined, utf8ToBytes("zeryth/round/nostr-drop"), 32);
  const zcash = hkdf(sha256, ikm, undefined, utf8ToBytes("zeryth/round/zcash-seed"), 32);
  return {
    roundSecret,
    dropSecret: bytesToHex(dropSecret),
    dropPubkey: getPublicKey(dropSecret),
    zcashSecret: base64url(zcash),
  };
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Round notices
// ---------------------------------------------------------------------------

export interface RoundNotice {
  v: 1;
  round: number;
  /** The key donors encrypt to this round. */
  drop: string;
  name: string;
  tagline: string;
  opened: number;
  /** The fund asked to appear in the give page's list. */
  listed?: boolean;
}

export interface SignedNotice extends RoundNotice {
  pubkey: string;
  eventId: string;
  createdAt: number;
}

export async function publishNotice(group: GroupIdentity, notice: RoundNotice, relays = RELAYS) {
  const event = finalizeEvent(
    {
      kind: NOTICE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: notice.listed ? [["d", NOTICE_D_TAG], ["t", LISTED_TAG]] : [["d", NOTICE_D_TAG]],
      content: JSON.stringify(notice),
    },
    hexToBytes(group.secret),
  );
  const acks = await publish(event, relays);
  return { event, acks };
}

/** The newest round notice the group signed, or `null` when there is none. */
export async function fetchNotice(groupPubkey: string, relays = RELAYS): Promise<SignedNotice | null> {
  const events = await pool().querySync(
    relays,
    { kinds: [NOTICE_KIND], authors: [groupPubkey], "#d": [NOTICE_D_TAG] },
    { maxWait: 4000 },
  );
  const newest = events
    .filter((e) => e.pubkey === groupPubkey && verifyEvent(e))
    .sort((a, b) => b.created_at - a.created_at)[0];
  if (!newest) return null;
  const body = JSON.parse(newest.content) as RoundNotice;
  if (body.v !== 1 || !/^[0-9a-f]{64}$/.test(body.drop)) throw new Error("the round notice is malformed");
  return { ...body, pubkey: newest.pubkey, eventId: newest.id, createdAt: newest.created_at };
}

/**
 * Every fund that chose to be listed, newest first. A fund that unlists re-signs its
 * notice without the tag, which replaces the listed one on each relay.
 */
export async function fetchListedFunds(relays = RELAYS): Promise<SignedNotice[]> {
  const events = await pool().querySync(relays, { kinds: [NOTICE_KIND], "#t": [LISTED_TAG], limit: 300 }, { maxWait: 5000 });
  const newest = new Map<string, Event>();
  for (const e of events) {
    if (!e.tags.some((t) => t[0] === "d" && t[1] === NOTICE_D_TAG)) continue;
    const seen = newest.get(e.pubkey);
    if ((!seen || seen.created_at < e.created_at) && verifyEvent(e)) newest.set(e.pubkey, e);
  }
  const funds: SignedNotice[] = [];
  for (const e of newest.values()) {
    try {
      const body = JSON.parse(e.content) as RoundNotice;
      if (body.v === 1 && body.listed && /^[0-9a-f]{64}$/.test(body.drop) && body.name) {
        funds.push({ ...body, pubkey: e.pubkey, eventId: e.id, createdAt: e.created_at });
      }
    } catch {
      // Someone else's malformed event under the same tag.
    }
  }
  return funds.sort((a, b) => b.createdAt - a.createdAt);
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

/** What a donor's browser hands the group. Short keys: it rides in every drop. */
export interface DropPayload {
  v: 1;
  /** The one-time key's secret, base64url. */
  k: string;
  /** Its birthday height. */
  b: number;
  /** The 1Click deposit address, so the collector can follow the swap. */
  d?: string;
  /** The quote's deadline, ISO. */
  x?: string;
  /** Origin asset id and the amount the donor sends, base units. */
  o?: string;
  i?: string;
  /** The ZEC the quote promised, zatoshi. */
  e?: string;
}

export interface Drop {
  eventId: string;
  createdAt: number;
  payload: DropPayload;
}

/**
 * Encrypts `payload` to the round's drop key from a throwaway identity and stores it on
 * the board. Resolves only once enough relays have it: a donor must never be shown a
 * deposit address for a key the group cannot find.
 */
export async function publishDrop(dropPubkey: string, payload: DropPayload, relays = RELAYS) {
  const ephemeral = generateSecretKey();
  const key = nip44.v2.utils.getConversationKey(ephemeral, dropPubkey);
  const event = finalizeEvent(
    {
      kind: DROP_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["t", BOARD_TAG]],
      content: nip44.v2.encrypt(JSON.stringify(payload), key),
    },
    ephemeral,
  );
  const acks = await publish(event, relays);
  if (acks.length < Math.min(MIN_RELAY_ACKS, relays.length)) {
    throw new Error(`only ${acks.length} relay(s) stored the drop; not safe to pay yet`);
  }
  return { eventId: event.id, acks };
}

/** Reads the board since `since` and keeps the drops this round's secret can open. */
export async function fetchDrops(dropSecret: string, since: number, relays = RELAYS): Promise<Drop[]> {
  const events = await pool().querySync(
    relays,
    { kinds: [DROP_KIND], "#t": [BOARD_TAG], since, limit: 2000 },
    { maxWait: 5000 },
  );
  const secret = hexToBytes(dropSecret);
  const seen = new Set<string>();
  const drops: Drop[] = [];
  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const payload = tryOpen(e, secret);
    if (payload) drops.push({ eventId: e.id, createdAt: e.created_at, payload });
  }
  return drops.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * The board as anyone sees it: the newest sealed drops from every Zeryth group, with
 * nothing to say whose they are. The landing page shows these, live.
 */
export async function fetchBoard(limit = 40, relays = RELAYS): Promise<{ id: string; createdAt: number; sealed: string }[]> {
  // Generous wait: the landing page compiles its 3D scene at the same moment, and a busy
  // main thread can let a short timer fire before the relays' answers are read.
  const events = await pool().querySync(relays, { kinds: [DROP_KIND], "#t": [BOARD_TAG], limit }, { maxWait: 8000 });
  const seen = new Set<string>();
  return events
    .filter((e) => !seen.has(e.id) && seen.add(e.id) && e.content.length <= 4096)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit)
    .map((e) => ({ id: e.id, createdAt: e.created_at, sealed: e.content }));
}

function tryOpen(event: Event, dropSecret: Uint8Array): DropPayload | null {
  if (event.content.length > 4096 || !verifyEvent(event)) return null;
  try {
    const key = nip44.v2.utils.getConversationKey(dropSecret, event.pubkey);
    const payload = JSON.parse(nip44.v2.decrypt(event.content, key)) as DropPayload;
    if (payload.v !== 1 || typeof payload.k !== "string" || typeof payload.b !== "number") return null;
    return payload;
  } catch {
    // Not ours. Almost every drop on the board is somebody else's.
    return null;
  }
}

async function publish(event: Event, relays: string[]): Promise<string[]> {
  const results = await Promise.allSettled(
    pool()
      .publish(relays, event)
      .map((p) => withTimeout(p, 6000)),
  );
  return relays.filter((_, i) => results[i].status === "fulfilled");
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("relay timed out")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
