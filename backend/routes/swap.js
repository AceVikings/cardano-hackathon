const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { Web3Sdk } = require("@meshsdk/web3-sdk");
const { BlockfrostProvider } = require("@meshsdk/provider");

/**
 * Minswap Swap Route
 * 
 * Generates unsigned transactions for token swaps on Minswap DEX.
 * Uses @minswap/sdk for pool discovery and transaction building.
 */

// We'll use dynamic imports for ESM modules
let minswapSDK = null;
let blockfrostAPI = null;
let lucidLib = null;

// Lazy load ESM modules
async function loadModules() {
  if (!minswapSDK) {
    minswapSDK = await import("@minswap/sdk");
    blockfrostAPI = await import("@blockfrost/blockfrost-js");
    lucidLib = await import("@spacebudz/lucid");
  }
  return { minswapSDK, blockfrostAPI, lucidLib };
}

// Minswap configuration for different networks
const MINSWAP_CONFIG = {
  preprod: {
    networkId: 0, // TESTNET
    blockfrostUrl: "https://cardano-preprod.blockfrost.io/api/v0",
    blockfrostNetwork: "preprod",
  },
  mainnet: {
    networkId: 1, // MAINNET
    blockfrostUrl: "https://cardano-mainnet.blockfrost.io/api/v0",
    blockfrostNetwork: "mainnet",
  },
};

// Common token definitions
const TOKENS = {
  preprod: {
    ADA: { policyId: "", tokenName: "" },
    MIN: {
      policyId: "e16c2dc8ae937e8d3790c7fd7168d7b994621ba14ca11415f39fed72",
      tokenName: "4d494e",
    },
  },
  mainnet: {
    ADA: { policyId: "", tokenName: "" },
    MIN: {
      policyId: "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6",
      tokenName: "4d494e",
    },
  },
};

/**
 * @route POST /api/swap/minswap/swap
 * @desc Execute a swap using authenticated user's wallet (auto-fetches wallet and UTXOs)
 * @auth Required - Bearer token
 * @body {
 *   assetIn: "lovelace" | "policyId.tokenName",
 *   assetOut: "lovelace" | "policyId.tokenName", 
 *   amountIn: string (in lovelace or smallest unit),
 *   slippagePercent?: number (default 1%)
 * }
 */
