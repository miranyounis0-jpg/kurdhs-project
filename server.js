const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- ١. داتابەیس و گۆڕاوەکان ---
let orders = []; 
let stock = { one_day: [], seven_day: [], thirty_day: [] };
let products = {
    one_day: { price: 5, imageUrl: "", label: "1 Day Key" },
    seven_day: { price: 20, imageUrl: "", label: "7 Days Key" },
    thirty_day: { price: 60, imageUrl: "", label: "30 Days Key" }
};
const adminToken = "secret-session-123";
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxR_jmwD1ry1Lh-XhMHNKJlarxA7CRz57AZUrcqHr5id3amFHdx8akGg3jidFGAclcO2A/exec'; 

// --- ٢. بەشی ئامارەکان (Analytics) ---
let analyticsData = { totalViews: 0, uniqueVisitors: new Set(), viewsToday: 0, lastResetDate: new Date().toDateString(), dailyStats: {} };

app.post('/api/track-visit', (req, res) => {
    const today = new Date().toDateString();
    const dateKey = new Date().toISOString().split('T')[0];
    if (analyticsData.lastResetDate !== today) { analyticsData.viewsToday = 0; analyticsData.lastResetDate = today; }
    analyticsData.totalViews++;
    analyticsData.viewsToday++;
    if (!analyticsData.dailyStats[dateKey]) { analyticsData.dailyStats[dateKey] = 0; }
    analyticsData.dailyStats[dateKey]++;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip) analyticsData.uniqueVisitors.add(ip);
    res.json({ success: true });
});

app.get('/api/admin/analytics', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        last7Days.push({ date: dateKey, views: analyticsData.dailyStats[dateKey] || 0 });
    }
    res.json({ totalViews: analyticsData.totalViews, uniqueVisitors: analyticsData.uniqueVisitors.size, viewsToday: analyticsData.viewsToday, chartData: last7Days });
});

// --- ٣. ڕێگاکانی بەرهەم و ستۆک ---
app.get('/api/products', (req, res) => res.json(products));
app.get('/api/stock', (req, res) => {
    let stockCount = {};
    for (let key in stock) { stockCount[key] = stock[key].length; }
    res.json(stockCount);
});

// زیادکردنی بەرهەمی نوێ لە ئەدمینەوە
app.post('/api/admin/add-product', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    const { id, label, price, imageUrl } = req.body;
    if (!id || !label) return res.status(400).json({ error: 'ناو و ناسنامەی کاڵا پێویستە' });
    products[id] = { price: Number(price) || 0, imageUrl: imageUrl || "", label: label };
    if (!stock[id]) stock[id] = [];
    res.json({ success: true });
});

app.post('/api/manual-order', (req, res) => {
    const { type, email, transactionId, whatsapp } = req.body;
    if (!products[type]) return res.status(400).json({ error: 'کاڵاکە بوونی نییە' });
    const newOrder = { id: Date.now().toString(), type, label: products[type].label, email, transactionId, whatsapp, status: 'pending', createdAt: new Date().toISOString() };
    orders.unshift(newOrder); 
    res.json({ success: true });
});

// --- ٤. ئەدمین و گەیاندن ---
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === (process.env.ADMIN_PASSWORD || 'admin123')) res.json({ success: true, token: adminToken });
    else res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/admin/orders', (req, res) => res.json(orders));
app.get('/api/admin/stock', (req, res) => res.json(stock));

app.post('/api/admin/stock/add', (req, res) => {
    const { type, keys } = req.body;
    if (stock[type]) { stock[type].push(...keys); res.json({ success: true }); }
    else res.status(400).json({ error: 'Invalid type' });
});

app.post('/api/admin/deliver/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const token = req.headers['x-admin-token'];
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return res.status(404).json({ error: 'نەدۆزرایەوە' });
    const order = orders[orderIndex];
    if (!stock[order.type] || stock[order.type].length === 0) return res.status(400).json({ error: 'کلیل نییە' });
    const assignedKey = stock[order.type].shift();
    orders[orderIndex].status = 'delivered';
    orders[orderIndex].key = assignedKey;
    try {
        await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ to: order.email, subject: `Your Key - ${order.label}`, html: `<h2>Key: ${assignedKey}</h2>` })});
        res.json({ success: true });
    } catch (e) { res.json({ success: true, message: 'کێشەی ئیمەیڵ' }); }
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/track', (req, res) => res.sendFile(path.join(__dirname, 'public', 'track.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Server is running`));
