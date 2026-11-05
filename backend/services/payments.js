import { mpesaMode } from "./mpesa.js";

/*
  Which ways to pay the shop offers right now:
  - sendMoney: customer sends money to the shop's M-Pesa number and enters the code.
  - stk: automatic M-Pesa prompt (needs a Till/Paybill and Daraja keys).
  Mock (test) prompts are never offered on a live site, so nobody gets caps for free.
*/
export function paymentMethods(settings) {
  const methods = [];
  if (settings.sendMoney?.number) methods.push("sendMoney");

  const mode = mpesaMode();
  const live = process.env.NODE_ENV === "production";
  const keysSet = Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_PASSKEY);
  if ((mode === "mock" && !live) || (mode !== "mock" && keysSet)) methods.push("stk");

  return methods;
}

// M-Pesa confirmation codes are 10 letters and numbers, e.g. SKL3X2ABCD.
export function normaliseMpesaCode(input) {
  const code = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{10}$/.test(code) && /[A-Z]/.test(code) ? code : null;
}
