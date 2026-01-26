# EmailJS Integration for Ankes Lodge

This document explains how to integrate EmailJS with your existing system while maintaining the MongoDB storage functionality.

## Current System Status

✅ **MongoDB Storage**: All form data (bookings, contacts, testimonials) is already being stored in MongoDB collections
✅ **Admin Access**: Admin panel can access all stored data
✅ **Working System**: Current system functions properly

## EmailJS Integration Steps

### 1. Sign Up for EmailJS
1. Go to [emailjs.com](https://www.emailjs.com/)
2. Create an account
3. Verify your email address

### 2. Configure EmailJS Service
1. Connect your email account (Gmail, Outlook, etc.) in the EmailJS dashboard
2. Create the following email templates in your EmailJS dashboard:

#### Booking Confirmation Template (Template ID: `booking_confirmation_template`)
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
    <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
        <h1 style="color: #333; margin: 0;">Ankes Lodge</h1>
        <p style="color: #666; margin: 5px 0;">Luxury Guest House in Abesim</p>
    </div>
    
    <div style="background-color: #fff; padding: 30px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <h2 style="color: #333;">Booking Confirmation</h2>
        <p>Dear {{to_name}},</p>
        <p>Your booking request has been received and is being processed.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #ffa500; border-radius: 3px;">
            <h3 style="color: #333; margin-top: 0;">Booking Details</h3>
            <p><strong>Booking ID:</strong> {{booking_id}}</p>
            <p><strong>Check-in:</strong> {{checkin_date}}</p>
            <p><strong>Check-out:</strong> {{checkout_date}}</p>
            <p><strong>Room Type:</strong> {{room_type}}</p>
            <p><strong>Adults:</strong> {{adults}}</p>
            <p><strong>Children:</strong> {{children}}</p>
            <p><strong>Total Amount:</strong> ₵{{total_amount}}</p>
            <p><strong>Status:</strong> Pending</p>
            <p><strong>Submitted:</strong> {{timestamp}}</p>
        </div>
        
        <p>We will contact you shortly to confirm your reservation. Please keep this email for your records.</p>
        <p>If you need to make changes to your booking, please contact us at the numbers below.</p>
        
        <div style="background-color: #e8f4e8; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 3px;">
            <h3 style="color: #333; margin-top: 0;">Contact Information</h3>
            <p><strong>Contact:</strong> 0248293512</p>
        </div>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
        <p>Contact: 0248293512</p>
        <p>&copy; 2025 Ankes Lodge. All rights reserved.</p>
    </div>
</div>
```

#### Admin Notification Template (Template ID: `admin_notification_template`)
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
    <div style="text-align: center; padding: 20px 0; background-color: #fff; border-bottom: 3px solid #ffa500;">
        <h1 style="color: #333; margin: 0;">Ankes Lodge</h1>
        <p style="color: #666; margin: 5px 0;">Admin Notification</p>
    </div>
    
    <div style="background-color: #fff; padding: 30px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <h2 style="color: #333;">New Booking Request</h2>
        <p>Hello {{admin_name}},</p>
        <p>A new booking request has been submitted. Please review and process it.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #ffa500; border-radius: 3px;">
            <h3 style="color: #333; margin-top: 0;">Booking Details</h3>
            <p><strong>Booking ID:</strong> {{booking_id}}</p>
            <p><strong>Customer Name:</strong> {{customer_name}}</p>
            <p><strong>Customer Email:</strong> {{customer_email}}</p>
            <p><strong>Customer Phone:</strong> {{customer_phone}}</p>
            <p><strong>Check-in:</strong> {{checkin_date}}</p>
            <p><strong>Check-out:</strong> {{checkout_date}}</p>
            <p><strong>Room Type:</strong> {{room_type}}</p>
            <p><strong>Adults:</strong> {{adults}}</p>
            <p><strong>Children:</strong> {{children}}</p>
            <p><strong>Special Request:</strong> {{message}}</p>
            <p><strong>Total Amount:</strong> ₵{{total_amount}}</p>
            <p><strong>Submitted:</strong> {{timestamp}}</p>
        </div>
        
        <div style="background-color: #e8f4e8; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 3px;">
            <h3 style="color: #333; margin-top: 0;">Admin Actions</h3>
            <p>You can view and manage all bookings in the admin panel:</p>
            <div style="text-align: center; margin: 20px 0;">
                <a href="https://your-domain.com/admin.html" style="display: inline-block; background-color: #FFA500; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Manage Bookings</a>
            </div>
            <p style="margin-bottom: 0;">Log in to approve, modify, or respond to this booking request.</p>
        </div>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
        <p>&copy; 2025 Ankes Lodge. All rights reserved.</p>
    </div>
</div>
```

### 3. Update Environment Variables
Add these variables to your `.env` file:
```
EMAILJS_PUBLIC_KEY=your_public_key_from_emailjs
EMAILJS_SERVICE_ID=your_service_id_from_emailjs
```

### 4. Integration with Existing System
The current system already stores all form data in MongoDB, which meets your requirements. To integrate EmailJS:

1. Replace the nodemailer email sending functions with EmailJS functions
2. Use the functions provided in `emailjs-integration.js`

### 5. How to Update Your Server
In your `server.js` file, you would replace the existing email sending functions with the EmailJS versions:

```javascript
// At the top of server.js
const { 
    sendBookingConfirmationEmailViaEmailJS,
    sendAdminNotificationEmailViaEmailJS,
    sendContactConfirmationEmailViaEmailJS,
    sendContactAdminNotificationEmailViaEmailJS
} = require('./emailjs-integration');

// In your booking form handler, replace the queueEmail calls:
// Instead of:
// queueEmail('confirmation', booking.email, booking);
// queueEmail('admin-notification', process.env.ADMIN_EMAIL || 'ankeslodge@gmail.com', booking);

// Use:
sendBookingConfirmationEmailViaEmailJS(booking);
sendAdminNotificationEmailViaEmailJS(booking);
```

## Benefits of This Approach

1. ✅ **Preserves MongoDB Storage**: All form data continues to be stored in MongoDB collections
2. ✅ **Admin Access**: Admin panel can still access all stored data
3. ✅ **EmailJS Integration**: Uses EmailJS cloud service for sending emails
4. ✅ **Reliability**: EmailJS handles email delivery and reputation management
5. ✅ **Scalability**: Better suited for production environments like Render.com

## Important Notes

- The MongoDB storage functionality is already implemented and working in your current system
- EmailJS handles only the email sending part, not data storage
- Your admin panel will continue to have access to all form submissions via the MongoDB collections
- Make sure to test the integration in a development environment first
- Template IDs in EmailJS must match exactly with those in your code

## Troubleshooting

### If emails aren't sending:
1. Verify your EmailJS public key and service ID are correct
2. Check that template IDs match between your EmailJS dashboard and code
3. Ensure the required environment variables are set in your deployment platform

### If MongoDB storage stops working:
1. The storage functionality is independent of the email system
2. Check your MongoDB connection and environment variables
3. Verify that the database operations in your form handlers remain unchanged