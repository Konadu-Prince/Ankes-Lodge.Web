const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Add MongoDB support
let MongoClient;
try {
    ({ MongoClient } = require('mongodb'));
} catch (err) {
    console.log('MongoDB driver not available, falling back to file-based storage');
    MongoClient = null;
}

// Add node-fetch for self-pinging
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Add path module for file operations
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 8000;

// Improved static file serving for Render.com
app.use(express.static('.', {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set cache control for different file types
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// Session storage for logged-in admins
const adminSessions = new Map();

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

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Middleware to parse URL-encoded bodies (for form submissions)
app.use(bodyParser.urlencoded({ extended: true }));

// Authentication middleware
function requireAuth(req, res, next) {
    // Check if this is a request to login page or login endpoint (allow without auth)
    if (req.path === '/login.html' || req.path === '/admin/login' || req.path === '/admin/logout') {
        return next();
    }
    
    // Check if this is a request to admin panel
    if (req.path === '/admin.html' || req.path.startsWith('/admin/')) {
        // Check for session cookie
        const sessionId = req.headers.authorization || req.query.session;
        
        if (!sessionId || !adminSessions.has(sessionId)) {
            // Redirect to login page
            return res.redirect('/login.html');
        }
    }
    
    // Allow public API endpoints without authentication
    if (req.path === '/process-contact' || req.path === '/process-booking' || 
        req.path === '/add-testimonial' || req.path === '/visitor-count' ||
        req.path === '/testimonials.json' || req.path === '/bookings.json' ||
        req.path === '/contacts.json') {
        return next();
    }
    
    next();
}

// Apply authentication middleware to all routes
app.use(requireAuth);

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

// Add MongoDB connection and database adapters
let db;
let mongoClient;

async function connectToMongo() {
    try {
        // Get MongoDB URI from environment variables
        const uri = process.env.MONGODB_URI;
        if (!uri || !MongoClient) {
            console.log('MONGODB_URI not set or MongoDB driver not available, falling back to file-based storage');
            return false;
        }
        
        mongoClient = new MongoClient(uri);
        await mongoClient.connect();
        db = mongoClient.db('ankes-lodge');
        console.log('Connected to MongoDB Atlas');
        return true;
    } catch (error) {
        console.error('Failed to connect to MongoDB Atlas:', error);
        return false;
    }
}

// MongoDB Database Adapter
class MongoDatabase {
    constructor(collectionName) {
        this.collectionName = collectionName;
    }

    async read() {
        try {
            if (!db) return [];
            const collection = db.collection(this.collectionName);
            return await collection.find({}).toArray();
        } catch (err) {
            console.error(`Error reading from MongoDB collection ${this.collectionName}:`, err);
            return [];
        }
    }

    async write(data) {
        try {
            if (!db) return false;
            const collection = db.collection(this.collectionName);
            // Clear existing data
            await collection.deleteMany({});
            // Insert new data
            if (data.length > 0) {
                await collection.insertMany(data);
            }
            return true;
        } catch (err) {
            console.error(`Error writing to MongoDB collection ${this.collectionName}:`, err);
            return false;
        }
    }

    async append(newItem) {
        try {
            if (!db) return false;
            const collection = db.collection(this.collectionName);
            await collection.insertOne(newItem);
            return true;
        } catch (err) {
            console.error(`Error appending to MongoDB collection ${this.collectionName}:`, err);
            return false;
        }
    }

    async find(filter) {
        try {
            if (!db) return [];
            const collection = db.collection(this.collectionName);
            return await collection.find(filter).toArray();
        } catch (err) {
            console.error(`Error finding in MongoDB collection ${this.collectionName}:`, err);
            return [];
        }
    }

    async findOne(filter) {
        try {
            if (!db) return null;
            const collection = db.collection(this.collectionName);
            return await collection.findOne(filter);
        } catch (err) {
            console.error(`Error finding one in MongoDB collection ${this.collectionName}:`, err);
            return null;
        }
    }

    async update(filter, update) {
        try {
            if (!db) return false;
            const collection = db.collection(this.collectionName);
            const result = await collection.updateMany(filter, { $set: update });
            return result.modifiedCount > 0;
        } catch (err) {
            console.error(`Error updating in MongoDB collection ${this.collectionName}:`, err);
            return false;
        }
    }

    async delete(filter) {
        try {
            if (!db) return 0;
            const collection = db.collection(this.collectionName);
            const result = await collection.deleteMany(filter);
            return result.deletedCount;
        } catch (err) {
            console.error(`Error deleting from MongoDB collection ${this.collectionName}:`, err);
            return 0;
        }
    }
}

// File-based Database Adapter (fallback)
class FileDatabase {
    constructor(filename) {
        this.filename = filename;
        this.locks = new Map();
    }

    // Acquire a lock for the file
    async acquireLock() {
        return new Promise((resolve) => {
            const checkLock = () => {
                if (!this.locks.has(this.filename)) {
                    this.locks.set(this.filename, true);
                    resolve();
                } else {
                    setTimeout(checkLock, 10); // Check every 10ms
                }
            };
            checkLock();
        });
    }

    // Release a lock for the file
    releaseLock() {
        this.locks.delete(this.filename);
    }

    // Read data from file with locking
    async read() {
        await this.acquireLock();
        try {
            if (fs.existsSync(this.filename)) {
                const data = fs.readFileSync(this.filename, 'utf8');
                return JSON.parse(data);
            }
            return [];
        } catch (err) {
            console.error(`Error reading ${this.filename}:`, err);
            return [];
        } finally {
            this.releaseLock();
        }
    }

    // Write data to file with locking
    async write(data) {
        await this.acquireLock();
        try {
            // Ensure directory exists
            const dir = path.dirname(this.filename);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.filename, JSON.stringify(data, null, 2));
            return true;
        } catch (err) {
            console.error(`Error writing ${this.filename}:`, err);
            return false;
        } finally {
            this.releaseLock();
        }
    }

    // Append data to file
    async append(newItem) {
        const data = await this.read();
        data.push(newItem);
        return await this.write(data);
    }

    // Find items in the data
    async find(filterFn) {
        const data = await this.read();
        return data.filter(filterFn);
    }

    // Find one item in the data
    async findOne(filterFn) {
        const data = await this.read();
        return data.find(filterFn);
    }

    // Update items in the data
    async update(filterFn, updateFn) {
        const data = await this.read();
        let updated = false;
        const updatedData = data.map(item => {
            if (filterFn(item)) {
                updated = true;
                return updateFn(item);
            }
            return item;
        });
        if (updated) {
            return await this.write(updatedData);
        }
        return false;
    }

    // Delete items from the data
    async delete(filterFn) {
        const data = await this.read();
        const filteredData = data.filter(item => !filterFn(item));
        if (filteredData.length !== data.length) {
            return await this.write(filteredData);
        }
        return false;
    }
}

// Database instances
let bookingsDB;
let contactsDB;
let testimonialsDB;
let visitorCounterDB;

// Initialize database connections
async function initializeDatabases() {
    const useMongo = await connectToMongo();
    
    if (useMongo) {
        // Use MongoDB
        bookingsDB = new MongoDatabase('bookings');
        contactsDB = new MongoDatabase('contacts');
        testimonialsDB = new MongoDatabase('testimonials');
        visitorCounterDB = new MongoDatabase('visitorCounter');
    } else {
        // Fallback to file-based storage
        bookingsDB = new FileDatabase('data/bookings.json');
        contactsDB = new FileDatabase('data/contacts.json');
        testimonialsDB = new FileDatabase('data/testimonials.json');
        visitorCounterDB = new FileDatabase('data/visitor-counter.json');
        
        // Ensure data directory exists
        if (!fs.existsSync('data')) {
            fs.mkdirSync('data');
        }
    }
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
        console.log('Attempting to send confirmation email to:', booking.email);
        const startTime = Date.now();
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Email sending attempt took ${endTime - startTime}ms`);
            
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
        console.log('Attempting to send admin notification email to: ankeslodge@gmail.com');
        const startTime = Date.now();
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Admin email sending attempt took ${endTime - startTime}ms`);
            
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

// Serve testimonials.json file
app.get('/testimonials.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'testimonials.json'));
});

// Serve admin page with proper routing
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve login page with proper routing
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
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
    async (req, res) => {
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

        // Create booking record using database abstraction
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

        try {
            // Save booking using database abstraction
            await bookingsDB.append(booking);
            
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
app.post('/process-contact', async (req, res) => {
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

    // Create contact record using database abstraction
    const contact = {
        id: uuidv4().substring(0, 8),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        name,
        email,
        subject,
        message
    };

    try {
        // Save contact using database abstraction
        await contactsDB.append(contact);
        
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
        console.log('Attempting to send contact confirmation email to:', contact.email);
        const startTime = Date.now();
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Contact confirmation email sending attempt took ${endTime - startTime}ms`);
            
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
        console.log('Attempting to send contact admin notification email to: ankeslodge@gmail.com');
        const startTime = Date.now();
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Contact admin email sending attempt took ${endTime - startTime}ms`);
        
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

// Endpoint to add new testimonial
app.post('/add-testimonial', async (req, res) => {
    const { name, location, comment, rating } = req.body;
    
    // Validate required fields
    if (!name || !comment) {
        return res.status(400).json({
            status: 'error',
            message: 'Name and comment are required.'
        });
    }
    
    // Validate rating
    const ratingValue = parseInt(rating);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        return res.status(400).json({
            status: 'error',
            message: 'Rating must be a number between 1 and 5.'
        });
    }
    
    // Read existing testimonials using database abstraction
    let testimonials = [];
    try {
        testimonials = await testimonialsDB.read();
    } catch (err) {
        testimonials = [];
    }
    
    // Create new testimonial
    const newTestimonial = {
        id: testimonials.length > 0 ? Math.max(...testimonials.map(t => t.id)) + 1 : 1,
        name,
        location: location || '',
        comment,
        rating: ratingValue,
        date: new Date().toISOString().split('T')[0]
    };
    
    try {
        // Save testimonial using database abstraction
        await testimonialsDB.append(newTestimonial);
        
        // Send notification email to admin
        sendTestimonialAdminNotification(newTestimonial).then(() => {
            res.json({
                status: 'success',
                message: 'Thank you for your testimonial!',
                testimonial: newTestimonial
            });
        }).catch((error) => {
            console.log('Error sending testimonial notification email:', error);
            res.json({
                status: 'success',
                message: 'Thank you for your testimonial!',
                testimonial: newTestimonial
            });
        });
    } catch (err) {
        console.error('Error saving testimonial:', err);
        res.status(500).json({
            status: 'error',
            message: 'Failed to save testimonial. Please try again later.'
        });
    }
});// Function to send notification email to admin for new testimonial
function sendTestimonialAdminNotification(testimonial) {
    // If transporter is not configured, skip email sending
    if (!transporter) {
        console.log('Email transporter not configured, logging testimonial admin notification to console');
        console.log('=== TESTIMONIAL ADMIN NOTIFICATION EMAIL ===');
        console.log(`To: ankeslodge@gmail.com`);
        console.log(`Subject: New Testimonial Submitted - Ankes Lodge`);
        console.log(`Body:`);
        console.log(`A new testimonial has been submitted. Details:`);
        console.log(`Name: ${testimonial.name}`);
        console.log(`Location: ${testimonial.location || 'Not provided'}`);
        console.log(`Rating: ${testimonial.rating}/5 stars`);
        console.log(`Comment: ${testimonial.comment}`);
        console.log(`Date: ${testimonial.date}`);
        console.log(`Testimonial ID: ${testimonial.id}`);
        console.log('============================================');
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: 'ankeslodge@gmail.com',
        to: 'ankeslodge@gmail.com', // Admin email
        subject: `New Testimonial Submitted - Ankes Lodge`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
                    <img src="https://konadu-prince.github.io/Ankes-Lodge.Web/orangeLogo.png" alt="Ankes Lodge Logo" style="max-width: 100px; margin-bottom: 10px;">
                    <h1 style="color: #333; margin: 0;">Ankes Lodge</h1>
                    <p style="color: #666; margin: 5px 0;">Luxury Guest House in Abesim</p>
                </div>
                
                <div style="background-color: #fff; padding: 30px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <h2 style="color: #333;">New Testimonial Received</h2>
                    <p>A visitor has submitted a new testimonial for Ankes Lodge.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #ffa500; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Testimonial Details</h3>
                        <p><strong>Testimonial ID:</strong> ${testimonial.id}</p>
                        <p><strong>Name:</strong> ${testimonial.name}</p>
                        <p><strong>Location:</strong> ${testimonial.location || 'Not provided'}</p>
                        <p><strong>Rating:</strong> ${'★'.repeat(testimonial.rating)}${'☆'.repeat(5 - testimonial.rating)} (${testimonial.rating}/5 stars)</p>
                        <p><strong>Date:</strong> ${testimonial.date}</p>
                        <p><strong>Comment:</strong></p>
                        <div style="background-color: #fff; padding: 15px; border-radius: 4px; border-left: 3px solid #ffa500;">
                            <p style="margin: 0; font-style: italic;">"${testimonial.comment}"</p>
                        </div>
                    </div>
                    
                    <div style="background-color: #e8f4e8; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Admin Actions</h3>
                        <p>You can view and manage this testimonial in the admin panel:</p>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="https://ankes-lodge.onrender.com/admin.html" style="display: inline-block; background-color: #FFA500; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Testimonials</a>
                        </div>
                        <p style="margin-bottom: 0;">Log in to approve, edit, or remove this testimonial as needed.</p>
                    </div>

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
        console.log('Attempting to send testimonial admin notification email to: ankeslodge@gmail.com');
        const startTime = Date.now();
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Testimonial admin email sending attempt took ${endTime - startTime}ms`);
            
            if (error) {
                console.log('Testimonial admin notification error:', error.message);
                // Log the email content as fallback
                console.log('=== TESTIMONIAL ADMIN EMAIL FALLBACK LOG ===');
                console.log(`To: ankeslodge@gmail.com`);
                console.log(`Subject: New Testimonial Submitted - Ankes Lodge`);
                console.log('Content:', mailOptions.html);
                console.log('================================================');
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Testimonial admin notification sent: ' + info.response);
                resolve();
            }
        });
    });
}

// Endpoint to get visitor count
app.get('/visitor-count', async (req, res) => {
    let counter = { count: 0 };
    
    // Read existing counter using database abstraction
    try {
        const counters = await visitorCounterDB.read();
        if (counters.length > 0) {
            counter = counters[0];
        }
    } catch (err) {
        counter = { count: 0 };
    }
    
    // Increment counter
    counter.count += 1;
    
    // Save updated counter using database abstraction
    try {
        await visitorCounterDB.write([counter]);
    } catch (err) {
        console.error('Error updating visitor counter:', err);
    }
    
    res.json({ count: counter.count });
});// Endpoint to delete a testimonial
app.delete('/delete-testimonial/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid testimonial ID.'
        });
    }
    
    // Read existing testimonials using database abstraction
    let testimonials = [];
    try {
        testimonials = await testimonialsDB.read();
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Failed to read testimonials data.'
        });
    }
    
    // Find the testimonial to delete
    const testimonialIndex = testimonials.findIndex(t => t.id === id);
    
    if (testimonialIndex === -1) {
        return res.status(404).json({
            status: 'error',
            message: 'Testimonial not found.'
        });
    }
    
    // Remove the testimonial
    testimonials.splice(testimonialIndex, 1);
    
    // Save updated testimonials using database abstraction
    try {
        await testimonialsDB.write(testimonials);
        res.json({
            status: 'success',
            message: 'Testimonial deleted successfully.'
        });
    } catch (err) {
        console.error('Error saving testimonials:', err);
        res.status(500).json({
            status: 'error',
            message: 'Failed to save testimonials. Please try again later.'
        });
    }
});// Add login endpoint
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    // Read admin credentials
    let adminCredentials = { username: 'admin', password: 'ankeslodge2025' };
    try {
        if (fs.existsSync('admin-credentials.json')) {
            const data = fs.readFileSync('admin-credentials.json', 'utf8');
            adminCredentials = JSON.parse(data);
        }
    } catch (err) {
        console.error('Error reading admin credentials:', err);
    }
    
    // Check credentials
    if (username === adminCredentials.username && password === adminCredentials.password) {
        // Generate session ID
        const sessionId = uuidv4();
        
        // Store session (in production, use a proper session store like Redis)
        adminSessions.set(sessionId, {
            username: username,
            loginTime: new Date()
        });
        
        // Send success response with session ID
        res.json({
            success: true,
            sessionId: sessionId
        });
    } else {
        // Send failure response
        res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }
});

// Add logout endpoint
app.post('/admin/logout', (req, res) => {
    const sessionId = req.headers.authorization || req.query.session;
    
    if (sessionId && adminSessions.has(sessionId)) {
        adminSessions.delete(sessionId);
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error occurred. Please try again later.'
    });
});

// Add health check endpoint for external monitoring
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Add simple ping endpoint for self-pinging
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Add self-pinging mechanism to prevent sleep on Render.com free tier
function startSelfPinger() {
    // Only run on Render.com and in production
    if (process.env.RENDER && process.env.NODE_ENV === 'production') {
        console.log('Starting self-pinger to prevent sleep on Render.com free tier');
        
        // Ping the server every 14 minutes (840000 ms)
        setInterval(async () => {
            try {
                const url = `http://${process.env.RENDER_SERVICE_NAME}.onrender.com`;
                console.log(`Pinging self at ${url} to prevent sleep`);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Self-Pinger/1.0'
                    }
                });
                
                console.log(`Self-ping response: ${response.status}`);
            } catch (error) {
                console.error('Self-ping failed:', error.message);
            }
        }, 14 * 60 * 1000); // 14 minutes
    } else {
        console.log('Self-pinger not started - not running on Render.com or not in production');
    }
}

// For Vercel deployment, we need to export the app
module.exports = app;

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
    console.log('Starting server...');
    console.log(`PORT environment variable: ${process.env.PORT}`);
    console.log(`Using PORT: ${PORT}`);
    
    // Initialize databases before starting the server
    initializeDatabases().then(() => {
        console.log('Database initialization complete');
        
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running at http://0.0.0.0:${PORT}`);
            console.log(`Environment variables status:`);
            console.log(`- EMAIL_USER: ${process.env.EMAIL_USER ? 'SET' : 'NOT SET'}`);
            console.log(`- EMAIL_PASS: ${process.env.EMAIL_PASS ? 'SET' : 'NOT SET'}`);
            console.log(`- MONGODB_URI: ${process.env.MONGODB_URI ? 'SET' : 'NOT SET'}`);
            console.log(`- PORT: ${PORT}`);
            
            // Start self-pinger after server is running
            startSelfPinger();
            
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
            // Close MongoDB connection if it exists
            if (mongoClient) {
                mongoClient.close();
            }
            server.close(() => {
                console.log('Process terminated');
            });
        });
    }).catch(err => {
        console.error('Failed to initialize databases:', err);
        process.exit(1);
    });
}