import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  fetchListedFunds,
  fetchNotice,
  followSwap,
  npubFromPubkey,
  oneclick,
  pubkeyFromNpub,
  startDonation,
  type Engine,
  type SignedNotice,
} from "@zeryth/core";
import { getEngine } from "../engine/client";
import {
  chainName,
  EVM_CHAINS,
  FEATURED,
  formatUnitsPlain,
  givable,
  parseUnitsPlain,
  paymentLink,
  type Token,
} from "../lib/assets";
import { connectedAddress, evmChain, hasBrowserWallet, pay, walletError } from "../lib/wallet";
import { ago, until, usd } from "../lib/format";
import { useVault } from "../lib/store";
import { Steps, type StepState } from "../components/Steps";
import { Qr } from "../components/Qr";
import { CopyField } from "../components/Copy";
import { Snowfall } from "../components/Snowfall";
import { ZecCoin } from "./landing/HowItWorks";
import { Icon } from "../components/Icons";
import { TokenLogo } from "../components/TokenLogo";
import "../styles/give.css";

type Fund =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "bad"; why: string }
  | { state: "ready"; pubkey: string; notice: SignedNotice };

/** What the donor needs to finish paying, kept for this tab only. Never the key. */
interface Pending {
  depositAddress: string;
  depositMemo?: string;
  assetId: string;
  amountIn: string;
  amountInFormatted: string;
  amountOutFormatted: string;
  deadline?: string;
  refundTo: string;
  relays: number;
  startedAt: number;
}

const pendingKey = (fund: string) => `zeryth.give.${fund}`;

export function Give({ fund }: { fund: string }) {
  const [state, setState] = useState<Fund>({ state: "loading" });

  useEffect(() => {
    if (!fund) return setState({ state: "missing" });
    let alive = true;
    setState({ state: "loading" });
    (async () => {
      let pubkey: string;
      try {
        pubkey = pubkeyFromNpub(fund);
      } catch {
        return alive && setState({ state: "bad", why: "This link doesn't point to a fund. Ask the organisers for their give link." });
      }
      try {
        const notice = await fetchNotice(pubkey);
        if (!alive) return;
        if (!notice) setState({ state: "bad", why: "This fund isn't taking gifts right now. Its organisers haven't opened a round yet." });
        else setState({ state: "ready", pubkey, notice });
      } catch {
        if (alive) setState({ state: "bad", why: "Couldn't reach the public board to find this fund. Check your connection and reload." });
      }
    })();
    return () => {
      alive = false;
    };
  }, [fund]);

  return (
    <div className="give">
      <div className="give-sky" aria-hidden="true" />
      <Snowfall density={0.45} />
      <div className="give-col">
        {state.state === "missing" && <PickFund />}
        {state.state === "loading" && <FundSkeleton />}
        {state.state === "bad" && (
          <div className="panel give-panel">
            <h1 className="give-title">Can't give to this fund</h1>
            <p className="lead">{state.why}</p>
            <a className="btn ghost" href="#/give/">
              Try another fund link
            </a>
          </div>
        )}
        {state.state === "ready" && <Donate fund={fund} pubkey={state.pubkey} notice={state.notice} />}
      </div>
    </div>
  );
}

function FundSkeleton() {
  return (
    <div className="give-head">
      <span className="skeleton" style={{ width: "40%", height: 18 }} />
      <span className="skeleton" style={{ width: "75%", height: 54, marginTop: 14 }} />
      <span className="skeleton" style={{ width: "60%", height: 18, marginTop: 14 }} />
      <p className="small muted" style={{ marginTop: 18 }}>
        Finding the fund on the public board…
      </p>
    </div>
  );
}

