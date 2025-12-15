const fs = require('fs');

// Test booking data that should pass validation
const testBooking = {
    name: 'John Doe',
    email: 'johndoe@example.com',
    phone: '0544904547', // Valid Ghana phone format
    checkin: '2025-12-01',
    checkout: '2025-12-05',
    adults: '2',
    children: '1',
    'room-type': 'executive',
    message: 'Test booking for debugging purposes'
};

// Test the Node.js endpoint
async function testNodeJSEndpoint() {
    console.log('Testing Node.js endpoint (/process-booking)...');
    
    try {
        const response = await fetch('http://localhost:8001/process-booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(testBooking)
        });
        
        const result = await response.json();
        console.log('Node.js Response:', result);
        
        // Check bookings file
        if (fs.existsSync('bookings.json')) {
            const bookingsData = fs.readFileSync('bookings.json', 'utf8');
            const bookings = JSON.parse(bookingsData);
            console.log(`Total bookings in file: ${bookings.length}`);
            console.log('Last booking:', bookings[bookings.length - 1]);
        }
    } catch (error) {
        console.error('Node.js Endpoint Error:', error);
    }
}

// Test the PHP endpoint
async function testPHPEndpoint() {
    console.log('\nTesting PHP endpoint (/booking-handler.php)...');
    
    try {
        const response = await fetch('http://localhost:8001/booking-handler.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(testBooking)
        });
        
        const result = await response.json();
        console.log('PHP Response:', result);
    } catch (error) {
        console.error('PHP Endpoint Error:', error);
    }
}

// Run tests
async function runTests() {
    await testNodeJSEndpoint();
    await testPHPEndpoint();
}

runTests();