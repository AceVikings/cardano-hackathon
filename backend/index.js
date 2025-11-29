const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// Routes
const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");

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
  .connect(process.env.MONGODB_URI || "mongodb://root:example@localhost:27017/")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Available agents endpoint
app.get("/api/available-agents", (req, res) => {
  const agents = [
    {
      name: "Swap Token Agent",
      description:
        "Agent for generating token swap transactions on Cardano using Minswap DEX",
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