function PickFund() {
  const vault = useVault();
  const [funds, setFunds] = useState<SignedNotice[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetchListedFunds().then(
      (f) => alive && setFunds(f),
      () => {
        if (!alive) return;
        setFailed(true);
        setFunds([]);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const m = /(npub1[02-9ac-hj-np-z]+)/.exec(text.trim());
    if (!m) return setErr("Paste the fund's give link, or the npub inside it.");
    window.location.hash = `#/give/${m[1]}`;
  };

  return (
    <>
      <div className="give-head">
        <h1 className="give-title">Who do you want to help?</h1>
        <p className="lead">
          Pick a fund, then give from almost any wallet. It reaches them as private Zcash, and you get your own one-time address,
          so any number of people can give at once.
        </p>
      </div>

      <section className="pick" aria-busy={funds === null}>
        <h2 className="pick-h">
          <Icon name="list" />
          Funds that chose to be listed
        </h2>
        {funds === null ? (
          <ul className="fund-list">
            {[0, 1].map((i) => (
              <li key={i} className="fund-card is-loading">
                <span className="skeleton" style={{ width: "35%", height: 14 }} />
                <span className="skeleton" style={{ width: "70%", height: 28 }} />
                <span className="skeleton" style={{ width: "55%", height: 14 }} />
              </li>
            ))}
          </ul>
        ) : funds.length === 0 ? (
          <p className="pick-empty">
            {failed
              ? "Couldn't reach the public board to list funds. Check your connection, or paste a give link below."
              : "No funds are listed right now. Most funds share their own give link instead: paste it below."}
          </p>
        ) : (
          <ul className="fund-list">
            {funds.map((f, i) => {
              const npub = npubFromPubkey(f.pubkey);
              return (
                <motion.li
                  key={f.pubkey}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <a className="fund-card" href={`#/give/${npub}`}>
                    <span className="fund-live">
                      <span className="dot live" />
                      Round {f.round} open {ago(f.opened).replace(/ ago$/, "")}
                      {vault?.group.pubkey === f.pubkey ? ", your fund" : ""}
                    </span>
                    <span className="fund-name">{f.name}</span>
                    {f.tagline && <span className="fund-tagline">{f.tagline}</span>}
                    <span className="fund-go">
                      Give to {f.name}
                    </span>
                  </a>
                </motion.li>
              );
            })}
          </ul>
        )}
        <p className="pick-note small">
          <Icon name="info" />
          Funds list themselves. Zeryth doesn't check who runs them, so give to groups you trust.
        </p>
      </section>

      <form className="panel give-panel pick-link" onSubmit={submit}>
        <h2 className="give-h2">Have a give link?</h2>
        <label className="field">
          <span>Give link</span>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…/#/give/npub1…" />
        </label>
        {err && <p className="err">{err}</p>}
        <button className="btn gold block">Open the fund</button>
        {vault && !vault.listed && (
          <p className="small muted">
            Testing your own fund?{" "}
            <a className="linkish" href={`#/give/${vault.group.npub}`}>
              Give to {vault.name}
            </a>
          </p>
        )}
      </form>
    </>
  );
}

function Donate({ fund, pubkey, notice }: { fund: string; pubkey: string; notice: SignedNotice }) {
  const [pending, setPending] = useState<Pending | null>(() => {
    try {
      const p = JSON.parse(sessionStorage.getItem(pendingKey(fund)) ?? "null") as Pending | null;
      return p && Date.now() - p.startedAt < 3 * 3600_000 ? p : null;
    } catch {
      return null;
    }
  });

  const remember = (p: Pending | null) => {
    if (p) sessionStorage.setItem(pendingKey(fund), JSON.stringify(p));
    else sessionStorage.removeItem(pendingKey(fund));
    setPending(p);
  };

  return (
    <>
      <header className="give-head">
        <p className="give-round small">
          <span className="dot live" /> Round {notice.round} open since {ago(notice.opened)}
        </p>
        <h1 className="give-name">{notice.name}</h1>
        {notice.tagline && <p className="lead give-tagline">{notice.tagline}</p>}
      </header>
      <AnimatePresence mode="wait">
        {pending ? (
          <motion.div key="pay" {...swap}>
            <PayStage pending={pending} onReset={() => remember(null)} />
          </motion.div>
        ) : (
          <motion.div key="form" {...swap}>
            <GiveForm pubkey={pubkey} onReady={remember} />
          </motion.div>
        )}
      </AnimatePresence>
      <p className="give-promise small">
        Your browser makes the private address and the sealed note itself. Nothing about you is sent to Zeryth, because there
        is no Zeryth server.
      </p>
    </>
  );
}

const swap = {
  initial: { opacity: 0, y: 16, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, y: -10, filter: "blur(6px)", transition: { duration: 0.25 } },
};

type Est = { state: "idle" } | { state: "busy" } | { state: "ok"; zec: string; usd?: string; minutes: number } | { state: "err"; msg: string };

const SEAL_STEPS = [
  { key: "notice", label: "Checking the fund's current round" },
  { key: "key", label: "Making a private address for this gift" },
  { key: "quote", label: "Locking in the price with NEAR Intents" },
  { key: "drop", label: "Leaving the sealed note for the fund" },
] as const;

function GiveForm({ pubkey, onReady }: { pubkey: string; onReady: (p: Pending) => void }) {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [assetId, setAssetId] = useState(FEATURED[0]);
  const [more, setMore] = useState(false);
  const [amount, setAmount] = useState("10");
  const [refund, setRefund] = useState("");
  const [engine, setEngine] = useState<Engine | null>(null);
  const [est, setEst] = useState<Est>({ state: "idle" });
  const [sealing, setSealing] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    givable().then(setTokens, () => setError("Couldn't load the list of coins from NEAR Intents. Reload to try again."));
    getEngine().then(setEngine, () => setError("This browser couldn't start the Zcash engine. Try a current Chrome, Firefox or Safari."));
  }, []);

  const token = tokens?.find((t) => t.assetId === assetId);
  const units = token ? parseUnitsPlain(amount, token.decimals) : null;
  const amountUsd = token && units ? (Number(units) / 10 ** token.decimals) * token.price : 0;

  // Dry quotes need a real Zcash address to price against; any fresh one will do.
  const probe = useMemo(() => (engine ? engine.keyFromSecret(engine.wasm.generate_secret(), 0).address : null), [engine]);

  useEffect(() => {
    if (!token || !probe || !units || units === 0n) return setEst({ state: "idle" });
    setEst({ state: "busy" });
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const q = await oneclick.estimate({ originAsset: token.assetId, amount: units.toString(), recipient: probe });
        if (alive) {
          setEst({
            state: "ok",
            zec: q.quote.amountOutFormatted,
            usd: q.quote.amountOutUsd,
            minutes: Math.max(1, Math.round(q.quote.timeEstimate / 60)),
          });
        }
      } catch (e) {
        if (!alive) return;
        const min = oneclick.minimumFrom(e);
        setEst({
          state: "err",
          msg: min
            ? `The smallest gift in ${token.symbol} on ${chainName(token.blockchain)} is ${formatUnitsPlain(min, token.decimals)} ${token.symbol} right now.`
            : "NEAR Intents can't price this right now. Try another coin or amount.",
        });
      }
    }, 550);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [token, probe, units]);

  const featured = useMemo(
    () => (tokens ? FEATURED.map((id) => tokens.find((t) => t.assetId === id)).filter(Boolean) as Token[] : []),
    [tokens],
  );
  const evm = token ? EVM_CHAINS.has(token.blockchain) : false;

  const canGive = !!token && !!units && units > 0n && refund.trim().length > 0 && !!engine && est.state !== "err" && !sealing;

  const give = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGive || !token || !units || !engine) return;
    setError("");
    try {
      const d = await startDonation({
        engine,
        groupPubkey: pubkey,
        originAsset: token.assetId,
        amount: units.toString(),
        refundTo: refund.trim(),
        onStep: (s) => setSealing(s),
      });
      setSealing("done");
      await new Promise((r) => setTimeout(r, 700));
      onReady({
        depositAddress: d.depositAddress,
        depositMemo: d.depositMemo,
        assetId: token.assetId,
        amountIn: d.quote.quote.amountIn,
        amountInFormatted: d.quote.quote.amountInFormatted,
        amountOutFormatted: d.quote.quote.amountOutFormatted,
        deadline: d.quote.quote.deadline,
        refundTo: refund.trim(),
        relays: d.relays.length,
        startedAt: Date.now(),
      });
    } catch (e) {
      setSealing(null);
      setError(explain(e, token));
    }
  };

  if (sealing) {
    const at = sealing === "done" ? SEAL_STEPS.length : SEAL_STEPS.findIndex((s) => s.key === sealing);
    return (
      <div className="panel give-panel sealing">
        <div className="sealing-art" aria-hidden="true">
          <span className="sealing-ring" />
          <ZecCoin size={76} />
        </div>
        <h2 className="give-h2">Getting your address ready</h2>
        <Steps
          items={SEAL_STEPS.map((s, i) => ({
            label: s.label,
            state: (i < at ? "done" : i === at ? "doing" : "todo") as StepState,
          }))}
        />
      </div>
    );
  }

  return (
    <form className="panel give-panel" onSubmit={give}>
      <fieldset className="give-field">
        <legend>What are you giving?</legend>
        {!tokens ? (
          <div className="token-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="skeleton token-skel" />
            ))}
          </div>
        ) : (
          <>
            <div className="token-grid" role="radiogroup" aria-label="Coin">
              {featured.map((t) => (
                <TokenChip key={t.assetId} t={t} on={t.assetId === assetId} pick={() => setAssetId(t.assetId)} />
              ))}
            </div>
            {token && !FEATURED.includes(token.assetId) && (
              <div className="token-grid one">
                <TokenChip t={token} on pick={() => {}} />
              </div>
            )}
            <button type="button" className="linkish small" onClick={() => setMore((m) => !m)}>
              {more ? "Hide the full list" : `Pay with something else (${tokens.length} coins)`}
            </button>
            <AnimatePresence>
              {more && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <AllTokens tokens={tokens} pick={(id) => (setAssetId(id), setMore(false))} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </fieldset>

      <label className="field">
        <span>How much?</span>
        <div className="amount">
          <input
            className="input amount-input num"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            aria-describedby="est"
          />
          <span className="amount-unit">
            {token && <TokenLogo t={token} className="is-small" />}
            {token?.symbol ?? ""}
          </span>
        </div>
        <span id="est" className="estimate" aria-live="polite">
          {amountUsd > 0 && <span className="muted">{usd(amountUsd)}. </span>}
          {est.state === "busy" && <span className="muted">Pricing it…</span>}
          {est.state === "ok" && (
            <span>
              The fund receives about <strong className="num">{est.zec} ZEC</strong>, usually within{" "}
              {Math.max(est.minutes * 3, 20)} minutes of your payment.
            </span>
          )}
          {est.state === "err" && <span className="err-inline">{est.msg}</span>}
        </span>
      </label>

      <label className="field">
        <span>Your refund address{token ? ` on ${chainName(token.blockchain)}` : ""}</span>
        <div className="refund">
          <input
            className="input mono-ish"
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
            placeholder={token ? placeholderFor(token) : ""}
            spellCheck={false}
            autoComplete="off"
          />
          {evm && hasBrowserWallet() && (
            <button
              type="button"
              className="btn small ghost"
              onClick={async () => {
                try {
                  const a = await connectedAddress();
                  if (a) setRefund(a);
                } catch (e) {
                  setError(walletError(e));
                }
              }}
            >
              Use my wallet
            </button>
          )}
        </div>
        <small>
          Only used if the swap can't go through: your {token?.symbol ?? "coins"} come back here. Use an address you control.
        </small>
      </label>

      {error && <p className="err">{error}</p>}

      <button className="btn gold block give-cta" disabled={!canGive}>
        {engine ? "Get my deposit address" : "Starting the Zcash engine…"}
      </button>
    </form>
  );
}

