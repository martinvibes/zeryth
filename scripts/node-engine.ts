/** Loads the wasm engine under Node, for the end-to-end scripts. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as wasm from "@zeryth/zeryth-engine";
import { Engine } from "@zeryth/core";

export function nodeEngine(): Engine {
  const path = fileURLToPath(new URL("../packages/engine-wasm/engine_bg.wasm", import.meta.url));
  wasm.initSync({ module: readFileSync(path) });
  return new Engine(wasm);
}
