import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { feeToTransparent, followSwap, oneclick, type Engine, type Opened } from "@zeryth/core";
import { getEngine } from "../engine/client";
import { ClaimCard } from "../components/ClaimCard";
import { Steps, sweepItems, type StepState } from "../components/Steps";
import { Snowfall } from "../components/Snowfall";
import { ago, explorerTx, usd, zecText } from "../lib/format";
import "../styles/give.css";

const USDC_SOL = "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near";

type Look =
  | { at: "starting" }
  | { at: "scanning"; done: number; total: number }
  | { at: "bad"; why: string }
  | { at: "found"; opened: Opened };

export function Claim({ fragment }: { fragment: string }) {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [key, setKey] = useState<{ secret: string; birthday?: number; address: string } | null>(null);
  const [look, setLook] = useState<Look>({ at: "starting" });
  const [zecUsd, setZecUsd] = useState(0);
  const [mode, setMode] = useState<"zec" | "usdc">("zec");

  useEffect(() => {
    oneclick
      .tokens()
      .then((ts) => setZecUsd(ts.find((t) => t.assetId === "nep141:zec.omft.near")?.price ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const e = await getEngine();
        if (!alive) return;
        setEngine(e);
        const parsed = e.parseFragment(decodeURIComponent(fragment));
        const birthday = parsed.birthday ?? 0;
        const k = { ...parsed, address: e.keyFromSecret(parsed.secret, birthday).address };
        setKey(k);
        setLook({ at: "scanning", done: 0, total: 1 });
        const opened = await e.open({ secret: k.secret, birthday }, (done, total) => alive && setLook({ at: "scanning", done, total }));
        if (alive) setLook({ at: "found", opened });
      } catch (err) {
        if (alive) {
          setLook({
            at: "bad",
            why: /fragment|secret|decode/i.test(String(err))
              ? "This card's link is damaged or incomplete. Scan the QR again, or ask whoever gave you the card."
              : `Couldn't read the Zcash network just now: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [fragment]);

  const reopen = async () => {
    if (!engine || !key) return;
    const opened = await engine.open({ secret: key.secret, birthday: key.birthday ?? 0 });
    setLook({ at: "found", opened });
  };

  const total = look.at === "found" ? BigInt(look.opened.total_zat) : 0n;
  const amountText = look.at === "found" ? zecText(look.opened.total_zat) : "…";

  return (
    <div className="give claim">
      <div className="give-sky" aria-hidden="true" />
      <Snowfall density={0.5} />
      <div className="give-col">
        <motion.div
          className="claim-hero"
          initial={{ rotateX: 24, y: 30, opacity: 0 }}
          animate={{ rotateX: 0, y: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.25, duration: 1 }}
        >
          <ClaimCard amount={amountText} label="Claim card" />
        </motion.div>

        {look.at === "starting" && <p className="claim-wait muted">Opening the card…</p>}
        {look.at === "scanning" && (
          <div className="claim-wait">
            <p className="muted">Looking for this card's money on the Zcash chain…</p>
            <div className="bar">
              <span style={{ transform: `scaleX(${look.total ? look.done / look.total : 0})` }} />
            </div>
          </div>
        )}
        {look.at === "bad" && <p className="err">{look.why}</p>}

        {look.at === "found" && total === 0n && (
          <div className="panel give-panel">
            {look.opened.all_spent ? (
              <>
                <h1 className="give-title">This card has already been claimed.</h1>
                <p className="muted">
                  {spentWhen(look.opened)} If that wasn't you, someone else had the card or its link before you.
                </p>
              </>
            ) : (
              <>
                <h1 className="give-title">This card is empty for now.</h1>
                <p className="muted">
                  Nothing has been loaded onto it yet. If you just got it, the group may still be loading the batch. Check again in a
                  few minutes.
                </p>
                <button className="btn ghost" onClick={reopen}>
                  Check again
                </button>
              </>
            )}
          </div>
        )}

        {look.at === "found" && total > 0n && engine && key && (
          <div className="panel give-panel">
            <h1 className="give-title">
              This card holds <span className="num">{zecText(total)}</span>
              {zecUsd > 0 && <span className="claim-usd"> about {usd((Number(total) / 1e8) * zecUsd)}</span>}
            </h1>
            <p className="muted">Whoever claims it first gets it, so claim it now. Pick how you want it.</p>
            <div className="seg light" role="tablist">
              {(["zec", "usdc"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} className={`seg-btn ${mode === m ? "is-on" : ""}`} onClick={() => setMode(m)}>
                  {mode === m && <motion.span layoutId="claim-pill" className="seg-pill" />}
                  <span>{m === "zec" ? "Keep it as Zcash" : "Cash out as USDC"}</span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {mode === "zec" ? (
                <motion.div key="zec" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <ToZcash engine={engine} secret={key.secret} opened={look.opened} />
                </motion.div>
              ) : (
                <motion.div key="usdc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <ToUsdc engine={engine} cardKey={key} opened={look.opened} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function spentWhen(o: Opened): string {
  const t = o.notes.map((n) => n.spent_time ?? 0).reduce((a, b) => Math.max(a, b), 0);
  return t ? `It was claimed ${ago(t)}.` : "";
}

function ToZcash({ engine, secret, opened }: { engine: Engine; secret: string; opened: Opened }) {
  const [to, setTo] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [txid, setTxid] = useState("");
  const [err, setErr] = useState("");

  const problem = (() => {
    const a = to.trim();
    if (!a) return null;
    const c = engine.wasm.classify_address(a, "main");
    const r = c.reason ?? null;
    c.free();
    return r;
  })();

  const claim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setStage("witness");
    try {
      const out = await engine.sweep({ key: { secret }, notes: opened.notes, to: to.trim(), broadcast: true, onStage: setStage });
      setTxid(out.txid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setStage(null);
    }
  };

  if (txid) {
    return (
      <div className="claim-done">
        <h2 className="give-h2">Claimed. It's yours.</h2>
        <p className="muted">It shows up in your wallet in a few minutes, once the next blocks arrive.</p>
        <a className="linkish small" href={explorerTx(txid)} target="_blank" rel="noreferrer">
          See the transaction
        </a>
      </div>
    );
  }

  return (
    <form className="claim-form" onSubmit={claim}>
      <label className="field">
        <span>Your Zcash address</span>
        <input className="input mono-ish" value={to} onChange={(e) => setTo(e.target.value)} placeholder="u1…" spellCheck={false} autoComplete="off" />
        <small>From Zodl, Zingo or any Zcash wallet. A private (u1) address keeps it private.</small>
        {problem && <span className="err-inline small">{problem}</span>}
      </label>
      {stage && <Steps items={sweepItems(stage)} />}
      {err && <p className="err">{err}</p>}
      <button className="btn gold block" disabled={!to.trim() || !!problem || !!stage}>
        {stage ? "Claiming…" : "Claim to my wallet"}
      </button>
    </form>
  );
}

type Cash =
  | { at: "form" }
  | { at: "working"; step: number; stage?: string }
  | { at: "following"; status: string; deposit: string }
  | { at: "done"; out: string }
  | { at: "refunded" };

function ToUsdc({ engine, cardKey, opened }: { engine: Engine; cardKey: { secret: string; address: string }; opened: Opened }) {
  const [sol, setSol] = useState("");
  const [est, setEst] = useState<string>("");
  const [cash, setCash] = useState<Cash>({ at: "form" });
  const [err, setErr] = useState("");

  const notes = opened.notes.filter((n) => !n.spent);
  const sendable = BigInt(opened.total_zat) - feeToTransparent(notes.length);
  const validSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(sol.trim());

  useEffect(() => {
    if (!validSol || sendable <= 0n) return setEst("");
    let alive = true;
    oneclick
      .quoteFromZec({ destinationAsset: USDC_SOL, amountZat: sendable, recipient: sol.trim(), refundTo: cardKey.address, dry: true })
      .then((q) => alive && setEst(`You get about ${q.quote.amountOutFormatted} USDC on Solana.`))
      .catch((e) => {
        if (!alive) return;
        const min = oneclick.minimumFrom(e);
        setEst(min ? `NEAR Intents needs at least ${zecText(min)} to swap, more than this card holds. Keep it as Zcash instead.` : "");
      });
    return () => {
      alive = false;
    };
  }, [validSol, sol, sendable, cardKey.address]);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      setCash({ at: "working", step: 0 });
      // The swap is sized to exactly what the sweep will deliver, so 1Click sees the
      // deposit it quoted for and never a few zatoshi short.
      const q = await oneclick.quoteFromZec({
        destinationAsset: USDC_SOL,
        amountZat: sendable,
        recipient: sol.trim(),
        refundTo: cardKey.address,
        dry: false,
      });
      const deposit = q.quote.depositAddress;
      if (!deposit) throw new Error("NEAR Intents didn't return a deposit address.");
      setCash({ at: "working", step: 1, stage: "witness" });
      const out = await engine.sweep({
        key: { secret: cardKey.secret },
        notes,
        to: deposit,
        broadcast: true,
        onStage: (s) => setCash({ at: "working", step: 1, stage: s }),
      });
      oneclick.submitDeposit(out.txid, deposit).catch(() => {});
      setCash({ at: "following", status: "PENDING_DEPOSIT", deposit });
      const final = await followSwap(deposit, (s) => setCash({ at: "following", status: s.status, deposit }));
      if (final.status === "SUCCESS") setCash({ at: "done", out: final.swapDetails.amountOutFormatted ?? q.quote.amountOutFormatted });
      else setCash({ at: "refunded" });
    } catch (e) {
      setCash({ at: "form" });
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  if (cash.at === "done") {
    return (
      <div className="claim-done">
        <h2 className="give-h2">{cash.out} USDC is in your Solana wallet.</h2>
        <p className="muted">The card is empty now. You can throw it away.</p>
      </div>
    );
  }
  if (cash.at === "refunded") {
    return (
      <div className="claim-done">
        <h2 className="give-h2">The swap didn't go through.</h2>
        <p className="muted">The Zcash went back onto this card. Reload the page and claim it as Zcash, or try the cash-out again.</p>
      </div>
    );
  }
  if (cash.at === "working" || cash.at === "following") {
    const items: { label: string; state: StepState; note?: string }[] = [
      { label: "Getting a price from NEAR Intents", state: cash.at === "working" && cash.step === 0 ? "doing" : "done" },
      ...(cash.at === "working" && cash.step === 1
        ? sweepItems(cash.stage ?? "witness")
        : [{ label: "Sending the card's Zcash to the swap", state: (cash.at === "following" ? "done" : "todo") as StepState }]),
      {
        label: "Swapping to USDC on Solana",
        state: cash.at === "following" ? "doing" : "todo",
        note: cash.at === "following" ? "Usually a few minutes. You can leave this open." : undefined,
      },
    ];
    return <Steps items={items} />;
  }

  return (
    <form className="claim-form" onSubmit={go}>
      <label className="field">
        <span>Your Solana address</span>
        <input className="input mono-ish" value={sol} onChange={(e) => setSol(e.target.value)} placeholder="From Phantom, Solflare or Backpack" spellCheck={false} autoComplete="off" />
        <small>
          {est ||
            "USDC lands here. Note: this leaves Zcash, so the payout is public on Solana, like any Solana payment."}
        </small>
      </label>
      {err && <p className="err">{err}</p>}
      <button className="btn gold block" disabled={!validSol || sendable <= 0n}>
        Cash out as USDC
      </button>
    </form>
  );
}
