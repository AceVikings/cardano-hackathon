const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const axios = require("axios");
const crypto = require("crypto");

// All agent routes require authentication
router.use(authenticate);

// Helper: start -> purchase -> poll job lifecycle for an agent service
async function runAgentJob({ startHost, purchaseUrl, inputData, user }) {
  const identifierFromPurchaser = crypto.randomBytes(13).toString("hex");

  const startJobResponse = await axios.post(
    `${startHost.replace(/\/$/, "")}/start_job`,
    {
      identifier_from_purchaser: identifierFromPurchaser,
      input_data: inputData,
    },
    {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const jobData = startJobResponse.data;

  // Purchase
  await axios.post(
    purchaseUrl,
    {
      identifierFromPurchaser: jobData.identifierFromPurchaser,
      network: "Preprod",
      sellerVkey: jobData.sellerVKey,
      paymentType: "Web3CardanoV1",
      blockchainIdentifier: jobData.blockchainIdentifier,
      payByTime: jobData.payByTime,
      submitResultTime: jobData.submitResultTime,
      unlockTime: jobData.unlockTime,
      collateralReturnLovelace: null,
      externalDisputeUnlockTime: jobData.externalDisputeUnlockTime,
      requestedById: user._id.toString(),
      inputHash: jobData.input_hash,
      agentIdentifier: jobData.agentIdentifier,
    },
    {
      headers: {
        accept: "application/json",
        token: "this_should_be_very_secure_and_at_least_15_chars_anshuman",
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );

  // Poll for completion
  const maxWaitTime = 360000; // 6 minutes
  const pollInterval = 10000; // 10s
  const startTime = Date.now();
  let result = null;

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const statusResponse = await axios.get(
        `${startHost.replace(/\/$/, "")}/status?job_id=${jobData.job_id}`,
        { headers: { accept: "application/json" }, timeout: 15000 }
      );

      result = statusResponse.data;
      if (result.status === "completed") break;
      if (result.status === "failed") throw new Error("Job failed");

      await new Promise((r) => setTimeout(r, pollInterval));
    } catch (err) {
      // continue polling on transient errors
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  if (!result || result.status !== "completed") {
    throw new Error("Job did not complete in time");
  }

  return result;
}

// ============================================================================
// POST /api/agents/conversation-agent/invoke - Invoke conversation agent
// ============================================================================
router.post("/conversation-agent/invoke", async (req, res) => {
  try {
    const { inputText } = req.body;
    if (!inputText || typeof inputText !== "string") {
      return res.status(400).json({
        success: false,
        error: "inputText is required and must be a string",
      });
    }

    const agentHost =
      process.env.AGENT_SERVICE_HOST || "http://139.84.155.199:8000";
    const purchaseUrl =
      process.env.AGENT_PURCHASE_URL ||
      "http://139.84.155.199:3001/api/v1/purchase/";

    const result = await runAgentJob({
      startHost: agentHost,
      purchaseUrl,
      inputData: { text: inputText },
      user: req.user,
    });

    res.json({ success: true, output: { outputText: result.result } });
  } catch (error) {
    console.error(
      "Conversation agent error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: "Failed to execute conversation agent",
      details: error.response?.data || error.message,
    });
  }
});

// ============================================================================
// POST /api/agents/swap-token-agent/invoke - Invoke swap token agent
// Supports same input shape (inputText) or legacy fromToken/toToken/totalAmount
// ============================================================================
router.post("/swap-token-agent/invoke", async (req, res) => {
  try {
    const { inputText, fromToken, toToken, totalAmount } = req.body;

    let textInput = inputText;
    if (!textInput) {
      if (!fromToken || !toToken || !totalAmount) {
        return res.status(400).json({
          success: false,
          error: "inputText or fromToken/toToken/totalAmount required",
        });
      }
      textInput = `Swap ${totalAmount} ${fromToken} to ${toToken}`;
    }

    const agentHost =
      process.env.AGENT_SERVICE_HOST || "http://139.84.155.199:8008";
    const purchaseUrl =
      process.env.AGENT_PURCHASE_URL ||
      "http://139.84.155.199:3001/api/v1/purchase/";

    const result = await runAgentJob({
      startHost: agentHost,
      purchaseUrl,
      inputData: {
        text: textInput,
        bearer_token: req.headers.authorization.split("Bearer ")[1] || "",
      },
      user: req.user,
    });

    res.json({ success: true, output: { raw: result.result } });
  } catch (error) {
    console.error(
      "Swap token agent error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: "Failed to execute swap token agent",
      details: error.response?.data || error.message,
    });
  }
});

// ============================================================================
// POST /api/agents/research-agent/invoke - Invoke research agent
// ============================================================================
router.post("/research-agent/invoke", async (req, res) => {
  try {
    const { inputText } = req.body;
    if (!inputText || typeof inputText !== "string") {
      return res.status(400).json({
        success: false,
        error: "inputText is required and must be a string",
      });
    }

    const agentHost =
      process.env.AGENT_SERVICE_HOST || "http://139.84.155.199:8012";
    const purchaseUrl =
      process.env.AGENT_PURCHASE_URL ||
      "http://139.84.155.199:3001/api/v1/purchase/";

    const result = await runAgentJob({
      startHost: agentHost,
      purchaseUrl,
      inputData: { text: inputText },
      user: req.user,
    });

    res.json({ success: true, output: { summary: result.result } });
  } catch (error) {
    console.error(
      "Research agent error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: "Failed to execute research agent",
      details: error.response?.data || error.message,
    });
  }
});

// ============================================================================
// POST /api/agents/telegram-bot-agent/invoke - Invoke telegram bot agent
// ============================================================================
router.post("/telegram-bot-agent/invoke", async (req, res) => {
  try {
    const { inputText } = req.body;
    if (!inputText || typeof inputText !== "string") {
      return res.status(400).json({
        success: false,
        error: "inputText is required and must be a string",
      });
    }

    const agentHost =
      process.env.AGENT_SERVICE_HOST || "http://139.84.155.199:8004";
    const purchaseUrl =
      process.env.AGENT_PURCHASE_URL ||
      "http://139.84.155.199:3001/api/v1/purchase/";

    const result = await runAgentJob({
      startHost: agentHost,
      purchaseUrl,
      inputData: { text: inputText },
      user: req.user,
    });

    res.json({ success: true, output: { result: result.result } });
  } catch (error) {
    console.error(
      "Telegram bot agent error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: "Failed to execute telegram bot agent",
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
