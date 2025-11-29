const { verifyIdToken } = require('../config/firebase');
const User = require('../models/User');

/**
 * Firebase Authentication middleware
 * Verifies Firebase ID token from Authorization header
 * Creates user in database if they don't exist
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN',
      });
    }

    const idToken = authHeader.split(' ')[1];
    
    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

    // Find or create user in database
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // Create new user from Firebase data
      user = new User({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || null,
        displayName: decodedToken.name || decodedToken.email?.split('@')[0] || null,
        photoURL: decodedToken.picture || null,
        emailVerified: decodedToken.email_verified || false,
        authProvider: decodedToken.firebase?.sign_in_provider || 'unknown',
      });
      
      await user.save();
      console.log('Created new user from Firebase:', user.firebaseUid);
    } else {
      // Update user info if changed
      let needsUpdate = false;
      
      if (decodedToken.email && user.email !== decodedToken.email) {
        user.email = decodedToken.email;
        needsUpdate = true;
      }
      if (decodedToken.name && user.displayName !== decodedToken.name) {
        user.displayName = decodedToken.name;
        needsUpdate = true;
      }
      if (decodedToken.picture && user.photoURL !== decodedToken.picture) {
        user.photoURL = decodedToken.picture;
        needsUpdate = true;
      }
      if (decodedToken.email_verified !== undefined && user.emailVerified !== decodedToken.email_verified) {
        user.emailVerified = decodedToken.email_verified;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        user.lastLogin = new Date();
        await user.save();
      }
    }

    // Attach user and Firebase data to request
    req.user = user;
    req.firebaseUser = decodedToken;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Optional Firebase authentication middleware
 * Attaches user if token is valid, but doesn't block if not
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split(' ')[1];
      
      try {
        const decodedToken = await verifyIdToken(idToken);
        const user = await User.findOne({ firebaseUid: decodedToken.uid });
        
        if (user) {
          req.user = user;
          req.firebaseUser = decodedToken;
          req.userId = user._id.toString();
        }
      } catch (error) {
        // Token invalid, continue without auth
        console.log('Optional auth: token invalid');
      }
    }

    next();
  } catch (error) {
    // Continue without auth for optional middleware
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuth,
};
