const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

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

// --- API FOR INDEX.HTML ---

// Fix: This provides the price and image data your index.html needs
app.get('/api/products', (req, res) => {
    res.json(products);
});

// Fix: This provides the key counts (stock) your index.html needs
app.get('/api/stock', (req, res) => {
    // We send back the length (count) of each key array
    const counts = {
        one_day: stock.one_day.length,
        seven_day: stock.seven_day.length,
        thirty_day: stock.thirty_day.length
    };
    res.json(counts);
});

// --- ADMIN API ROUTES ---

app.post('/api/admin/login', (req, res) => {
    if (req.body.password === 'admin123') {
        res.json({ token: adminToken });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

app.post('/api/admin/stock/add', (req, res) => {
    const { type, keys } = req.body;
    if (!stock[type]) stock[type] = [];
    stock[type] = [...stock[type], ...keys];
    res.json({ message: 'Keys added!', added: keys.length });
});

// --- PAGE NAVIGATION ---

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
