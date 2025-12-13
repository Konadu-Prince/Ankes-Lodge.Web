const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testContact() {
    try {
        const response = await fetch('http://localhost:8000/process-contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                'contact-name': 'Test Contact',
                'contact-email': 'contact@test.com',
                'subject': 'Test Subject',
                'contact-message': 'This is a test contact message.'
            })
        });

        const result = await response.json();
        console.log('Contact response:', result);
    } catch (error) {
        console.error('Error testing contact:', error);
    }
}

testContact();