const { MongoClient } = require('mongodb');
require('dotenv').config();

async function queryDatabase() {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
        console.log('MONGODB_URI not found in environment variables');
        return;
    }
    
    const client = new MongoClient(uri);
    
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB Atlas');
        
        // Get the database
        const db = client.db('ankes-lodge');
        
        // Query all collections
        const collections = ['bookings', 'contacts', 'testimonials', 'visitorCounter'];
        
        for (const collectionName of collections) {
            console.log(`\n=== ${collectionName.toUpperCase()} ===`);
            try {
                const collection = db.collection(collectionName);
                const documents = await collection.find({}).toArray();
                
                if (documents.length === 0) {
                    console.log('No documents found');
                    
                    // For visitorCounter, let's also check if it's a different structure
                    if (collectionName === 'visitorCounter') {
                        console.log('Checking for visitor counter data in different format...');
                        // Check if there's a single document with a count field
                        const counterDoc = await collection.findOne({});
                        if (counterDoc) {
                            console.log('Found visitor counter document:');
                            console.log(JSON.stringify(counterDoc, null, 2));
                        }
                    }
                } else {
                    console.log(`Found ${documents.length} document(s):`);
                    documents.forEach((doc, index) => {
                        console.log(`\nDocument ${index + 1}:`);
                        console.log(JSON.stringify(doc, null, 2));
                    });
                }
            } catch (err) {
                console.log(`Error querying ${collectionName}:`, err.message);
            }
        }
        
        // Also check the actual collection names in the database
        console.log('\n=== DATABASE COLLECTIONS ===');
        const collectionsList = await db.listCollections().toArray();
        console.log('Available collections:');
        collectionsList.forEach(collection => {
            console.log(`- ${collection.name}`);
        });
        
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    } finally {
        await client.close();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the query
queryDatabase();