function TokenChip({ t, on, pick }: { t: Token; on: boolean; pick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`token ${on ? "is-on" : ""}`} onClick={pick}>
      <TokenLogo t={t} />
      <span className="token-text">
        <span className="token-sym">{t.symbol}</span>
        <span className="token-chain">{chainName(t.blockchain)}</span>
      </span>
      {on && <motion.span layoutId="token-ring" className="token-ring" transition={{ type: "spring", bounce: 0.25, duration: 0.45 }} />}
    </button>
  );
}

function AllTokens({ tokens, pick }: { tokens: Token[]; pick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const list = tokens
    .filter((t) => `${t.symbol} ${chainName(t.blockchain)}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .slice(0, 60);
  return (
    <div className="alltokens">
      <input className="input" placeholder="Search, e.g. USDT or Polygon" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul>
        {list.map((t) => (
          <li key={t.assetId}>
            <button type="button" onClick={() => pick(t.assetId)}>
              <TokenLogo t={t} className="is-small" />
              <strong>{t.symbol}</strong> <span className="muted">on {chainName(t.blockchain)}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="muted small">No coin matches that.</li>}
      </ul>
    </div>
  );
}

function placeholderFor(t: Token): string {
  if (EVM_CHAINS.has(t.blockchain)) return "0x…";
  if (t.blockchain === "sol") return "Your Solana address";
  if (t.blockchain === "btc") return "bc1…";
  if (t.blockchain === "tron") return "T…";
  return `Your ${chainName(t.blockchain)} address`;
}

function explain(e: unknown, token: Token): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/refundTo is not valid/i.test(msg)) return `That refund address isn't a valid ${chainName(token.blockchain)} address.`;
  if (/too low/i.test(msg)) {
    const min = oneclick.minimumFrom(e);
    return min ? `That's below the smallest gift NEAR Intents will swap: ${formatUnitsPlain(min, token.decimals)} ${token.symbol}.` : msg;
  }
  if (/relay/i.test(msg)) {
    return "Couldn't leave the sealed note on enough relays, so we stopped before showing you an address. Nothing was sent. Try again in a moment.";
  }
  if (/round/i.test(msg)) return "This fund isn't taking gifts right now. Its organisers haven't opened a round.";
  return msg;
}

// ---------------------------------------------------------------------------

type Phase = "waiting" | "seen" | "swapping" | "arrived" | "short" | "refunded" | "failed";

function PayStage({ pending, onReset }: { pending: Pending; onReset: () => void }) {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [clock, setClock] = useState(0);
  const [walletMsg, setWalletMsg] = useState("");
  const [paying, setPaying] = useState(false);
  const [refundTx, setRefundTx] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    givable().then(setTokens, () => setTokens([]));
  }, []);

  useEffect(() => {
    const c = new AbortController();
    abort.current = c;
    followSwap(
      pending.depositAddress,
      (s) => {
        if (s.status === "KNOWN_DEPOSIT_TX") setPhase("seen");
        else if (s.status === "PROCESSING") setPhase("swapping");
        else if (s.status === "SUCCESS") setPhase("arrived");
        else if (s.status === "INCOMPLETE_DEPOSIT") setPhase("short");
        else if (s.status === "REFUNDED") {
          setPhase("refunded");
          setRefundTx(s.swapDetails.originChainTxHashes?.[0]?.explorerUrl ?? null);
        } else if (s.status === "FAILED") setPhase("failed");
      },
      { signal: c.signal, intervalMs: 4000 },
    ).catch(() => {});
    return () => c.abort();
  }, [pending.depositAddress]);

  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const token = tokens?.find((t) => t.assetId === pending.assetId);
  const chainId = token ? evmChain(token.blockchain)?.id : undefined;
  const link = token ? paymentLink(token, pending.depositAddress, BigInt(pending.amountIn), token.decimals, chainId) : pending.depositAddress;
  const canWallet = token && EVM_CHAINS.has(token.blockchain) && hasBrowserWallet();
  const left = pending.deadline ? until(pending.deadline) : null;
  void clock;

  const statusItems: { label: string; state: StepState; note?: string }[] = [
    {
      label: phase === "waiting" ? "Waiting for your payment" : "Payment received",
      state: phase === "waiting" ? "doing" : phase === "short" ? "failed" : "done",
      note: phase === "short" ? "It was less than the amount above. Send the rest, or wait and it will be refunded." : undefined,
    },
    {
      label: "Swapping it to Zcash",
      state: phase === "seen" || phase === "swapping" ? "doing" : phase === "arrived" ? "done" : phase === "refunded" || phase === "failed" ? "failed" : "todo",
    },
    { label: "Arrived as private Zcash", state: phase === "arrived" ? "done" : "todo" },
  ];

  if (phase === "arrived") return <Arrived pending={pending} onReset={onReset} />;

  return (
    <div className="panel give-panel pay">
      {phase === "refunded" || phase === "failed" ? (
        <>
          <h2 className="give-h2">{phase === "refunded" ? "Your payment was sent back" : "The swap didn't go through"}</h2>
          <p className="muted">
            {phase === "refunded"
              ? `NEAR Intents couldn't complete the swap in time, so it returned your ${token?.symbol ?? "coins"} to ${pending.refundTo}.`
              : "NEAR Intents reported a failure. If you paid, your coins are refunded to your refund address."}
          </p>
          {refundTx && (
            <a className="linkish small" href={refundTx} target="_blank" rel="noreferrer">
              See the refund
            </a>
          )}
          <button className="btn gold block" onClick={onReset}>
            Try again
          </button>
        </>
      ) : (
        <>
          <p className="pay-ask">
            Send exactly
            <span className="pay-amount-row">
              {token && <TokenLogo t={token} className="is-large" />}
              <span className="pay-amount num">
                {pending.amountInFormatted} {token?.symbol ?? ""}
              </span>
            </span>
            {token && <span className="pay-chain">on {chainName(token.blockchain)}</span>}
          </p>

          <div className="pay-grid">
            <Qr value={link} size={196} label="Deposit address QR code" />
            <div className="pay-side">
              <span className="small muted">To this deposit address</span>
              <CopyField value={pending.depositAddress} label="Deposit address" />
              {pending.depositMemo && (
                <>
                  <span className="small muted">With this memo, or the payment is lost</span>
                  <CopyField value={pending.depositMemo} label="Memo" />
                </>
              )}
              {canWallet && phase === "waiting" && (
                <button
                  className="btn block"
                  disabled={paying}
                  onClick={async () => {
                    setPaying(true);
                    setWalletMsg("");
                    try {
                      const hash = await pay(token!, pending.depositAddress, BigInt(pending.amountIn));
                      setWalletMsg("Sent. Waiting for NEAR Intents to see it…");
                      oneclick.submitDeposit(hash, pending.depositAddress).catch(() => {});
                    } catch (e) {
                      setWalletMsg(walletError(e));
                    } finally {
                      setPaying(false);
                    }
                  }}
                >
                  {paying ? "Confirm in your wallet…" : "Pay from my browser wallet"}
                </button>
              )}
              {walletMsg && <p className="small">{walletMsg}</p>}
            </div>
          </div>

          <div className="pay-meta small">
            <span>
              The fund receives about <strong className="num">{pending.amountOutFormatted} ZEC</strong>.
            </span>
            {left && phase === "waiting" && (
              <span className="muted">
                {left === "expired"
                  ? "This address has expired. Anything sent now is refunded."
                  : `Pay within ${left}. After that, payments are refunded.`}
              </span>
            )}
          </div>

          <Steps items={statusItems} />

          <p className="small muted pay-sealed">
            The key for this gift is already sealed on {pending.relays} public relays, so the fund can find it even if you close
            this tab now.
          </p>
          <button className="linkish small" onClick={onReset}>
            Start over with a different coin or amount
          </button>
        </>
      )}
    </div>
  );
}

function Arrived({ pending, onReset }: { pending: Pending; onReset: () => void }) {
  return (
    <motion.div className="panel give-panel arrived" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <div className="arrived-burst" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ ["--a" as string]: `${(i / 14) * 360}deg`, ["--d" as string]: `${(i % 3) * 0.08}s` }} />
        ))}
        <ZecCoin size={88} />
      </div>
      <h2 className="give-h2">Your gift arrived as private Zcash.</h2>
      <p className="muted">
        About {pending.amountOutFormatted} ZEC is now sitting at an address made only for your gift. The fund collects it with
        this round, then burns the key.
      </p>
      <ul className="arrived-kept small">
        <li>
          <strong>What the fund gets:</strong> the gift and the swap it came through. No name, no email, no account.
        </li>
        <li>
          <strong>What this page kept:</strong> nothing. Close it and the only copy of the gift's key is the sealed note.
        </li>
      </ul>
      <button className="btn gold block" onClick={onReset}>
        Give again
      </button>
    </motion.div>
  );
}

