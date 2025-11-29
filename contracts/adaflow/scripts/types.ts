/**
 * AdaFlow Datum and Redeemer Types
 * TypeScript representations of the Aiken types for the agent-governed custodial wallet
 */

import { conStr } from '@meshsdk/core';

// MeshSDK uses conStr for constructor data
type Data = ReturnType<typeof conStr>;

// ============================================================================
// Strategy Types (matching Aiken StrategyType)
// ============================================================================

export enum StrategyTypeId {
  Manual = 0,
  YieldFarming = 1,
  LiquidityProvision = 2,
  Arbitrage = 3,
  Custom = 4,
}

export interface StrategyType {
  type: StrategyTypeId;
  strategyId?: number; // Only for Custom type
}

/**
 * Convert StrategyType to Plutus Data format
 */
export function strategyTypeToData(st: StrategyType): Data {
  switch (st.type) {
    case StrategyTypeId.Manual:
      return conStr(0, []);
    case StrategyTypeId.YieldFarming:
      return conStr(1, []);
    case StrategyTypeId.LiquidityProvision:
      return conStr(2, []);
    case StrategyTypeId.Arbitrage:
      return conStr(3, []);
    case StrategyTypeId.Custom:
      return conStr(4, [BigInt(st.strategyId ?? 0)]);
    default:
      throw new Error(`Unknown strategy type: ${st.type}`);
  }
}

// ============================================================================
// Strategy Config (matching Aiken StrategyConfig)
// ============================================================================

export interface StrategyConfig {
  strategyType: StrategyType;
  minReserve: bigint;       // Minimum ADA to keep in wallet (lovelace)
  autoCompound: boolean;    // Whether to auto-compound rewards
  maxSlippageBps: bigint;   // Maximum slippage in basis points
}

/**
 * Convert StrategyConfig to Plutus Data format
 */
export function strategyConfigToData(config: StrategyConfig): Data {
  return conStr(0, [
    strategyTypeToData(config.strategyType),
    config.minReserve,
    config.autoCompound ? conStr(1, []) : conStr(0, []), // True = conStr(1), False = conStr(0)
    config.maxSlippageBps,
  ]);
}

/**
 * Create a default Manual strategy config
 */
export function defaultStrategyConfig(): StrategyConfig {
  return {
    strategyType: { type: StrategyTypeId.Manual },
    minReserve: 2_000_000n, // 2 ADA minimum
    autoCompound: false,
    maxSlippageBps: 100n, // 1%
  };
}

// ============================================================================
// Wallet Datum (matching Aiken WalletDatum)
// ============================================================================

export interface WalletDatum {
  owner: string;               // VerificationKeyHash (hex)
  approvedAgents: string[];    // List of agent VerificationKeyHash (hex)
  maxAdaPerTx: bigint;         // in lovelace
  maxTotalAda: bigint;         // in lovelace
  totalSpent: bigint;          // in lovelace
  strategy: StrategyConfig;    // Strategy configuration
  nonce: bigint;               // Replay protection
}

/**
 * Convert WalletDatum to Plutus Data format
 */
export function walletDatumToData(datum: WalletDatum): Data {
  return conStr(0, [
    datum.owner,
    datum.approvedAgents, // List of strings
    datum.maxAdaPerTx,
    datum.maxTotalAda,
    datum.totalSpent,
    strategyConfigToData(datum.strategy),
    datum.nonce,
  ]);
}

// ============================================================================
// Spend Details (matching Aiken SpendDetails)
// ============================================================================

export interface SpendDetails {
  amount: bigint;    // Amount in lovelace
  purpose: string;   // Purpose (hex-encoded ByteArray)
}

/**
 * Convert SpendDetails to Plutus Data format
 */
export function spendDetailsToData(details: SpendDetails): Data {
  return conStr(0, [
    details.amount,
    details.purpose,
  ]);
}

// ============================================================================
// Wallet Redeemers (matching Aiken WalletRedeemer)
// ============================================================================

export enum WalletRedeemerType {
  Deposit = 0,
  AgentSpend = 1,
  UserWithdraw = 2,
  UpdateConfig = 3,
  AddAgent = 4,
  RemoveAgent = 5,
  ResetSpentCounter = 6,
}

export type WalletRedeemer =
  | { type: WalletRedeemerType.Deposit }
  | { type: WalletRedeemerType.AgentSpend; details: SpendDetails }
  | { type: WalletRedeemerType.UserWithdraw }
  | { type: WalletRedeemerType.UpdateConfig; newMaxPerTx: bigint; newMaxTotal: bigint; newStrategy: StrategyConfig }
  | { type: WalletRedeemerType.AddAgent; agent: string }
  | { type: WalletRedeemerType.RemoveAgent; agent: string }
  | { type: WalletRedeemerType.ResetSpentCounter };

/**
 * Convert WalletRedeemer to Plutus Data format
 */
export function walletRedeemerToData(redeemer: WalletRedeemer): Data {
  switch (redeemer.type) {
    case WalletRedeemerType.Deposit:
      return conStr(0, []);
    case WalletRedeemerType.AgentSpend:
      return conStr(1, [spendDetailsToData(redeemer.details)]);
    case WalletRedeemerType.UserWithdraw:
      return conStr(2, []);
    case WalletRedeemerType.UpdateConfig:
      return conStr(3, [
        redeemer.newMaxPerTx,
        redeemer.newMaxTotal,
        strategyConfigToData(redeemer.newStrategy),
      ]);
    case WalletRedeemerType.AddAgent:
      return conStr(4, [redeemer.agent]);
    case WalletRedeemerType.RemoveAgent:
      return conStr(5, [redeemer.agent]);
    case WalletRedeemerType.ResetSpentCounter:
      return conStr(6, []);
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
  maxPerTxAda: number = 10,
  maxTotalAda: number = 100,
): WalletDatum {
  return {
    owner: ownerPkh,
    approvedAgents: [agentPkh],
    maxAdaPerTx: adaToLovelace(maxPerTxAda),
    maxTotalAda: adaToLovelace(maxTotalAda),
    totalSpent: 0n,
    strategy: defaultStrategyConfig(),
    nonce: 0n,
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
