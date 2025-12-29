require('dotenv').config();
const axios = require('axios');

async function testPaystackAPI() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    
    console.log('Testing direct Paystack API access...');
    console.log('Secret key configured:', !!secretKey);
    
    try {
        // Test with a simple API call to get banks
        const response = await axios.get('https://api.paystack.co/bank', {
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Paystack API connection successful!');
        console.log('Response status:', response.status);
        console.log('Number of banks returned:', response.data.data.length);
        
        // Now test the payment initialization function directly
        console.log('\nTesting payment initialization function...');
        
        // Dynamically import the server to test the function
        const { initializePaystackPayment } = require('./server.js');
        
        console.log('❌ Cannot directly import function from server.js as it starts the server');
        console.log('This is expected since server.js starts a server when required');
        
    } catch (error) {
        console.log('❌ Paystack API test failed:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

testPaystackAPI();