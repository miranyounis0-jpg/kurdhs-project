# kurdHS — Digital Key Store

## Overview
A digital key selling site with login screen, key store cards, FIB (First Iraqi Bank) payment flow, and a full admin panel. Plain HTML/CSS/JS frontend served by an Express backend.

## Architecture
Single Express server on port 5000 that serves both the HTML frontend and the API.

```
backend/
  server.js         ← Express server (port 5000, host 0.0.0.0)
  keys.json         ← Key inventory (one_day, seven_day, thirty_day arrays)
  orders.json       ← Persistent order queue (pending/delivered/rejected)
  products.json     ← Per-product config (image URLs)
  public/
    index.html      ← The customer-facing website (with looping video bg)
    admin.html      ← Admin panel (served at /admin)
    track.html      ← Customer Track My Order page (live SSE updates)
    videos/
      bg.mp4        ← Looping cyberpunk neon background video (~4.4MB)
      bg-poster.jpg ← Poster image shown before video loads
    uploads/        ← Admin-uploaded product images
  package.json
```

## Workflow
- **"Start application"** → `cd backend && node server.js` (port 5000, webview)

## API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/stock | Returns count of keys per tier |
| GET | /api/products | Public — returns product config (image URLs per tier) |
| GET | /api/products/stream | Public SSE — pushes product updates to all open storefronts |
| POST | /api/manual-order | Saves FIB order to orders.json with status "pending" |
| GET | /api/track/stream | Per-customer SSE — pushes delivery events to track page |
| POST | /api/admin/login | Admin login — returns session token |
| GET | /api/admin/orders | List all orders (auth required) |
| POST | /api/admin/deliver/:id | Pull key from stock, email customer, mark delivered (auth required) |
| POST | /api/admin/reject/:id | Mark order rejected (auth required) |
| GET | /api/admin/stock | View full key inventory (auth required) |
| POST | /api/admin/stock/add | Add keys to a tier — deduplicates (auth required) |
| DELETE | /api/admin/stock/remove | Remove a specific key from a tier (auth required) |
| POST | /api/admin/products/image | Set image URL for a tier — must be http(s):// or /uploads/ (auth required) |
| POST | /api/admin/products/upload | Upload image file as base64 dataUrl, saved to /uploads/ (auth required, max 8MB, PNG/JPG/WEBP/GIF) |

## Admin Panel
Located at `/admin`. Password protected (uses `ADMIN_PASSWORD` env var).

**Features:**
- **Orders tab**: View all orders (pending/delivered/rejected), confirm payments with "Confirm & Deliver Key" button (emails customer + removes from stock), reject invalid orders. Auto-refreshes every 15 seconds.
- **Stock Management tab**: Add keys in bulk (paste one per line), view current stock counts, remove individual keys. Duplicate detection on add.
- **Products tab**: Manage the **price** (USD, positive number, max 100000) and the image shown on each storefront card. For images, paste a URL **or** upload a file (PNG/JPG/WEBP/GIF, ≤8MB) per tier. All product changes are broadcast over SSE so any open storefront updates the displayed price/image instantly with no refresh. Prices are stored in `products.json` and are the **sole source of truth** — the server uses the saved price (never the client-supplied one) when stamping a new order.
- **Analytics tab**: Shows **Total Page Views**, **Unique Visitors**, **Views Today**, and a 7-day bar chart. Backed by `analytics.json`. Visitors are identified by an HttpOnly `kurdhs_vid` cookie (UUID, 1-year lifetime); the unique-visitor list is capped at 50,000 entries (FIFO). Tracking is fired from `index.html` and `track.html` via `POST /api/analytics/track` — the admin panel itself is **not counted** in traffic. Dates are UTC.

## Live Storefront Sync
The storefront is fully driven by the admin's inventory. Tiers with **0 keys in stock are hidden**; tiers gain visibility automatically as soon as the admin adds keys. If all tiers are empty, an "No products are available" empty state is shown.

This is implemented over a single public SSE channel `/api/products/stream`:
- On connect, the server pushes a snapshot `{type:'connected', stock, products}` so the page renders correctly with no extra HTTP round-trips.
- On every admin action that mutates inventory (add keys, remove keys, deliver order) the server calls `broadcastStock()` which fans out `{type:'stock-updated', stock}` to all connected clients.
- On image change in the Products tab, the server fans out `{type:'products-updated', products}`.
- The channel is capped at 200 simultaneous clients (returns 503 above the cap) and per-client heartbeats every 25s keep proxies from dropping the connection.

## Environment Variables / Secrets
| Variable | Usage |
|----------|-------|
| `ADMIN_PASSWORD` | Password to log into the /admin panel |
| `SMTP_HOST` | SMTP server for email delivery |
| `SMTP_PORT` | SMTP port, default 587 |
| `SMTP_USER` | SMTP username/email |
| `SMTP_PASS` | SMTP password / app password |

## Key Inventory
Stored in `backend/keys.json`. Tiers: `one_day`, `seven_day`, `thirty_day`. Each is an array of key strings.

## Order Flow
1. Customer submits FIB transaction ID on the main site → saved to `orders.json` as "pending"
2. Admin logs into `/admin`, verifies the payment on FIB app, clicks "Confirm & Deliver Key"
3. A key is pulled from inventory, marked delivered, and emailed to the customer

## Deployment
- **Type**: Autoscale
- **Run**: `node backend/server.js`
