const fs = require('fs');

// Test booking data with the new email address
const testBooking = {
    id: "test123",
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    name: "Test User",
    email: "konaduprince26@gmail.com",
    phone: "0241096942",
    checkin: "2025-12-01",
    checkout: "2025-12-05",
    adults: "2",
    children: "1",
    roomType: "executive",
    message: "Test booking for email verification",
    status: "pending"
};

// Read existing bookings
let bookings = [];
if (fs.existsSync('bookings.json')) {
    try {
        const data = fs.readFileSync('bookings.json', 'utf8');
        bookings = JSON.parse(data);
        if (!Array.isArray(bookings)) {
            bookings = [];
        }
    } catch (err) {
        bookings = [];
    }
}

// Add test booking
bookings.push(testBooking);

// Save bookings to file
try {
    fs.writeFileSync('bookings.json', JSON.stringify(bookings, null, 2));
    console.log("Test booking added successfully with email: konaduprince26@gmail.com");
    
    // Verify the booking was added
    const updatedData = fs.readFileSync('bookings.json', 'utf8');
    const updatedBookings = JSON.parse(updatedData);
    const lastBooking = updatedBookings[updatedBookings.length - 1];
    
    console.log("Last booking in the system:");
    console.log(`ID: ${lastBooking.id}`);
    console.log(`Email: ${lastBooking.email}`);
    console.log(`Name: ${lastBooking.name}`);
} catch (err) {
    console.error("Failed to add test booking:", err);
}