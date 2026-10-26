import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { reducedMotion } from "../../lib/smooth";

/*
 * The whole system on one page. Two lanes: money along the top, sealed notes along the
 * bottom. The same data draws a wide map and, on phones, a tall one with the lanes as
 * columns.
 */

type Id = "donor" | "near" | "gift" | "round" | "wallet" | "browser" | "board" | "vault" | "burn";

interface Node {
  id: Id;
  label: string;
  sub: string;
  /** Position along its lane, 0 to 4. */
  slot: number;
  lane: 0 | 1;
  text: string;
}

const NODES: Node[] = [
  {
    id: "donor",
    label: "Donor's wallet",
    sub: "any chain",
    slot: 0,
    lane: 0,
    text: "Whatever the donor already uses, on Base, Solana, Ethereum or another chain NEAR Intents supports. Paying from it is an ordinary transfer, public on that chain like any other.",
  },
  {
    id: "near",
    label: "NEAR Intents",
    sub: "the swap",
    slot: 1,
    lane: 0,
    text: "Takes the payment, swaps it to ZEC and delivers it shielded to the gift's own address. It sees both sides of the swap. Nothing it sees names the fund.",
  },
  {
    id: "gift",
    label: "Gift address",
    sub: "one per gift",
    slot: 2,
    lane: 0,
    text: "A brand-new Zcash key the donor's browser made for this one gift. On the chain it's a stranger: only the sealed note ties it to a fund.",
  },
  {
    id: "round",
    label: "Round key",
    sub: "one per round",
    slot: 3,
    lane: 0,
    text: "The fund collects every gift of a round into this key with shielded transactions that show no addresses and no amounts. Whatever didn't fit the last payout is already inside.",
  },
  {
    id: "wallet",
    label: "Fund's wallet",
    sub: "Zodl, Zingo…",
    slot: 4,
    lane: 0,
    text: "The fund's own Zcash wallet. It only ever receives whole payout steps from round keys, never a gift directly, so its balance doesn't line up with any set of swaps.",
  },
  {
    id: "browser",
    label: "Donor's browser",
    sub: "keeps nothing",
    slot: 1,
    lane: 1,
    text: "Makes the gift key, locks a quote that pays it, seals the key into a note for the fund's current round and posts it. Once the note is stored, the page forgets everything.",
  },
  {
    id: "board",
    label: "Public board",
    sub: "4 Nostr relays",
    slot: 2,
    lane: 1,
    text: "Public relays anyone can read. Every note is ciphertext from a throwaway key with no recipient on it, so every Zeryth note looks like every other.",
  },
  {
    id: "vault",
    label: "Vault room",
    sub: "the fund's browser",
    slot: 3,
    lane: 1,
    text: "The fund's own browser. It opens the notes sealed to its round, follows each swap, collects the gifts and pays out. There is no Zeryth server behind it.",
  },
  {
    id: "burn",
    label: "Burn",
    sub: "after each payout",
    slot: 4,
    lane: 1,
    text: "Deletes the round's secret and every gift key it collected. The round's notes stay on the board, unreadable to everyone, the fund included.",
  },
];

type Kind = "money" | "note" | "act" | "burn";

const EDGES: { from: Id; to: Id; kind: Kind; says: string }[] = [
  { from: "donor", to: "near", kind: "money", says: "{from} pays a {to} deposit address" },
  { from: "near", to: "gift", kind: "money", says: "{from} delivers shielded ZEC to the {to}" },
  { from: "gift", to: "round", kind: "money", says: "The {from} is collected into the {to}" },
  { from: "round", to: "wallet", kind: "money", says: "The {from} pays whole steps out to the {to}" },
  { from: "browser", to: "near", kind: "act", says: "The {from} locks a quote with {to}" },
  { from: "browser", to: "gift", kind: "act", says: "The {from} makes the key for the {to}" },
  { from: "browser", to: "board", kind: "note", says: "The {from} posts the sealed note to the {to}" },
  { from: "board", to: "vault", kind: "note", says: "The {to} reads its round's notes from the {from}" },
  { from: "vault", to: "round", kind: "act", says: "The {from} collects into the {to} and pays out of it" },
  { from: "vault", to: "burn", kind: "act", says: "The {from} runs the {to} after each payout" },
  { from: "burn", to: "round", kind: "burn", says: "The {from} deletes the {to} and every gift key" },
];

/** The order a gift lives through, for the guided walk. */
const WALK: Id[] = ["browser", "donor", "near", "gift", "board", "vault", "round", "wallet", "burn"];
const WALK_MS = 3800;

const WIDE = { w: 1000, h: 300, nw: 142, nh: 62 };
const TALL = { w: 360, h: 800, nw: 142, nh: 62 };

