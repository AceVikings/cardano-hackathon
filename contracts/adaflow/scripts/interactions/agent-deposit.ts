/**
 * AdaFlow - Agent Deposit Script
 * Agent deposits ADA/tokens back to user's custodial wallet
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
  console.log('🤖 AdaFlow - Agent Deposit to Custodial Wallet');
  console.log('==============================================\n');

  // Amount to deposit (in ADA)
  const depositAmountAda = 2;
  const depositAmountLovelace = adaToLovelace(depositAmountAda);

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

  // Find existing UTXOs at script address (to add funds to)
  console.log('🔍 Looking for existing custodial wallet UTXOs...');
  const scriptUtxos = await blockfrostProvider.fetchAddressUTxOs(scriptAddress);

  // Get agent UTXOs
  const agentUtxos = await agentWallet.getUtxos();
  const agentBalance = agentUtxos.reduce((sum, utxo) => {
    const lovelace = utxo.output.amount.find((a: any) => a.unit === 'lovelace');
    return sum + BigInt(lovelace?.quantity ?? 0);
  }, 0n);

  console.log(`   Agent Balance: ${lovelaceToAda(agentBalance)} ADA`);

  if (agentBalance < depositAmountLovelace + 2_000_000n) {
    console.error('❌ Insufficient agent funds for deposit + fees');
    process.exit(1);
  }

  // Get agent address for change
  const agentAddresses = await agentWallet.getUsedAddresses();
  const agentAddress = agentAddresses[0] || (await agentWallet.getUnusedAddresses())[0];

  // Datum for the wallet
  const datum: WalletDatum = {
    owner: userPkh,
    approvedAgents: [agentPkh],
  };

  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    submitter: blockfrostProvider,
  });

  let unsignedTx: string;

  if (scriptUtxos.length === 0) {
    // No existing UTXO - create a new one (simple deposit without spending script)
    console.log('   No existing wallet UTXO found - creating new deposit');
    console.log(`\n📋 Transaction Details:`);
    console.log(`   Depositing: ${depositAmountAda} ADA (new wallet)`);

    unsignedTx = await txBuilder
      .txOut(scriptAddress, [
        { unit: 'lovelace', quantity: depositAmountLovelace.toString() }
      ])
      .txOutInlineDatumValue(walletDatumToData(datum))
      .changeAddress(agentAddress)
      .selectUtxosFrom(agentUtxos)
      .complete();
  } else {
    // Existing UTXO - spend it and create new one with more funds
    const targetUtxo = scriptUtxos[0];
    const existingLovelace = BigInt(
      targetUtxo.output.amount.find((a: any) => a.unit === 'lovelace')?.quantity ?? 0
    );
    const existingTokens = targetUtxo.output.amount.filter((a: any) => a.unit !== 'lovelace');

    console.log(`   Found existing UTXO: ${targetUtxo.input.txHash}#${targetUtxo.input.outputIndex}`);
    console.log(`   Current Balance: ${lovelaceToAda(existingLovelace)} ADA`);
    if (existingTokens.length > 0) {
      console.log(`   Existing Tokens: ${existingTokens.length} asset(s)`);
    }

    const newLovelace = existingLovelace + depositAmountLovelace;

    console.log(`\n📋 Transaction Details:`);
    console.log(`   Depositing: ${depositAmountAda} ADA`);
    console.log(`   New Balance: ${lovelaceToAda(newLovelace)} ADA`);

    // Create redeemer for AgentDeposit
    const redeemer = walletRedeemerToData({
      type: WalletRedeemerType.AgentDeposit,
    });

    // Get collateral UTXO from agent
    const collateralUtxo = agentUtxos.find((utxo: any) => {
      const lovelace = utxo.output.amount.find((a: any) => a.unit === 'lovelace');
      const qty = BigInt(lovelace?.quantity ?? 0);
      return qty >= 5_000_000n;
    });

    if (!collateralUtxo) {
      console.error('❌ No suitable collateral UTXO found (need at least 5 ADA)');
      process.exit(1);
    }

    // Build new output amounts (existing tokens + new ADA)
    const outputAmounts: { unit: string; quantity: string }[] = [
      { unit: 'lovelace', quantity: newLovelace.toString() },
      ...existingTokens,
    ];

    unsignedTx = await txBuilder
      // Spend the existing script UTXO
      .spendingPlutusScriptV3()
      .txIn(
        targetUtxo.input.txHash,
        targetUtxo.input.outputIndex
      )
      .txInInlineDatumPresent()
      .txInRedeemerValue(redeemer)
      .txInScript(scriptCode)
      // Create new output with increased balance
      .txOut(scriptAddress, outputAmounts)
      .txOutInlineDatumValue(walletDatumToData(datum))
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
  }

  console.log('\n🔨 Building transaction...');
  console.log('✍️  Signing transaction with agent key...');
  const signedTx = await agentWallet.signTx(unsignedTx);

  console.log('📤 Submitting transaction...');
  const txHash = await agentWallet.submitTx(signedTx);

  console.log(`\n✅ Agent deposit successful!`);
  console.log(`   TX Hash: ${txHash}`);
  console.log(`   Amount Deposited: ${depositAmountAda} ADA`);
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
    console.log('\n🎉 Agent deposit completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Agent deposit failed:', error);
    process.exit(1);
  });
