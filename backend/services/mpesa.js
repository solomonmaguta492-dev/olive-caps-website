/*
  Safaricom Daraja API: M-Pesa Express (STK push).
  Docs: https://developer.safaricom.co.ke
*/

const BASE_URLS = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

export function mpesaMode() {
  return process.env.MPESA_MODE || "mock";
}

// Daraja wants the time in Kenya as YYYYMMDDHHmmss.
export function darajaTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
}

async function getAccessToken(baseUrl) {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET } = process.env;
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    throw new Error("M-Pesa keys are missing in .env");
  }
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`M-Pesa login failed (${res.status})`);
  const data = await res.json();
  return data.access_token;
}

/*
  Asks Daraja whether an STK push was paid. This confirms payments
  even when Safaricom can't reach our callback URL (e.g. on localhost).
*/
export async function queryStkStatus(checkoutRequestId) {
  const mode = mpesaMode();
  const baseUrl = BASE_URLS[mode];
  if (!baseUrl) return null;

  const { MPESA_SHORTCODE, MPESA_PASSKEY } = process.env;
  const token = await getAccessToken(baseUrl);
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");

  const res = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return parseQueryResult(data);
}

// While the customer hasn't answered yet, Daraja returns an error with no ResultCode.
export function parseQueryResult(data) {
  if (data?.ResultCode === undefined || data?.ResultCode === null) return { done: false };
  const code = Number(data.ResultCode);
  return { done: true, success: code === 0, resultCode: code, resultDesc: data.ResultDesc };
}

/*
  Sends the PIN prompt to the customer's phone.
  Returns the CheckoutRequestID that the callback will refer to.
*/
export async function sendStkPush({ phone, amount, orderNumber }) {
  const mode = mpesaMode();

  if (mode === "mock") {
    return {
      checkoutRequestId: `ws_CO_MOCK_${Date.now()}`,
      customerMessage: "Mock payment started. It will succeed in a few seconds.",
    };
  }

  const baseUrl = BASE_URLS[mode];
  if (!baseUrl) throw new Error(`Unknown MPESA_MODE "${mode}"`);

  const { MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL } = process.env;
  if (!MPESA_SHORTCODE || !MPESA_PASSKEY || !MPESA_CALLBACK_URL) {
    throw new Error("M-Pesa shortcode, passkey or callback URL is missing in .env");
  }

  const token = await getAccessToken(baseUrl);
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");

  const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount),
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: orderNumber.slice(-12),
      TransactionDesc: `Olive Caps ${orderNumber}`.slice(0, 13),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(data.errorMessage || data.ResponseDescription || "Could not start M-Pesa payment");
  }
  return { checkoutRequestId: data.CheckoutRequestID, customerMessage: data.CustomerMessage };
}

// Turns Safaricom's callback body into a simple object.
export function parseCallback(body) {
  const cb = body?.Body?.stkCallback;
  if (!cb) return null;

  const meta = {};
  for (const item of cb.CallbackMetadata?.Item || []) {
    meta[item.Name] = item.Value;
  }

  return {
    checkoutRequestId: cb.CheckoutRequestID,
    success: Number(cb.ResultCode) === 0,
    resultCode: Number(cb.ResultCode),
    resultDesc: cb.ResultDesc,
    amount: meta.Amount,
    receipt: meta.MpesaReceiptNumber,
    phone: meta.PhoneNumber ? String(meta.PhoneNumber) : undefined,
    transactionDate: meta.TransactionDate ? String(meta.TransactionDate) : undefined,
  };
}

// Builds a fake successful callback, used in mock mode and in tests.
export function mockCallback(checkoutRequestId, amount, phone) {
  return {
    Body: {
      stkCallback: {
        CheckoutRequestID: checkoutRequestId,
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: amount },
            { Name: "MpesaReceiptNumber", Value: "MOCK" + Math.random().toString(36).slice(2, 8).toUpperCase() },
            { Name: "TransactionDate", Value: Number(darajaTimestamp()) },
            { Name: "PhoneNumber", Value: Number(phone) },
          ],
        },
      },
    },
  };
}
