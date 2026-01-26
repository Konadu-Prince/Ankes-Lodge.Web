const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ankeslodge';

async function seedTestimonials() {
    try {
        const client = new MongoClient(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        await client.connect();
        const db = client.db();
        const collection = db.collection('testimonials');
        
        // Read testimonials from file
        const fs = require('fs');
        const path = require('path');
        const testimonialsPath = path.join(__dirname, 'testimonials.json');
        
        if (!fs.existsSync(testimonialsPath)) {
            console.log('Testimonials file not found, using default testimonials');
            const defaultTestimonials = [
                {
                    name: "Ama K.",
                    location: "Kumasi, Ghana",
                    comment: "Ankes Lodge is absolutely magical! The semi-standard room was beautifully designed and the staff treated us like family. The best hospitality experience in Ghana - we're already planning our return trip!",
                    rating: 5,
                    date: "2025-12-20",
                    id: 1767076023249
                },
                {
                    name: "Kwame O.",
                    location: "Accra, Ghana",
                    comment: "This place is a hidden gem! The peaceful environment and breathtaking views made our weekend truly unforgettable. The executive room was pure luxury - every detail was perfect!",
                    rating: 5,
                    date: "2025-12-15",
                    id: 1767076023251
                },
                {
                    name: "Sarah T.",
                    location: "London, UK",
                    comment: "Visited family in Ghana and Ankes Lodge was our perfect home base! The full house was ideal for our extended family. Serene location, impeccable service - an absolute must-book!",
                    rating: 5,
                    date: "2025-12-10",
                    id: 1767076023252
                },
                {
                    name: "Michael J.",
                    location: "New York, USA",
                    comment: "Ankes Lodge completely exceeded our expectations! The regular bedroom was spacious and spotless with all the amenities we needed. The staff were incredibly friendly and helpful. We'll definitely return!",
                    rating: 5,
                    date: "2025-12-05",
                    id: 1767076023253
                },
                {
                    name: "Esi A.",
                    location: "Takoradi, Ghana",
                    comment: "My family and I were blown away by the incredible experience at Ankes Lodge! The semi-standard room offered amazing value with top-notch amenities. Perfect location for exploring Abesim - we're already planning our next visit!",
                    rating: 5,
                    date: "2025-11-28",
                    id: 1767076023254
                }
            ];
            
            // Check if testimonials already exist in the database
            const existingCount = await collection.countDocuments();
            if (existingCount === 0) {
                await collection.insertMany(defaultTestimonials);
                console.log(`Seeded ${defaultTestimonials.length} default testimonials to the database`);
            } else {
                console.log(`Database already has ${existingCount} testimonials, skipping seed`);
            }
        } else {
            const testimonials = JSON.parse(fs.readFileSync(testimonialsPath, 'utf8'));
            
            // Check if testimonials already exist in the database
            const existingCount = await collection.countDocuments();
            if (existingCount === 0) {
                await collection.insertMany(testimonials);
                console.log(`Seeded ${testimonials.length} testimonials from file to the database`);
            } else {
                console.log(`Database already has ${existingCount} testimonials, skipping seed`);
            }
        }
        
        await client.close();
        console.log('Database seeding completed');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
}

// Run the seeding function
seedTestimonials();