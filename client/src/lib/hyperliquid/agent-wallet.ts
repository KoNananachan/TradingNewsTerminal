/**
 * Hyperliquid Agent Wallet — local signing key for L1 actions.
 *
 * MetaMask enforces that the EIP-712 domain chainId matches the active network.
 * Hyperliquid L1 actions require chainId 1337, which has no real EVM RPC.
 * Solution: approve a local "agent" key via MetaMask on Arbitrum (chainId 42161),
 * then sign L1 actions locally with the agent key (no MetaMask popup).
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { parseSignature, type Hex, type Address } from 'viem';
import {
  ORDER_DOMAIN,
  AGENT_TYPES,
  USER_SIGN_DOMAIN,
  computeActionHash,
} from './signing';

const HL_EXCHANGE_URL = 'https://api.hyperliquid.xyz/exchange';
const STORAGE_PREFIX = 'hl_agent_';

export interface AgentWallet {
  privateKey: Hex;
  address: Address;
}

/** EIP-712 types for approving an agent on Hyperliquid. */
export const APPROVE_AGENT_TYPES = {
  'HyperliquidTransaction:ApproveAgent': [
    { name: 'hyperliquidChain', type: 'string' },
    { name: 'agentAddress', type: 'address' },
    { name: 'agentName', type: 'string' },
    { name: 'nonce', type: 'uint64' },
  ],
} as const;

/**
 * In-memory agent wallet cache — primary store.
 * sessionStorage is used as backup so keys survive page refresh within a tab
 * but are cleared when the tab closes (unlike localStorage which persists and
 * is vulnerable to XSS exfiltration across sessions).
 */
const agentCache = new Map<string, AgentWallet>();

/** Generate a new random agent wallet. */
export function generateAgentWallet(): AgentWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}

/** Save agent wallet to in-memory cache + sessionStorage. */
export function saveAgentWallet(userAddress: Address, agent: AgentWallet): void {
  const key = `${STORAGE_PREFIX}${userAddress.toLowerCase()}`;
  agentCache.set(key, agent);
  try {
    sessionStorage.setItem(key, JSON.stringify(agent));
  } catch { /* sessionStorage may be disabled */ }
  // Migrate: remove any old localStorage entry
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/** Retrieve agent wallet (memory first, then sessionStorage fallback). */
export function getAgentWallet(userAddress: Address): AgentWallet | null {
  const key = `${STORAGE_PREFIX}${userAddress.toLowerCase()}`;
  const cached = agentCache.get(key);
  if (cached) return cached;
  // Fallback: try sessionStorage
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const agent = JSON.parse(raw) as AgentWallet;
      agentCache.set(key, agent);
      return agent;
    }
  } catch { /* ignore */ }
  // Migrate: check old localStorage and move to session
  try {
    const old = localStorage.getItem(key);
    if (old) {
      const agent = JSON.parse(old) as AgentWallet;
      agentCache.set(key, agent);
      try { sessionStorage.setItem(key, JSON.stringify(agent)); } catch { /* ignore */ }
      localStorage.removeItem(key); // Clear from persistent storage
      return agent;
    }
  } catch { /* ignore */ }
  return null;
}

/** Remove agent wallet from all stores. */
export function removeAgentWallet(userAddress: Address): void {
  const key = `${STORAGE_PREFIX}${userAddress.toLowerCase()}`;
  agentCache.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/**
 * Sign an L1 action with the agent wallet locally (no MetaMask interaction).
 * Uses chainId 1337 domain — safe because it's local signing.
 *
 * The server identifies the user from the agent approval mapping.
 * vaultAddress should be null for API agents (not the user's address).
 */
export async function signL1Action(
  agentPrivateKey: Hex,
  action: Record<string, unknown>,
  nonce: number,
): Promise<{ r: Hex; s: Hex; v: number }> {
  const account = privateKeyToAccount(agentPrivateKey);
  const connectionId = computeActionHash(action, nonce);

  const signature = await account.signTypedData({
    domain: ORDER_DOMAIN,
    types: AGENT_TYPES,
    primaryType: 'Agent' as const,
    message: {
      source: 'a',
      connectionId,
    },
  });

  const { r, s, v } = parseSignature(signature);
  return { r, s, v: Number(v) };
}

/**
 * Approve a new agent wallet on Hyperliquid.
 * Requires MetaMask signing on Arbitrum (chainId 42161).
 *
 * @param signTypedDataAsync - wagmi's signTypedDataAsync
 * @param agentAddress - the agent wallet's address
 * @returns true if approval succeeded
 */
export async function approveAgent(
  signTypedDataAsync: (args: any) => Promise<Hex>,
  agentAddress: Address,
): Promise<boolean> {
  const nonce = Date.now();

  // 1. User signs the approval via MetaMask (USER_SIGN_DOMAIN, chainId 42161)
  const signature = await signTypedDataAsync({
    domain: USER_SIGN_DOMAIN,
    types: APPROVE_AGENT_TYPES,
    primaryType: 'HyperliquidTransaction:ApproveAgent',
    message: {
      hyperliquidChain: 'Mainnet',
      agentAddress,
      agentName: 'key',
      nonce: BigInt(nonce),
    },
  });

  const { r, s, v } = parseSignature(signature);

  // 2. POST the approval to Hyperliquid
  const res = await fetch(HL_EXCHANGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: {
        type: 'approveAgent',
        hyperliquidChain: 'Mainnet',
        signatureChainId: '0x66eee',
        agentAddress,
        agentName: 'key',
        nonce,
      },
      nonce,
      signature: { r, s, v: Number(v) },
      vaultAddress: null,
    }),
  });

  const data = await res.json();
  if (import.meta.env.DEV) {
    console.log('[AgentWallet] Approval response:', JSON.stringify(data));
    console.log('[AgentWallet] Agent address:', agentAddress);
  }

  if (data.status === 'ok') return true;
  throw new Error(data.response?.payload || data.response || JSON.stringify(data));
}
