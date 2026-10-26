/**
 * Drives a real Zeryth group from the terminal, against mainnet, with real money.
 * State (including secrets: this is money) lives in .zeryth/state.json, gitignored.
 *
 *   npx tsx scripts/live.ts init [vault-ua]      new group; no vault given = a fresh vault key
 *   npx tsx scripts/live.ts donate <asset> <amount-base-units> <refund-to>
 *   npx tsx scripts/live.ts collect              read the board, track swaps, sweep arrivals
 *   npx tsx scripts/live.ts rotate               open a new round; the old one starts closing
 *   npx tsx scripts/live.ts payout [--force]     pay settled closing rounds to the vault, then burn
 *   npx tsx scripts/live.ts vault                what the vault key holds (only for a generated vault)
 *   npx tsx scripts/live.ts raid                 what a raid on this device finds
 *   npx tsx scripts/live.ts status
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  burn, closePool, newGroupIdentity, newVault, openRound, payout, raidView, readBoard, rotate,
  settled, startDonation, sweepDonation, track, zec, type Key, type VaultState,
} from "@zeryth/core";
import { nodeEngine } from "./node-engine";

const DIR = new URL("../.zeryth/", import.meta.url);
const STATE = new URL("state.json", DIR);
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const stage = (s: string, d: string) => log(`  ${s}: ${d}`);

interface Saved { state: VaultState; vaultKey?: Key; donorKeys: Key[] }
const load = (): Saved => JSON.parse(readFileSync(STATE, "utf8"));
const save = (s: Saved) => writeFileSync(STATE, JSON.stringify(s, null, 2));

const engine = nodeEngine();
const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "init": {
    if (existsSync(STATE)) throw new Error(".zeryth/state.json exists; move it aside first");
    mkdirSync(DIR, { recursive: true });
    const vaultKey = args[0] ? undefined : await engine.newKey();
    const state = newVault({
      group: newGroupIdentity(),
      name: "Zeryth Test Fund",
      tagline: "the fund they can't freeze",
      vaultAddress: args[0] ?? vaultKey!.address,
    });
    const round = await rotate(state, engine);
    save({ state, vaultKey, donorKeys: [] });
    log("group", state.group.npub);
    log("vault", state.vaultAddress);
    log("round", round.index, "open at", round.address);
    break;
  }
  case "donate": {
    const saved = load();
    const [asset, amount, refundTo] = args;
    const d = await startDonation({
      engine, groupPubkey: saved.state.group.pubkey, originAsset: asset, amount, refundTo,
      onStep: (s) => log("step", s),
    });
    saved.donorKeys.push(d.key);
    save(saved);
    log("SEND", d.quote.quote.amountInFormatted, "of", asset);
    log("  to", d.depositAddress, d.depositMemo ? `memo ${d.depositMemo}` : "");
    log("  before", d.quote.quote.deadline, "; expect", d.quote.quote.amountOutFormatted, "ZEC at", d.key.address);
    break;
  }
  case "collect": {
    const saved = load();
    const added = await readBoard(saved.state);
    log("new drops:", added.length);
    await track(saved.state, engine);
    save(saved);
    for (const round of saved.state.rounds) {
      for (const d of round.donations) {
        log(`round ${round.index} donation ${d.dropId.slice(0, 8)}: ${d.status}`, d.arrivedZat ? zec(d.arrivedZat) + " ZEC" : "");
        if (d.status === "arrived") {
          log("  sweeping into round", round.index);
          const txid = await sweepDonation(round, d, engine, stage);
          save(saved);
          log("  swept:", txid);
        }
      }
    }
    break;
  }
  case "rotate": {
    const saved = load();
    const round = await rotate(saved.state, engine);
    save(saved);
    log("round", round.index, "open; earlier rounds closing");
    break;
  }
  case "payout": {
    const saved = load();
    const force = args.includes("--force");
    for (const round of [...saved.state.rounds]) {
      if (round.status !== "closing") continue;
      if (!settled(round) && !force) {
        log(`round ${round.index} still has donations in flight; --force to pay anyway`);
        continue;
      }
      const p = await payout(saved.state, round, engine, stage);
      save(saved);
      log(`round ${round.index} paid: ${zec(p!.toVaultZat)} ZEC to vault, ${zec(p!.carriedZat)} carried into round ${openRound(saved.state)?.index}; tx ${p!.txid || "(nothing to pay)"}`);
      const record = burn(saved.state, round);
      save(saved);
      log(`round ${record.index} BURNED`);
    }
    break;
  }
  case "vault": {
    const saved = load();
    if (!saved.vaultKey) throw new Error("the vault is an outside wallet; check it there");
    const opened = await engine.open(saved.vaultKey);
    log("vault holds", zec(opened.total_zat), "ZEC in", opened.notes.filter((n) => !n.spent).length, "note(s)");
    break;
  }
  case "raid": {
    console.log(JSON.stringify(raidView(load().state), null, 2));
    break;
  }
  case "status": {
    const { state } = load();
    for (const r of state.rounds) log(`round ${r.index} ${r.status}: ${r.donations.map((d) => d.status).join(", ") || "no donations"}`);
    for (const b of state.burned) log(`round ${b.index} burned: ${b.donations} donations, ${zec(b.toVaultZat ?? "0")} ZEC to vault`);
    break;
  }
  default:
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 13).join("\n"));
}
closePool();
process.exit(0);
