import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fundingAmount, fundingUri, issue, newBatch, parseZec, type Batch, type Engine } from "@zeryth/core";
import { loadBatches, saveBatches, useBatches } from "../../lib/store";
import { explorerTx, zecText } from "../../lib/format";
import { Qr } from "../../components/Qr";
import { CopyField } from "../../components/Copy";
import { Steps, sweepItems } from "../../components/Steps";

/**
 * Claim cards from the vault room: make a batch, pay its funding QR from the group's
 * wallet, split it across the cards in one transaction, print, forget.
 */
export function CardBatches({ engine }: { engine: Engine | null }) {
  const batches = useBatches();
  const [making, setMaking] = useState(false);

  return (
    <section className="panel cards-panel">
      <header className="cards-panel-head">
        <div>
          <h2 className="vault-h2">Claim cards</h2>
          <p className="small muted">
            Hand out help without a list of who got it. Each card holds its own key; whoever holds the card holds the money.
          </p>
        </div>
        {!making && (
          <button className="btn small" onClick={() => setMaking(true)} disabled={!engine}>
            Make claim cards
          </button>
        )}
      </header>

      <AnimatePresence>
        {making && engine && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <NewBatch engine={engine} onDone={() => setMaking(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {batches.length > 0 && (
        <ul className="batches">
          {[...batches].reverse().map((b) => (
            <BatchRow key={b.id} batch={b} engine={engine} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NewBatch({ engine, onDone }: { engine: Engine; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [count, setCount] = useState("10");
  const [each, setEach] = useState("0.01");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const make = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const n = Number(count);
    let per: bigint;
    try {
      per = parseZec(each);
      if (per < 50_000n) throw new Error();
    } catch {
      return setError("Each card needs at least 0.0005 ZEC, or claiming it costs more than it holds.");
    }
    if (!Number.isInteger(n) || n < 1 || n > 50) return setError("A batch holds between 1 and 50 cards.");
    setBusy(true);
    try {
      const b = await newBatch(engine, label.trim() || "Claim cards", n, per);
      saveBatches([...loadBatches(), b]);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="newbatch" onSubmit={make}>
      <label className="field">
        <span>What are they for?</span>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Food and water" maxLength={40} />
        <small>Printed on every card.</small>
      </label>
      <div className="newbatch-row">
        <label className="field">
          <span>How many cards</span>
          <input className="input num" value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" />
        </label>
        <label className="field">
          <span>ZEC on each</span>
          <input className="input num" value={each} onChange={(e) => setEach(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="sheet-actions">
        <button type="button" className="btn ghost small" onClick={onDone}>
          Cancel
        </button>
        <button className="btn small gold" disabled={busy}>
          {busy ? "Making keys…" : "Make the cards"}
        </button>
      </div>
    </form>
  );
}

function BatchRow({ batch, engine }: { batch: Batch; engine: Engine | null }) {
  const [stage, setStage] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const per = BigInt(batch.cards[0].zat);
  const total = fundingAmount(batch.cards.length, per);

  const update = (b: Batch) => saveBatches(loadBatches().map((x) => (x.id === b.id ? b : x)));

  const load = async () => {
    if (!engine) return;
    setErr("");
    setMsg("");
    setStage("witness");
    const b = structuredClone(batch);
    try {
      const txid = await issue(engine, b, (s) => setStage(s));
      update(b);
      if (!txid) setMsg("The payment hasn't arrived yet. Zcash blocks come about every 75 seconds; try again in a minute.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setStage(null);
    }
  };

  return (
    <li className="batch">
      <div className="batch-head">
        <strong>{batch.label}</strong>
        <span className="small muted">
          {batch.cards.length} cards, {zecText(per)} each
        </span>
      </div>

      {batch.status !== "issued" ? (
        <div className="batch-fund">
          <Qr value={engine ? fundingUri(engine, batch) : batch.funding.address} size={150} label="Funding QR code" />
          <div className="batch-fund-side">
            <p className="small">
              Scan this with your Zcash wallet and send exactly <strong className="num">{zecText(total, 8)}</strong>. That's every
              card plus the network fee for splitting it.
            </p>
            <CopyField value={batch.funding.address} label="Funding address" />
            {stage ? (
              <Steps items={sweepItems(stage)} />
            ) : (
              <button className="btn small gold" onClick={load} disabled={!engine}>
                I've paid. Load the cards
              </button>
            )}
            {msg && <p className="small muted">{msg}</p>}
            {err && <p className="err">{err}</p>}
          </div>
        </div>
      ) : (
        <div className="batch-done">
          <p className="small">
            Loaded in one transaction.{" "}
            {batch.fanoutTxid && (
              <a className="linkish" href={explorerTx(batch.fanoutTxid)} target="_blank" rel="noreferrer">
                See it
              </a>
            )}
          </p>
          <div className="sheet-actions">
            <a className="btn small gold" href={`#/print/${batch.id}`} target="_blank" rel="noreferrer">
              Print the cards
            </a>
            <button
              className="btn small ghost"
              onClick={() => {
                if (confirm("Forget this batch? The printed cards become the only copy of their keys.")) {
                  saveBatches(loadBatches().filter((x) => x.id !== batch.id));
                }
              }}
            >
              Forget this batch
            </button>
          </div>
          <p className="small muted">Once they're printed, forget the batch here. Then not even this browser knows which card went where.</p>
        </div>
      )}
    </li>
  );
}
