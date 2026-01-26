const express = require('express');
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const nodemailer = require('nodemailer');
const winston = require('winston');
require('dotenv').config();

const app = express();

// MongoDB connection
let db;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ankeslodge';

async function connectToDatabase() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db();
        logger.info('Connected to MongoDB database');
    } catch (error) {
        logger.error('Failed to connect to MongoDB:', error);
        // Continue without database if connection fails
    }
}

// Initialize database connection
connectToDatabase();

// Configure Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'ankes-lodge-server' },
    transports: [
        // Write all logs with importance level of `error` or less to `error.log`
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        // Write all logs with importance level of `info` or less to `combined.log`
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Email configuration
const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER || 'konaduprince26@gmail.com',
        pass: process.env.EMAIL_PASS || 'svvnrkgzmgxuskyl' // You'll need to set this in .env
    }
};

// Create reusable transporter object
const transporter = nodemailer.createTransport(emailConfig);

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        logger.error('Email transporter configuration error:', error.message);
        logger.warn('Email functionality will be disabled. Please check your email credentials in .env file.');
    } else {
        logger.info('Email transporter is ready to send messages');
    }
});

// Email sending function with retry mechanism
async function sendEmailWithRetry(mailOptions, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`Email attempt ${attempt} failed:`, error.message);
            if (attempt === maxRetries) {
                console.error('All email attempts failed');
                return { success: false, error: error.message };
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

// Booking notification email function
async function sendBookingNotification(booking) {
    const adminEmail = process.env.ADMIN_EMAIL || 'konaduprince26@gmail.com';
    const mailOptions = {
        from: '"Ankes Lodge" <' + adminEmail + '>',
        to: adminEmail,
        subject: `New Booking Request - ${booking.id}`,
        html: `
            <h2>New Booking Request Received</h2>
            <p><strong>Booking ID:</strong> ${booking.id}</p>
            <p><strong>Name:</strong> ${booking.name}</p>
            <p><strong>Email:</strong> ${booking.email}</p>
            <p><strong>Phone:</strong> ${booking.phone}</p>
            <p><strong>Check-in:</strong> ${booking.checkin}</p>
            <p><strong>Check-out:</strong> ${booking.checkout}</p>
            <p><strong>Adults:</strong> ${booking.adults}</p>
            <p><strong>Children:</strong> ${booking.children}</p>
            <p><strong>Room Type:</strong> ${booking.roomType}</p>
            <p><strong>Special Requests:</strong> ${booking.message || 'None'}</p>
            <p><strong>Timestamp:</strong> ${booking.timestamp}</p>
        `
    };

    return await sendEmailWithRetry(mailOptions);
}

// Contact form notification email function
async function sendContactNotification(contact) {
    const adminEmail = process.env.ADMIN_EMAIL || 'konaduprince26@gmail.com';
    const mailOptions = {
        from: '"Ankes Lodge Website" <' + adminEmail + '>',
        to: adminEmail,
        subject: `New Contact Form Submission - ${contact.subject}`,
        html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${contact.name}</p>
            <p><strong>Email:</strong> ${contact.email}</p>
            <p><strong>Subject:</strong> ${contact.subject}</p>
            <p><strong>Message:</strong></p>
            <p>${contact.message}</p>
            <p><strong>Timestamp:</strong> ${contact.timestamp}</p>
        `
    };

    return await sendEmailWithRetry(mailOptions);
}

// Rate limiting middleware
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 contact form submissions per windowMs
    message: 'Too many contact form submissions, please try again later.'
});

const bookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 booking form submissions per windowMs
    message: 'Too many booking form submissions, please try again later.'
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// CORS middleware
app.use(cors({
    origin: '*', // In production, specify your domain(s) instead of '*'
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security headers middleware
app.use((req, res, next) => {
    // Prevent XSS attacks
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enable HSTS
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    
    next();
});

// Middleware
app.use(express.static(path.join(__dirname, '.')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Authentication middleware
function requireAuth(req, res, next) {
    // Check for authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Authorization required. Please provide a valid token.'
        });
    }
    
    // Extract the token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // In production, verify JWT token here
    // For now, we'll accept our demo token
    if (token === 'demo_token') {
        next();
    } else {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token.'
        });
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/rooms.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'rooms.html'));
});

app.get('/gallery.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'gallery.html'));
});

app.get('/booking.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'booking.html'));
});

app.get('/contact.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get('/about.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Fallback route for any other routes
app.get('*', (req, res) => {
    // Don't serve HTML pages for API endpoints
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/admin/') || 
        req.path.endsWith('.json') ||
        req.path.includes('testimonials') ||
        req.path.includes('booking') ||
        req.path.includes('contact')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Handle routes with fragments by serving the appropriate page
    const cleanPath = req.path.split('/')[1]; // Get the first part of the path
    
    if (cleanPath === 'about.html' || cleanPath.includes('about')) {
        res.sendFile(path.join(__dirname, 'about.html'));
    } else if (cleanPath === 'rooms.html' || cleanPath.includes('rooms')) {
        res.sendFile(path.join(__dirname, 'rooms.html'));
    } else if (cleanPath === 'gallery.html' || cleanPath.includes('gallery')) {
        res.sendFile(path.join(__dirname, 'gallery.html'));
    } else if (cleanPath === 'booking.html' || cleanPath.includes('booking')) {
        res.sendFile(path.join(__dirname, 'booking.html'));
    } else if (cleanPath === 'contact.html' || cleanPath.includes('contact')) {
        res.sendFile(path.join(__dirname, 'contact.html'));
    } else {
        // Check if file exists
        const filePath = path.join(__dirname, req.path);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.sendFile(filePath);
        } else {
            // If file doesn't exist, redirect to homepage
            res.sendFile(path.join(__dirname, 'index.html'));
        }
    }
});

// Contact form handler
app.post('/process-contact', contactLimiter, async (req, res) => {
    // Log the contact form submission
    console.log('Contact form submitted:', req.body);
    
    const { 'contact-name': name, 'contact-email': email, subject, 'contact-message': message } = req.body;
    
    // Validate required fields
    if (!name || !email || !subject || !message) {
        return res.status(400).json({
            success: false,
            message: 'Please fill in all required fields: name, email, subject, and message'
        });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
        });
    }
    
    // Validate message length
    if (message.length > 1000) {
        return res.status(400).json({
            success: false,
            message: 'Message must be less than 1000 characters'
        });
    }
    
    // Create contact record
    const contact = {
        id: 'CT' + Date.now(), // Simple ID generation
        timestamp: new Date().toISOString(),
        name: name.toString().substring(0, 100), // Limit length
        email: email.toString().substring(0, 100), // Limit length
        subject: subject.toString().substring(0, 200), // Limit length
        message: message.toString().substring(0, 1000) // Limit length
    };
    
    // Store contact in database or memory as fallback
    const savedToDb = await saveContactToDatabase(contact);
    if (!savedToDb) {
        contacts.push(contact); // Fallback to memory storage
        console.log('Stored contact in memory:', contact.id);
    } else {
        console.log('Stored contact in database:', contact.id);
    }

    // Send notification email
    const emailResult = await sendContactNotification(contact);
    if (emailResult.success) {
        console.log('Contact notification email sent successfully');
    } else {
        console.error('Failed to send contact notification email:', emailResult.error);
        // Note: We don't fail the contact submission if email fails, just log the error
    }
    
    res.json({ 
        success: true, 
        message: 'Thank you for contacting us. We will get back to you soon!',
        contactId: contact.id
    });
});

// Booking form handler
app.post('/submit-booking', bookingLimiter, async (req, res) => {
    // Log the booking form submission
    console.log('Booking form submitted:', req.body);
    
    const { name, email, phone, checkin, checkout, adults, children, 'room-type': roomType, message } = req.body;
    
    // Validate required fields
    if (!name || !email || !phone || !checkin || !checkout || !adults || !roomType) {
        return res.status(400).json({
            success: false,
            message: 'Please fill in all required fields: name, email, phone, check-in date, check-out date, number of adults, and room type'
        });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
        });
    }
    
    // Validate phone format (Ghanaian phone number format)
    const phoneRegex = /^(?:\+233|0)(?:20|50|24|54|27|57|26|56|23|28|55|59)\d{7}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid Ghanaian phone number (+233 or 0 followed by 9 digits)'
        });
    }
    
    // Validate dates
    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (checkinDate < today) {
        return res.status(400).json({
            success: false,
            message: 'Check-in date cannot be in the past'
        });
    }
    
    if (checkoutDate <= checkinDate) {
        return res.status(400).json({
            success: false,
            message: 'Check-out date must be after check-in date'
        });
    }
    
    // Validate number of guests
    const adultsNum = parseInt(adults, 10);
    const childrenNum = parseInt(children || 0, 10);
    if (isNaN(adultsNum) || adultsNum <= 0 || adultsNum > 20) { // Reasonable limit
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid number of adults (1-20)'
        });
    }
    
    if (isNaN(childrenNum) || childrenNum < 0 || childrenNum > 20) { // Reasonable limit
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid number of children (0-20)'
        });
    }
    
    // Validate message length if provided
    if (message && message.length > 500) {
        return res.status(400).json({
            success: false,
            message: 'Special requests must be less than 500 characters'
        });
    }
    
    // Generate a unique booking ID
    const bookingId = 'BK' + Date.now(); // Simple booking ID generation
    
    // Create booking record
    const booking = {
        id: bookingId,
        timestamp: new Date().toISOString(),
        name: name.toString().substring(0, 100),
        email: email.toString().substring(0, 100),
        phone: phone.toString(),
        checkin: checkin.toString(),
        checkout: checkout.toString(),
        adults: adultsNum,
        children: childrenNum,
        roomType: roomType.toString().substring(0, 50),
        message: message ? message.toString().substring(0, 500) : ''
    };
    
    // Store booking in database or memory as fallback
    const savedToDb = await saveBookingToDatabase(booking);
    if (!savedToDb) {
        bookings.push(booking); // Fallback to memory storage
        console.log('Stored booking in memory:', booking.id);
    } else {
        console.log('Stored booking in database:', booking.id);
    }

    // Send notification email
    const emailResult = await sendBookingNotification(booking);
    if (emailResult.success) {
        console.log('Booking notification email sent successfully');
    } else {
        console.error('Failed to send booking notification email:', emailResult.error);
        // Note: We don't fail the booking if email fails, just log the error
    }
    
    res.json({ 
        success: true, 
        bookingId: bookingId,
        message: 'Your booking has been received. We will contact you shortly to confirm your reservation.' 
    });
});

// Testimonials form handler
app.post('/submit-testimonial', (req, res) => {
    // Log the testimonial form submission
    console.log('Testimonial submitted:', req.body);
    
    // In a real application, you would save the testimonial to a database
    // For now, just send a success response
    res.json({ 
        success: true, 
        message: 'Thank you for sharing your experience!' 
    });
});

// Payment page route
app.get('/payment.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'payment.html'));
});

// Initiate payment endpoint
app.post('/initiate-payment', (req, res) => {
    // Log the payment initiation request
    console.log('Payment initiation request:', req.body);
    
    const { email, customer_name, amount, booking_id } = req.body;
    
    // Validate required fields
    if (!email || !customer_name || !amount || !booking_id) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: email, customer_name, amount, or booking_id'
        });
    }
    
    // In a real application, you would integrate with Paystack here
    // For now, simulate a successful response with proper structure
    res.json({ 
        success: true, 
        authorization_url: 'https://google.com', // This would be the actual Paystack URL
        reference: 'REF_' + Date.now(),
        message: 'Payment initialized successfully'
    });
});

// Update booking endpoint (for cash on arrival)
app.post('/update-booking', (req, res) => {
    // Log the booking update request
    console.log('Booking update request:', req.body);
    
    // In a real application, you would update the booking in a database
    // For now, just send a success response
    res.json({ 
        success: true, 
        message: 'Booking updated successfully' 
    });
});

// Get testimonials - prioritizes database if available, falls back to file
app.get('/testimonials.json', async (req, res) => {
    try {
        if (db) {
            // Try to get testimonials from MongoDB
            const collection = db.collection('testimonials');
            const testimonials = await collection.find({}).sort({ date: -1 }).toArray();
            if (testimonials.length > 0) {
                console.log(`Retrieved ${testimonials.length} testimonials from database`);
                res.json(testimonials);
                return;
            }
        }
        
        // Fallback to file-based testimonials
        const testimonialsPath = path.join(__dirname, 'testimonials.json');
        if (fs.existsSync(testimonialsPath)) {
            const testimonials = JSON.parse(fs.readFileSync(testimonialsPath, 'utf8'));
            console.log(`Retrieved testimonials from file`);
            res.json(testimonials);
        } else {
            // Return empty array if no testimonials file exists
            res.json([]);
        }
    } catch (error) {
        console.error('Error retrieving testimonials:', error);
        // Fallback to file if there's an error
        try {
            const testimonialsPath = path.join(__dirname, 'testimonials.json');
            if (fs.existsSync(testimonialsPath)) {
                const testimonials = JSON.parse(fs.readFileSync(testimonialsPath, 'utf8'));
                res.json(testimonials);
            } else {
                res.json([]);
            }
        } catch (fileError) {
            console.error('Error reading testimonials file:', fileError);
            res.json([]);
        }
    }
});

// Add testimonial endpoint
app.post('/add-testimonial', async (req, res) => {
    try {
        const { name, location, rating, comment } = req.body;
        
        // Validate input
        if (!name || !rating || !comment) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, rating, and comment are required' 
            });
        }
        
        const newTestimonial = {
            name,
            location: location || '',
            comment,
            rating: parseInt(rating),
            date: new Date().toISOString().split('T')[0],
            id: Date.now() // Simple ID generation
        };
        
        if (db) {
            // Save to MongoDB
            const collection = db.collection('testimonials');
            await collection.insertOne(newTestimonial);
            console.log('Saved testimonial to database:', newTestimonial.name);
        } else {
            // Save to file if database is not available
            const testimonialsPath = path.join(__dirname, 'testimonials.json');
            let testimonials = [];
            
            if (fs.existsSync(testimonialsPath)) {
                testimonials = JSON.parse(fs.readFileSync(testimonialsPath, 'utf8'));
            }
            
            testimonials.push(newTestimonial);
            fs.writeFileSync(testimonialsPath, JSON.stringify(testimonials, null, 2));
            console.log('Saved testimonial to file:', newTestimonial.name);
        }
        
        res.json({ 
            success: true, 
            message: 'Thank you for sharing your experience!',
            testimonial: newTestimonial
        });
    } catch (error) {
        console.error('Error adding testimonial:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add testimonial' 
        });
    }
});

// Admin login endpoint
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Read admin credentials from file
    const credentialsPath = path.join(__dirname, 'admin-credentials.json');
    
    if (!fs.existsSync(credentialsPath)) {
        console.error('Admin credentials file not found');
        return res.status(500).json({ 
            success: false, 
            message: 'Authentication system not configured' 
        });
    }
    
    try {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        
        // Check if provided credentials match
        if (username === credentials.username) {
            // Compare the provided password with the hashed password
            const passwordsMatch = await bcrypt.compare(password, credentials.password);
            
            if (passwordsMatch) {
                // In a real application, you would set a session or token here
                res.json({ 
                    success: true, 
                    message: 'Login successful',
                    // In production, return a JWT token or session ID
                    token: 'demo_token' // This is just for demonstration
                });
            } else {
                res.json({ 
                    success: false, 
                    message: 'Invalid credentials' 
                });
            }
        } else {
            res.json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
    } catch (error) {
        console.error('Error reading admin credentials:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Authentication error' 
        });
    }
});

// Admin endpoint to get all testimonials
app.get('/admin/testimonials', async (req, res) => {
    try {
        if (db) {
            // Get testimonials from MongoDB
            const collection = db.collection('testimonials');
            const testimonials = await collection.find({}).sort({ date: -1 }).toArray();
            res.json(testimonials);
        } else {
            // Fallback to file-based testimonials
            const testimonialsPath = path.join(__dirname, 'testimonials.json');
            if (fs.existsSync(testimonialsPath)) {
                const testimonials = JSON.parse(fs.readFileSync(testimonialsPath, 'utf8'));
                res.json(testimonials);
            } else {
                res.json([]);
            }
        }
    } catch (error) {
        console.error('Error retrieving testimonials for admin:', error);
        res.status(500).json({ error: 'Failed to retrieve testimonials' });
    }
});

// In-memory storage for bookings and contacts (fallback when database unavailable)
let bookings = [];
let contacts = [];

// Database storage functions
async function saveBookingToDatabase(booking) {
    if (db) {
        try {
            const collection = db.collection('bookings');
            await collection.insertOne(booking);
            console.log('Booking saved to database:', booking.id);
            return true;
        } catch (error) {
            console.error('Error saving booking to database:', error);
            return false;
        }
    }
    return false;
}

async function saveContactToDatabase(contact) {
    if (db) {
        try {
            const collection = db.collection('contacts');
            await collection.insertOne(contact);
            console.log('Contact saved to database:', contact.id);
            return true;
        } catch (error) {
            console.error('Error saving contact to database:', error);
            return false;
        }
    }
    return false;
}

async function getAllBookings() {
    if (db) {
        try {
            const collection = db.collection('bookings');
            return await collection.find({}).sort({ timestamp: -1 }).toArray();
        } catch (error) {
            console.error('Error retrieving bookings from database:', error);
        }
    }
    return bookings; // Fallback to memory storage
}

async function getAllContacts() {
    if (db) {
        try {
            const collection = db.collection('contacts');
            return await collection.find({}).sort({ timestamp: -1 }).toArray();
        } catch (error) {
            console.error('Error retrieving contacts from database:', error);
        }
    }
    return contacts; // Fallback to memory storage
}

// Admin endpoint to get all bookings
app.get('/admin/bookings', async (req, res) => {
    try {
        const allBookings = await getAllBookings();
        res.json({
            success: true,
            bookings: allBookings
        });
    } catch (error) {
        console.error('Error retrieving bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve bookings'
        });
    }
});

// Admin endpoint to get all contacts
app.get('/admin/contacts', async (req, res) => {
    try {
        const allContacts = await getAllContacts();
        res.json({
            success: true,
            contacts: allContacts
        });
    } catch (error) {
        console.error('Error retrieving contacts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve contacts'
        });
    }
});

// Admin endpoint to update a booking (placeholder)
app.put('/admin/bookings/:id', (req, res) => {
    const bookingId = req.params.id;
    const updateData = req.body;
    
    // In a real application, you would update the booking in the database
    console.log(`Updating booking ${bookingId} with:`, updateData);
    
    res.json({
        success: true,
        message: `Booking ${bookingId} updated successfully`
    });
});

// Admin endpoint to delete a booking (placeholder)
app.delete('/admin/bookings/:id', (req, res) => {
    const bookingId = req.params.id;
    
    // In a real application, you would delete the booking from the database
    console.log(`Deleting booking ${bookingId}`);
    
    res.json({
        success: true,
        message: `Booking ${bookingId} deleted successfully`
    });
});

// Legacy endpoints for compatibility with old admin page
app.get("/bookings.json", requireAuth, async (req, res) => {
    try {
        const allBookings = await getAllBookings();
        res.json(allBookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
});

app.get("/contacts.json", requireAuth, async (req, res) => {
    try {
        const allContacts = await getAllContacts();
        res.json(allContacts);
    } catch (error) {
        console.error("Error fetching contacts:", error);
        res.status(500).json({ error: "Failed to fetch contacts" });
    }
});

app.get("/testimonials.json", requireAuth, async (req, res) => {
    try {
        if (db) {
            // Get testimonials from MongoDB
            const collection = db.collection('testimonials');
            const testimonials = await collection.find({}).sort({ date: -1 }).toArray();
            res.json(testimonials);
        } else {
            // Fallback to file-based testimonials
            const testimonialsPath = path.join(__dirname, 'testimonials.json');
            if (fs.existsSync(testimonialsPath)) {
                const testimonials = JSON.parse(fs.readFileSync(testimonialsPath, 'utf8'));
                res.json(testimonials);
            } else {
                res.json([]);
            }
        }
    } catch (error) {
        console.error("Error fetching testimonials:", error);
        res.status(500).json({ error: "Failed to fetch testimonials" });
    }
});

app.delete("/delete-testimonial/:id", requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        
        if (db) {
            // Delete from MongoDB
            const collection = db.collection('testimonials');
            const result = await collection.deleteOne({ id: parseInt(id) });
            
            if (result.deletedCount > 0) {
                res.json({ status: "success", message: "Testimonial deleted successfully" });
            } else {
                res.status(404).json({ status: "error", message: "Testimonial not found" });
            }
        } else {
            // Delete from file if database is not available
            const testimonialsPath = path.join(__dirname, 'testimonials.json');
            if (fs.existsSync(testimonialsPath)) {
                let testimonials = JSON.parse(fs.readFileSync(testimonialsPath, 'utf8'));
                
                // Filter out the testimonial with the given ID
                testimonials = testimonials.filter(t => t.id != id);
                
                // Write back to file
                fs.writeFileSync(testimonialsPath, JSON.stringify(testimonials, null, 2));
                res.json({ status: "success", message: "Testimonial deleted successfully" });
            } else {
                res.status(404).json({ status: "error", message: "Testimonials file not found" });
            }
        }
    } catch (error) {
        console.error("Error deleting testimonial:", error);
        res.status(500).json({ error: "Failed to delete testimonial" });
    }
});

// Function to start server with dynamic port assignment
function startServer(port = 3000) {
    const server = app.listen(port, () => {
        logger.info(`Server is running on http://localhost:${port}`);
        logger.info('Ankes Lodge website is now accessible at the above address.');
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is busy, trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Error occurred:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error occurred.'
    });
});

// Convert environment PORT to number, default to 3000 if not available or invalid
const initialPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
startServer(initialPort)
;