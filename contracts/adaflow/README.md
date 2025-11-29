# AdaFlow Smart Contracts

## Agent-Governed Custodial Wallet System for Cardano

AdaFlow implements a **Masumi AI agent-compatible** custodial wallet system on Cardano. Users deposit tokens into script-controlled UTXOs, and approved AI agents can execute DeFi operations within user-defined limits.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                            │
│  ┌─────────────────┐                                            │
│  │  Connect Wallet │────┐                                       │
│  └─────────────────┘    │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AdaFlow Backend                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Auth Service │  │ Agent Manager│  │ Transaction Builder  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Cardano Blockchain (Preprod)                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 Custodial Wallet Validator                  │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │  WalletDatum                                         │   │ │
│  │  │  ├── owner: VerificationKeyHash                      │   │ │
│  │  │  ├── approved_agents: List<VerificationKeyHash>      │   │ │
│  │  │  ├── max_ada_per_tx: Int (lovelace)                  │   │ │
│  │  │  ├── max_total_ada: Int (lovelace)                   │   │ │
│  │  │  ├── total_spent: Int (lovelace)                     │   │ │
│  │  │  ├── strategy: StrategyConfig                        │   │ │
│  │  │  └── nonce: Int                                      │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📜 Validators

### 1. Custodial Wallet (`validators/custodial_wallet.ak`)

The main validator controlling user funds with agent-based spending.

#### Types

```aiken
/// Strategy types for automated DeFi operations
type StrategyType {
  Manual                        // No automation, agents propose individual txs
  YieldFarming                  // Agent can move funds to yield protocols
  LiquidityProvision            // Agent can provide LP on DEXes
  Arbitrage                     // Agent can execute arbitrage
  Custom { strategy_id: Int }   // User-defined strategy
}

/// Strategy configuration
type StrategyConfig {
  strategy_type: StrategyType,
  min_reserve: Int,           // Minimum ADA to keep (lovelace)
  auto_compound: Bool,        // Auto-compound rewards
  max_slippage_bps: Int,      // Max slippage in basis points
}

/// Wallet datum stored with each UTXO
type WalletDatum {
  owner: VerificationKeyHash,
  approved_agents: List<VerificationKeyHash>,
  max_ada_per_tx: Int,
  max_total_ada: Int,
  total_spent: Int,
  strategy: StrategyConfig,
  nonce: Int,
}
```

#### Redeemers

| Redeemer | Required Signer | Description |
|----------|-----------------|-------------|
| `Deposit` | Owner | Add funds to custodial wallet |
| `AgentSpend { details }` | Approved Agent | Spend within limits |
| `UserWithdraw` | Owner | Full withdrawal rights |
| `UpdateConfig { ... }` | Owner | Update limits and strategy |
| `AddAgent { agent }` | Owner | Authorize new agent |
| `RemoveAgent { agent }` | Owner | Revoke agent access |
| `ResetSpentCounter` | Owner | Reset spending counter |

#### Validation Rules

**AgentSpend:**
1. ✅ Signing agent must be in `approved_agents` list
2. ✅ `amount > 0` and `amount <= max_ada_per_tx`
3. ✅ `total_spent + amount <= max_total_ada`
4. ✅ Continuation output has updated `total_spent`
5. ✅ Remaining balance >= `min_reserve`

**UserWithdraw:**
1. ✅ Owner signature only - no spending limits apply
2. ✅ User has full control to withdraw anytime

---

### 2. Authorization NFT (`validators/authorization_nft.ak`)

Optional NFT-based authorization for advanced use cases.

```aiken
type AuthorizationDatum {
  user: VerificationKeyHash,
  agent: VerificationKeyHash,
  scope: AuthScope,
  expires_at: Int,
  is_active: Bool,
}

type AuthScope {
  Swap { max_amount: Int }
  Liquidity { max_amount: Int }
  Stake { max_amount: Int }
  FullAccess
}
```

---

## 🚀 Quick Start

### Prerequisites

