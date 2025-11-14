const http = require('http');
const fs = require('fs');

// Test data
const validBooking = {
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '0544904547',
    checkin: '2025-12-01',
    checkout: '2025-12-05',
    adults: '2',
    children: '1',
    'room-type': 'executive',
    message: 'This is a test booking'
};

const invalidBooking = {
    name: '', // Missing required field
    email: 'invalid-email', // Invalid email
    phone: '123', // Invalid phone
    checkin: '2020-01-01', // Past date
    checkout: '2019-12-01', // Before checkin
    adults: '0', // Invalid number
    children: '15', // Too many children
    'room-type': 'invalid', // Invalid room type
    message: '' // Empty message
};

// Function to send POST request
function sendPostRequest(data, callback) {
    const postData = new URLSearchParams(data).toString();
    
    const options = {
        hostname: 'localhost',
        port: 8000,
        path: '/process-booking',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
            responseBody += chunk;
        });
        
        res.on('end', () => {
            callback(null, {
                statusCode: res.statusCode,
                headers: res.headers,
                body: responseBody
            });
        });
    });

    req.on('error', (e) => {
        callback(e, null);
    });

    req.write(postData);
    req.end();
}

// Test valid booking
console.log('Testing valid booking...');
sendPostRequest(validBooking, (error, response) => {
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Valid booking test - Status:', response.statusCode);
        console.log('Response:', response.body);
    }
    
    // Test invalid booking
    console.log('\nTesting invalid booking...');
    sendPostRequest(invalidBooking, (error, response) => {
        if (error) {
            console.error('Error:', error);
        } else {
            console.log('Invalid booking test - Status:', response.statusCode);
            console.log('Response:', response.body);
        }
        
        // Test rate limiting (send multiple requests)
        console.log('\nTesting rate limiting...');
        let completed = 0;
        const totalRequests = 7;
        
        for (let i = 0; i < totalRequests; i++) {
            setTimeout(() => {
                sendPostRequest(validBooking, (error, response) => {
                    completed++;
                    console.log(`Request ${completed}/${totalRequests} - Status: ${response ? response.statusCode : 'Error'}`);
                    
                    if (completed === totalRequests) {
                        console.log('\nAll tests completed!');
                        console.log('Check bookings.json to verify successful bookings were saved.');
                    }
                });
            }, i * 100); // Stagger requests
        }
    });
});