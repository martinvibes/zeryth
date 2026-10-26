/**
 * The donation handshake against the real world, with no money moving: a group opens a
 * round on real relays, a donor gets a live 1Click quote to a fresh one-time key and
 * drops it, and the collector finds and opens the drop. The quote simply expires.
 */
import {
  closePool, fetchNotice, newGroupIdentity, newVault, raidView, readBoard, rotate, startDonation, track,
} from "@zeryth/core";
import { nodeEngine } from "./node-engine";

const BASE_USDC = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const engine = nodeEngine();
const vaultKey = await engine.newKey();
const state = newVault({
  group: newGroupIdentity(),
  name: "Test Coalition",
  tagline: "e2e",
  vaultAddress: vaultKey.address,
});
log("group", state.group.npub);

const round = await rotate(state, engine);
log("round", round.index, "open; drop key", round.dropPubkey.slice(0, 16), "round address", round.address.slice(0, 24) + "…");

const notice = await fetchNotice(state.group.pubkey);
log("donor reads notice:", notice?.round, notice?.name, notice?.drop === round.dropPubkey ? "drop key matches" : "MISMATCH");

const donation = await startDonation({
  engine,
  groupPubkey: state.group.pubkey,
  originAsset: BASE_USDC,
  amount: "5000000",
  refundTo: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  onStep: (s) => log("donor step:", s),
});
log("deposit address", donation.depositAddress, "expects", donation.quote.quote.amountOutFormatted, "ZEC; drop stored on", donation.relays.join(" "));

await new Promise((r) => setTimeout(r, 1500));
const added = await readBoard(state);
log("collector found", added.length, "drop(s);", added[0]?.secret === donation.key.secret ? "key decrypts and matches" : "NO MATCH");

await track(state, engine);
log("donation status:", state.rounds[0].donations.map((d) => d.status));
log("raid view:", JSON.stringify(raidView(state)));
closePool();
process.exit(added.length === 1 && added[0].secret === donation.key.secret ? 0 : 1);
