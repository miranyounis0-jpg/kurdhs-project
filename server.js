const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/track', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'track.html'));
});

const KEYS_FILE = path.join(__dirname, 'keys.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const ANALYTICS_FILE = path.join(__dirname, 'analytics.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const MAX_UNIQUE_VISITORS = 50000;
const VISITOR_COOKIE = 'kurdhs_vid';

const DEFAULT_PRICES = { one_day: 5, seven_day: 20, thirty_day: 60 };
const PRODUCT_TIERS = ['one_day', 'seven_day', 'thirty_day'];

function normalizeProducts(raw) {
    const out = {};
    PRODUCT_TIERS.forEach(t => {
        const src = (raw && raw[t]) || {};
        const priceNum = Number(src.price);
        out[t] = {
            imageUrl: typeof src.imageUrl === 'string' ? src.imageUrl : '',
            price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : DEFAULT_PRICES[t],
        };
    });
    return out;
}

function readProducts() {
    try {
        return normalizeProducts(JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')));
    } catch {
        return normalizeProducts({});
    }
}

function writeProducts(data) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(normalizeProducts(data), null, 2));
}

function formatPrice(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '$0';
    return Number.isInteger(num) ? `$${num}` : `$${num.toFixed(2)}`;
}

function readKeys() {
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
}

function writeKeys(data) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
}

function readOrders() {
    try {
        return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function writeOrders(data) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2));
}

function readAnalytics() {
    try {
        const raw = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
        return {
            totalViews: Number(raw.totalViews) || 0,
            uniqueVisitors: Array.isArray(raw.uniqueVisitors) ? raw.uniqueVisitors : [],
            dailyViews: (raw.dailyViews && typeof raw.dailyViews === 'object') ? raw.dailyViews : {},
        };
    } catch {
        return { totalViews: 0, uniqueVisitors: [], dailyViews: {} };
    }
}

function writeAnalytics(data) {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
}

function parseCookies(req) {
    const header = req.headers.cookie || '';
    const out = {};
    header.split(';').forEach(c => {
        const i = c.indexOf('=');
        if (i < 0) return;
        const k = c.slice(0, i).trim();
        if (k) out[k] = decodeURIComponent(c.slice(i + 1).trim());
    });
    return out;
}

function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}

let cachedMailer = null;

function createMailer() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return null;
    }
    if (cachedMailer) return cachedMailer;

    const port = parseInt(process.env.SMTP_PORT || '587');
    cachedMailer = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
    return cachedMailer;
}

