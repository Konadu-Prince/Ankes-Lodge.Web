const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function runComprehensiveTest() {
    console.log('Running comprehensive test of all endpoints...\n');
    
    // Test 1: Booking submission
    console.log('Test 1: Booking submission');
    try {
        const bookingResponse = await fetch('http://localhost:8000/process-booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'Comprehensive Test User',
                email: 'comprehensive@test.com',
                phone: '0241234567',
                checkin: '2025-12-25',
                checkout: '2025-12-30',
                adults: '2',
                children: '0',
                'room-type': 'executive',
                message: 'Comprehensive test booking.'
            })
        });

        const bookingResult = await bookingResponse.json();
        console.log('✓ Booking response:', bookingResult.status);
        console.log('  Booking ID:', bookingResult.bookingId);
    } catch (error) {
        console.error('✗ Error in booking test:', error.message);
    }
    
    // Test 2: Contact submission
    console.log('\nTest 2: Contact submission');
    try {
        const contactResponse = await fetch('http://localhost:8000/process-contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                'contact-name': 'Comprehensive Test Contact',
                'contact-email': 'contact-comprehensive@test.com',
                'subject': 'Comprehensive Test Subject',
                'contact-message': 'This is a comprehensive test contact message.'
            })
        });

        const contactResult = await contactResponse.json();
        console.log('✓ Contact response:', contactResult.status);
    } catch (error) {
        console.error('✗ Error in contact test:', error.message);
    }
    
    // Test 3: Testimonial submission
    console.log('\nTest 3: Testimonial submission');
    try {
        const testimonialResponse = await fetch('http://localhost:8000/add-testimonial', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'Comprehensive Test User',
                location: 'Test City',
                comment: 'Comprehensive test testimonial. Excellent service!',
                rating: '5'
            })
        });

        const testimonialResult = await testimonialResponse.json();
        console.log('✓ Testimonial response:', testimonialResult.status);
        console.log('  Testimonial ID:', testimonialResult.testimonial.id);
    } catch (error) {
        console.error('✗ Error in testimonial test:', error.message);
    }
    
    // Test 4: Visitor count
    console.log('\nTest 4: Visitor count');
    try {
        const visitorResponse = await fetch('http://localhost:8000/visitor-count');
        const visitorResult = await visitorResponse.json();
        console.log('✓ Visitor count response:', visitorResult.count);
    } catch (error) {
        console.error('✗ Error in visitor count test:', error.message);
    }
    
    // Test 5: Health check
    console.log('\nTest 5: Health check');
    try {
        const healthResponse = await fetch('http://localhost:8000/health');
        const healthResult = await healthResponse.json();
        console.log('✓ Health check response:', healthResult.status);
        console.log('  Uptime:', Math.round(healthResult.uptime) + ' seconds');
    } catch (error) {
        console.error('✗ Error in health check test:', error.message);
    }
    
    console.log('\nComprehensive test completed!');
}

runComprehensiveTest();