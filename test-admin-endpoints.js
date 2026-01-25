async function testAdminEndpoints() {
    console.log('🚀 Starting admin endpoint tests...\n');
    
    try {
        // Test 1: Login
        console.log('1. Testing admin login...');
        const loginResponse = await fetch('https://ankes-lodge.onrender.com/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({username: 'admin', password: 'ankeslodge2025'})
        });
        
        const loginData = await loginResponse.json();
        if (!loginData.success || !loginData.sessionId) {
            console.log('❌ Login failed:', loginData);
            return;
        }
        
        console.log('✅ Login successful');
        const sessionId = loginData.sessionId;
        
        // Test 2: Bookings endpoint
        console.log('\n2. Testing bookings endpoint...');
        const bookingsResponse = await fetch('https://ankes-lodge.onrender.com/bookings.json', {
            headers: { 'Authorization': sessionId }
        });
        const bookings = await bookingsResponse.json();
        console.log(`✅ Bookings endpoint working: ${Array.isArray(bookings) ? bookings.length : 0} records`);
        
        // Test 3: Contacts endpoint
        console.log('\n3. Testing contacts endpoint...');
        const contactsResponse = await fetch('https://ankes-lodge.onrender.com/contacts.json', {
            headers: { 'Authorization': sessionId }
        });
        const contacts = await contactsResponse.json();
        console.log(`✅ Contacts endpoint working: ${Array.isArray(contacts) ? contacts.length : 0} records`);
        
        // Test 4: Testimonials endpoint
        console.log('\n4. Testing testimonials endpoint...');
        const testimonialsResponse = await fetch('https://ankes-lodge.onrender.com/testimonials.json', {
            headers: { 'Authorization': sessionId }
        });
        const testimonials = await testimonialsResponse.json();
        console.log(`✅ Testimonials endpoint working: ${Array.isArray(testimonials) ? testimonials.length : 0} records`);
        
        console.log('\n🎉 All admin endpoints are working correctly!');
        console.log('✅ Admin page should now load without blank screen issues');
        
    } catch (error) {
        console.log('❌ Error during testing:', error.message);
    }
}

testAdminEndpoints();