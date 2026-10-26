/**
 * The page's engine. Cheap, synchronous calls (deriving an address, building a link)
 * run on a wasm instance here; anything that touches the network or proves runs in
 * the worker and is awaited as a message round trip.
 */

import init, * as wasm from "@zeryth/zeryth-engine";
import wasmUrl from "@zeryth/zeryth-engine/engine_bg.wasm?url";
import { Engine, type Key, type Opened, type Progress, type Stage, type Swept } from "@zeryth/core";
import type { Reply, Request } from "./worker";

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: Progress;
  onStage?: Stage;
};

class WorkerEngine extends Engine {
  private worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  private pending = new Map<number, Pending>();
  private nextId = 1;

  constructor() {
    super(wasm);
    this.worker.onmessage = (event: MessageEvent<Reply>) => {
      const reply = event.data;
      const p = this.pending.get(reply.id);
      if (!p) return;
      if ("progress" in reply) return p.onProgress?.(...reply.progress);
      if ("stage" in reply) return p.onStage?.(...reply.stage);
      this.pending.delete(reply.id);
      if (reply.ok) p.resolve(reply.value);
      else p.reject(new Error(reply.error));
    };
  }

  private call<T>(req: DistributiveOmit<Request, "id">, hooks: Omit<Pending, "resolve" | "reject"> = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, ...hooks });
      this.worker.postMessage({ ...req, id });
    });
  }

  override tip(): Promise<number> {
    return this.call({ method: "tip" });
  }

  override warm(): Promise<unknown> {
    return this.call({ method: "warm" });
  }

  override open(key: Pick<Key, "secret" | "birthday">, onProgress?: Progress): Promise<Opened> {
    return this.call({ method: "open", key: { secret: key.secret, birthday: key.birthday } }, { onProgress });
  }

  override sweep(args: Parameters<Engine["sweep"]>[0]): Promise<Swept> {
    const { onStage, ...rest } = args;
    return this.call({ method: "sweep", args: rest }, { onStage });
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

let engine: Promise<Engine> | null = null;

export function getEngine(): Promise<Engine> {
  engine ??= init({ module_or_path: wasmUrl }).then(() => new WorkerEngine());
  return engine;
}
