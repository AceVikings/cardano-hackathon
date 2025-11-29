const mongoose = require('mongoose');

async function dropIndex() {
  try {
    await mongoose.connect('mongodb://localhost:27017/test');
    const db = mongoose.connection.db;
    await db.collection('users').dropIndex({ walletAddress: 1 });
    console.log('Index dropped successfully');
  } catch (error) {
    console.error('Error dropping index:', error);
  } finally {
    await mongoose.disconnect();
  }
}

dropIndex();