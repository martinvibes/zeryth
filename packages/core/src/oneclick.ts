/**
 * NEAR Intents 1Click: any asset in, shielded ZEC out.
 *
 * The API answers CORS `*` and needs no key for public quotes, so a static page talks
 * to it directly. No referral, no app fee: an app fee is a public transfer to a named
 * collector, and it would tag every Zeryth swap on NEAR as a Zeryth swap.
 */

import { ONECLICK, QUOTE_DEADLINE_MS, ZEC_ASSET } from "./config";

export interface Token {
  assetId: string;
  blockchain: string;
  symbol: string;
  decimals: number;
  price: number;
  contractAddress?: string;
  coingeckoId?: string;
}

export interface QuoteDetails {
  depositAddress?: string;
  depositMemo?: string;
  amountIn: string;
  amountInFormatted: string;
  amountInUsd?: string;
  minAmountIn?: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd?: string;
  minAmountOut: string;
  deadline?: string;
  timeEstimate: number;
  withdrawFee?: string;
  refundFee?: string;
}

export interface QuoteResponse {
  quote: QuoteDetails;
  quoteRequest: Record<string, unknown>;
  signature: string;
  timestamp: string;
  correlationId?: string;
}

export type SwapStatus =
  | "KNOWN_DEPOSIT_TX"
  | "PENDING_DEPOSIT"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

export interface StatusResponse {
  status: SwapStatus;
  updatedAt: string;
  quoteResponse: QuoteResponse;
  swapDetails: {
    amountOut?: string;
    amountOutFormatted?: string;
    originChainTxHashes?: { hash: string; explorerUrl: string }[];
    destinationChainTxHashes?: { hash: string; explorerUrl: string }[];
    refundedAmount?: string;
    refundReason?: string;
    depositedAmount?: string;
  };
}

export class OneClickError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(ONECLICK + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON; the raw text is the best explanation we have.
  }
  if (!res.ok) {
    const message =
      (body as { message?: string })?.message ?? `1Click ${path} answered ${res.status}`;
    throw new OneClickError(message, res.status, body);
  }
  return body as T;
}

let tokenCache: Promise<Token[]> | null = null;

export function tokens(): Promise<Token[]> {
  tokenCache ??= call<Token[]>("/v0/tokens").catch((e) => {
    tokenCache = null;
    throw e;
  });
  return tokenCache;
}

export interface QuoteArgs {
  originAsset: string;
  /** Base units of the origin asset, as an integer string. */
  amount: string;
  /** The donation's one-time Ironwood address. */
  recipient: string;
  /** Where 1Click returns the donor's money if the swap does not happen. */
  refundTo: string;
  dry: boolean;
  deadlineMs?: number;
  slippageBps?: number;
}

/** An exact-input quote that lands as ZEC at a shielded address. */
export function quote(args: QuoteArgs): Promise<QuoteResponse> {
  const deadline = new Date(Date.now() + (args.deadlineMs ?? QUOTE_DEADLINE_MS)).toISOString();
  return call<QuoteResponse>("/v0/quote", {
    method: "POST",
    body: JSON.stringify({
      dry: args.dry,
      swapType: "EXACT_INPUT",
      slippageTolerance: args.slippageBps ?? 100,
      originAsset: args.originAsset,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: ZEC_ASSET,
      amount: args.amount,
      refundTo: args.refundTo,
      refundType: "ORIGIN_CHAIN",
      recipient: args.recipient,
      recipientType: "DESTINATION_CHAIN",
      deadline,
    }),
  });
}

/**
 * A price check before the donor has said where a refund should go. Dry, so nothing is
 * reserved and the refund target is never used; an intents account stands in for it
 * because 1Click validates `refundTo` even on a dry quote.
 */
export function estimate(args: { originAsset: string; amount: string; recipient: string }): Promise<QuoteResponse> {
  return call<QuoteResponse>("/v0/quote", {
    method: "POST",
    body: JSON.stringify({
      dry: true,
      swapType: "EXACT_INPUT",
      slippageTolerance: 100,
      originAsset: args.originAsset,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: ZEC_ASSET,
      amount: args.amount,
      refundTo: "intents.near",
      refundType: "INTENTS",
      recipient: args.recipient,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + QUOTE_DEADLINE_MS).toISOString(),
    }),
  });
}

/** The smallest amount 1Click named in a "too low" refusal, base units, if it named one. */
export function minimumFrom(error: unknown): bigint | null {
  const m = /try at least (\d+)/.exec(error instanceof Error ? error.message : String(error));
  return m ? BigInt(m[1]) : null;
}

/**
 * ZEC out of a shielded key into another chain: the claim-card cash-out. The deposit
 * address 1Click hands back is a transparent `t1`, which the card's sweep pays.
 */
export function quoteFromZec(args: {
  destinationAsset: string;
  amountZat: bigint;
  recipient: string;
  refundTo: string;
  dry: boolean;
}): Promise<QuoteResponse> {
  const deadline = new Date(Date.now() + QUOTE_DEADLINE_MS).toISOString();
  return call<QuoteResponse>("/v0/quote", {
    method: "POST",
    body: JSON.stringify({
      dry: args.dry,
      swapType: "EXACT_INPUT",
      slippageTolerance: 100,
      originAsset: ZEC_ASSET,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: args.destinationAsset,
      amount: args.amountZat.toString(),
      refundTo: args.refundTo,
      refundType: "ORIGIN_CHAIN",
      recipient: args.recipient,
      recipientType: "DESTINATION_CHAIN",
      deadline,
    }),
  });
}

export function status(depositAddress: string): Promise<StatusResponse> {
  return call<StatusResponse>(`/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`);
}

/**
 * Tells 1Click the deposit transaction's hash so it starts the swap before it would
 * have noticed the deposit on its own. Optional; failures are not fatal.
 */
export async function submitDeposit(txHash: string, depositAddress: string): Promise<void> {
  await call("/v0/deposit/submit", {
    method: "POST",
    body: JSON.stringify({ txHash, depositAddress }),
  });
}

/** The statuses after which nothing more will happen to a quote. */
export function isFinal(s: SwapStatus): boolean {
  return s === "SUCCESS" || s === "REFUNDED" || s === "FAILED";
}
