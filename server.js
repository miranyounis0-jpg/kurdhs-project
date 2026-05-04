const express = require('express');
const path = require('path');
const app = express();
// Render uses process.env.PORT, local uses 3000
const PORT = process.env.PORT || 3000; 

// MIDDLEWARE: Required to read the data sent from your admin panel
app.use(express.json({ limit: '10mb' })); 
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE (Temporary Memory) ---
// Note: Data resets when Render restarts. 
let stock = { one_day: [], seven_day: [], thirty_day: [] };
let products = {
    one_day: { price: 5, imageUrl: "" },
    seven_day: { price: 20, imageUrl: "" },
    thirty_day: { price: 60, imageUrl: "" }
};
let adminToken = "secret-session-123";

// --- ADMIN API ROUTES ---

// Login Route
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === 'admin123') {
        res.json({ token: adminToken });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// Load Stock Route
app.get('/api/admin/stock', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    res.json(stock);
});

// Add Keys Route (This fixes your "Network Error")
app.post('/api/admin/stock/add', (req, res) => {
    const token = req.headers['x-admin-token'];
    const { type, keys } = req.body;
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    
    if (!stock[type]) stock[type] = [];
    stock[type] = [...stock[type], ...keys];
    res.json({ message: 'Keys added successfully!', added: keys.length });
});

// Load Products (for price/images)
app.get('/api/products', (req, res) => {
    res.json(products);
});

// --- PAGE NAVIGATION ROUTES ---

// Allow typing /admin without .html
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/verify', (req, res) => {
    res.send('<h1>Success!</h1><p>Your kurdHS account is now verified.</p>');
});

app.listen(PORT, () => {
    console.log(`kurdHS server running on port ${PORT}`);
});
