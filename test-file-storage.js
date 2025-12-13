// Test file-based storage by temporarily disabling MongoDB

// Backup the original environment variable
const originalMongoURI = process.env.MONGODB_URI;

// Temporarily remove the MongoDB URI to force file-based storage
delete process.env.MONGODB_URI;

// Import and run the server code to test file-based storage
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Simple test of file-based storage
const testData = {
    id: uuidv4().substring(0, 8),
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    name: 'File Storage Test',
    email: 'file@test.com',
    message: 'Testing file-based storage'
};

// Test data for different collections
const testCollections = [
    { name: 'bookings', file: 'data/bookings.json' },
    { name: 'contacts', file: 'data/contacts.json' },
    { name: 'testimonials', file: 'data/testimonials.json' }
];

console.log('Testing file-based storage...');

testCollections.forEach(collection => {
    // Read existing data
    let data = [];
    if (fs.existsSync(collection.file)) {
        try {
            const fileData = fs.readFileSync(collection.file, 'utf8');
            data = JSON.parse(fileData);
            if (!Array.isArray(data)) {
                data = [];
            }
        } catch (err) {
            data = [];
        }
    }
    
    // Add test data
    data.push({
        ...testData,
        collection: collection.name,
        testId: uuidv4().substring(0, 4)
    });
    
    // Save data to file
    try {
        // Ensure directory exists
        const dir = require('path').dirname(collection.file);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(collection.file, JSON.stringify(data, null, 2));
        console.log(`✓ Successfully saved test data to ${collection.file}`);
    } catch (err) {
        console.error(`✗ Error saving to ${collection.file}:`, err.message);
    }
});

console.log('File-based storage test completed.');

// Restore the original environment variable
if (originalMongoURI) {
    process.env.MONGODB_URI = originalMongoURI;
}