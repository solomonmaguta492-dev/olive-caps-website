# Olive Caps API

Base URL: the backend address, e.g. `http://localhost:3000`. All bodies are JSON.

## Public

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/health` | Server status and M-Pesa mode |
| GET | `/api/settings` | Shop contacts, categories, delivery zones, pickup points, wholesale rule |
| GET | `/api/products` | Active products. Optional `?category=` and `?search=` |
| GET | `/api/products/:id` | One product |
| POST | `/api/orders` | Create an unpaid order |
| GET | `/api/orders/:orderNumber` | Order status (personal details hidden) |
| POST | `/api/mpesa/stkpush` | Send the M-Pesa PIN prompt for an order |
| POST | `/api/mpesa/callback` | Called by Safaricom with the payment result |

### Create order body

```json
{
  "customer": { "name": "Jane Wanjiku", "phone": "0712345678", "email": "" },
  "items": [{ "productId": "p001", "colour": "Olive", "quantity": 2 }],
  "fulfilment": {
    "method": "delivery",
    "zoneId": "nairobi-estates",
    "county": "Nairobi",
    "town": "Kilimani",
    "address": "Argwings Kodhek Rd, Green House"
  },
  "notes": ""
}
```

For pickup: `"fulfilment": { "method": "pickup", "pickupPointId": "cbd-moi-avenue" }`.

Prices, delivery fee and total are always worked out on the server.

### Order and payment statuses

- Order: `awaiting_payment`, `processing`, `ready_for_pickup`, `dispatched`, `completed`, `cancelled`
- Payment: `unpaid`, `pending` (prompt sent), `paid`, `failed`, `underpaid`

## Admin

Send the header `x-admin-password: <ADMIN_PASSWORD>`.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/admin/orders` | All orders with customer and payment details |
| PATCH | `/api/admin/orders/:orderNumber` | Change status: `{ "status": "dispatched" }` |
| GET | `/api/admin/products` | All products |
| POST | `/api/admin/products` | Add a product |
| PUT | `/api/admin/products/:id` | Replace a product |
| PATCH | `/api/admin/products/:id/stock` | Set stock: `{ "stock": 20 }` |
| DELETE | `/api/admin/products/:id` | Delete a product |
