import { useEffect, useState } from "react";
import { RELAYS } from "@zeryth/core";
import { liveBoard, type Sealed } from "../../lib/board";
import { ago } from "../../lib/format";

/**
 * The public board, read live from the relays. These are real sealed gifts: the reader
 * sees exactly what a watcher sees, which is the argument.
 */
export function Board() {
  const [drops, setDrops] = useState<Sealed[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    liveBoard()
      .then((d) => alive && setDrops(d.slice(0, 36)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // A handful of notes sit still; a marquee only reads as a crowd once there is one.
  const moving = !!drops && drops.length >= MARQUEE_FROM;
  const rows = moving ? [drops.filter((_, i) => i % 2 === 0), drops.filter((_, i) => i % 2 === 1)] : [];

  return (
    <section className="board">
      <div className="wrap board-head">
        <h2>This is the public board, live.</h2>
        <p className="lead">
          Every gift made through Zeryth leaves one sealed note here, on {RELAYS.length} public Nostr relays. Try to tell
          which fund each one is for, or who sent it. Nobody can. That's the point.
        </p>
      </div>

      {drops === null && !failed && <p className="wrap board-wait muted">Reading the relays…</p>}
      {failed && <p className="wrap board-wait muted">The relays didn't answer just now. Reload to try again.</p>}
      {drops && drops.length === 0 && (
        <p className="wrap board-wait muted">No sealed notes on the board yet. The first gift will put one here.</p>
      )}

      {drops && drops.length > 0 && !moving && (
        <div className="wrap board-still">
          {drops.map((d) => (
            <Note key={d.id} drop={d} />
          ))}
          <p className="small muted board-count">
            {drops.length} sealed {drops.length === 1 ? "note" : "notes"} so far. Each new gift adds one.
          </p>
        </div>
      )}

      {rows.map((row, r) =>
        row.length === 0 ? null : (
          <div key={r} className={`board-row ${r === 1 ? "is-reverse" : ""}`}>
            <div className="board-track" style={{ animationDuration: `${Math.max(30, row.length * 7)}s` }}>
              {[...row, ...row].map((d, i) => (
                <Note key={`${d.id}-${i}`} drop={d} hidden={i >= row.length} />
              ))}
            </div>
          </div>
        ),
      )}
    </section>
  );
}

const MARQUEE_FROM = 8;

function Note({ drop, hidden }: { drop: Sealed; hidden?: boolean }) {
  return (
    <article className="note" aria-hidden={hidden}>
      <header>
        <span className="note-seal" aria-hidden="true" />
        <span className="small muted">{ago(drop.createdAt)}</span>
      </header>
      <p className="note-body">{drop.sealed.slice(0, 92)}</p>
      <footer className="small muted">For: unknown. From: unknown.</footer>
    </article>
  );
}
