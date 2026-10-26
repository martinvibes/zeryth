import type { ReactNode } from "react";
import { ZecCoin } from "../landing/HowItWorks";
import { Mark } from "../../components/Mark";
import type { FlowBranch, FlowStep } from "./Flow";

/*
 * Small, faithful copies of the real screens, wording included. Everything inside is
 * sized in em against the screen's own width, so a screen scales like a picture.
 */

function Mini({ children, tone }: { children: ReactNode; tone?: "dark" | "sky" }) {
  return (
    <span className={`mini ${tone ?? ""}`} aria-hidden="true">
      {children}
    </span>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <span className="m-panel">{children}</span>;
}

function Btn({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "ink" | "ghost" }) {
  return <span className={`m-btn ${tone}`}>{children}</span>;
}

function Field({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <span className="m-field">
      <span className="m-label">{label}</span>
      <span className={`m-input ${big ? "big" : ""}`}>{value}</span>
    </span>
  );
}

type S = "done" | "doing" | "todo";
function Checks({ items }: { items: [string, S][] }) {
  return (
    <span className="m-steps">
      {items.map(([label, s]) => (
        <span key={label} className={`m-step ${s}`}>
          <i />
          {label}
        </span>
      ))}
    </span>
  );
}

function Pill({ tone, children }: { tone: "wait" | "move" | "ready" | "done"; children: ReactNode }) {
  return <span className={`m-pill ${tone}`}>{children}</span>;
}

/** A fixed, QR-looking pattern. Decorative: no screen here encodes anything real. */
function Qr() {
  const cells: [number, number][] = [];
  const bits = "1011010011101001010110110100101101011100101101001011010110100110101101001011010";
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (bits[y * 9 + x] === "1") cells.push([x, y]);
  const finder = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <rect x={x} y={y} width="3" height="3" rx="0.4" fill="none" stroke="currentColor" strokeWidth="0.7" />
      <rect x={x + 0.95} y={y + 0.95} width="1.1" height="1.1" fill="currentColor" />
    </g>
  );
  return (
    <span className="m-qr">
      <svg viewBox="-0.5 -0.5 16 16">
        {finder(0, 0)}
        {finder(12, 0)}
        {finder(0, 12)}
        {cells.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x + 3.5} y={y + 3.5} width="0.9" height="0.9" fill="currentColor" />
        ))}
      </svg>
    </span>
  );
}