function buildKeyEmail(order, key) {
    return {
        from: `kurdHS <${process.env.SMTP_USER}>`,
        to: order.email,
        subject: `Your kurdHS Key - ${order.label}`,
        text: `Hi! Your kurdHS payment has been verified.\n\nYour ${order.label}: ${key}\n\nOrder details:\n  Product: ${order.label} (${order.price})\n  FIB Transaction: ${order.transactionId}\n\nKeep this key safe and do not share it.\n— kurdHS Team`,
        html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',sans-serif;">
  <div style="max-width:500px;margin:40px auto;padding:30px;background:linear-gradient(135deg,#0f172a,#1e3a8a);border-radius:15px;border:1px solid rgba(0,229,255,0.3);">
    <h1 style="color:#00e5ff;margin:0 0 8px 0;font-size:28px;">kurdHS</h1>
    <p style="color:#aaa;margin:0 0 30px 0;">Digital Key Delivery</p>
    <p style="color:#fff;margin:0 0 8px 0;">Hi there! Your payment has been verified. Here is your <strong style="color:#00e5ff;">${order.label}</strong>:</p>
    <div style="background:rgba(0,0,0,0.4);border:2px solid #00e5ff;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
      <p style="color:#aaa;margin:0 0 8px 0;font-size:13px;">YOUR KEY</p>
      <code style="font-size:22px;font-weight:bold;color:#00e5ff;letter-spacing:3px;">${key}</code>
    </div>
    <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:15px;margin-bottom:20px;">
      <p style="color:#aaa;margin:0 0 5px 0;font-size:13px;">Order Details</p>
      <p style="color:#fff;margin:3px 0;font-size:14px;">Product: ${order.label} (${order.price})</p>
      <p style="color:#fff;margin:3px 0;font-size:14px;">FIB Transaction: ${order.transactionId}</p>
    </div>
    <p style="color:#aaa;font-size:13px;margin:0;">Keep this key safe and do not share it with anyone.</p>
    <p style="color:#aaa;font-size:13px;margin:8px 0 0 0;">Thank you for your purchase! — kurdHS Team</p>
  </div>
</body>
</html>`,
    };
}

const PRODUCT_LABELS = {
    one_day: '1 Day Key',
    seven_day: '7 Days Key',
    thirty_day: '30 Days Key',
};


const adminSessions = new Set();

const sseClients = new Map();

function sseSubscribe(whatsapp, res) {
    const key = whatsapp.replace(/\s+/g, '').toLowerCase();
    if (!sseClients.has(key)) sseClients.set(key, new Set());
    sseClients.get(key).add(res);
}

function sseUnsubscribe(whatsapp, res) {
    const key = whatsapp.replace(/\s+/g, '').toLowerCase();
    if (sseClients.has(key)) {
        sseClients.get(key).delete(res);
        if (sseClients.get(key).size === 0) sseClients.delete(key);
    }
}

function ssePush(whatsapp, data) {
    const key = whatsapp.replace(/\s+/g, '').toLowerCase();
    const clients = sseClients.get(key);
    if (!clients || clients.size === 0) return;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach(res => {
        try { res.write(payload); } catch {}
    });
}

const productSseClients = new Set();

function broadcastProducts() {
    const products = readProducts();
    const payload = `data: ${JSON.stringify({ type: 'products-updated', products })}\n\n`;
    productSseClients.forEach(res => {
        try { res.write(payload); } catch {}
    });
}

function getStockSnapshot() {
    try {
        const inv = readKeys();
        return {
            one_day: (inv.one_day || []).length,
            seven_day: (inv.seven_day || []).length,
            thirty_day: (inv.thirty_day || []).length,
        };
    } catch {
        return { one_day: 0, seven_day: 0, thirty_day: 0 };
    }
}

function broadcastStock() {
    const stock = getStockSnapshot();
    const payload = `data: ${JSON.stringify({ type: 'stock-updated', stock })}\n\n`;
    productSseClients.forEach(res => {
        try { res.write(payload); } catch {}
    });
}

function requireAdmin(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (!token || !adminSessions.has(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.get('/api/products', (req, res) => {
    res.json(readProducts());
});

const MAX_PRODUCT_SSE_CLIENTS = 200;

app.get('/api/products/stream', (req, res) => {
    if (productSseClients.size >= MAX_PRODUCT_SSE_CLIENTS) {
        return res.status(503).json({ error: 'Too many connected clients, try again shortly' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'connected', stock: getStockSnapshot(), products: readProducts() })}\n\n`);
    productSseClients.add(res);
    const heartbeat = setInterval(() => {
        try { res.write(': ping\n\n'); } catch {}
    }, 25000);
    req.on('close', () => {
        clearInterval(heartbeat);
        productSseClients.delete(res);
    });
});

app.post('/api/admin/products/image', requireAdmin, (req, res) => {
    const { type, imageUrl } = req.body || {};
    const validTypes = ['one_day', 'seven_day', 'thirty_day'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid product type' });
    }
    if (typeof imageUrl !== 'string') {
        return res.status(400).json({ error: 'imageUrl must be a string' });
    }
    const trimmed = imageUrl.trim();
    if (trimmed && !/^(https?:\/\/|\/uploads\/)/.test(trimmed)) {
        return res.status(400).json({ error: 'imageUrl must start with http(s):// or /uploads/' });
    }
    const products = readProducts();
    if (!products[type]) products[type] = {};
    products[type].imageUrl = trimmed;
    writeProducts(products);
    broadcastProducts();
    res.json({ success: true, products });
});

