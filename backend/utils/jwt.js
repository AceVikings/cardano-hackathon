const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';

// Access token expires in 15 minutes
const ACCESS_TOKEN_EXPIRES = '15m';
// Refresh token expires in 7 days
const REFRESH_TOKEN_EXPIRES = '7d';
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate an access token for a user
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      walletAddress: user.walletAddress,
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

/**
 * Generate a refresh token for a user
 */
function generateRefreshToken(user) {
  const tokenId = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    {
      userId: user._id,
      tokenId,
      type: 'refresh',
    },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
  
  return {
    token,
    tokenId,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
  };
}

/**
 * Verify an access token
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Verify a refresh token
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Decode token without verification (for getting expiry info)
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES_MS,
};
