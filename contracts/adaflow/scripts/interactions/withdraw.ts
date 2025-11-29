/**
 * AdaFlow - User Withdraw Script
 * User withdraws all their funds (ADA + tokens) from the custodial wallet
 */

import 'dotenv/config';
import {
  MeshTxBuilder,
} from '@meshsdk/core';
import {
  getUserWallet,
  blockfrostProvider,
  getCustodialWalletAddress,
  getPaymentKeyHash,
  waitForTx,
} from '../wallet.js';
import {
  walletRedeemerToData,
  WalletRedeemerType,
  lovelaceToAda,
} from '../types.js';
import { getCustodialWalletScript } from '../blueprint.js';

interface Asset {
  unit: string;
  quantity: string;
}

async function main() {
  console.log('💸 AdaFlow - User Withdraw from Custodial Wallet');
  console.log('================================================\n');

  // Get user wallet
  const userWallet = await getUserWallet();
  const userPkh = await getPaymentKeyHash(userWallet);

  console.log(`👤 User PKH: ${userPkh}`);

  // Get script info
  const scriptAddress = getCustodialWalletAddress();
  const scriptCode = getCustodialWalletScript();

  console.log(`📜 Script Address: ${scriptAddress}\n`);

  // Find UTXOs at script address
  console.log('🔍 Looking for custodial wallet UTXOs...');
  const scriptUtxos = await blockfrostProvider.fetchAddressUTxOs(scriptAddress);

  if (scriptUtxos.length === 0) {
    console.error('❌ No UTXOs found at script address.');
    process.exit(1);
  }

  console.log(`   Found ${scriptUtxos.length} UTXO(s)`);

  // Use the first UTXO (in production, would filter by owner)
  const targetUtxo = scriptUtxos[0];
  const utxoAmounts: Asset[] = targetUtxo.output.amount;
  
  const inputLovelace = BigInt(
    utxoAmounts.find((a: Asset) => a.unit === 'lovelace')?.quantity ?? 0
  );
  const tokens = utxoAmounts.filter((a: Asset) => a.unit !== 'lovelace');

  console.log(`   Target UTXO: ${targetUtxo.input.txHash}#${targetUtxo.input.outputIndex}`);
  console.log(`   ADA to Withdraw: ${lovelaceToAda(inputLovelace)} ADA`);
  
  if (tokens.length > 0) {
    console.log(`   Tokens to Withdraw: ${tokens.length} asset(s)`);
    for (const token of tokens) {
      // Token unit format: policyId + assetName (hex)
      const policyId = token.unit.slice(0, 56);
      const assetName = token.unit.slice(56);
      const assetNameStr = assetName ? Buffer.from(assetName, 'hex').toString('utf8') : '(no name)';
      console.log(`     - ${token.quantity} ${assetNameStr} (${policyId.slice(0, 8)}...)`);
    }
  }

  // Get user address
  const userAddresses = await userWallet.getUsedAddresses();
  const userAddress = userAddresses[0] || (await userWallet.getUnusedAddresses())[0];

  // Get user UTXOs for collateral
  const userUtxos = await userWallet.getUtxos();
  const collateralUtxo = userUtxos.find((utxo: any) => {
    const lovelace = utxo.output.amount.find((a: Asset) => a.unit === 'lovelace');
    const qty = BigInt(lovelace?.quantity ?? 0);
    return qty >= 5_000_000n;
  });

  if (!collateralUtxo) {
    console.error('❌ No suitable collateral UTXO found (need at least 5 ADA)');
    process.exit(1);
  }

  // Create redeemer
  const redeemer = walletRedeemerToData({
    type: WalletRedeemerType.UserWithdraw,
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
    // Send ALL funds (ADA + tokens) to user
    .txOut(userAddress, utxoAmounts)
    // Collateral
    .txInCollateral(
      collateralUtxo.input.txHash,
      collateralUtxo.input.outputIndex,
      collateralUtxo.output.amount,
      collateralUtxo.output.address
    )
    // User must sign
    .requiredSignerHash(userPkh)
    .changeAddress(userAddress)
    .selectUtxosFrom(userUtxos)
    .complete();

  console.log('✍️  Signing transaction...');
  const signedTx = await userWallet.signTx(unsignedTx);

  console.log('📤 Submitting transaction...');
  const txHash = await userWallet.submitTx(signedTx);

  console.log(`\n✅ Withdrawal successful!`);
  console.log(`   TX Hash: ${txHash}`);
  console.log(`   ADA: ${lovelaceToAda(inputLovelace)} ADA`);
  if (tokens.length > 0) {
    console.log(`   Tokens: ${tokens.length} asset(s)`);
  }
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
    console.log('\n🎉 Withdrawal completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Withdrawal failed:', error);
    process.exit(1);
  });
