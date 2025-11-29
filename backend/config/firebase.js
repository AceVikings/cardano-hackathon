const admin = require('firebase-admin');
const path = require('path');

// Path to service account key file
const serviceAccountPath = path.join(__dirname, '..', 'cardano-hackathon-3ef1a-firebase-adminsdk-fbsvc-e3fc8df573.json');

// Initialize Firebase Admin
let firebaseAdmin;

try {
  const serviceAccount = require(serviceAccountPath);
  
  firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
  // Initialize with default credentials for development/testing
  firebaseAdmin = admin.initializeApp();
}

const auth = admin.auth();

/**
 * Verify Firebase ID token
 * @param {string} idToken - The Firebase ID token from the client
 * @returns {Promise<admin.auth.DecodedIdToken>} The decoded token
 */
async function verifyIdToken(idToken) {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying ID token:', error.message);
    throw error;
  }
}

/**
 * Get Firebase user by UID
 * @param {string} uid - The Firebase user UID
 * @returns {Promise<admin.auth.UserRecord>} The user record
 */
async function getUser(uid) {
  try {
    const userRecord = await auth.getUser(uid);
    return userRecord;
  } catch (error) {
    console.error('Error getting user:', error.message);
    throw error;
  }
}

module.exports = {
  admin,
  auth,
  verifyIdToken,
  getUser,
};
