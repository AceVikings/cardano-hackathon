/**
 * AdaFlow Wallet Utilities
 * Helper functions for wallet management and blockchain interaction
 */

import {
  MeshWallet,
  BlockfrostProvider,
  serializePlutusScript,
  deserializeAddress,
} from '@meshsdk/core';
import { getCustodialWalletScript, getCustodialWalletScriptHash } from './blueprint.js';

// Load environment variables
import 'dotenv/config';

const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY;
const NETWORK = process.env.NETWORK || 'preprod';

if (!BLOCKFROST_API_KEY) {
  console.warn('⚠️  BLOCKFROST_API_KEY not set - using demo mode');
}

// Initialize Blockfrost provider
export const blockfrostProvider = BLOCKFROST_API_KEY 
  ? new BlockfrostProvider(BLOCKFROST_API_KEY)
  : null as any;

/**
 * Create a wallet from mnemonic
 */
export async function createWallet(mnemonic: string): Promise<MeshWallet> {
  const wallet = new MeshWallet({
    networkId: NETWORK === 'mainnet' ? 1 : 0,
    fetcher: blockfrostProvider,
    submitter: blockfrostProvider,
    key: {
      type: 'mnemonic',
      words: mnemonic.split(' '),
    },
  });
  return wallet;
}

/**
 * Get user wallet from environment
 */
export async function getUserWallet(): Promise<MeshWallet> {
  const mnemonic = process.env.USER_MNEMONIC;
  if (!mnemonic) throw new Error('USER_MNEMONIC not set');
  return createWallet(mnemonic);
}

/**
 * Get agent wallet from environment
 */
export async function getAgentWallet(): Promise<MeshWallet> {
  const mnemonic = process.env.AGENT_MNEMONIC;
  if (!mnemonic) throw new Error('AGENT_MNEMONIC not set');
  return createWallet(mnemonic);
}

/**
 * Get the custodial wallet script address on the current network
 */
export function getCustodialWalletAddress(): string {
  const script = getCustodialWalletScript();
  const networkId = NETWORK === 'mainnet' ? 1 : 0;
  
  const { address } = serializePlutusScript(
    { code: script, version: 'V3' },
    undefined,
    networkId
  );
  
  return address;
}

/**
 * Get payment key hash from wallet
 */
export async function getPaymentKeyHash(wallet: MeshWallet): Promise<string> {
  const addresses = await wallet.getUsedAddresses();
  const unusedAddresses = await wallet.getUnusedAddresses();
  const addr = addresses[0] || unusedAddresses[0];
  if (!addr) throw new Error('No addresses found');
  
  // Use MeshSDK's deserializeAddress to extract the key hash
  const { pubKeyHash } = deserializeAddress(addr);
  return pubKeyHash;
}

/**
 * Log wallet info
 */
export async function logWalletInfo(wallet: MeshWallet, name: string): Promise<void> {
  const addresses = await wallet.getUsedAddresses();
  const unusedAddresses = await wallet.getUnusedAddresses();
  const address = addresses[0] || unusedAddresses[0];
  const utxos = await wallet.getUtxos();
  
  let totalLovelace = BigInt(0);
  for (const utxo of utxos) {
    for (const amount of utxo.output.amount) {
      if (amount.unit === 'lovelace') {
        totalLovelace += BigInt(amount.quantity);
      }
    }
  }
  
  console.log(`\n💳 ${name} Wallet:`);
  console.log(`   Address: ${address}`);
  console.log(`   UTXOs: ${utxos.length}`);
  console.log(`   Balance: ${Number(totalLovelace) / 1_000_000} ADA`);
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTx(txHash: string, maxAttempts = 60): Promise<boolean> {
  console.log(`\n⏳ Waiting for transaction confirmation...`);
  console.log(`   Tx Hash: ${txHash}`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const utxos = await blockfrostProvider.fetchUTxOs(txHash);
      if (utxos && utxos.length > 0) {
        console.log(`   ✅ Transaction confirmed after ${i + 1} attempts`);
        return true;
      }
    } catch (e) {
      // Transaction not yet on chain
    }
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    process.stdout.write('.');
  }
  
  console.log(`\n   ❌ Transaction not confirmed after ${maxAttempts} attempts`);
  return false;
}
