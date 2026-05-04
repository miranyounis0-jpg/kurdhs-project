const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- ١. داتابەیس (بە شێوەی داینامیک) ---
let orders = []; 
let stock = { one_day: [], seven_day: [], thirty_day: [] };
let products = {
    one_day: { price: 5, imageUrl: "", label: "1 Day Key" },
    seven_day: { price: 20, imageUrl: "", label: "7 Days Key" },
    thirty_day: { price: 60, imageUrl: "", label: "30 Days Key" }
};
const adminToken = "secret-session-123";
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxR_jmwD1ry1Lh-XhMHNKJlarxA7CRz57AZUrcqHr5id3amFHdx8akGg3jidFGAclcO2A/exec'; 

// --- ٢. API بۆ زیادکردنی بەرهەمی نوێ ---
app.post('/api/admin/add-product', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    
    const { id, label, price, imageUrl } = req.body;
    if (!id || !label || !price) return res.status(400).json({ error: 'تکایە هەموو زانیارییەکان بنێرە' });

    // زیادکردن بۆ لیستی بەرهەمەکان
    products[id] = { 
        price: Number(price), 
        imageUrl: imageUrl || "", 
        label: label 
    };
    
    // دروستکردنی شوێنی ستۆک بۆی
    if (!stock[id]) stock[id] = []; 

    res.json({ success: true, message: 'بەرهەمەکە بە سەرکەوتوویی زیادکرا' });
});

// گەڕاندنەوەی هەموو بەرهەمەکان
app.get('/api/products', (req, res) => res.json(products));

// گەڕاندنەوەی ستۆکەکان
app.get('/api/admin/stock', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    res.json(stock);
});

// --- کۆدی کۆتایی سێرڤەر ---
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`Server is running`));
