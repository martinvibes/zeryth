/** Everything that names a network, a host or a magic number lives here. */

export const NETWORK = "main" as const;

/**
 * gRPC-web gateways in preference order, comma-separated: the engine races them and
 * fails over (see crates/engine/src/gateway.rs). zec.rocks' own gateway first.
 */
export const LIGHTWALLETD = "https://zjs.zec.rocks/mainnet,https://zcash-mainnet.chainsafe.dev";

export const ONECLICK = "https://1click.chaindefuser.com";
export const ZEC_ASSET = "nep141:zec.omft.near";

/**
 * Relays the board lives on. A drop is only shown to the donor as safe to pay once at
 * least {@link MIN_RELAY_ACKS} of them have stored it.
 */
export const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://offchain.pub",
];
export const MIN_RELAY_ACKS = 2;

/**
 * A donation's dead drop. A regular (stored) kind, carrying no `p` tag: nothing in the
 * event says which group it is for. Every Zeryth group shares the one board tag, so a
 * reader of the board sees drops, not recipients.
 */
export const DROP_KIND = 9419;
export const BOARD_TAG = "zeryth";

/** NIP-78 application data, replaceable per group: the current round's drop key. */
export const NOTICE_KIND = 30078;
export const NOTICE_D_TAG = "zeryth/round";

/** One ZEC, in zatoshi. */
export const COIN = 100_000_000n;

/**
 * Payouts to the vault are whole multiples of this; the rest rides into the next round.
 * 0.01 ZEC is about $11 at today's price.
 */
export const DEFAULT_PAYOUT_UNIT_ZAT = 1_000_000n;

/** ZIP-317: 5,000 zatoshi per logical action, never fewer than 2 actions. */
export const MARGINAL_FEE_ZAT = 5_000n;
export const GRACE_ACTIONS = 2;

/** How long a donor has to pay a quote before 1Click refunds it. */
export const QUOTE_DEADLINE_MS = 60 * 60 * 1000;
