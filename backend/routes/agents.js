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

  // Start job: wrap in try/catch to surface clear errors
  let startJobResponse;
  try {
    startJobResponse = await axios.post(
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
  } catch (err) {
    console.error(
      "start_job request failed:",
      err.response?.status,
      err.response?.data || err.message
    );
    throw new Error(`start_job failed: ${err.response?.status || err.message}`);
  }

  const jobData = startJobResponse.data || {};
  console.debug("start_job response:", jobData);

  // Normalize fields (support snake_case and camelCase)
  const identifier =
    jobData.identifierFromPurchaser ||
    jobData.identifier_from_purchaser ||
    jobData.identifier ||
    identifierFromPurchaser;

  const sellerVKey =
    jobData.sellerVKey ||
    jobData.sellerVkey ||
    jobData.seller_v_key ||
    jobData.seller_key ||
    null;

  const blockchainIdentifier =
    jobData.blockchainIdentifier ||
    jobData.blockchain_identifier ||
    jobData.blockchainId ||
    null;

  const input_hash =
    jobData.input_hash || jobData.inputHash || jobData.inputhash || null;

  const agentIdentifier =
    jobData.agentIdentifier ||
    jobData.agent_identifier ||
    jobData.agentId ||
    null;

  const requestedById = user && user._id ? user._id.toString() : null;

  // Purchase - be tolerant: send both naming forms so upstream accepts one
  try {
    const purchaseBody = {
      identifierFromPurchaser: identifier,
      identifier_from_purchaser: identifier,
      network: "Preprod",
      sellerVkey: sellerVKey,
      seller_v_key: sellerVKey,
      paymentType: "Web3CardanoV1",
      blockchainIdentifier: blockchainIdentifier,
      blockchain_identifier: blockchainIdentifier,
      payByTime: jobData.payByTime,
      submitResultTime: jobData.submitResultTime,
      unlockTime: jobData.unlockTime,
      collateralReturnLovelace: jobData.collateralReturnLovelace ?? null,
      externalDisputeUnlockTime: jobData.externalDisputeUnlockTime,
      requestedById,
      inputHash: input_hash,
      input_hash,
      agentIdentifier,
      agent_identifier: agentIdentifier,
    };

    const purchaseResp = await axios.post(purchaseUrl, purchaseBody, {
      headers: {
        accept: "application/json",
        token: "this_should_be_very_secure_and_at_least_15_chars_anshuman",
        "Content-Type": "application/json",
      },
      timeout: 60000,
    });

    console.debug("purchase response:", purchaseResp.data);
  } catch (err) {
    console.error(
      "purchase request failed:",
      err.response?.status,
      err.response?.data || err.message
    );
    throw new Error(
      `purchase failed: ${err.response?.status} ${
        JSON.stringify(err.response?.data) || err.message
      }`
    );
  }

  // Poll for completion
  const jobId =
    jobData.job_id || jobData.jobId || jobData.jobid || jobData.id || null;
  if (!jobId) {
    console.warn("No job_id returned from start_job. jobData:", jobData);
  }

  const maxWaitTime = 360000; // 6 minutes
  const pollInterval = 10000; // 10s
  const startTime = Date.now();
  let result = null;

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const statusResponse = await axios.get(
        `${startHost.replace(/\/$/, "")}/status?job_id=${encodeURIComponent(
          jobId || ""
        )}`,
        { headers: { accept: "application/json" }, timeout: 15000 }
      );

      result = statusResponse.data;
      console.debug("status poll:", result);
      if (result.status === "completed") break;
      if (result.status === "failed")
        throw new Error("Job failed: " + JSON.stringify(result));

      await new Promise((r) => setTimeout(r, pollInterval));
    } catch (err) {
      // log the poll error, but continue polling until timeout
      console.warn(
        "status poll error (will retry):",
        err.response?.status,
        err.response?.data || err.message
      );
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  if (!result || result.status !== "completed") {
    throw new Error(
      "Job did not complete in time or returned non-completed status. Last status: " +
        JSON.stringify(result)
    );
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
// After the agent returns an unsigned tx, automatically sign (and optionally submit)
// ============================================================================
router.post("/swap-token-agent/invoke", async (req, res) => {
  try {
    const { inputText, fromToken, toToken, totalAmount, submit } = req.body;

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
      process.env.SWAP_AGENT_HOST || "http://139.84.155.199:8008";
    const purchaseUrl =
      process.env.AGENT_PURCHASE_URL ||
      "http://139.84.155.199:3001/api/v1/purchase/";

    const result = await runAgentJob({
      startHost: agentHost,
      purchaseUrl,
      inputData: {
        text: `${textInput}||||||||||${
          req.headers.authorization?.split("Bearer ")[1] || ""
        }`,
        bearer_token: req.headers.authorization?.split("Bearer ")[1] || "",
      },
      user: req.user,
    });

    // -------------------------------------------------
    // Parse the agent response to extract unsigned tx
    // -------------------------------------------------
    let agentResponse = result.result;
    // If it's a string, try to parse as JSON
    if (typeof agentResponse === "string") {
      try {
        agentResponse = JSON.parse(agentResponse);
      } catch (_) {
        // leave as-is if not JSON
      }
    }

    // The response may be { status: "ok", response: "<hex>" }
    // or { unsignedTxCborHex: "<hex>" } or just a raw hex string
    let unsignedTxHex = null;
    if (agentResponse && typeof agentResponse === "object") {
      unsignedTxHex =
        agentResponse.response ||
        agentResponse.unsignedTxCborHex ||
        agentResponse.unsignedTxHex ||
        agentResponse.unsigned_tx ||
        agentResponse.tx ||
        null;
    } else if (
      typeof agentResponse === "string" &&
      /^[0-9a-fA-F]+$/.test(agentResponse)
    ) {
      // Raw hex string
      unsignedTxHex = agentResponse;
    }

    // -------------------------------------------------
    // Fallback: if agent didn't return unsigned tx, call minswap API directly
    // -------------------------------------------------
    if (!unsignedTxHex) {
      console.warn(
        "Swap agent did not return a parsable unsigned tx, calling minswap API directly..."
      );

      // Parse amount and slippage from textInput (similar to Python agent logic)
      const parseAmountAndSlippage = (intent) => {
        const text = intent.toLowerCase();
        let adaAmount = null;
        let slippage = null;

        // Parse slippage
        const slipMatch = text.match(
          /slippage\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%?/
        );
        if (slipMatch) {
          slippage = parseFloat(slipMatch[1]);
        } else {
          const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
          if (percentMatch) {
            slippage = parseFloat(percentMatch[1]);
          }
        }

        // Parse ADA amount
        const adaMatch = text.match(/(\d+(?:\.\d+)?)\s*(ada|lovelace)\b/);
        if (adaMatch) {
          adaAmount = parseFloat(adaMatch[1]);
        } else {
          const numMatch = text.match(/(\d+(?:\.\d+)?)/);
          if (numMatch) {
            adaAmount = parseFloat(numMatch[1]);
          }
        }

        // Defaults
        if (adaAmount === null) adaAmount = 5.0;
        if (slippage === null) {
          if (/aggressive|fast|urgent/.test(text)) slippage = 3.0;
          else if (/safe|conservative|low/.test(text)) slippage = 0.5;
          else slippage = 1.0;
        }

        return {
          amountInLovelace: Math.round(adaAmount * 1_000_000),
          slippagePercent: Math.round(slippage),
        };
      };

      const { amountInLovelace, slippagePercent } =
        parseAmountAndSlippage(textInput);

      const minswapUrl =
        process.env.MINSWAP_API_URL ||
        `http://localhost:${process.env.PORT || 5001}/api/swap/minswap/swap`;

      console.debug(
        `Calling minswap API: amount=${amountInLovelace} lovelace, slippage=${slippagePercent}%`
      );

      try {
        const swapResponse = await axios.post(
          minswapUrl,
          {
            assetIn: "lovelace",
            assetOut:
              "e16c2dc8ae937e8d3790c7fd7168d7b994621ba14ca11415f39fed72.4d494e",
            amountIn: String(amountInLovelace),
            slippagePercent: slippagePercent,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.authorization || "",
            },
            timeout: 30000,
          }
        );

        const swapData = swapResponse.data;
        unsignedTxHex =
          swapData.unsignedTx || swapData.unsignedTxHex || swapData.tx || null;

        if (!unsignedTxHex) {
          console.error("Minswap API did not return unsigned tx:", swapData);
          return res.json({
            success: true,
            output: { raw: result.result, swapApiResponse: swapData },
            note: "Neither agent nor minswap API returned an unsigned transaction.",
          });
        }

        console.debug("Got unsigned tx from minswap API fallback");
      } catch (swapErr) {
        console.error(
          "Minswap API fallback failed:",
          swapErr.response?.data || swapErr.message
        );
        return res.status(500).json({
          success: false,
          error:
            "Failed to get unsigned transaction from both agent and minswap API",
          agentResult: result.result,
          swapError: swapErr.response?.data || swapErr.message,
        });
      }
    }

    console.debug(
      "Extracted unsigned tx hex:",
      unsignedTxHex.slice(0, 80) + "..."
    );

    // -------------------------------------------------
    // Call internal wallet sign-transaction API
    // -------------------------------------------------
    const backendBaseUrl =
      process.env.BACKEND_BASE_URL ||
      `http://localhost:${process.env.PORT || 5001}`;
    const signResponse = await axios.post(
      `${backendBaseUrl}/api/wallet/sign-transaction`,
      {
        unsignedTxHex,

        submit: true,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.authorization || "",
        },
        timeout: 60000,
      }
    );
    console.log("Sign transaction response:", signResponse.data);
    const signData = signResponse.data;
    if (!signData.success) {
      return res.status(500).json({
        success: false,
        error: "Signing failed",
        details: signData.error || signData,
      });
    }

    // Return the signed (and possibly submitted) tx along with original agent output
    res.json({
      success: true,
      output: {
        raw: result.result,
        signedTxHex: signData.signedTxHex,
        txHash: signData.txHash || null,
        submitted: !!signData.txHash,
      },
    });
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
