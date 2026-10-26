import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { copy } from "../lib/format";

/** A value the reader will want to paste somewhere, with one button to take it. */
export function CopyField({ value, label, wrap = true }: { value: string; label: string; wrap?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className={`copyfield ${wrap ? "" : "nowrap"}`}>
      <span className="copyfield-value" aria-label={label}>
        {value}
      </span>
      <button
        type="button"
        className="btn small ghost copyfield-btn"
        onClick={async () => {
          if (await copy(value)) {
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          }
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={done ? "y" : "n"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {done ? "Copied" : "Copy"}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}
