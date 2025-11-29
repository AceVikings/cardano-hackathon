const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");
const { Web3Sdk } = require("@meshsdk/web3-sdk");
const { BlockfrostProvider } = require("@meshsdk/provider");

// Script address is deterministic - same for all users
// Users are differentiated by their datum (owner PKH)
const SCRIPT_ADDRESS =
  "addr_test1wp5ax0848y30atpkyv7avwtk45xzsx4r0v8n0kft4ffr8cg3rus49";

/**
 * GET /api/wallet
 * Get or create user's developer-controlled wallet
 */
router.get("/", authenticate, async (req, res) => {
  try {
    // req.user is already populated by authenticate middleware
    const user = req.user;
    console.error(user);
    // Initialize UTXOs SDK
    const provider = new BlockfrostProvider(
      process.env.BLOCKFROST_API_KEY_PREPROD
    );
    const sdk = new Web3Sdk({
      projectId: process.env.UTXOS_PROJECT_ID,
      apiKey: process.env.UTXOS_API_KEY,
      privateKey: process.env.UTXOS_PRIVATE_KEY,
      network: "preprod",
      fetcher: provider,
      submitter: provider,
    });

    if (user.developerWallet?.initialized) {
      // Return stored wallet info
      return res.json({
        success: true,
        wallet: {
          walletId: user.developerWallet.walletId,
          paymentAddress: user.developerWallet.paymentAddress,
          stakeAddress: user.developerWallet.stakeAddress,
          createdAt: user.developerWallet.createdAt,
        },
      });
    }

    // Create new developer wallet
    const walletInfo = await sdk.wallet.createWallet({
      tags: [user.firebaseUid],
    });

    // Get the wallet details
    const { info, wallet } = await sdk.wallet.getWallet(walletInfo.id, 0); // 0 for preprod
    // Save to user
    user.developerWallet = {
      initialized: true,
      walletId: walletInfo.id,
      networkId: 0,
      paymentAddress: wallet.addresses.baseAddressBech32,
      stakeAddress: wallet.addresses.rewardAddressBech32,
      createdAt: new Date(),
    };

    await user.save();

    res.json({
      success: true,
      message: "Developer wallet created",
      wallet: {
        walletId: walletInfo.id,
        paymentAddress: wallet.addresses.baseAddressBech32,
        stakeAddress: wallet.addresses.rewardAddressBech32,
        createdAt: user.developerWallet.createdAt,
      },
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get or create wallet",
    });
  }
});

/**
 * GET /api/wallet/balance
 * Get the ADA balance of the user's developer wallet
 */
router.get("/balance", authenticate, async (req, res) => {
  try {
    const user = req.user;

    if (!user.developerWallet?.initialized) {
      return res.status(404).json({
        success: false,
        error: "Wallet not initialized",
      });
    }

    // Initialize Blockfrost provider
    const provider = new BlockfrostProvider(
      process.env.BLOCKFROST_API_KEY_PREPROD
    );

    // Fetch UTXOs for the wallet address
    const utxos = await provider.fetchAddressUTxOs(
      user.developerWallet.paymentAddress
    );

    // Calculate total lovelace from all UTXOs
    let totalLovelace = BigInt(0);
    const tokens = [];

    for (const utxo of utxos) {
      // Add lovelace
      const lovelaceAmount = utxo.output.amount.find(
        (a) => a.unit === "lovelace"
      );
      if (lovelaceAmount) {
        totalLovelace += BigInt(lovelaceAmount.quantity);
      }

      // Collect tokens (non-ADA assets)
      for (const asset of utxo.output.amount) {
        if (asset.unit !== "lovelace") {
          const existingToken = tokens.find((t) => t.unit === asset.unit);
          if (existingToken) {
            existingToken.quantity = (
              BigInt(existingToken.quantity) + BigInt(asset.quantity)
            ).toString();
          } else {
            tokens.push({
              unit: asset.unit,
              quantity: asset.quantity,
            });
          }
        }
      }
    }

    // Convert lovelace to ADA (1 ADA = 1,000,000 lovelace)
    const adaBalance = Number(totalLovelace) / 1_000_000;

    res.json({
      success: true,
      balance: {
        lovelace: totalLovelace.toString(),
        ada: adaBalance,
        tokens,
        utxoCount: utxos.length,
      },
    });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch balance",
    });
  }
});

/**
 * GET /api/wallet/status
 * Get user's custodial wallet status
 */
