import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollTrigger, reducedMotion } from "../../lib/smooth";

const STEPS = [
  {
    title: "You give, from whatever you hold.",
    body: "USDC on Base, SOL, Bitcoin, USDT on Tron and about a hundred more. NEAR Intents swaps it to Zcash on the way, so you never need to own any.",
  },
  {
    title: "It lands at an address made for this one gift.",
    body: "Your browser makes a brand-new private address, then leaves its key for the group in a sealed note on a public board. Only the group can open it, and nobody can tell which fund it's for.",
  },
  {
    title: "The group gathers it up.",
    body: "Gifts are pooled into the round, then paid to the group's own wallet in round amounts. No deposit in their wallet matches any single gift.",
  },
  {
    title: "Then every key is burned.",
    body: "When a round closes, the app deletes its keys and every gift key it collected. Seize the group's phone after that and nothing on it points back to you.",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: ref.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        setProgress(self.progress);
        setActive(Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length * 0.999)));
      },
    });
    return () => st.kill();
  }, []);

  return (
    <section ref={ref} id="how" className="how" style={{ height: `${STEPS.length * 95 + 30}vh` }}>
      <div className="how-sticky">
        <div className="wrap how-grid">
          <div className="how-copy">
            <h2 className="how-heading">How a gift stays private.</h2>
            <ol className="how-steps">
              {STEPS.map((s, i) => (
                <li key={i} className={i === active ? "is-active" : i < active ? "is-past" : ""} aria-current={i === active ? "step" : undefined}>
                  <span className="how-num">{i + 1}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="how-rail" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress})` }} />
            </div>
          </div>
          <div className="how-stage" aria-hidden="true">
            <StageSwap on={active === 0} />
            <StageSeal on={active === 1} />
            <StageGather on={active === 2} />
            <StageBurn on={active === 3} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StageSwap({ on }: { on: boolean }) {
  const coins = ["USDC on Base", "SOL", "BTC", "USDT on Tron", "ETH"];
  const ys = [44, 112, 180, 248, 316];
  return (
    <div className={`stage stage-swap ${on ? "is-on" : ""}`}>
      <svg viewBox="0 0 520 360" className="swap-svg">
        {ys.map((y, i) => (
          <g key={i}>
            <path id={`swap-${i}`} d={`M150 ${y} C 290 ${y}, 300 180, 412 180`} className="swap-line" />
            {on && !reducedMotion() && (
              <circle r="5" className="swap-spark">
                <animateMotion dur={`${1.8 + i * 0.23}s`} repeatCount="indefinite" begin={`${i * 0.31}s`}>
                  <mpath href={`#swap-${i}`} />
                </animateMotion>
              </circle>
            )}
          </g>
        ))}
      </svg>
      <ul className="swap-chips">
        {coins.map((c, i) => (
          <li key={c} className="chip" style={{ top: `${(ys[i] / 360) * 100}%`, transitionDelay: `${i * 60}ms` }}>
            {c}
          </li>
        ))}
      </ul>
      <div className="swap-coin">
        <ZecCoin />
        <span className="swap-coin-label small">Private Zcash</span>
      </div>
    </div>
  );
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function scramble(n: number) {
  return Array.from({ length: n }, () => B64[Math.floor(Math.random() * B64.length)]).join("");
}

function StageSeal({ on }: { on: boolean }) {
  const [addr, setAddr] = useState("u1" + scramble(30));
  useEffect(() => {
    if (!on || reducedMotion()) return;
    let n = 0;
    const id = setInterval(() => {
      n++;
      setAddr("u1" + scramble(30));
      if (n > 14) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [on]);
  const tiles = 28;
  const mine = 17;
  return (
    <div className={`stage stage-seal ${on ? "is-on" : ""}`}>
      <div className="seal-addr panel">
        <span className="small muted">A private address for this gift only</span>
        <span className="seal-addr-value">{addr}…</span>
      </div>
      <div className="seal-board">
        {Array.from({ length: tiles }, (_, i) => (
          <span key={i} className={`seal-tile ${i === mine ? "is-mine" : ""}`} style={{ animationDelay: `${(i % 7) * 40}ms` }}>
            <Envelope />
          </span>
        ))}
      </div>
      <p className="seal-caption small">One of these is yours. Nobody can tell which.</p>
    </div>
  );
}

function StageGather({ on }: { on: boolean }) {
  const gifts = ["0.0137", "0.0091", "0.0214", "0.0042"];
  return (
    <div className={`stage stage-gather ${on ? "is-on" : ""}`}>
      <ul className="gather-gifts">
        {gifts.map((g, i) => (
          <li key={g} className="gather-gift" style={{ ["--i" as string]: i }}>
            <span className="dot gold" /> Gift {i + 1}
            <span className="num">{g} ZEC</span>
          </li>
        ))}
      </ul>
      <div className="gather-pool panel">
        <span className="small muted">Round 7, pooled</span>
        <span className="gather-total num">0.0484 ZEC</span>
      </div>
      <div className="gather-out">
        <div className="gather-vault">
          <span className="num">0.04 ZEC</span>
          <span className="small">to the group's wallet</span>
        </div>
        <div className="gather-carry">
          <span className="num">0.0084 ZEC</span>
          <span className="small">carried into round 8</span>
        </div>
      </div>
    </div>
  );
}

function StageBurn({ on }: { on: boolean }) {
  // Every letter gets its own delay and drift once, so re-renders don't reshuffle them.
  const keys = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) =>
        Array.from(scramble(26)).map((ch, j) => ({
          ch,
          style: {
            ["--d" as string]: `${0.4 + i * 0.18 + j * 0.022 + Math.random() * 0.25}s`,
            ["--x" as string]: `${(Math.random() - 0.5) * 40}px`,
            ["--y" as string]: `${-30 - Math.random() * 70}px`,
          },
        })),
      ),
    [],
  );
  return (
    <div className={`stage stage-burn ${on ? "is-on" : ""}`}>
      <div className="burn-panel">
        <span className="small">Keys held for round 7</span>
        <ul className="burn-keys">
          {keys.map((k, i) => (
            <li key={i}>
              {k.map(({ ch, style }, j) => (
                <span key={j} className="ember" style={style}>
                  {ch}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <p className="burn-zero">
          <span className="num">0</span> keys left. The sealed notes can't be opened by anyone now.
        </p>
      </div>
    </div>
  );
}

export function ZecCoin({ size = 112 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="zec-coin" aria-hidden="true">
      <defs>
        <radialGradient id="coin-g" cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.5" stopColor="#f6b637" />
          <stop offset="1" stopColor="#b97a0c" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="url(#coin-g)" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(110,67,0,0.45)" strokeWidth="2.4" />
      <path d="M33 34h34L33 66h34M50 21v11M50 68v11" fill="none" stroke="#6e4300" strokeWidth="8" strokeLinejoin="miter" />
    </svg>
  );
}

function Envelope() {
  return (
    <svg viewBox="0 0 40 28" aria-hidden="true">
      <rect x="1" y="1" width="38" height="26" rx="4" />
      <path d="M2 3l18 13L38 3" />
    </svg>
  );
}
