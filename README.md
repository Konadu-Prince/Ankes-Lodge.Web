# Ankes Lodge Website

A luxury guest house website with booking system and contact form functionality.

## Deployment to Vercel

This project is configured for deployment to Vercel with both server and client functionality.

### Prerequisites

1. A Vercel account (free at [vercel.com](https://vercel.com))
2. This repository connected to your Vercel account

### Deployment Steps

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

### Environment Variables

For email functionality to work, you need to set the following environment variables in your Vercel project settings:

```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

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
- `GET /` - Serve the main website

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