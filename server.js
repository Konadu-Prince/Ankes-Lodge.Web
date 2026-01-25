const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

// EmailJS Cloud Service
const emailjs = require('@emailjs/browser');
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

// Add crypto module for webhook signature verification
const crypto = require('crypto');

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
        
        // Check if session has expired (24 hour expiration)
        const session = adminSessions.get(sessionId);
        const now = new Date();
        const sessionAge = now - session.loginTime;
        const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        if (sessionAge > maxSessionAge) {
            // Session expired, remove it and redirect to login
            adminSessions.delete(sessionId);
            return res.redirect('/login.html');
        }
    }
    
    // Allow public API endpoints without authentication
    if (req.path === '/process-contact' || req.path === '/process-booking' || 
        req.path === '/add-testimonial' || req.path === '/visitor-count' ||
        req.path === '/testimonials.json' || req.path === '/bookings.json' ||
        req.path === '/contacts.json' ||
        req.path === '/initiate-payment' || req.path === '/webhook/paystack' ||
        req.path.startsWith('/verify-payment/') || req.path.startsWith('/payment-status/')) {
        return next();
    }
    
    next();
}

// Apply authentication middleware to all routes
app.use(requireAuth);

// Set trust proxy for Render.com deployment
app.set('trust proxy', 1);

// Rate limiting for public API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  trustProxy: true, // Enable trust proxy for Render.com
});

// Helper function to conditionally log based on environment
// Only log verbose information in development/non-production environments
const nodeEnv = process.env.NODE_ENV || 'development';
const isDevelopment = nodeEnv !== 'production';

function conditionalLog(...args) {
  if (isDevelopment) {
    console.log(...args);
  }
}

function conditionalLogObject(obj) {
  if (isDevelopment && obj) {
    // For development, log the full object
    console.log(JSON.stringify(obj, null, 2));
  } else if (!isDevelopment && obj) {
    // For production, log only non-sensitive keys
    const safeKeys = {};
    for (const key in obj) {
      if (key.toLowerCase().includes('email') || key.toLowerCase().includes('phone') || 
          key.toLowerCase().includes('message') || key.toLowerCase().includes('pass')) {
        safeKeys[key] = '[REDACTED FOR PRIVACY]';
      } else {
        safeKeys[key] = obj[key];
      }
    }
    console.log(JSON.stringify(safeKeys, null, 2));
  }
}

// Create a reusable transporter object using Gmail SMTP or development email service
// Note: In production, use environment variables for credentials
let transporter;
try {
    // Check if environment variables are set
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const nodeEnv = process.env.NODE_ENV || 'development';
                
    // Debug logging for environment variables
    console.log('=== EMAIL CONFIGURATION DEBUG ===');
    console.log('EMAIL_USER env var:', emailUser ? `${emailUser.substring(0, 5)}...` : 'NOT SET');
    console.log('EMAIL_PASS env var:', emailPass ? 'SET (hidden for security)' : 'NOT SET');
    console.log('NODE_ENV:', nodeEnv);
                
    if (!emailUser || !emailPass) {
        console.log('EMAIL_USER and EMAIL_PASS environment variables are required for email functionality');
        console.log('Please set these environment variables in your deployment platform');
        console.log('For Gmail, use App Passwords, not regular passwords');
        console.log('Generate App Password at: https://myaccount.google.com/apppasswords');
        transporter = null;
    } else {
        console.log('Creating transporter with provided credentials...');
        
        // Check if we're in development and using a testing service
        if (nodeEnv === 'development' && emailUser.includes('ethereal')) {
            // Ethereal.email testing service
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: emailUser,
                    pass: emailPass
                }
            });
        } else if (nodeEnv === 'development' && emailUser.includes('mailtrap')) {
            // Mailtrap testing service
            transporter = nodemailer.createTransport({
                host: 'smtp.mailtrap.io',
                port: 2525,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: emailUser,
                    pass: emailPass
                }
            });
        } else {
            // Check if we're on Render.com specifically
            const isRender = process.env.RENDER !== undefined;
            
            if (isRender) {
                // For Render.com, use alternative configuration that works better with their environment
                transporter = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: 587,
                    secure: false,
                    auth: {
                        user: emailUser,
                        pass: emailPass
                    },
                    // Render.com specific settings
                    connectionTimeout: 60000,
                    greetingTimeout: 45000,
                    socketTimeout: 60000,
                    tls: {
                        rejectUnauthorized: false,
                        minVersion: 'TLSv1.2',
                        ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
                    },
                    // Reduce connection pool for Render.com
                    pool: true,
                    maxConnections: 1,
                    maxMessages: 10
                });
            } else {
                // Production Gmail SMTP with enhanced settings for Render.com
                transporter = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: 587,
                    secure: false, // true for 465, false for other ports
                    auth: {
                        user: emailUser,
                        pass: emailPass
                    },
                    // Enhanced timeout and connection settings for Render.com
                    timeout: 60000, // 60 seconds
                    connectionTimeout: 60000, // 60 seconds
                    greetingTimeout: 60000, // 60 seconds
                    // Additional security and connection settings
                    requireTLS: true,
                    tls: {
                        rejectUnauthorized: false,
                        ciphers: 'SSLv3',
                        minVersion: 'TLSv1.2'
                    },
                    // Pool settings for better performance
                    pool: true,
                    maxConnections: 2,
                    maxMessages: 50,
                    // Keepalive settings
                    socketTimeout: 60000,
                    debug: true
                });
            }
        }
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
        
        // Create indexes for better query performance
        await createIndexes();
        
        return true;
    } catch (error) {
        console.error('Failed to connect to MongoDB Atlas:', error);
        return false;
    }
}

