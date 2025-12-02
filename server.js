const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// CORS middleware - Allow requests from any origin with better configuration
app.use((req, res, next) => {
    // Allow all origins for development and production
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Max-Age', '86400'); // Cache preflight requests for 24 hours
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        return res.status(200).json({});
    }
    
    next();
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('.'));

// Create a reusable transporter object using Gmail SMTP
// Note: In production, use environment variables for credentials
let transporter;
try {
    // Check if environment variables are set
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    // Debug logging for environment variables
    console.log('=== EMAIL CONFIGURATION DEBUG ===');
    console.log('EMAIL_USER env var:', emailUser ? `${emailUser.substring(0, 5)}...` : 'NOT SET');
    console.log('EMAIL_PASS env var:', emailPass ? 'SET (hidden for security)' : 'NOT SET');
    
    if (!emailUser || !emailPass) {
        console.log('EMAIL_USER and EMAIL_PASS environment variables are required for email functionality');
        console.log('Please set these environment variables in your deployment platform');
        transporter = null;
    } else {
        console.log('Creating transporter with provided credentials...');
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass
            }
        });
    }
    console.log('=== END EMAIL CONFIGURATION DEBUG ===');
} catch (error) {
    console.log('Email configuration error:', error);
    transporter = null;
}

// Test transporter configuration
console.log('Checking transporter configuration...');
if (transporter) {
    console.log('Transporter exists, attempting verification...');
    transporter.verify(function(error, success) {
        if (error) {
            console.log('Email configuration error:', error.message);
            console.log('Error code:', error.code);
            console.log('Error command:', error.command);
        } else {
            console.log('Email server is ready to send messages');
        }
    });
} else {
    console.log('No transporter configured - email functionality will be disabled');
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
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: 'ankeslodge@gmail.com',
        to: booking.email,
        subject: `Booking Confirmation - Ankes Lodge (Booking ID: ${booking.id})`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
                    <img src="https://konadu-prince.github.io/Ankes-Lodge.Web/orangeLogo.png" alt="Ankes Lodge Logo" style="max-width: 100px; margin-bottom: 10px;">
                    <h1 style="color: #333; margin: 0;">Ankes Lodge</h1>
                    <p style="color: #666; margin: 5px 0;">Luxury Guest House in Abesim</p>
                </div>
                
                <div style="background-color: #fff; padding: 30px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <h2 style="color: #333;">Booking Confirmation</h2>
                    <p>Dear ${booking.name},</p>
                    <p>Thank you for booking with Ankes Lodge. Your booking details are as follows:</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #ffa500; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Booking Details</h3>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p><strong>Name:</strong> ${booking.name}</p>
                        <p><strong>Check-in Date:</strong> ${booking.checkin}</p>
                        <p><strong>Check-out Date:</strong> ${booking.checkout}</p>
                        <p><strong>Adults:</strong> ${booking.adults}</p>
                        <p><strong>Children:</strong> ${booking.children}</p>
                        <p><strong>Room Type:</strong> ${getRoomTypeName(booking.roomType)}</p>
                        <p><strong>Special Requests:</strong> ${booking.message || 'None'}</p>
                    </div>
                    
                    <p>We will contact you shortly to confirm your reservation and provide payment details.</p>
                    
                    <div style="background-color: #e8f4e8; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Contact Information</h3>
                        <p>To reach the customer directly:</p>
                        <p><strong>Customer Phone:</strong> <a href="tel:${booking.phone}">${booking.phone}</a></p>
                        <p><strong>Customer Email:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
                        <p><strong>Manager Contact:</strong> 0248293512</p>
                        <p><strong>Website:</strong> <a href="https://konadu-prince.github.io/Ankes-Lodge.Web">View Our Website</a></p>
                    </div>
                    
                    <p>Best regards,<br><strong>Ankes Lodge Team</strong></p>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
                    <p>Contact: 0544904547, 0558647156, 0248293512</p>
                    <p>&copy; 2025 Ankes Lodge. All rights reserved.</p>
                </div>
            </div>
        `
    };

    // Return a promise for better error handling
    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log('Email sending error:', error.message);
                // Log the email content as fallback
                console.log('=== EMAIL FALLBACK LOG ===');
                console.log(`To: ${booking.email}`);
                console.log(`Subject: Booking Confirmation - Ankes Lodge (Booking ID: ${booking.id})`);
                console.log('Content:', mailOptions.html);
                console.log('=========================');
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Confirmation email sent: ' + info.response);
                resolve();
            }
        });
    });
}

// Function to send notification email to admin
function sendAdminNotification(booking) {
    // If transporter is not configured, skip email sending
    if (!transporter) {
        console.log('Email transporter not configured, logging admin notification to console');
        console.log('=== ADMIN NOTIFICATION EMAIL ===');
        console.log(`To: ankeslodge@gmail.com`);
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
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: 'ankeslodge@gmail.com',
        to: 'ankeslodge@gmail.com', // Admin email
        subject: `New Booking Request - Ankes Lodge (Booking ID: ${booking.id})`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
                    <img src="https://konadu-prince.github.io/Ankes-Lodge.Web/orangeLogo.png" alt="Ankes Lodge Logo" style="max-width: 100px; margin-bottom: 10px;">
                    <h1 style="color: #333; margin: 0;">Ankes Lodge</h1>
                    <p style="color: #666; margin: 5px 0;">Luxury Guest House in Abesim</p>
                </div>
                
                <div style="background-color: #fff; padding: 30px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <h2 style="color: #333;">New Booking Request</h2>
                    <p>A new booking request has been submitted. Details:</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #ffa500; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Booking Details</h3>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p><strong>Timestamp:</strong> ${booking.timestamp}</p>
                        <p><strong>Name:</strong> ${booking.name}</p>
                        <p><strong>Email:</strong> ${booking.email}</p>
                        <p><strong>Phone:</strong> ${booking.phone}</p>
                        <p><strong>Check-in Date:</strong> ${booking.checkin}</p>
                        <p><strong>Check-out Date:</strong> ${booking.checkout}</p>
                        <p><strong>Adults:</strong> ${booking.adults}</p>
                        <p><strong>Children:</strong> ${booking.children}</p>
                        <p><strong>Room Type:</strong> ${getRoomTypeName(booking.roomType)}</p>
                        <p><strong>Special Requests:</strong> ${booking.message || 'None'}</p>
                    </div>
                    
                    <p>You can view more information about our services on our website:</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="https://konadu-prince.github.io/Ankes-Lodge.Web" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Visit Our Website</a>
                    </div>
                    
                    <p>Please follow up with the customer to confirm the booking.</p>
                    
                    <div style="background-color: #e8f4e8; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Contact Information</h3>
                        <p>To reach the customer directly:</p>
                        <p><strong>Customer Phone:</strong> <a href="tel:${booking.phone}">${booking.phone}</a></p>
                        <p><strong>Customer Email:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
                        <p><strong>Manager Contact:</strong> 0248293512</p>
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="mailto:${booking.email}" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">Email Customer</a>
                        <a href="tel:${booking.phone}" style="display: inline-block; background-color: #ffc107; color: #000; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Call Customer</a>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
                    <p>&copy; 2025 Ankes Lodge. All rights reserved.</p>
                </div>
            </div>
        `
    };
    
    // Return a promise for better error handling
    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log('Admin notification error:', error.message);
                // Log the email content as fallback
                console.log('=== ADMIN EMAIL FALLBACK LOG ===');
                console.log(`To: ankeslodge@gmail.com`);
                console.log(`Subject: New Booking Request - Ankes Lodge (Booking ID: ${booking.id})`);
                console.log('Content:', mailOptions.html);
                console.log('================================');
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Admin notification sent: ' + info.response);
                resolve();
            }
        });
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
    body('phone').trim().escape().matches(/^(?:\+233|0)(?:20|50|24|54|27|57|26|56|23|28|55|59)\d{7}$/),
    body('checkin').isISO8601(),
    body('checkout').isISO8601(),
    body('adults').isInt({ min: 1, max: 10 }),
    body('children').isInt({ min: 0, max: 10 }),
    body('message').trim().escape().isLength({ max: 500 }),
    (req, res) => {
        // Debug: Log request start
        console.log('=== BOOKING FORM REQUEST START ===');
        console.log('Request method:', req.method);
        console.log('Request URL:', req.url);
        console.log('Request headers:', req.headers);
        
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
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
            console.log('Missing required fields');
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
            
            // Send confirmation email to customer and notification to admin
            Promise.all([
                sendConfirmationEmail(booking),
                sendAdminNotification(booking)
            ]).then(() => {
                console.log('Booking form processed successfully - emails sent');
                res.json({
                    status: 'success',
                    message: 'Booking request submitted successfully! A confirmation email has been sent to your email address. We will contact you shortly to confirm your reservation.',
                    bookingId: booking.id
                });
            }).catch((error) => {
                console.log('Error sending emails:', error);
                res.json({
                    status: 'success',
                    message: 'Booking request submitted successfully! We will contact you shortly to confirm your reservation.',
                    bookingId: booking.id
                });
            });
        } catch (err) {
            console.error('Error processing booking form:', err);
            res.status(500).json({
                status: 'error',
                message: 'Failed to save booking. Please try again later.'
            });
        }
    }
);

