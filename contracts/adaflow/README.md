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
| `Deposit` | Owner | Add funds to custodial wallet |
| `AgentDeposit` | Approved Agent | Agent deposits funds back to wallet |
| `AgentSpend` | Approved Agent | Spend from wallet |
| `UserWithdraw` | Owner | Full withdrawal rights (ADA + tokens) |
| `AddAgent { agent }` | Owner | Authorize new agent |
| `RemoveAgent { agent }` | Owner | Revoke agent access |

#### Validation Rules

**Deposit:**
- Owner must sign
- Inline datum specifies owner and approved agents
- Value must increase or stay same

**AgentDeposit:**
- Approved agent must sign
- Allows agent to return funds to the wallet
- Datum must remain unchanged
- Value must increase or stay same

**AgentSpend:**
- Transaction signer must be in `approved_agents` list
- Agent can spend any amount (no limits in simplified version)

**UserWithdraw:**
- Transaction signer must be `owner`
- Can withdraw entire UTXO (ADA + all tokens)

**AddAgent/RemoveAgent:**
- Transaction signer must be `owner`
- Modifies the `approved_agents` list

---

## 🚀 Deployment

### Script Information (Preprod)

| Property | Value |
|----------|-------|
| Script Hash | `69d33cf53922feac36233dd63976ad0c281aa37b0f37d92baa5233e1` |
| Script Address | `addr_test1wp5ax0848y30atpkyv7avwtk45xzsx4r0v8n0kft4ffr8cg3rus49` |
| Plutus Version | V3 |
| Network | Preprod |

### Tested Transactions

| Operation | TX Hash |
|-----------|---------|
| Deposit (10 ADA) | `ccc901a1dba89aa0804a3f2a13874148bd4ff4c89f335ffe02b8851859f74034` |
| Agent Spend (2 ADA) | `f64847ab86ea02718e5a4f8e79dca2c6f96e4f1dbc302de2f9f76cf494d4064e` |
| Agent Deposit (2 ADA) | `f40a9c34076b389c475c0d9097658df3b6c861b4b3426b87a2edaa603e936ff8` |
| User Withdraw (10 ADA) | `5d44f6014191b63f902ec2c178b238e784910b16aabab1422d5dfb28070c9190` |

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
# Deposit funds to custodial wallet (user)
npx tsx interactions/deposit.ts

# Agent spends from wallet
npx tsx interactions/agent-spend.ts

# Agent deposits funds back to wallet
npx tsx interactions/agent-deposit.ts

# User withdraws all funds (ADA + tokens)
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
│       ├── agent-deposit.ts    # Agent deposits back to wallet
│       ├── agent-spend.ts      # Agent spends from wallet  
│       └── withdraw.ts         # User withdraws all funds
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
