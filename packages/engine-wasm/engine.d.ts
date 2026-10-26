/* tslint:disable */
/* eslint-disable */
/**
 * The `ReadableStreamType` enum.
 *
 * *This API requires the following crate features to be activated: `ReadableStreamType`*
 */

export type ReadableStreamType = "bytes";

/**
 * The JS-visible verdict on a pasted destination address.
 *
 * `kind` is one of `"unified_orchard"`, `"unified_no_orchard"`, `"sapling"`,
 * `"transparent"` or `"invalid"`. `reason` is `null` when a sweep can pay the address
 * and a sentence the recipient can read when it cannot.
 */
export class AddressClassification {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    kind: string;
    get reason(): string | undefined;
    set reason(value: string | null | undefined);
}

/**
 * The JS-visible result of [`derive`].
 */
export class DerivedAddress {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    address: string;
    diversifier_index: number;
    ufvk: string;
}

declare class IntoUnderlyingByteSource {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    pull(controller: ReadableByteStreamController): Promise<any>;
    start(controller: ReadableByteStreamController): void;
    readonly autoAllocateChunkSize: number;
    readonly type: ReadableStreamType;
}
export type { IntoUnderlyingByteSource };

declare class IntoUnderlyingSink {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    abort(reason: any): Promise<any>;
    close(): Promise<any>;
    write(chunk: any): Promise<any>;
}
export type { IntoUnderlyingSink };

declare class IntoUnderlyingSource {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    pull(controller: ReadableStreamDefaultController): Promise<any>;
}
export type { IntoUnderlyingSource };

/**
 * The JS-visible result of [`new_wallet`](new_wallet_js).
 */
export class NewWallet {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    address: string;
    birthday: number;
    /**
     * 24 English BIP-39 words. This is the money: it is never sent anywhere.
     */
    mnemonic: string;
    ufvk: string;
}

/**
 * The JS-visible result of [`parse_fragment`](parse_fragment_js).
 */
export class ParsedFragment {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    get birthday(): number | undefined;
    set birthday(value: number | null | undefined);
    secret: string;
}

/**
 * Builds a link fragment from a secret and an optional birthday height.
 */
export function build_fragment(secret: string, birthday?: number | null): string;

/**
 * Zeryth: the chain tip, from whichever gateway answers first. A donation key's
 * birthday is this height, so the collector's scan starts where the key was born.
 */
export function chain_tip(lightwalletd_url: string): Promise<any>;

/**
 * Classifies a destination address without touching the network.
 */
export function classify_address(address: string, network: string): AddressClassification;

/**
 * Derives the envelope address and viewing key from a link secret.
 */
export function derive(secret_b64url: string, network: string): DerivedAddress;

/**
 * Generates a fresh link secret, base64url without padding.
 */
export function generate_secret(): string;

/**
 * Confirms a unified address carries exactly one receiver, Orchard.
 */
export function is_orchard_only(address: string): boolean;

/**
 * Whether this package was built with `--features multicore`.
 *
 * The loader uses it as a build stamp: it asks the module what it is rather than
 * inferring it from which file it happened to fetch, so a mis-copied package is a
 * caught error and not a silently single-threaded sweep.
 */
export function is_threaded(): boolean;

/**
 * The maximum number of bytes a memo can carry.
 */
export function max_memo_bytes(): number;

/**
 * The UTF-8 byte length of a string, which is what the 512-byte memo limit counts.
 */
export function memo_byte_length(text: string): number;

/**
 * Generates a fresh 24-word wallet for a recipient who has none.
 *
 * The seed is `mnemonic.to_seed("")`, the full 64 bytes with an empty passphrase, which
 * is what Zodl and `zcash-devtool` do — so these words can be imported into either and
 * the same account 0 comes back.
 */
export function new_wallet(network: string, birthday: number): NewWallet;

/**
 * Opens an envelope: derive, sync, trial-decrypt, and report the notes received.
 *
 * Returns a `Promise` so the browser's event loop keeps running while blocks stream in.
 * Rejects with a plain string, like every other export in this crate.
 */
