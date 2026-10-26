import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { reducedMotion } from "../lib/smooth";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * What it looks like when a round is burned: the night comes down, each key the round
 * held turns to embers, and what's left is a sentence saying exactly what is gone.
 */
export function BurnCeremony({ round, gifts, onDone }: { round: number; gifts: number; onDone: () => void }) {
  const rows = useMemo(() => {
    const labels = ["Round key", ...Array.from({ length: Math.min(gifts, 7) }, (_, i) => `Gift key ${i + 1}`)];
    if (gifts > 7) labels.push(`and ${gifts - 7} more`);
    return labels.map((label, i) => ({
      label,
      chars: Array.from({ length: 22 }, (_, j) => ({
        ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        style: {
          ["--d" as string]: `${0.9 + i * 0.22 + j * 0.03 + Math.random() * 0.3}s`,
          ["--x" as string]: `${(Math.random() - 0.5) * 60}px`,
          ["--y" as string]: `${-40 - Math.random() * 110}px`,
        },
      })),
    }));
  }, [gifts]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const settle = 1.6 + rows.length * 0.22;

  return createPortal(
    <motion.div
      className="burn-ceremony"
      role="dialog"
      aria-modal="true"
      aria-label={`Round ${round} burned`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <Embers />
      <div className="burn-ceremony-inner">
        <motion.p className="burn-ceremony-kicker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          Burning round {round}
        </motion.p>
        <ul className="burn-ceremony-keys is-on">
          {rows.map((r) => (
            <li key={r.label}>
              <span className="burn-ceremony-label">{r.label}</span>
              <span className="burn-ceremony-glyphs">
                {r.chars.map((c, j) => (
                  <span key={j} className="ember" style={c.style}>
                    {c.ch}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <motion.div
          className="burn-ceremony-end"
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: settle, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>Round {round} is gone.</h2>
          <p>
            Its round key and {gifts === 1 ? "its one gift key were" : `all ${gifts} gift keys were`} deleted from this browser.
            The sealed notes it left on the board can't be opened by anyone now, including you.
          </p>
          <button className="btn gold" onClick={onDone} autoFocus>
            Done
          </button>
        </motion.div>
      </div>
    </motion.div>,
    document.body,
  );
}

function Embers() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const c = ref.current!;
    const g = c.getContext("2d")!;
    let raf = 0;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const resize = () => {
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener("resize", resize);
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; hue: number };
    const ps: P[] = [];
    const start = performance.now();
    const loop = (t: number) => {
      const elapsed = (t - start) / 1000;
      const rate = elapsed < 4 ? 9 : 2;
      for (let i = 0; i < rate; i++) {
        ps.push({
          x: innerWidth * (0.15 + Math.random() * 0.7),
          y: innerHeight * (0.55 + Math.random() * 0.5),
          vx: (Math.random() - 0.5) * 0.6,
          vy: -0.6 - Math.random() * 1.8,
          life: 0,
          max: 80 + Math.random() * 120,
          r: 0.8 + Math.random() * 2.4,
          hue: Math.random(),
        });
      }
      g.clearRect(0, 0, innerWidth, innerHeight);
      g.globalCompositeOperation = "lighter";
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life++;
        p.x += p.vx + Math.sin((p.life + i) * 0.05) * 0.4;
        p.y += p.vy;
        const k = 1 - p.life / p.max;
        if (k <= 0) {
          ps.splice(i, 1);
          continue;
        }
        const color = p.hue < 0.7 ? `rgba(246,182,55,${k * 0.9})` : `rgba(255,157,181,${k * 0.8})`;
        g.beginPath();
        g.fillStyle = color;
        g.shadowColor = color;
        g.shadowBlur = 10;
        g.arc(p.x, p.y, p.r * (0.6 + k * 0.6), 0, Math.PI * 2);
        g.fill();
      }
      g.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="burn-embers" aria-hidden="true" />;
}
