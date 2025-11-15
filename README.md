# Ankes Lodge Website - Streetmap Integration Branch

This branch contains the updated version of the Ankes Lodge guest house website with the following enhancements:

## Features

1. **Streetmap Integration**
   - Replaced Google Maps with a Streetmap implementation in the location section
   - Added a placeholder for the interactive street map
   - Maintained all location information and contact details

2. **Email Configuration Updates**
   - Updated all email notifications to use `konaduprince26@gmail.com` for testing purposes
   - Modified both customer confirmation emails and admin notifications
   - Updated contact information on the website

3. **Booking System Testing**
   - Created test scripts to verify the booking system functionality
   - Added test data with the new email address
   - Verified that bookings are properly saved to `bookings.json`

## Files Modified

- `index.html` - Updated map implementation and contact email
- `server.js` - Updated email configurations for notifications
- `styles.css` - Maintained existing styling for the map container

## Test Files Added

- `test-booking-email.js` - Script to test booking system with new email
- `test-streetmap.html` - HTML page to preview Streetmap integration

## How to Test

1. Run the test script:
   ```
   node test-booking-email.js
   ```

2. View the Streetmap test page:
   ```
   Open test-streetmap.html in a web browser
   ```

3. Start the server (if not already running):
   ```
   npm start
   ```
   or
   ```
   node server.js
   ```

## Deployment Notes

- The Streetmap integration is currently a placeholder that should be replaced with actual Streetmap API implementation
- Email configurations are set to `konaduprince26@gmail.com` for testing purposes
- All changes are in the `streetmap-integration` branch for review and testing before merging to master