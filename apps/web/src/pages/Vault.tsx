import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  burn,
  networkFee,
  openRound,
  parseZec,
  payout,
  planPayout,
  readBoard,
  rotate,
  setListed,
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
import { ago, explorerTx, short, span, zecText } from "../lib/format";
import { chainName, formatUnitsPlain, givable, type Token } from "../lib/assets";
import { Steps, sweepItems, type StepState } from "../components/Steps";
import { CopyField } from "../components/Copy";
import { Qr } from "../components/Qr";
import { BurnCeremony, type BurnSummary } from "../components/BurnCeremony";
import { Icon, type IconName } from "../components/Icons";
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
  const [ceremony, setCeremony] = useState<BurnSummary | null>(null);
  const [raid, setRaid] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [stepError, setStepError] = useState("");
  const [listing, setListing] = useState(false);
  const [listError, setListError] = useState("");
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
    const done: { summary?: BurnSummary } = {};
    await runSweep(
      `Paying out round ${round.index}`,
      (onStage) =>
        mutate(async (s) => {
          const r = s.rounds.find((x) => x.index === round.index)!;
          const moved = r.donations.filter((d) => d.status === "awaiting").length;
          const out = await payout(s, r, engine!, onStage);
          // Counted after payout: unpaid quotes have moved on with their keys.
          const gifts = r.donations.length;
          burn(s, r);
          done.summary = {
            round: r.index,
            gifts,
            moved,
            toVaultZat: out?.toVaultZat ?? "0",
            carriedZat: out?.carriedZat ?? "0",
            txid: out?.txid || undefined,
            next: openRound(s)?.index,
          };
          return out?.txid || undefined;
        }),
      "Paid out.",
    );
    if (done.summary && !loadVault()?.rounds.some((r) => r.index === round.index)) {
      setTask(null);
      setCeremony(done.summary);
    }
  };

  const toggleListed = async () => {
    if (busy.current) return;
    busy.current = true;
    setListing(true);
    setListError("");
    try {
      await mutate(async (s) => setListed(s, !s.listed));
    } catch (e) {
      setListError(`Couldn't update the list: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busy.current = false;
      setListing(false);
    }
  };

  const saveStep = () => {
    let zat = 0n;
    try {
      zat = parseZec(step ?? "");
    } catch {}
    if (zat <= 0n) return setStepError("The payout step has to be a ZEC amount above zero, like 0.01.");
    if (busy.current) return setStepError("The vault room is busy for a moment. Try again in a few seconds.");
    saveVault({ ...loadVault()!, unitZat: zat.toString() });
    setStep(null);
    setStepError("");
  };

  const open = openRound(vault);
  const closing = vault.rounds.filter((r) => r.status === "closing");
  const giveLink = `${siteOrigin()}/#/give/${vault.group.npub}`;
  const unit = BigInt(vault.unitZat);
  const all = vault.rounds.flatMap((r) => r.donations);
  const collected = all.filter((d) => d.status === "swept").length + vault.burned.reduce((n, b) => n + b.donations, 0);
  const payouts = vault.burned.filter((b) => b.toVaultZat && b.toVaultZat !== "0").length;
  const giftNote = [
    collected && `${collected} collected`,
    all.filter((d) => d.status === "arrived").length && `${all.filter((d) => d.status === "arrived").length} ready to collect`,
    all.filter((d) => d.status === "swapping").length && `${all.filter((d) => d.status === "swapping").length} being swapped`,
    all.filter((d) => d.status === "awaiting").length && `${all.filter((d) => d.status === "awaiting").length} waiting for the donor to pay`,
  ]
    .filter(Boolean)
    .join(", ");

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
          <div className={`listing ${vault.listed ? "is-on" : ""}`}>
            <button
              type="button"
              role="switch"
              aria-checked={!!vault.listed}
              aria-label="List this fund on the Give page"
              className="switch"
              onClick={toggleListed}
              disabled={listing || !open}
            >
              <motion.span className="switch-knob" layout transition={{ type: "spring", stiffness: 600, damping: 34 }} />
            </button>
            <div className="listing-text">
              <p className="listing-title">
                <Icon name="list" />
                {listing ? "Updating the list…" : vault.listed ? "Listed on the Give page" : "Not listed on the Give page"}
              </p>
              <p className="small muted">
                {vault.listed
                  ? "Donors can find this fund without your link. So can anyone else who looks at the list."
                  : "Only people with your link can find this fund. Listing it lets donors find you on the Give page, and anyone else too."}
              </p>
              {listError && <p className="err-inline small">{listError}</p>}
            </div>
          </div>
        </section>

        <section className="panel vault-status">
          <h2 className="vault-h2">At a glance</h2>
          <dl className="glance">
            <div className="glance-row">
              <dt>Gifts</dt>
              <dd className="glance-value num">{giftCount}</dd>
              <dd className="glance-note">{giftNote || "None yet. Share your give link to get the first one."}</dd>
            </div>
            <div className="glance-row">
              <dt>Paid to your wallet</dt>
              <dd className="glance-value num">{zecText(paidZat)}</dd>
              <dd className="glance-note">
                {payouts ? `In ${payouts === 1 ? "1 payout" : `${payouts} payouts`}` : "Nothing yet"}, to {short(vault.vaultAddress, 8, 6)}
              </dd>
            </div>
            <div className="glance-row">
              <dt>Payout step</dt>
              <dd className="glance-value num">
                {zecText(unit)}
                {step === null && (
                  <button className="linkish small" onClick={() => setStep(zecText(unit, 8).replace(/ ZEC$/, ""))}>
                    Change
                  </button>
                )}
              </dd>
              <dd className="glance-note">
                Your wallet only ever receives whole steps of this. What's left waits for the next round, so no payout lines up
                with a single gift.
              </dd>
            </div>
          </dl>
          <AnimatePresence initial={false}>
            {step !== null && (
              <motion.form
                className="field vault-step"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  saveStep();
                }}
              >
                <label htmlFor="vault-step">New payout step, in ZEC</label>
                <div className="vault-step-row">
                  <input
                    id="vault-step"
                    className="input num"
                    value={step}
                    onChange={(e) => setStep(e.target.value)}
                    inputMode="decimal"
                    autoFocus
                  />
                  <button className="btn small" disabled={checking}>
                    Save
                  </button>
                  <button type="button" className="btn ghost small" onClick={() => (setStep(null), setStepError(""))}>
                    Cancel
                  </button>
                </div>
                <small>Applies to the next payout. Smaller steps reach your wallet sooner; bigger ones hide more.</small>
                {stepError && <span className="err-inline small">{stepError}</span>}
              </motion.form>
            )}
          </AnimatePresence>
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
            unit={unit}
            next={open.index + 1}
            onCollect={(d) => collect(open, d)}
            onCollectAll={() => collectAll(open)}
            action={
              <button className="btn" onClick={newRound} disabled={!engine}>
                Close round {open.index} and open round {open.index + 1}
              </button>
            }
            hint="Closing gives new gifts fresh keys. This round then pays out once the gifts already paid for have landed."
          />
        )}

        {closing.map((r) => {
          const toCollect = r.donations.filter((d) => d.status === "arrived");
          const ready = settled(r);
          return (
            <RoundPanel
              key={r.index}
              round={r}
              tokens={tokens}
              balance={balances[r.index]}
              unit={unit}
              next={open?.index}
              onCollect={(d) => collect(r, d)}
              onCollectAll={() => collectAll(r)}
              action={
                <button className="btn gold" disabled={!ready || !engine} onClick={() => preparePayout(r)}>
                  Pay out and burn round {r.index}
                </button>
              }
              hint={
                ready
                  ? "Pays whole steps to your wallet, carries the rest into the open round, then deletes this round's keys for good."
                  : toCollect.length
                    ? "Collect the arrived gifts first. Burning now would lose them."
                    : "Waiting for gifts still being swapped. Burning now would lose them."
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
        {ceremony && (
          <BurnCeremony
            key="burn"
            summary={ceremony}
            onDone={() => setCeremony(null)}
            onRaid={() => {
              setCeremony(null);
              setRaid(true);
            }}
          />
        )}
        {raid && <RaidReport key="raid" state={vault} onClose={() => setRaid(false)} />}
      </AnimatePresence>
    </div>
  );
}

const GIFT: Record<DonationRecord["status"], { label: string; icon: IconName; tone: string; say: (d: DonationRecord) => string }> = {
  awaiting: {
    label: "Waiting for the donor",
    icon: "clock",
    tone: "wait",
    say: (d) => {
      const left = d.deadline ? Date.parse(d.deadline) / 1000 - Date.now() / 1000 : 0;
      return left > 0 ? `Their quote stays open for ${span(left)} more.` : "Their quote has run out.";
    },
  },
  swapping: { label: "Swapping to Zcash", icon: "swap", tone: "move", say: () => "Usually lands in 5 to 20 minutes." },
  arrived: { label: "Ready to collect", icon: "spark", tone: "ready", say: () => "Arrived as private Zcash." },
  swept: { label: "Collected", icon: "check", tone: "done", say: () => "In this round's key." },
  refunded: { label: "Refunded", icon: "x", tone: "off", say: () => "NEAR Intents sent it back to the donor." },
  expired: { label: "Never paid", icon: "x", tone: "off", say: () => "The quote lapsed." },
  failed: { label: "Swap failed", icon: "warn", tone: "off", say: () => "NEAR Intents refunds the donor." },
};

const STAGES = ["Taking gifts", "Letting paid gifts land", "Ready to pay out", "Burned"];

type Note = { tone: "warn" | "go" | "info" | "quiet"; icon: IconName; title: string; body: string };
const TONE_ORDER = { warn: 0, go: 1, info: 2, quiet: 3 };

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What a round needs from the group right now, most urgent first. */
function roundNotes(round: Round, next: number | undefined): Note[] {
  const now = Date.now() / 1000;
  const by = (s: DonationRecord["status"]) => round.donations.filter((d) => d.status === s);
  const arrived = by("arrived");
  const swapping = by("swapping");
  const awaiting = by("awaiting");
  const swept = by("swept");
  const age = now - round.openedAt;
  const notes: Note[] = [];

  if (arrived.length) {
    notes.push({
      tone: "go",
      icon: "spark",
      title: `${count(arrived.length, "gift")} ready to collect`,
      body: "Collecting moves it into this round's key. Your browser builds the proof itself, so allow a minute or two and keep this tab open.",
    });
  }
  // A gift mid-swap or waiting for its donor already says so in its own row. It only
  // needs a note when the round is about to pay out without it.
  if (awaiting.length && round.status === "closing" && next) {
    notes.push({
      tone: "info",
      icon: "clock",
      title: awaiting.length === 1 ? "1 gift is still waiting for its donor to pay" : `${awaiting.length} gifts are still waiting for their donors to pay`,
      body: `Paying out won't lose ${awaiting.length === 1 ? "it" : "them"}: ${
        awaiting.length === 1 ? "it moves" : "they move"
      } to round ${next} with ${awaiting.length === 1 ? "its key" : "their keys"}, so a late payment still arrives.`,
    });
  }
  if (swapping.length && round.status === "closing") {
    notes.push({
      tone: "info",
      icon: "swap",
      title: `Waiting for ${count(swapping.length, "gift")} to finish swapping`,
      body: "This round can pay out once it lands, usually within 5 to 20 minutes. Burning before then would lose it.",
    });
  }
  if (swept.length) {
    const long = age > 3 * 86400;
    notes.push({
      tone: long ? "warn" : "quiet",
      icon: long ? "warn" : "key",
      title: long ? `This round has held donor keys for ${span(age)}` : "Until it burns, this round can trace its gifts",
      body: `This browser holds ${count(swept.length, "gift key")} for round ${round.index}. Anyone who takes this device before the round burns could follow ${
        swept.length === 1 ? "it" : "them"
      } back to a donor's wallet. ${long ? "Close and pay out this round soon." : "Short rounds keep that window small."}`,
    });
  }
  return notes.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

function RoundPanel({
  round,
  tokens,
  balance,
  unit,
  next,
  onCollect,
  onCollectAll,
  action,
  hint,
}: {
  round: Round;
  tokens: Token[];
  balance?: { zat: bigint; notes: number };
  unit: bigint;
  next?: number;
  onCollect: (d: DonationRecord) => void;
  onCollectAll: () => void;
  action: React.ReactNode;
  hint: string;
}) {
  const arrived = round.donations.filter((d) => d.status === "arrived");
  const gifts = [...round.donations].reverse();
  const isOpen = round.status === "open";
  const stage = isOpen ? 0 : settled(round) ? 2 : 1;
  const notes = roundNotes(round, next);
  const age = Date.now() / 1000 - round.openedAt;

  return (
    <motion.section layout className={`panel round round-${round.status}`}>
      <header className="round-head">
        <div className="round-title">
          <p className="round-kicker">
            <span className={`dot ${isOpen ? "live" : "gold"}`} />
            {isOpen ? `Open for ${span(age)}` : `Closed ${ago(round.closedAt ?? round.openedAt)}`}
          </p>
          <h2 className="vault-h2">Round {round.index}</h2>
        </div>
        <div className="round-balance">
          <span className="small muted">In the round now</span>
          {balance ? (
            <span className="round-balance-value num">{zecText(balance.zat)}</span>
          ) : (
            <span className="skeleton round-balance-wait" aria-label="Checking the balance" />
          )}
        </div>
      </header>

      <ol className="track" aria-label={`Round ${round.index} is at: ${STAGES[stage]}`}>
        {STAGES.map((label, i) => (
          <li key={label} className={i < stage ? "is-done" : i === stage ? "is-now" : ""}>
            <span className="track-dot">
              {i < stage ? <Icon name="check" /> : i === stage ? <motion.span layoutId={`track-${round.index}`} className="track-now" /> : null}
            </span>
            <span className="track-label">{label}</span>
          </li>
        ))}
      </ol>

      {balance && balance.zat > 0n && <StepMeter zat={balance.zat} notes={balance.notes} unit={unit} closing={!isOpen} />}

      {notes.length > 0 && (
        <div className="callouts">
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <motion.div
                key={n.title}
                layout
                className={`callout callout-${n.tone}`}
                role={n.tone === "warn" ? "alert" : undefined}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span className="callout-icon">
                  <Icon name={n.icon} />
                </span>
                <div>
                  <p className="callout-title">{n.title}</p>
                  <p className="callout-body">{n.body}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {gifts.length === 0 ? (
        <div className="round-empty">
          <Icon name="clock" />
          <p>No gifts yet. When someone gives, their sealed note shows up here within a minute or two.</p>
        </div>
      ) : (
        <ul className="gifts">
          <AnimatePresence initial={false}>
            {gifts.map((d) => {
              const g = GIFT[d.status];
              return (
                <motion.li
                  key={d.dropId}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className={`gift tone-${g.tone}`}
                >
                  <span className="gift-icon">
                    <Icon name={g.icon} />
                  </span>
                  <span className="gift-main">
                    <span className="gift-what">{giftAmount(d, tokens)}</span>
                    <span className="gift-sub">
                      <strong>{g.label}.</strong> {g.say(d)} Started {ago(d.seenAt)}.
                    </span>
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
              );
            })}
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

/**
 * How close the round is to paying the group's wallet: whole payout steps fill in gold,
 * the next step fills as gifts come in.
 */
function StepMeter({ zat, notes, unit, closing }: { zat: bigint; notes: number; unit: bigint; closing: boolean }) {
  const spends = Math.max(notes, 1);
  const fee = networkFee(spends, 2);
  const avail = zat > fee ? zat - fee : 0n;
  const plan = planPayout(zat, spends, unit);
  const whole = Number(plan.toVault / unit);
  const part = Math.min(0.97, Number(((avail - plan.toVault) * 1000n) / unit) / 1000);
  const slots = Math.min(Math.max(whole + 2, 3), 8);
  const under = whole === 0;

  return (
    <div className={`meter ${under && closing ? "is-short" : ""}`}>
      <div className="meter-head">
        <span className="meter-title">
          <Icon name={under && closing ? "warn" : "spark"} />
          {under ? "Not enough for a payout yet" : `${count(whole, "payout step")} ready for your wallet`}
        </span>
        <span className="small muted">Step: {zecText(unit)}</span>
      </div>
      <div className="meter-track" aria-hidden="true">
        {Array.from({ length: slots }, (_, i) => (
          <span key={i} className="meter-slot">
            <motion.span
              className="meter-fill"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: i < whole ? 1 : i === whole ? part : 0 }}
              transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
        ))}
      </div>
      <p className="meter-say small">
        {under ? (
          <>
            <strong className="num">{zecText(unit - avail)}</strong> more and this round can pay{" "}
            <strong className="num">{zecText(unit)}</strong> to your wallet. Paying out now carries everything into the next round.
          </>
        ) : (
          <>
            Paying out now sends <strong className="num">{zecText(plan.toVault)}</strong> to your wallet and carries{" "}
            <strong className="num">{zecText(plan.carried)}</strong> into the next round, after a{" "}
            <span className="num">{zecText(plan.fee, 5)}</span> network fee.
          </>
        )}
      </p>
    </div>
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
  const unpaid = plan.round.donations.filter((d) => d.status === "awaiting").length;
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
          {unpaid > 0 &&
            ` ${unpaid === 1 ? "The gift" : `The ${unpaid} gifts`} nobody has paid for yet ${unpaid === 1 ? "moves" : "move"} to round ${next?.index} instead.`}
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