// Handle contact form submission
app.post('/process-contact', (req, res) => {
    // Debug: Log request start
    console.log('=== CONTACT FORM REQUEST START ===');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers);
    
    // Debug: Log all incoming data
    console.log('=== CONTACT FORM DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Keys in body:', Object.keys(req.body));
    
    // Debug: Check each field individually
    console.log('Checking individual fields:');
    console.log('contact-name in body:', 'contact-name' in req.body);
    console.log('contact-email in body:', 'contact-email' in req.body);
    console.log('subject in body:', 'subject' in req.body);
    console.log('contact-message in body:', 'contact-message' in req.body);
    
    // Debug: Log raw values
    console.log('Raw values:');
    console.log('req.body[\'contact-name\']:', req.body['contact-name']);
    console.log('req.body[\'contact-email\']:', req.body['contact-email']);
    console.log('req.body[\'subject\']:', req.body['subject']);
    console.log('req.body[\'contact-message\']:', req.body['contact-message']);
    
    // Correctly extract form data
    const name = req.body['contact-name'];
    const email = req.body['contact-email'];
    const subject = req.body['subject'];
    const message = req.body['contact-message'];
    
    // Debug: Log extracted values
    console.log('Extracted values:');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Subject:', subject);
    console.log('Message:', message);
    console.log('========================');
    
    // Validate required fields
    if (!name || !email || !subject || !message) {
        console.log('Validation failed: Missing required fields');
        console.log('Missing fields check:');
        console.log('!name:', !name, 'value:', name);
        console.log('!email:', !email, 'value:', email);
        console.log('!subject:', !subject, 'value:', subject);
        console.log('!message:', !message, 'value:', message);
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
        
        // Send email notifications if transporter is configured
        if (transporter) {
            // Send confirmation email to the customer and notification to admin
            Promise.all([
                sendContactConfirmationEmail(contact),
                sendContactAdminNotification(contact)
            ]).then(() => {
                console.log('Contact form processed successfully - emails sent');
                res.json({
                    status: 'success',
                    message: 'Thank you for your message! We will get back to you soon.'
                });
            }).catch((error) => {
                console.log('Error sending contact emails:', error);
                res.json({
                    status: 'success',
                    message: 'Thank you for your message! We will get back to you soon.'
                });
            });
        } else {
            console.log('Email transporter not configured, skipping email notifications');
            console.log('=== CONTACT CONFIRMATION EMAIL ===');
            console.log(`To: ${contact.email}`);
            console.log(`Subject: ${contact.subject}`);
            console.log(`Body:`);
            console.log(`Dear ${contact.name},`);
            console.log(`Thank you for contacting Ankes Lodge. We have received your message and will get back to you soon.`);
            console.log(`Your message: ${contact.message}`);
            console.log(`Best regards, Ankes Lodge Team`);
            console.log('====================================');
            
            console.log('=== ADMIN NOTIFICATION EMAIL ===');
            console.log(`To: ankeslodge@gmail.com`);
            console.log(`Subject: New Contact Message - ${contact.subject}`);
            console.log(`Body:`);
            console.log(`A new contact message has been received. Details:`);
            console.log(`Name: ${contact.name}`);
            console.log(`Email: ${contact.email}`);
            console.log(`Subject: ${contact.subject}`);
            console.log(`Message: ${contact.message}`);
            console.log(`Timestamp: ${contact.timestamp}`);
            console.log('================================');
            
            res.json({
                status: 'success',
                message: 'Thank you for your message! We will get back to you soon.'
            });
        }
    } catch (err) {
        console.error('Error processing contact form:', err);
        res.status(500).json({
            status: 'error',
            message: 'Failed to save message. Please try again later.'
        });
    }
});