app.post('/api/admin/products/price', requireAdmin, (req, res) => {
    const { type, price } = req.body || {};
    if (!PRODUCT_TIERS.includes(type)) {
        return res.status(400).json({ error: 'Invalid product type' });
    }
    const num = Number(price);
    if (!Number.isFinite(num) || num <= 0) {
        return res.status(400).json({ error: 'Price must be a positive number (e.g. 5 or 4.99)' });
    }
    if (num > 100000) {
        return res.status(400).json({ error: 'Price too high (max 100000)' });
    }
    const rounded = Math.round(num * 100) / 100;
    const products = readProducts();
    products[type].price = rounded;
    writeProducts(products);
    broadcastProducts();
    res.json({ success: true, products });
});

app.post('/api/admin/products/upload', requireAdmin, (req, res) => {
    const { type, filename, dataUrl } = req.body || {};
    const validTypes = ['one_day', 'seven_day', 'thirty_day'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid product type' });
    }
    if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'Missing dataUrl' });
    }
    const match = dataUrl.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i);
    if (!match) {
        return res.status(400).json({ error: 'Only PNG, JPG, WEBP, or GIF images are allowed' });
    }
    const ext = match[1].toLowerCase().replace('jpeg', 'jpg');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 8 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image too large (max 8 MB)' });
    }
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const safeName = (filename || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40);
    const finalName = `${type}-${Date.now()}-${safeName.replace(/\.[^.]+$/, '')}.${ext}`;
    const fullPath = path.join(UPLOADS_DIR, finalName);
    fs.writeFileSync(fullPath, buffer);
    const publicUrl = `/uploads/${finalName}`;
    const products = readProducts();
    if (!products[type]) products[type] = {};
    products[type].imageUrl = publicUrl;
    writeProducts(products);
    broadcastProducts();
    res.json({ success: true, imageUrl: publicUrl, products });
});

const trackRateBuckets = new Map();
const TRACK_WINDOW_MS = 60 * 1000;
const TRACK_MAX_PER_WINDOW = 30;

function getClientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
    return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function trackRateLimit(req) {
    const ip = getClientIp(req);
    const now = Date.now();
    let arr = trackRateBuckets.get(ip);
    if (!arr) { arr = []; trackRateBuckets.set(ip, arr); }
    while (arr.length && now - arr[0] > TRACK_WINDOW_MS) arr.shift();
    if (arr.length >= TRACK_MAX_PER_WINDOW) return false;
    arr.push(now);
    if (trackRateBuckets.size > 5000) {
        for (const [k, v] of trackRateBuckets) {
            if (!v.length || now - v[v.length - 1] > TRACK_WINDOW_MS) trackRateBuckets.delete(k);
        }
    }
    return true;
}

app.post('/api/analytics/track', (req, res) => {
    if (!trackRateLimit(req)) {
        return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    }
    try {
        const cookies = parseCookies(req);
        let vid = cookies[VISITOR_COOKIE];
        let isNewCookie = false;
        if (!vid || !/^[a-f0-9-]{8,}$/i.test(vid)) {
            vid = crypto.randomUUID();
            isNewCookie = true;
        }
        if (isNewCookie) {
            const oneYear = 365 * 24 * 60 * 60;
            res.setHeader('Set-Cookie',
                `${VISITOR_COOKIE}=${vid}; Max-Age=${oneYear}; Path=/; HttpOnly; SameSite=Lax`);
        }

        const a = readAnalytics();
        a.totalViews += 1;
        const today = todayUTC();
        a.dailyViews[today] = (a.dailyViews[today] || 0) + 1;
        if (!a.uniqueVisitors.includes(vid)) {
            a.uniqueVisitors.push(vid);
            if (a.uniqueVisitors.length > MAX_UNIQUE_VISITORS) {
                a.uniqueVisitors.splice(0, a.uniqueVisitors.length - MAX_UNIQUE_VISITORS);
            }
        }
        writeAnalytics(a);
        res.json({ ok: true });
    } catch (err) {
        console.error('analytics track error:', err.message);
        res.status(500).json({ ok: false });
    }
});