function Card({ amount, label }: { amount: string; label: string }) {
  return (
    <span className="m-card">
      <span className="m-card-top">
        <Mark size={10} tone="frost" />
        {label}
      </span>
      <span className="m-card-amount">{amount}</span>
      <span className="m-card-qr" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Giving
// ---------------------------------------------------------------------------

export const GIVING: FlowStep[] = [
  {
    title: "Pick a coin",
    see: "The donor opens the fund's give link, picks what they're paying with and how much. The page shows what the fund will receive before anything is committed.",
    under: "The page reads the fund's current round from the public board, then asks NEAR Intents for a dry quote. Nothing is created and nothing is sent yet.",
    screen: (
      <Mini tone="sky">
        <span className="m-round">
          <i className="m-dot" />
          Round 3 open
        </span>
        <span className="m-title">Lagos Mutual Aid</span>
        <Panel>
          <span className="m-label">What are you giving?</span>
          <span className="m-chips">
            <span className="is-on">
              USDC<small>Base</small>
            </span>
            <span>
              USDC<small>Solana</small>
            </span>
            <span>
              ETH<small>Ethereum</small>
            </span>
            <span>
              BTC<small>Bitcoin</small>
            </span>
          </span>
          <span className="m-input big">25 USDC</span>
          <span className="m-note">The fund receives about 0.02 ZEC</span>
          <Btn>Get my deposit address</Btn>
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Seal the gift",
    see: "A short checklist runs while the page gets the donor's deposit address ready. It takes a few seconds.",
    under: "The browser makes a brand-new Zcash key for this one gift, locks a live quote that pays its address, and posts the key to the board encrypted to this round. The deposit address appears only after 2 of the 4 relays have stored the note, so a paid gift can always be found.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-h">Getting your address ready</span>
          <Checks
            items={[
              ["Checking the fund's current round", "done"],
              ["Making a private address for this gift", "done"],
              ["Locking in the price with NEAR Intents", "done"],
              ["Leaving the sealed note for the fund", "doing"],
            ]}
          />
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Pay",
    see: "The donor sends the exact amount to the deposit address: scan the QR, copy the address, or pay straight from a browser wallet. The price holds for an hour.",
    under: "The deposit address belongs to NEAR Intents and is used for this payment only. Paying it is an ordinary transfer on the donor's own chain.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-label">Send exactly</span>
          <span className="m-amount">25 USDC</span>
          <span className="m-sub">on Base</span>
          <span className="m-pay">
            <Qr />
            <span className="m-addr">
              0x7a3c…f19c
              <span className="m-copy">Copy</span>
            </span>
          </span>
          <Btn tone="ghost">Pay from my browser wallet</Btn>
          <span className="m-note">59 minutes left</span>
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Watch the swap",
    see: "The page follows the payment through the swap. The donor can close it at any point; the gift arrives either way.",
    under: "NEAR Intents sees the deposit, swaps it to ZEC and delivers it, shielded, to the gift's one-time address. The page only polls the swap's status.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-h">Your gift is on its way</span>
          <Checks
            items={[
              ["Waiting for your payment", "done"],
              ["Swapping it to Zcash", "doing"],
              ["Arrived as private Zcash", "todo"],
            ]}
          />
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Arrived",
    see: "The gift sits at its own private address until the fund collects it. The page says plainly what the fund gets and what it kept.",
    under: "The donor's browser keeps nothing. The only copy of the gift's key is the sealed note, which only this round's key can open.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-burst">
            <ZecCoin size={40} />
          </span>
          <span className="m-h">Your gift arrived as private Zcash.</span>
          <span className="m-kept">What this page kept: nothing.</span>
          <Btn>Give again</Btn>
        </Panel>
      </Mini>
    ),
  },
];

export const GIVING_BRANCHES: FlowBranch[] = [
  {
    from: 3,
    title: "Not paid within the hour",
    text: "The quote expires and nothing happens. Nothing was sent, so there's nothing to refund.",
  },
  {
    from: 4,
    title: "The swap can't go through",
    text: "NEAR Intents sends the payment back to the refund address the donor gave, on the chain they paid from.",
  },
];

// ---------------------------------------------------------------------------
// Starting a fund
// ---------------------------------------------------------------------------

export const STARTING: FlowStep[] = [
  {
    title: "Name the fund",
    see: "A name, one public line about it, and the Zcash wallet where payouts should land. That's the whole form.",
    under: "The wallet address is checked on the spot: it has to be a u1 address from a wallet that supports Ironwood, like Zodl or Zingo.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-h">Start a fund</span>
          <Field label="Fund name" value="Lagos Mutual Aid" />
          <Field label="One line about it" value="Medical bills and legal aid" />
          <Field label="Your Zcash wallet address" value="u1qz8x…4ewp" />
          <Btn>Create the fund</Btn>
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Keys are made",
    see: "A few seconds of setup, all of it in this browser.",
    under: "The browser makes the fund's public identity (a Nostr key), opens round 1 with its own secret, and signs a round notice that tells donors' browsers which key to seal their notes to.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-h">Creating Lagos Mutual Aid</span>
          <Checks
            items={[
              ["Making the fund's public identity", "done"],
              ["Opening round 1 and posting it to the board", "done"],
              ["Saving the keys in this browser", "doing"],
            ]}
          />
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Share and back up",
    see: "The give link, as text and a QR code, and a firm prompt to download a backup before doing anything else.",
    under: "The link names the fund's public identity and nothing else. The backup file is the only other copy of the keys: if this browser is cleared without one, the current round can't be collected.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-h">Lagos Mutual Aid is live.</span>
          <span className="m-pay">
            <Qr />
            <span className="m-addr">
              zeryth…/give/npub1k…
              <span className="m-copy">Copy</span>
            </span>
          </span>
          <span className="m-warn">
            <b>Save a backup now.</b>
            The fund's keys live only in this browser.
          </span>
          <Btn>Open the vault room</Btn>
        </Panel>
      </Mini>
    ),
  },
  {
    title: "The vault room",
    see: "The fund's home: the give link, round 1 waiting for gifts, and the controls for everything that comes next.",
    under: "Nothing here talks to a Zeryth server, because there isn't one. The room reads the public board and the Zcash chain directly.",
    screen: (
      <Mini tone="sky">
        <span className="m-title sm">Lagos Mutual Aid</span>
        <Panel>
          <span className="m-row">
            <span className="m-h">Round 1</span>
            <span className="m-big">0 ZEC</span>
          </span>
          <span className="m-empty">No gifts yet.</span>
          <Btn tone="ink">Close round 1 and open round 2</Btn>
        </Panel>
      </Mini>
    ),
  },
];

// ---------------------------------------------------------------------------
// Running a fund
// ---------------------------------------------------------------------------

export const RUNNING: FlowStep[] = [
  {
    title: "Gifts show up",
    see: "Each gift appears as a row with a plain status, from waiting for the donor to ready to collect.",
    under: "Every 90 seconds the room reads the board, tries this round's key on every new note, keeps the ones that open, and follows each one's swap on NEAR Intents.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-row">
            <span className="m-h">Round 3</span>
            <span className="m-big">0.0484 ZEC</span>
          </span>
          <span className="m-gift">
            <Pill tone="wait">Waiting for the donor to pay</Pill>
            <span>25 USDC on Base</span>
          </span>
          <span className="m-gift">
            <Pill tone="move">Swapping to Zcash</Pill>
            <span>0.4 SOL</span>
          </span>
          <span className="m-gift">
            <Pill tone="ready">Arrived, ready to collect</Pill>
            <span className="m-gift-act">
              0.0002 BTC <span className="m-copy">Collect</span>
            </span>
          </span>
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Collect",
    see: "One tap moves a gift into the round. The browser proves the transaction itself, so allow a minute or two, a little longer the first time.",
    under: "A shielded transaction moves the gift from its one-time address into the round's own key. On the chain it shows no addresses and no amounts.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-h">Collecting 1 gift</span>
          <Checks
            items={[
              ["Finding the money on the chain", "done"],
              ["Getting the proving keys ready", "done"],
              ["Proving the payment privately", "doing"],
              ["Sending it to the Zcash network", "todo"],
            ]}
          />
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Close the round",
    see: "When it's time to pay out, the fund closes the round. New gifts start landing in the next one straight away.",
    under: "A fresh round secret is made and a new notice is signed. The old round stops taking new donors but keeps collecting gifts whose swaps were already on their way.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-row">
            <span className="m-h">Round 4</span>
            <Pill tone="done">Open</Pill>
          </span>
        </Panel>
        <span className="m-panel gold">
          <span className="m-row">
            <span className="m-h">Round 3</span>
            <span className="m-big">0.0484 ZEC</span>
          </span>
          <span className="m-note">Every gift has settled.</span>
          <Btn>Pay out and burn round 3</Btn>
        </span>
      </Mini>
    ),
  },
  {
    title: "Pay out",
    see: "A clear plan before anything moves: what goes to the wallet, what carries over, and the network fee.",
    under: "Only whole payout steps go to the fund's wallet. The rest rides into the next round, so the wallet never holds a total that lines up with a set of public swaps.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-h">Pay out and burn round 3</span>
          <span className="m-plan">
            <span>
              To your wallet<b>0.04 ZEC</b>
            </span>
            <span>
              Carried into round 4<b>0.00825 ZEC</b>
            </span>
            <span>
              Network fee<b>0.00015 ZEC</b>
            </span>
          </span>
          <Btn>Pay out and burn</Btn>
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Burn",
    see: "The round's keys turn to embers on screen, and the room says so: round 3 is gone.",
    under: "The round's secret and every gift key it collected are deleted from the device. The sealed notes on the board can't be opened by anyone now, the fund included.",
    screen: (
      <Mini tone="dark">
        <span className="m-embers">
          {"k7Qp2xVb9mRt4LzW".split("").map((c, i) => (
            <span key={i} style={{ ["--i" as string]: i }}>
              {c}
            </span>
          ))}
        </span>
        <span className="m-gone">Round 3 is gone.</span>
        <span className="m-note">0 keys left.</span>
      </Mini>
    ),
  },
];

