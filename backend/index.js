const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// Routes
const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");
const workflowRoutes = require("./routes/workflows");
const swapRoutes = require("./routes/swap");

const app = express();
const PORT = process.env.PORT || 5001;

// CORS middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Body parser
app.use(express.json());
app.use(cookieParser());

// Request logging (development)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/swap", swapRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Available triggers endpoint
app.get("/api/available-triggers", (req, res) => {
  const triggers = [
    {
      id: "manual",
      type: "manual",
      name: "Manual Trigger",
      description: "Execute workflow manually with a button click",
      icon: "play",
      color: "green",
      configSchema: [],
    },
    {
      id: "cron",
      type: "cron",
      name: "Scheduled (Cron)",
      description: "Run workflow on a recurring time schedule",
      icon: "clock",
      color: "violet",
      configSchema: [
        {
          name: "cronExpression",
          type: "string",
          description:
            "Cron expression (e.g., '*/5 * * * *' for every 5 minutes)",
          required: true,
          default: "0 * * * *",
          presets: [
            { label: "Every 5 minutes", value: "*/5 * * * *" },
            { label: "Every 15 minutes", value: "*/15 * * * *" },
            { label: "Every 30 minutes", value: "*/30 * * * *" },
            { label: "Every hour", value: "0 * * * *" },
            { label: "Every day at midnight", value: "0 0 * * *" },
            { label: "Every week on Monday", value: "0 0 * * 1" },
          ],
        },
      ],
    },
    {
      id: "price_gte",
      type: "price_gte",
      name: "Price ≥ Target",
      description: "Trigger when a token price rises above or equals target",
      icon: "trending-up",
      color: "blue",
      configSchema: [
        {
          name: "token",
          type: "string",
          description: "The token to monitor (e.g., ADA, MIN)",
          required: true,
        },
        {
          name: "targetPrice",
          type: "number",
          description: "The target price threshold in USD",
          required: true,
        },
      ],
    },
    {
      id: "price_lte",
      type: "price_lte",
      name: "Price ≤ Target",
      description: "Trigger when a token price falls below or equals target",
      icon: "trending-down",
      color: "orange",
      configSchema: [
        {
          name: "token",
          type: "string",
          description: "The token to monitor (e.g., ADA, MIN)",
          required: true,
        },
        {
          name: "targetPrice",
          type: "number",
          description: "The target price threshold in USD",
          required: true,
        },
      ],
    },
    {
      id: "wallet_receive",
      type: "wallet_receive",
      name: "Wallet Received",
      description: "Trigger when your wallet receives tokens",
      icon: "download",
      color: "emerald",
      configSchema: [
        {
          name: "minAmount",
          type: "number",
          description: "Minimum amount to trigger (optional)",
          required: false,
        },
        {
          name: "tokenFilter",
          type: "string",
          description:
            "Only trigger for specific token (optional, leave empty for any)",
          required: false,
        },
      ],
    },
    {
      id: "webhook",
      type: "webhook",
      name: "Webhook",
      description: "Trigger via external HTTP webhook call",
      icon: "webhook",
      color: "purple",
      configSchema: [],
    },
  ];
  res.json({ triggers });
});

// Available agents endpoint
app.get("/api/available-agents", (req, res) => {
  const agents = [
    {
      id: "swap-token-agent",
      name: "Swap Token Agent",
      description:
        "Agent for generating token swap transactions on Cardano using Minswap DEX",
      invokeUrl: "/api/agents/swap-token-agent/invoke",
      executionCost: "1 ADA",
      inputParameters: [
        {
          name: "fromToken",
          type: "string",
          description: "The token to swap from (e.g., ADA)",
        },
        {
          name: "toToken",
          type: "string",
          description: "The token to swap to (e.g., MIN)",
        },
        {
          name: "totalAmount",
          type: "number",
          description: "The total amount of fromToken to swap",
        },
      ],
      output: {
        name: "toTokenAmount",
        type: "number",
        description: "The estimated amount of toToken received",
      },
    },
    {
      id: "conversation-agent",
      url: "http://139.84.155.199:8000",
      name: "Conversation Agent",
      description:
        "Agent for processing conversational input and generating responses",
      invokeUrl: "/api/agents/conversation-agent/invoke",
      executionCost: "1 ADA",
      inputParameters: [
        {
          name: "inputText",
          type: "string",
          description: "The input text for conversation processing",
        },
      ],
      output: {
        name: "outputText",
        type: "string",
        description: "The generated conversational response",
      },
    },
      {
        id: "research-agent",
        url: "http://localhost:8100",
        name: "Research Agent",
        description:
          "Agent for performing web research, summarization, and data extraction",
        invokeUrl: "/api/agents/research-agent/invoke",
        executionCost: "1 ADA",
        inputParameters: [
          {
            name: "query",
            type: "string",
            description: "Search or research query to investigate",
          },
          {
            name: "maxResults",
            type: "number",
            description: "Maximum number of sources or results to return (optional)",
            required: false,
          },
        ],
        output: {
          name: "summary",
          type: "string",
          description: "Concise summary of findings",
        },
      },
      {
        id: "telegram-bot-agent",
        url: "http://localhost:8200",
        name: "Telegram Bot Agent",
        description:
          "Agent that integrates with Telegram to receive commands and send notifications",
        invokeUrl: "/api/agents/telegram-bot-agent/invoke",
        executionCost: "0.5 ADA",
        inputParameters: [
          {
            name: "chatId",
            type: "string",
            description: "Telegram chat identifier to send messages to",
          },
          {
            name: "message",
            type: "string",
            description: "Message content to send",
          },
        ],
        output: {
          name: "status",
          type: "string",
          description: "Result status (e.g., sent, failed)",
        },
      },
  ];
  res.json({ agents });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