// Create indexes for better query performance
async function createIndexes() {
    try {
        if (!db) return;
        
        // Create indexes for bookings collection
        const bookingsCollection = db.collection('bookings');
        await bookingsCollection.createIndex({ email: 1 });
        await bookingsCollection.createIndex({ timestamp: -1 });
        await bookingsCollection.createIndex({ status: 1 });
        
        // Create indexes for contacts collection
        const contactsCollection = db.collection('contacts');
        await contactsCollection.createIndex({ email: 1 });
        await contactsCollection.createIndex({ timestamp: -1 });
        
        // Create indexes for testimonials collection
        const testimonialsCollection = db.collection('testimonials');
        await testimonialsCollection.createIndex({ timestamp: -1 });
        
        // Create indexes for visitorCounter collection
        const visitorCounterCollection = db.collection('visitorCounter');
        await visitorCounterCollection.createIndex({ id: 1 });
        
        console.log('MongoDB indexes created successfully');
    } catch (error) {
        console.error('Failed to create MongoDB indexes:', error);
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
            
            // For small datasets, separate operations might be more efficient than bulk
            // Delete all existing documents
            await collection.deleteMany({});
            
            // Insert all new documents in a single batch if data is not empty
            if (data.length > 0) {
                // Flatten the data array if it contains arrays
                const flattenedData = Array.isArray(data[0]) ? [].concat(...data) : data;
                await collection.insertMany(flattenedData);
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

    async createIndex(indexSpec, options = {}) {
        try {
            if (!db) return false;
            const collection = db.collection(this.collectionName);
            await collection.createIndex(indexSpec, options);
            return true;
        } catch (err) {
            console.error(`Error creating index on ${this.collectionName}:`, err);
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

// Paystack Configuration and Initialization
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;

// Initialize payments database
let paymentsDB;

// Initialize payments database
try {
    paymentsDB = new MongoDatabase('payments');
    console.log('Payments database initialized');
} catch (error) {
    console.error('Failed to initialize payments database:', error);
    paymentsDB = new FileDatabase('data/payments.json');
    console.log('Payments database initialized with file fallback');
}

// Function to initialize Paystack transaction
async function initializePaystackPayment(paymentData) {
    try {
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: paymentData.email,
                amount: paymentData.amount * 100, // Paystack expects amount in kobo
                reference: paymentData.reference,
                callback_url: paymentData.callback_url,
                metadata: {
                    booking_id: paymentData.booking_id,
                    customer_name: paymentData.customer_name,
                    room_type: paymentData.room_type
                }
            })
        });

        const result = await response.json();
        
        if (result.status) {
            // Save payment record
            const paymentRecord = {
                id: paymentData.reference,
                booking_id: paymentData.booking_id,
                customer_email: paymentData.email,
                customer_name: paymentData.customer_name,
                amount: paymentData.amount,
                currency: 'GHS',
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                paystack_reference: result.data.reference,
                authorization_url: result.data.authorization_url
            };
            
            await paymentsDB.append(paymentRecord);
            
            return {
                success: true,
                authorization_url: result.data.authorization_url,
                reference: result.data.reference
            };
        } else {
            throw new Error(result.message || 'Failed to initialize payment');
        }
    } catch (error) {
        console.error('Error initializing Paystack payment:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Function to verify Paystack transaction
async function verifyPaystackPayment(reference) {
    try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
            }
        });

        const result = await response.json();
        
        if (result.status) {
            const data = result.data;
            
            // Update payment record
            const paymentRecord = {
                id: data.reference,
                booking_id: data.metadata.booking_id,
                customer_email: data.customer.email,
                customer_name: data.metadata.customer_name,
                amount: data.amount / 100, // Convert from kobo to GHS
                currency: data.currency,
                status: data.status,
                gateway_response: data.gateway_response,
                paid_at: data.paid_at,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                paystack_reference: data.reference,
                authorization: data.authorization
            };
            
            // Update the payment record in the database
            const existingPayment = await paymentsDB.findOne({ id: data.reference });
            if (existingPayment) {
                await paymentsDB.update({ id: data.reference }, paymentRecord);
            } else {
                await paymentsDB.append(paymentRecord);
            }
            
            return {
                success: true,
                data: paymentRecord
            };
        } else {
            throw new Error(result.message || 'Failed to verify payment');
        }
    } catch (error) {
        console.error('Error verifying Paystack payment:', error);
        return {
            success: false,
            error: error.message
        };
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
        conditionalLog('Email transporter not configured, logging booking confirmation to console');
        conditionalLog('=== BOOKING CONFIRMATION EMAIL ===');
        conditionalLog(`To: ${booking.email}`);
        conditionalLog(`Subject: Booking Confirmation - Ankes Lodge (Booking ID: ${booking.id})`);
        conditionalLog(`Body:`);
        conditionalLog(`Dear ${booking.name},`);
        conditionalLog(`Thank you for booking with Ankes Lodge. Your booking details are as follows:`);
        conditionalLog(`Booking ID: ${booking.id}`);
        conditionalLog(`Name: ${booking.name}`);
        conditionalLog(`Check-in Date: ${booking.checkin}`);
        conditionalLog(`Check-out Date: ${booking.checkout}`);
        conditionalLog(`Adults: ${booking.adults}`);
        conditionalLog(`Children: ${booking.children}`);
        conditionalLog(`Room Type: ${getRoomTypeName(booking.roomType)}`);
        conditionalLog(`Special Requests: ${booking.message || 'None'}`);
        conditionalLog(`We will contact you shortly to confirm your reservation and provide payment details.`);
        conditionalLog(`Best regards, Ankes Lodge Team`);
        conditionalLog('====================================');
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com',
        to: booking.email,
        subject: `Booking Confirmation - Ankes Lodge (Booking ID: ${booking.id})`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
                    <img src="https://ankes-lodge.onrender.com/orangeLogo.png" alt="Ankes Lodge Logo" style="max-width: 100px; margin-bottom: 10px;">
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
                    
                    <p>We will contact you shortly to confirm your reservation. Payment options are available below:</p>
                    
                    <div style="background-color: #e8f4e8; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Payment Options</h3>
                        <p>Required Amount: ₵${booking.required_amount || booking.amount}</p>
                        <p>Pay now securely through our Paystack payment gateway:</p>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="https://ankes-lodge.onrender.com" style="display: inline-block; background-color: #FFA500; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Pay Now</a>
                        </div>
                        <p>Or pay on arrival at the lodge.</p>
                    </div>
                    
                    <p>For any inquiries, please contact us.</p>
                    
                    <div style="background-color: #e8f4e8; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Contact Information</h3>
                        <p>To reach the customer directly:</p>
                        <p><strong>Customer Phone:</strong> <a href="tel:${booking.phone}">${booking.phone}</a></p>
                        <p><strong>Customer Email:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
                        <p><strong>General Manager:</strong> 0544904547, 0558647156</p>
                        <p><strong>Managers:</strong> 0248293512</p>
                        <p><strong>Website:</strong> <a href="https://ankes-lodge.onrender.com">View Our Website</a></p>
                    </div>
                    
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
        console.log('Attempting to send confirmation email to:', booking.email);
        const startTime = Date.now();
        
        // Always log email content to console for debugging purposes
        console.log('=== BOOKING CONFIRMATION EMAIL CONTENT ===');
        console.log(`To: ${booking.email}`);
        console.log(`Subject: Booking Confirmation - Ankes Lodge (Booking ID: ${booking.id})`);
        console.log('Content:');
        console.log(mailOptions.html);
        console.log('=========================================');
        
        // If transporter is not configured, skip actual sending
        if (!transporter) {
            console.log('Email transporter not configured - email not sent, content logged above for debugging');
            return resolve();
        }
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Email sending attempt took ${endTime - startTime}ms`);
            
            if (error) {
                console.log('Email sending error:', error.message);
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Confirmation email sent successfully: ' + info.response);
                resolve();
            }
        });
    });
}

// Function to send notification email to admin
function sendAdminNotification(booking) {
    // If transporter is not configured, skip email sending
    if (!transporter) {
        conditionalLog('Email transporter not configured, logging admin notification to console');
        conditionalLog('=== ADMIN NOTIFICATION EMAIL ===');
        conditionalLog(`To: ${process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com'}`);
        conditionalLog(`Subject: New Booking Request - Ankes Lodge (Booking ID: ${booking.id})`);
        conditionalLog(`Body:`);
        conditionalLog(`A new booking request has been submitted. Details:`);
        conditionalLog(`Booking ID: ${booking.id}`);
        conditionalLog(`Timestamp: ${booking.timestamp}`);
        conditionalLog(`Name: ${booking.name}`);
        conditionalLog(`Email: ${booking.email}`);
        conditionalLog(`Phone: ${booking.phone}`);
        conditionalLog(`Check-in Date: ${booking.checkin}`);
        conditionalLog(`Check-out Date: ${booking.checkout}`);
        conditionalLog(`Adults: ${booking.adults}`);
        conditionalLog(`Children: ${booking.children}`);
        conditionalLog(`Room Type: ${getRoomTypeName(booking.roomType)}`);
        conditionalLog(`Special Requests: ${booking.message || 'None'}`);
        conditionalLog(`Please follow up with the customer to confirm the booking.`);
        conditionalLog('================================');
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com',
        to: process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com', // Admin email
        subject: `New Booking Request - Ankes Lodge (Booking ID: ${booking.id})`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
                    <img src="https://ankes-lodge.onrender.com/orangeLogo.png" alt="Ankes Lodge Logo" style="max-width: 100px; margin-bottom: 10px;">
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
                        <a href="https://ankes-lodge.onrender.com" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Visit Our Website</a>
                    </div>
                    
                    <p>Please follow up with the customer to confirm the booking.</p>
                    
                    <div style="background-color: #e8f4e8; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 3px;">
                        <h3 style="color: #333; margin-top: 0;">Contact Information</h3>
                        <p>To reach the customer directly:</p>
                        <p><strong>Customer Phone:</strong> <a href="tel:${booking.phone}">${booking.phone}</a></p>
                        <p><strong>Customer Email:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
                        <p><strong>General Manager:</strong> 0544904547, 0558647156</p>
                        <p><strong>Managers:</strong>0248293512</p>
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
        
        // Always log email content to console for debugging purposes
        conditionalLog('=== ADMIN NOTIFICATION EMAIL CONTENT ===');
        conditionalLog(`To: ${process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com'}`);
        conditionalLog(`Subject: New Booking Request - Ankes Lodge (Booking ID: ${booking.id})`);
        conditionalLog('Content:');
        conditionalLog(mailOptions.html);
        conditionalLog('=======================================');
        
        // If transporter is not configured, skip actual sending
        if (!transporter) {
            console.log('Email transporter not configured - email not sent, content logged above for debugging');
            return resolve();
        }
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Admin email sending attempt took ${endTime - startTime}ms`);
            
            if (error) {
                console.log('Admin notification error:', error.message);
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Admin notification sent successfully: ' + info.response);
                resolve();
            }
        });
    });
}

// Email queue for asynchronous processing
const emailQueue = [];
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

// Function to process the email queue
async function processEmailQueue() {
    if (emailQueue.length === 0) return;
    
    const emailJob = emailQueue[0];
    
    try {
        console.log(`Processing email job for ${emailJob.type} to ${emailJob.recipient}`);
        
        // Send the email based on type
        if (emailJob.type === 'confirmation') {
            await sendConfirmationEmail(emailJob.data);
        } else if (emailJob.type === 'admin-notification') {
            await sendAdminNotification(emailJob.data);
        } else if (emailJob.type === 'contact-confirmation') {
            await sendContactConfirmationEmail(emailJob.data);
        } else if (emailJob.type === 'contact-admin') {
            await sendContactAdminNotification(emailJob.data);
        } else if (emailJob.type === 'date-change-confirmation') {
            await sendDateChangeConfirmationEmail(emailJob.data);
        } else if (emailJob.type === 'refund-confirmation') {
            await sendRefundConfirmationEmail(emailJob.data);
        }
        
        // Remove the job from the queue if successful
        emailQueue.shift();
        console.log(`Email job completed successfully for ${emailJob.type}`);
    } catch (error) {
        console.log(`Email job failed for ${emailJob.type}:`, error.message);
        emailJob.attempts += 1;
        
        if (emailJob.attempts < MAX_RETRY_ATTEMPTS) {
            console.log(`Retrying email job (${emailJob.attempts}/${MAX_RETRY_ATTEMPTS}) in ${RETRY_DELAY}ms`);
            setTimeout(() => processEmailQueue(), RETRY_DELAY);
        } else {
            console.log(`Max retry attempts reached for ${emailJob.type}. Moving to next job.`);
            // Log the failed job for manual handling
            console.log('=== FAILED EMAIL JOB ===');
            console.log('Type:', emailJob.type);
            console.log('Recipient:', emailJob.recipient);
            console.log('Data:', emailJob.data);
            console.log('=======================');
            // Remove the failed job and continue with the next one
            emailQueue.shift();
        }
    }
    
    // Process the next job if there are more in the queue
    if (emailQueue.length > 0) {
        setTimeout(() => processEmailQueue(), 1000); // Process next job after 1 second
    }
}

// Function to add email jobs to the queue
function queueEmail(type, recipient, data) {
    const emailJob = {
        type,
        recipient,
        data,
        attempts: 0,
        timestamp: new Date()
    };
    
    emailQueue.push(emailJob);
    console.log(`Email job queued: ${type} to ${recipient}`);
    
    // Start processing the queue if it was empty
    if (emailQueue.length === 1) {
        setTimeout(() => processEmailQueue(), 100);
    }
}

// Helper function to get room type name
function getRoomTypeName(roomType) {
    const roomTypes = {
        'executive': 'Executive Room (₵350/night)',
        'regular': 'Regular Bedroom (₵250/night)',
        'semi-standard': 'Semi Standard Room (₵300/night)',
        'full-house': 'Full House (Custom Pricing)'
    };
    return roomTypes[roomType] || roomType;
}

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve bookings.json data
app.get('/bookings.json', async (req, res) => {
    try {
        const bookings = await bookingsDB.read();
        res.json(bookings);
    } catch (err) {
        console.error('Error reading bookings:', err);
        res.status(500).json({ error: 'Failed to load bookings' });
    }
});// Serve testimonials.json data
app.get('/testimonials.json', async (req, res) => {
    try {
        const testimonials = await testimonialsDB.read();
        res.json(testimonials);
    } catch (err) {
        console.error('Error reading testimonials:', err);
        res.status(500).json({ error: 'Failed to load testimonials' });
    }
});

// Serve contacts.json data
app.get('/contacts.json', async (req, res) => {
    try {
        const contacts = await contactsDB.read();
        res.json(contacts);
    } catch (err) {
        console.error('Error reading contacts:', err);
        res.status(500).json({ error: 'Failed to load contacts' });
    }
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
    apiLimiter,
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
            message,
            payment_method
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
        const validRoomTypes = ['executive', 'regular', 'semi-standard', 'full-house'];
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

        // Calculate number of nights
        const timeDiff = checkoutDate.getTime() - checkinDate.getTime();
        const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        // Define room prices
        const roomPricesForCalc = {
            'executive': 350,
            'regular': 250,
            'semi-standard': 300, // Semi standard room price
            'full-house': 1000 // Default price for full house
        };
        
        // Calculate total amount
        const roomPriceForCalc = roomPricesForCalc[roomType] || 350;
        const totalAmount = roomPriceForCalc * nights;
        
        // Define the required amount for the booking
        const requiredAmount = totalAmount;

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
            status: 'pending',
            payment_status: 'pending',
            amount: totalAmount,
            required_amount: requiredAmount, // Store the required amount for payment verification
            nights: nights
        };

        try {
            // Save booking using database abstraction
            await bookingsDB.append(booking);
            
            // Check if payment is required
            if (payment_method === 'paystack') {
                // Initialize Paystack payment
                const paymentResult = await initializePaystackPayment({
                    booking_id: booking.id,
                    email: booking.email,
                    customer_name: booking.name,
                    room_type: booking.roomType,
                    amount: booking.amount,
                    reference: `ANKES_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    callback_url: `${req.protocol}://${req.get('host')}/payment-success`
                });
                
                if (paymentResult.success) {
                    // Return payment URL for frontend to redirect
                    res.json({
                        status: 'success',
                        message: 'Booking created successfully. Redirecting to payment page...',
                        bookingId: booking.id,
                        payment_url: paymentResult.authorization_url,
                        amount: booking.amount
                    });
                } else {
                    // If payment initialization failed, still save the booking but return error
                    res.status(500).json({
                        status: 'error',
                        message: 'Booking created but payment initialization failed. Please contact support.',
                        bookingId: booking.id
                    });
                }
            } else {
                // No payment required, proceed with normal flow
                // Queue confirmation email to customer and notification to admin
                queueEmail('confirmation', booking.email, booking);
                queueEmail('admin-notification', process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com', booking)
                
                console.log('Booking form processed successfully - emails queued');
                res.json({
                    status: 'success',
                    message: 'Booking request submitted successfully! A confirmation email will be sent to your email address. We will contact you shortly to confirm your reservation.',
                    bookingId: booking.id,
                    amount: totalAmount
                });
            }
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
app.post('/process-contact', apiLimiter, async (req, res) => {
    // Debug: Log request start (conditionally)
    conditionalLog('=== CONTACT FORM REQUEST START ===');
    conditionalLog('Request method:', req.method);
    conditionalLog('Request URL:', req.url);
    conditionalLog('Request headers:', req.headers);
    
    // Debug: Log all incoming data (conditionally)
    conditionalLog('=== CONTACT FORM DEBUG ===');
    conditionalLogObject(req.body);
    conditionalLog('Keys in body:', Object.keys(req.body));
    
    // Debug: Check each field individually (conditionally)
    conditionalLog('Checking individual fields:');
    conditionalLog('contact-name in body:', 'contact-name' in req.body);
    conditionalLog('contact-email in body:', 'contact-email' in req.body);
    conditionalLog('subject in body:', 'subject' in req.body);
    conditionalLog('contact-message in body:', 'contact-message' in req.body);
    
    // Debug: Log raw values (conditionally)
    conditionalLog('Raw values:');
    conditionalLog('req.body[\'contact-name\']:', req.body['contact-name']);
    conditionalLog('req.body[\'contact-email\']:', req.body['contact-email']);
    conditionalLog('req.body[\'subject\']:', req.body['subject']);
    conditionalLog('req.body[\'contact-message\']:', req.body['contact-message']);
    
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
            // Queue confirmation email to the customer and notification to admin
            queueEmail('contact-confirmation', contact.email, contact);
            queueEmail('contact-admin', process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com', contact)
            
            console.log('Contact form processed successfully - emails queued');
            res.json({
                status: 'success',
                message: 'Thank you for your message! We will get back to you soon.'
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
            console.log(`To: ${process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com'}`);
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
        conditionalLog('Email transporter not configured, logging contact confirmation to console');
        conditionalLog('=== CONTACT CONFIRMATION EMAIL ===');
        conditionalLog(`To: ${contact.email}`);
        conditionalLog(`Subject: Re: ${contact.subject}`);
        conditionalLog(`Body:`);
        conditionalLog(`Dear ${contact.name},`);
        conditionalLog(`Thank you for contacting Ankes Lodge. We have received your message and will get back to you soon.`);
        conditionalLog(`Your message: ${contact.message}`);
        conditionalLog(`Best regards, Ankes Lodge Team`);
        conditionalLog('====================================');
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com',
        to: contact.email,
        subject: `Re: ${contact.subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
                    <img src="https://ankes-lodge.onrender.com/orangeLogo.png" alt="Ankes Lodge Logo" style="max-width: 100px; margin-bottom: 10px;">
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
                        <p><strong>General Manager:</strong> 0544904547, 0558647156</p>
                        <p><strong>Managers:</strong> 0248293512</p>
                        <p><strong>Website:</strong> <a href="https://ankes-lodge.onrender.com">View Our Website</a></p>
                    </div>
                    
                    <p>We typically respond within 24 hours. If you need immediate assistance, please call us at <strong>0544904547</strong>, <strong>0558647156</strong></p>
                    
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
        console.log('Attempting to send contact confirmation email to:', contact.email);
        const startTime = Date.now();
        
        // Always log email content to console for debugging purposes
        conditionalLog('=== CONTACT CONFIRMATION EMAIL CONTENT ===');
        conditionalLog(`To: ${contact.email}`);
        conditionalLog(`Subject: Re: ${contact.subject}`);
        conditionalLog('Content:');
        conditionalLog(mailOptions.html);
        conditionalLog('============================================');
        
        // If transporter is not configured, skip actual sending
        if (!transporter) {
            console.log('Email transporter not configured - email not sent, content logged above for debugging');
            return resolve();
        }
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Contact confirmation email sending attempt took ${endTime - startTime}ms`);
            
            if (error) {
                console.log('Contact confirmation email error:', error.message);
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Contact confirmation email sent successfully: ' + info.response);
                resolve();
            }
        });
    });
}