function useNarrow() {
  const q = "(max-width: 700px)";
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function SystemMap() {
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.5 });
  const narrow = useNarrow();
  const [active, setActive] = useState<Id>("browser");
  const [touched, setTouched] = useState(false);
  const playing = inView && !touched && !reducedMotion();

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setActive((a) => WALK[(WALK.indexOf(a) + 1) % WALK.length]), WALK_MS);
    return () => clearInterval(t);
  }, [playing]);

  const L = narrow ? TALL : WIDE;
  const at = (n: Node) =>
    narrow ? { x: n.lane ? 262 : 98, y: 70 + n.slot * 165 } : { x: 92 + n.slot * 204, y: n.lane ? 250 : 50 };
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<Id, Node>;
  const node = byId[active];
  const near = new Set<Id>([active]);
  const links = EDGES.filter((e) => e.from === active || e.to === active);
  links.forEach((e) => (near.add(e.from), near.add(e.to)));

  const pick = (id: Id) => {
    setTouched(true);
    setActive(id);
  };

  return (
    <div ref={root} className="map">
      <svg
        className="map-svg"
        viewBox={`0 0 ${L.w} ${L.h}`}
        role="img"
        aria-label="How money and sealed notes move through Zeryth"
      >
        <defs>
          {(["money", "note", "act", "burn"] as Kind[]).map((k) => (
            <marker key={k} id={`map-tip-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto">
              <path d="M0 0 10 5 0 10z" className={`map-tip ${k}`} />
            </marker>
          ))}
        </defs>

        {EDGES.map((e) => {
          const a = at(byId[e.from]);
          const b = at(byId[e.to]);
          const [sx, sy] = clip(a, b, L.nw, L.nh);
          const [ex, ey] = clip(b, a, L.nw, L.nh);
          const d = `M${sx} ${sy} L${ex} ${ey}`;
          const lit = e.from === active || e.to === active;
          return (
            <g key={`${e.from}-${e.to}`} className={`map-edge ${e.kind} ${lit ? "is-lit" : ""}`}>
              <path d={d} markerEnd={`url(#map-tip-${e.kind})`} />
              {e.kind === "money" && !reducedMotion() && (
                <circle r="4.5" className="map-coin">
                  <animateMotion dur="2.4s" repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          );
        })}

        {NODES.map((n) => {
          const { x, y } = at(n);
          const on = n.id === active;
          return (
            <g
              key={n.id}
              className={`map-node lane-${n.lane} ${on ? "is-on" : ""} ${near.has(n.id) ? "" : "is-far"}`}
              transform={`translate(${x - L.nw / 2} ${y - L.nh / 2})`}
              tabIndex={0}
              role="button"
              aria-pressed={on}
              aria-label={n.label}
              onClick={() => pick(n.id)}
              onMouseEnter={() => pick(n.id)}
              onFocus={() => pick(n.id)}
              onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), pick(n.id))}
            >
              <rect width={L.nw} height={L.nh} rx="18" />
              <text x={L.nw / 2} y={L.nh / 2 - 4} className="map-label">
                {n.label}
              </text>
              <text x={L.nw / 2} y={L.nh / 2 + 15} className="map-sub">
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="map-caption" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="map-caption-step">
              {WALK.indexOf(active) + 1} of {WALK.length} in a gift's life
            </p>
            <h3>{node.label}</h3>
            <p>{node.text}</p>
            <ul className="map-links">
              {links.map((e) => (
                <li key={`${e.from}-${e.to}`} className={`k-${e.kind}`}>
                  <i />
                  <span>{say(e, active, byId, pick)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>

      <ul className="map-legend" aria-label="Key">
        <li className="k-money">
          <i />
          Money
        </li>
        <li className="k-note">
          <i />
          Sealed notes
        </li>
        <li className="k-act">
          <i />
          Actions
        </li>
        <li className="k-burn">
          <i />
          Deletion
        </li>
      </ul>
    </div>
  );
}

/** An edge as a sentence, with the node at the other end as a link. */
function say(e: (typeof EDGES)[number], active: Id, byId: Record<Id, Node>, pick: (id: Id) => void) {
  return e.says
    .split(/(\{from\}|\{to\})/)
    .filter(Boolean)
    .map((part, i) => {
      if (part !== "{from}" && part !== "{to}") return part;
      const id = part === "{from}" ? e.from : e.to;
      const label = byId[id].label;
      // Names sit mid-sentence, so they lose their capital, except a proper name or a first word.
      const name = i === 0 || label.startsWith("NEAR") ? label : label[0].toLowerCase() + label.slice(1);
      return id === active ? (
        <strong key={i}>{name}</strong>
      ) : (
        <button key={i} type="button" className="linkish" onClick={() => pick(id)}>
          {name}
        </button>
      );
    });
}

/** Where the line from `a` towards `b` leaves `a`'s box, with a little air. */
function clip(a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number): [number, number] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const pad = 7;
  const tx = dx === 0 ? Infinity : (w / 2 + pad) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (h / 2 + pad) / Math.abs(dy);
  const t = Math.min(tx, ty);
  return [round(a.x + dx * t), round(a.y + dy * t)];
}
const round = (n: number) => Math.round(n * 10) / 10;
