/**
 * AdaFlow - Full Test Suite
 * Tests the complete flow: deposit -> agent spend -> withdraw
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
  logWalletInfo,
} from './wallet.js';
import {
  WalletDatum,
  walletDatumToData,
  walletRedeemerToData,
  WalletRedeemerType,
  createInitialDatum,
  adaToLovelace,
  lovelaceToAda,
  stringToHex,
} from './types.js';
import { getCustodialWalletScript } from './blueprint.js';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDeposit(
  userWallet: any,
  userPkh: string,
  agentPkh: string,
  scriptAddress: string,
  depositAmountAda: number
): Promise<string> {
  console.log('\n📥 STEP 1: DEPOSIT');
  console.log('==================');
  
  const depositAmountLovelace = adaToLovelace(depositAmountAda);
  const userUtxos = await userWallet.getUtxos();
  const userAddresses = await userWallet.getUsedAddresses();
  const userAddress = userAddresses[0] || (await userWallet.getUnusedAddresses())[0];

  // Create initial datum
  const datum: WalletDatum = createInitialDatum(userPkh, agentPkh, 10, 100);
  
  console.log(`   Depositing ${depositAmountAda} ADA to custodial wallet...`);
  
  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    submitter: blockfrostProvider,
  });

  const unsignedTx = await txBuilder
    .txOut(scriptAddress, [
      { unit: 'lovelace', quantity: depositAmountLovelace.toString() }
    ])
    .txOutInlineDatumValue(walletDatumToData(datum))
    .changeAddress(userAddress)
    .selectUtxosFrom(userUtxos)
    .complete();

  const signedTx = await userWallet.signTx(unsignedTx);
  const txHash = await userWallet.submitTx(signedTx);
  
  console.log(`   ✅ Deposit TX: ${txHash}`);
  
  await waitForTx(txHash);
  return txHash;
}

async function testAgentSpend(
  agentWallet: any,
  userPkh: string,
  agentPkh: string,
  scriptAddress: string,
  spendAmountAda: number,
  currentTotalSpent: bigint
): Promise<string> {
  console.log('\n🤖 STEP 2: AGENT SPEND');
  console.log('======================');
  
  const spendAmountLovelace = adaToLovelace(spendAmountAda);
  const scriptCode = getCustodialWalletScript();
  
  // Find script UTXO
  const scriptUtxos = await blockfrostProvider.fetchAddressUTxOs(scriptAddress);
  if (scriptUtxos.length === 0) {
    throw new Error('No script UTXO found');
  }
  
  const targetUtxo = scriptUtxos[0];
  const inputLovelace = BigInt(
    targetUtxo.output.amount.find((a: any) => a.unit === 'lovelace')?.quantity ?? 0
  );
  
  console.log(`   Script UTXO balance: ${lovelaceToAda(inputLovelace)} ADA`);
  console.log(`   Agent spending: ${spendAmountAda} ADA`);
  
  // Create input datum (reconstructed)
  const inputDatum: WalletDatum = {
    owner: userPkh,
    approvedAgents: [agentPkh],
    maxAdaPerTx: adaToLovelace(10),
    maxTotalAda: adaToLovelace(100),
    totalSpent: currentTotalSpent,
    strategy: {
      strategyType: { type: 0 },
      minReserve: 2_000_000n,
      autoCompound: false,
      maxSlippageBps: 100n,
    },
    nonce: 0n,
  };

  // Create output datum with updated total_spent
  const outputDatum: WalletDatum = {
    ...inputDatum,
    totalSpent: inputDatum.totalSpent + spendAmountLovelace,
  };

  const outputLovelace = inputLovelace - spendAmountLovelace;
  
  // Get agent info
  const agentAddresses = await agentWallet.getUsedAddresses();
  const agentAddress = agentAddresses[0] || (await agentWallet.getUnusedAddresses())[0];
  const agentUtxos = await agentWallet.getUtxos();
  
  const collateralUtxo = agentUtxos.find((utxo: any) => {
    const lovelace = utxo.output.amount.find((a: any) => a.unit === 'lovelace');
    return BigInt(lovelace?.quantity ?? 0) >= 5_000_000n;
  });

  if (!collateralUtxo) {
    throw new Error('No collateral UTXO found');
  }

  const redeemer = walletRedeemerToData({
    type: WalletRedeemerType.AgentSpend,
    details: {
      amount: spendAmountLovelace,
      purpose: stringToHex('DeFi operation'),
    },
  });

  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    submitter: blockfrostProvider,
  });

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(targetUtxo.input.txHash, targetUtxo.input.outputIndex)
    .txInInlineDatumPresent()
    .txInRedeemerValue(redeemer)
    .txInScript(scriptCode)
    .txOut(scriptAddress, [
      { unit: 'lovelace', quantity: outputLovelace.toString() }
    ])
    .txOutInlineDatumValue(walletDatumToData(outputDatum))
    .txOut(agentAddress, [
      { unit: 'lovelace', quantity: spendAmountLovelace.toString() }
    ])
    .txInCollateral(
      collateralUtxo.input.txHash,
      collateralUtxo.input.outputIndex,
      collateralUtxo.output.amount,
      collateralUtxo.output.address
    )
    .requiredSignerHash(agentPkh)
    .changeAddress(agentAddress)
    .selectUtxosFrom(agentUtxos)
    .complete();

  const signedTx = await agentWallet.signTx(unsignedTx);
  const txHash = await agentWallet.submitTx(signedTx);
  
  console.log(`   ✅ Agent Spend TX: ${txHash}`);
  
  await waitForTx(txHash);
  return txHash;
}

async function testWithdraw(
  userWallet: any,
  userPkh: string,
  scriptAddress: string
): Promise<string> {
  console.log('\n💸 STEP 3: USER WITHDRAW');
  console.log('=========================');
  
  const scriptCode = getCustodialWalletScript();
  
  // Find script UTXO
  const scriptUtxos = await blockfrostProvider.fetchAddressUTxOs(scriptAddress);
  if (scriptUtxos.length === 0) {
    throw new Error('No script UTXO found');
  }
  
  const targetUtxo = scriptUtxos[0];
  const inputLovelace = BigInt(
    targetUtxo.output.amount.find((a: any) => a.unit === 'lovelace')?.quantity ?? 0
  );
  
  console.log(`   Withdrawing ${lovelaceToAda(inputLovelace)} ADA...`);
  
  // Get user info
  const userAddresses = await userWallet.getUsedAddresses();
  const userAddress = userAddresses[0] || (await userWallet.getUnusedAddresses())[0];
  const userUtxos = await userWallet.getUtxos();
  
  const collateralUtxo = userUtxos.find((utxo: any) => {
    const lovelace = utxo.output.amount.find((a: any) => a.unit === 'lovelace');
    return BigInt(lovelace?.quantity ?? 0) >= 5_000_000n;
  });

  if (!collateralUtxo) {
    throw new Error('No collateral UTXO found');
  }

  const redeemer = walletRedeemerToData({
    type: WalletRedeemerType.UserWithdraw,
  });

  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    submitter: blockfrostProvider,
  });

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(targetUtxo.input.txHash, targetUtxo.input.outputIndex)
    .txInInlineDatumPresent()
    .txInRedeemerValue(redeemer)
    .txInScript(scriptCode)
    .txOut(userAddress, [
      { unit: 'lovelace', quantity: inputLovelace.toString() }
    ])
    .txInCollateral(
      collateralUtxo.input.txHash,
      collateralUtxo.input.outputIndex,
      collateralUtxo.output.amount,
      collateralUtxo.output.address
    )
    .requiredSignerHash(userPkh)
    .changeAddress(userAddress)
    .selectUtxosFrom(userUtxos)
    .complete();

  const signedTx = await userWallet.signTx(unsignedTx);
  const txHash = await userWallet.submitTx(signedTx);
  
  console.log(`   ✅ Withdraw TX: ${txHash}`);
  
  await waitForTx(txHash);
  return txHash;
}

async function main() {
  console.log('🧪 AdaFlow - Full Test Suite');
  console.log('============================');
  console.log('Testing: Deposit → Agent Spend → Withdraw\n');

  // Setup
  const userWallet = await getUserWallet();
  const agentWallet = await getAgentWallet();
  const userPkh = await getPaymentKeyHash(userWallet);
  const agentPkh = await getPaymentKeyHash(agentWallet);
  const scriptAddress = getCustodialWalletAddress();

  console.log('📋 Configuration:');
  console.log(`   User PKH: ${userPkh}`);
  console.log(`   Agent PKH: ${agentPkh}`);
  console.log(`   Script Address: ${scriptAddress}`);

  await logWalletInfo(userWallet, 'User');
  await logWalletInfo(agentWallet, 'Agent');

  // Test parameters
  const depositAmount = 10; // ADA
  const spendAmount = 2;    // ADA

  try {
    // Step 1: Deposit
    const depositTx = await testDeposit(
      userWallet, userPkh, agentPkh, scriptAddress, depositAmount
    );
    
    console.log('\n⏳ Waiting 10s before agent spend...');
    await delay(10000);
    
    // Step 2: Agent Spend
    const spendTx = await testAgentSpend(
      agentWallet, userPkh, agentPkh, scriptAddress, spendAmount, 0n
    );
    
    console.log('\n⏳ Waiting 10s before withdraw...');
    await delay(10000);
    
    // Step 3: Withdraw
    const withdrawTx = await testWithdraw(
      userWallet, userPkh, scriptAddress
    );

    // Final summary
    console.log('\n🎉 TEST RESULTS');
    console.log('================');
    console.log(`✅ Deposit TX:     ${depositTx}`);
    console.log(`✅ Agent Spend TX: ${spendTx}`);
    console.log(`✅ Withdraw TX:    ${withdrawTx}`);
    console.log('\n🔗 View on CardanoScan:');
    console.log(`   Deposit: https://preprod.cardanoscan.io/transaction/${depositTx}`);
    console.log(`   Spend:   https://preprod.cardanoscan.io/transaction/${spendTx}`);
    console.log(`   Withdraw:https://preprod.cardanoscan.io/transaction/${withdrawTx}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test suite failed');
    process.exit(1);
  });
