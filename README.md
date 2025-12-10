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

### Deployment to Render

#### Prerequisites

1. A Render account (free at [render.com](https://render.com))
2. This repository connected to your Render account

#### Deployment Steps

1. Go to your Render dashboard
2. Click "New+" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service settings:
   - Name: ankes-lodge
   - Region: Choose the region closest to you
   - Branch: master or hosting
   - Root Directory: Leave empty
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Add environment variables:
   - `EMAIL_USER` - Your Gmail address for sending emails
   - `EMAIL_PASS` - Your Gmail app password
6. Click "Create Web Service"

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
  - Password: `ankeslodge2025`
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
