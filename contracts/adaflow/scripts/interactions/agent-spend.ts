/**
 * AdaFlow - Agent Spend Script
 * Agent spends funds from the custodial wallet (no limits)
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
  adaToLovelace,
  lovelaceToAda,
} from '../types.js';
import { getCustodialWalletScript } from '../blueprint.js';

async function main() {
  console.log('🤖 AdaFlow - Agent Spend from Custodial Wallet');
  console.log('==============================================\n');

  // Amount to spend (in ADA)
  const spendAmountAda = 2;
  const spendAmountLovelace = adaToLovelace(spendAmountAda);

  // Get wallets
  const userWallet = await getUserWallet();
  const agentWallet = await getAgentWallet();

  // Get key hashes
  const userPkh = await getPaymentKeyHash(userWallet);
  const agentPkh = await getPaymentKeyHash(agentWallet);

  console.log(`👤 User PKH: ${userPkh}`);
  console.log(`🤖 Agent PKH: ${agentPkh}`);

  // Get script info
  const scriptAddress = getCustodialWalletAddress();
  const scriptCode = getCustodialWalletScript();

  console.log(`📜 Script Address: ${scriptAddress}\n`);

  // Find UTXOs at script address
  console.log('🔍 Looking for custodial wallet UTXOs...');
  const scriptUtxos = await blockfrostProvider.fetchAddressUTxOs(scriptAddress);

  if (scriptUtxos.length === 0) {
    console.error('❌ No UTXOs found at script address. Please deposit first.');
    process.exit(1);
  }

  console.log(`   Found ${scriptUtxos.length} UTXO(s)`);

  // Use the first UTXO
  const targetUtxo = scriptUtxos[0];
  const inputLovelace = BigInt(
    targetUtxo.output.amount.find((a: any) => a.unit === 'lovelace')?.quantity ?? 0
  );

  console.log(`   Target UTXO: ${targetUtxo.input.txHash}#${targetUtxo.input.outputIndex}`);
  console.log(`   Current Balance: ${lovelaceToAda(inputLovelace)} ADA`);

  // Check if spend amount is valid
  if (spendAmountLovelace > inputLovelace - 2_000_000n) {
    console.error('❌ Spend amount exceeds available balance (keeping 2 ADA for min UTXO)');
    process.exit(1);
  }

  console.log(`\n📋 Transaction Details:`);
  console.log(`   Spending: ${spendAmountAda} ADA`);

  // Get agent address for receiving the spent funds
  const agentAddresses = await agentWallet.getUsedAddresses();
  const agentAddress = agentAddresses[0] || (await agentWallet.getUnusedAddresses())[0];

  // Get agent UTXOs for collateral
  const agentUtxos = await agentWallet.getUtxos();
  const collateralUtxo = agentUtxos.find((utxo: any) => {
    const lovelace = utxo.output.amount.find((a: any) => a.unit === 'lovelace');
    const qty = BigInt(lovelace?.quantity ?? 0);
    return qty >= 5_000_000n;
  });

  if (!collateralUtxo) {
    console.error('❌ No suitable collateral UTXO found (need at least 5 ADA)');
    process.exit(1);
  }

  // Create redeemer - simple AgentSpend with no parameters
  const redeemer = walletRedeemerToData({
    type: WalletRedeemerType.AgentSpend,
  });

  // Build transaction
  console.log('\n🔨 Building transaction...');

  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    submitter: blockfrostProvider,
  });

  const unsignedTx = await txBuilder
    // Spend the script UTXO
    .spendingPlutusScriptV3()
    .txIn(
      targetUtxo.input.txHash,
      targetUtxo.input.outputIndex
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(redeemer)
    .txInScript(scriptCode)
    // Send spent amount to agent
    .txOut(agentAddress, [
      { unit: 'lovelace', quantity: spendAmountLovelace.toString() }
    ])
    // Collateral
    .txInCollateral(
      collateralUtxo.input.txHash,
      collateralUtxo.input.outputIndex,
      collateralUtxo.output.amount,
      collateralUtxo.output.address
    )
    // Agent must sign
    .requiredSignerHash(agentPkh)
    .changeAddress(agentAddress)
    .selectUtxosFrom(agentUtxos)
    .complete();

  console.log('✍️  Signing transaction with agent key...');
  const signedTx = await agentWallet.signTx(unsignedTx);

  console.log('📤 Submitting transaction...');
  const txHash = await agentWallet.submitTx(signedTx);

  console.log(`\n✅ Agent spend successful!`);
  console.log(`   TX Hash: ${txHash}`);
  console.log(`   Amount Spent: ${spendAmountAda} ADA`);
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
    console.log('\n🎉 Agent spend completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Agent spend failed:', error);
    process.exit(1);
  });
