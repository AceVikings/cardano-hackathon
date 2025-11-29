/**
 * AdaFlow Contract Deployment Script
 * Validates the contract build and displays deployment information
 */

import 'dotenv/config';
import { getCustodialWalletScript, getCustodialWalletScriptHash, getBlueprint } from './blueprint.js';
import { getUserWallet, getAgentWallet, logWalletInfo, getCustodialWalletAddress, getPaymentKeyHash } from './wallet.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🚀 AdaFlow Contract Deployment Info');
  console.log('====================================\n');

  // Load blueprint info
  const blueprint = getBlueprint();
  console.log(`📜 Contract: ${blueprint.preamble.title}`);
  console.log(`   Version: ${blueprint.preamble.version}`);
  console.log(`   Plutus: ${blueprint.preamble.plutusVersion}\n`);

  // Get wallets
  const userWallet = await getUserWallet();
  const agentWallet = await getAgentWallet();

  await logWalletInfo(userWallet, 'User (Owner)');
  await logWalletInfo(agentWallet, 'Agent (Backend)');

  // Get script info
  const scriptCode = getCustodialWalletScript();
  const scriptHash = getCustodialWalletScriptHash();
  const scriptAddress = getCustodialWalletAddress();

  console.log('\n📄 Custodial Wallet Contract:');
  console.log(`   Script Hash: ${scriptHash}`);
  console.log(`   Script Address: ${scriptAddress}`);

  // Get key hashes
  const userPkh = await getPaymentKeyHash(userWallet);
  const agentPkh = await getPaymentKeyHash(agentWallet);

  console.log('\n🔑 Key Hashes:');
  console.log(`   User PKH: ${userPkh}`);
  console.log(`   Agent PKH: ${agentPkh}`);

  // Get addresses
  const userAddresses = await userWallet.getUsedAddresses();
  const userAddress = userAddresses[0] || (await userWallet.getUnusedAddresses())[0];
  
  const agentAddresses = await agentWallet.getUsedAddresses();
  const agentAddress = agentAddresses[0] || (await agentWallet.getUnusedAddresses())[0];

  // Save deployment info
  const deploymentInfo = {
    network: process.env.NETWORK || 'preprod',
    deployedAt: new Date().toISOString(),
    custodialWallet: {
      scriptHash,
      scriptAddress,
      compiledCodeLength: scriptCode.length,
    },
    wallets: {
      userAddress,
      userPkh,
      agentAddress,
      agentPkh,
    },
    blueprint: {
      title: blueprint.preamble.title,
      version: blueprint.preamble.version,
      plutusVersion: blueprint.preamble.plutusVersion,
    },
  };

  const deploymentPath = path.join(__dirname, 'deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log('\n✅ Deployment info saved to deployment.json');
  console.log('\n📋 Next Steps:');
  console.log('   1. Run "npm run deposit" to deposit ADA into the custodial wallet');
  console.log('   2. Run "npm run agent-spend" to simulate agent spending');
  console.log('   3. Run "npm run withdraw" to withdraw funds');
  console.log('   4. Run "npm run test" for a full test scenario');

  return deploymentInfo;
}

main()
  .then((info) => {
    console.log('\n🎉 Deployment info generated successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
