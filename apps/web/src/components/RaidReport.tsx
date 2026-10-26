import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { raidView, type VaultState } from "@zeryth/core";
import { short } from "../lib/format";

/**
 * Exactly what someone who copied this browser's storage right now would hold, read
 * from the real state rather than described. The honest version, open round included.
 */
export function RaidReport({ state, onClose }: { state: VaultState; onClose: () => void }) {
  const view = raidView(state);
  const live = view.liveRounds;
  const keysHeld = live.reduce((n, r) => n + r.donationKeysHeld, 0);

  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [onClose]);

  const rows: { what: string; found: string; tone: "bad" | "warn" | "good" }[] = [
    {
      what: "Donor names, emails, cards",
      found: "None. Zeryth never asked for them, so there is nothing to find.",
      tone: "good",
    },
    {
      what: "The fund's identity",
      found: `${short(view.groupIdentity, 12, 6)}. Public already: it signs your round notices.`,
      tone: "good",
    },
    {
      what: "Your payout wallet",
      found: `${short(view.vaultAddress, 10, 6)}. An address only. Without that wallet's own keys, nobody can see its balance or history.`,
      tone: "warn",
    },
    ...live.map((r) => ({
      what: `Round ${r.round}, ${r.status === "open" ? "open" : "closing"}`,
      found:
        r.donationKeysHeld === 0
          ? "Its round key, and no gift keys yet."
          : `Its round key and ${r.donationKeysHeld} gift ${r.donationKeysHeld === 1 ? "key" : "keys"}. These can still open this round's sealed notes and see what each gift swapped from.`,
      tone: (r.donationKeysHeld > 0 ? "bad" : "warn") as "bad" | "warn",
    })),
    {
      what: view.burnedRounds.length ? `Rounds ${rangeText(view.burnedRounds.map((b) => b.round))}` : "Earlier rounds",
      found: view.burnedRounds.length
        ? `Burned. ${view.burnedRounds.reduce((n, b) => n + b.donations, 0)} gifts, 0 keys left. Their sealed notes can't be opened by anyone.`
        : "None burned yet. Burn a round to see it disappear from this list.",
      tone: "good",
    },
  ];

  return createPortal(
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="raid-report"
        role="dialog"
        aria-modal="true"
        aria-label="What a raid would find on this device"
        initial={{ y: 40, opacity: 0, rotate: -1.2 }}
        animate={{ y: 0, opacity: 1, rotate: 0, transition: { type: "spring", bounce: 0.22, duration: 0.6 } }}
        exit={{ y: 30, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="evidence-head">
          <span>Evidence log</span>
          <span className="muted">This browser, right now</span>
        </header>
        <p className="raid-report-intro">
          If someone took this device this minute and copied everything Zeryth stores, this is the complete list of what they'd
          have.
        </p>
        <ul className="evidence-rows">
          {rows.map((r, i) => (
            <motion.li
              key={r.what}
              className={`evidence-row is-${r.tone}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0, transition: { delay: 0.15 + i * 0.08 } }}
            >
              <span className="evidence-what">{r.what}</span>
              <span className="evidence-found">{r.found}</span>
            </motion.li>
          ))}
        </ul>
        <footer className="evidence-foot small">
          {keysHeld > 0
            ? `To shrink this list, collect the ${keysHeld} ${keysHeld === 1 ? "gift" : "gifts"} still held, close the round and burn it.`
            : "Nothing here leads back to a single donor."}
        </footer>
        <button className="btn small ghost raid-report-close" onClick={onClose}>
          Close
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function rangeText(ns: number[]): string {
  const s = [...ns].sort((a, b) => a - b);
  if (s.length === 1) return String(s[0]);
  const contiguous = s.every((n, i) => i === 0 || n === s[i - 1] + 1);
  return contiguous ? `${s[0]} to ${s[s.length - 1]}` : s.join(", ");
}
