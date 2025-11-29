use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Address}
use cardano/assets.{lovelace_of}
use cardano/transaction.{
  InlineDatum, Output, OutputReference, Transaction, find_input,
}

// ============================================================================
// ADAFLOW AGENT-GOVERNED CUSTODIAL WALLET
// ============================================================================
// 
// This validator implements a custodial wallet system where:
// 1. Users deposit tokens into a script-controlled UTXO
// 2. Masumi AI agents are authorized to propose transactions
// 3. The validator enforces spending limits and strategy rules
// 4. Users maintain full control and can withdraw/update config anytime
//
// Key Features:
// - Multiple approved agents support
// - Per-transaction and total spending limits
// - Strategy configuration for automated DeFi operations
// - User always has full withdrawal rights
// - Configurable spending rules per user
// ============================================================================

// ============================================================================
// Types
// ============================================================================

/// Strategy types that agents can execute
pub type StrategyType {
  /// No automated strategy - agents propose individual transactions
  Manual
  /// Yield farming - agent can move funds to yield protocols
  YieldFarming
  /// Liquidity provision - agent can provide liquidity to DEXes
  LiquidityProvision
  /// Arbitrage - agent can execute arbitrage opportunities
  Arbitrage
  /// Custom strategy defined by user
  Custom { strategy_id: Int }
}

/// Configuration for automated strategies
pub type StrategyConfig {
  /// The type of strategy enabled
  strategy_type: StrategyType,
  /// Minimum ADA to keep in wallet (in lovelace)
  min_reserve: Int,
  /// Whether to auto-compound rewards
  auto_compound: Bool,
  /// Maximum slippage allowed (in basis points, e.g., 100 = 1%)
  max_slippage_bps: Int,
}

/// Datum stored with each custodial wallet UTXO
pub type WalletDatum {
  /// The user who owns these funds (can always withdraw)
  owner: VerificationKeyHash,
  /// List of agent public key hashes authorized to propose spends
  approved_agents: List<VerificationKeyHash>,
  /// Maximum ADA that can be spent per transaction (in lovelace)
  max_ada_per_tx: Int,
  /// Maximum total ADA that can be spent by agents (lifetime limit, in lovelace)
  max_total_ada: Int,
  /// Total ADA already spent by agents (in lovelace) - tracked for limits
  total_spent: Int,
  /// Strategy configuration
  strategy: StrategyConfig,
  /// Nonce for replay protection on config updates
  nonce: Int,
}

/// Agent spend details for validation
pub type SpendDetails {
  /// Amount of ADA being spent (in lovelace)
  amount: Int,
  /// Purpose of the spend (for logging/auditing)
  purpose: ByteArray,
}

