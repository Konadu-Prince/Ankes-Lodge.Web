const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testBooking() {
    try {
        const response = await fetch('http://localhost:8000/process-booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'Test User',
                email: 'test@example.com',
                phone: '0241234567',
                checkin: '2025-12-20',
                checkout: '2025-12-25',
                adults: '2',
                children: '1',
                'room-type': 'executive',
                message: 'This is a test booking.'
            })
        });

        const result = await response.json();
        console.log('Booking response:', result);
    } catch (error) {
        console.error('Error testing booking:', error);
    }
}

testBooking();