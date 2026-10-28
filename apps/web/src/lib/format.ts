import { zec } from "@zeryth/core";

export function short(text: string, head = 8, tail = 6): string {
  return text.length <= head + tail + 1 ? text : `${text.slice(0, head)}…${text.slice(-tail)}`;
}

export function zecText(zat: bigint | string, digits = 4): string {
  const v = BigInt(zat);
  // Small amounts would round to 0; show enough digits to be honest about them.
  const d = v > 0n && v < 10n ** BigInt(8 - digits) ? 8 : digits;
  return `${zec(v, d)} ZEC`;
}

export function usd(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n < 1 ? `$${n.toFixed(2)}` : `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;
}

export function ago(unixSeconds: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
  if (s < 45) return "just now";
  if (s < 90) return "a minute ago";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "an hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** A rough length of time for a sentence: "about 3 hours". */
export function span(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 90) return "about a minute";
  const m = Math.round(s / 60);
  if (m < 60) return `about ${m} minutes`;
  const h = Math.round(s / 3600);
  if (h < 36) return h === 1 ? "about an hour" : `about ${h} hours`;
  return `about ${Math.round(s / 86400)} days`;
}

export function until(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "expired";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor(total / 3600);
  if (d >= 1) {
    const days = d === 1 ? "a day" : `${d} days`;
    const hours = h % 24;
    return hours ? `${days} and ${hours} ${hours === 1 ? "hour" : "hours"}` : days;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return h >= 1 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function explorerTx(txid: string): string {
  return `https://blockchair.com/zcash/transaction/${txid}`;
}
