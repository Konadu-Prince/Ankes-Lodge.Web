const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('.'));

// Create a reusable transporter object using Gmail SMTP
// Using environment variables for credentials
let transporter;
try {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
} catch (error) {
    console.log('Email configuration error:', error);
    transporter = null;
}

// Test transporter configuration
if (transporter) {
    transporter.verify(function(error, success) {
        if (error) {
            console.log('Email configuration error:', error);
        } else {
            console.log('Email server is ready to send messages');
        }
    });
}

// Function to send confirmation email to customer
function sendConfirmationEmail(booking) {
    // If transporter is not configured, skip email sending
    if (!transporter) {
        console.log('Email transporter not configured, logging booking confirmation to console');
        console.log('=== BOOKING CONFIRMATION EMAIL ===');
        console.log(`To: ${booking.email}`);
        console.log(`Subject: Booking Confirmation - Ankes Lodge (Booking ID: ${booking.id})`);
        console.log(`Body:`);
        console.log(`Dear ${booking.name},`);
        console.log(`Thank you for booking with Ankes Lodge. Your booking details are as follows:`);
        console.log(`Booking ID: ${booking.id}`);
        console.log(`Name: ${booking.name}`);
        console.log(`Check-in Date: ${booking.checkin}`);
        console.log(`Check-out Date: ${booking.checkout}`);
        console.log(`Adults: ${booking.adults}`);
        console.log(`Children: ${booking.children}`);
        console.log(`Room Type: ${getRoomTypeName(booking.roomType)}`);
        console.log(`Special Requests: ${booking.message || 'None'}`);
        console.log(`We will contact you shortly to confirm your reservation and provide payment details.`);
        console.log(`Best regards, Ankes Lodge Team`);
        console.log('====================================');
        return;
    }
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: booking.email,
        subject: `Booking Confirmation - Ankes Lodge (Booking ID: ${booking.id})`,
        html: `
            <h2>Booking Confirmation - Ankes Lodge</h2>
            <p>Dear ${booking.name},</p>
            <p>Thank you for booking with Ankes Lodge. Your booking details are as follows:</p>
            
            <h3>Booking Details</h3>
            <ul>
                <li><strong>Booking ID:</strong> ${booking.id}</li>
                <li><strong>Name:</strong> ${booking.name}</li>
                <li><strong>Check-in Date:</strong> ${booking.checkin}</li>
                <li><strong>Check-out Date:</strong> ${booking.checkout}</li>
                <li><strong>Adults:</strong> ${booking.adults}</li>
                <li><strong>Children:</strong> ${booking.children}</li>
                <li><strong>Room Type:</strong> ${getRoomTypeName(booking.roomType)}</li>
                <li><strong>Special Requests:</strong> ${booking.message || 'None'}</li>
            </ul>
            
            <p>We will contact you shortly to confirm your reservation and provide payment details.</p>
            
            <p>Best regards,<br>Ankes Lodge Team</p>
            <p>Contact: 0544904547, 0558647156, 0248293512</p>
        `
    };

    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.log('Email sending error:', error);
            // Log the email content as fallback
            console.log('=== EMAIL FALLBACK LOG ===');
            console.log(`To: ${booking.email}`);
            console.log(`Subject: Booking Confirmation - Ankes Lodge (Booking ID: ${booking.id})`);
            console.log('Content:', mailOptions.html);
            console.log('=========================');
        } else {
            console.log('Confirmation email sent: ' + info.response);
        }
    });
}

