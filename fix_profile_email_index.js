const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vtuberverse';

async function fixProfileEmailIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    console.log('Dropping existing profile_email index...');
    try {
      await collection.dropIndex('profile_email_1');
      console.log('Dropped existing profile_email index');
    } catch (error) {
      console.log('No existing profile_email index to drop');
    }

    console.log('Creating new sparse profile_email index...');
    await collection.createIndex(
      { profile_email: 1 }, 
      { 
        unique: true, 
        sparse: true,
        name: 'profile_email_1'
      }
    );
    console.log('Created new sparse profile_email index');

    console.log('Index fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing index:', error);
    process.exit(1);
  }
}

fixProfileEmailIndex(); 