router.post("/minswap/swap", authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { assetIn, assetOut, amountIn, slippagePercent = 1 } = req.body;

    // Validate user has wallet
    if (!user.developerWallet?.initialized) {
      return res.status(400).json({
        success: false,
        error: "Wallet not initialized. Please create a wallet first.",
      });
    }

    // Validate required fields
    if (!assetIn || !assetOut || !amountIn) {
      return res.status(400).json({
        success: false,
        error: "assetIn, assetOut, and amountIn are required",
      });
    }

    const walletAddress = user.developerWallet.paymentAddress;
    const walletId = user.developerWallet.walletId;
    const network = "preprod";
    const config = MINSWAP_CONFIG[network];

    const blockfrostApiKey = process.env.BLOCKFROST_API_KEY_PREPROD;
    if (!blockfrostApiKey) {
      return res.status(500).json({
        success: false,
        error: "Blockfrost API key not configured",
      });
    }

    // Initialize the Web3 SDK for signing
    const provider = new BlockfrostProvider(blockfrostApiKey);
    const sdk = new Web3Sdk({
      projectId: process.env.UTXOS_PROJECT_ID,
      apiKey: process.env.UTXOS_API_KEY,
      privateKey: process.env.UTXOS_PRIVATE_KEY,
      network: "preprod",
      fetcher: provider,
      submitter: provider,
    });

    // Load Minswap SDK
    const { minswapSDK, blockfrostAPI, lucidLib } = await loadModules();
    const { 
      ADA, 
      BlockfrostAdapter, 
      NetworkId, 
      DexV2, 
      DexV2Calculation,
      OrderV2,
      calculateAmountWithSlippageTolerance,
      Asset 
    } = minswapSDK;
    const { BlockFrostAPI } = blockfrostAPI;
    const { Lucid, Blockfrost } = lucidLib;

    // Initialize Blockfrost adapter for Minswap
    const blockfrostApi = new BlockFrostAPI({
      projectId: blockfrostApiKey,
      network: config.blockfrostNetwork,
    });
    
    const adapter = new BlockfrostAdapter(
      NetworkId.TESTNET,
      blockfrostApi
    );

    // Parse assets
    const parsedAssetIn = parseAssetString(assetIn, ADA);
    const parsedAssetOut = parseAssetString(assetOut, ADA);

    // Find pool
    const pool = await adapter.getV2PoolByPair(parsedAssetIn, parsedAssetOut);
    
    if (!pool) {
      return res.status(404).json({
        success: false,
        error: "No liquidity pool found for the specified token pair",
      });
    }

    // Calculate swap amounts
    const amountInBigInt = BigInt(amountIn);

    // Determine swap direction
    const isAtoB = Asset.equals(parsedAssetIn, pool.assetA) || 
      (parsedAssetIn.policyId === "" && pool.assetA.policyId === "");

    const amountOut = DexV2Calculation.calculateAmountOut({
      reserveIn: isAtoB ? pool.reserveA : pool.reserveB,
      reserveOut: isAtoB ? pool.reserveB : pool.reserveA,
      amountIn: amountInBigInt,
      tradingFeeNumerator: isAtoB ? pool.feeA[0] : pool.feeB[0],
    });

    // Apply slippage tolerance
    const minimumAmountOut = calculateAmountWithSlippageTolerance({
      slippageTolerancePercent: slippagePercent,
      amount: amountOut,
      type: "down",
    });

    // Calculate price impact
    const priceImpact = calculatePriceImpact(
      amountInBigInt,
      amountOut,
      isAtoB ? pool.reserveA : pool.reserveB,
      isAtoB ? pool.reserveB : pool.reserveA
    );

    // Get UTXOs from Blockfrost
    const utxosResponse = await fetch(
      `${config.blockfrostUrl}/addresses/${walletAddress}/utxos`,
      { headers: { project_id: blockfrostApiKey } }
    );
    
    if (!utxosResponse.ok) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch UTXOs from Blockfrost",
      });
    }

    const blockfrostUtxos = await utxosResponse.json();
    
    // Check balance
    let totalLovelace = 0n;
    for (const utxo of blockfrostUtxos) {
      for (const amount of utxo.amount) {
        if (amount.unit === "lovelace") {
          totalLovelace += BigInt(amount.quantity);
        }
      }
    }

    // Required: swap amount + batcher fee (2 ADA) + deposit (2 ADA) + network fee (~0.3 ADA)
    const requiredLovelace = amountInBigInt + 4_300_000n;
    if (assetIn === "lovelace" && totalLovelace < requiredLovelace) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Need ${Number(requiredLovelace) / 1_000_000} ADA, have ${Number(totalLovelace) / 1_000_000} ADA`,
      });
    }

    // Convert Blockfrost UTXOs to Lucid format
    const lucidUtxos = blockfrostUtxos.map(utxo => ({
      txHash: utxo.tx_hash,
      outputIndex: utxo.output_index,
      assets: utxo.amount.reduce((acc, a) => {
        acc[a.unit === "lovelace" ? "lovelace" : a.unit] = BigInt(a.quantity);
        return acc;
      }, {}),
      address: utxo.address,
      datumHash: utxo.data_hash || null,
      datum: utxo.inline_datum || null,
      scriptRef: null,
    }));

    // Initialize Lucid for tx building with read-only wallet
    const lucid = new Lucid({
      provider: new Blockfrost(config.blockfrostUrl, blockfrostApiKey),
    });
    
    // Set up read-only wallet with the user's address and UTXOs
    lucid.selectReadOnlyWallet({
      address: walletAddress,
      utxos: lucidUtxos,
    });

    const dexV2 = new DexV2(lucid, adapter);

    // Build the swap order transaction
    const txComplete = await dexV2.createBulkOrdersTx({
      sender: walletAddress,
      availableUtxos: lucidUtxos,
      orderOptions: [
        {
          type: OrderV2.StepType.SWAP_EXACT_IN,
          amountIn: amountInBigInt,
          assetIn: parsedAssetIn,
          direction: isAtoB ? OrderV2.Direction.A_TO_B : OrderV2.Direction.B_TO_A,
          minimumAmountOut: minimumAmountOut,
          lpAsset: pool.lpAsset,
          isLimitOrder: false,
          killOnFailed: false,
        },
      ],
    });

    // Get the unsigned transaction CBOR
    const unsignedTxCbor = txComplete.toString();

    res.json({
      success: true,
      unsignedTx: unsignedTxCbor,
      txDetails: {
        poolId: Asset.toString(pool.lpAsset),
        assetIn: assetIn,
        assetOut: assetOut,
        amountIn: amountIn,
        expectedOutput: amountOut.toString(),
        minimumOutput: minimumAmountOut.toString(),
        slippagePercent: slippagePercent,
        priceImpact: priceImpact.toFixed(4),
        batcherFee: "2000000",
        deposit: "2000000",
      },
    });

  } catch (error) {
    console.error("Minswap swap error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
});

/**
 * @route POST /api/swap/minswap/build-tx
 * @desc Generate an unsigned swap transaction for Minswap
 * @body {
 *   network: "preprod" | "mainnet",
 *   walletAddress: string,
 *   utxos: Array<UTxO>,
 *   swapParams: {
 *     assetIn: { policyId: string, tokenName: string } | "ADA",
 *     assetOut: { policyId: string, tokenName: string } | "ADA",
 *     amountIn: string (in lovelace or smallest unit),
 *     slippagePercent: number (e.g., 0.5 for 0.5%)
 *   }
 * }
 * @returns {
 *   success: boolean,
 *   unsignedTx: string (CBOR hex),
 *   txDetails: {
 *     expectedOutput: string,
 *     minimumOutput: string,
 *     priceImpact: string,
 *     fee: string
 *   }
 * }
 */
router.post("/minswap/build-tx", async (req, res) => {
  try {
    const { network = "preprod", walletAddress, utxos, swapParams } = req.body;

    // Validate required fields
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: "walletAddress is required",
      });
    }

    if (!utxos || !Array.isArray(utxos) || utxos.length === 0) {
      return res.status(400).json({
        success: false,
        error: "utxos array is required and must not be empty",
      });
    }

    if (!swapParams || !swapParams.assetIn || !swapParams.assetOut || !swapParams.amountIn) {
      return res.status(400).json({
        success: false,
        error: "swapParams must include assetIn, assetOut, and amountIn",
      });
    }

    const config = MINSWAP_CONFIG[network];
    if (!config) {
      return res.status(400).json({
        success: false,
        error: `Invalid network: ${network}. Use 'preprod' or 'mainnet'`,
      });
    }

    // Check for Blockfrost API key
    const blockfrostApiKey = process.env.BLOCKFROST_API_KEY_PREPROD || process.env.BLOCKFROST_API_KEY;
    if (!blockfrostApiKey) {
      return res.status(500).json({
        success: false,
        error: "Blockfrost API key not configured",
      });
    }

    // Load ESM modules
    const { minswapSDK, blockfrostAPI, lucidLib } = await loadModules();
    const { 
      ADA, 
      BlockfrostAdapter, 
      NetworkId, 
      DexV2, 
      DexV2Calculation,
      OrderV2,
      calculateAmountWithSlippageTolerance,
      Asset 
    } = minswapSDK;
    const { BlockFrostAPI } = blockfrostAPI;
    const { Lucid, Blockfrost } = lucidLib;

    // Initialize Lucid and set up with user's address
    const lucid = new Lucid({
      provider: new Blockfrost(config.blockfrostUrl, blockfrostApiKey),
    });
    
    // Select wallet from the user's address
    // The UTXOs will be provided directly to the SDK
    lucid.selectWalletFrom({
      address: walletAddress,
      utxos: convertUtxosToLucidFormat(utxos),
    });

    // Initialize Blockfrost adapter for Minswap
    const blockfrostApi = new BlockFrostAPI({
      projectId: blockfrostApiKey,
      network: config.blockfrostNetwork,
    });
    
    const adapter = new BlockfrostAdapter(
      network === "mainnet" ? NetworkId.MAINNET : NetworkId.TESTNET,
      blockfrostApi
    );

    // Parse assets using helper function
    const assetIn = parseAssetString(swapParams.assetIn, ADA);
    const assetOut = parseAssetString(swapParams.assetOut, ADA);

    // Find pool
    const pool = await adapter.getV2PoolByPair(assetIn, assetOut);
    
    if (!pool) {
      return res.status(404).json({
        success: false,
        error: "No liquidity pool found for the specified token pair",
        suggestion: "Verify the token policy IDs and ensure a pool exists on Minswap",
      });
    }

    // Calculate swap amounts
    const amountIn = BigInt(swapParams.amountIn);
    const slippagePercent = swapParams.slippagePercent || 1; // Default 1%

    // Determine swap direction
    const isAtoB = Asset.equals(assetIn, pool.assetA) || 
      (assetIn.policyId === "" && pool.assetA.policyId === "");

    const amountOut = DexV2Calculation.calculateAmountOut({
      reserveIn: isAtoB ? pool.reserveA : pool.reserveB,
      reserveOut: isAtoB ? pool.reserveB : pool.reserveA,
      amountIn: amountIn,
      tradingFeeNumerator: isAtoB ? pool.feeA[0] : pool.feeB[0],
    });

    // Apply slippage tolerance
    const minimumAmountOut = calculateAmountWithSlippageTolerance({
      slippageTolerancePercent: slippagePercent,
      amount: amountOut,
      type: "down",
    });

    // Calculate price impact
    const priceImpact = calculatePriceImpact(
      amountIn,
      amountOut,
      isAtoB ? pool.reserveA : pool.reserveB,
      isAtoB ? pool.reserveB : pool.reserveA
    );

    // Build the swap transaction
    // First, set up Lucid with the user's address for building
    // We don't need the wallet, just need to build the tx
    
    const dexV2 = new DexV2(lucid, adapter);

    // Convert frontend UTxOs to Lucid format
    const lucidUtxos = convertUtxosToLucidFormat(utxos);

    const txComplete = await dexV2.createBulkOrdersTx({
      sender: walletAddress,
      availableUtxos: lucidUtxos,
      orderOptions: [
        {
          type: OrderV2.StepType.SWAP_EXACT_IN,
          amountIn: amountIn,
          assetIn: assetIn,
          direction: isAtoB ? OrderV2.Direction.A_TO_B : OrderV2.Direction.B_TO_A,
          minimumAmountOut: minimumAmountOut,
          lpAsset: pool.lpAsset,
          isLimitOrder: false,
          killOnFailed: false,
        },
      ],
    });

    // Get the unsigned transaction CBOR
    const unsignedTx = txComplete.toString();

    // Calculate estimated fee (approximately 0.2 ADA for swap orders)
    const estimatedFee = "200000"; // 0.2 ADA

    res.json({
      success: true,
      unsignedTx: unsignedTx,
      txDetails: {
        poolId: pool.id || Asset.toString(pool.lpAsset),
        assetIn: swapParams.assetIn === "ADA" ? "lovelace" : Asset.toString(assetIn),
        assetOut: swapParams.assetOut === "ADA" ? "lovelace" : Asset.toString(assetOut),
        amountIn: amountIn.toString(),
        expectedOutput: amountOut.toString(),
        minimumOutput: minimumAmountOut.toString(),
        slippagePercent: slippagePercent,
        priceImpact: priceImpact.toFixed(4),
        estimatedFee: estimatedFee,
        batcherFee: "2000000", // 2 ADA
        deposit: "2000000", // 2 ADA (returned after order is processed)
      },
    });

  } catch (error) {
    console.error("Minswap swap build error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
});

/**
 * @route GET /api/swap/minswap/pools
 * @desc Get available liquidity pools on Minswap
 * @query network: "preprod" | "mainnet"
 * @query page: number (default 1)
 */
router.get("/minswap/pools", async (req, res) => {
  try {
    const { network = "preprod", page = 1 } = req.query;
    
    const config = MINSWAP_CONFIG[network];
    if (!config) {
      return res.status(400).json({
        success: false,
        error: `Invalid network: ${network}`,
      });
    }

    const blockfrostApiKey = process.env.BLOCKFROST_API_KEY_PREPROD || process.env.BLOCKFROST_API_KEY;
    if (!blockfrostApiKey) {
      return res.status(500).json({
        success: false,
        error: "Blockfrost API key not configured",
      });
    }

    const { minswapSDK, blockfrostAPI } = await loadModules();
    const { BlockfrostAdapter, NetworkId, Asset } = minswapSDK;
    const { BlockFrostAPI } = blockfrostAPI;

    const blockfrostApi = new BlockFrostAPI({
      projectId: blockfrostApiKey,
      network: config.blockfrostNetwork,
    });

    const adapter = new BlockfrostAdapter(
      network === "mainnet" ? NetworkId.MAINNET : NetworkId.TESTNET,
      blockfrostApi
    );

    const pools = await adapter.getV2Pools({ page: parseInt(page) });

    const formattedPools = pools.map(pool => ({
      lpAsset: Asset.toString(pool.lpAsset),
      assetA: pool.assetA.policyId === "" ? "ADA" : Asset.toString(pool.assetA),
      assetB: pool.assetB.policyId === "" ? "ADA" : Asset.toString(pool.assetB),
      reserveA: pool.reserveA.toString(),
      reserveB: pool.reserveB.toString(),
      feeA: pool.feeA[0].toString(),
      feeB: pool.feeB[0].toString(),
    }));

    res.json({
      success: true,
      network,
      page: parseInt(page),
      pools: formattedPools,
    });

  } catch (error) {
    console.error("Minswap pools query error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/swap/minswap/quote
 * @desc Get a swap quote without building transaction
 * @query network: "preprod" | "mainnet"
 * @query assetIn: "ADA" or policy.tokenName
 * @query assetOut: "ADA" or policy.tokenName  
 * @query amountIn: amount in smallest unit
 * @query slippage: slippage percent (default 1)
 */
router.get("/minswap/quote", async (req, res) => {
  try {
    const { 
      network = "preprod", 
      assetIn, 
      assetOut, 
      amountIn, 
      slippage = "1" 
    } = req.query;

    if (!assetIn || !assetOut || !amountIn) {
      return res.status(400).json({
        success: false,
        error: "assetIn, assetOut, and amountIn are required",
      });
    }

    const config = MINSWAP_CONFIG[network];
    if (!config) {
      return res.status(400).json({
        success: false,
        error: `Invalid network: ${network}`,
      });
    }

    const blockfrostApiKey = process.env.BLOCKFROST_API_KEY_PREPROD || process.env.BLOCKFROST_API_KEY;
    if (!blockfrostApiKey) {
      return res.status(500).json({
        success: false,
        error: "Blockfrost API key not configured",
      });
    }

    const { minswapSDK, blockfrostAPI } = await loadModules();
    const { 
      ADA, 
      BlockfrostAdapter, 
      NetworkId, 
      DexV2Calculation,
      calculateAmountWithSlippageTolerance,
      Asset 
    } = minswapSDK;
    const { BlockFrostAPI } = blockfrostAPI;

    const blockfrostApi = new BlockFrostAPI({
      projectId: blockfrostApiKey,
      network: config.blockfrostNetwork,
    });

    const adapter = new BlockfrostAdapter(
      network === "mainnet" ? NetworkId.MAINNET : NetworkId.TESTNET,
      blockfrostApi
    );

    // Parse assets
    const parsedAssetIn = parseAssetString(assetIn, ADA);
    const parsedAssetOut = parseAssetString(assetOut, ADA);

    // Find pool
    const pool = await adapter.getV2PoolByPair(parsedAssetIn, parsedAssetOut);
    
    if (!pool) {
      return res.status(404).json({
        success: false,
        error: "No liquidity pool found for the specified token pair",
      });
    }

    const amountInBigInt = BigInt(amountIn);
    const slippagePercent = parseFloat(slippage);

    // Determine direction
    const isAtoB = Asset.equals(parsedAssetIn, pool.assetA) || 
      (parsedAssetIn.policyId === "" && pool.assetA.policyId === "");

    const amountOut = DexV2Calculation.calculateAmountOut({
      reserveIn: isAtoB ? pool.reserveA : pool.reserveB,
      reserveOut: isAtoB ? pool.reserveB : pool.reserveA,
      amountIn: amountInBigInt,
      tradingFeeNumerator: isAtoB ? pool.feeA[0] : pool.feeB[0],
    });

    const minimumAmountOut = calculateAmountWithSlippageTolerance({
      slippageTolerancePercent: slippagePercent,
      amount: amountOut,
      type: "down",
    });

    const priceImpact = calculatePriceImpact(
      amountInBigInt,
      amountOut,
      isAtoB ? pool.reserveA : pool.reserveB,
      isAtoB ? pool.reserveB : pool.reserveA
    );

    // Calculate price
    const price = Number(amountOut) / Number(amountInBigInt);

    res.json({
      success: true,
      quote: {
        assetIn: assetIn,
        assetOut: assetOut,
        amountIn: amountIn,
        expectedOutput: amountOut.toString(),
        minimumOutput: minimumAmountOut.toString(),
        slippagePercent: slippagePercent,
        priceImpact: priceImpact.toFixed(4),
        price: price.toString(),
        poolReserveIn: (isAtoB ? pool.reserveA : pool.reserveB).toString(),
        poolReserveOut: (isAtoB ? pool.reserveB : pool.reserveA).toString(),
        tradingFee: (Number(isAtoB ? pool.feeA[0] : pool.feeB[0]) / 100).toString() + "%",
      },
      fees: {
        batcherFee: "2000000", // 2 ADA
        deposit: "2000000", // 2 ADA
        estimatedNetworkFee: "200000", // ~0.2 ADA
      },
    });

  } catch (error) {
    console.error("Minswap quote error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/swap/minswap/tokens
 * @desc Get common tokens for the network
 * @query network: "preprod" | "mainnet"
 */
router.get("/minswap/tokens", (req, res) => {
  const { network = "preprod" } = req.query;
  
  const tokens = TOKENS[network];
  if (!tokens) {
    return res.status(400).json({
      success: false,
      error: `Invalid network: ${network}`,
    });
  }

  res.json({
    success: true,
    network,
    tokens: Object.entries(tokens).map(([symbol, asset]) => ({
      symbol,
      policyId: asset.policyId,
      tokenName: asset.tokenName,
      assetId: asset.policyId === "" ? "lovelace" : `${asset.policyId}${asset.tokenName}`,
    })),
  });
});

// Helper functions

function parseAssetString(assetStr, ADA) {
  if (assetStr === "ADA" || assetStr === "lovelace") {
    return ADA;
  }
  
  // Expect format: policyId.tokenName or policyIdtokenName
  if (assetStr.includes(".")) {
    const [policyId, tokenName] = assetStr.split(".");
    return { policyId, tokenName };
  }
  
  // Assume first 56 chars are policy ID
  if (assetStr.length >= 56) {
    return {
      policyId: assetStr.slice(0, 56),
      tokenName: assetStr.slice(56),
    };
  }

  throw new Error(`Invalid asset format: ${assetStr}. Use 'ADA' or 'policyId.tokenName'`);
}

function calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut) {
  // Price impact = (1 - (amountOut / amountIn) / (reserveOut / reserveIn)) * 100
  const spotPrice = Number(reserveOut) / Number(reserveIn);
  const executionPrice = Number(amountOut) / Number(amountIn);
  const impact = (1 - executionPrice / spotPrice) * 100;
  return Math.abs(impact);
}

function convertUtxosToLucidFormat(utxos) {
  // Convert frontend UTxO format to Lucid format
  return utxos.map(utxo => ({
    txHash: utxo.txHash || utxo.tx_hash,
    outputIndex: utxo.outputIndex ?? utxo.tx_index ?? utxo.output_index,
    assets: utxo.assets || convertAmountToAssets(utxo.amount),
    address: utxo.address,
    datumHash: utxo.datumHash || utxo.datum_hash || null,
    datum: utxo.datum || null,
    scriptRef: utxo.scriptRef || null,
  }));
}

function convertAmountToAssets(amount) {
  if (!amount || !Array.isArray(amount)) return { lovelace: 0n };
  
  const assets = {};
  for (const a of amount) {
    if (a.unit === "lovelace") {
      assets.lovelace = BigInt(a.quantity);
    } else {
      assets[a.unit] = BigInt(a.quantity);
    }
  }
  return assets;
}

module.exports = router;
