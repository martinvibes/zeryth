import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  burn,
  openRound,
  payout,
  planPayout,
  readBoard,
  rotate,
  settled,
  sweepDonation,
  track,
  type DonationRecord,
  type Engine,
  type Round,
  type VaultState,
} from "@zeryth/core";
import { getEngine } from "../engine/client";
import { downloadBackup, loadVault, saveVault, useVault } from "../lib/store";
import { siteOrigin } from "../router";
import { ago, explorerTx, short, zecText } from "../lib/format";
import { chainName, formatUnitsPlain, givable, type Token } from "../lib/assets";
import { Steps, sweepItems, type StepState } from "../components/Steps";
import { CopyField } from "../components/Copy";
import { Qr } from "../components/Qr";
import { BurnCeremony } from "../components/BurnCeremony";
import { RaidReport } from "../components/RaidReport";
import { CardBatches } from "./vault/CardBatches";
import "../styles/vault.css";

/** One long job at a time, shown in a sheet with plain-language steps. */
type Task = {
  title: string;
  items: { label: string; state: StepState; note?: string }[];
  error?: string;
  done?: string;
};

export function Vault() {
  const vault = useVault();
  if (!vault) {
    return (
      <div className="vault-empty wrap">
        <h1>No fund in this browser yet.</h1>
        <p className="lead">Start one, or restore one from a backup file on the start page.</p>
        <a className="btn gold" href="#/start">
          Start a fund
        </a>
      </div>
    );
  }
  return <Room vault={vault} />;
}

