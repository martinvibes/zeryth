import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const TYPICAL = [
  { what: "Donor list", found: "1,284 names, emails and phone numbers", bad: true },
  { what: "Payments", found: "Every card and bank transfer, with the amount and the date", bad: true },
  { what: "Payout account", found: "The group's bank account, already frozen", bad: true },
  { what: "Inbox", found: "A thank-you email to every donor", bad: true },
];

const ZERYTH = [
  { what: "Donor list", found: "None. Zeryth never asks who you are.", bad: false },
  { what: "Gift keys", found: "This round's only. Every earlier round: burned, zero keys left.", bad: false },
  { what: "The vault", found: "A Zcash balance. It can't be frozen, and it doesn't say where any of it came from.", bad: false },
  { what: "The public board", found: "Sealed notes that nobody can open any more, the group included.", bad: false },
];

export function Raid() {
  const [mode, setMode] = useState<"typical" | "zeryth">("typical");
  const rows = mode === "typical" ? TYPICAL : ZERYTH;

  return (
    <section className="raid">
      <div className="wrap raid-grid">
        <div className="raid-copy">
          <h2>What a raid finds.</h2>
          <p className="lead">
            Picture the treasurer's phone taken at a checkpoint, or their laptop carried out in a dawn raid. Here's what's
            on it.
          </p>
          <div className="seg" role="tablist" aria-label="Compare">
            {(["typical", "zeryth"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className={`seg-btn ${mode === m ? "is-on" : ""}`}
                onClick={() => setMode(m)}
              >
                {mode === m && <motion.span layoutId="seg-pill" className="seg-pill" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
                <span>{m === "typical" ? "A typical fundraiser" : "A Zeryth fund"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`evidence ${mode}`} role="tabpanel">
          <header className="evidence-head">
            <span>Evidence log</span>
            <span className="muted">Item 14: phone, unlocked</span>
          </header>
          <ul className="evidence-rows">
            <AnimatePresence mode="popLayout" initial={false}>
              {rows.map((r, i) => (
                <motion.li
                  key={`${mode}-${r.what}`}
                  className={`evidence-row ${r.bad ? "is-bad" : "is-good"}`}
                  initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
                  exit={{ opacity: 0, y: -10, filter: "blur(6px)", transition: { duration: 0.2 } }}
                >
                  <span className="evidence-what">{r.what}</span>
                  <span className="evidence-found">{r.found}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <footer className="evidence-foot small">
            {mode === "typical"
              ? "Every donor is now a name in a file."
              : "Nothing here leads back to a single donor."}
          </footer>
        </div>
      </div>
    </section>
  );
}
