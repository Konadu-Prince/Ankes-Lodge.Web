const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testTestimonial() {
    try {
        const response = await fetch('http://localhost:8000/add-testimonial', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'Test User',
                location: 'Test Location',
                comment: 'This is a great lodge! Highly recommended.',
                rating: '5'
            })
        });

        const result = await response.json();
        console.log('Testimonial response:', result);
    } catch (error) {
        console.error('Error testing testimonial:', error);
    }
}

testTestimonial();