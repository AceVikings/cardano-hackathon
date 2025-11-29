/**
 * AdaFlow - Deposit Script
 * User deposits ADA into their custodial wallet with agent authorization
 * 
 * If user already has a UTXO at the script address, it consolidates by:
 * - Spending the existing UTXO (with Deposit redeemer)
 * - Creating a new UTXO with combined value
 * 
 * If no existing UTXO, creates a fresh one (no script spending needed)
 */

import 'dotenv/config';
import {
  MeshTxBuilder,
} from '@meshsdk/core';
import {
  getUserWallet,
  getAgentWallet,
  blockfrostProvider,
  getCustodialWalletAddress,
  getPaymentKeyHash,
  waitForTx,
} from '../wallet.js';
import {
  WalletDatum,
  walletDatumToData,
  walletRedeemerToData,
  WalletRedeemerType,
  createInitialDatum,
  adaToLovelace,
  lovelaceToAda,
} from '../types.js';
import { getCustodialWalletScript } from '../blueprint.js';

interface Asset {
  unit: string;
  quantity: string;
}

async function main() {
  console.log('💰 AdaFlow - Deposit to Custodial Wallet');
  console.log('=========================================\n');

  // Amount to deposit (in ADA)
  const depositAmountAda = 10;
  const depositAmountLovelace = adaToLovelace(depositAmountAda);

  // Get wallets
  const userWallet = await getUserWallet();
  const agentWallet = await getAgentWallet();

  // Get key hashes
  const userPkh = await getPaymentKeyHash(userWallet);
  const agentPkh = await getPaymentKeyHash(agentWallet);

  console.log(`👤 User PKH: ${userPkh}`);
  console.log(`🤖 Agent PKH: ${agentPkh}`);

  // Get script address and code
  const scriptAddress = getCustodialWalletAddress();
  const scriptCode = getCustodialWalletScript();
  console.log(`📜 Script Address: ${scriptAddress}\n`);

  // Check user balance
  let userUtxos = await userWallet.getUtxos();
  
  // Retry if UTXOs empty (wallet may need time to sync)
  if (userUtxos.length === 0) {
    console.log('⏳ Waiting for wallet to sync...');
    await new Promise(r => setTimeout(r, 3000));
    userUtxos = await userWallet.getUtxos();
  }
  
  const userBalance = userUtxos.reduce((sum, utxo) => {
    const lovelace = utxo.output.amount.find(a => a.unit === 'lovelace');
    return sum + BigInt(lovelace?.quantity ?? 0);
  }, 0n);
  console.log(`💳 User Balance: ${lovelaceToAda(userBalance)} ADA (${userUtxos.length} UTXOs)`);

  if (userBalance < depositAmountLovelace + 2_000_000n) {
    console.error('❌ Insufficient funds for deposit + fees');
    process.exit(1);
  }

  // Check if user already has a UTXO at the script address
  console.log('\n🔍 Checking for existing custodial wallet UTXO...');
  const scriptUtxos = await blockfrostProvider.fetchAddressUTxOs(scriptAddress);
  
  // Find UTXO belonging to this user (by checking datum owner)
  let existingUtxo = null;
  let existingValue = 0n;
  let existingDatum: WalletDatum | null = null;
  
  for (const utxo of scriptUtxos) {
    const plutusData = utxo.output?.plutusData;
    if (typeof plutusData === 'string') {
      // Parse the CBOR to extract owner PKH
      // Format: d8799f581c<pkh>... 
      const pkhMatch = plutusData.match(/d8799f581c([a-f0-9]{56})/i);
      if (pkhMatch && pkhMatch[1] === userPkh) {
        existingUtxo = utxo;
        existingValue = BigInt(utxo.output.amount.find((a: Asset) => a.unit === 'lovelace')?.quantity || '0');
        
        // Parse approved agents from datum
        // Format: d8799f581c<owner_pkh>9f581c<agent1>581c<agent2>...ffff or 80ff for empty list
        const agentsMatch = plutusData.match(/d8799f581c[a-f0-9]{56}(9f(?:581c[a-f0-9]{56})*ff|80)ff/i);
        if (agentsMatch) {
          const agentsPart = agentsMatch[1];
          const agents: string[] = [];
          if (agentsPart !== '80') {
            // Has agents - extract them
            const agentMatches = agentsPart.matchAll(/581c([a-f0-9]{56})/gi);
            for (const match of agentMatches) {
              agents.push(match[1]);
            }
          }
          existingDatum = {
            owner: userPkh,
            approvedAgents: agents,
          };
        }
        break;
      }
    }
  }

  // Get user address for change
  const userAddresses = await userWallet.getUsedAddresses();
  const userAddress = userAddresses[0] || (await userWallet.getUnusedAddresses())[0];

  // Build transaction
  console.log('🔨 Building transaction...');
  
  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    submitter: blockfrostProvider,
  });

  let unsignedTx: string;
  let newTotalValue: bigint;

  if (existingUtxo && existingDatum) {
    // CONSOLIDATE: Spend existing UTXO and create new one with combined value
    console.log(`   Found existing UTXO with ${lovelaceToAda(existingValue)} ADA`);
    console.log(`   Will consolidate to single UTXO with ${lovelaceToAda(existingValue + depositAmountLovelace)} ADA`);
    
    newTotalValue = existingValue + depositAmountLovelace;
    
    // Redeemer for Deposit action
    const redeemer = walletRedeemerToData({ type: WalletRedeemerType.Deposit });
    
    // Keep the same datum (same owner, same agents)
    const outputDatum = walletDatumToData(existingDatum);
    
    // Find collateral UTXO
    const collateralUtxo = userUtxos.find((utxo: any) => {
      const lovelace = utxo.output.amount.find((a: Asset) => a.unit === 'lovelace');
      const qty = BigInt(lovelace?.quantity ?? 0);
      return qty >= 5_000_000n;
    });

    if (!collateralUtxo) {
      console.error('❌ No suitable collateral UTXO found (need at least 5 ADA)');
      process.exit(1);
    }

    unsignedTx = await txBuilder
      // Spend the existing script UTXO
      .spendingPlutusScriptV3()
      .txIn(
        existingUtxo.input.txHash,
        existingUtxo.input.outputIndex
      )
      .txInInlineDatumPresent()
      .txInRedeemerValue(redeemer)
      .txInScript(scriptCode)
      // Create new UTXO with combined value
      .txOut(scriptAddress, [
        { unit: 'lovelace', quantity: newTotalValue.toString() }
      ])
      .txOutInlineDatumValue(outputDatum)
      // Collateral
      .txInCollateral(
        collateralUtxo.input.txHash,
        collateralUtxo.input.outputIndex,
        collateralUtxo.output.amount,
        collateralUtxo.output.address
      )
      // Owner must sign
      .requiredSignerHash(userPkh)
      .changeAddress(userAddress)
      .selectUtxosFrom(userUtxos)
      .complete();
  } else {
    // INITIAL DEPOSIT: No existing UTXO, create fresh one
    console.log('   No existing UTXO found, creating new custodial wallet');
    
    // Create initial datum with agent authorization
    const datum: WalletDatum = createInitialDatum(userPkh, agentPkh);
    newTotalValue = depositAmountLovelace;

    console.log('\n📋 Wallet Configuration:');
    console.log(`   Owner: ${datum.owner}`);
    console.log(`   Approved Agents: ${datum.approvedAgents.length}`);

    unsignedTx = await txBuilder
      .txOut(scriptAddress, [
        { unit: 'lovelace', quantity: depositAmountLovelace.toString() }
      ])
      .txOutInlineDatumValue(walletDatumToData(datum))
      .changeAddress(userAddress)
      .selectUtxosFrom(userUtxos)
      .complete();
  }

  console.log('✍️  Signing transaction...');
  const signedTx = await userWallet.signTx(unsignedTx);

  console.log('📤 Submitting transaction...');
  const txHash = await userWallet.submitTx(signedTx);

  console.log(`\n✅ Deposit successful!`);
  console.log(`   TX Hash: ${txHash}`);
  console.log(`   Deposited: ${depositAmountAda} ADA`);
  console.log(`   Total in Wallet: ${lovelaceToAda(newTotalValue)} ADA`);
  console.log(`\n🔗 View on CardanoScan:`);
  console.log(`   https://preprod.cardanoscan.io/transaction/${txHash}`);

  // Wait for confirmation
  console.log('\n⏳ Waiting for confirmation...');
  await waitForTx(txHash);
  console.log('✅ Transaction confirmed!');

  return txHash;
}

main()
  .then((txHash) => {
    console.log('\n🎉 Deposit completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deposit failed:', error);
    process.exit(1);
  });
