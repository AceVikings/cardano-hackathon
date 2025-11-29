const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  REFRESH_TOKEN_EXPIRES_MS,
} = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/auth/nonce
 * Get or generate a nonce for wallet signature
 */
router.post('/nonce', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    // Find or create user
    let user = await User.findOne({ walletAddress });
    
    if (!user) {
      user = new User({ 
        walletAddress,
        nonce: '', // Will be generated
      });
    }

    // Generate new nonce
    const nonce = user.generateNonce();
    await user.save();

    res.json({
      success: true,
      nonce,
    });
  } catch (error) {
    console.error('Nonce generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate nonce',
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify wallet signature and issue tokens
 */
router.post('/verify', async (req, res) => {
  try {
    const { walletAddress, signature, key } = req.body;
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!walletAddress || !signature || !key) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address, signature, and key are required',
      });
    }

    // Find user
    const user = await User.findOne({ walletAddress });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found. Please request a nonce first.',
      });
    }

    // In production, you would verify the signature using the Cardano message signing protocol
    // For now, we'll check that a signature was provided
    // TODO: Implement proper CIP-8 signature verification
    // The signature object from MeshSDK contains { signature, key }
    // You can use @meshsdk/core or @emurgo/cardano-message-signing-asmjs for verification
    
    // For demo purposes, we accept any signature
    // In production, verify like this:
    // const isValid = verifySignature(user.nonce, signature, key, walletAddress);
    const isValid = signature && key;

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
      });
    }

    // Clean up expired tokens
    user.cleanupExpiredTokens();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshTokenData = generateRefreshToken(user);

    // Store refresh token
    user.refreshTokens.push({
      token: refreshTokenData.token,
      expiresAt: refreshTokenData.expiresAt,
      userAgent,
    });

    // Update last login
    user.lastLogin = new Date();
    
    // Generate new nonce to prevent replay attacks
    user.generateNonce();
    
    await user.save();

    res.json({
      success: true,
      accessToken,
      refreshToken: refreshTokenData.token,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        profile: user.profile,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
        code: 'NO_REFRESH_TOKEN',
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Check if refresh token exists in user's tokens
    const tokenIndex = user.refreshTokens.findIndex(rt => rt.token === refreshToken);
    
    if (tokenIndex === -1) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token not found or revoked',
        code: 'TOKEN_REVOKED',
      });
    }

    // Check if token is expired
    if (user.refreshTokens[tokenIndex].expiresAt < new Date()) {
      user.refreshTokens.splice(tokenIndex, 1);
      await user.save();
      
      return res.status(401).json({
        success: false,
        error: 'Refresh token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    // Remove old refresh token (token rotation)
    user.refreshTokens.splice(tokenIndex, 1);
    user.cleanupExpiredTokens();

    // Generate new tokens
    const accessToken = generateAccessToken(user);
    const newRefreshTokenData = generateRefreshToken(user);

    // Store new refresh token
    user.refreshTokens.push({
      token: newRefreshTokenData.token,
      expiresAt: newRefreshTokenData.expiresAt,
      userAgent,
    });

    await user.save();

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshTokenData.token,
      expiresIn: 15 * 60, // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
    });
  }
});

/**
 * POST /api/auth/logout
 * Revoke refresh token
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken, logoutAll } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (logoutAll) {
      // Revoke all refresh tokens (logout from all devices)
      user.revokeAllTokens();
    } else if (refreshToken) {
      // Revoke specific refresh token
      user.revokeToken(refreshToken);
    }

    await user.save();

    res.json({
      success: true,
      message: logoutAll ? 'Logged out from all devices' : 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        walletAddress: req.user.walletAddress,
        stakeAddress: req.user.stakeAddress,
        profile: req.user.profile,
        settings: req.user.settings,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info',
    });
  }
});

/**
 * PATCH /api/auth/profile
 * Update user profile
 */
router.patch('/profile', authenticate, async (req, res) => {
  try {
    const { displayName, avatar } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (displayName !== undefined) {
      user.profile.displayName = displayName;
    }
    if (avatar !== undefined) {
      user.profile.avatar = avatar;
    }

    await user.save();

    res.json({
      success: true,
      profile: user.profile,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
    });
  }
});

/**
 * GET /api/auth/sessions
 * Get active sessions (refresh tokens)
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    user.cleanupExpiredTokens();
    await user.save();

    const sessions = user.refreshTokens.map(rt => ({
      createdAt: rt.createdAt,
      expiresAt: rt.expiresAt,
      userAgent: rt.userAgent,
    }));

    res.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions',
    });
  }
});

module.exports = router;
