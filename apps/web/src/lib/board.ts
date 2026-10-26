import { fetchBoard } from "@zeryth/core";

export type Sealed = { id: string; createdAt: number; sealed: string };

let pending: Promise<Sealed[]> | null = null;
let readAt = 0;

/**
 * One read of the public board for the whole landing page. The hero counts it and the
 * board section shows it, so both always agree. It is read again after a minute, and a
 * failed read is forgotten so the next visit tries again.
 */
export function liveBoard(): Promise<Sealed[]> {
  if (pending && Date.now() - readAt < 60_000) return pending;
  readAt = Date.now();
  pending = fetchBoard(200).catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
}
