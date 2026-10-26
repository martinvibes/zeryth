import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { scrollToElement } from "../lib/smooth";
import { Mark } from "../components/Mark";
import { ZecCoin } from "./landing/HowItWorks";
import { Flow } from "./doc/Flow";
import { CARDS, CARDS_BRANCHES, GIVING, GIVING_BRANCHES, RUNNING, STARTING } from "./doc/screens";
import { SystemMap } from "./doc/SystemMap";
import { WhoSees } from "./doc/WhoSees";
import "../styles/doc.css";

const REPO = "https://github.com/martinvibes/zeryth";

const TOC: { group: string; items: [string, string][] }[] = [
  { group: "Start here", items: [["idea", "The idea"]] },
  {
    group: "Flows",
    items: [
      ["giving", "Giving"],
      ["starting", "Starting a fund"],
      ["running", "Running a fund"],
      ["cards", "Claim cards"],
    ],
  },
  {
    group: "Privacy",
    items: [
      ["privacy", "Who can see what"],
      ["keys", "Keys and the burn"],
      ["limits", "What it can't hide"],
    ],
  },
  {
    group: "Reference",
    items: [
      ["tech", "Under the hood"],
      ["faq", "Questions"],
    ],
  },
];
const IDS = TOC.flatMap((g) => g.items.map(([id]) => id));

/** Clears the fixed nav, and on phones the sticky contents strip under it too. */
const offset = () => (window.innerWidth < 960 ? -128 : -96);

