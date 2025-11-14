// Test script to submit a booking
const fetch = require('node-fetch');

const testBooking = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '1234567890',
    checkin: '2025-12-01',
    checkout: '2025-12-05',
    adults: '2',
    children: '1',
    'room-type': 'executive',
    message: 'This is a test booking'
};

fetch('http://localhost:63594/process-booking', {
    method: 'POST',
    body: new URLSearchParams(testBooking),
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
})
.then(response => response.json())
.then(data => {
    console.log('Booking response:', data);
})
.catch(error => {
    console.error('Error:', error);
});