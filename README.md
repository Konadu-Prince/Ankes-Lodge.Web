# Ankes Lodge Website

A luxury guest house website with booking system and contact form functionality.

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
5. Set Build Command to: `npm install`
6. Set Start Command to: `node server.js`
7. Add the following environment variable in Render.com:
   - Key: `NODE_ENV` 
   - Value: `production`
8. Deploy the application

Note: For email functionality to work, you must:
- Enable 2-factor authentication on your Gmail account
- Generate an App Password at https://myaccount.google.com/apppasswords
- Use the App Password (not your regular Gmail password) as the `EMAIL_PASS` value

### Environment Variables

**IMPORTANT**: For email functionality to work on either platform, you **MUST** set the following environment variables. Hardcoded credentials have been removed for security reasons.

```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

Important: For Gmail, you must use an App Password, not your regular password. Generate an App Password at: https://myaccount.google.com/apppasswords

Example:
```
EMAIL_USER=konaduprince@gmail.com
EMAIL_PASS=svvnrkgzmgxuskyk
```

Without these environment variables, the email functionality will be disabled and only logged to the console.

### Project Structure

- `server.js` - Main Express server handling both static files and API routes
- `index.html` - Main website page
- `script.js` - Client-side JavaScript functionality
- `styles.css` - Website styling
- `bookings.json` - Stores booking data (in production, consider using a database)
- `contacts.json` - Stores contact form submissions (in production, consider using a database)

### API Endpoints

- `POST /process-booking` - Handle booking form submissions
- `POST /process-contact` - Handle contact form submissions
- `GET /bookings.json` - Retrieve booking data (for admin interface)
- `POST /admin/login` - Admin login endpoint
- `POST /admin/logout` - Admin logout endpoint
- `GET /` - Serve the main website

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
