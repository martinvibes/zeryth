import { useEffect, useState } from "react";
import { cardLink, type Engine } from "@zeryth/core";
import { getEngine } from "../engine/client";
import { useBatches } from "../lib/store";
import { siteOrigin } from "../router";
import { ClaimCard } from "../components/ClaimCard";
import { zecText } from "../lib/format";
import "../styles/print.css";

/** A sheet of cards sized for A4 and US Letter. Nothing here leaves the browser. */
export function Print({ batch: id }: { batch: string }) {
  const batch = useBatches().find((b) => b.id === id);
  const [engine, setEngine] = useState<Engine | null>(null);

  useEffect(() => {
    getEngine().then(setEngine, () => {});
  }, []);

  if (!batch) {
    return (
      <div className="print-page">
        <p className="print-note">This batch isn't in this browser any more. If it was forgotten, the printed cards are the only copy.</p>
      </div>
    );
  }

  return (
    <div className="print-page">
      <div className="print-note no-print">
        <div>
          <strong>Anyone who sees these QR codes can take the money.</strong>
          <p>Print the sheet, cut along the lines, then close this tab. Hand each card to one person.</p>
        </div>
        <button className="btn gold" onClick={() => window.print()} disabled={!engine}>
          Print {batch.cards.length} cards
        </button>
      </div>
      <div className="print-sheet">
        {engine &&
          batch.cards.map((c) => (
            <div key={c.address} className="print-cell">
              <ClaimCard amount={zecText(c.zat)} label={batch.label} link={cardLink(engine, siteOrigin(), c)} />
            </div>
          ))}
      </div>
    </div>
  );
}
