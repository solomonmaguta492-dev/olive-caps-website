# Olive Caps: guide for Claude Code

Olive Caps is an online store for caps in Kenya (baseball caps, trucker hats, snapbacks, beanies, bucket hats).
Customers shop on the site and pay with M-Pesa, or order on WhatsApp. It serves individual buyers and resellers (wholesale).

The owner is a student at Moringa School who knows HTML, CSS, JavaScript and Git and uses VS Code.
When helping, explain the "why" in plain words, suggest small steps they can do themselves, and point to the exact file and line.

## Stack

- `frontend/`: plain HTML, CSS and JavaScript ES modules. No framework, no build step.
- `backend/`: Node.js + Express. It serves the API under `/api` and the `frontend/` folder.
- Database: `backend/db.js` reads and writes a JSON file (`backend/data/db.json`, created from `data/seed.json`).
- Payments: Safaricom Daraja STK push in `backend/services/mpesa.js`. `MPESA_MODE=mock` fakes a successful payment.

## Commands

Run from the project root:

- `npm run setup`: install backend packages
- `npm run dev`: start on http://localhost:3000 with auto-restart
- `npm test`: run the backend tests (Node's built-in test runner)

## Rules to keep

- Prices, delivery fees and totals are worked out on the server (`backend/utils/pricing.js`). Never trust amounts from the browser.
- An order becomes paid only from the M-Pesa callback (`backend/services/orders.js`). Repeated callbacks must not reduce stock twice.
- Escape any text before putting it in `innerHTML` (use `escapeHtml` from `frontend/js/ui.js`).
- Secrets live in `backend/.env`, which is never committed.
- Phone-first design: check every change at about 400px wide.
- Code comments: few and short, each on its own line above the code, never at the end of a line of code.
- Commit in small steps with clear messages, one change per commit.

## Known gaps to improve next

When asked "what can be improved", start from this list, then look at the code for more:

1. **Database**: the JSON file resets on free hosting. Move to MongoDB Atlas or PostgreSQL.
2. **Notifications**: `backend/services/notify.js` only logs. Add email (Nodemailer) or SMS (Africa's Talking) for the owner and customer.
3. **Admin security**: a single shared password in a header. Add proper login with sessions or JWT, and rate-limit attempts.
4. **Callback security**: add a secret token to `MPESA_CALLBACK_URL` and check it, and/or confirm payments with Daraja's STK query API.
5. **Stock per colour and size**: stock is per product, not per colour or size (New Era fitted caps have sizes 6 7/8 to 7 3/4).
6. **Product images**: illustrations are placeholders. Add real photos (WebP) and image upload in the admin.
7. **Product page**: a page per cap with several photos and a size guide.
8. **Pending payments**: reserve stock while a payment is pending, and expire unpaid orders.
9. **Frontend tests**: only the backend is tested. Add tests for `cart.js` and the checkout.
10. **Accessibility and SEO**: run Lighthouse in Chrome DevTools and fix what it reports.