- [Aiken](https://aiken-lang.org/) v1.1.19+
- [Node.js](https://nodejs.org/) v18+
- Cardano wallet with Preprod tADA

### Build Contracts

```bash
cd contracts/adaflow
aiken build
```

This generates `plutus.json` with the compiled validators.

### Run Tests

```bash
aiken check
```

### Deploy to Preprod

1. **Configure environment:**
   ```bash
   cd scripts
   cp .env.example .env
   # Edit .env with your mnemonics and Blockfrost API key
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **View deployment info:**
   ```bash
   npm run deploy
   ```

4. **Run full test:**
   ```bash
   npm run test
   ```

---

## 📁 Directory Structure

```
contracts/adaflow/
├── aiken.toml              # Aiken project config
├── plutus.json             # Compiled contracts (generated)
├── README.md               # This file
│
├── validators/
│   ├── custodial_wallet.ak # Main custodial wallet validator
│   └── authorization_nft.ak # Optional NFT authorization
│
└── scripts/
    ├── .env                # Environment variables (secrets)
    ├── package.json        # Node.js dependencies
    ├── blueprint.ts        # Contract blueprint parser
    ├── wallet.ts           # Wallet utilities
    ├── types.ts            # TypeScript type definitions
    ├── deploy.ts           # Deployment info script
    ├── test-full-flow.ts   # Full integration test
    │
    └── interactions/
        ├── deposit.ts      # Deposit ADA to custodial wallet
        ├── agent-spend.ts  # Agent spends from wallet
        └── withdraw.ts     # User withdraws funds
```

---

## 🔐 Security Model

### User Protections
- **Owner always has full withdrawal rights** - no agent can lock funds
- **Spending limits enforced on-chain** - agents cannot exceed configured limits
- **Nonce prevents replay attacks** - config updates require nonce increment
- **Minimum reserve protection** - agents must leave minimum balance

### Agent Constraints
- **Must be explicitly approved** - added via `AddAgent` redeemer
- **Per-transaction limits** - `max_ada_per_tx` enforced
- **Lifetime limits** - `max_total_ada` tracked in `total_spent`
- **Strategy-based restrictions** - additional rules per strategy type

---

## 💡 Usage Examples

### Deposit Funds

```typescript
import { walletDatumToData, createInitialDatum } from './types.js';

// Create datum authorizing an agent
const datum = createInitialDatum(
  userPkh,      // Owner's payment key hash
  agentPkh,     // Agent's payment key hash
  10,           // Max 10 ADA per transaction
  100           // Max 100 ADA total spending
);

// Send to script address with datum
txBuilder
  .txOut(scriptAddress, [{ unit: 'lovelace', quantity: depositAmount }])
  .txOutInlineDatumValue(walletDatumToData(datum))
```

### Agent Spend

```typescript
import { walletRedeemerToData, WalletRedeemerType, stringToHex } from './types.js';

const redeemer = walletRedeemerToData({
  type: WalletRedeemerType.AgentSpend,
  details: {
    amount: 2_000_000n,  // 2 ADA
    purpose: stringToHex('DEX swap'),
  },
});

txBuilder
  .spendingPlutusScriptV3()
  .txIn(utxo.txHash, utxo.outputIndex)
  .txInInlineDatumPresent()
  .txInRedeemerValue(redeemer)
  .txInScript(scriptCode)
  // ... continuation output with updated datum
  .requiredSignerHash(agentPkh)
```

### User Withdraw

```typescript
const redeemer = walletRedeemerToData({
  type: WalletRedeemerType.UserWithdraw,
});

// Owner can withdraw everything - no continuation output needed
txBuilder
  .spendingPlutusScriptV3()
  .txIn(utxo.txHash, utxo.outputIndex)
  .txInInlineDatumPresent()
  .txInRedeemerValue(redeemer)
  .txInScript(scriptCode)
  .txOut(userAddress, [{ unit: 'lovelace', quantity: fullBalance }])
  .requiredSignerHash(userPkh)
```

---

## 🧪 Test Scenarios

### Happy Path
1. ✅ User deposits 10 ADA with agent authorization
2. ✅ Agent spends 2 ADA (within limits)
3. ✅ User withdraws remaining 8 ADA

### Limit Enforcement
1. ✅ Agent cannot spend more than `max_ada_per_tx`
2. ✅ Agent cannot exceed `max_total_ada` lifetime limit
3. ✅ Agent must leave `min_reserve` in wallet

### Authorization
1. ✅ Unauthorized agent cannot spend
2. ✅ Owner can add/remove agents
3. ✅ Owner can update limits anytime

---

## 🔗 Links

- **CardanoScan (Preprod)**: https://preprod.cardanoscan.io
- **Aiken Documentation**: https://aiken-lang.org
- **MeshSDK**: https://meshjs.dev

---

## 📄 License

Apache-2.0
