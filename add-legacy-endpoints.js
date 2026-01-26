const fs = require('fs');

// Read the server.js file
let content = fs.readFileSync('server.js', 'utf8');

// Find the position to insert the legacy endpoints (before module.exports)
const insertPoint = content.lastIndexOf('module.exports = app;');

// Define the legacy endpoints
const legacyEndpoints = `
// Legacy endpoints for compatibility with old admin page
app.get("/bookings.json", requireAuth, async (req, res) => {
    try {
        // In a real application, you would fetch bookings from database
        // For now, return empty array or sample data
        res.json({
            success: true,
            bookings: [] // Placeholder - in real app, this would come from DB
        });
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
});

app.get("/contacts.json", requireAuth, async (req, res) => {
    try {
        // In a real application, you would fetch contacts from database
        // For now, return empty array or sample data
        res.json({
            success: true,
            contacts: [] // Placeholder - in real app, this would come from DB
        });
    } catch (error) {
        console.error("Error fetching contacts:", error);
        res.status(500).json({ error: "Failed to fetch contacts" });
    }
});

app.get("/testimonials.json", requireAuth, async (req, res) => {
    try {
        if (db) {
            // Get testimonials from MongoDB
            const collection = db.collection('testimonials');
            const testimonials = await collection.find({}).sort({ date: -1 }).toArray();
            res.json(testimonials);
        } else {
            // Fallback to file-based testimonials
            const testimonialsPath = path.join(__dirname, 'testimonials.json');
            if (fs.existsSync(testimonialsPath)) {
                const testimonials = JSON.parse(fs.readFileSync(testimonialsPath, 'utf8'));
                res.json(testimonials);
            } else {
                res.json([]);
            }
        }
    } catch (error) {
        console.error("Error fetching testimonials:", error);
        res.status(500).json({ error: "Failed to fetch testimonials" });
    }
});

app.delete("/delete-testimonial/:id", requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        
        if (db) {
            // Delete from MongoDB
            const collection = db.collection('testimonials');
            const result = await collection.deleteOne({ id: parseInt(id) });
            
            if (result.deletedCount > 0) {
                res.json({ status: "success", message: "Testimonial deleted successfully" });
            } else {
                res.status(404).json({ status: "error", message: "Testimonial not found" });
            }
        } else {
            // Delete from file if database is not available
            const testimonialsPath = path.join(__dirname, 'testimonials.json');
            if (fs.existsSync(testimonialsPath)) {
                let testimonials = JSON.parse(fs.readFileSync(testimonialsPath, 'utf8'));
                
                // Filter out the testimonial with the given ID
                testimonials = testimonials.filter(t => t.id != id);
                
                // Write back to file
                fs.writeFileSync(testimonialsPath, JSON.stringify(testimonials, null, 2));
                res.json({ status: "success", message: "Testimonial deleted successfully" });
            } else {
                res.status(404).json({ status: "error", message: "Testimonials file not found" });
            }
        }
    } catch (error) {
        console.error("Error deleting testimonial:", error);
        res.status(500).json({ error: "Failed to delete testimonial" });
    }
});
`;

// Insert the legacy endpoints
const newContent = content.slice(0, insertPoint) + legacyEndpoints + content.slice(insertPoint);

// Write the updated content back to server.js
fs.writeFileSync('server.js', newContent);

console.log('Legacy endpoints added successfully!');