// Function to send confirmation email to customer for contact form
function sendContactConfirmationEmail(contact) {
    // If transporter is not configured, skip email sending
    if (!transporter) {
        console.log('Email transporter not configured, logging contact confirmation to console');
        console.log('=== CONTACT CONFIRMATION EMAIL ===');
        console.log(`To: ${contact.email}`);
        console.log(`Subject: Re: ${contact.subject}`);
        console.log(`Body:`);
        console.log(`Dear ${contact.name},`);
        console.log(`Thank you for contacting Ankes Lodge. We have received your message and will get back to you soon.`);
        console.log(`Your message: ${contact.message}`);
        console.log(`Best regards, Ankes Lodge Team`);
        console.log('====================================');
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: 'ankeslodge@gmail.com',
        to: contact.email,
        subject: `Re: ${contact.subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
                    <img src="https://konadu-prince.github.io/Ankes-Lodge.Web/orangeLogo.png" alt="Ankes Lodge Logo" style="max-width: 100px; margin-bottom: 10px;">
                    <h1 style="color: #333; margin: 0;">Ankes Lodge</h1>
                    <p style="color: #666; margin: 5px 0;">Luxury Guest House in Abesim</p>
                </div>
                
                <div style="background-color: #fff; padding: 30px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <h2 style="color: #333;">Thank you for contacting Ankes Lodge</h2>
                    <p>Dear ${contact.name},</p>
                    <p>Thank you for contacting Ankes Lodge. We have received your message and will get back to you soon.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #ffa500; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Your Message Details</h3>
                        <p><strong>Subject:</strong> ${contact.subject}</p>
                        <p><strong>Message:</strong> ${contact.message}</p>
                        <p><strong>Received:</strong> ${contact.timestamp}</p>
                    </div>
                    
                    <div style="background-color: #e8f4e8; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Contact Information</h3>
                        <p>If you need immediate assistance, please contact our managers directly:</p>
                        <p><strong>Manager:</strong> 0248293512</p>
                        <p><strong>Website:</strong> <a href="https://konadu-prince.github.io/Ankes-Lodge.Web">View Our Website</a></p>
                    </div>
                    
                    <p>We typically respond within 24 hours. If you need immediate assistance, please call us at <strong>0544904547</strong> or <strong>0558647156</strong>.</p>
                    
                    <p>Best regards,<br><strong>Ankes Lodge Team</strong></p>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
                    <p>Contact: 0544904547, 0558647156</p>
                    <p>&copy; 2025 Ankes Lodge. All rights reserved.</p>
                </div>
            </div>
        `
    };

    // Return a promise for better error handling
    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log('Contact confirmation email error:', error.message);
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Contact confirmation email sent: ' + info.response);
                resolve();
            }
        });
    });
}