// ---------------------------------------------------------------------------
// Claim cards
// ---------------------------------------------------------------------------

export const CARDS: FlowStep[] = [
  {
    title: "Make a batch",
    see: "In the vault room: what the cards are for, how many, and how much Zcash goes on each.",
    under: "The room makes one funding key and a separate key for every card, up to 50 per batch.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-h">Claim cards</span>
          <Field label="What are they for?" value="Medical" />
          <span className="m-two">
            <Field label="How many cards" value="5" />
            <Field label="ZEC on each" value="0.02" />
          </span>
          <Btn>Make the cards</Btn>
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Fund them",
    see: "The fund pays one QR code from its own wallet, then taps to load the cards.",
    under: "One transaction splits the funding across every card at once. No list of who gets which card exists anywhere.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-label">Pay from your wallet</span>
          <span className="m-amount sm">0.10025 ZEC</span>
          <span className="m-pay">
            <Qr />
            <span className="m-note">One payment covers all 5 cards and the fee.</span>
          </span>
          <Btn>I've paid. Load the cards</Btn>
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Print",
    see: "A print-ready sheet, two cards across, cut lines included. The page warns that whoever holds a card holds its money.",
    under: "Each QR code is a link with the card's key after the #. Browsers never send that part to a server, the site's host included.",
    screen: (
      <Mini>
        <span className="m-sheet">
          <Card amount="0.02 ZEC" label="Medical" />
          <Card amount="0.02 ZEC" label="Medical" />
          <Card amount="0.02 ZEC" label="Medical" />
          <Card amount="0.02 ZEC" label="Medical" />
        </span>
      </Mini>
    ),
  },
  {
    title: "Scan and claim",
    see: "The holder scans the card and picks: keep it as Zcash, or cash it out as USDC on Solana.",
    under: "The claim page finds the card's money on the chain in a few seconds, then sweeps it to the holder's address, or through NEAR Intents to their Solana wallet.",
    screen: (
      <Mini tone="sky">
        <Card amount="0.02 ZEC" label="Claim card" />
        <Panel>
          <span className="m-seg">
            <span className="is-on">Keep it as Zcash</span>
            <span>Cash out as USDC</span>
          </span>
          <Field label="Your Zcash address" value="u1…" />
          <Btn>Claim to my wallet</Btn>
        </Panel>
      </Mini>
    ),
  },
  {
    title: "Claimed",
    see: "The money is on its way to the holder's wallet. Scan the card again and it says it's already been claimed.",
    under: "The fund never learns who claimed a card or where the money went next. It only sees, from its own records, that a card is empty.",
    screen: (
      <Mini tone="sky">
        <Panel>
          <span className="m-burst">
            <ZecCoin size={40} />
          </span>
          <span className="m-h">Claimed. It's yours.</span>
          <span className="m-note">It shows up in your wallet in a few minutes.</span>
        </Panel>
      </Mini>
    ),
  },
];

export const CARDS_BRANCHES: FlowBranch[] = [
  {
    from: 4,
    title: "Someone else got there first",
    text: "A card pays whoever claims it first. Scanned after that, it shows when it was claimed and that it's empty.",
  },
  {
    from: 4,
    title: "Cashing out a small card",
    text: "NEAR Intents has a minimum swap size. If a card holds less, the page says so and offers Zcash instead.",
  },
];
