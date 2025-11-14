const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 8000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve bookings.json file
app.get('/bookings.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'bookings.json'));
});

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Handle booking form submission
app.post('/process-booking', (req, res) => {
    const {
        name,
        email,
        phone,
        checkin,
        checkout,
        adults,
        children,
        'room-type': roomType,
        message
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !checkin || !checkout || !roomType) {
        return res.status(400).json({
            status: 'error',
            message: 'Please fill in all required fields.'
        });
    }

    // Create booking record
    const booking = {
        id: uuidv4().substring(0, 8),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        name,
        email,
        phone,
        checkin,
        checkout,
        adults: adults || '0',
        children: children || '0',
        roomType,
        message: message || ''
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

    // Add new booking
    bookings.push(booking);

    // Save bookings to file
    try {
        fs.writeFileSync('bookings.json', JSON.stringify(bookings, null, 2));
        
        res.json({
            status: 'success',
            message: 'Booking request submitted successfully! We will contact you shortly to confirm your reservation.'
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to save booking. Please try again later.'
        });
    }
});

// Handle contact form submission
app.post('/process-contact', (req, res) => {
    const {
        'contact-name': name,
        'contact-email': email,
        subject,
        'contact-message': message
    } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
        return res.status(400).json({
            status: 'error',
            message: 'Please fill in all required fields.'
        });
    }

    // Create contact record
    const contact = {
        id: uuidv4().substring(0, 8),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        name,
        email,
        subject,
        message
    };

    // Read existing contacts
    let contacts = [];
    if (fs.existsSync('contacts.json')) {
        try {
            const data = fs.readFileSync('contacts.json', 'utf8');
            contacts = JSON.parse(data);
            if (!Array.isArray(contacts)) {
                contacts = [];
            }
        } catch (err) {
            contacts = [];
        }
    }

    // Add new contact
    contacts.push(contact);

    // Save contacts to file
    try {
        fs.writeFileSync('contacts.json', JSON.stringify(contacts, null, 2));
        
        res.json({
            status: 'success',
            message: 'Thank you for your message! We will get back to you soon.'
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to save message. Please try again later.'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});