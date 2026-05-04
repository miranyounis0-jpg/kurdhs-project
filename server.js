const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

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

// --- ٢. ڕێکخستنی ئیمەیڵ (Nodemailer) ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,       // گۆڕدرا بۆ 465
    secure: true,    // گۆڕدرا بۆ true
    auth: {
        user: 'alleyesonyouna@gmail.com', 
        pass: 'wflxyhmppuajhsoj' // بۆشاییەکانمان لابرد
    }
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

    // دانانی ناو بۆ بەرهەمەکە بۆ ئەوەی لە ئیمەیڵەکەدا دەربکەوێت
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

app.get('/api/admin/orders', (req, res) => {
    res.json(orders);
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

// ناردنی کلیل و ئیمەیڵ بەیەکەوە (بۆ ئەوەی کێشەی نەناردنەکە چارەسەر بێت)
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

    // ڕێکخستنی ئیمەیڵ
    const mailOptions = {
        from: '"kurdHS Team" <alleyesonyouna@gmail.com>', 
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
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'کلیلەکە بە سەرکەوتوویی گەیەندرا و ئیمەیڵەکەش نێردرا!' });
    } catch (error) {
        console.error('SMTP Error:', error);
        res.json({ success: true, message: 'کلیلەکە گەیەندرا بەڵام کێشە لە ناردنی ئیمەیڵ هەبوو.' });
    }
});

// --- ٥. پیشاندانی لاپەڕەکانی فرۆشتن و ئەدمین ---
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/track', (req, res) => res.sendFile(path.join(__dirname, 'public', 'track.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
