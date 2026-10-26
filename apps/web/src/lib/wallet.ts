/**
 * Paying a deposit address from a browser wallet (MetaMask, Rabby, Coinbase Wallet…).
 * Only for EVM chains; everywhere else the donor scans the QR or copies the address.
 */

import { createWalletClient, custom, erc20Abi, type Chain, type EIP1193Provider } from "viem";
import { arbitrum, avalanche, base, bsc, gnosis, mainnet, optimism, polygon } from "viem/chains";
import type { Token } from "./assets";

const CHAINS: Record<string, Chain> = {
  base,
  arb: arbitrum,
  eth: mainnet,
  op: optimism,
  pol: polygon,
  bsc,
  avax: avalanche,
  gnosis,
};

export function evmChain(blockchain: string): Chain | undefined {
  return CHAINS[blockchain];
}

function provider(): EIP1193Provider | undefined {
  return (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
}

export function hasBrowserWallet(): boolean {
  return typeof window !== "undefined" && !!provider();
}

export async function connectedAddress(): Promise<`0x${string}` | null> {
  const eth = provider();
  if (!eth) return null;
  const client = createWalletClient({ transport: custom(eth) });
  const [account] = await client.requestAddresses();
  return account ?? null;
}

/** Sends `amount` base units of `token` to `to` and resolves with the transaction hash. */
export async function pay(token: Token, to: string, amount: bigint): Promise<`0x${string}`> {
  const eth = provider();
  const chain = CHAINS[token.blockchain];
  if (!eth || !chain) throw new Error("no browser wallet for this chain");
  const client = createWalletClient({ chain, transport: custom(eth) });
  const [account] = await client.requestAddresses();
  try {
    await client.switchChain({ id: chain.id });
  } catch (e) {
    // 4902: the wallet does not know this chain yet.
    if ((e as { code?: number }).code !== 4902) throw e;
    await client.addChain({ chain });
    await client.switchChain({ id: chain.id });
  }
  if (!token.contractAddress) {
    return client.sendTransaction({ account, chain, to: to as `0x${string}`, value: amount });
  }
  return client.writeContract({
    account,
    chain,
    address: token.contractAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to as `0x${string}`, amount],
  });
}

/** Turns a wallet's refusal into something a donor can act on. */
export function walletError(e: unknown): string {
  const code = (e as { code?: number }).code;
  const msg = e instanceof Error ? e.message : String(e);
  if (code === 4001 || /rejected|denied/i.test(msg)) return "You cancelled it in your wallet. Nothing was sent.";
  if (/insufficient/i.test(msg)) return "Your wallet doesn't have enough for this payment and its network fee.";
  return msg.split("\n")[0];
}
