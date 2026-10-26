import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type Seen = "visible" | "partly" | "hidden";

interface Observer {
  id: string;
  who: string;
  short: string;
  rows: [Seen, string][];
  sum: string;
}

const ROWS = ["Who gave", "How much", "Which fund"];

const OBSERVERS: Observer[] = [
  {
    id: "chain",
    who: "Someone watching the donor's chain",
    short: "A block explorer on Base, Solana or Ethereum",
    rows: [
      ["visible", "The donor's wallet address, as with any payment on that chain."],
      ["visible", "The amount sent to the deposit address."],
      ["hidden", "The deposit address belongs to NEAR Intents and leads only to a one-time Zcash address."],
    ],
    sum: "a payment into NEAR Intents, like thousands of others that day.",
  },
  {
    id: "near",
    who: "NEAR Intents",
    short: "The service that runs the swap",
    rows: [
      ["partly", "The paying wallet, the refund address and the IP address that asked for the quote."],
      ["visible", "Both sides of the swap."],
      ["hidden", "Only a one-time shielded address. Nothing about it names a fund."],
    ],
    sum: "a swap into Zcash. Not who it was for.",
  },
  {
    id: "board",
    who: "Anyone reading the board",
    short: "Including the people who run the relays",
    rows: [
      ["partly", "Each note is signed by a throwaway key, but a relay sees the IP address that posted it."],
      ["hidden", "The amount is inside the encryption."],
      ["hidden", "No recipient on any note. Every Zeryth note looks like every other."],
    ],
    sum: "that sealed notes exist, and how many.",
  },
  {
    id: "zcash",
    who: "Someone watching Zcash",
    short: "Anyone with a copy of the chain",
    rows: [
      ["hidden", "Shielded transactions carry no addresses."],
      ["partly", "ZEC leaving NEAR Intents into the shielded pool shows its amount and time. Collections and payouts show neither."],
      ["hidden", "Gift addresses, round keys and payouts are all shielded."],
    ],
    sum: "ZEC entering the shielded pool. After that, nothing.",
  },
  {
    id: "raid-before",
    who: "Someone who takes the fund's device before a burn",
    short: "Or the fund itself, in the same moment",
    rows: [
      ["partly", "The open round's notes hold each gift's deposit address. Following one back on the donor's chain finds the donor's wallet."],
      ["visible", "Every gift in the rounds that haven't burned."],
      ["visible", "It's the fund's own device."],
    ],
    sum: "the rounds that haven't burned yet. This is why rounds are short.",
  },
  {
    id: "raid-after",
    who: "Someone who takes it after a burn",
    short: "The case Zeryth is built for",
    rows: [
      ["hidden", "The keys that could open past notes are gone. The notes are unreadable."],
      ["partly", "Payout totals in the fund's wallet, in whole payout steps only."],
      ["visible", "It's the fund's own device."],
    ],
    sum: "round totals, and nothing that leads back to a donor.",
  },
];

const WORD: Record<Seen, string> = { visible: "Can see", partly: "Partly", hidden: "Can't see" };

export function WhoSees() {
  const [id, setId] = useState(OBSERVERS[0].id);
  const o = OBSERVERS.find((x) => x.id === id)!;

  return (
    <div className="who">
      <div className="who-pick" role="radiogroup" aria-label="Who is watching">
        {OBSERVERS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={x.id === id}
            className={`who-btn ${x.id === id ? "is-on" : ""}`}
            onClick={() => setId(x.id)}
          >
            {x.id === id && (
              <motion.span layoutId="who-on" className="who-on" transition={{ type: "spring", stiffness: 420, damping: 36 }} />
            )}
            <span className="who-name">{x.who}</span>
            <span className="who-short">{x.short}</span>
          </button>
        ))}
      </div>

      <div className="evidence who-card">
        <div className="evidence-head">
          <span>What they can learn about one gift</span>
          <Tally rows={o.rows} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.ol
            key={o.id}
            className="evidence-rows"
            initial="out"
            animate="in"
            exit="gone"
            variants={{ in: { transition: { staggerChildren: 0.06 } } }}
          >
            {o.rows.map(([seen, text], i) => (
              <motion.li
                key={ROWS[i]}
                className={`evidence-row ${seen === "visible" ? "is-bad" : seen === "partly" ? "is-warn" : "is-good"}`}
                variants={{
                  out: { opacity: 0, x: -10 },
                  in: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
                  gone: { opacity: 0, transition: { duration: 0.12 } },
                }}
              >
                <span className="evidence-what">
                  {ROWS[i]}
                  <span className={`who-seen ${seen}`}>{WORD[seen]}</span>
                </span>
                <span className="evidence-found">{text}</span>
              </motion.li>
            ))}
          </motion.ol>
        </AnimatePresence>
        <div className="evidence-foot who-foot">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={o.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              They find: {o.sum}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** Three small marks, one per question, so the overall picture reads at a glance. */
function Tally({ rows }: { rows: [Seen, string][] }) {
  return (
    <span className="who-tally" aria-hidden="true">
      {rows.map(([seen], i) => (
        <motion.i key={i} className={seen} layout transition={{ type: "spring", stiffness: 500, damping: 30 }} />
      ))}
    </span>
  );
}
