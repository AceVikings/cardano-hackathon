/**
 * AdaFlow Datum and Redeemer Types (Simplified)
 * TypeScript representations of the Aiken types for the agent-governed custodial wallet
 */

// MeshSDK PlutusData format uses 'alternative' for constructor index
// This matches the native toPlutusData function format
interface PlutusData {
  alternative: number;
  fields: unknown[];
}

// ============================================================================
// Wallet Datum (matching Aiken WalletDatum)
// ============================================================================

export interface WalletDatum {
  owner: string;               // VerificationKeyHash (hex)
  approvedAgents: string[];    // List of agent VerificationKeyHash (hex)
}

/**
 * Convert WalletDatum to Plutus Data format
 * Uses MeshSDK's native format: { alternative: N, fields: [...] }
 * Strings become bytes, arrays become lists
 */
export function walletDatumToData(datum: WalletDatum): PlutusData {
  return {
    alternative: 0,
    fields: [
      datum.owner,  // Hex string becomes bytes
      datum.approvedAgents,  // Array of hex strings becomes list of bytes
    ],
  };
}

// ============================================================================
// Wallet Redeemers (matching Aiken WalletRedeemer)
// ============================================================================

export enum WalletRedeemerType {
  Deposit = 0,
  AgentDeposit = 1,
  AgentSpend = 2,
  UserWithdraw = 3,
  AddAgent = 4,
  RemoveAgent = 5,
}

export type WalletRedeemer =
  | { type: WalletRedeemerType.Deposit }
  | { type: WalletRedeemerType.AgentDeposit }
  | { type: WalletRedeemerType.AgentSpend }
  | { type: WalletRedeemerType.UserWithdraw }
  | { type: WalletRedeemerType.AddAgent; agent: string }
  | { type: WalletRedeemerType.RemoveAgent; agent: string };

/**
 * Convert WalletRedeemer to Plutus Data format
 * Uses MeshSDK's native format: { alternative: N, fields: [...] }
 */
export function walletRedeemerToData(redeemer: WalletRedeemer): PlutusData {
  switch (redeemer.type) {
    case WalletRedeemerType.Deposit:
      return { alternative: 0, fields: [] };
    case WalletRedeemerType.AgentDeposit:
      return { alternative: 1, fields: [] };
    case WalletRedeemerType.AgentSpend:
      return { alternative: 2, fields: [] };
    case WalletRedeemerType.UserWithdraw:
      return { alternative: 3, fields: [] };
    case WalletRedeemerType.AddAgent:
      return { alternative: 4, fields: [redeemer.agent] };
    case WalletRedeemerType.RemoveAgent:
      return { alternative: 5, fields: [redeemer.agent] };
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
