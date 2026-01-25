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
        const bookings = await bookingsDB.find({});
        res.json(bookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
});

app.get("/contacts.json", requireAuth, async (req, res) => {
    try {
        const contacts = await contactsDB.find({});
        res.json(contacts);
    } catch (error) {
        console.error("Error fetching contacts:", error);
        res.status(500).json({ error: "Failed to fetch contacts" });
    }
});

app.get("/testimonials.json", requireAuth, async (req, res) => {
    try {
        const testimonials = await testimonialsDB.find({});
        res.json(testimonials);
    } catch (error) {
        console.error("Error fetching testimonials:", error);
        res.status(500).json({ error: "Failed to fetch testimonials" });
    }
});

app.delete("/delete-testimonial/:id", requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: "Invalid testimonial ID" });
        }
        
        await testimonialsDB.delete({ id: id });
        res.json({ status: "success", message: "Testimonial deleted successfully" });
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