import { MeshWallet } from '@meshsdk/core';

async function generateWallets() {
  // Generate User Wallet
  const userMnemonic = MeshWallet.brew();
  console.log('USER_MNEMONIC=' + userMnemonic.join(' '));

  const userWallet = new MeshWallet({
    networkId: 0, // preprod
    key: { type: 'mnemonic', words: userMnemonic },
  });
  const userAddresses = await userWallet.getUnusedAddresses();
  console.log('USER_ADDRESS=' + userAddresses[0]);

  // Generate Agent Wallet
  const agentMnemonic = MeshWallet.brew();
  console.log('AGENT_MNEMONIC=' + agentMnemonic.join(' '));

  const agentWallet = new MeshWallet({
    networkId: 0, // preprod
    key: { type: 'mnemonic', words: agentMnemonic },
  });
  const agentAddresses = await agentWallet.getUnusedAddresses();
  console.log('AGENT_ADDRESS=' + agentAddresses[0]);
}

generateWallets();
