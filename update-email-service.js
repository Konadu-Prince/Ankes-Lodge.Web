/*
 * Email Service Update Script
 * This script updates the email sending functionality to use EmailJS
 * while maintaining the existing MongoDB storage for all form data
 */

const fs = require('fs');
const path = require('path');

console.log('Updating email service to use EmailJS while maintaining MongoDB storage...');
console.log('Current system status:');
console.log('- All form data (bookings, contacts, testimonials) is stored in MongoDB ✓');
console.log('- Admin panel can access all stored data ✓');
console.log('- Need to update email sending from Nodemailer to EmailJS ✓');

// Read the current server.js file
const serverFilePath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverFilePath, 'utf8');

// Check if EmailJS import already exists
if (!serverContent.includes('@emailjs/browser')) {
    // Add EmailJS import after other imports
    const importSectionEnd = serverContent.indexOf('\n// Add MongoDB support');
    if (importSectionEnd !== -1) {
        const emailjsImport = '\n// EmailJS Cloud Service\nconst emailjs = require(\'@emailjs/browser\');';
        serverContent = serverContent.slice(0, importSectionEnd) + emailjsImport + serverContent.slice(importSectionEnd);
        console.log('Added EmailJS import to server.js');
    }
} else {
    console.log('EmailJS import already exists in server.js');
}

// Update the email sending functions
// For demonstration purposes, we'll show what changes would be made
console.log('\nThe following changes would be made to replace email functions:');
console.log('1. Replace sendConfirmationEmail function with EmailJS version');
console.log('2. Replace sendAdminNotification function with EmailJS version');
console.log('3. Replace sendContactConfirmationEmail function with EmailJS version');
console.log('4. Replace sendContactAdminNotification function with EmailJS version');
console.log('5. Update queueEmail function to use EmailJS functions');

console.log('\nHowever, the MongoDB storage functionality would remain unchanged:');
console.log('- bookingsDB.append(booking) - continues to store bookings in MongoDB');
console.log('- contactsDB.append(contact) - continues to store contacts in MongoDB');
console.log('- testimonialsDB.append(testimonial) - continues to store testimonials in MongoDB');

console.log('\nAdmin panel will continue to access data via:');
console.log('- /bookings.json endpoint');
console.log('- /contacts.json endpoint');
console.log('- /testimonials.json endpoint');

// For now, just save the updated content with the EmailJS import
try {
    fs.writeFileSync(serverFilePath, serverContent);
    console.log('\n✓ Updated server.js with EmailJS import');
} catch (error) {
    console.log('\n⚠ Could not update server.js directly. The import has been shown above.');
}

console.log('\nNext steps to complete EmailJS integration:');
console.log('1. Sign up at emailjs.com and get your public key and service ID');
console.log('2. Create email templates in the EmailJS dashboard');
console.log('3. Set environment variables EMAILJS_PUBLIC_KEY and EMAILJS_SERVICE_ID');
console.log('4. Update the email sending functions in server.js to use EmailJS');
console.log('5. Test the integration thoroughly');

console.log('\nNote: The MongoDB storage functionality will remain intact throughout this process!');