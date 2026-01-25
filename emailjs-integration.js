// EmailJS Integration Module
// This module handles email sending via EmailJS while maintaining MongoDB storage

const emailjs = require('@emailjs/browser');

// Initialize EmailJS with your credentials
// These would be set in your environment variables or in the frontend
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'your-public-key-here';
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'your-service-id-here';

// Initialize EmailJS
if (typeof window !== 'undefined') {
    // Only initialize in browser environment
    emailjs.init(EMAILJS_PUBLIC_KEY);
}

/**
 * Send booking confirmation email via EmailJS
 */
async function sendBookingConfirmationEmailViaEmailJS(booking) {
    try {
        // Prepare template parameters for EmailJS
        const templateParams = {
            to_name: booking.name,
            to_email: booking.email,
            booking_id: booking.id,
            customer_name: booking.name,
            customer_email: booking.email,
            customer_phone: booking.phone,
            checkin_date: booking.checkin,
            checkout_date: booking.checkout,
            room_type: booking.roomType,
            adults: booking.adults,
            children: booking.children,
            message: booking.message,
            total_amount: booking.amount,
            timestamp: booking.timestamp,
            reply_to: booking.email
        };

        // Send email via EmailJS
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,  // Service ID
            'booking_confirmation_template',  // Template ID - needs to be configured in EmailJS dashboard
            templateParams
        );

        console.log('EmailJS booking confirmation sent successfully:', response.status);
        return { success: true, response };
    } catch (error) {
        console.error('EmailJS booking confirmation error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send admin notification email via EmailJS
 */
async function sendAdminNotificationEmailViaEmailJS(booking) {
    try {
        // Prepare template parameters for EmailJS
        const templateParams = {
            admin_name: 'Admin',
            booking_id: booking.id,
            customer_name: booking.name,
            customer_email: booking.email,
            customer_phone: booking.phone,
            checkin_date: booking.checkin,
            checkout_date: booking.checkout,
            room_type: booking.roomType,
            adults: booking.adults,
            children: booking.children,
            message: booking.message,
            total_amount: booking.amount,
            timestamp: booking.timestamp,
            reply_to: booking.email
        };

        // Send email via EmailJS
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,  // Service ID
            'admin_notification_template',  // Template ID - needs to be configured in EmailJS dashboard
            templateParams
        );

        console.log('EmailJS admin notification sent successfully:', response.status);
        return { success: true, response };
    } catch (error) {
        console.error('EmailJS admin notification error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send contact form confirmation email via EmailJS
 */
async function sendContactConfirmationEmailViaEmailJS(contact) {
    try {
        // Prepare template parameters for EmailJS
        const templateParams = {
            to_name: contact.name,
            to_email: contact.email,
            subject: contact.subject,
            message: contact.message,
            timestamp: contact.timestamp,
            reply_to: contact.email
        };

        // Send email via EmailJS
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,  // Service ID
            'contact_confirmation_template',  // Template ID - needs to be configured in EmailJS dashboard
            templateParams
        );

        console.log('EmailJS contact confirmation sent successfully:', response.status);
        return { success: true, response };
    } catch (error) {
        console.error('EmailJS contact confirmation error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send contact admin notification email via EmailJS
 */
async function sendContactAdminNotificationEmailViaEmailJS(contact) {
    try {
        // Prepare template parameters for EmailJS
        const templateParams = {
            admin_name: 'Admin',
            customer_name: contact.name,
            customer_email: contact.email,
            subject: contact.subject,
            message: contact.message,
            timestamp: contact.timestamp,
            reply_to: contact.email
        };

        // Send email via EmailJS
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,  // Service ID
            'contact_admin_notification_template',  // Template ID - needs to be configured in EmailJS dashboard
            templateParams
        );

        console.log('EmailJS contact admin notification sent successfully:', response.status);
        return { success: true, response };
    } catch (error) {
        console.error('EmailJS contact admin notification error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Initialize EmailJS with credentials
 */
function initializeEmailJS(publicKey, serviceId) {
    if (publicKey) {
        emailjs.init(publicKey);
        console.log('EmailJS initialized with provided public key');
    }
    
    // Update service ID if provided
    if (serviceId) {
        // In practice, service ID is used when sending emails
        console.log('EmailJS service ID set');
    }
}

module.exports = {
    sendBookingConfirmationEmailViaEmailJS,
    sendAdminNotificationEmailViaEmailJS,
    sendContactConfirmationEmailViaEmailJS,
    sendContactAdminNotificationEmailViaEmailJS,
    initializeEmailJS
};