/// Redeemer actions for the custodial wallet
pub type WalletRedeemer {
  /// User deposits funds (owner signature required)
  Deposit
  /// Agent spends funds within limits (agent signature required)
  AgentSpend { details: SpendDetails }
  /// User withdraws their funds (owner signature required)  
  UserWithdraw
  /// User updates wallet configuration (owner signature required)
  UpdateConfig {
    new_max_per_tx: Int,
    new_max_total: Int,
    new_strategy: StrategyConfig,
  }
  /// User adds an approved agent (owner signature required)
  AddAgent { agent: VerificationKeyHash }
  /// User removes an approved agent (owner signature required)
  RemoveAgent { agent: VerificationKeyHash }
  /// User resets spending counter (owner signature required)
  ResetSpentCounter
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Find the continuing output at the same script address
fn find_continuing_output(outputs: List<Output>, own_address: Address) -> Option<Output> {
  list.find(outputs, fn(output) { output.address == own_address })
}

/// Check if a pubkey hash is in the list of approved agents
fn is_approved_agent(
  agents: List<VerificationKeyHash>,
  agent: VerificationKeyHash,
) -> Bool {
  list.has(agents, agent)
}

/// Check if any approved agent has signed the transaction
fn agent_has_signed(
  signatories: List<VerificationKeyHash>,
  approved_agents: List<VerificationKeyHash>,
) -> Option<VerificationKeyHash> {
  list.find(approved_agents, fn(agent) { list.has(signatories, agent) })
}

// ============================================================================
// Validator
// ============================================================================

validator custodial_wallet {
  /// Spending validator for custodial wallet UTXOs
  /// 
  /// Validates all spending operations according to the datum configuration:
  /// - Deposits require owner signature
  /// - Agent spends require approved agent signature + limit checks
  /// - Withdrawals require owner signature
  /// - Config updates require owner signature
  spend(
    datum: Option<WalletDatum>,
    redeemer: WalletRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    // Datum must be present
    expect Some(wallet_datum) = datum
    
    // Find the input being spent
    expect Some(own_input) = find_input(tx.inputs, own_ref)
    let own_address = own_input.output.address
    let own_value = own_input.output.value
    
    when redeemer is {
      // ======================================================================
      // DEPOSIT - User adds more funds to their custodial wallet
      // ======================================================================
      Deposit -> {
        // Owner must sign
        expect list.has(tx.extra_signatories, wallet_datum.owner)
        
        // Must have continuing output with same datum
        expect Some(continuing_output) = find_continuing_output(tx.outputs, own_address)
        expect InlineDatum(out_datum_data) = continuing_output.datum
        expect out_datum: WalletDatum = out_datum_data
        
        // Datum must remain unchanged
        and {
          out_datum.owner == wallet_datum.owner,
          out_datum.approved_agents == wallet_datum.approved_agents,
          out_datum.max_ada_per_tx == wallet_datum.max_ada_per_tx,
          out_datum.max_total_ada == wallet_datum.max_total_ada,
          out_datum.total_spent == wallet_datum.total_spent,
          out_datum.strategy == wallet_datum.strategy,
          out_datum.nonce == wallet_datum.nonce,
          // Output must have more or equal value
          lovelace_of(continuing_output.value) >= lovelace_of(own_value),
        }
      }
      
      // ======================================================================
      // AGENT SPEND - Authorized agent spends funds within limits
      // ======================================================================
      AgentSpend { details } -> {
        // One of the approved agents must sign
        expect Some(_signing_agent) = agent_has_signed(
          tx.extra_signatories, 
          wallet_datum.approved_agents
        )
        
        let amount = details.amount
        
        // Amount must be positive and within per-transaction limit
        expect amount > 0
        expect amount <= wallet_datum.max_ada_per_tx
        
        // New total spent must be within lifetime limit
        let new_total_spent = wallet_datum.total_spent + amount
        expect new_total_spent <= wallet_datum.max_total_ada
        
        // Must have continuing output with updated datum
        expect Some(continuing_output) = find_continuing_output(tx.outputs, own_address)
        expect InlineDatum(out_datum_data) = continuing_output.datum
        expect out_datum: WalletDatum = out_datum_data
        
        // Calculate expected remaining value
        let input_lovelace = lovelace_of(own_value)
        let expected_remaining = input_lovelace - amount
        let output_lovelace = lovelace_of(continuing_output.value)
        
        // Check minimum reserve if strategy is set
        let min_reserve = wallet_datum.strategy.min_reserve
        expect output_lovelace >= min_reserve
        
        and {
          // Datum fields must match (except total_spent which increases)
          out_datum.owner == wallet_datum.owner,
          out_datum.approved_agents == wallet_datum.approved_agents,
          out_datum.max_ada_per_tx == wallet_datum.max_ada_per_tx,
          out_datum.max_total_ada == wallet_datum.max_total_ada,
          out_datum.total_spent == new_total_spent,
          out_datum.strategy == wallet_datum.strategy,
          out_datum.nonce == wallet_datum.nonce,
          // Output must have correct remaining value
          output_lovelace >= expected_remaining,
        }
      }
      
      // ======================================================================
      // USER WITHDRAW - Owner withdraws funds (partial or full)
      // ======================================================================
      UserWithdraw -> {
        // Owner must sign - no other constraints
        // User has full control to withdraw anytime
        list.has(tx.extra_signatories, wallet_datum.owner)
      }
      
      // ======================================================================
      // UPDATE CONFIG - Owner updates spending limits and strategy
      // ======================================================================
      UpdateConfig { new_max_per_tx, new_max_total, new_strategy } -> {
        // Owner must sign
        expect list.has(tx.extra_signatories, wallet_datum.owner)
        
        // Limits must be positive
        expect new_max_per_tx > 0
        expect new_max_total > 0
        expect new_max_per_tx <= new_max_total
        
        // Strategy min_reserve must be non-negative
        expect new_strategy.min_reserve >= 0
        
        // Max slippage must be reasonable (max 50% = 5000 bps)
        expect new_strategy.max_slippage_bps >= 0
        expect new_strategy.max_slippage_bps <= 5000
        
        // Must have continuing output with updated datum
        expect Some(continuing_output) = find_continuing_output(tx.outputs, own_address)
        expect InlineDatum(out_datum_data) = continuing_output.datum
        expect out_datum: WalletDatum = out_datum_data
        
        and {
          // Owner and agents stay the same
          out_datum.owner == wallet_datum.owner,
          out_datum.approved_agents == wallet_datum.approved_agents,
          // Limits are updated
          out_datum.max_ada_per_tx == new_max_per_tx,
          out_datum.max_total_ada == new_max_total,
          // Spent counter stays the same (can be reset separately)
          out_datum.total_spent == wallet_datum.total_spent,
          // Strategy is updated
          out_datum.strategy == new_strategy,
          // Nonce must increment (replay protection)
          out_datum.nonce == wallet_datum.nonce + 1,
          // Value must be preserved
          lovelace_of(continuing_output.value) >= lovelace_of(own_value),
        }
      }
      
      // ======================================================================
      // ADD AGENT - Owner authorizes a new agent
      // ======================================================================
      AddAgent { agent } -> {
        // Owner must sign
        expect list.has(tx.extra_signatories, wallet_datum.owner)
        
        // Agent must not already be in the list
        expect !is_approved_agent(wallet_datum.approved_agents, agent)
        
        // Must have continuing output with updated datum
        expect Some(continuing_output) = find_continuing_output(tx.outputs, own_address)
        expect InlineDatum(out_datum_data) = continuing_output.datum
        expect out_datum: WalletDatum = out_datum_data
        
        // Build expected new agent list
        let new_agents = list.concat(wallet_datum.approved_agents, [agent])
        
        and {
          out_datum.owner == wallet_datum.owner,
          out_datum.approved_agents == new_agents,
          out_datum.max_ada_per_tx == wallet_datum.max_ada_per_tx,
          out_datum.max_total_ada == wallet_datum.max_total_ada,
          out_datum.total_spent == wallet_datum.total_spent,
          out_datum.strategy == wallet_datum.strategy,
          out_datum.nonce == wallet_datum.nonce + 1,
          lovelace_of(continuing_output.value) >= lovelace_of(own_value),
        }
      }
      
      // ======================================================================
      // REMOVE AGENT - Owner removes an agent's authorization
      // ======================================================================
      RemoveAgent { agent } -> {
        // Owner must sign
        expect list.has(tx.extra_signatories, wallet_datum.owner)
        
        // Agent must be in the list
        expect is_approved_agent(wallet_datum.approved_agents, agent)
        
        // Must have continuing output with updated datum
        expect Some(continuing_output) = find_continuing_output(tx.outputs, own_address)
        expect InlineDatum(out_datum_data) = continuing_output.datum
        expect out_datum: WalletDatum = out_datum_data
        
        // Build expected new agent list (without the removed agent)
        let new_agents = list.filter(wallet_datum.approved_agents, fn(a) { a != agent })
        
        and {
          out_datum.owner == wallet_datum.owner,
          out_datum.approved_agents == new_agents,
          out_datum.max_ada_per_tx == wallet_datum.max_ada_per_tx,
          out_datum.max_total_ada == wallet_datum.max_total_ada,
          out_datum.total_spent == wallet_datum.total_spent,
          out_datum.strategy == wallet_datum.strategy,
          out_datum.nonce == wallet_datum.nonce + 1,
          lovelace_of(continuing_output.value) >= lovelace_of(own_value),
        }
      }
      
      // ======================================================================
      // RESET SPENT COUNTER - Owner resets the total spent tracking
      // ======================================================================
      ResetSpentCounter -> {
        // Owner must sign
        expect list.has(tx.extra_signatories, wallet_datum.owner)
        
        // Must have continuing output with updated datum
        expect Some(continuing_output) = find_continuing_output(tx.outputs, own_address)
        expect InlineDatum(out_datum_data) = continuing_output.datum
        expect out_datum: WalletDatum = out_datum_data
        
        and {
          out_datum.owner == wallet_datum.owner,
          out_datum.approved_agents == wallet_datum.approved_agents,
          out_datum.max_ada_per_tx == wallet_datum.max_ada_per_tx,
          out_datum.max_total_ada == wallet_datum.max_total_ada,
          // Reset the counter to 0
          out_datum.total_spent == 0,
          out_datum.strategy == wallet_datum.strategy,
          out_datum.nonce == wallet_datum.nonce + 1,
          lovelace_of(continuing_output.value) >= lovelace_of(own_value),
        }
      }
    }
  }

  else(_) {
    fail
  }
}

// ============================================================================
// Tests
// ============================================================================

test strategy_config_creation() {
  let config = StrategyConfig {
    strategy_type: Manual,
    min_reserve: 2_000_000, // 2 ADA minimum
    auto_compound: False,
    max_slippage_bps: 100, // 1%
  }
  
  and {
    config.min_reserve == 2_000_000,
    config.max_slippage_bps == 100,
  }
}

test wallet_datum_with_multiple_agents() {
  let config = StrategyConfig {
    strategy_type: YieldFarming,
    min_reserve: 5_000_000,
    auto_compound: True,
    max_slippage_bps: 50,
  }
  
  let datum = WalletDatum {
    owner: #"00000000000000000000000000000000000000000000000000000001",
    approved_agents: [
      #"00000000000000000000000000000000000000000000000000000002",
      #"00000000000000000000000000000000000000000000000000000003",
    ],
    max_ada_per_tx: 10_000_000, // 10 ADA
    max_total_ada: 100_000_000, // 100 ADA
    total_spent: 0,
    strategy: config,
    nonce: 0,
  }
  
  and {
    list.length(datum.approved_agents) == 2,
    datum.strategy.auto_compound == True,
  }
}

test agent_approval_check() {
  let agents = [
    #"00000000000000000000000000000000000000000000000000000002",
    #"00000000000000000000000000000000000000000000000000000003",
  ]
  
  let agent_in_list = #"00000000000000000000000000000000000000000000000000000002"
  let agent_not_in_list = #"00000000000000000000000000000000000000000000000000000004"
  
  and {
    is_approved_agent(agents, agent_in_list),
    !is_approved_agent(agents, agent_not_in_list),
  }
}

test spending_limit_check() {
  let max_per_tx = 10_000_000
  let max_total = 100_000_000
  let current_spent = 50_000_000
  let spend_amount = 10_000_000
  
  let within_per_tx = spend_amount <= max_per_tx
  let new_total = current_spent + spend_amount
  let within_total = new_total <= max_total
  
  and {
    within_per_tx,
    within_total,
    new_total == 60_000_000,
  }
}

test spending_limit_exceeded() {
  let max_per_tx = 10_000_000
  let max_total = 100_000_000
  let current_spent = 95_000_000
  let spend_amount = 10_000_000
  
  let within_per_tx = spend_amount <= max_per_tx
  let new_total = current_spent + spend_amount
  let within_total = new_total <= max_total
  
  // Per-tx is OK, but total would exceed
  and {
    within_per_tx,
    !within_total,
  }
}
