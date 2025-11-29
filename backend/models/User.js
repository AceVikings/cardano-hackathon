const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Firebase UID - primary identifier
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // Firebase user data
  email: {
    type: String,
    sparse: true,
    index: true,
  },
  displayName: String,
  photoURL: String,
  emailVerified: {
    type: Boolean,
    default: false,
  },
  authProvider: {
    type: String,
    enum: ['password', 'google.com', 'unknown'],
    default: 'unknown',
  },
  // User settings
  settings: {
    notifications: {
      type: Boolean,
      default: true,
    },
  },
  // Timestamps
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
    // User's payment key hash (derived from connected Cardano wallet)
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

// Virtual for formatted user data
userSchema.virtual('formattedUser').get(function() {
  return {
    id: this._id,
    firebaseUid: this.firebaseUid,
    email: this.email,
    displayName: this.displayName,
    photoURL: this.photoURL,
    emailVerified: this.emailVerified,
    authProvider: this.authProvider,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
});

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
