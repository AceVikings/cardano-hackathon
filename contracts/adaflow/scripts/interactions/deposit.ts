/**
 * AdaFlow - Deposit Script
 * User deposits ADA into their custodial wallet with agent authorization
 */

import 'dotenv/config';
import {
  MeshTxBuilder,
  deserializeAddress,
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
  createInitialDatum,
  adaToLovelace,
  lovelaceToAda,
} from '../types.js';

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

  // Get script address
  const scriptAddress = getCustodialWalletAddress();
  console.log(`📜 Script Address: ${scriptAddress}\n`);

  // Check user balance
  const userUtxos = await userWallet.getUtxos();
  const userBalance = userUtxos.reduce((sum, utxo) => {
    const lovelace = utxo.output.amount.find(a => a.unit === 'lovelace');
    return sum + BigInt(lovelace?.quantity ?? 0);
  }, 0n);
  console.log(`💳 User Balance: ${lovelaceToAda(userBalance)} ADA`);

  if (userBalance < depositAmountLovelace + 2_000_000n) {
    console.error('❌ Insufficient funds for deposit + fees');
    process.exit(1);
  }

  // Create initial datum with agent authorization
  // Setting generous limits: 10 ADA per tx, 100 ADA total
  const datum: WalletDatum = createInitialDatum(
    userPkh,
    agentPkh,
    10, // max 10 ADA per transaction
    100 // max 100 ADA total spending by agent
  );

  console.log('\n📋 Wallet Configuration:');
  console.log(`   Owner: ${datum.owner}`);
  console.log(`   Approved Agents: ${datum.approvedAgents.length}`);
  console.log(`   Max per TX: ${lovelaceToAda(datum.maxAdaPerTx)} ADA`);
  console.log(`   Max Total: ${lovelaceToAda(datum.maxTotalAda)} ADA`);
  console.log(`   Strategy: Manual`);
  console.log(`   Min Reserve: ${lovelaceToAda(datum.strategy.minReserve)} ADA\n`);

  // Get user address for change
  const userAddresses = await userWallet.getUsedAddresses();
  const userAddress = userAddresses[0] || (await userWallet.getUnusedAddresses())[0];

  // Build transaction
  console.log('🔨 Building transaction...');
  
  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    submitter: blockfrostProvider,
  });

  // Add inputs and output to script with datum
  const unsignedTx = await txBuilder
    .txOut(scriptAddress, [
      { unit: 'lovelace', quantity: depositAmountLovelace.toString() }
    ])
    .txOutInlineDatumValue(walletDatumToData(datum))
    .changeAddress(userAddress)
    .selectUtxosFrom(userUtxos)
    .complete();

  console.log('✍️  Signing transaction...');
  const signedTx = await userWallet.signTx(unsignedTx);

  console.log('📤 Submitting transaction...');
  const txHash = await userWallet.submitTx(signedTx);

  console.log(`\n✅ Deposit successful!`);
  console.log(`   TX Hash: ${txHash}`);
  console.log(`   Amount: ${depositAmountAda} ADA`);
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
