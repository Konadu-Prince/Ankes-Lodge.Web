const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testMongoConnection() {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
        console.log('❌ MONGODB_URI not found in environment variables');
        console.log('Please set the MONGODB_URI environment variable with your MongoDB connection string.');
        return;
    }
    
    console.log('🔍 Testing MongoDB connection...');
    console.log(`URI: ${uri.substring(0, 30)}...`);
    
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB Atlas successfully!');
        
        const db = client.db('ankes-lodge');
        console.log(`✅ Database 'ankes-lodge' accessed successfully!`);
        
        // List collections
        const collections = await db.listCollections().toArray();
        console.log(`📋 Collections in database: ${collections.map(c => c.name).join(', ')}`);
        
        await client.close();
        console.log('🔒 Disconnected from MongoDB');
        
    } catch (error) {
        console.log('❌ Failed to connect to MongoDB Atlas');
        console.log(`Error: ${error.message}`);
        console.log('\nTroubleshooting tips:');
        console.log('1. Check that your MONGODB_URI is correct');
        console.log('2. Ensure your IP address is whitelisted in MongoDB Atlas');
        console.log('3. Verify your database user credentials');
        console.log('4. Check your internet connection');
    }
}

testMongoConnection();