const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/auth/me
 * Get current user info (requires Firebase auth)
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        firebaseUid: req.user.firebaseUid,
        email: req.user.email,
        displayName: req.user.displayName,
        photoURL: req.user.photoURL,
        emailVerified: req.user.emailVerified,
        authProvider: req.user.authProvider,
        settings: req.user.settings,
        createdAt: req.user.createdAt,
        lastLogin: req.user.lastLogin,
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
    const { displayName } = req.body;
    const user = req.user;

    if (displayName !== undefined) {
      user.displayName = displayName;
    }

    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
      },
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
 * PATCH /api/auth/settings
 * Update user settings
 */
router.patch('/settings', authenticate, async (req, res) => {
  try {
    const { notifications } = req.body;
    const user = req.user;

    if (notifications !== undefined) {
      user.settings.notifications = notifications;
    }

    await user.save();

    res.json({
      success: true,
      settings: user.settings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    });
  }
});

/**
 * DELETE /api/auth/account
 * Delete user account (soft delete - removes from our DB, not Firebase)
 */
router.delete('/account', authenticate, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account',
    });
  }
});

module.exports = router;
