const http = require('http');

// Simulate frontend FormData submission
function simulateFrontendSubmission() {
    console.log('Simulating frontend FormData submission...\n');
    
    // Form data as it would be sent by the frontend
    const formData = [
        'name=John Doe',
        'email=johndoe@example.com',
        'phone=0544904547',
        'checkin=2025-12-01',
        'checkout=2025-12-05',
        'adults=2',
        'children=1',
        'room-type=executive',
        'message=Test booking for debugging purposes'
    ].join('&');
    
    const options = {
        hostname: 'localhost',
        port: 8001,
        path: '/process-booking',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(formData)
        }
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('Response status code:', res.statusCode);
            console.log('Response headers:', res.headers);
            console.log('Response body:', data);
            
            try {
                const jsonResponse = JSON.parse(data);
                console.log('Parsed JSON response:', jsonResponse);
            } catch (e) {
                console.log('Response is not valid JSON');
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('Request error:', error);
    });
    
    req.write(formData);
    req.end();
}

simulateFrontendSubmission();