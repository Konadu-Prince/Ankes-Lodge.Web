const axios = require('axios');
require('dotenv').config();

// Test Paystack integration
async function testPaystack() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    
    if (!secretKey || secretKey.includes('your_secret_key_here')) {
        console.log('❌ Paystack Secret Key is not properly configured');
        console.log('Please update PAYSTACK_SECRET_KEY in your .env file with a valid Paystack test secret key');
        return;
    }
    
    // Check if using default test credentials (not ideal for production but works for testing)
    const isDefaultTestKey = secretKey === 'sk_test_0bfb02f4cc0a5b6ab1a7a140834e642701081dd4';
    if (isDefaultTestKey) {
        console.log('⚠️  Using default test credentials - please update with your actual Paystack test keys for production');
    }
    
    
    try {
        console.log('Testing Paystack API connectivity...');
        
        // Test by making a simple request to Paystack API
        const response = await axios.get('https://api.paystack.co/bank', {
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 200) {
            console.log('✅ Paystack API connection successful!');
            console.log('✅ Paystack credentials are valid');
        } else {
            console.log('❌ Paystack API connection failed');
            console.log('Status:', response.status);
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log('❌ Invalid Paystack Secret Key - Authentication failed');
            console.log('Please verify your PAYSTACK_SECRET_KEY in the .env file');
        } else if (error.response && error.response.status === 403) {
            console.log('❌ Forbidden - Check your Paystack Secret Key');
        } else {
            console.log('❌ Error connecting to Paystack API:', error.message);
        }
    }
    
    // Test webhook secret format
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.includes('your_webhook_secret_here') || webhookSecret === 'whsec_test_secret_key_for_verification') {
        console.log('⚠️  Webhook secret needs to be updated for production');
    } else {
        console.log('✅ Webhook secret is configured');
    }
    
    // Test public key format
    const publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    if (!publicKey || publicKey.includes('your_public_key_here') || publicKey === 'pk_test_2f8b789a273031097bef5cbebcd101a9bc51e5f2') {
        console.log('⚠️  Public key needs to be updated for production');
    } else {
        console.log('✅ Public key is configured');
    }
}

// Run the test
testPaystack().then(() => {
    console.log('\nPaystack integration test completed');
});