router.get("/status", authenticate, async (req, res) => {
  try {
    // req.user is already populated by authenticate middleware
    const user = req.user;

    res.json({
      success: true,
      wallet: {
        initialized: user.custodialWallet?.initialized || false,
        scriptAddress: SCRIPT_ADDRESS,
        ownerPkh: user.custodialWallet?.ownerPkh || null,
        approvedAgents: user.custodialWallet?.approvedAgents || [],
        lastKnownBalance: user.custodialWallet?.lastKnownBalance || {
          lovelace: "0",
          tokens: [],
        },
        lastBalanceCheck: user.custodialWallet?.lastBalanceCheck || null,
      },
    });
  } catch (error) {
    console.error("Get wallet status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get wallet status",
    });
  }
});

/**
 * POST /api/wallet/initialize
 * Initialize user's custodial wallet (store their PKH)
 */
router.post("/initialize", authenticate, async (req, res) => {
  try {
    const { ownerPkh } = req.body;

    if (!ownerPkh || !/^[a-f0-9]{56}$/.test(ownerPkh)) {
      return res.status(400).json({
        success: false,
        error: "Valid owner public key hash is required (56 hex characters)",
      });
    }

    // req.user is already populated by authenticate middleware
    const user = req.user;

    // Initialize custodial wallet
    user.custodialWallet = {
      initialized: true,
      scriptAddress: SCRIPT_ADDRESS,
      ownerPkh: ownerPkh,
      approvedAgents: [],
      lastKnownBalance: { lovelace: "0", tokens: [] },
      lastBalanceCheck: new Date(),
    };

    await user.save();

    res.json({
      success: true,
      message: "Custodial wallet initialized",
      wallet: {
        initialized: true,
        scriptAddress: SCRIPT_ADDRESS,
        ownerPkh: ownerPkh,
        approvedAgents: [],
      },
    });
  } catch (error) {
    console.error("Initialize wallet error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initialize wallet",
    });
  }
});

/**
 * POST /api/wallet/add-agent
 * Add an approved agent to user's wallet
 */
router.post("/add-agent", authenticate, async (req, res) => {
  try {
    const { agentPkh, agentName } = req.body;

    if (!agentPkh || !/^[a-f0-9]{56}$/.test(agentPkh)) {
      return res.status(400).json({
        success: false,
        error: "Valid agent public key hash is required (56 hex characters)",
      });
    }

    // req.user is already populated by authenticate middleware
    const user = req.user;

    if (!user.custodialWallet?.initialized) {
      return res.status(400).json({
        success: false,
        error: "Custodial wallet not initialized",
      });
    }

    // Check if agent already exists
    const existingAgent = user.custodialWallet.approvedAgents.find(
      (a) => a.pkh === agentPkh
    );
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        error: "Agent already approved",
      });
    }

    // Add agent
    user.custodialWallet.approvedAgents.push({
      pkh: agentPkh,
      name: agentName || "Unnamed Agent",
      addedAt: new Date(),
    });

    await user.save();

    res.json({
      success: true,
      message: "Agent added successfully",
      approvedAgents: user.custodialWallet.approvedAgents,
    });
  } catch (error) {
    console.error("Add agent error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add agent",
    });
  }
});

/**
 * DELETE /api/wallet/remove-agent/:pkh
 * Remove an approved agent from user's wallet
 */
router.delete("/remove-agent/:pkh", authenticate, async (req, res) => {
  try {
    const { pkh } = req.params;

    // req.user is already populated by authenticate middleware
    const user = req.user;

    if (!user.custodialWallet?.initialized) {
      return res.status(400).json({
        success: false,
        error: "Custodial wallet not initialized",
      });
    }

    // Remove agent
    const initialLength = user.custodialWallet.approvedAgents.length;
    user.custodialWallet.approvedAgents =
      user.custodialWallet.approvedAgents.filter((a) => a.pkh !== pkh);

    if (user.custodialWallet.approvedAgents.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: "Agent not found",
      });
    }

    await user.save();

    res.json({
      success: true,
      message: "Agent removed successfully",
      approvedAgents: user.custodialWallet.approvedAgents,
    });
  } catch (error) {
    console.error("Remove agent error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove agent",
    });
  }
});

/**
 * POST /api/wallet/update-balance
 * Update the cached balance (called after deposit/withdraw)
 */
router.post("/update-balance", authenticate, async (req, res) => {
  try {
    const { lovelace, tokens } = req.body;

    // req.user is already populated by authenticate middleware
    const user = req.user;

    if (!user.custodialWallet?.initialized) {
      return res.status(400).json({
        success: false,
        error: "Custodial wallet not initialized",
      });
    }

    user.custodialWallet.lastKnownBalance = {
      lovelace: lovelace || "0",
      tokens: tokens || [],
    };
    user.custodialWallet.lastBalanceCheck = new Date();

    await user.save();

    res.json({
      success: true,
      message: "Balance updated",
      lastKnownBalance: user.custodialWallet.lastKnownBalance,
    });
  } catch (error) {
    console.error("Update balance error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update balance",
    });
  }
});

