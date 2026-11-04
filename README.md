# Olive Caps Website

An online store for **Olive Caps**, selling baseball caps, trucker hats, snapbacks, beanies and bucket hats in Kenya.
Customers can shop on the website and pay with **M-Pesa**, or order directly on **WhatsApp**.

## Features

- Product catalogue with categories, search, prices, descriptions, colours and stock availability
- Cart that survives a page refresh (localStorage)
- Checkout that collects customer, order and delivery/pickup details
- Delivery fees by zone, or free pickup at a pickup point
- Wholesale pricing for resellers (lower price per cap above a minimum quantity)
- M-Pesa STK push payments through Safaricom's **Daraja API**, with a mock mode for testing
- Order confirmation page that waits for the payment result
- Admin dashboard: orders (order number, amount paid, payment status, M-Pesa reference, customer details), order status updates, product and stock management
- Mobile-first design and a WhatsApp button on every page

## Project structure

```
olive-caps-website/
├── frontend/              Static website (HTML, CSS, JavaScript modules)
│   ├── index.html         Shop page
│   ├── cart.html          Cart and checkout
│   ├── order.html         Order summary and M-Pesa payment
│   ├── how-to-order.html  Ordering, payments, delivery, contact
│   ├── admin.html         Admin dashboard
│   ├── css/style.css
│   ├── js/                api, cart, ui, shop, checkout, order, admin
│   └── images/            Product images
└── backend/               Node.js + Express API
    ├── server.js
    ├── db.js              JSON file database
    ├── data/seed.json     Starting products and shop settings
    ├── routes/            products, orders, mpesa, admin, settings
    ├── services/          mpesa (Daraja), notify
    ├── middleware/        adminAuth
    ├── utils/pricing.js   Totals, delivery fees, wholesale prices
    └── tests/             Node test runner tests
```

## Getting started

Requirements: [Node.js](https://nodejs.org) 18 or newer.

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. The backend also serves the website from `frontend/`.

With `MPESA_MODE=mock` (the default in `.env.example`), payments succeed automatically after a few seconds, so you can test the whole flow without Safaricom credentials.

Admin dashboard: http://localhost:3000/admin.html, password = `ADMIN_PASSWORD` in `.env`.

Run the tests:

```bash
cd backend
npm test
```

## Setting up M-Pesa (Daraja)

1. Create an account at [developer.safaricom.co.ke](https://developer.safaricom.co.ke) and create an app with **M-Pesa Express (STK Push)**.
2. Copy the Consumer Key, Consumer Secret, Shortcode and Passkey into `.env`.
3. Set `MPESA_MODE=sandbox` and test with the sandbox shortcode `174379`.
4. `MPESA_CALLBACK_URL` must be a public **HTTPS** URL ending in `/api/mpesa/callback`. Locally, use a tunnel such as ngrok; in production, use your deployed backend URL.
5. When ready, apply for production (Go Live) and set `MPESA_MODE=production` with your live credentials.

An order is marked **paid only when Safaricom's callback confirms it**, and stock is reduced at that point.

## Things to edit before launch

- `backend/data/seed.json`: your real products, prices, stock, delivery zones, pickup points, WhatsApp number and wholesale rules. Fees and numbers in the file are placeholders.
- `frontend/images/`: replace the illustrations with real product photos (WebP, around 800px wide).
- `.env`: a strong `ADMIN_PASSWORD` and your Daraja credentials.

## Deployment

The backend serves the frontend, so one deploy is enough. [Render](https://render.com) or [Railway](https://railway.app):

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Add the variables from `.env.example` in the dashboard

The JSON file database is fine for starting out. As orders grow, move to MongoDB or PostgreSQL by replacing `db.js`.

## Roadmap

- [x] Catalogue, cart, WhatsApp ordering
- [x] Checkout and orders
- [x] M-Pesa STK push
- [x] Admin dashboard
- [ ] Email/SMS notifications (hook ready in `services/notify.js`)
- [ ] Customer accounts and order history
- [ ] Image uploads from the admin dashboard

## License

MIT