export function open_envelope(secret_b64url: string, birthday: number | null | undefined, network: string, lightwalletd_url: string, on_progress?: Function | null): Promise<any>;

/**
 * Parses a link fragment into its secret and optional birthday height.
 */
export function parse_fragment(fragment: string): ParsedFragment;

/**
 * Builds the single-output ZIP-321 URI the sender's wallet consumes.
 *
 * `amount_zat` accepts a BigInt, a decimal string, or a safe-integer number. `memo` is
 * the sender's text: it rides in the ZIP-321 `memo=` parameter, so it ends up encrypted
 * in the note rather than in the sending wallet's local history.
 */
export function payment_uri(address: string, amount_zat: any, memo?: string | null): string;

/**
 * Sweeps every Ironwood note an envelope holds to a destination, plus the flat fee.
 *
 * `notes` is an **array** of `{ txid, height, action_index }`, exactly as
 * `open_envelope` reports them, and all of them are spent in one transaction. A single
 * `{ txid, height, action_index }` object is still accepted and treated as a
 * one-element array; that backward compatibility is for one release only.
 *
 * The notes are re-derived from the secret rather than trusted: each funding
 * transaction is fetched and its action decrypted here. Naming the same note twice is
 * refused before any network work, because two spends of one note are two copies of one
 * nullifier and no node accepts that.
 *
 * `on_stage(stage, detail)` fires with `"witness"`, `"keys"`, `"proving"`, `"broadcast"`
 * and `"done"`, in that order. When `broadcast` is false the transaction is built and
 * proved but never sent, and `raw_tx_hex` comes back for inspection.
 */
export function sweep_envelope(secret_b64url: string, network: string, lightwalletd_url: string, notes: any, destination: string, fee_address: string, fee_zat: string, splits: any, memo: string | null | undefined, broadcast: boolean, on_stage?: Function | null): Promise<any>;

/**
 * See the `multicore` twin above. Without rayon there is exactly one thread.
 */
export function thread_count(): number;

/**
 * Builds the Ironwood proving key now, and returns how many milliseconds it took.
 *
 * # How the warm-up works
 *
 * `zcash_primitives` builds its own Orchard/Ironwood proving key inside
 * `Builder::build`, caching it in a process-wide `OnceLock` keyed by circuit version
 * (`cached_orchard_proving_key`, which that crate exports as a `pub fn`). Without a
 * warm-up the recipient pays for that key build — about 35 s of single-threaded wasm —
 * inside the same call that proves, with no way to tell the two apart on screen.
 *
 * Three ways to force it early were considered:
 *
 * 1. **A `[patch.crates-io]` fork of `zcash_primitives`** adding an entry point that
 *    touches the `OnceLock`. Rejected: it forks a consensus-critical crate to reach
 *    something that is already public.
 * 2. **Building a throwaway bundle** so `build` populates the cache as a side effect.
 *    Rejected: it costs a whole proof (about 52 s) on top of the key build, and needs a
 *    fabricated note and anchor.
 * 3. **Calling `cached_orchard_proving_key` directly.** Taken. It is `pub`, it is the
 *    very `OnceLock` the real build path reads, and it costs the key build and nothing
 *    else. The circuit version is pinned to `PostNu6_3`, the version every Ironwood
 *    bundle proves against.
 *
 * A second call returns almost instantly, because the key is already there.
 */
export function warm_proving_key(): Promise<any>;

/**
 * Renders a zatoshi amount as a decimal ZEC string.
 */
export function zat_to_zec_string(zat: any): string;

/**
 * Parses a decimal ZEC string into zatoshi, returned as a BigInt.
 */
