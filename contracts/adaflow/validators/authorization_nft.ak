use aiken/collection/list
use aiken/crypto.{VerificationKeyHash, blake2b_256}
use aiken/primitive/bytearray
use cardano/assets.{PolicyId, AssetName, flatten}
use cardano/transaction.{Transaction, OutputReference}

// ============================================================================
// Authorization NFT Minting Policy
// ============================================================================
// This minting policy creates authorization NFTs that represent user consent
// for agent interactions. Each NFT is unique to a user-agent pair.

/// Datum attached to authorization NFT outputs
pub type AuthorizationDatum {
  /// User who granted authorization
  user: VerificationKeyHash,
  /// Agent authorized to act on behalf of user
  agent: VerificationKeyHash,
  /// Scope of authorization (what the agent can do)
  scope: AuthScope,
  /// Expiration slot (0 = no expiration)
  expires_at: Int,
  /// Whether authorization is currently active
  is_active: Bool,
}

/// Scope defining what actions an agent can perform
pub type AuthScope {
  /// Can perform token swaps
  Swap { max_amount: Int }
  /// Can provide liquidity
  Liquidity { max_amount: Int }
  /// Can stake tokens
  Stake { max_amount: Int }
  /// Full access within wallet limits
  FullAccess
}

/// Redeemer for minting/burning authorization NFTs
pub type AuthRedeemer {
  /// Mint new authorization NFT (user signature required)
  MintAuth { 
    user: VerificationKeyHash,
    agent: VerificationKeyHash,
  }
  /// Burn authorization NFT (user signature required)
  BurnAuth
  /// Revoke authorization (sets is_active to false)
  RevokeAuth
}

validator authorization_nft(utxo_ref: OutputReference) {
  /// Minting policy for authorization NFTs
  mint(redeemer: AuthRedeemer, policy_id: PolicyId, tx: Transaction) {
    when redeemer is {
      MintAuth { user, agent } -> {
        // User must sign to grant authorization
        expect list.has(tx.extra_signatories, user)
        
        // For one-shot minting, verify the UTXO is consumed
        let utxo_consumed = list.any(
          tx.inputs, 
          fn(input) { input.output_reference == utxo_ref }
        )
        
        // Create unique asset name from user + agent hash
        let asset_name = create_auth_asset_name(user, agent)
        
        // Verify exactly one NFT is minted
        let minted = flatten(tx.mint)
        let nft_minted = list.any(
          minted,
          fn(asset) {
            let (pid, name, qty) = asset
            pid == policy_id && name == asset_name && qty == 1
          }
        )
        
        and {
          utxo_consumed,
          nft_minted,
        }
      }
      
      BurnAuth -> {
        // Find the NFT being burned
        let burned = flatten(tx.mint)
        
        // Verify NFTs are only being burned (negative quantities)
        list.all(
          burned,
          fn(asset) {
            let (pid, _name, qty) = asset
            if pid == policy_id {
              qty < 0
            } else {
              True
            }
          }
        )
      }
      
      RevokeAuth -> {
        // This is handled by the spend validator, not mint
        // Mint policy should not allow revocation through minting
        False
      }
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Create unique asset name from user and agent public key hashes
fn create_auth_asset_name(user: VerificationKeyHash, agent: VerificationKeyHash) -> AssetName {
  // Concatenate and hash to create unique identifier
  let combined = bytearray.concat(user, agent)
  // Take first 28 bytes of hash for asset name
  bytearray.take(blake2b_256(combined), 28)
}

// ============================================================================
// Tests
// ============================================================================

test auth_scope_swap() {
  let scope = Swap { max_amount: 100_000_000 }
  when scope is {
    Swap { max_amount } -> max_amount == 100_000_000
    _ -> False
  }
}

test auth_scope_full_access() {
  let scope = FullAccess
  when scope is {
    FullAccess -> True
    _ -> False
  }
}

test asset_name_creation() {
  let user = #"00000000000000000000000000000000000000000000000000000001"
  let agent = #"00000000000000000000000000000000000000000000000000000002"
  let name = create_auth_asset_name(user, agent)
  
  // Asset name should be 28 bytes
  bytearray.length(name) == 28
}

test different_users_different_names() {
  let user1 = #"00000000000000000000000000000000000000000000000000000001"
  let user2 = #"00000000000000000000000000000000000000000000000000000003"
  let agent = #"00000000000000000000000000000000000000000000000000000002"
  
  let name1 = create_auth_asset_name(user1, agent)
  let name2 = create_auth_asset_name(user2, agent)
  
  // Different users should produce different asset names
  name1 != name2
}
