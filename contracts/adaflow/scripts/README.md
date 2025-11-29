# AdaFlow Contract Deployment & Interaction Scripts

This directory contains TypeScript scripts for deploying and interacting with the AdaFlow custodial wallet smart contracts on Cardano.

## Prerequisites

1. **Node.js** (v18+)
2. **Test ADA** on Preprod testnet
3. **Blockfrost API Key** (free at https://blockfrost.io)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with:
- `BLOCKFROST_API_KEY` - Get from https://blockfrost.io (select Preprod network)
- `USER_MNEMONIC` - 24-word seed phrase for the user wallet (owner of funds)
- `AGENT_MNEMONIC` - 24-word seed phrase for the agent wallet (can spend on user's behalf)

### 3. Get Test ADA

Get test ADA from the Cardano Faucet:
- https://docs.cardano.org/cardano-testnets/tools/faucet/

Send at least:
- **60 ADA** to the user wallet
- **10 ADA** to the agent wallet

## Scripts

### Deploy

Shows deployment info and script addresses:

```bash
npm run deploy
```

### Deposit

User deposits ADA into the custodial wallet:

```bash
npm run deposit
```

### Agent Spend

Agent spends funds within authorized limits:

```bash
npm run agent-spend
```

### Withdraw

User withdraws funds from custodial wallet:

```bash
npm run withdraw
```

### Full Simulation

Runs a complete simulation demonstrating:
1. User deposits 50 ADA
2. Agent spends 5 ADA (within limits)
3. Validates spending limits are enforced

```bash
npm run simulate
```

## Contract Overview

### Custodial Wallet (`custodial_wallet.ak`)

Allows users to deposit ADA that agents can spend on their behalf within defined limits.

**Features:**
- Per-transaction spending limits
- Lifetime spending limits  
- User always retains full control
- Emergency withdrawal option
- Nonce-based replay protection

**Datum Structure:**
```
WalletDatum {
  owner: VerificationKeyHash,      // User who owns the funds
  agent: VerificationKeyHash,      // Agent authorized to spend
  max_ada_per_tx: Int,             // Max lovelace per transaction
  max_total_ada: Int,              // Max lovelace lifetime
  total_spent: Int,                // Running total of agent spending
  nonce: Int,                      // Replay protection
}
```

**Redeemer Actions:**
- `Deposit` - User adds more funds
- `AgentSpend { amount }` - Agent spends within limits
- `UserWithdraw` - User takes funds back
- `UpdateLimits` - User changes spending limits
- `ChangeAgent` - User authorizes a different agent
- `EmergencyWithdraw` - User emergency exit

## Network

Scripts default to **Preprod** testnet. To change, modify `NETWORK` in `.env`.

## Explorer

View transactions on Cardano Preprod:
- https://preprod.cardanoscan.io

## Troubleshooting

### "No UTXOs found"
- Ensure wallets are funded with test ADA
- Wait for previous transactions to confirm

### "Collateral required"
- Agent wallet needs ADA for collateral (minimum 5 ADA recommended)

### "Script validation failed"
- Check that spending limits aren't exceeded
- Verify correct signatures are provided