// Function to send notification email to admin for contact form
function sendContactAdminNotification(contact) {
    // If transporter is not configured, skip email sending
    if (!transporter) {
        console.log('Email transporter not configured, logging contact notification to console');
        console.log('=== CONTACT NOTIFICATION EMAIL ===');
        console.log(`To: ankeslodge@gmail.com`);
        console.log(`Subject: New Contact Message - ${contact.subject}`);
        console.log(`Body:`);
        console.log(`A new contact message has been received. Details:`);
        console.log(`Name: ${contact.name}`);
        console.log(`Email: ${contact.email}`);
        console.log(`Subject: ${contact.subject}`);
        console.log(`Message: ${contact.message}`);
        console.log(`Received: ${contact.timestamp}`);
        console.log('==================================');
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: 'ankeslodge@gmail.com',
        to: 'ankeslodge@gmail.com', // Admin email
        subject: `New Contact Message - ${contact.subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
                    <img src="https://konadu-prince.github.io/Ankes-Lodge.Web/orangeLogo.png" alt="Ankes Lodge Logo" style="max-width: 100px; margin-bottom: 10px;">
                    <h1 style="color: #333; margin: 0;">Ankes Lodge</h1>
                    <p style="color: #666; margin: 5px 0;">Luxury Guest House in Abesim</p>
                </div>
                
                <div style="background-color: #fff; padding: 30px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <h2 style="color: #333;">New Contact Message</h2>
                    <p>A new contact message has been received. Details:</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #ffa500; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Message Details</h3>
                        <p><strong>Name:</strong> ${contact.name}</p>
                        <p><strong>Email:</strong> ${contact.email}</p>
                        <p><strong>Subject:</strong> ${contact.subject}</p>
                        <p><strong>Message:</strong> ${contact.message}</p>
                        <p><strong>Received:</strong> ${contact.timestamp}</p>
                    </div>
                    
                    <div style="background-color: #e8f4e8; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Contact Information</h3>
                        <p>Manager Contact: 0248293512</p>
                        <p>Website: <a href="https://konadu-prince.github.io/Ankes-Lodge.Web">View Our Website</a></p>
                    </div>
                    
                    <p>Please follow up with the customer as soon as possible.</p>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="mailto:${contact.email}" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reply to Customer</a>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
                    <p>&copy; 2025 Ankes Lodge. All rights reserved.</p>
                </div>
            </div>
        `
    };

    // Return a promise for better error handling
    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log('Contact admin notification error:', error.message);
                // Log the email content as fallback
                console.log('=== CONTACT EMAIL FALLBACK LOG ===');
                console.log(`To: ankeslodge@gmail.com`);
                console.log(`Subject: New Contact Message - ${contact.subject}`);
                console.log('Content:', mailOptions.html);
                console.log('===================================');
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Contact admin notification sent: ' + info.response);
                resolve();
            }
        });
    });
}

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error occurred. Please try again later.'
    });
});

