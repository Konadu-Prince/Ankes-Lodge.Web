# Ankes Lodge Website

Welcome to the official website for Ankes Lodge, a premium guest house located in the serene neighborhood of Abesim, Sunyani, Ghana.

This website showcases our accommodations, facilities, and services, and provides an easy way for guests to book their stay with us. The site features a robust booking system with enhanced validation, comprehensive SEO optimization, and improved user experience.

## Enhanced Features (Latest Updates)

### 🔒 Security Improvements
- **Proper Authentication**: JWT-based authentication for admin endpoints
- **Rate Limiting**: Protection against form spamming and abuse
- **Security Headers**: XSS protection, content-type sniffing prevention, clickjacking protection
- **Input Validation**: Comprehensive server-side validation for all forms

### 💾 Data Management
- **Persistent Storage**: Bookings and contacts now stored in MongoDB with memory fallback
- **Database Functions**: Proper CRUD operations for all data types
- **Backup System**: File-based fallback when database is unavailable

### 📧 Email Notifications
- **Automated Emails**: Real-time email notifications for bookings and contact forms
- **Retry Mechanism**: Automatic retry with exponential backoff for failed emails
- **Professional Templates**: Well-formatted HTML email templates

### 📊 Logging & Monitoring
- **Winston Logger**: Professional logging system with file rotation
- **Health Checks**: `/health` endpoint for monitoring server status
- **Error Tracking**: Comprehensive error logging and handling

### 🛠️ Admin Panel Enhancements
- **Complete CRUD Operations**: Full booking and contact management
- **Data Retrieval**: Real database queries instead of placeholders
- **Secure Endpoints**: Proper authentication for all admin functions

## Booking System Features

The booking system includes:
- Enhanced client-side validation with real-time feedback
- Server-side validation with proper error handling
- Multi-platform booking options (Airbnb, Booking.com, direct)
- Automated email confirmations for guests and administrators
- Database storage with both file-based and MongoDB options
- Responsive design for all device types

## SEO Enhancements

The website includes comprehensive SEO optimizations:
- Meta tags for description, keywords, and author
- Open Graph and Twitter card metadata for social sharing
- Schema.org structured data for rich search results
- Robots.txt and sitemap.xml for search engine crawling
- Canonical URLs to prevent duplicate content issues

## Deployment

