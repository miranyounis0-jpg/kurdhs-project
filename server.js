const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Allow the server to read JSON data sent from the admin panel
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE (Temporary memory storage) ---
// Note: In a real app, use a database. This resets when Render restarts.
let stock = {
    one_day: [],
    seven_day: [],
    thirty_day: []
};
let adminToken = "secret-token-123"; // This is a simple session check

// --- ADMIN ROUTES ---

// Login Route
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    // The default password you've been using
    if (password === 'admin123') {
        res.json({ token: adminToken });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

// Load Stock Route
app.get('/api/admin/stock', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    res.json(stock);
});

// Add Keys Route (This fixes your Network Error!)
app.post('/api/admin/stock/add', (req, res) => {
    const token = req.headers['x-admin-token'];
    const { type, keys } = req.body;

    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    if (!stock[type]) return res.status(400).json({ error: 'Invalid type' });

    stock[type] = [...stock[type], ...keys];
    res.json({ message: 'Keys added!', added: keys.length });
});

// --- GENERAL ROUTES ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/verify', (req, res) => {
    res.send('<h1>Success!</h1><p>Your kurdHS account is now verified.</p>');
});

app.listen(PORT, () => {
    console.log(`kurdHS server running on port ${PORT}`);
});
