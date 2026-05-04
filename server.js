const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000; // پێویستە بۆ Render[cite: 10]

app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// داتاکان بە کاتی لێرە پاشەکەوت دەبن (Temporary Memory)
let stock = { one_day: [], seven_day: [], thirty_day: [] };
let products = {
    one_day: { price: 5, imageUrl: "" },
    seven_day: { price: 20, imageUrl: "" },
    thirty_day: { price: 60, imageUrl: "" }
};
let adminSessions = new Set();
const adminToken = "secret-session-123";

// ڕێگاکانی لاپەڕەی سەرەکی[cite: 10]
app.get('/api/products', (req, res) => res.json(products));
app.get('/api/stock', (req, res) => {
    res.json({
        one_day: stock.one_day.length,
        seven_day: stock.seven_day.length,
        thirty_day: stock.thirty_day.length
    });
});

// ڕێگاکانی ئەدمین[cite: 10]
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === (process.env.ADMIN_PASSWORD || 'admin123')) {
        res.json({ success: true, token: adminToken });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

app.get('/api/admin/stock', (req, res) => res.json(stock));

app.post('/api/admin/stock/add', (req, res) => {
    const { type, keys } = req.body;
    if (stock[type]) {
        stock[type].push(...keys);
        res.json({ success: true, added: keys.length });
    } else {
        res.status(400).json({ error: 'Invalid type' });
    }
});

// گەورەکردنی لاپەڕەکان[cite: 10]
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/track', (req, res) => res.sendFile(path.join(__dirname, 'public', 'track.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
