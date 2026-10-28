import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animate, motion } from "motion/react";
import { zec } from "@zeryth/core";
import { reducedMotion } from "../lib/smooth";
import { explorerTx, zecText } from "../lib/format";
import { Icon } from "./Icons";

const GLYPHS = "0123456789abcdef";

export interface BurnSummary {
  round: number;
  /** Gift keys the round held when it burned. */
  gifts: number;
  toVaultZat: string;
  carriedZat: string;
  txid?: string;
  /** Unpaid quotes that moved to the open round instead of burning. */
  moved: number;
  next?: number;
}

/**
 * What it looks like when a round is burned: night comes down, each key the round held
 * burns away, then morning comes up on a receipt of what happened.
 *
 * Everything that moves is transform or opacity, and the embers are pre-drawn sprites,
 * so it stays smooth on a laptop that is also running the Zcash engine.
 */
export function BurnCeremony({ summary, onDone, onRaid }: { summary: BurnSummary; onDone: () => void; onRaid: () => void }) {
  const { round, gifts, toVaultZat, carriedZat, txid, moved, next } = summary;
  const still = reducedMotion();
  const rows = useMemo(() => {
    const labels = ["Round key", ...Array.from({ length: Math.min(gifts, 5) }, (_, i) => `Gift key ${i + 1}`)];
    if (gifts > 5) labels.push(`${gifts - 5} more gift keys`);
    return labels.map((label) => ({
      label,
      chars: Array.from({ length: 18 }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]),
    }));
  }, [gifts]);

  // When the last key has burned and morning comes up.
  const dawn = still ? 0 : 0.8 + rows.length * 0.2 + 1.2;
  const paid = BigInt(toVaultZat) > 0n;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <motion.div
      className="burn"
      role="dialog"
      aria-modal="true"
      aria-label={`Round ${round} burned`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="burn-dawn"
        aria-hidden="true"
        initial={{ opacity: 0, y: "18%" }}
        animate={{ opacity: 1, y: "0%" }}
        transition={{ delay: dawn, duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      />
      {!still && <Embers />}

      <div className="burn-inner">
        <motion.p
          className="burn-kicker"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          <Icon name="flame" />
          Burning round {round}
        </motion.p>

        <ul className="burn-keys" style={{ ["--n" as string]: rows.length }}>
          {rows.map((r, i) => (
            <li key={r.label} style={{ ["--i" as string]: i }}>
              <span className="burn-key-label">{r.label}</span>
              <span className="burn-key-strip">
                {r.chars.map((ch, j) => (
                  <span key={j} className="burn-glyph" style={{ ["--j" as string]: j }}>
                    {ch}
                  </span>
                ))}
                <span className="burn-edge" />
              </span>
            </li>
          ))}
        </ul>

        <motion.div
          className="burn-end"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: dawn + 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>Round {round} is gone.</h2>
          <p className="burn-lead">
            {paid ? (
              <>
                Your wallet has its payout, and nothing this browser keeps can lead back to who gave it.
              </>
            ) : (
              <>Nothing this browser keeps can lead back to who gave to it.</>
            )}
          </p>

          <ol className="burn-receipt">
            <Line icon="check" tone="is-good" delay={dawn + 0.5} label="Paid to your wallet">
              {paid ? <CountUp zat={toVaultZat} delay={dawn + 0.6} /> : <span className="num">Nothing this time</span>}
              {paid && txid && (
                <a className="burn-link" href={explorerTx(txid)} target="_blank" rel="noreferrer">
                  See the payout
                </a>
              )}
            </Line>
            {BigInt(carriedZat) > 0n && (
              <Line icon="swap" delay={dawn + 0.62} label={`Carried into round ${next ?? round + 1}`}>
                <span className="num">{zecText(carriedZat)}</span>
              </Line>
            )}
            <Line icon="key" tone="is-burn" delay={dawn + 0.74} label="Keys deleted">
              <span>
                The round key and {gifts === 1 ? "1 gift key" : `${gifts} gift keys`}
              </span>
            </Line>
            {moved > 0 && (
              <Line icon="clock" delay={dawn + 0.86} label={`Moved to round ${next ?? round + 1}`}>
                <span>
                  {moved === 1 ? "1 gift nobody has paid for yet" : `${moved} gifts nobody has paid for yet`}, so a late payment still
                  arrives
                </span>
              </Line>
            )}
          </ol>

          <p className="burn-note">
            The sealed notes this round left on the board are still there. Nobody can open them now, including you.
          </p>

          <div className="burn-actions">
            <button className="btn gold" onClick={onDone} autoFocus>
              Back to the vault room
            </button>
            <button className="btn burn-ghost" onClick={onRaid}>
              What a raid would find now
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>,
    document.body,
  );
}

function Line({
  icon,
  tone = "",
  label,
  delay,
  children,
}: {
  icon: "check" | "swap" | "key" | "clock";
  tone?: string;
  label: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.li
      className={`burn-line ${tone}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="burn-line-icon">
        <Icon name={icon} />
      </span>
      <span className="burn-line-label">{label}</span>
      <span className="burn-line-value">{children}</span>
    </motion.li>
  );
}

function CountUp({ zat, delay }: { zat: string; delay: number }) {
  const target = Number(zat);
  const [v, setV] = useState(reducedMotion() ? target : 0);
  useEffect(() => {
    if (reducedMotion()) return;
    const c = animate(0, target, { delay, duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [target, delay]);
  const digits = target < 10_000 ? 8 : 4;
  return <span className="num burn-paid">{zec(BigInt(v), digits)} ZEC</span>;
}

/** Embers rising from the bottom of the screen, drawn from two pre-rendered glow sprites. */
function Embers() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d")!;
    const sprite = (rgb: string) => {
      const s = document.createElement("canvas");
      s.width = s.height = 32;
      const x = s.getContext("2d")!;
      const grad = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, `rgba(${rgb},1)`);
      grad.addColorStop(0.25, `rgba(${rgb},0.75)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = grad;
      x.fillRect(0, 0, 32, 32);
      return s;
    };
    const sprites = [sprite("246,182,55"), sprite("255,157,181")];
    const resize = () => {
      c.width = innerWidth;
      c.height = innerHeight;
    };
    resize();
    addEventListener("resize", resize);

    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; s: number };
    const ps: P[] = [];
    const start = performance.now();
    let raf = 0;
    let owed = 0;
    const loop = (t: number) => {
      const elapsed = (t - start) / 1000;
      owed += elapsed < 2.6 ? 2.2 : 0.35;
      while (owed >= 1 && ps.length < 160) {
        owed -= 1;
        ps.push({
          x: innerWidth * (0.1 + Math.random() * 0.8),
          y: innerHeight * (0.7 + Math.random() * 0.35),
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.7 - Math.random() * 1.6,
          life: 0,
          max: 90 + Math.random() * 110,
          size: 6 + Math.random() * 14,
          s: Math.random() < 0.72 ? 0 : 1,
        });
      }
      owed = Math.min(owed, 1);
      g.clearRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = "lighter";
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life++;
        p.x += p.vx + Math.sin((p.life + i) * 0.05) * 0.35;
        p.y += p.vy;
        const k = 1 - p.life / p.max;
        if (k <= 0) {
          ps[i] = ps[ps.length - 1];
          ps.pop();
          continue;
        }
        const size = p.size * (0.5 + k * 0.5);
        g.globalAlpha = k;
        g.drawImage(sprites[p.s], p.x - size / 2, p.y - size / 2, size, size);
      }
      g.globalAlpha = 1;
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
