# Setting up M-Pesa payments

The site uses **M-Pesa Express (STK push)** from Safaricom's Daraja API. The customer gets a PIN prompt on their phone, and Safaricom tells our server whether they paid.

## How a payment works

1. The customer places an order. It is saved as `awaiting_payment`.
2. They tap **Send M-Pesa prompt**. The server calls Daraja's STK push with the order total.
3. The customer enters their PIN.
4. Safaricom sends the result to `MPESA_CALLBACK_URL`.
5. The server checks the amount, marks the order **paid**, saves the M-Pesa receipt number and reduces stock.
6. The order page, which checks every few seconds, shows "Payment received".

## 1. Test without Safaricom (mock mode)

`MPESA_MODE=mock` in `backend/.env`. Every payment succeeds after 4 seconds with a fake receipt starting with `MOCK`.

## 2. Sandbox

1. Sign up at https://developer.safaricom.co.ke and create an app with **M-Pesa Express**.
2. In `backend/.env`:
   ```
   MPESA_MODE=sandbox
   MPESA_CONSUMER_KEY=your key
   MPESA_CONSUMER_SECRET=your secret
   MPESA_SHORTCODE=174379
   MPESA_PASSKEY=the sandbox passkey shown in the Daraja simulator
   MPESA_CALLBACK_URL=https://<public-address>/api/mpesa/callback
   ```
3. The callback must be reachable from the internet over HTTPS:
   - Locally: run `ngrok http 3000` and use the https address it gives you.
   - Deployed: use your Render/Railway address.

## 3. Going live

1. In the Daraja portal, use **Go Live** with your Paybill or Till number.
2. Safaricom emails the production passkey.
3. Set `MPESA_MODE=production` and replace the keys, shortcode and passkey.
4. Do one real payment of a small amount to confirm everything.

> **Till (Buy Goods):** put the store number Safaricom gives you in `MPESA_SHORTCODE` and your Till number in `MPESA_TILL_NUMBER`. The site then sends Buy Goods prompts automatically. Leave `MPESA_TILL_NUMBER` empty for a Paybill.

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| "We couldn't reach M-Pesa" | Wrong keys, wrong mode, or Daraja is down. Check the server log. |
| Prompt arrives but order stays pending | The callback URL isn't public HTTPS, or points to the wrong address. |
| Order shows `underpaid` | Amount received was lower than the order total. Contact the customer. |
| Result code 1032 | The customer cancelled the prompt. They can try again. |
| Result code 1037 | Phone was unreachable. Ask them to unlock their phone and retry. |

## Keep it safe

- Never commit `.env`. It is in `.gitignore`.
- Orders are only marked paid from Safaricom's callback, never from the browser.
- Repeated callbacks for the same payment are ignored, so stock is never reduced twice.
