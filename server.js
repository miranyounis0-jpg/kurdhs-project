
// دڵنیابە لە سەرووی فایلەکە ئەمە هەیە
const nodemailer = require('nodemailer');

// لێرەدا ئیمەیڵی خۆت و App Passwordـەکەت دابنێ
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true بۆ پۆرتی 465، false بۆ پۆرتی 587
    auth: {
        user: 'alleyesonyouna@gmail.com', 
        pass: 'wflx yhmp puaj hsoj'
    }
});

app.post('/api/admin/deliver/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const token = req.headers['x-admin-token'];

    if (token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return res.status(404).json({ error: 'Order not found' });

    const order = orders[orderIndex];

    if (!stock[order.type] || stock[order.type].length === 0) {
        return res.status(400).json({ error: 'No keys in stock' });
    }

    const assignedKey = stock[order.type].shift(); // دەرهێنانی کلیل لە ستۆک

    // نوێکردنەوەی باری داواکاری
    orders[orderIndex].status = 'delivered';
    orders[orderIndex].key = assignedKey;
    orders[orderIndex].deliveredAt = new Date().toISOString();

    // ناردنی ئیمەیڵ[cite: 5]
   const mailOptions = {
        // لێرە پێویستە هێمای < پێش ئیمەیڵەکە هەبێت
        from: '"kurdHS Team" <alleyesonyouna@gmail.com>', 
        to: order.email, // ئیمەیڵی کڕیار کە لە داواکارییەکەدا هاتووە
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
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'کلیلەکە گەیەندرا و ئیمەیڵەکەش نێردرا!' });
    } catch (error) {
        console.error('SMTP Error:', error);
        res.json({ success: true, message: 'کلیلەکە گەیەندرا بەڵام ئیمەیڵەکە نەنێردرا. کێشەی SMTP هەیە.' });
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
