# Ankes Lodge Website - Internal Documentation

## Project Overview

This documentation provides an overview of the Ankes Lodge website structure and functionality. The website is a modern, responsive guest house booking platform designed to showcase accommodations and facilities while providing an easy booking experience.

## Website Structure

### Main Files
- `index.html` - Main landing page
- `styles.css` - Styling and responsive design
- `script.js` - Interactive functionality and form handling

### Asset Files
- `orangeLogo.png` - Official logo (orange theme)
- `main-flyer.jpg` - Main promotional flyer (used as hero banner)
- Room images:
  - `executive room.jpg` - Executive room photo
  - `full3.jpg` - Regular bedroom photo
  - `FULLHOUSE.jpg` - Full house photo
- Facility images:
  - `HALL1.jpg` - Event hall
  - `HALL2.jpg` - Reception area
  - `dining.jpg` - Dining hall
  - `fullwthcar.jpg` - Parking area
- `videoOftheroomsAndEverything.mp4` - Virtual tour video

## Key Features

### 1. Responsive Design
- Mobile-first approach
- Adapts to all screen sizes
- Touch-friendly navigation

### 2. Booking System
- Integrated booking form with validation
- Date selection with automatic constraint enforcement
- Room type selection with pricing information
- Form submission handling

### 3. Gallery & Media
- Image gallery showcasing rooms and facilities
- Video placeholder for virtual tour
- Responsive image grids

### 4. Contact Management
- Direct contact information display
- Contact form for inquiries
- Staff contact details

## Color Scheme

- Primary: Orange (#FFA500) - Matches logo and brand identity
- Secondary: Dark Gray (#333) - For text and accents
- Background: Light Gray (#f8f8f8) and White (#fff)
- Accent: Various shades for UI elements

## Typography

- Primary Font: Arial (clean, readable, web-safe)
- Heading hierarchy for clear content structure
- Appropriate sizing for readability across devices

## Navigation

1. Home
2. Rooms
3. Facilities
4. Location
5. Contact
6. Book Now (CTA button)

## Sections Breakdown

### Header
- Logo with brand name
- Navigation menu
- Prominent booking CTA

### Hero Banner
- Full-width banner using main flyer image
- Welcome message
- Primary CTA button

### About Section
- Brief introduction to Ankes Lodge

### Rooms Section
- Executive Room (Inquire for Pricing)
- Regular Bedroom (Inquire for Pricing)
- Full House (Custom pricing)
- "Book Now" buttons for each room type

### Facilities Section
- Event Hall
- Dining Hall
- Reception Area
- Parking

### Gallery
- Showcase of all images
- Video placeholder

### Booking Form
- Personal information collection
- Date selection with validation
- Room type selection
- Special requests field
- Form validation and submission handling

### Location Information
- Detailed address information
- Contact numbers:
  - Contact: 0248293512
- Map placeholder

### Contact Form
- Inquiry submission
- Staff contact information

### Footer
- Logo repetition
- Quick navigation links
- Copyright information

## Technical Implementation Details

### JavaScript Functionality
- Smooth scrolling navigation
- Date validation and constraints
- Form handling and validation
- Room booking integration
- Responsive behaviors

### CSS Features
- CSS Variables for consistent theming
- Flexbox and Grid layouts
- Responsive breakpoints
- Hover effects and transitions
- Mobile optimization

## Booking Process Flow

1. User selects room type via "Book Now" buttons or dropdown
2. Booking form pre-fills room selection when applicable
3. User fills in personal and stay details
4. Form validates required fields
5. On submission, data is processed (currently simulated)
6. Confirmation message displayed
7. Form resets for next booking

## Contact Process Flow

1. User fills contact form
2. Form validates required fields
3. On submission, data is processed (currently simulated)
4. Confirmation message displayed
5. Form resets

## Maintenance Notes

### Updating Content
- All content is editable in `index.html`
- Styling changes should be made in `styles.css`
- Functional enhancements in `script.js`

### Adding New Rooms
1. Add new image to assets
2. Create new room card in HTML
3. Update CSS if layout changes needed
4. Add appropriate event listeners in JavaScript

### Adding New Facilities
1. Add new image to assets
2. Create new facility item in HTML
3. Update CSS grid if needed

## Future Enhancement Opportunities

1. Backend integration for actual booking processing
2. Database storage for reservations
3. Payment gateway integration
4. Real map implementation
5. Social media integration
6. Customer review system
7. Availability calendar
8. Admin dashboard for managing bookings

## Browser Compatibility

The website is designed to work on all modern browsers:
- Chrome (latest versions)
- Firefox (latest versions)
- Safari (latest versions)
- Edge (latest versions)
- Mobile browsers (iOS Safari, Android Chrome)

## Performance Considerations

- Images should be optimized for web use
- Minification of CSS/JS recommended for production
- Lazy loading for images could be implemented
- Caching strategies should be employed

## Security Notes

- Form validation is client-side only (should be supplemented with server-side validation)
- No sensitive data is handled in current implementation
- HTTPS recommended for production deployment