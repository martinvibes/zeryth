/**
 * A coin's own logo with its chain's logo pinned to the corner. Both ship with the site
 * (public/logos), so a donor's browser never asks a logo server which coin they picked.
 * A coin with no logo on file gets a lettered disc instead.
 */

import { useState } from "react";
import type { Token } from "../lib/assets";
import { chainName } from "../lib/assets";

export function TokenLogo({ t, className = "" }: { t: Token; className?: string }) {
  const [coin, setCoin] = useState(!!t.coingeckoId);
  const [chain, setChain] = useState(true);
  return (
    <span className={`tlogo ${className}`} aria-hidden="true">
      {coin ? (
        <img className="tlogo-coin" src={`logos/coin/${t.coingeckoId}.png`} alt="" loading="lazy" onError={() => setCoin(false)} />
      ) : (
        <span className="tlogo-coin tlogo-letter" style={{ ["--h" as string]: hue(t.symbol) }}>
          {t.symbol.replace(/[^a-z0-9]/gi, "").slice(0, 1).toUpperCase()}
        </span>
      )}
      {chain && (
        <img
          className="tlogo-chain"
          src={`logos/chain/${t.blockchain}.svg`}
          alt=""
          title={chainName(t.blockchain)}
          loading="lazy"
          onError={() => setChain(false)}
        />
      )}
    </span>
  );
}

function hue(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