// Function to send notification email to admin
function sendAdminNotification(booking) {
    // If transporter is not configured, skip email sending
    if (!transporter) {
        console.log('Email transporter not configured, logging admin notification to console');
        console.log('=== ADMIN NOTIFICATION EMAIL ===');
        console.log(`To: konaduprince26@gmail.com`);
        console.log(`Subject: New Booking Request - Ankes Lodge (Booking ID: ${booking.id})`);
        console.log(`Body:`);
        console.log(`A new booking request has been submitted. Details:`);
        console.log(`Booking ID: ${booking.id}`);
        console.log(`Timestamp: ${booking.timestamp}`);
        console.log(`Name: ${booking.name}`);
        console.log(`Email: ${booking.email}`);
        console.log(`Phone: ${booking.phone}`);
        console.log(`Check-in Date: ${booking.checkin}`);
        console.log(`Check-out Date: ${booking.checkout}`);
        console.log(`Adults: ${booking.adults}`);
        console.log(`Children: ${booking.children}`);
        console.log(`Room Type: ${getRoomTypeName(booking.roomType)}`);
        console.log(`Special Requests: ${booking.message || 'None'}`);
        console.log(`Please follow up with the customer to confirm the booking.`);
        console.log('================================');
        return;
    }
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL, // Admin email
        subject: `New Booking Request - Ankes Lodge (Booking ID: ${booking.id})`,
        html: `
            <h2>New Booking Request - Ankes Lodge</h2>
            <p>A new booking request has been submitted. Details:</p>
            
            <h3>Booking Details</h3>
            <ul>
                <li><strong>Booking ID:</strong> ${booking.id}</li>
                <li><strong>Timestamp:</strong> ${booking.timestamp}</li>
                <li><strong>Name:</strong> ${booking.name}</li>
                <li><strong>Email:</strong> ${booking.email}</li>
                <li><strong>Phone:</strong> ${booking.phone}</li>
                <li><strong>Check-in Date:</strong> ${booking.checkin}</li>
                <li><strong>Check-out Date:</strong> ${booking.checkout}</li>
                <li><strong>Adults:</strong> ${booking.adults}</li>
                <li><strong>Children:</strong> ${booking.children}</li>
                <li><strong>Room Type:</strong> ${getRoomTypeName(booking.roomType)}</li>
                <li><strong>Special Requests:</strong> ${booking.message || 'None'}</li>
            </ul>
            
            <p>Please follow up with the customer to confirm the booking.</p>
        `
    };

    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.log('Admin notification error:', error);
            // Log the email content as fallback
            console.log('=== ADMIN EMAIL FALLBACK LOG ===');
            console.log(`To: konaduprince26@gmail.com`);
            console.log(`Subject: New Booking Request - Ankes Lodge (Booking ID: ${booking.id})`);
            console.log('Content:', mailOptions.html);
            console.log('================================');
        } else {
            console.log('Admin notification sent: ' + info.response);
        }
    });
}

// Helper function to get room type name
function getRoomTypeName(roomType) {
    const roomTypes = {
        'executive': 'Executive Room (₵299/night)',
        'regular': 'Regular Bedroom (₵199/night)',
        'full-house': 'Full House (Custom Pricing)'
    };
    return roomTypes[roomType] || roomType;
}

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
app.post('/process-booking', 
    // Validation and sanitization middleware
    body('name').trim().escape().isLength({ min: 2, max: 50 }),
    body('email').trim().normalizeEmail().isEmail(),
    body('phone').trim().escape().matches(/^(?:\+233|0)(?:20|50|24|54|27|57|26|56|23|28)\d{7}$/),
    body('checkin').isISO8601(),
    body('checkout').isISO8601(),
    body('adults').isInt({ min: 1, max: 10 }),
    body('children').isInt({ min: 0, max: 10 }),
    body('message').trim().escape().isLength({ max: 500 }),
    (req, res) => {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Please check your input and try again.',
                errors: errors.array()
            });
        }

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

        // Validate room type
        const validRoomTypes = ['executive', 'regular', 'full-house'];
        if (!validRoomTypes.includes(roomType)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid room type selected.'
            });
        }

        // Validate dates
        const checkinDate = new Date(checkin);
        const checkoutDate = new Date(checkout);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (checkinDate < today) {
            return res.status(400).json({
                status: 'error',
                message: 'Check-in date cannot be in the past.'
            });
        }

        if (checkoutDate <= checkinDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Check-out date must be after check-in date.'
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
            message: message || '',
            status: 'pending'
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
            
            // Send confirmation email to customer
            sendConfirmationEmail(booking);
            
            // Send notification to admin
            sendAdminNotification(booking);
            
            res.json({
                status: 'success',
                message: 'Booking request submitted successfully! A confirmation email has been sent to your email address. We will contact you shortly to confirm your reservation.',
                bookingId: booking.id
            });
        } catch (err) {
            res.status(500).json({
                status: 'error',
                message: 'Failed to save booking. Please try again later.'
            });
        }
    }
);

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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            status: 'error',
            message: 'Please enter a valid email address.'
        });
    }

    // Validate message length
    if (message.length < 10) {
        return res.status(400).json({
            status: 'error',
            message: 'Message must be at least 10 characters long.'
        });
    }

    if (message.length > 1000) {
        return res.status(400).json({
            status: 'error',
            message: 'Message must be less than 1000 characters.'
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