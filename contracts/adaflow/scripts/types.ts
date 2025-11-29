/**
 * AdaFlow Datum and Redeemer Types (Simplified)
 * TypeScript representations of the Aiken types for the agent-governed custodial wallet
 */

import { mConStr, builtinByteString } from '@meshsdk/core';

// MeshSDK uses mConStr for constructor data
type Data = ReturnType<typeof mConStr>;

// ============================================================================
// Wallet Datum (matching Aiken WalletDatum)
// ============================================================================

export interface WalletDatum {
  owner: string;               // VerificationKeyHash (hex)
  approvedAgents: string[];    // List of agent VerificationKeyHash (hex)
}

/**
 * Convert WalletDatum to Plutus Data format
 */
export function walletDatumToData(datum: WalletDatum): Data {
  return mConStr(0, [
    builtinByteString(datum.owner),
    datum.approvedAgents.map(agent => builtinByteString(agent)),
  ]);
}

// ============================================================================
// Wallet Redeemers (matching Aiken WalletRedeemer)
// ============================================================================

export enum WalletRedeemerType {
  Deposit = 0,
  AgentSpend = 1,
  UserWithdraw = 2,
  AddAgent = 3,
  RemoveAgent = 4,
}

export type WalletRedeemer =
  | { type: WalletRedeemerType.Deposit }
  | { type: WalletRedeemerType.AgentSpend }
  | { type: WalletRedeemerType.UserWithdraw }
  | { type: WalletRedeemerType.AddAgent; agent: string }
  | { type: WalletRedeemerType.RemoveAgent; agent: string };

/**
 * Convert WalletRedeemer to Plutus Data format
 */
export function walletRedeemerToData(redeemer: WalletRedeemer): Data {
  switch (redeemer.type) {
    case WalletRedeemerType.Deposit:
      return mConStr(0, []);
    case WalletRedeemerType.AgentSpend:
      return mConStr(1, []);
    case WalletRedeemerType.UserWithdraw:
      return mConStr(2, []);
    case WalletRedeemerType.AddAgent:
      return mConStr(3, [builtinByteString(redeemer.agent)]);
    case WalletRedeemerType.RemoveAgent:
      return mConStr(4, [builtinByteString(redeemer.agent)]);
    default:
      throw new Error('Unknown redeemer type');
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert ADA to Lovelace
 */
export function adaToLovelace(ada: number): bigint {
  return BigInt(Math.floor(ada * 1_000_000));
}

/**
 * Convert Lovelace to ADA
 */
export function lovelaceToAda(lovelace: bigint): number {
  return Number(lovelace) / 1_000_000;
}

/**
 * Create initial wallet datum for a new custodial wallet
 */
export function createInitialDatum(
  ownerPkh: string,
  agentPkh: string,
): WalletDatum {
  return {
    owner: ownerPkh,
    approvedAgents: [agentPkh],
  };
}

/**
 * String to hex (for purpose field)
 */
export function stringToHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex');
}

/**
 * Hex to string (for purpose field)
 */
export function hexToString(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}