export function zec_string_to_zat(zec: string): bigint;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_addressclassification_free: (a: number, b: number) => void;
    readonly __wbg_derivedaddress_free: (a: number, b: number) => void;
    readonly __wbg_get_addressclassification_kind: (a: number, b: number) => void;
    readonly __wbg_get_addressclassification_reason: (a: number, b: number) => void;
    readonly __wbg_get_derivedaddress_address: (a: number, b: number) => void;
    readonly __wbg_get_derivedaddress_diversifier_index: (a: number) => number;
    readonly __wbg_get_derivedaddress_ufvk: (a: number, b: number) => void;
    readonly __wbg_get_newwallet_address: (a: number, b: number) => void;
    readonly __wbg_get_newwallet_birthday: (a: number) => number;
    readonly __wbg_get_newwallet_mnemonic: (a: number, b: number) => void;
    readonly __wbg_get_newwallet_ufvk: (a: number, b: number) => void;
    readonly __wbg_get_parsedfragment_birthday: (a: number) => number;
    readonly __wbg_get_parsedfragment_secret: (a: number, b: number) => void;
    readonly __wbg_intounderlyingbytesource_free: (a: number, b: number) => void;
    readonly __wbg_intounderlyingsink_free: (a: number, b: number) => void;
    readonly __wbg_intounderlyingsource_free: (a: number, b: number) => void;
    readonly __wbg_newwallet_free: (a: number, b: number) => void;
    readonly __wbg_parsedfragment_free: (a: number, b: number) => void;
    readonly __wbg_set_addressclassification_kind: (a: number, b: number, c: number) => void;
    readonly __wbg_set_addressclassification_reason: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivedaddress_address: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivedaddress_diversifier_index: (a: number, b: number) => void;
    readonly __wbg_set_derivedaddress_ufvk: (a: number, b: number, c: number) => void;
    readonly __wbg_set_newwallet_address: (a: number, b: number, c: number) => void;
    readonly __wbg_set_newwallet_birthday: (a: number, b: number) => void;
    readonly __wbg_set_newwallet_mnemonic: (a: number, b: number, c: number) => void;
    readonly __wbg_set_newwallet_ufvk: (a: number, b: number, c: number) => void;
    readonly __wbg_set_parsedfragment_birthday: (a: number, b: number) => void;
    readonly __wbg_set_parsedfragment_secret: (a: number, b: number, c: number) => void;
    readonly build_fragment: (a: number, b: number, c: number, d: number) => void;
    readonly chain_tip: (a: number, b: number) => number;
    readonly classify_address: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly derive: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly generate_secret: (a: number) => void;
    readonly intounderlyingbytesource_autoAllocateChunkSize: (a: number) => number;
    readonly intounderlyingbytesource_cancel: (a: number) => void;
    readonly intounderlyingbytesource_pull: (a: number, b: number) => number;
    readonly intounderlyingbytesource_start: (a: number, b: number) => void;
    readonly intounderlyingbytesource_type: (a: number) => number;
    readonly intounderlyingsink_abort: (a: number, b: number) => number;
    readonly intounderlyingsink_close: (a: number) => number;
    readonly intounderlyingsink_write: (a: number, b: number) => number;
    readonly intounderlyingsource_cancel: (a: number) => void;
    readonly intounderlyingsource_pull: (a: number, b: number) => number;
    readonly is_orchard_only: (a: number, b: number, c: number) => void;
    readonly is_threaded: () => number;
    readonly max_memo_bytes: () => number;
    readonly memo_byte_length: (a: number, b: number) => number;
    readonly new_wallet: (a: number, b: number, c: number, d: number) => void;
    readonly open_envelope: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly parse_fragment: (a: number, b: number, c: number) => void;
    readonly payment_uri: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly sweep_envelope: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number) => number;
    readonly thread_count: () => number;
    readonly warm_proving_key: () => number;
    readonly zat_to_zec_string: (a: number, b: number) => void;
    readonly zec_string_to_zat: (a: number, b: number, c: number) => void;
    readonly rustsecp256k1_v0_14_context_create: (a: number) => number;
    readonly rustsecp256k1_v0_14_context_destroy: (a: number) => void;
    readonly rustsecp256k1_v0_14_default_error_callback_fn: (a: number, b: number) => void;
    readonly rustsecp256k1_v0_14_default_illegal_callback_fn: (a: number, b: number) => void;
    readonly __wasm_bindgen_func_elem_5516: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_5537: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_4393: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_4147: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_export4: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export5: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
