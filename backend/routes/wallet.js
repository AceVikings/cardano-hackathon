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
      paymentAddress: info.wallet.addresses.baseAddressBech32,
      stakeAddress: info.wallet.addresses.rewardAddressBech32,
      createdAt: new Date(),
    };

    await user.save();

    res.json({
      success: true,
      message: "Developer wallet created",
      wallet: {
        walletId: walletInfo.id,
        paymentAddress: info.wallet.addresses.baseAddressBech32,
        stakeAddress: info.wallet.addresses.rewardAddressBech32,
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

module.exports = router;