/**
 * POST /api/wallet/sign-transaction
 * Body: { unsignedTxHex }
 * Signs an unsigned transaction using the user's developer-controlled wallet
 * The implementation tries multiple signing entrypoints depending on the
 * installed SDK (Web3Sdk wallet API or returned wallet object with signTx).
 */
router.post("/sign-transaction", authenticate, async (req, res) => {
  try {
    const { unsignedTxHex, submit } = req.body || {};
    if (!unsignedTxHex || typeof unsignedTxHex !== "string") {
      return res.status(400).json({
        success: false,
        error: "Missing required field: unsignedTxHex (CBOR hex string)",
      });
    }

    const user = req.user;
    if (!user.developerWallet?.initialized) {
      return res.status(400).json({
        success: false,
        error: "Developer wallet not initialized for this user",
      });
    }

    // Initialize provider + SDK (same pattern as wallet creation)
    const provider = new BlockfrostProvider(
      process.env.BLOCKFROST_API_KEY_PREPROD
    );
    const sdk = new Web3Sdk({
      projectId: process.env.UTXOS_PROJECT_ID,
      apiKey: process.env.UTXOS_API_KEY,
      privateKey: process.env.UTXOS_PRIVATE_KEY,
      network: "preprod",
      fetcher: provider,
      submitter: provider,
    });

    const walletId = user.developerWallet.walletId;
    let signedTxHex = null;

    // Try Web3Sdk provided signing helper (wallet-scoped)
    try {
      if (sdk.wallet && typeof sdk.wallet.signTx === "function") {
        // Common API: sdk.wallet.signTx(walletId, unsignedTxHex)
        signedTxHex = await sdk.wallet.signTx(walletId, unsignedTxHex);
      } else if (
        sdk.wallet &&
        typeof sdk.wallet.signTransaction === "function"
      ) {
        signedTxHex = await sdk.wallet.signTransaction(walletId, unsignedTxHex);
      }
    } catch (err) {
      console.warn(
        "sdk.wallet.signTx/signTransaction failed:",
        err && err.message
      );
    }

    // If SDK-level signing did not work, try getting wallet object and use its signTx
    if (!signedTxHex) {
      try {
        const { info, wallet } = await sdk.wallet.getWallet(
          walletId,
          user.developerWallet.networkId || 0
        );

        if (wallet && typeof wallet.signTx === "function") {
          // Mesh-style wallet object: wallet.signTx(unsignedTxHex, partialSign?)
          signedTxHex = await wallet.signTx(unsignedTxHex, false);
        }
      } catch (err) {
        console.warn(
          "Fetching wallet object or wallet.signTx failed:",
          err && err.message
        );
      }
    }

    if (!signedTxHex) {
      return res.status(500).json({
        success: false,
        error:
          "Unable to sign transaction: no signing API available for the configured wallet provider.",
        suggestion:
          "Ensure the backend has a wallet capable of signing (UTXOS Web3Sdk with signing enabled) or use Mesh Wallets that expose signTx. Review SDK versions and credentials.",
      });
    }

    // If requested, submit the signed transaction and return txHash
    if (submit) {
      try {
        let txHash = null;

        if (sdk.wallet && typeof sdk.wallet.submitTx === "function") {
          txHash = await sdk.wallet.submitTx(walletId, signedTxHex);
        }

        if (!txHash) {
          try {
            const { info, wallet } = await sdk.wallet.getWallet(
              walletId,
              user.developerWallet.networkId || 0
            );
            if (wallet && typeof wallet.submitTx === "function") {
              txHash = await wallet.submitTx(signedTxHex);
            }
          } catch (err) {
            console.warn(
              "wallet.submitTx fallback failed:",
              err && err.message
            );
          }
        }

        if (!txHash) {
          return res.status(500).json({
            success: false,
            error:
              "Signing succeeded but submission failed: no submission API available.",
          });
        }

        return res.json({ success: true, signedTxHex, txHash });
      } catch (err) {
        console.error("Transaction submission failed:", err);
        return res.status(500).json({
          success: false,
          error: "Transaction submission failed",
          details: err && err.message,
        });
      }
    }

    return res.json({ success: true, signedTxHex });
  } catch (error) {
    console.error("Sign transaction error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to sign transaction" });
  }
});

module.exports = router;
