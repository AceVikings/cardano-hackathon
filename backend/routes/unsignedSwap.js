const express = require("express");
const router = express.Router();

// Blockfrost can be required (CJS); Minswap SDK and Lucid are ESM-only
const { BlockFrostAPI } = require("@blockfrost/blockfrost-js");

/**
 * POST /api/unsigned-swap
 * Body: { address, from, to, amount, slippagePercent? }
 * Returns: { success, unsignedTxCborHex, metadata }
 *
 * Notes:
 * - This route is unauthenticated by design (per request)
 * - Defaults to Preprod network and 20% slippage if not provided
 * - Includes batcher fee and ADA deposit in the transaction
 */
router.post("/", async (req, res) => {
  try {
    const { address, from, to, amount, slippagePercent } = req.body || {};

    if (!address || !from || !to || !amount) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields. Required: address, from, to, amount",
      });
    }

    // Defaults
    const network = "preprod";
    const slippage = typeof slippagePercent === "number" ? slippagePercent : 20; // percent

    // token mapping will be resolved after dynamic imports (ADA comes from SDK)

    const BF_PROJECT_ID = process.env.BLOCKFROST_API_KEY_PREPROD;
    if (!BF_PROJECT_ID) {
      return res.status(500).json({
        success: false,
        error:
          "Missing BLOCKFROST_API_KEY in environment. Please set it and restart the server.",
      });
    }

    // Dynamically import ESM-only packages and initialize Blockfrost + adapter + lucid
    const minsdk = await import("@minswap/sdk");
    const {
      ADA,
      BlockfrostAdapter,
      DexV2,
      DexV2Calculation,
      NetworkId,
      OrderV2,
    } = minsdk;

    let Lucid, Blockfrost;
    try {
      const lucidModule = await import("@spacebudz/lucid");
      Lucid = lucidModule.Lucid;
      Blockfrost = lucidModule.Blockfrost;
    } catch (lucidErr) {
      // Some Node setups can't import the .wasm packaged with Lucid (ERR_UNKNOWN_FILE_EXTENSION)
      console.warn("@spacebudz/lucid import failed:", lucidErr.message);
      try {
        // Try fallback to the node-friendly package `lucid-cardano` if available
        const lucidCardano = require("lucid-cardano");
        Lucid = lucidCardano.Lucid || lucidCardano;
        Blockfrost = lucidCardano.Blockfrost || lucidCardano.Blockfrost;
        console.log("Using lucid-cardano fallback for Lucid/Blockfrost");
      } catch (fallbackErr) {
        // Return helpful error explaining how to enable wasm support or install lucid-cardano
        console.error(
          "Lucid import error and fallback failed:",
          fallbackErr.message
        );
        return res.status(500).json({
          success: false,
          error: "Failed to load Lucid (WebAssembly).",
          details: lucidErr.message,
          suggestion:
            'Run the server with Node\'s --experimental-wasm-modules flag or install a node-friendly Lucid package (e.g. lucid-cardano). Example start script: "node --experimental-wasm-modules index.js"',
        });
      }
    }

    // MIN token on Preprod
    const MIN = {
      policyId: "e16c2dc8ae937e8d3790c7fd7168d7b994621ba14ca11415f39fed72",
      tokenName: "4d494e",
    };

    function tokenFromTicker(ticker) {
      const t = (ticker || "").toUpperCase();
      if (t === "ADA") return ADA;
      if (t === "MIN") return MIN;
      throw new Error(`Unknown token ticker: ${ticker}`);
    }

    let assetIn;
    let assetOut;
    try {
      assetIn = tokenFromTicker(from);
      assetOut = tokenFromTicker(to);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const blockfrostApi = new BlockFrostAPI({
      projectId: BF_PROJECT_ID,
      network: "preprod",
    });

    // Compatibility check: some versions of @blockfrost/blockfrost-js expose
    // different method names. The Minswap BlockfrostAdapter expects certain
    // client methods (e.g. `addressesUtxosAssetAll`). If those are missing,
    // the adapter will throw `Cannot read properties of undefined` at runtime.
    // Detect this early and return a helpful error suggesting a compatible
    // Blockfrost SDK version.
    if (typeof blockfrostApi.addressesUtxosAssetAll !== "function") {
      console.error(
        "Incompatible @blockfrost/blockfrost-js detected: missing addressesUtxosAssetAll"
      );
      return res.status(500).json({
        success: false,
        error:
          "Incompatible @blockfrost/blockfrost-js version detected. The installed Blockfrost client does not expose methods expected by @minswap/sdk BlockfrostAdapter.",
        suggestion:
          "Install a Blockfrost client compatible with @minswap/sdk (for example: `npm install @blockfrost/blockfrost-js@5`), then restart the server.",
        hint: "Alternatively, adjust the adapter initialization to match the installed Blockfrost client API.",
      });
    }

    const adapter = new BlockfrostAdapter(NetworkId.TESTNET, blockfrostApi);

    // Initialize Lucid with the provider; support multiple Lucid APIs
    const provider = new Blockfrost(
      "https://cardano-preprod.blockfrost.io/api/v0",
      BF_PROJECT_ID
    );
    let lucid;
    if (Lucid && typeof Lucid.new === "function") {
      lucid = await Lucid.new(provider);
    } else if (typeof Lucid === "function") {
      lucid = new Lucid({ provider });
    } else if (Lucid && typeof Lucid.create === "function") {
      lucid = await Lucid.create({ provider });
    } else {
      return res.status(500).json({
        success: false,
        error: "Unsupported Lucid API: cannot initialize provider",
      });
    }

    // Fetch UTXOs at user address
    const utxos = await lucid.utxosAt(address);
    if (!utxos || utxos.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No UTXOs found at the provided address",
      });
    }

    // Find the pool
    const pool = await adapter.getV2PoolByPair(ADA, MIN);
    if (!pool) {
      return res
        .status(400)
        .json({ success: false, error: "Pool not found for the pair" });
    }

    // Convert amount to big int (assume amount provided in ADA for ADA ticker)
    let amountInLovelace;
    if ((from || "").toUpperCase() === "ADA") {
      amountInLovelace = BigInt(Math.floor(Number(amount) * 1_000_000));
    } else {
      amountInLovelace = BigInt(amount);
    }

    // Calculate amountOut based on pool reserves and fee
    const amountOut = DexV2Calculation.calculateAmountOut({
      reserveIn: pool.reserveA,
      reserveOut: pool.reserveB,
      amountIn: amountInLovelace,
      tradingFeeNumerator: pool.feeA[0],
    });

    const minimumAmountOut = (amountOut * BigInt(100 - slippage)) / BigInt(100);

    // Include batcher fee and ADA deposit (per doc approx 2 ADA each)
    const batcherFeeLovelace = BigInt(2 * 1_000_000);
    const depositLovelace = BigInt(2 * 1_000_000);

    // Build the order transaction using DexV2
    const dex = new DexV2(lucid, adapter);

    const orderOptions = [
      {
        type: OrderV2.StepType.SWAP_EXACT_IN,
        amountIn: amountInLovelace,
        assetIn: ADA,
        direction: OrderV2.Direction.A_TO_B,
        minimumAmountOut: minimumAmountOut,
        lpAsset: pool.lpAsset,
        isLimitOrder: false,
        killOnFailed: false,
      },
    ];

    let txComplete;
    try {
      txComplete = await dex.createBulkOrdersTx({
        sender: address,
        availableUtxos: utxos,
        orderOptions,
        batcherFee: batcherFeeLovelace,
        depositAda: depositLovelace,
      });
    } catch (err) {
      console.error("Failed to build order tx:", err.message || err);
      return res.status(500).json({
        success: false,
        error: "Failed to build unsigned transaction",
        details: err.message || err,
      });
    }

    // Try to get unsigned CBOR
    let unsignedCborHex;
    try {
      if (txComplete.txBody) {
        unsignedCborHex = Buffer.from(txComplete.txBody.to_bytes()).toString(
          "hex"
        );
      } else if (typeof txComplete.to_tx_body_hex === "function") {
        unsignedCborHex = txComplete.to_tx_body_hex();
      } else if (txComplete.build) {
        const built = txComplete.build();
        if (built && built.to_cbor) unsignedCborHex = built.to_cbor();
      }
    } catch (err) {
      console.warn(
        "Could not extract unsigned CBOR from txComplete object:",
        err.message
      );
    }

    if (!unsignedCborHex) {
      return res.status(500).json({
        success: false,
        error:
          "Unable to extract unsigned CBOR from built transaction. The server SDK may be incompatible.",
        note: "Ensure @minswap/sdk and @spacebudz/lucid versions are compatible and that the SDK exposes tx body serialization methods.",
      });
    }

    return res.json({
      success: true,
      unsignedTxCborHex: unsignedCborHex,
      metadata: {
        network,
        slippagePercent: slippage,
        batcherFeeLovelace: String(batcherFeeLovelace),
        depositLovelace: String(depositLovelace),
        amountIn: String(amountInLovelace),
        estimatedAmountOut: String(amountOut),
        minimumAmountOut: String(minimumAmountOut),
      },
    });
  } catch (err) {
    console.error("Unsigned swap route error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: err.message,
    });
  }
});

module.exports = router;
