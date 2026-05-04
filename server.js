
// دڵنیابە لە سەرووی فایلەکە ئەمە هەیە
const nodemailer = require('nodemailer');

// دروستکردنی گواستەرەوەی ئیمەیڵ (Mailer)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'alleyesonyouna@gmail.com', // ئیمەیڵی خۆت لێرە بنووسە
        pass: 'wflx yhmp puaj hsoj'     // 'App Password' لێرە دابنێ (نەک پاسوۆردی ئاسایی)
    }
});

// گۆڕینی بەشی deliver بۆ ئەوەی ئیمەیڵ بنێرێت
app.post('/api/admin/deliver/:orderId', async (req, res) => {
    // ... کۆدی دۆزینەوەی داواکاری و دەرهێنانی کلیل ...

    const mailOptions = {
        from: 'your-email@gmail.com',
        to: order.email,
        subject: `Your Key - ${order.label}`,
        text: `Hi! Your payment is verified. Your key is: ${assignedKey}`
    };

    try {
        await transporter.sendMail(mailOptions); // ناردنی ئیمەیڵەکە
        res.json({ success: true, message: 'ئیمەیڵ بۆ کڕیارەکە نێردرا!' });
    } catch (error) {
        console.error('Email Error:', error);
        res.status(500).json({ error: 'کلیلەکە گەیەندرا بەڵام ئیمەیڵەکە نەڕۆیشت' });
    }
});

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000; // پێویستە بۆ Render[cite: 10]

app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ئەم بەشە زیاد بکە بۆ ناو فایلی server.js
let orders = []; // بۆ پاشەکەوتکردنی کاتیی داواکارییەکان

app.post('/api/manual-order', (req, res) => {
    const { type, email, transactionId, whatsapp } = req.body; // وەرگرتنی زانیارییەکان لە فۆرمەکەوە

    if (!type || !email || !transactionId || !whatsapp) {
        return res.status(400).json({ error: 'تکایە هەموو خانەکان پڕ بکەرەوە' });
    }

    const newOrder = {
        id: Date.now().toString(),
        type,
        email,
        transactionId,
        whatsapp,
        status: 'pending', // باری داواکارییەکە وەک 'چاوەڕوانکردن' دادەنرێت[cite: 9, 10]
        createdAt: new Date().toISOString()
    };

    orders.unshift(newOrder); // زیادکردنی بۆ لیستی داواکارییەکان
    res.json({ success: true, message: 'داواکارییەکەت نێردرا! ئێستا ئەدمین پێداچوونەوەی بۆ دەکات.' });
});

// ڕێگایەک بۆ ئەوەی ئەدمین بتوانێت داواکارییەکان ببینێت
app.get('/api/admin/orders', (req, res) => {
    res.json(orders);
});

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

// ئەم بەشە زیاد بکە بۆ ناو فایلی server.js پێش app.listen
app.post('/api/admin/deliver/:orderId', (req, res) => {
    const { orderId } = req.params;
    const token = req.headers['x-admin-token'];

    // پشکنینی ڕێپێدان
    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return res.status(404).json({ error: 'داواکارییەکە نەدۆزرایەوە' });

    const order = orders[orderIndex];

    // پشکنینی ئەوەی ئایا کلیل لە کۆگادا هەیە بۆ ئەو جۆرە
    if (!stock[order.type] || stock[order.type].length === 0) {
        return res.status(400).json({ error: `کلیل بەردەست نییە بۆ ${order.type}` });
    }

    // دەرهێنانی یەکەم کلیل لە لیستی کلیلەکان[cite: 10]
    const assignedKey = stock[order.type].shift();

    // نوێکردنەوەی باری داواکارییەکە بۆ گەیەندراو[cite: 9, 10]
    orders[orderIndex].status = 'delivered';
    orders[orderIndex].key = assignedKey;
    orders[orderIndex].deliveredAt = new Date().toISOString();

    res.json({ success: true, message: 'کلیلەکە بە سەرکەوتوویی گەیەندرا!', key: assignedKey });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
