import { AnimatePresence, motion } from "motion/react";

export type StepState = "todo" | "doing" | "done" | "failed";

/**
 * A short checklist that fills in as work happens: each line says in plain words what
 * the app is doing right now, and ticks when it's done.
 */
export function Steps({ items }: { items: { label: string; state: StepState; note?: string }[] }) {
  return (
    <ol className="steps">
      {items.map((it, i) => (
        <li key={i} className={`step is-${it.state}`}>
          <span className="step-mark" aria-hidden="true">
            <AnimatePresence mode="wait" initial={false}>
              {it.state === "done" ? (
                <motion.svg
                  key="done"
                  viewBox="0 0 20 20"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.5, duration: 0.5 }}
                >
                  <motion.path
                    d="M5 10.5l3.2 3.2L15 7"
                    fill="none"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                  />
                </motion.svg>
              ) : it.state === "doing" ? (
                <motion.span key="doing" className="step-spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
              ) : it.state === "failed" ? (
                <motion.span key="failed" className="step-x" initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                  !
                </motion.span>
              ) : (
                <motion.span key="todo" className="step-dot" />
              )}
            </AnimatePresence>
          </span>
          <span className="step-label">
            {it.label}
            {it.note && <span className="step-note">{it.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** What each of the engine's sweep stages means to someone watching. */
export const SWEEP_STAGES: { key: string; label: string }[] = [
  { key: "witness", label: "Finding the money on the chain" },
  { key: "keys", label: "Getting the proving keys ready" },
  { key: "proving", label: "Proving the payment privately" },
  { key: "broadcast", label: "Sending it to the Zcash network" },
];

export function sweepItems(current: string | null, failed = false, finished = false) {
  const at = current ? SWEEP_STAGES.findIndex((s) => s.key === current) : -1;
  return SWEEP_STAGES.map((s, i) => ({
    label: s.label,
    note: s.key === "proving" && i === at && !finished ? "This takes 10 to 40 seconds. Keep this tab open." : undefined,
    state: (finished || i < at ? "done" : i === at ? (failed ? "failed" : "doing") : "todo") as StepState,
  }));
}
