/// <reference lib="webworker" />
/**
 * The engine's heavy half, off the main thread: chain scans and halo2 proving take
 * seconds to a minute, and the page keeps animating while they run.
 */

import init, * as wasm from "@zeryth/zeryth-engine";
import wasmUrl from "@zeryth/zeryth-engine/engine_bg.wasm?url";
import { Engine } from "@zeryth/core";

declare const self: DedicatedWorkerGlobalScope;

const ready = init({ module_or_path: wasmUrl }).then(() => new Engine(wasm));

export type Request =
  | { id: number; method: "tip" }
  | { id: number; method: "warm" }
  | { id: number; method: "open"; key: { secret: string; birthday: number } }
  | { id: number; method: "sweep"; args: Omit<Parameters<Engine["sweep"]>[0], "onStage"> };

export type Reply =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: string }
  | { id: number; progress: [number, number, unknown] }
  | { id: number; stage: [string, string] };

self.onmessage = async (event: MessageEvent<Request>) => {
  const req = event.data;
  const post = (reply: Reply) => self.postMessage(reply);
  try {
    const engine = await ready;
    let value: unknown;
    switch (req.method) {
      case "tip":
        value = await engine.tip();
        break;
      case "warm":
        value = await engine.warm();
        break;
      case "open":
        value = await engine.open(req.key, (scanned, total, info) =>
          post({ id: req.id, progress: [scanned, total, info] }),
        );
        break;
      case "sweep":
        value = await engine.sweep({
          ...req.args,
          onStage: (stage, detail) => post({ id: req.id, stage: [stage, detail] }),
        });
        break;
    }
    post({ id: req.id, ok: true, value });
  } catch (e) {
    post({ id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