// For Vercel deployment, we need to export the app
module.exports = app;

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
    console.log('Starting server...');
    console.log(`PORT environment variable: ${process.env.PORT}`);
    console.log(`Using PORT: ${PORT}`);
    
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running at http://0.0.0.0:${PORT}`);
        console.log(`Environment variables status:`);
        console.log(`- EMAIL_USER: ${process.env.EMAIL_USER ? 'SET' : 'NOT SET'}`);
        console.log(`- EMAIL_PASS: ${process.env.EMAIL_PASS ? 'SET' : 'NOT SET'}`);
        console.log(`- PORT: ${PORT}`);
        
        // Test email configuration if credentials are provided
        console.log('Testing email configuration...');
        if (transporter) {
            console.log('Transporter is configured, testing connection...');
            transporter.verify(function(error, success) {
                if (error) {
                    console.log('Email configuration test FAILED:', error.message);
                    console.log('Error code:', error.code);
                    console.log('This is likely due to Render.com SMTP restrictions');
                    console.log('Emails will be logged to console instead of sent.');
                } else {
                    console.log('Email configuration test PASSED - emails will be sent.');
                }
            });
        } else {
            console.log('Email transporter not configured - emails will be logged to console.');
            console.log('Please ensure EMAIL_USER and EMAIL_PASS environment variables are set.');
        }
    });
    
    // Handle server errors
    server.on('error', (error) => {
        console.error('Server error:', error);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down gracefully');
        server.close(() => {
            console.log('Process terminated');
        });
    });
}