// Function to send notification email to admin for contact form
function sendContactAdminNotification(contact) {
    // If transporter is not configured, skip email sending
    if (!transporter) {
        conditionalLog('Email transporter not configured, logging contact notification to console');
        conditionalLog('=== CONTACT NOTIFICATION EMAIL ===');
        conditionalLog(`To: ${process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com'}`);
        conditionalLog(`Subject: New Contact Message - ${contact.subject}`);
        conditionalLog(`Body:`);
        conditionalLog(`A new contact message has been received. Details:`);
        conditionalLog(`Name: ${contact.name}`);
        conditionalLog(`Email: ${contact.email}`);
        conditionalLog(`Subject: ${contact.subject}`);
        conditionalLog(`Message: ${contact.message}`);
        conditionalLog(`Received: ${contact.timestamp}`);
        conditionalLog('==================================');
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com',
        to: process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com', // Admin email
        subject: `New Contact Message - ${contact.subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
                    <img src="https://ankes-lodge.onrender.com/orangeLogo.png" alt="Ankes Lodge Logo" style="max-width: 100px; margin-bottom: 10px;">
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
                        <p><strong>General Manager:</strong> 0248293512</p>
                        <p><strong>Managers:</strong> 0544904547, 0558647156</p>
                        <p>Website: <a href="https://ankes-lodge.onrender.com">View Our Website</a></p>
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
        console.log('Attempting to send contact admin notification email to:', process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com');
        const startTime = Date.now();
        
        // Always log email content to console for debugging purposes
        conditionalLog('=== CONTACT ADMIN NOTIFICATION EMAIL CONTENT ===');
        conditionalLog(`To: ${process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com'}`);
        conditionalLog(`Subject: New Contact Message - ${contact.subject}`);
        conditionalLog('Content:');
        conditionalLog(mailOptions.html);
        conditionalLog('================================================');
        
        // If transporter is not configured, skip actual sending
        if (!transporter) {
            console.log('Email transporter not configured - email not sent, content logged above for debugging');
            return resolve();
        }
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Contact admin email sending attempt took ${endTime - startTime}ms`);
        
            if (error) {
                console.log('Contact admin notification error:', error.message);
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Contact admin notification sent successfully: ' + info.response);
                resolve();
            }
        });
    });
}

// Endpoint to add new testimonial
app.post('/add-testimonial', apiLimiter, async (req, res) => {
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
        console.log(`To: ${process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com'}`);
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
        from: process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com',
        to: process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com', // Admin email
        subject: `New Testimonial Submitted - Ankes Lodge`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
                    <img src="https://ankes-lodge.onrender.com/orangeLogo.png" alt="Ankes Lodge Logo" style="max-width: 100px; margin-bottom: 10px;">
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
                    <p>Contact: 0544904547, 0558647156</p>
                    <p>&copy; 2025 Ankes Lodge. All rights reserved.</p>
                </div>
            </div>
        `
    };

    // Return a promise for better error handling
    return new Promise((resolve, reject) => {
        console.log('Attempting to send testimonial admin notification email to:', process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com');
        const startTime = Date.now();
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Testimonial admin email sending attempt took ${endTime - startTime}ms`);
            
            if (error) {
                console.log('Testimonial admin notification error:', error.message);
                // Log the email content as fallback
                console.log('=== TESTIMONIAL ADMIN EMAIL FALLBACK LOG ===');
                console.log(`To: ${process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com'}`);
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
    try {
        // Use atomic increment operation to avoid race conditions
        if (db) {
            // MongoDB implementation with atomic increment
            const visitorCounterCollection = db.collection('visitorCounter');
            const result = await visitorCounterCollection.findOneAndUpdate(
                { id: 'global' },
                { $inc: { count: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            
            const count = result.value ? result.value.count : 1;
            res.json({ count });
        } else {
            // Fallback to file-based implementation with locking
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
        }
    } catch (error) {
        console.error('Error in visitor counter:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to get views count (same as visitor count)
app.get('/views', async (req, res) => {
    try {
        if (db) {
            // MongoDB implementation
            const visitorCounterCollection = db.collection('visitorCounter');
            const result = await visitorCounterCollection.findOne({ id: 'global' });
            
            const count = result ? result.count : 0;
            res.json({ views: count });
        } else {
            // Fallback to database abstraction
            let counter = { count: 0 };
            
            try {
                const counters = await visitorCounterDB.read();
                if (counters.length > 0) {
                    counter = counters[0];
                }
            } catch (err) {
                counter = { count: 0 };
            }
            
            const views = counter.count || 0;
            res.json({ views });
        }
    } catch (error) {
        console.error('Error getting views count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to increment views count
app.post('/increment-views', async (req, res) => {
    try {
        if (db) {
            // MongoDB implementation with atomic increment
            const visitorCounterCollection = db.collection('visitorCounter');
            const result = await visitorCounterCollection.findOneAndUpdate(
                { id: 'global' },
                { $inc: { count: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            
            const count = result.value ? result.value.count : 1;
            res.json({ views: count });
        } else {
            // Fallback to database abstraction
            let counter = { count: 0 };
            
            try {
                const counters = await visitorCounterDB.read();
                if (counters.length > 0) {
                    counter = counters[0];
                }
            } catch (err) {
                counter = { count: 0 };
            }
            
            counter.count += 1;
            
            try {
                // Update or create the counter record
                const existingCounter = await visitorCounterDB.findOne({ id: 'global' });
                if (existingCounter) {
                    await visitorCounterDB.update({ id: 'global' }, { count: counter.count, id: 'global' });
                } else {
                    await visitorCounterDB.append({ count: counter.count, id: 'global' });
                }
            } catch (err) {
                console.error('Error updating views counter:', err);
            }
            
            res.json({ views: counter.count });
        }
    } catch (error) {
        console.error('Error incrementing views count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
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
});// Rate limiting for admin login to prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true, // Enable trust proxy for Render.com
});

// Add login endpoint
app.post('/admin/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    
    // Read admin credentials - prioritize MongoDB as main storage
    let adminCredentials = null;
    
    // Try to read from MongoDB first (main storage)
    if (db) {
        try {
            const adminCredentialsCollection = db.collection('admin_credentials');
            const mongoCredentials = await adminCredentialsCollection.findOne({ type: 'admin' });
            if (mongoCredentials) {
                adminCredentials = {
                    username: mongoCredentials.username,
                    password: mongoCredentials.password
                };
                console.log('Using admin credentials from MongoDB (primary storage)');
            }
        } catch (err) {
            console.error('Error reading admin credentials from MongoDB:', err);
        }
    }
    
    // If not found in MongoDB, try file as backup
    if (!adminCredentials || !adminCredentials.username || !adminCredentials.password) {
        try {
            if (fs.existsSync('admin-credentials.json')) {
                const data = fs.readFileSync('admin-credentials.json', 'utf8');
                adminCredentials = JSON.parse(data);
                console.log('Using admin credentials from file (backup storage)');
            }
        } catch (err) {
            console.error('Error reading admin credentials from file:', err);
        }
    }
    
    // Use default credentials if not found in MongoDB, file, or as fallback
    if (!adminCredentials || !adminCredentials.username || !adminCredentials.password) {
        console.log('Using default admin credentials - please update MongoDB or admin-credentials.json for security');
        adminCredentials = { 
            username: 'admin', 
            password: '$2b$10$2TyiZf7fnhatV3/ejXdoMerPU2imRQ346t66ADYAmPxJ2cDBFViCS' // bcrypt hash of 'ankeslodge2025'
        };
    }
    
    // Check credentials using bcrypt for password comparison
    if (username === adminCredentials.username && bcrypt.compareSync(password, adminCredentials.password)) {
        // Generate session ID
        const sessionId = uuidv4();
        
        // Store session (in production, use a proper session store like Redis)
        adminSessions.set(sessionId, {
            username: username,
            loginTime: new Date()
        });
        
        // Log successful login
        logAuditAction(username, 'login', { sessionId: sessionId.substring(0, 8) + '...' }, req.ip, req.get('User-Agent'));
        
        // Send success response with session ID
        res.json({
            success: true,
            sessionId: sessionId
        });
    } else {
        // Log failed login attempt
        logAuditAction('unknown', 'failed-login', { username, reason: 'invalid-credentials' }, req.ip, req.get('User-Agent'));
        
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
        const session = adminSessions.get(sessionId);
        logAuditAction(session.username, 'logout', { sessionId: sessionId.substring(0, 8) + '...' }, req.ip, req.get('User-Agent'));
        adminSessions.delete(sessionId);
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Endpoint to update admin credentials (only accessible when logged in)
app.post('/admin/update-credentials', requireAuth, async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    
    if (!newPassword || !confirmNewPassword) {
        return res.status(400).json({
            success: false,
            message: 'New password and confirmation are required'
        });
    }
    
    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
            success: false,
            message: 'New password and confirmation do not match'
        });
    }
    
    if (newPassword.length < 8) {
        return res.status(400).json({
            success: false,
            message: 'New password must be at least 8 characters long'
        });
    }
    
    try {
        // Read current credentials - prioritize MongoDB as main storage
        let adminCredentials = null;
        
        // Try to read from MongoDB first (main storage)
        if (db) {
            try {
                const adminCredentialsCollection = db.collection('admin_credentials');
                const mongoCredentials = await adminCredentialsCollection.findOne({ type: 'admin' });
                if (mongoCredentials) {
                    adminCredentials = {
                        username: mongoCredentials.username,
                        password: mongoCredentials.password
                    };
                }
            } catch (err) {
                console.error('Error reading admin credentials from MongoDB:', err);
            }
        }
        
        // If not found in MongoDB, try file as backup
        if (!adminCredentials) {
            try {
                if (fs.existsSync('admin-credentials.json')) {
                    const data = fs.readFileSync('admin-credentials.json', 'utf8');
                    adminCredentials = JSON.parse(data);
                }
            } catch (err) {
                console.error('Error reading admin credentials from file:', err);
            }
        }
        
        // Use default if not found anywhere
        if (!adminCredentials) {
            adminCredentials = { 
                username: 'admin', 
                password: '$2b$10$2TyiZf7fnhatV3/ejXdoMerPU2imRQ346t66ADYAmPxJ2cDBFViCS' // bcrypt hash of 'ankeslodge2025'
            };
        }
        
        // Verify current password
        const validCurrentPassword = bcrypt.compareSync(currentPassword, adminCredentials.password);
        if (!validCurrentPassword) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }
        
        // Hash the new password
        const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
        
        // Update credentials
        const updatedCredentials = {
            username: adminCredentials.username,
            password: hashedNewPassword
        };
        
        // Save to file
        fs.writeFileSync('admin-credentials.json', JSON.stringify(updatedCredentials, null, 2));
        
        // Update in MongoDB (primary storage)
        if (db) {
            const adminCredentialsCollection = db.collection('admin_credentials');
            await adminCredentialsCollection.updateOne(
                { type: 'admin' },
                { $set: updatedCredentials },
                { upsert: true }
            );
        }
        
        res.json({
            success: true,
            message: 'Admin credentials updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating admin credentials:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update credentials'
        });
    }
});

// Admin API Endpoints

// Get all bookings from MongoDB
app.get('/admin/bookings', requireAuth, async (req, res) => {
    try {
        const bookings = await bookingsDB.find({});
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Get all contacts from MongoDB
app.get('/admin/contacts', requireAuth, async (req, res) => {
    try {
        const contacts = await contactsDB.find({});
        res.json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

// Get all testimonials from MongoDB
app.get('/admin/testimonials', requireAuth, async (req, res) => {
    try {
        const testimonials = await testimonialsDB.find({});
        res.json(testimonials);
    } catch (error) {
        console.error('Error fetching testimonials:', error);
        res.status(500).json({ error: 'Failed to fetch testimonials' });
    }
});

// Delete testimonial
app.delete('/admin/testimonials/:id', requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid testimonial ID' });
        }
        
        await testimonialsDB.delete({ id: id });
        res.json({ status: 'success', message: 'Testimonial deleted successfully' });
    } catch (error) {
        console.error('Error deleting testimonial:', error);
        res.status(500).json({ error: 'Failed to delete testimonial' });
    }
});

// Paystack Payment Endpoints

// Initialize donation payment
app.post('/initiate-donation', async (req, res) => {
    try {
        const { email, customer_name, amount, callback_url, donation_purpose } = req.body;
        
        // Validate required fields
        if (!customer_name || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: customer_name, amount'
            });
        }
        
        // Validate amount
        const donationAmount = parseFloat(amount);
        if (isNaN(donationAmount) || donationAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount provided'
            });
        }
        
        // If email is not provided, try to use a default
        let donationEmail = email;
        if (!donationEmail) {
            donationEmail = 'donation@ankes-lodge.onrender.com'; // Default email for donations
        }
        
        // Generate a unique reference for this donation
        const reference = `DONATION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Initialize donation with Paystack
        const paymentResult = await initializePaystackPayment({
            booking_id: reference, // Using reference as booking_id for donations
            email: donationEmail,
            customer_name,
            room_type: 'donation',
            amount: donationAmount,
            reference,
            callback_url: callback_url || `${req.protocol}://${req.get('host')}/payment-success`
        });
        
        if (paymentResult.success) {
            res.json({
                success: true,
                authorization_url: paymentResult.authorization_url,
                reference: paymentResult.reference,
                message: 'Donation payment initialized successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: paymentResult.error || 'Failed to initialize donation payment'
            });
        }
    } catch (error) {
        console.error('Error in /initiate-donation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Initialize Paystack payment
app.post('/initiate-payment', async (req, res) => {
    try {
        const { booking_id, email, customer_name, room_type, amount, callback_url } = req.body;
        
        // Validate required fields
        if (!booking_id || !customer_name || !room_type || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: booking_id, email, customer_name, room_type, amount'
            });
        }
        
        // Validate amount
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount provided'
            });
        }
        
        // If email is not provided, fetch it from the booking record
        let bookingEmail = email;
        if (!bookingEmail) {
            const booking = await bookingsDB.findOne({ id: booking_id });
            if (booking) {
                bookingEmail = booking.email;
            } else {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
            }
        }
        
        // Generate a unique reference for this transaction
        const reference = `ANKES_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Initialize payment with Paystack
        const paymentResult = await initializePaystackPayment({
            booking_id,
            email: bookingEmail,
            customer_name,
            room_type,
            amount: paymentAmount,
            reference,
            callback_url: callback_url || `${req.protocol}://${req.get('host')}/payment-success`
        });
        
        if (paymentResult.success) {
            res.json({
                success: true,
                authorization_url: paymentResult.authorization_url,
                reference: paymentResult.reference,
                message: 'Payment initialized successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: paymentResult.error || 'Failed to initialize payment'
            });
        }
    } catch (error) {
        console.error('Error in /initiate-payment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Verify Paystack payment
app.post('/verify-payment/:reference', async (req, res) => {
    try {
        const { reference } = req.params;
        
        if (!reference) {
            return res.status(400).json({
                success: false,
                message: 'Payment reference is required'
            });
        }
        
        const verificationResult = await verifyPaystackPayment(reference);
        
        if (verificationResult.success) {
            // Update the booking status if payment is successful
            if (verificationResult.data.status === 'success') {
                // Find the booking by the payment reference and update its status
                const booking = await bookingsDB.findOne({ id: verificationResult.data.booking_id });
                if (booking) {
                    // Update booking status to confirmed
                    await bookingsDB.update({ id: booking.id }, { ...booking, status: 'confirmed', payment_status: 'paid' });
                    
                    // Send confirmation email to customer
                    queueEmail('confirmation', booking.email, { ...booking, status: 'confirmed' });
                    
                    // Send notification to admin
                    queueEmail('admin-notification', process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com', { ...booking, status: 'confirmed' });
                }
            }
            
            res.json({
                success: true,
                data: verificationResult.data,
                message: 'Payment verified successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: verificationResult.error || 'Failed to verify payment'
            });
        }
    } catch (error) {
        console.error('Error in /verify-payment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Paystack Webhook Endpoint
app.post('/webhook/paystack', async (req, res) => {
    try {
        // Get the event payload
        const event = req.body;
        
        // Verify webhook signature
        const signature = req.headers['x-paystack-signature'];
        
        if (!signature) {
            return res.status(400).send('No signature provided');
        }
        
        // Verify the signature to ensure the request is from Paystack
        // Paystack uses SHA512-HMAC and sends the signature as hex
        const expectedSignature = crypto
            .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
            .update(JSON.stringify(req.body))
            .digest('hex');
        
        if (signature !== expectedSignature) {
            console.log('Invalid Paystack webhook signature');
            console.log('Expected:', expectedSignature);
            console.log('Received:', signature);
            return res.status(400).send('Invalid signature');
        }
        
        const eventType = event.event;
        const data = event.data;
        
        console.log(`Paystack webhook received: ${eventType}`);
        
        switch (eventType) {
            case 'charge.success':
                // Update payment status in database
                const paymentRecord = {
                    id: data.reference,
                    booking_id: data.metadata.booking_id,
                    customer_email: data.customer.email,
                    customer_name: data.metadata.customer_name,
                    amount: data.amount / 100, // Convert from kobo to GHS
                    currency: data.currency,
                    status: 'success',
                    gateway_response: data.gateway_response,
                    paid_at: data.paid_at,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    paystack_reference: data.reference,
                    authorization: data.authorization
                };
                
                // Update the payment record in the database
                const existingPayment = await paymentsDB.findOne({ id: data.reference });
                if (existingPayment) {
                    await paymentsDB.update({ id: data.reference }, paymentRecord);
                } else {
                    await paymentsDB.append(paymentRecord);
                }
                
                // Update the booking status to confirmed
                const booking = await bookingsDB.findOne({ id: data.metadata.booking_id });
                if (booking) {
                    // Check payment amount against required amount
                    const requiredAmount = booking.required_amount || booking.amount;
                    const paidAmount = data.amount / 100; // Convert from kobo to GHS
                    
                    let payment_status = 'paid';
                    let booking_status = 'confirmed';
                    let payment_note = '';
                    
                    // Check if payment is less than required
                    if (paidAmount < requiredAmount) {
                        payment_status = 'underpaid';
                        booking_status = 'pending_payment';
                        payment_note = `Payment of ₵${paidAmount} is less than required amount of ₵${requiredAmount}.`;
                        console.log(`Payment underpaid for booking ${booking.id}: Paid ₵${paidAmount}, Required ₵${requiredAmount}`);
                    } 
                    // Check if payment is more than required (donation)
                    else if (paidAmount > requiredAmount) {
                        payment_status = 'overpaid';
                        payment_note = `Payment of ₵${paidAmount} is more than required amount of ₵${requiredAmount}. Extra amount (₵${(paidAmount - requiredAmount).toFixed(2)}) considered as donation.`;
                        console.log(`Payment overpaid for booking ${booking.id}: Paid ₵${paidAmount}, Required ₵${requiredAmount}. Extra is donation.`);
                    }
                    
                    // Update booking with payment validation results
                    const updatedBooking = { 
                        ...booking, 
                        status: booking_status, 
                        payment_status: payment_status,
                        paid_amount: paidAmount,
                        required_amount: requiredAmount,
                        payment_note: payment_note
                    };
                    
                    await bookingsDB.update({ id: booking.id }, updatedBooking);
                    
                    // Send confirmation email to customer
                    queueEmail('confirmation', booking.email, updatedBooking);
                    
                    // Send notification to admin
                    queueEmail('admin-notification', process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com', updatedBooking);
                }
                
                break;
            
            case 'payment.failed':
                // Update payment status to failed
                const failedPaymentRecord = {
                    id: data.reference,
                    booking_id: data.metadata.booking_id,
                    customer_email: data.customer.email,
                    customer_name: data.metadata.customer_name,
                    amount: data.amount / 100, // Convert from kobo to GHS
                    currency: data.currency,
                    status: 'failed',
                    gateway_response: data.gateway_response,
                    paid_at: data.paid_at,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    paystack_reference: data.reference
                };
                
                await paymentsDB.update({ id: data.reference }, failedPaymentRecord);
                
                // Update the booking status to failed
                const failedBooking = await bookingsDB.findOne({ id: data.metadata.booking_id });
                if (failedBooking) {
                    await bookingsDB.update({ id: failedBooking.id }, { ...failedBooking, status: 'failed', payment_status: 'failed' });
                }
                
                break;
            
            default:
                console.log(`Unhandled Paystack event: ${eventType}`);
        }
        
        // Respond with 200 OK to acknowledge receipt
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Error processing Paystack webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Get payment status
app.get('/payment-status/:reference', async (req, res) => {
    try {
        const { reference } = req.params;
        
        if (!reference) {
            return res.status(400).json({
                success: false,
                message: 'Payment reference is required'
            });
        }
        
        const payment = await paymentsDB.findOne({ id: reference });
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }
        
        res.json({
            success: true,
            data: payment
        });
    } catch (error) {
        console.error('Error getting payment status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
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

// Payment success page route
app.get('/payment-success', async (req, res) => {
    // Get reference from query parameters if available
    const reference = req.query.reference || req.query.ref;
    
    // Create a success page that shows payment was successful
    // and provides links back to the site
    let bookingDetails = null;
    let paymentDetails = null;
    
    // If we have a reference, try to fetch booking details
    if (reference) {
        try {
            // First, try to find payment details
            paymentDetails = await paymentsDB.findOne({ id: reference });
            
            if (paymentDetails && paymentDetails.booking_id) {
                // Find the associated booking
                bookingDetails = await bookingsDB.findOne({ id: paymentDetails.booking_id });
            }
        } catch (error) {
            console.log('Could not fetch booking details:', error.message);
        }
    }
    
    // Create a dynamic success page
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Success - Ankes Lodge</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                .container {
                    background-color: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 600px;
                    width: 90%;
                }
                .success-icon {
                    font-size: 60px;
                    color: #28a745;
                    margin-bottom: 20px;
                }
                h1 {
                    color: #28a745;
                    margin-top: 0;
                }
                .payment-details {
                    background-color: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 15px 0;
                    text-align: left;
                    font-size: 14px;
                }
                .payment-details p {
                    margin: 5px 0;
                }
                .btn {
                    display: inline-block;
                    background-color: #FFA500;
                    color: white;
                    padding: 12px 25px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 8px;
                    font-weight: bold;
                    border: none;
                    cursor: pointer;
                }
                .btn:hover {
                    background-color: #e69500;
                }
                .btn-secondary {
                    background-color: #6c757d;
                }
                .btn-secondary:hover {
                    background-color: #5a6268;
                }
                .btn-donation {
                    background-color: #28a745;
                }
                .btn-donation:hover {
                    background-color: #218838;
                }
                .btn-container {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 10px;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">✓</div>
                <h1>Payment Successful!</h1>
                <p>Thank you for your payment. Your transaction has been processed successfully.</p>
                
                ${bookingDetails ? `
                <div class="payment-details">
                    <h3>Booking Details</h3>
                    <p><strong>Booking ID:</strong> ${bookingDetails.id}</p>
                    <p><strong>Guest Name:</strong> ${bookingDetails.name}</p>
                    <p><strong>Room Type:</strong> ${getRoomTypeName(bookingDetails.roomType)}</p>
                    <p><strong>Check-in:</strong> ${bookingDetails.checkin}</p>
                    <p><strong>Check-out:</strong> ${bookingDetails.checkout}</p>
                    <p><strong>Required Amount:</strong> ₵${bookingDetails.required_amount || bookingDetails.amount}</p>
                    <p><strong>Status:</strong> ${bookingDetails.status}</p>
                    ${bookingDetails.payment_note ? `<p><strong>Note:</strong> ${bookingDetails.payment_note}</p>` : ''}
                </div>
                ` : ''}
                
                ${paymentDetails ? `
                <div class="payment-details">
                    <h3>Payment Details</h3>
                    <p><strong>Reference:</strong> ${paymentDetails.id}</p>
                    <p><strong>Amount Paid:</strong> ₵${paymentDetails.amount}</p>
                    <p><strong>Payment Status:</strong> ${paymentDetails.status}</p>
                    <p><strong>Paid At:</strong> ${paymentDetails.paid_at ? new Date(paymentDetails.paid_at).toLocaleString() : 'N/A'}</p>
                </div>
                ` : ''}
                
                <p>You will receive a confirmation email with your booking details shortly.</p>
                
                <div class="btn-container">
                    <a href="/" class="btn">Return to Home</a>
                    <a href="/booking-confirmation.html" class="btn">View Booking</a>
                    <button class="btn btn-donation" onclick="initiateDonation()">Make a Donation</button>
                    <a href="/" class="btn btn-secondary">Book Another Room</a>
                </div>
            </div>
            
            <script>
                function initiateDonation() {
                    // Create donation form
                    const donationForm = document.createElement('form');
                    donationForm.method = 'POST';
                    donationForm.action = '/initiate-donation';
                    donationForm.style.display = 'none';
                    
                    // Add form fields
                    const emailField = document.createElement('input');
                    emailField.type = 'hidden';
                    emailField.name = 'email';
                    emailField.value = '${bookingDetails && bookingDetails.email ? bookingDetails.email : 'donation@ankes-lodge.onrender.com'}';
                    
                    const nameField = document.createElement('input');
                    nameField.type = 'hidden';
                    nameField.name = 'customer_name';
                    nameField.value = '${bookingDetails && bookingDetails.name ? bookingDetails.name : 'Ankes Lodge Supporter'}';
                    
                    const amountField = document.createElement('input');
                    amountField.type = 'number';
                    amountField.name = 'amount';
                    amountField.placeholder = 'Donation amount';
                    amountField.required = true;
                    
                    const purposeField = document.createElement('input');
                    purposeField.type = 'hidden';
                    purposeField.name = 'donation_purpose';
                    purposeField.value = 'Support Ankes Lodge';
                    
                    // Add fields to form
                    donationForm.appendChild(emailField);
                    donationForm.appendChild(nameField);
                    donationForm.appendChild(amountField);
                    donationForm.appendChild(purposeField);
                    
                    document.body.appendChild(donationForm);
                    
                    // Ask for donation amount
                    const amount = prompt('Enter donation amount (GHS):');
                    if (amount && !isNaN(amount) && amount > 0) {
                        amountField.value = amount;
                        donationForm.submit();
                    } else {
                        alert('Please enter a valid donation amount');
                    }
                    
                    // Remove form after submission
                    setTimeout(() => {
                        document.body.removeChild(donationForm);
                    }, 1000);
                }
            </script>
        </body>
        </html>
    `);
});

// Payment failure page route
app.get('/payment-failed', (req, res) => {
    // Create a failure page that shows payment failed
    // and provides links back to the site
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Failed - Ankes Lodge</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                .container {
                    background-color: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 500px;
                    width: 90%;
                }
                .error-icon {
                    font-size: 60px;
                    color: #dc3545;
                    margin-bottom: 20px;
                }
                h1 {
                    color: #dc3545;
                    margin-top: 0;
                }
                .btn {
                    display: inline-block;
                    background-color: #FFA500;
                    color: white;
                    padding: 12px 25px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 10px;
                    font-weight: bold;
                }
                .btn:hover {
                    background-color: #e69500;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error-icon">✕</div>
                <h1>Payment Failed</h1>
                <p>Your payment could not be processed. Please try again or contact our support team.</p>
                <div>
                    <a href="/" class="btn">Return to Home</a>
                    <a href="javascript:history.back()" class="btn">Try Again</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// For Vercel deployment, we need to export the app

// Booking modification and refund endpoints

// Update booking dates
app.post('/admin/update-booking-dates/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { checkin, checkout } = req.body;
        
        // Validate dates
        if (!checkin || !checkout) {
            return res.status(400).json({ error: 'Check-in and check-out dates are required' });
        }
        
        const booking = await bookingsDB.findOne({ id });
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Update the booking with new dates
        const updatedBooking = {
            ...booking,
            checkin,
            checkout,
            updated_at: new Date().toISOString()
        };
        
        await bookingsDB.update({ id }, updatedBooking);
        
        // Log the date change action
        logAuditAction(req.user?.username || 'admin', 'update-booking-dates', { 
            bookingId: id, 
            oldCheckin: booking.checkin, 
            oldCheckout: booking.checkout,
            newCheckin: checkin,
            newCheckout: checkout,
            reason: req.body.reason
        }, req.ip, req.get('User-Agent'));
        
        // Send notification email about date change
        queueEmail('date-change-confirmation', booking.email, {
            ...updatedBooking,
            old_checkin: booking.checkin,
            old_checkout: booking.checkout
        });
        
        res.json({ success: true, booking: updatedBooking });
    } catch (error) {
        console.error('Error updating booking dates:', error);
        res.status(500).json({ error: 'Failed to update booking dates' });
    }
});

// Process refund for a booking
app.post('/admin/process-refund/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, amount, refund_method } = req.body;
        
        const booking = await bookingsDB.findOne({ id });
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Update booking status to refunded
        const updatedBooking = {
            ...booking,
            status: 'refunded',
            refund_reason: reason,
            refund_amount: amount,
            refund_method: refund_method || 'original_method',
            refunded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        await bookingsDB.update({ id }, updatedBooking);
        
        // Log the refund action
        logAuditAction(req.user?.username || 'admin', 'process-refund', { 
            bookingId: id, 
            amount: amount,
            reason: reason,
            method: refund_method
        }, req.ip, req.get('User-Agent'));
        
        // Send refund confirmation email
        queueEmail('refund-confirmation', booking.email, {
            ...updatedBooking,
            refund_amount: amount
        });
        
        // If using Paystack, initiate refund through their API
        if (booking.payment_reference) {
            // Note: In a real implementation, you would call Paystack's refund API here
            console.log(`Refund requested for Paystack transaction: ${booking.payment_reference}`);
            // await initiatePaystackRefund(booking.payment_reference, amount);
        }
        
        res.json({ success: true, booking: updatedBooking });
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({ error: 'Failed to process refund' });
    }
});

// Email functions for date changes and refunds

// Function to send date change confirmation email to customer
function sendDateChangeConfirmationEmail(booking) {
    // If transporter is not configured, skip email sending
    if (!transporter) {
        conditionalLog('Email transporter not configured, logging date change confirmation to console');
        conditionalLog('=== DATE CHANGE CONFIRMATION EMAIL ===');
        conditionalLog(`To: ${booking.email}`);
        conditionalLog(`Subject: Date Change Confirmation for Booking ${booking.id}`);
        conditionalLog(`Body:`);
        conditionalLog(`Dear ${booking.name},`);
        conditionalLog(`Your booking dates have been successfully updated.`);
        conditionalLog(`Previous dates: ${booking.old_checkin} to ${booking.old_checkout}`);
        conditionalLog(`New dates: ${booking.checkin} to ${booking.checkout}`);
        conditionalLog(`Booking ID: ${booking.id}`);
        conditionalLog(`Room Type: ${getRoomTypeName(booking.roomType)}`);
        conditionalLog(`Thank you for choosing Ankes Lodge!`);
        conditionalLog('====================================');
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com',
        to: booking.email,
        subject: `Date Change Confirmation for Booking ${booking.id}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Date Change Confirmation</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #FFA500;">Date Change Confirmation</h2>
                    <p>Dear ${booking.name},</p>
                    <p>Your booking dates have been successfully updated. Here are the new details:</p>
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3>Updated Booking Details</h3>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p><strong>Guest Name:</strong> ${booking.name}</p>
                        <p><strong>Room Type:</strong> ${getRoomTypeName(booking.roomType)}</p>
                        <p><strong>Previous Check-in:</strong> ${booking.old_checkin}</p>
                        <p><strong>Previous Check-out:</strong> ${booking.old_checkout}</p>
                        <p><strong>New Check-in:</strong> ${booking.checkin}</p>
                        <p><strong>New Check-out:</strong> ${booking.checkout}</p>
                        <p><strong>Email:</strong> ${booking.email}</p>
                        <p><strong>Phone:</strong> ${booking.phone}</p>
                    </div>
                    <p>If you have any questions about this change, please contact us.</p>
                    <p>Thank you for choosing Ankes Lodge!</p>
                    <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #666;">This email was sent from Ankes Lodge. If you received this email in error, please ignore it.</p>
                </div>
            </body>
            </html>
        `
    };

    // Return a promise for better error handling
    return new Promise((resolve, reject) => {
        console.log('Attempting to send date change confirmation email to:', booking.email);
        const startTime = Date.now();
        
        // Always log email content to console for debugging purposes
        conditionalLog('=== DATE CHANGE CONFIRMATION EMAIL CONTENT ===');
        conditionalLog(`To: ${booking.email}`);
        conditionalLog(`Subject: Date Change Confirmation for Booking ${booking.id}`);
        conditionalLog('Content:');
        conditionalLog(mailOptions.html);
        conditionalLog('=========================================');
        
        // If transporter is not configured, skip actual sending
        if (!transporter) {
            console.log('Email transporter not configured - email not sent, content logged above for debugging');
            return resolve();
        }
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Date change confirmation email sending attempt took ${endTime - startTime}ms`);
            
            if (error) {
                console.log('Date change confirmation email sending error:', error.message);
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Date change confirmation email sent successfully: ' + info.response);
                resolve();
            }
        });
    });
}

// Function to send refund confirmation email to customer
function sendRefundConfirmationEmail(booking) {
    // If transporter is not configured, skip email sending
    if (!transporter) {
        conditionalLog('Email transporter not configured, logging refund confirmation to console');
        conditionalLog('=== REFUND CONFIRMATION EMAIL ===');
        conditionalLog(`To: ${booking.email}`);
        conditionalLog(`Subject: Refund Confirmation for Booking ${booking.id}`);
        conditionalLog(`Body:`);
        conditionalLog(`Dear ${booking.name},`);
        conditionalLog(`A refund of ₵${booking.refund_amount} has been processed for your booking.`);
        conditionalLog(`Refund Reason: ${booking.refund_reason}`);
        conditionalLog(`Refund Method: ${booking.refund_method}`);
        conditionalLog(`Booking ID: ${booking.id}`);
        conditionalLog(`Room Type: ${getRoomTypeName(booking.roomType)}`);
        conditionalLog(`The refund should appear in your account within 5-10 business days.`);
        conditionalLog(`Thank you for choosing Ankes Lodge!`);
        conditionalLog('====================================');
        return Promise.resolve(); // Return a resolved promise for consistency
    }
    
    const mailOptions = {
        from: process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com',
        to: booking.email,
        subject: `Refund Confirmation for Booking ${booking.id}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Refund Confirmation</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #FFA500;">Refund Confirmation</h2>
                    <p>Dear ${booking.name},</p>
                    <p>A refund has been processed for your booking. Here are the details:</p>
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3>Refund Details</h3>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p><strong>Guest Name:</strong> ${booking.name}</p>
                        <p><strong>Room Type:</strong> ${getRoomTypeName(booking.roomType)}</p>
                        <p><strong>Refund Amount:</strong> ₵${booking.refund_amount}</p>
                        <p><strong>Refund Method:</strong> ${booking.refund_method}</p>
                        <p><strong>Refund Reason:</strong> ${booking.refund_reason}</p>
                        <p><strong>Refund Date:</strong> ${formatDate(booking.refunded_at)}</p>
                        <p><strong>Email:</strong> ${booking.email}</p>
                        <p><strong>Phone:</strong> ${booking.phone}</p>
                    </div>
                    <p>The refund has been processed and should appear in your account within 5-10 business days, depending on your payment method.</p>
                    <p>If you have any questions about this refund, please contact us.</p>
                    <p>Thank you for choosing Ankes Lodge!</p>
                    <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #666;">This email was sent from Ankes Lodge. If you received this in error, please ignore it.</p>
                </div>
            </body>
            </html>
        `
    };

    // Return a promise for better error handling
    return new Promise((resolve, reject) => {
        console.log('Attempting to send refund confirmation email to:', booking.email);
        const startTime = Date.now();
        
        // Always log email content to console for debugging purposes
        conditionalLog('=== REFUND CONFIRMATION EMAIL CONTENT ===');
        conditionalLog(`To: ${booking.email}`);
        conditionalLog(`Subject: Refund Confirmation for Booking ${booking.id}`);
        conditionalLog('Content:');
        conditionalLog(mailOptions.html);
        conditionalLog('=========================================');
        
        // If transporter is not configured, skip actual sending
        if (!transporter) {
            console.log('Email transporter not configured - email not sent, content logged above for debugging');
            return resolve();
        }
        
        transporter.sendMail(mailOptions, function(error, info) {
            const endTime = Date.now();
            console.log(`Refund confirmation email sending attempt took ${endTime - startTime}ms`);
            
            if (error) {
                console.log('Refund confirmation email sending error:', error.message);
                resolve(); // Resolve anyway since this is not a critical error for the user experience
            } else {
                console.log('Refund confirmation email sent successfully: ' + info.response);
                resolve();
            }
        });
    });
}

// Format date function
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Audit logging system
const auditLogs = [];

function logAuditAction(userId, action, details, ip, userAgent) {
    const logEntry = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        userId: userId || 'anonymous',
        action: action,
        details: details,
        ip: ip || 'unknown',
        userAgent: userAgent || 'unknown',
        severity: getActionSeverity(action)
    };
    
    auditLogs.push(logEntry);
    
    // Keep only last 1000 logs to prevent memory issues
    if (auditLogs.length > 1000) {
        auditLogs.shift();
    }
    
    console.log(`AUDIT: ${action} by ${userId || 'anonymous'} - ${JSON.stringify(details)}`);
    
    // Also save to MongoDB if available
    if (db) {
        try {
            const auditCollection = db.collection('audit_logs');
            auditCollection.insertOne(logEntry);
        } catch (error) {
            console.error('Failed to save audit log to MongoDB:', error);
        }
    }
}

function getActionSeverity(action) {
    const highSeverity = ['login', 'logout', 'delete', 'refund', 'update-booking-dates'];
    const mediumSeverity = ['view', 'search', 'filter'];
    
    if (highSeverity.includes(action)) return 'high';
    if (mediumSeverity.includes(action)) return 'medium';
    return 'low';
}

// Monitoring dashboard endpoint
app.get('/admin/monitoring', requireAuth, async (req, res) => {
    try {
        // Get system metrics
        const metrics = {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage ? process.cpuUsage() : null,
            nodeVersion: process.version,
            platform: process.platform
        };
        
        // Get recent audit logs (last 50)
        const recentLogs = auditLogs.slice(-50).reverse();
        
        // Get booking statistics
        const bookings = await bookingsDB.find({});
        const contacts = await contactsDB.find({});
        const testimonials = await testimonialsDB.find({});
        
        const stats = {
            totalBookings: bookings.length,
            pendingBookings: bookings.filter(b => b.status === 'pending').length,
            confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
            refundedBookings: bookings.filter(b => b.status === 'refunded').length,
            totalContacts: contacts.length,
            totalTestimonials: testimonials.length,
            recentActivity: recentLogs.slice(0, 10)
        };
        
        res.json({
            success: true,
            metrics: metrics,
            stats: stats,
            auditLogs: recentLogs
        });
    } catch (error) {
        console.error('Error fetching monitoring data:', error);
        res.status(500).json({ error: 'Failed to fetch monitoring data' });
    }
});

// Legacy endpoints for compatibility with old admin page
app.get("/bookings.json", requireAuth, async (req, res) => {
    try {
        const bookings = await bookingsDB.find({});
        res.json(bookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
});

app.get("/contacts.json", requireAuth, async (req, res) => {
    try {
        const contacts = await contactsDB.find({});
        res.json(contacts);
    } catch (error) {
        console.error("Error fetching contacts:", error);
        res.status(500).json({ error: "Failed to fetch contacts" });
    }
});

app.get("/testimonials.json", requireAuth, async (req, res) => {
    try {
        const testimonials = await testimonialsDB.find({});
        res.json(testimonials);
    } catch (error) {
        console.error("Error fetching testimonials:", error);
        res.status(500).json({ error: "Failed to fetch testimonials" });
    }
});

app.delete("/delete-testimonial/:id", requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: "Invalid testimonial ID" });
        }
        
        await testimonialsDB.delete({ id: id });
        res.json({ status: "success", message: "Testimonial deleted successfully" });
    } catch (error) {
        console.error("Error deleting testimonial:", error);
        res.status(500).json({ error: "Failed to delete testimonial" });
    }
});
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
                        console.log('For Render.com deployment, ensure EMAIL_USER and EMAIL_PASS are set as environment variables');
                        console.log('If using Gmail, make sure you are using App Passwords, not regular passwords');
                        console.log('Visit: https://myaccount.google.com/apppasswords to generate an App Password');
                        console.log('Also check that your IP is not blocked and that 2FA is enabled on your Gmail account');
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