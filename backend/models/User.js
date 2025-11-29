const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  stakeAddress: {
    type: String,
    index: true,
  },
  nonce: {
    type: String,
    required: true,
  },
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: Date,
    userAgent: String,
  }],
  profile: {
    displayName: String,
    avatar: String,
  },
  settings: {
    notifications: {
      type: Boolean,
      default: true,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  // Custodial wallet information
  custodialWallet: {
    // Whether the user has initialized their custodial wallet
    initialized: {
      type: Boolean,
      default: false,
    },
    // The script address where user's funds are held
    scriptAddress: String,
    // User's payment key hash (derived from wallet)
    ownerPkh: String,
    // List of approved agent PKHs
    approvedAgents: [{
      pkh: String,
      name: String,
      addedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    // Track deposits for display (actual balance comes from chain)
    lastKnownBalance: {
      lovelace: {
        type: String,
        default: '0',
      },
      tokens: [{
        unit: String,
        quantity: String,
      }],
    },
    // Last time balance was checked
    lastBalanceCheck: Date,
  },
});

// Update timestamp on save
userSchema.pre('save', function() {
  this.updatedAt = new Date();
});

// Generate a random nonce for wallet signature
userSchema.methods.generateNonce = function() {
  this.nonce = `AdaFlow Authentication: ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  return this.nonce;
};

// Clean up expired refresh tokens
userSchema.methods.cleanupExpiredTokens = function() {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter(rt => rt.expiresAt > now);
};

// Revoke a specific refresh token
userSchema.methods.revokeToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
};

// Revoke all refresh tokens (logout from all devices)
userSchema.methods.revokeAllTokens = function() {
  this.refreshTokens = [];
};

module.exports = mongoose.model('User', userSchema);
