/**
 * The group's state lives in this browser and nowhere else. That is the point: there
 * is no server to subpoena. It is also the risk, which is why the vault room nags for
 * a backup and why burning a round really deletes it here.
 */

import { useSyncExternalStore } from "react";
import type { Batch, VaultState } from "@zeryth/core";

const VAULT_KEY = "zeryth.vault.v1";
const BATCHES_KEY = "zeryth.batches.v1";

type Listener = () => void;
const listeners = new Set<Listener>();
let vaultCache: VaultState | null | undefined;
let batchesCache: Batch[] | undefined;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function notify() {
  for (const l of listeners) l();
}

export function loadVault(): VaultState | null {
  if (vaultCache === undefined) vaultCache = read<VaultState>(VAULT_KEY);
  return vaultCache;
}

/** Saves a changed vault. The object is copied so React sees a new value. */
export function saveVault(state: VaultState | null) {
  vaultCache = state ? structuredClone(state) : null;
  if (state) localStorage.setItem(VAULT_KEY, JSON.stringify(state));
  else localStorage.removeItem(VAULT_KEY);
  notify();
}

export function loadBatches(): Batch[] {
  batchesCache ??= read<Batch[]>(BATCHES_KEY) ?? [];
  return batchesCache;
}

export function saveBatches(batches: Batch[]) {
  batchesCache = structuredClone(batches);
  localStorage.setItem(BATCHES_KEY, JSON.stringify(batches));
  notify();
}

function subscribe(l: Listener) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === VAULT_KEY) vaultCache = undefined;
    if (e.key === BATCHES_KEY) batchesCache = undefined;
    if (e.key === VAULT_KEY || e.key === BATCHES_KEY) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useVault(): VaultState | null {
  return useSyncExternalStore(subscribe, loadVault);
}

export function useBatches(): Batch[] {
  return useSyncExternalStore(subscribe, loadBatches);
}

/** Everything this browser holds for the group, as one file. */
export function backupBlob(): Blob {
  const body = { zeryth: 1, savedAt: new Date().toISOString(), vault: loadVault(), batches: loadBatches() };
  return new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
}

export function downloadBackup() {
  const v = loadVault();
  const url = URL.createObjectURL(backupBlob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `zeryth-${(v?.name ?? "fund").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function restoreBackup(file: File) {
  const body = JSON.parse(await file.text()) as { zeryth?: number; vault?: VaultState; batches?: Batch[] };
  if (body.zeryth !== 1 || !body.vault || body.vault.v !== 1) throw new Error("That file isn't a Zeryth backup.");
  saveVault(body.vault);
  saveBatches(body.batches ?? []);
}
