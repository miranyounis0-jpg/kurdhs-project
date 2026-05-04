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
    one_day: { price: 5, imageUrl: "" },
    seven_day: { price: 20, imageUrl: "" },
    thirty_day: { price: 60, imageUrl: "" }
};
const adminToken = "secret-session-123";

// لینکەکەی گوگڵ
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxR_jmwD1ry1Lh-XhMHNKJlarxA7CRz57AZUrcqHr5id3amFHdx8akGg3jidFGAclcO2A/exec'; 

// --- ٢. بەشی ئامارەکان (Analytics) ---
let analyticsData = {
    totalViews: 0,
    uniqueVisitors: new Set(),
    viewsToday: 0,
    lastResetDate: new Date().toDateString(),
    dailyStats: {} 
};

app.post('/api/track-visit', (req, res) => {
    const today = new Date().toDateString();
    const dateKey = new Date().toISOString().split('T')[0];

    if (analyticsData.lastResetDate !== today) {
        analyticsData.viewsToday = 0;
        analyticsData.lastResetDate = today;
    }

    analyticsData.totalViews++;
    analyticsData.viewsToday++;

    if (!analyticsData.dailyStats[dateKey]) {
        analyticsData.dailyStats[dateKey] = 0;
    }
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
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        last7Days.push({
            date: dateKey,
            views: analyticsData.dailyStats[dateKey] || 0
        });
    }

    res.json({
        totalViews: analyticsData.totalViews,
        uniqueVisitors: analyticsData.uniqueVisitors.size,
        viewsToday: analyticsData.viewsToday,
        chartData: last7Days
    });
});

// --- ٣. ڕێگاکانی لاپەڕەی سەرەکی کڕیار ---
app.get('/api/products', (req, res) => res.json(products));
app.get('/api/stock', (req, res) => {
    res.json({
        one_day: stock.one_day.length,
        seven_day: stock.seven_day.length,
        thirty_day: stock.thirty_day.length
    });
});

app.post('/api/manual-order', (req, res) => {
    const { type, email, transactionId, whatsapp } = req.body;

    if (!type || !email || !transactionId || !whatsapp) {
        return res.status(400).json({ error: 'تکایە هەموو خانەکان پڕ بکەرەوە' });
    }

    const productLabels = {
        'one_day': '1 Day Key',
        'seven_day': '7 Days Key',
        'thirty_day': '30 Days Key'
    };

    const newOrder = {
        id: Date.now().toString(),
        type,
        label: productLabels[type] || type, 
        email,
        transactionId,
        whatsapp,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    orders.unshift(newOrder); 
    res.json({ success: true, message: 'داواکارییەکەت نێردرا! ئێستا ئەدمین پێداچوونەوەی بۆ دەکات.' });
});

// --- ٤. ڕێگاکانی ئەدمین ---
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === (process.env.ADMIN_PASSWORD || 'admin123')) {
        res.json({ success: true, token: adminToken });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

app.get('/api/admin/orders', (req, res) => res.json(orders));
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

// ناردنی کلیل و ئیمەیڵ بە بەکارهێنانی پردی گوگڵ
app.post('/api/admin/deliver/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const token = req.headers['x-admin-token'];

    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return res.status(404).json({ error: 'داواکارییەکە نەدۆزرایەوە' });

    const order = orders[orderIndex];

    if (!stock[order.type] || stock[order.type].length === 0) {
        return res.status(400).json({ error: 'کلیل لە کۆگادا نەماوە!' });
    }

    const assignedKey = stock[order.type].shift();

    orders[orderIndex].status = 'delivered';
    orders[orderIndex].key = assignedKey;
    orders[orderIndex].deliveredAt = new Date().toISOString();

    try {
        const emailResponse = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                to: order.email,
                subject: `Your Key - ${order.label}`,
                html: `
                <div style="font-family: sans-serif; padding: 20px; background-color: #f4f4f4;">
                    <h2 style="color: #00e5ff;">Hi! Your key is ready.</h2>
                    <p>Product: <b>${order.label}</b></p>
                    <div style="padding: 15px; background: #fff; border: 2px solid #00e5ff; font-size: 20px; font-weight: bold; text-align: center;">
                        ${assignedKey}
                    </div>
                    <p>Thank you for choosing kurdHS!</p>
                </div>`
            })
        });
        
        if (!emailResponse.ok) {
             throw new Error(`HTTP error! status: ${emailResponse.status}`);
        }

        res.json({ success: true, message: 'کلیلەکە بە سەرکەوتوویی گەیەندرا و ئیمەیڵەکەش نێردرا!' });
    } catch (error) {
        console.error('Email API Error:', error);
        res.json({ success: true, message: 'کلیلەکە گەیەندرا بەڵام کێشە لە ناردنی ئیمەیڵ هەبوو.' });
    }
});

// --- ٥. نوێکردنەوەی نرخ و وێنەی بەرهەمەکان (بەهێزکراو) ---
app.post('/api/admin/products/:type', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

    let type = req.params.type;
    const { price, imageUrl } = req.body;

    let actualType = type;
    if (type.includes('1') || type === 'one_day') actualType = 'one_day';
    else if (type.includes('7') || type === 'seven_day') actualType = 'seven_day';
    else if (type.includes('30') || type === 'thirty_day') actualType = 'thirty_day';

    if (products[actualType]) {
        if (price !== undefined && price !== "") products[actualType].price = Number(price);
        if (imageUrl !== undefined && imageUrl !== "") products[actualType].imageUrl = imageUrl;
        res.json({ success: true, message: 'بە سەرکەوتوویی نوێکرایەوە!' });
    } else {
        res.status(400).json({ error: 'بەرهەمەکە نەدۆزرایەوە' });
    }
});

app.post('/api/admin/products', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

    const data = req.body;
    
    if (data && data.type) {
        let actualType = data.type;
        if (actualType.includes('1')) actualType = 'one_day';
        else if (actualType.includes('7')) actualType = 'seven_day';
        else if (actualType.includes('30')) actualType = 'thirty_day';

        if (products[actualType]) {
            if (data.price !== undefined) products[actualType].price = Number(data.price);
            if (data.imageUrl !== undefined) products[actualType].imageUrl = data.imageUrl;
            return res.json({ success: true, message: 'بە سەرکەوتوویی نوێکرایەوە!' });
        }
    }

    if (data && typeof data === 'object') {
        for (const key in data) {
            let actualKey = key;
            if (key.includes('1')) actualKey = 'one_day';
            else if (key.includes('7')) actualKey = 'seven_day';
            else if (key.includes('30')) actualKey = 'thirty_day';

            if (products[actualKey]) {
                if (data[key].price !== undefined) products[actualKey].price = Number(data[key].price);
                if (data[key].imageUrl !== undefined) products[actualKey].imageUrl = data[key].imageUrl;
            }
        }
        return res.json({ success: true, message: 'نوێکرایەوە' });
    }
    res.status(400).json({ error: 'شێوازی ناردنی داتا هەڵەیە' });
});

// --- ٦. پیشاندانی لاپەڕەکانی فرۆشتن و ئەدمین ---
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/track', (req, res) => res.sendFile(path.join(__dirname, 'public', 'track.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
