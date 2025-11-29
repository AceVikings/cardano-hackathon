use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Address}
use cardano/assets.{lovelace_of}
use cardano/transaction.{
  InlineDatum, Output, OutputReference, Transaction, find_input,
}

// ============================================================================
// ADAFLOW AGENT-GOVERNED CUSTODIAL WALLET (SIMPLIFIED)
// ============================================================================
// 
// This validator implements a simple custodial wallet system where:
// 1. Users deposit tokens into a script-controlled UTXO
// 2. Approved agents can spend any amount from the wallet
// 3. Users maintain full control and can withdraw anytime
//
// Key Features:
// - Multiple approved agents support
// - Agents have full spending rights (no limits)
// - User always has full withdrawal rights
// - Simple add/remove agent management
// ============================================================================

// ============================================================================
// Types
// ============================================================================

/// Datum stored with each custodial wallet UTXO
pub type WalletDatum {
  /// The user who owns these funds (can always withdraw)
  owner: VerificationKeyHash,
  /// List of agent public key hashes authorized to spend
  approved_agents: List<VerificationKeyHash>,
}

/// Redeemer actions for the custodial wallet
pub type WalletRedeemer {
  /// User deposits funds (owner signature required)
  Deposit
  /// Agent spends funds (approved agent signature required)
  AgentSpend
  /// User withdraws their funds (owner signature required)  
  UserWithdraw
  /// User adds an approved agent (owner signature required)
  AddAgent { agent: VerificationKeyHash }
  /// User removes an approved agent (owner signature required)
  RemoveAgent { agent: VerificationKeyHash }
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
) -> Bool {
  list.any(approved_agents, fn(agent) { list.has(signatories, agent) })
}

// ============================================================================
// Validator
// ============================================================================

validator custodial_wallet {
  /// Spending validator for custodial wallet UTXOs
  /// 
  /// Validates all spending operations:
  /// - Deposits require owner signature
  /// - Agent spends require any approved agent signature
  /// - Withdrawals require owner signature
  /// - Agent management requires owner signature
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
          // Output must have more or equal value
          lovelace_of(continuing_output.value) >= lovelace_of(own_value),
        }
      }
      
      // ======================================================================
      // AGENT SPEND - Authorized agent spends funds (no limits)
      // ======================================================================
      AgentSpend -> {
        // One of the approved agents must sign
        agent_has_signed(tx.extra_signatories, wallet_datum.approved_agents)
        // No other constraints - agents can spend any amount
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

test wallet_datum_creation() {
  let datum = WalletDatum {
    owner: #"00000000000000000000000000000000000000000000000000000001",
    approved_agents: [
      #"00000000000000000000000000000000000000000000000000000002",
    ],
  }
  
  list.length(datum.approved_agents) == 1
}

test wallet_datum_with_multiple_agents() {
  let datum = WalletDatum {
    owner: #"00000000000000000000000000000000000000000000000000000001",
    approved_agents: [
      #"00000000000000000000000000000000000000000000000000000002",
      #"00000000000000000000000000000000000000000000000000000003",
      #"00000000000000000000000000000000000000000000000000000004",
    ],
  }
  
  list.length(datum.approved_agents) == 3
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
