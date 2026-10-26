import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { newGroupIdentity, newVault, parseZec, rotate, type Engine } from "@zeryth/core";
import { getEngine } from "../engine/client";
import { downloadBackup, restoreBackup, saveVault, useVault } from "../lib/store";
import { siteOrigin } from "../router";
import { Steps, type StepState } from "../components/Steps";
import { CopyField } from "../components/Copy";
import { Qr } from "../components/Qr";
import { Snowfall } from "../components/Snowfall";
import "../styles/give.css";

type Phase = { at: "form" } | { at: "making"; step: number } | { at: "done"; npub: string };

export function Start() {
  const existing = useVault();
  const [engine, setEngine] = useState<Engine | null>(null);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [vaultAddress, setVaultAddress] = useState("");
  const [unit, setUnit] = useState("0.01");
  const [advanced, setAdvanced] = useState(false);
  const [phase, setPhase] = useState<Phase>({ at: "form" });
  const [error, setError] = useState("");

  useEffect(() => {
    getEngine().then(setEngine, () => setError("This browser couldn't start the Zcash engine. Try a current Chrome, Firefox or Safari."));
  }, []);

  const addressProblem = (() => {
    const a = vaultAddress.trim();
    if (!a || !engine) return null;
    const c = engine.wasm.classify_address(a, "main");
    const reason = c.kind === "unified_orchard" ? null : (c.reason ?? "That isn't a Zcash address this app can pay.");
    c.free();
    return reason;
  })();

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engine) return;
    setError("");
    let unitZat: bigint;
    try {
      unitZat = parseZec(unit);
      if (unitZat <= 0n) throw new Error();
    } catch {
      return setError("The payout step has to be a ZEC amount above zero, like 0.01.");
    }
    try {
      setPhase({ at: "making", step: 0 });
      const group = newGroupIdentity();
      const state = newVault({ group, name: name.trim(), tagline: tagline.trim(), vaultAddress: vaultAddress.trim(), unitZat });
      await pause();
      setPhase({ at: "making", step: 1 });
      await rotate(state, engine);
      setPhase({ at: "making", step: 2 });
      saveVault(state);
      await pause();
      setPhase({ at: "done", npub: group.npub });
    } catch (e) {
      setPhase({ at: "form" });
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (existing && phase.at === "form") {
    return (
      <Shell>
        <div className="panel give-panel">
          <h1 className="give-title">This browser already runs {existing.name}.</h1>
          <p className="muted">
            One fund per browser keeps things simple and keeps its keys in one place. Open its vault room, or use another
            browser profile to start a second fund.
          </p>
          <a className="btn gold block" href="#/vault">
            Open the vault room
          </a>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <AnimatePresence mode="wait">
        {phase.at === "form" && (
          <motion.form key="form" className="panel give-panel" onSubmit={create} {...swap}>
            <h1 className="give-title">Start a fund</h1>
            <p className="muted">
              Takes two minutes. Everything is created in this browser: the fund's identity, its first round and its keys.
            </p>

            <label className="field">
              <span>Fund name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lagos Mutual Aid" maxLength={60} required />
            </label>
            <label className="field">
              <span>One line about it</span>
              <input
                className="input"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Medical bills and legal aid for protesters"
                maxLength={120}
              />
              <small>Donors see this, and so does anyone reading the public board. Say only what you'd say in public.</small>
            </label>
            <label className="field">
              <span>Your Zcash wallet address</span>
              <input
                className="input mono-ish"
                value={vaultAddress}
                onChange={(e) => setVaultAddress(e.target.value)}
                placeholder="u1…"
                spellCheck={false}
                autoComplete="off"
                required
              />
              <small>
                Where payouts land. Copy the receiving address from Zodl, Zingo or any wallet that supports Ironwood. It starts
                with u1.
              </small>
              {addressProblem && <span className="err-inline small">{addressProblem}</span>}
            </label>

            <button type="button" className="linkish small" onClick={() => setAdvanced((a) => !a)}>
              {advanced ? "Hide payout step" : "Change the payout step"}
            </button>
            <AnimatePresence>
              {advanced && (
                <motion.label
                  className="field"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <span>Payout step, in ZEC</span>
                  <input className="input num" value={unit} onChange={(e) => setUnit(e.target.value)} inputMode="decimal" />
                  <small>
                    Payouts to your wallet are always a multiple of this, so no payout matches a single gift. Bigger steps hide
                    more; the remainder waits for the next round.
                  </small>
                </motion.label>
              )}
            </AnimatePresence>

            {error && <p className="err">{error}</p>}
            <button className="btn gold block" disabled={!engine || !name.trim() || !vaultAddress.trim() || !!addressProblem}>
              {engine ? "Create the fund" : "Starting the Zcash engine…"}
            </button>
            <RestoreLink onError={setError} />
          </motion.form>
        )}

        {phase.at === "making" && (
          <motion.div key="making" className="panel give-panel" {...swap}>
            <h2 className="give-h2">Creating {name.trim()}</h2>
            <Steps
              items={["Making the fund's public identity", "Opening round 1 and posting it to the board", "Saving the keys in this browser"].map(
                (label, i) => ({ label, state: (i < phase.step ? "done" : i === phase.step ? "doing" : "todo") as StepState }),
              )}
            />
          </motion.div>
        )}

        {phase.at === "done" && (
          <motion.div key="done" className="panel give-panel" {...swap}>
            <h2 className="give-h2">{name.trim()} is live.</h2>
            <p className="muted">Share this link. Anyone who opens it can give from almost any wallet.</p>
            <div className="start-share">
              <Qr value={`${siteOrigin()}/#/give/${phase.npub}`} size={168} label="Give link QR code" />
              <CopyField value={`${siteOrigin()}/#/give/${phase.npub}`} label="Give link" />
            </div>
            <div className="start-backup">
              <strong>Save a backup now.</strong>
              <p className="small">
                The fund's keys live only in this browser. If you clear it or lose this device without a backup, gifts in the
                current round can't be collected. Keep the file somewhere safe and offline.
              </p>
              <button className="btn ghost small" onClick={downloadBackup}>
                Download backup
              </button>
            </div>
            <a className="btn gold block" href="#/vault">
              Open the vault room
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="give">
      <div className="give-sky" aria-hidden="true" />
      <Snowfall density={0.45} />
      <div className="give-col">{children}</div>
    </div>
  );
}

function RestoreLink({ onError }: { onError: (s: string) => void }) {
  return (
    <label className="restore small muted">
      Moving a fund to this browser?{" "}
      <span className="linkish">Restore from a backup</span>
      <input
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            await restoreBackup(f);
            window.location.hash = "#/vault";
          } catch (err) {
            onError(err instanceof Error ? err.message : String(err));
          }
        }}
      />
    </label>
  );
}

const pause = () => new Promise((r) => setTimeout(r, 450));

const swap = {
  initial: { opacity: 0, y: 16, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, y: -10, filter: "blur(6px)", transition: { duration: 0.25 } },
};