export function Doc({ section }: { section: string }) {
  const [active, setActive] = useState(IDS.includes(section) ? section : "idea");

  // A link to a section (#/doc/keys) lands on it, on first load and after.
  useEffect(() => {
    if (!IDS.includes(section)) return;
    const t = setTimeout(() => scrollToElement(`#doc-${section}`, offset()), 650);
    return () => clearTimeout(t);
  }, [section]);

  // Scroll-spy: the section crossing the upper third of the screen is the current one.
  useEffect(() => {
    const els = IDS.map((id) => document.getElementById(`doc-${id}`)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id.slice(4));
      },
      { rootMargin: "-30% 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setActive(id);
    scrollToElement(`#doc-${id}`, offset());
    // The address follows along without a hash change, which would count as navigation.
    history.replaceState(null, "", `#/doc/${id}`);
  };

  return (
    <div className="doc">
      <Head go={go} />

      <div className="wrap doc-layout">
        <Toc active={active} go={go} />

        <article className="doc-body">
          <Section id="idea" title="The idea in one minute.">
            <div className="doc-prose">
              <p>
                Zeryth raises money for groups that might be frozen, raided or watched. Donors pay with whatever they hold,
                on whatever chain they hold it. The money arrives as shielded Zcash at an address nobody can tie to the
                group, and the group collects it in rounds. When a round is paid out, its keys are deleted, and the record
                of who gave goes with them.
              </p>
              <p>
                There is no Zeryth server and no account. The fund's keys live in the fund's own browser, the sealed notes
                live on public Nostr relays, and the swap runs through NEAR Intents.
              </p>
            </div>
            <dl className="doc-props">
              <div>
                <dt>Nothing to freeze</dt>
                <dd>No bank, no payment processor, no account with us. The money sits in shielded Zcash that only the fund's keys can move.</dd>
              </div>
              <div>
                <dt>Nothing to read</dt>
                <dd>Each gift reaches the fund as a sealed note on a public board. Every note looks the same and none of them names a fund.</dd>
              </div>
              <div>
                <dt>Nothing left to seize</dt>
                <dd>After each payout the round's keys are burned. A device taken later can't open the notes that would lead to donors.</dd>
              </div>
            </dl>

            <h3 className="doc-h3">Every piece, and how they connect.</h3>
            <p className="doc-hint">Tap any piece to see what it does and what it touches. Left alone, the map walks through a gift's life.</p>
            <SystemMap />
          </Section>

          <Section
            id="giving"
            title="Giving takes three minutes."
            lead="A donor needs the fund's give link and a wallet with something to give. No Zcash, no account, no app to install."
          >
            <Flow steps={GIVING} branches={GIVING_BRANCHES} />
          </Section>

          <Section
            id="starting"
            title="Starting a fund takes two."
            lead="A fund needs a name and a Zcash wallet to be paid into. Everything else is made in the browser, on the spot."
          >
            <Flow steps={STARTING} />
            <aside className="doc-callout">
              <strong>Back up before anything else.</strong> The fund's keys exist in one browser and in the backup file,
              and nowhere else. A cleared browser without a backup means the open round's gifts can't be collected.
            </aside>
          </Section>

          <Section
            id="running"
            title="Running a fund, round by round."
            lead="Gifts gather in a round. Close it, pay it out, burn it. The next round is already taking gifts while you do."
          >
            <Flow steps={RUNNING} />
            <RoundTrack />
          </Section>

          <Section
            id="cards"
            title="Claim cards: help without a list."
            lead="Money out matters as much as money in. A claim card is a printed QR code holding a little Zcash. Whoever holds it can claim it, and the fund never writes down who that was."
          >
            <Flow steps={CARDS} branches={CARDS_BRANCHES} />
          </Section>

          <Section
            id="privacy"
            title="Who can see what."
            lead="Pick someone who might be watching. This is everything they can learn about a single gift."
          >
            <WhoSees />
            <p className="doc-hint">
              The fund itself, before a burn, can see exactly what a raid before a burn would. Burning is what protects
              donors from both.
            </p>
          </Section>

          <Section id="keys" title="Keys, rounds and the burn." lead="Every key Zeryth makes, and the moment it stops existing.">
            <KeyLife />
          </Section>

          <Section
            id="limits"
            title="What Zeryth can't hide."
            lead="Privacy tools that oversell get people hurt. These are the edges, stated plainly."
          >
            <Limits />
          </Section>

          <Section id="tech" title="Under the hood." lead="What runs where, what each outside service sees, and the formats, for anyone checking our work.">
            <Tech />
          </Section>

          <Section id="faq" title="Questions people ask.">
            <Faq />
          </Section>

          <Credits />
        </article>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Head({ go }: { go: (id: string) => (e: React.MouseEvent) => void }) {
  const roles = [
    { id: "giving", who: "I want to give", what: "Pay with any coin, from any chain.", icon: <ZecCoin size={44} /> },
    { id: "starting", who: "I run a fund", what: "Start one, collect in rounds, pay out, burn.", icon: <Mark size={40} /> },
    { id: "cards", who: "I got a claim card", what: "Scan it, then keep the Zcash or cash it out.", icon: <MiniCard /> },
  ];
  return (
    <header className="doc-head wrap">
      <motion.h1
        initial={{ opacity: 0, y: 24, fontVariationSettings: '"wdth" 75' }}
        animate={{ opacity: 1, y: 0, fontVariationSettings: '"wdth" 118' }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        How Zeryth works.
      </motion.h1>
      <motion.p
        className="lead"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        Every screen a donor, a fund and a card holder sees, what happens underneath each one, and exactly who can learn
        what.
      </motion.p>
      <ul className="doc-roles">
        {roles.map((r, i) => (
          <motion.li
            key={r.id}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <a href={`#/doc/${r.id}`} onClick={go(r.id)} className="doc-role">
              <span className="doc-role-icon">{r.icon}</span>
              <span className="doc-role-who">{r.who}</span>
              <span className="doc-role-what">{r.what}</span>
            </a>
          </motion.li>
        ))}
      </ul>
    </header>
  );
}

function MiniCard() {
  return (
    <span className="doc-minicard" aria-hidden="true">
      <Mark size={12} tone="frost" />
      <i />
    </span>
  );
}

function Toc({ active, go }: { active: string; go: (id: string) => (e: React.MouseEvent) => void }) {
  const bar = useRef<HTMLDivElement>(null);

  // On phones the contents are a sideways strip; keep the current chip in sight.
  useEffect(() => {
    const strip = bar.current;
    const el = strip?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!strip || !el || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  return (
    <nav className="doc-toc" aria-label="On this page">
      <div ref={bar} className="doc-toc-inner">
        {TOC.map((g) => (
          <div key={g.group} className="doc-toc-group">
            <p className="doc-toc-title">{g.group}</p>
            <ul>
              {g.items.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#/doc/${id}`}
                    data-id={id}
                    onClick={go(id)}
                    className={id === active ? "is-on" : ""}
                    aria-current={id === active ? "location" : undefined}
                  >
                    {id === active && (
                      <motion.span layoutId="toc-on" className="doc-toc-on" transition={{ type: "spring", stiffness: 420, damping: 38 }} />
                    )}
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <a className="doc-toc-repo" href={REPO} target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </div>
    </nav>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={`doc-${id}`} className="doc-section" aria-labelledby={`doc-${id}-h`}>
      <h2 id={`doc-${id}-h`}>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rounds overlap: one is always open while the last one finishes.
// ---------------------------------------------------------------------------

function RoundTrack() {
  const rounds = [
    { n: 2, open: [0, 1], closing: [1, 2], burn: 2 },
    { n: 3, open: [1, 3], closing: [3, 4], burn: 4 },
    { n: 4, open: [3, 6], closing: null, burn: null },
  ];
  return (
    <figure className="track">
      <div className="track-rows">
        {rounds.map((r, i) => (
          <div key={r.n} className="track-row">
            <span className="track-name">Round {r.n}</span>
            <span className="track-lane">
              <motion.i
                className="track-open"
                style={{ left: `${(r.open[0] / 6) * 100}%`, width: `${((r.open[1] - r.open[0]) / 6) * 100}%` }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.8, delay: i * 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
              {r.closing && (
                <motion.i
                  className="track-closing"
                  style={{ left: `${(r.closing[0] / 6) * 100}%`, width: `${((r.closing[1] - r.closing[0]) / 6) * 100}%` }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.6, delay: i * 0.35 + 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              {r.burn !== null && (
                <motion.b
                  className="track-burn"
                  style={{ left: `${(r.burn / 6) * 100}%` }}
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ type: "spring", stiffness: 380, damping: 16, delay: i * 0.35 + 1.1 }}
                />
              )}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="track-key">
        <span>
          <i className="track-open" />
          Open: takes new gifts
        </span>
        <span>
          <i className="track-closing" />
          Closing: only waits for swaps already on their way
        </span>
        <span>
          <b className="track-burn" />
          Paid out and burned
        </span>
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Key lifetimes
// ---------------------------------------------------------------------------

const STAGES = ["Open", "Closing", "Paid out", "Burned"];
const KEYS: { name: string; what: string; life: [number, number] | null; burns?: boolean; note?: string }[] = [
  {
    name: "Gift keys",
    what: "One per gift. Made in the donor's browser, sealed into a note, opened by the vault room.",
    life: [0, 3],
    burns: true,
  },
  {
    name: "Round secret",
    what: "One per round. The notes are sealed to it and the round's money sits behind it.",
    life: [0, 3],
    burns: true,
  },
  {
    name: "Fund identity",
    what: "Signs each round notice so donors find the right round. Never touches money.",
    life: [0, 4],
  },
  {
    name: "Card keys",
    what: "One per claim card. Kept until you tap Forget this batch, whatever the round.",
    life: null,
    note: "Not tied to rounds",
  },
  {
    name: "Your wallet's keys",
    what: "Stay in Zodl, Zingo or whichever wallet you use. Zeryth only ever knows its address.",
    life: null,
    note: "Never in Zeryth",
  },
];

function KeyLife() {
  return (
    <div className="keys">
      <div className="keys-grid" role="table" aria-label="How long each key exists">
        <div className="keys-row keys-headrow" role="row">
          <span role="columnheader" className="keys-name-h">
            Key
          </span>
          {STAGES.map((s) => (
            <span key={s} role="columnheader" className="keys-stage">
              {s}
            </span>
          ))}
        </div>
        {KEYS.map((k, i) => (
          <div key={k.name} className="keys-row" role="row">
            <span role="rowheader" className="keys-name">
              <strong>{k.name}</strong>
              <span>{k.what}</span>
            </span>
            <span role="cell" className="keys-life">
              {k.life ? (
                <>
                  <motion.i
                    className={`keys-bar ${k.burns ? "burns" : ""}`}
                    style={{ gridColumn: `${k.life[0] + 1} / ${k.life[1] + 1}` }}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, amount: 0.8 }}
                    transition={{ duration: 0.9, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  />
                  {k.burns && (
                    <motion.span
                      className="keys-gone"
                      style={{ gridColumn: "4 / 5" }}
                      initial={{ opacity: 0, scale: 0.6 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, amount: 0.8 }}
                      transition={{ type: "spring", stiffness: 360, damping: 18, delay: 0.9 + i * 0.12 }}
                    >
                      Deleted
                    </motion.span>
                  )}
                </>
              ) : (
                <span className="keys-note">{k.note}</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="doc-hint">
        Burning deletes keys from the fund's browser. It can't reach a backup file saved before the burn, so save backups
        right after a burn and delete the old ones.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

const LIMITS = [
  {
    title: "Your side of the swap is public",
    body: "The payment you send on Base, Solana or any other chain is public there, like every payment on that chain. What it can't show is where the money went once it became Zcash.",
  },
  {
    title: "NEAR Intents sees the swap",
    body: "It sees what came in, what went out, and the refund address. Zeryth adds no fee and no tag, so nothing marks the swap as a gift, but it is still a record.",
  },
  {
    title: "IP addresses",
    body: "NEAR Intents, the relays and the Zcash servers see the IP address your browser connects from. Use Tor Browser or a VPN if that matters for you.",
  },
  {
    title: "The fund before it burns",
    body: "Until a round burns, its notes name each gift's deposit address, and following one back on the donor's chain finds the donor's wallet. Short rounds keep that window small.",
  },
  {
    title: "Copies and backups",
    body: "A fund that copies its keys elsewhere can still open old rounds. Burning protects donors from raids, not from a fund that keeps copies.",
  },
  {
    title: "Deleted isn't wiped",
    body: "The burn deletes keys from the browser's storage. That is not a forensic wipe of the disk. Full-disk encryption on the fund's device closes most of that gap.",
  },
  {
    title: "Timing",
    body: "A gift sent minutes before a payout is easier to guess at. Rounds and whole payout steps make matching hard, not impossible. Bigger, slower rounds hide more.",
  },
  {
    title: "Small gifts",
    body: "NEAR Intents has a minimum of about $2, and swap and network costs are a bigger share of a small gift: $2 arrives as roughly $1.60, $10 as roughly $9.60.",
  },
  {
    title: "New software",
    body: "Zeryth was built for a hackathon and hasn't been audited. The wallet engine is adapted from Zenvelope, also young. Start with amounts you can afford to lose to a bug.",
  },
];

function Limits() {
  return (
    <dl className="doc-limits">
      {LIMITS.map((l) => (
        <motion.div
          key={l.title}
          className="doc-limit"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <dt>{l.title}</dt>
          <dd>{l.body}</dd>
        </motion.div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Under the hood
// ---------------------------------------------------------------------------

const SERVICES = [
  {
    name: "Zcash light servers",
    who: "zec.rocks, with ChainSafe as the fallback",
    does: "Hand the browser the blocks it scans and carry its transactions to the network.",
    sees: "The IP address and which blocks it asks for. Never a key.",
    down: "The engine switches to the other server.",
  },
  {
    name: "NEAR Intents",
    who: "The 1Click API",
    does: "Quotes the price, gives the deposit address, runs the swap and delivers ZEC.",
    sees: "Both sides of the swap, the refund address and the IP address.",
    down: "No new gifts until it's back. Swaps already paid finish or refund.",
  },
  {
    name: "Nostr relays",
    who: "damus, nos.lol, primal, offchain.pub",
    does: "Store the round notices and the sealed notes.",
    sees: "Ciphertext, and the IP address that posted it.",
    down: "A note needs any 2 of the 4. A missing relay just isn't asked.",
  },
  {
    name: "This website",
    who: "Static files, no server code",
    does: "Serves the page and the wallet engine.",
    sees: "That a page was loaded. Never the part of a link after the #, where claim keys live.",
    down: "Any copy of the files works, from any host or from disk.",
  },
];

function Tech() {
  return (
    <>
      <div className="svc" role="table" aria-label="Outside services">
        <div className="svc-row svc-head" role="row">
          <span role="columnheader">Service</span>
          <span role="columnheader">What it does</span>
          <span role="columnheader">What it sees</span>
          <span role="columnheader">If it goes down</span>
        </div>
        {SERVICES.map((s) => (
          <div key={s.name} className="svc-row" role="row">
            <span role="rowheader" className="svc-name">
              <strong>{s.name}</strong>
              <span>{s.who}</span>
            </span>
            <span role="cell" data-label="What it does">
              {s.does}
            </span>
            <span role="cell" data-label="What it sees">
              {s.sees}
            </span>
            <span role="cell" data-label="If it goes down">
              {s.down}
            </span>
          </div>
        ))}
      </div>

      <div className="doc-tech">
        <div>
          <h3 className="doc-h3">The wallet engine</h3>
          <p>
            Rust, compiled to WebAssembly, running in a Web Worker so proving never freezes the page. It is adapted from
            Zenvelope (MIT) and builds shielded Ironwood transactions. The proving key is built in the browser the first
            time it's needed: there's no trusted setup and nothing extra to download.
          </p>
        </div>
        <div>
          <h3 className="doc-h3">Round keys</h3>
          <p>Each round has one random 32-byte secret. Two keys come from it through HKDF-SHA256:</p>
          <pre className="doc-code">
            <code>{`secret ─┬─ "zeryth/round/nostr-drop" → drop key
        └─ "zeryth/round/zcash-seed" → Zcash seed`}</code>
          </pre>
          <p>Delete the secret and both are gone. That's the whole burn.</p>
        </div>
        <div>
          <h3 className="doc-h3">The round notice</h3>
          <p>
            One replaceable Nostr event per fund (kind 30078, d tag <code>zeryth/round</code>), signed by the fund
            identity. A donor's browser reads it to learn which key to seal to.
          </p>
          <pre className="doc-code">
            <code>{`{ "v": 1, "round": 4, "drop": "<drop public key>",
  "name": "Lagos Mutual Aid", "tagline": "…", "opened": 1793000000 }`}</code>
          </pre>
        </div>
        <div>
          <h3 className="doc-h3">The sealed note</h3>
          <p>
            Kind 9419, tag <code>t=zeryth</code>, no <code>p</code> tag, signed by a key used once. The content is NIP-44
            v2, encrypted to the round's drop key:
          </p>
          <pre className="doc-code">
            <code>{`{ "v": 1,
  "k": "<gift key, base64url>",  "b": <birthday height>,
  "d": "<deposit address>",      "x": "<quote deadline>",
  "o": "<asset paid>",           "i": "<amount paid>",
  "e": "<ZEC promised, zatoshi>" }`}</code>
          </pre>
          <p>The deposit address is shown only after 2 of the 4 relays confirm they stored the note.</p>
        </div>
        <div>
          <h3 className="doc-h3">Fees and payouts</h3>
          <p>
            Network fees follow ZIP-317: 5,000 zatoshi per action, at least two actions, so most transactions cost
            0.0001 ZEC. A payout sends whole payout steps (0.01 ZEC unless the fund changes it) to the fund's wallet, and
            carries the rest into the open round's key.
          </p>
        </div>
        <div>
          <h3 className="doc-h3">Claim links and backups</h3>
          <p>A card's QR code is a link with the card's key after the #, which browsers never send to any server:</p>
          <pre className="doc-code">
            <code>{`https://<site>/#/claim/<card key>.<birthday height>`}</code>
          </pre>
          <p>
            A backup is one JSON file: the fund identity, every round still alive, and every card batch not yet forgotten.
            Anyone holding it holds the fund.
          </p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQ: [string, string][] = [
  [
    "Do I need Zcash to give?",
    "No. Give with USDC, ETH, SOL, BTC or anything else NEAR Intents can swap. The swap to Zcash happens on the way.",
  ],
  [
    "Does Zeryth ever hold the money?",
    "No. There's no Zeryth server to hold anything. Gifts sit at addresses whose keys only the fund's browser can open, and payouts go straight to the fund's own wallet.",
  ],
  [
    "Can I close the tab after paying?",
    "Yes. Once the page shows the deposit address, the sealed note is already on the board. The fund finds the gift whether or not your page stays open.",
  ],
  [
    "What if the swap fails?",
    "NEAR Intents sends the payment back to the refund address you gave, on the chain you paid from. If you never pay, the quote expires after an hour and nothing happens.",
  ],
  [
    "Can someone shut a fund down?",
    "There is no account to suspend and no server to seize. The give page is static files any host can serve, the board is spread over four independent relays, and the money is on Zcash. Someone could block one of those pieces; they can't freeze what's already given.",
  ],
  [
    "Why burn the keys?",
    "So a raid after a payout finds nothing that leads back to a donor. The money has moved on and the notes that described each gift can no longer be opened.",
  ],
  [
    "Which wallet should the fund use?",
    "Any Zcash wallet that supports Ironwood and gives you an address starting with u1, like Zodl or Zingo. Payouts land there as ordinary shielded payments.",
  ],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      {FAQ.map(([q, a], i) => (
        <div key={q} className={`faq-item ${open === i ? "is-open" : ""}`}>
          <h3>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span>{q}</span>
              <span className="faq-plus" aria-hidden="true" />
            </button>
          </h3>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                className="faq-a"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <p>{a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function Credits() {
  return (
    <footer className="doc-credits">
      <Mark size={30} />
      <p>
        Built for ZECATHON 2026. The wallet engine is adapted from{" "}
        <a href="https://github.com/IhorMuliar/zenvelope" target="_blank" rel="noreferrer">
          Zenvelope
        </a>{" "}
        (MIT). Swaps by NEAR Intents, the board on Nostr, chain access through zec.rocks.
      </p>
      <div className="doc-credits-links">
        <a className="btn ghost small" href={REPO} target="_blank" rel="noreferrer">
          Read the source
        </a>
        <a className="btn gold small" href="#/start">
          Start a fund
        </a>
      </div>
    </footer>
  );
}