app.get('/api/admin/analytics', requireAdmin, (req, res) => {
    const a = readAnalytics();
    const today = todayUTC();
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().slice(0, 10);
        last7.push({ date: key, count: a.dailyViews[key] || 0 });
    }
    res.json({
        totalViews: a.totalViews,
        uniqueVisitors: a.uniqueVisitors.length,
        viewsToday: a.dailyViews[today] || 0,
        last7Days: last7,
    });
});

app.get('/api/stock', (req, res) => {
    try {
        const inventory = readKeys();
        res.json({
            one_day: inventory.one_day.length,
            seven_day: inventory.seven_day.length,
            thirty_day: inventory.thirty_day.length,
        });
    } catch (error) {
        console.error('Error reading keys.json', error);
        res.status(500).json({ error: 'Could not read stock' });
    }
});

app.post('/api/manual-order', (req, res) => {
    const { type, email, transactionId, whatsapp } = req.body;

    if (!type || !email || !transactionId || !whatsapp) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!PRODUCT_TIERS.includes(type)) {
        return res.status(400).json({ error: 'Invalid product type' });
    }

    const products = readProducts();
    const order = {
        id: crypto.randomUUID(),
        type,
        email,
        whatsapp: whatsapp.trim(),
        transactionId,
        price: formatPrice(products[type].price),
        label: PRODUCT_LABELS[type],
        status: 'pending',
        createdAt: new Date().toISOString(),
    };

    const orders = readOrders();
    orders.unshift(order);
    writeOrders(orders);

    console.log('\n======================================');
    console.log('NEW FIB ORDER RECEIVED!');
    console.log(`Order ID:  ${order.id}`);
    console.log(`Product:   ${order.label} (${order.price})`);
    console.log(`Email:     ${email}`);
    console.log(`WhatsApp:  ${whatsapp}`);
    console.log(`FIB ID:    ${transactionId}`);
    console.log('======================================\n');

    res.json({
        success: true,
        message: 'Order received! Track your order status anytime on the Track My Order page using your WhatsApp number.',
    });
});

app.get('/api/track/stream', (req, res) => {
    const { whatsapp } = req.query;
    if (!whatsapp) return res.status(400).end();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(': connected\n\n');

    sseSubscribe(whatsapp, res);

    req.on('close', () => {
        sseUnsubscribe(whatsapp, res);
    });
});

