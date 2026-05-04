const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000; // Required for Render

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE (Temporary Memory) ---
let stock = { one_day: [], seven_day: [], thirty_day: [] };
let products = {
    one_day: { price: 5, imageUrl: "" },
    seven_day: { price: 20, imageUrl: "" },
    thirty_day: { price: 60, imageUrl: "" }
};
let adminToken = "secret-session-123";

// --- API FOR ADMIN PANEL & STOREFRONT ---

// Fix: This provides the key lists to the admin "Stock Management" tab
app.get('/api/admin/stock', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    res.json(stock);
});

// Fix: This provides product prices and images
app.get('/api/products', (req, res) => {
    res.json(products);
});

// Fix: This allows the admin panel to actually add keys[cite: 3, 5]
app.post('/api/admin/stock/add', (req, res) => {
    const token = req.headers['x-admin-token'];
    const { type, keys } = req.body;
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    if (!stock[type]) stock[type] = [];
    stock[type] = [...stock[type], ...keys];
    res.json({ message: 'Keys added!', added: keys.length });
});

// Admin Login[cite: 3, 5]
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === 'admin123') {
        res.json({ token: adminToken });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// --- NAVIGATION ---
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
