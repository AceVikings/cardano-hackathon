# AdaFlow Smart Contracts

## Agent-Governed Custodial Wallet System for Cardano

AdaFlow implements a **Masumi AI agent-compatible** custodial wallet system on Cardano. Users deposit tokens into script-controlled UTXOs, and approved AI agents can spend freely on behalf of the user.

---

## 🏗️ Architecture Overview (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Wallet                             │
│  ┌─────────────────┐                                            │
│  │ Deposit / Setup │────┐                                       │
│  └─────────────────┘    │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Cardano Blockchain (Preprod)                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 Custodial Wallet Validator                  │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │  WalletDatum                                         │   │ │
│  │  │  ├── owner: VerificationKeyHash                      │   │ │
│  │  │  └── approved_agents: List<VerificationKeyHash>      │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Masumi AI Agent                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Agent can spend from wallet (requires signature)          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📜 Validators

### Custodial Wallet (`validators/custodial_wallet.ak`)

The main validator controlling user funds with agent-based spending. **Simplified design** - approved agents can spend freely without limits.

#### Types

```aiken
/// Wallet datum stored with each UTXO
type WalletDatum {
  owner: VerificationKeyHash,           // User who owns the wallet
  approved_agents: List<VerificationKeyHash>,  // Agents that can spend
}
```

#### Redeemers

| Redeemer | Required Signer | Description |
|----------|-----------------|-------------|
| `Deposit` | - | Add funds to custodial wallet |
| `AgentSpend` | Approved Agent | Spend from wallet |
| `UserWithdraw` | Owner | Full withdrawal rights |
| `AddAgent { agent }` | Owner | Authorize new agent |
| `RemoveAgent { agent }` | Owner | Revoke agent access |

#### Validation Rules

**Deposit:**
- Anyone can deposit to the wallet address
- Inline datum specifies owner and approved agents

**AgentSpend:**
- Transaction signer must be in `approved_agents` list
- Agent can spend any amount (no limits in simplified version)

**UserWithdraw:**
- Transaction signer must be `owner`
- Can withdraw entire UTXO

**AddAgent/RemoveAgent:**
- Transaction signer must be `owner`
- Modifies the `approved_agents` list

---

## 🚀 Deployment

### Script Information (Preprod)

| Property | Value |
|----------|-------|
| Script Hash | `a5c7e74b7e937b2b0e5686c5a364f82bf44672ad55a9c5961a245e98` |
| Script Address | `addr_test1wzju0e6t06fhk2cw26rvtgmylq4lg3nj4426n3vkrgj9axq07gt6s` |
| Plutus Version | V3 |
| Network | Preprod |

### Tested Transactions

| Operation | TX Hash |
|-----------|---------|
| Deposit (10 ADA) | `33561f4b76d7cde73133670d2403d3dcbbae38363cf530fa961460b78dd5e69c` |
| Agent Spend (2 ADA) | `2fe4363cd7de9e43ce83f515b1b6c73beb92e18ba5be982ce520293bb3f1d458` |
| User Withdraw (8 ADA) | `274d8211153ff1516c6c8cc3ffe7e36220183c85b33d21394ecbfbe0878a9f1e` |

---

## 🛠️ Development Setup

### Prerequisites

- [Aiken](https://aiken-lang.org/) v1.1.19+
- [Node.js](https://nodejs.org/) v18+
- [Blockfrost API Key](https://blockfrost.io/)

### Build

```bash
cd contracts/adaflow
aiken build
```

### Run Tests

```bash
aiken check
```

### Setup Scripts

```bash
cd scripts
npm install
cp .env.example .env
# Edit .env with your mnemonics and Blockfrost API key
```

### Run Interaction Scripts

```bash
# Deposit funds to custodial wallet
npx tsx interactions/deposit.ts

# Agent spends from wallet
npx tsx interactions/agent-spend.ts

# User withdraws funds
npx tsx interactions/withdraw.ts
```

---

## 📁 Project Structure

```
adaflow/
├── validators/
│   └── custodial_wallet.ak     # Main validator
├── lib/
│   └── adaflow/
│       └── types.ak            # Shared types
├── scripts/
│   ├── .env                    # Environment config (mnemonics, API keys)
│   ├── wallet.ts               # Wallet utilities
│   ├── blueprint.ts            # Blueprint loader
│   ├── types.ts                # TypeScript types matching Aiken
│   └── interactions/
│       ├── deposit.ts          # User deposits to wallet
│       ├── agent-spend.ts      # Agent spends from wallet  
│       └── withdraw.ts         # User withdraws from wallet
├── plutus.json                 # Compiled blueprint
└── aiken.toml                  # Aiken configuration
```

---

## 🔑 Environment Variables

Create a `.env` file in the `scripts/` directory:

```env
# Network
NETWORK=preprod

# Blockfrost API Key
BLOCKFROST_API_KEY=your_preprod_api_key

# User wallet mnemonic (24 words)
USER_MNEMONIC=word1 word2 ... word24

# Agent wallet mnemonic (24 words)
AGENT_MNEMONIC=word1 word2 ... word24
```

---

## 📊 Datum Format

The wallet datum uses MeshSDK's PlutusData format:

```typescript
// TypeScript datum format
const datum = {
  alternative: 0,  // Constructor index
  fields: [
    ownerPkh,      // Hex string (becomes bytes)
    [agentPkh],    // Array of hex strings (becomes list of bytes)
  ],
};
```

**CBOR representation:**
```
d8799f                        -- Constructor 0
  581c...                     -- owner (28-byte verification key hash)
  9f                          -- list start
    581c...                   -- agent PKH
  ff                          -- list end
ff                            -- constructor end
```

---

## ⚠️ Important Notes

### MeshSDK Script Encoding

When using MeshSDK v1.8.x, the script from Aiken's `plutus.json` needs CBOR encoding for transaction submission:

```typescript
import { applyCborEncoding } from '@meshsdk/core-csl';

// Raw script from blueprint
const rawScript = blueprint.validators[0].compiledCode;

// Encoded script for correct address and txInScript
const encodedScript = applyCborEncoding(rawScript);

// For address derivation - use encoded script
const { address } = serializePlutusScript({ code: encodedScript, version: 'V3' });

// For txInScript - use encoded script
txBuilder.txInScript(encodedScript);
```

### Datum Format

MeshSDK's `txOutInlineDatumValue` expects:
- `alternative` (not `constructor`) for constructor index
- Raw hex strings become bytes
- Arrays become Plutus lists

```typescript
// ✅ Correct format
{ alternative: 0, fields: ['deadbeef', ['cafebabe']] }

// ❌ Wrong formats
{ constructor: 0, fields: [...] }  // 'constructor' not supported
mConStr(0, [...])  // Doesn't serialize correctly for inline datums
```

---

## 📚 Resources

- [Aiken Documentation](https://aiken-lang.org/documentation)
- [MeshSDK Documentation](https://meshjs.dev/)
- [Cardano Plutus Scripts](https://docs.cardano.org/smart-contracts/)
- [Blockfrost API](https://docs.blockfrost.io/)

---

## 📄 License

MIT License