app.get('/api/track', (req, res) => {
    const { whatsapp } = req.query;
    if (!whatsapp) {
        return res.status(400).json({ error: 'WhatsApp number required' });
    }

    const orders = readOrders();
    const normalized = whatsapp.trim().replace(/\s+/g, '');

    const found = orders
        .filter(o => o.whatsapp && o.whatsapp.replace(/\s+/g, '') === normalized)
        .map(o => ({
            id: o.id,
            label: o.label,
            price: o.price,
            status: o.status,
            createdAt: o.createdAt,
            deliveredAt: o.deliveredAt || null,
            key: o.status === 'delivered' ? o.key : null,
        }));

    res.json(found);
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (password !== adminPassword) {
        return res.status(401).json({ error: 'Wrong password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.add(token);
    res.json({ success: true, token });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
    const orders = readOrders();
    res.json(orders);
});

app.post('/api/admin/deliver/:orderId', requireAdmin, async (req, res) => {
    const { orderId } = req.params;
    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[orderIndex];

    if (order.status === 'delivered') {
        return res.status(409).json({ error: 'Order already delivered' });
    }

    let inventory;
    try {
        inventory = readKeys();
    } catch {
        return res.status(500).json({ error: 'Could not read inventory' });
    }

    if (!inventory[order.type] || inventory[order.type].length === 0) {
        return res.status(409).json({ error: `No keys in stock for ${order.label}` });
    }

    const key = inventory[order.type].shift();
    writeKeys(inventory);
    broadcastStock();

    orders[orderIndex].status = 'delivered';
    orders[orderIndex].key = key;
    orders[orderIndex].deliveredAt = new Date().toISOString();
    writeOrders(orders);

    console.log(`\nKey delivered: ${key} -> ${order.email} (${order.label})`);

    if (order.whatsapp) {
        ssePush(order.whatsapp, {
            type: 'delivered',
            orderId: order.id,
            label: order.label,
            price: order.price,
            key,
            deliveredAt: orders[orderIndex].deliveredAt,
        });
    }

    const mailer = createMailer();
    if (!mailer) {
        console.warn('SMTP not configured — key issued but email NOT sent. Key:', key);
        return res.json({
            success: true,
            emailSent: false,
            message: `Key ${key} delivered. Email not configured — please send manually.`,
            key,
        });
    }

    try {
        const info = await mailer.sendMail(buildKeyEmail(order, key));
        console.log(`✓ Email sent to ${order.email} (messageId: ${info.messageId})`);
        return res.json({
            success: true,
            emailSent: true,
            message: `✓ Key ${key} delivered and email sent to ${order.email}`,
            key,
        });
    } catch (err) {
        console.error('✗ Email send error for', order.email, '-', err.message);
        return res.json({
            success: true,
            emailSent: false,
            emailError: err.message,
            message: `Key ${key} delivered, but EMAIL FAILED: ${err.message}. Please contact ${order.email} manually.`,
            key,
        });
    }
});

app.post('/api/admin/reject/:orderId', requireAdmin, (req, res) => {
    const { orderId } = req.params;
    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
        return res.status(404).json({ error: 'Order not found' });
    }

    orders[orderIndex].status = 'rejected';
    orders[orderIndex].rejectedAt = new Date().toISOString();
    writeOrders(orders);

    res.json({ success: true, message: 'Order rejected' });
});

app.get('/api/admin/stock', requireAdmin, (req, res) => {
    try {
        const inventory = readKeys();
        res.json(inventory);
    } catch {
        res.status(500).json({ error: 'Could not read inventory' });
    }
});

app.post('/api/admin/stock/add', requireAdmin, (req, res) => {
    const { type, keys } = req.body;
    const validTypes = ['one_day', 'seven_day', 'thirty_day'];

    if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid product type' });
    }

    if (!Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({ error: 'No keys provided' });
    }

    const cleaned = keys.map(k => String(k).trim()).filter(k => k.length > 0);
    if (cleaned.length === 0) {
        return res.status(400).json({ error: 'No valid keys after trimming' });
    }

    const inventory = readKeys();
    const duplicates = cleaned.filter(k => inventory[type].includes(k));
    const newKeys = cleaned.filter(k => !inventory[type].includes(k));

    inventory[type].push(...newKeys);
    writeKeys(inventory);
    broadcastStock();

    res.json({
        success: true,
        added: newKeys.length,
        duplicatesSkipped: duplicates.length,
        total: inventory[type].length,
    });
});

app.delete('/api/admin/stock/remove', requireAdmin, (req, res) => {
    const { type, key } = req.body;
    const validTypes = ['one_day', 'seven_day', 'thirty_day'];

    if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid product type' });
    }

    const inventory = readKeys();
    const index = inventory[type].indexOf(key);

    if (index === -1) {
        return res.status(404).json({ error: 'Key not found' });
    }

    inventory[type].splice(index, 1);
    writeKeys(inventory);
    broadcastStock();

    res.json({ success: true, remaining: inventory[type].length });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`kurdHS server running on port ${PORT}`);

    if (!process.env.ADMIN_PASSWORD) {
        console.log('WARNING: ADMIN_PASSWORD not set. Default is "admin123" - change this!');
    }

    const mailer = createMailer();
    if (!mailer) {
        console.log('INFO: SMTP not configured. Email delivery is DISABLED.');
        return;
    }

    console.log(`Verifying SMTP connection to ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || '587'} as ${process.env.SMTP_USER}...`);
    try {
        await mailer.verify();
        console.log('✓ SMTP READY — email delivery is fully active.');
    } catch (err) {
        console.error('✗ SMTP VERIFICATION FAILED:', err.message);
        console.error('  Email delivery WILL NOT WORK until this is fixed.');
        console.error('  For Gmail: ensure SMTP_USER is your full email and SMTP_PASS is a 16-char App Password (not your regular Gmail password).');
        console.error('  Generate one at: myaccount.google.com → Security → 2-Step Verification → App Passwords');
    }
});
