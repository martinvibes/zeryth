import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { reducedMotion } from "../../lib/smooth";

export interface FlowStep {
  /** A few words, under the screen. */
  title: string;
  /** What the person sees and does. */
  see: string;
  /** What happens underneath. */
  under: string;
  screen: ReactNode;
}

export interface FlowBranch {
  from: number;
  title: string;
  text: string;
}

const STEP_MS = 4600;

/**
 * A flow as a row of small screens. While it is on screen it walks itself through the
 * steps; once the reader picks a step, it stops and leaves the pace to them.
 */
export function Flow({ steps, branches = [] }: { steps: FlowStep[]; branches?: FlowBranch[] }) {
  const root = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const inView = useInView(root, { amount: 0.4 });
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const playing = inView && !touched && !reducedMotion();

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), STEP_MS);
    return () => clearInterval(t);
  }, [playing, steps.length]);

  // On phones the rail scrolls sideways; keep the active screen in the middle of it.
  useEffect(() => {
    const r = rail.current;
    const el = r?.children[active] as HTMLElement | undefined;
    if (!r || !el || r.scrollWidth <= r.clientWidth + 2) return;
    r.scrollTo({ left: el.offsetLeft - (r.clientWidth - el.clientWidth) / 2, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active]);

  const pick = (i: number) => {
    setTouched(true);
    setActive(Math.min(steps.length - 1, Math.max(0, i)));
  };
  const step = steps[active];

  return (
    <div ref={root} className="flow">
      <ol ref={rail} className="flow-rail" style={{ ["--n" as string]: steps.length }}>
        {steps.map((s, i) => (
          <li key={s.title} className={`flow-step ${i === active ? "is-on" : ""} ${i < active ? "is-past" : ""}`}>
            <button type="button" onClick={() => pick(i)} aria-pressed={i === active}>
              <motion.span
                className="flow-screen"
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ delay: i * 0.09, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                {s.screen}
              </motion.span>
              <span className="flow-label">
                <span className="flow-num">{i + 1}</span>
                <span>{s.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="flow-detail">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            className="flow-detail-body"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            aria-live="polite"
          >
            <div>
              <p className="flow-detail-step">
                Step {active + 1} of {steps.length}
              </p>
              <h3>{step.title}</h3>
              <p>{step.see}</p>
            </div>
            <div className="flow-under">
              <h4>Underneath</h4>
              <p>{step.under}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flow-controls">
          <button type="button" className="flow-arrow" onClick={() => pick(active - 1)} disabled={active === 0} aria-label="Previous step">
            <Chevron flip />
          </button>
          <div className="flow-progress" aria-hidden="true">
            {steps.map((_, i) => (
              <span key={i} className={i < active ? "is-done" : i === active ? "is-on" : ""}>
                {i === active && <i key={playing ? `p${active}` : "still"} className={playing ? "is-playing" : ""} style={{ animationDuration: `${STEP_MS}ms` }} />}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="flow-arrow"
            onClick={() => pick(active + 1)}
            disabled={active === steps.length - 1}
            aria-label="Next step"
          >
            <Chevron />
          </button>
        </div>
      </div>

      {branches.length > 0 && (
        <ul className="flow-branches">
          {branches.map((b) => (
            <li key={b.title}>
              <button type="button" className="flow-branch-from" onClick={() => pick(b.from - 1)}>
                From step {b.from}
              </button>
              <strong>{b.title}</strong>
              <p>{b.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chevron({ flip }: { flip?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
