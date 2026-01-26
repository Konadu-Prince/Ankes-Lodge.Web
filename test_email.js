const nodemailer = require('nodemailer');

// Email configuration from .env
const emailConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'konaduprince26@gmail.com',
        pass: 'svvnrkgzmgxuskyl' // This is the app password
    }
};

// Create reusable transporter object
const transporter = nodemailer.createTransport(emailConfig);

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter configuration error:', error);
        console.error('Error code:', error.code);
        console.error('Error response:', error.response);
    } else {
        console.log('Email transporter is ready to send messages');
        console.log('Success:', success);
    }
});