function Room({ vault }: { vault: VaultState }) {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const [balances, setBalances] = useState<Record<number, { zat: bigint; notes: number }>>({});
  const [task, setTask] = useState<Task | null>(null);
  const [plan, setPlan] = useState<{ round: Round; total: bigint; toVault: bigint; carried: bigint; fee: bigint } | null>(null);
  const [ceremony, setCeremony] = useState<{ round: number; gifts: number } | null>(null);
  const [raid, setRaid] = useState(false);
  const [checkError, setCheckError] = useState("");
  const busy = useRef(false);

  const giftCount =
    vault.rounds.reduce((n, r) => n + r.donations.length, 0) + vault.burned.reduce((n, b) => n + b.donations, 0);
  const paidZat =
    vault.rounds.reduce((z, r) => z + BigInt(r.payout?.toVaultZat ?? 0), 0n) +
    vault.burned.reduce((z, b) => z + BigInt(b.toVaultZat ?? 0), 0n);

  useEffect(() => {
    getEngine().then(setEngine, () => setCheckError("This browser couldn't start the Zcash engine."));
    givable().then(setTokens, () => {});
  }, []);

  /** Runs `fn` on a fresh copy of the saved state and saves what it leaves behind. */
  const mutate = useCallback(async <T,>(fn: (s: VaultState) => Promise<T>): Promise<T> => {
    const s = structuredClone(loadVault()!);
    try {
      return await fn(s);
    } finally {
      saveVault(s);
    }
  }, []);

  const check = useCallback(async () => {
    if (!engine || busy.current) return;
    busy.current = true;
    setChecking(true);
    setCheckError("");
    try {
      await mutate(async (s) => {
        await readBoard(s);
        saveVault(s);
        await track(s, engine);
      });
      const s = loadVault()!;
      const next: Record<number, { zat: bigint; notes: number }> = {};
      for (const r of s.rounds) {
        const o = await engine.open({ secret: r.zcashSecret, birthday: r.birthday });
        next[r.index] = { zat: BigInt(o.total_zat), notes: o.notes.filter((n) => !n.spent).length };
      }
      setBalances(next);
      setLastCheck(Date.now());
    } catch (e) {
      setCheckError(`Couldn't finish checking: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, [engine, mutate]);

  useEffect(() => {
    if (!engine) return;
    check();
    const id = setInterval(check, 90_000);
    return () => clearInterval(id);
  }, [engine, check]);

  const runSweep = async (title: string, fn: (onStage: (s: string) => void) => Promise<string | void>, done: string) => {
    if (busy.current) return;
    busy.current = true;
    setTask({ title, items: sweepItems("witness") });
    try {
      const txid = await fn((stage) => setTask((t) => t && { ...t, items: sweepItems(stage) }));
      setTask((t) => t && { ...t, items: sweepItems(null, false, true), done: txid ? `${done} Transaction ${short(txid, 10, 8)}.` : done });
    } catch (e) {
      setTask((t) => t && { ...t, error: e instanceof Error ? e.message : String(e) });
    } finally {
      busy.current = false;
    }
  };

  const collect = (round: Round, d: DonationRecord) =>
    runSweep(
      "Collecting a gift into the round",
      (onStage) =>
        mutate(async (s) => {
          const r = s.rounds.find((x) => x.index === round.index)!;
          const dd = r.donations.find((x) => x.dropId === d.dropId)!;
          return sweepDonation(r, dd, engine!, onStage);
        }),
      "Collected.",
    ).then(check);

  const collectAll = async (round: Round) => {
    const arrived = round.donations.filter((d) => d.status === "arrived");
    for (const d of arrived) {
      await collect(round, d);
      if (!loadVault()?.rounds.find((r) => r.index === round.index)?.donations.find((x) => x.dropId === d.dropId)?.sweepTxid) break;
    }
  };

  const newRound = async () => {
    if (!engine || busy.current) return;
    busy.current = true;
    const current = openRound(vault);
    setTask({
      title: current ? `Closing round ${current.index}` : "Opening a round",
      items: [
        { label: "Making fresh keys for the next round", state: "doing" },
        { label: "Posting the new round to the board", state: "todo" },
      ],
    });
    try {
      await mutate(async (s) => {
        setTask((t) => t && { ...t, items: [{ ...t.items[0], state: "done" }, { ...t.items[1], state: "doing" }] });
        await rotate(s, engine);
      });
      setTask((t) =>
        t && {
          ...t,
          items: t.items.map((i) => ({ ...i, state: "done" as StepState })),
          done: current
            ? `Round ${current.index + 1} is open. Round ${current.index} stops taking new gifts and closes once the ones in flight land.`
            : "The round is open.",
        },
      );
    } catch (e) {
      setTask((t) => t && { ...t, error: e instanceof Error ? e.message : String(e) });
    } finally {
      busy.current = false;
    }
  };

  const preparePayout = async (round: Round) => {
    if (!engine) return;
    const o = await engine.open({ secret: round.zcashSecret, birthday: round.birthday });
    const notes = o.notes.filter((n) => !n.spent).length;
    const total = BigInt(o.total_zat);
    const p = total > 0n ? planPayout(total, notes, BigInt(vault.unitZat)) : { toVault: 0n, carried: 0n, fee: 0n };
    setPlan({ round, total, ...p });
  };

  const payAndBurn = async (round: Round) => {
    setPlan(null);
    const gifts = round.donations.filter((d) => d.status === "swept").length;
    await runSweep(
      `Paying out round ${round.index}`,
      (onStage) =>
        mutate(async (s) => {
          const r = s.rounds.find((x) => x.index === round.index)!;
          const out = await payout(s, r, engine!, onStage);
          burn(s, r);
          return out?.txid || undefined;
        }),
      "Paid out.",
    );
    if (!loadVault()?.rounds.some((r) => r.index === round.index)) {
      setTask(null);
      setCeremony({ round: round.index, gifts });
    }
  };

  const open = openRound(vault);
  const closing = vault.rounds.filter((r) => r.status === "closing");
  const giveLink = `${siteOrigin()}/#/give/${vault.group.npub}`;

  return (
    <div className="vault">
      <header className="vault-head wrap">
        <div>
          <p className="small muted">Vault room</p>
          <h1>{vault.name}</h1>
          {vault.tagline && <p className="lead">{vault.tagline}</p>}
        </div>
        <div className="vault-head-actions">
          <button className="btn ghost small" onClick={() => setRaid(true)}>
            What a raid would find
          </button>
          <button className="btn ghost small" onClick={downloadBackup}>
            Download backup
          </button>
        </div>
      </header>

      <div className="wrap vault-grid">
        <section className="panel vault-share">
          <h2 className="vault-h2">Your give link</h2>
          <p className="small muted">Share it anywhere. It names your fund's public identity, nothing else.</p>
          <div className="vault-share-row">
            <Qr value={giveLink} size={120} label="Give link QR code" />
            <div className="vault-share-side">
              <CopyField value={giveLink} label="Give link" />
              <a className="linkish small" href={`#/give/${vault.group.npub}`}>
                Open the give page
              </a>
            </div>
          </div>
        </section>

        <section className="panel vault-status">
          <dl className="vault-stats">
            <div>
              <dt>Gifts so far</dt>
              <dd className="num">{giftCount}</dd>
            </div>
            <div>
              <dt>Paid to your wallet</dt>
              <dd className="num">{zecText(paidZat)}</dd>
            </div>
            <div>
              <dt>Payout step</dt>
              <dd className="num">{zecText(BigInt(vault.unitZat))}</dd>
            </div>
          </dl>
          <div className="vault-status-row">
            <span className={`dot ${checking ? "gold" : "live"}`} />
            <span className="small">
              {checking
                ? "Checking the board and the chain…"
                : lastCheck
                  ? `Checked ${ago(Math.floor(lastCheck / 1000))}. Checks again every 90 seconds while this page is open.`
                  : engine
                    ? "Starting…"
                    : "Starting the Zcash engine…"}
            </span>
          </div>
          <button className="btn small" onClick={check} disabled={!engine || checking}>
            Check now
          </button>
          {checkError && <p className="err">{checkError}</p>}
        </section>

        {open && (
          <RoundPanel
            round={open}
            tokens={tokens}
            balance={balances[open.index]}
            onCollect={(d) => collect(open, d)}
            onCollectAll={() => collectAll(open)}
            action={
              <button className="btn" onClick={newRound} disabled={!engine}>
                Close round {open.index} and open round {open.index + 1}
              </button>
            }
            hint="Closing a round gives it fresh keys and stops new gifts landing on the old ones. Gifts already on their way still arrive."
          />
        )}

        {closing.map((r) => {
          const waiting = r.donations.filter((d) => d.status === "awaiting" || d.status === "swapping");
          const toCollect = r.donations.filter((d) => d.status === "arrived");
          const lastDeadline = waiting.map((d) => (d.deadline ? Date.parse(d.deadline) : 0)).reduce((a, b) => Math.max(a, b), 0);
          const ready = settled(r);
          return (
            <RoundPanel
              key={r.index}
              round={r}
              tokens={tokens}
              balance={balances[r.index]}
              onCollect={(d) => collect(r, d)}
              onCollectAll={() => collectAll(r)}
              action={
                <button className="btn gold" disabled={!ready || !engine} onClick={() => preparePayout(r)}>
                  Pay out and burn round {r.index}
                </button>
              }
              hint={
                ready
                  ? "Every gift for this round has landed or lapsed. Pay it out, and its keys are deleted for good."
                  : toCollect.length
                    ? `Collect the ${toCollect.length} arrived ${toCollect.length === 1 ? "gift" : "gifts"} first.`
                    : `Waiting on ${waiting.length} ${waiting.length === 1 ? "gift" : "gifts"} still in flight${
                        lastDeadline ? `, until ${new Date(lastDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} at the latest` : ""
                      }. Burning now would lose them.`
              }
            />
          );
        })}

        {vault.burned.length > 0 && (
          <section className="panel vault-burned">
            <h2 className="vault-h2">Burned rounds</h2>
            <ul>
              {[...vault.burned].reverse().map((b) => (
                <li key={b.index}>
                  <span className="burned-name">Round {b.index}</span>
                  <span className="small muted">
                    {b.donations} {b.donations === 1 ? "gift" : "gifts"}
                    {b.toVaultZat && b.toVaultZat !== "0" ? `, ${zecText(b.toVaultZat)} to your wallet` : ""}. Burned {ago(b.burnedAt)}. Keys held: none.
                  </span>
                  {b.payoutTxid && (
                    <a className="linkish small" href={explorerTx(b.payoutTxid)} target="_blank" rel="noreferrer">
                      Payout
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <CardBatches engine={engine} />

        <section className="vault-danger">
          <details>
            <summary className="small">Remove this fund from this browser</summary>
            <p className="small muted">
              Deletes every key this browser holds for {vault.name}. Gifts in live rounds that haven't been paid out become
              impossible to collect. Download a backup first if you might need them.
            </p>
            <button
              className="btn small danger"
              onClick={() => {
                if (confirm(`Delete ${vault.name} from this browser? This can't be undone without a backup.`)) {
                  saveVault(null);
                  window.location.hash = "#/";
                }
              }}
            >
              Delete from this browser
            </button>
          </details>
        </section>
      </div>

      <AnimatePresence>
        {task && <TaskSheet key="task" task={task} onClose={() => (busy.current ? null : setTask(null))} />}
        {plan && (
          <PlanSheet key="plan" plan={plan} vault={vault} onCancel={() => setPlan(null)} onConfirm={() => payAndBurn(plan.round)} />
        )}
        {ceremony && <BurnCeremony key="burn" round={ceremony.round} gifts={ceremony.gifts} onDone={() => setCeremony(null)} />}
        {raid && <RaidReport key="raid" state={vault} onClose={() => setRaid(false)} />}
      </AnimatePresence>
    </div>
  );
}

const STATUS: Record<DonationRecord["status"], { label: string; tone: string }> = {
  awaiting: { label: "Waiting for the donor to pay", tone: "wait" },
  swapping: { label: "Swapping to Zcash", tone: "move" },
  arrived: { label: "Arrived, ready to collect", tone: "ready" },
  swept: { label: "Collected into the round", tone: "done" },
  refunded: { label: "Refunded to the donor", tone: "off" },
  expired: { label: "Expired unpaid", tone: "off" },
  failed: { label: "Swap failed", tone: "off" },
};

function RoundPanel({
  round,
  tokens,
  balance,
  onCollect,
  onCollectAll,
  action,
  hint,
}: {
  round: Round;
  tokens: Token[];
  balance?: { zat: bigint; notes: number };
  onCollect: (d: DonationRecord) => void;
  onCollectAll: () => void;
  action: React.ReactNode;
  hint: string;
}) {
  const arrived = round.donations.filter((d) => d.status === "arrived");
  const gifts = [...round.donations].reverse();
  return (
    <motion.section layout className={`panel round round-${round.status}`}>
      <header className="round-head">
        <div>
          <p className="small muted">
            {round.status === "open" ? `Open since ${ago(round.openedAt)}` : `Closing since ${ago(round.closedAt ?? round.openedAt)}`}
          </p>
          <h2 className="vault-h2">Round {round.index}</h2>
        </div>
        <div className="round-balance">
          <span className="small muted">In the round now</span>
          <span className="round-balance-value num">{balance ? zecText(balance.zat) : "…"}</span>
        </div>
      </header>

      {gifts.length === 0 ? (
        <p className="round-empty muted">
          No gifts yet. When someone gives, their sealed note shows up here within a minute or two.
        </p>
      ) : (
        <ul className="gifts">
          <AnimatePresence initial={false}>
            {gifts.map((d) => (
              <motion.li
                key={d.dropId}
                layout
                initial={{ opacity: 0, y: -8, backgroundColor: "rgba(246,182,55,0.25)" }}
                animate={{ opacity: 1, y: 0, backgroundColor: "rgba(246,182,55,0)" }}
                transition={{ duration: 0.8 }}
                className="gift"
              >
                <span className={`pill pill-${STATUS[d.status].tone}`}>{STATUS[d.status].label}</span>
                <span className="gift-what">
                  {giftAmount(d, tokens)}
                  <span className="small muted"> {ago(d.seenAt)}</span>
                </span>
                {d.status === "arrived" && (
                  <button className="btn small gold" onClick={() => onCollect(d)}>
                    Collect
                  </button>
                )}
                {d.status === "swept" && d.sweepTxid && (
                  <a className="linkish small" href={explorerTx(d.sweepTxid)} target="_blank" rel="noreferrer">
                    Transaction
                  </a>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <footer className="round-foot">
        <p className="small muted">{hint}</p>
        <div className="round-actions">
          {arrived.length > 1 && (
            <button className="btn ghost" onClick={onCollectAll}>
              Collect all {arrived.length}
            </button>
          )}
          {action}
        </div>
      </footer>
    </motion.section>
  );
}

function giftAmount(d: DonationRecord, tokens: Token[]): string {
  const t = tokens.find((x) => x.assetId === d.originAsset);
  const from = t && d.amountIn ? ` from ${formatUnitsPlain(BigInt(d.amountIn), t.decimals)} ${t.symbol} on ${chainName(t.blockchain)}` : "";
  if (d.arrivedZat) return `${zecText(d.arrivedZat)}${from}`;
  if (d.expectedZat) return `About ${zecText(d.expectedZat)}${from}`;
  return `A gift${from}`;
}

function TaskSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const finished = !!task.done || !!task.error;
  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="sheet panel"
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        initial={{ y: 30, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1, transition: { type: "spring", bounce: 0.2, duration: 0.5 } }}
        exit={{ y: 20, opacity: 0 }}
      >
        <h2 className="vault-h2">{task.title}</h2>
        <Steps items={task.error ? task.items.map((i) => (i.state === "doing" ? { ...i, state: "failed" as StepState } : i)) : task.items} />
        {task.error && <p className="err">{task.error}</p>}
        {task.done && <p className="sheet-done">{task.done}</p>}
        <button className="btn block" disabled={!finished} onClick={onClose}>
          {finished ? "Close" : "Working…"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function PlanSheet({
  plan,
  vault,
  onCancel,
  onConfirm,
}: {
  plan: { round: Round; total: bigint; toVault: bigint; carried: bigint; fee: bigint };
  vault: VaultState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const next = openRound(vault);
  const gifts = plan.round.donations.filter((d) => d.status === "swept").length;
  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div
        className="sheet panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Pay out round ${plan.round.index}`}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { type: "spring", bounce: 0.2, duration: 0.5 } }}
        exit={{ y: 20, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="vault-h2">Pay out and burn round {plan.round.index}</h2>
        {plan.total === 0n ? (
          <p className="muted">This round holds nothing, so there's nothing to send. Its keys will simply be deleted.</p>
        ) : (
          <dl className="plan">
            <div>
              <dt>To your wallet</dt>
              <dd className="num plan-big">{zecText(plan.toVault)}</dd>
              <dd className="small muted">{short(vault.vaultAddress, 10, 8)}</dd>
            </div>
            <div>
              <dt>Carried into round {next?.index}</dt>
              <dd className="num">{zecText(plan.carried)}</dd>
              <dd className="small muted">Payouts are always whole steps of {zecText(vault.unitZat)}. The rest waits.</dd>
            </div>
            <div>
              <dt>Network fee</dt>
              <dd className="num">{zecText(plan.fee, 5)}</dd>
            </div>
          </dl>
        )}
        <p className="plan-warn small">
          Then round {plan.round.index}'s key and its {gifts} gift {gifts === 1 ? "key" : "keys"} are deleted from this browser. This
          can't be undone, and that's the point.
        </p>
        <div className="sheet-actions">
          <button className="btn ghost" onClick={onCancel}>
            Not yet
          </button>
          <button className="btn gold" onClick={onConfirm}>
            Pay out and burn
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
