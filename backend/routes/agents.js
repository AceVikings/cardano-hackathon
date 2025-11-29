const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const axios = require("axios");
const crypto = require("crypto");

// All agent routes require authentication
router.use(authenticate);

// ============================================================================
// POST /api/agents/conversation-agent/invoke - Invoke conversation agent
// ============================================================================
router.post("/conversation-agent/invoke", async (req, res) => {
  try {
    console.log(req.body);
    const { inputText } = req.body;

    if (!inputText || typeof inputText !== "string") {
      return res.status(400).json({
        success: false,
        error: "inputText is required and must be a string",
      });
    }

    // Generate random 26-character hex identifier
    const identifierFromPurchaser = crypto.randomBytes(13).toString("hex");

    // Step 1: Start the job
    const startJobResponse = await axios.post(
      "http://139.84.155.199:8000/start_job",
      {
        identifier_from_purchaser: identifierFromPurchaser,
        input_data: {
          text: inputText,
        },
      },
      {
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    const jobData = startJobResponse.data;
    console.log("Job started:", jobData);

    // Step 2: Purchase the job
    const purchaseResponse = await axios.post(
      "http://139.84.155.199:3001/api/v1/purchase/",
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
        requestedById: req.user._id.toString(),
        inputHash: jobData.input_hash,
        agentIdentifier: jobData.agentIdentifier,
      },
      {
        headers: {
          accept: "application/json",
          token: "this_should_be_very_secure_and_at_least_15_chars_anshuman",
          "Content-Type": "application/json",
        },
        timeout: 60000, // 60 second timeout for purchase
      }
    );

    console.log("Purchase completed:", purchaseResponse.data);

    // Step 3: Wait for processing (6 minutes) - implement with polling to avoid timeout
    const maxWaitTime = 360000; // 6 minutes max wait
    const pollInterval = 10000; // Check every 10 seconds
    const startTime = Date.now();

    let result = null;
    let attempts = 0;

    while (Date.now() - startTime < maxWaitTime) {
      attempts++;
      console.log(`Polling attempt ${attempts} for job ${jobData.job_id}`);

      try {
        const statusResponse = await axios.get(
          `http://139.84.155.199:8000/status?job_id=${jobData.job_id}`,
          {
            headers: {
              accept: "application/json",
            },
            timeout: 15000, // 15 second timeout for status checks
          }
        );

        result = statusResponse.data;
        console.log(`Job status: ${result.status}`);

        if (result.status === "completed") {
          break;
        } else if (result.status === "failed") {
          throw new Error("Job processing failed");
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (pollError) {
        console.error(
          `Polling error (attempt ${attempts}):`,
          pollError.message
        );
        // Continue polling even if one request fails
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    if (!result || result.status !== "completed") {
      throw new Error(
        `Job did not complete within ${maxWaitTime / 1000} seconds`
      );
    }

    res.json({
      success: true,
      output: {
        outputText: result.result,
      },
    });
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
// ============================================================================
router.post("/swap-token-agent/invoke", async (req, res) => {
  try {
    const { fromToken, toToken, totalAmount } = req.body;

    if (!fromToken || !toToken || !totalAmount) {
      return res.status(400).json({
        success: false,
        error: "fromToken, toToken, and totalAmount are required",
      });
    }

    // For now, return a mock response since the swap agent implementation
    // would follow a similar pattern to the conversation agent
    // In a real implementation, this would make the appropriate API calls
    // to the swap service following the same pattern as conversation agent

    res.json({
      success: true,
      output: {
        toTokenAmount: totalAmount * 1.5, // Mock conversion rate
        txHash: `mock_swap_tx_${Date.now()}`,
      },
    });
  } catch (error) {
    console.error("Swap token agent error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to execute swap token agent",
    });
  }
});

module.exports = router;