The website is deployed on two platforms:
1. **Render.com** - Main deployment with full functionality (https://ankes-lodge.onrender.com/)
2. **GitHub Pages** - Static version for backup (https://konadu-prince.github.io/Ankes-Lodge.Web/)

Forms submitted on the GitHub Pages version will automatically redirect to the Render.com server for processing.

## Deployment Options

This project can be deployed to either Vercel or Render with both server and client functionality.

### Deployment to Vercel

#### Prerequisites

1. A Vercel account (free at [vercel.com](https://vercel.com))
2. This repository connected to your Vercel account

#### Deployment Steps

1. Go to your Vercel dashboard
2. Click "New Project"
3. Import this repository
4. Configure the project settings:
   - Framework Preset: Other
   - Build Command: (leave empty)
   - Output Directory: (leave empty)
   - Install Command: `npm install`
5. Add environment variables (if needed):
   - `EMAIL_USER` - Your Gmail address for sending emails
   - `EMAIL_PASS` - Your Gmail app password
6. Deploy!

### Deployment to Render.com

To deploy this application to Render.com:

1. Fork this repository to your GitHub account
2. Create a new Web Service on Render.com
3. Connect it to your forked repository
4. Set the following environment variables in Render.com dashboard:
   - `EMAIL_USER` - Your Gmail address for sending emails
   - `EMAIL_PASS` - Your Gmail App Password (not regular password)
   - `ADMIN_EMAIL` - Admin contact email
   - `MONGODB_URI` - Your MongoDB connection string
5. Set Build Command to: `npm install`
6. Set Start Command to: `node server.js`
7. Add the following environment variable in Render.com:
   - Key: `NODE_ENV` 
   - Value: `production`
8. Deploy the application

Note: For email functionality to work on Render.com, you must:
- Enable 2-factor authentication on your Gmail account
- Generate an App Password at https://myaccount.google.com/apppasswords
- Use the App Password (not your regular Gmail password) as the `EMAIL_PASS` value
- For Gmail on Render.com specifically:
  * Use App Passwords, not regular passwords
  * Ensure your account has 2FA enabled
  * Check that your IP is not blocked by Google
  * If Gmail doesn't work, consider using alternative SMTP services like SendGrid or Mailgun
  * Monitor the server logs for email configuration errors
  * The application includes fallback logging when email fails

If Gmail SMTP continues to fail on Render.com:
- Consider using alternative email services like SendGrid, Mailgun, or AWS SES
- These services are often more reliable on cloud platforms
- They offer better deliverability and less restriction than Gmail for application use

### Keeping the Server Awake on Render.com Free Tier

Render.com's free tier puts applications to sleep after 15 minutes of inactivity. While this project includes a self-pinging mechanism to prevent sleep, you can also use external services:

#### Option 1: Built-in Self-Pinger (Automatic)
- The application automatically pings itself every 14 minutes when deployed on Render.com
- No additional configuration needed

#### Option 2: External Cron Services
You can use external services to ping your application:
- [cron-job.org](https://cron-job.org/) - Free cron job service
- [uptimerobot.com](https://uptimerobot.com/) - Website monitoring service
- [kaffeine.herokuapp.com](https://kaffeine.herokuapp.com/) - Keeps Heroku apps awake (also works with Render.com)

To set up external monitoring:
1. Get your Render.com URL (usually https://your-app-name.onrender.com)
2. Create an account with one of the services above
3. Set up a job to ping your URL every 10-14 minutes
4. Use the `/health` or `/ping` endpoint for monitoring

Example URLs for monitoring:
- `https://your-app-name.onrender.com/health`
- `https://your-app-name.onrender.com/ping`

Note: Using external services may be more reliable than the built-in self-pinger.

### Environment Variables

**IMPORTANT**: For full functionality, you **MUST** set the following environment variables:

```
# Database Configuration (Optional - defaults to localhost)
MONGODB_URI=mongodb://localhost:27017/ankeslodge

# Email Configuration (Required for email notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=ankeslodge@gmail.com
EMAIL_PASS=your-app-password  # Use Gmail App Password

# Server Configuration
PORT=3000
NODE_ENV=development

# Security Configuration (Optional)
SESSION_SECRET=your-session-secret-key-here
JWT_SECRET=your-jwt-secret-key-here
```

**Email Setup Instructions:**
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password at https://myaccount.google.com/apppasswords
3. Use the App Password (not your regular Gmail password) as the `EMAIL_PASS` value

**Without EMAIL_PASS**: The application will still work but email notifications will be disabled and only logged to the console.

### Project Structure

- `server.js` - Main Express server handling both static files and API routes
- `index.html` - Main website page
- `script.js` - Client-side JavaScript functionality
- `styles.css` - Website styling
- `bookings.json` - Stores booking data (in production, consider using a database)
- `contacts.json` - Stores contact form submissions (in production, consider using a database)

### API Endpoints

- `POST /submit-booking` - Handle booking form submissions with validation and email notifications
- `POST /process-contact` - Handle contact form submissions with validation and email notifications
- `GET /admin/bookings` - Retrieve all bookings (authenticated)
- `GET /admin/contacts` - Retrieve all contacts (authenticated)
- `GET /testimonials.json` - Retrieve testimonials with database fallback
- `POST /add-testimonial` - Add new testimonial
- `POST /admin/login` - Admin authentication with bcrypt password hashing
- `GET /health` - Server health check endpoint
- `GET /bookings.json` - Legacy endpoint for bookings (authenticated)
- `GET /contacts.json` - Legacy endpoint for contacts (authenticated)
- `DELETE /delete-testimonial/:id` - Delete testimonial by ID (authenticated)

### Admin Access

The admin panel is now protected with a login system:
- Visit `/login.html` to access the admin login page
- Default credentials:
  - Username: `admin`
  - Password: `ankeslodge0000`
- After successful login, you'll be redirected to the admin panel
- To change credentials, modify the `admin-credentials.json` file

### Local Development

To run locally:

```bash
npm install
npm start
```

Or for development with auto-restart:

```bash
npm install
npm run dev
```

The server will start on port 8000 by default.
