#!/usr/bin/env node
/**
 * simulate-c2b-payment.js
 *
 * Fires Safaricom's sandbox C2B "simulate" endpoint, which makes Safaricom
 * call OUR registered Confirmation URL for real — the same end-to-end path
 * a genuine Till Number payment takes. Useful for proving the Till Number
 * feature actually works without a real production Till number yet.
 *
 * Prerequisites:
 *   - The backend must be running and reachable at its MPESA_CALLBACK_URL
 *     (e.g. via ngrok — see scripts/update-ngrok-url.js).
 *   - The C2B URLs must already be registered with Safaricom for this run:
 *     POST /api/v1/payments/mpesa/c2b/register-urls (ADMIN JWT required).
 *   - Real (non-"placeholder") MPESA_CONSUMER_KEY/MPESA_CONSUMER_SECRET from
 *     a Safaricom Daraja sandbox app — the values currently in .env are
 *     literal placeholders and will fail OAuth until replaced.
 *
 * Usage:
 *   node scripts/simulate-c2b-payment.js [amount] [phone] [billRef]
 *   node scripts/simulate-c2b-payment.js 500 254708374149 INV-001
 */

'use strict';

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke';
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || '';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const SHORT_CODE = process.env.MPESA_TILL_NUMBER || process.env.MPESA_SHORTCODE || '';

const [amountArg, phoneArg, billRefArg] = process.argv.slice(2);
const amount = amountArg || '500';
const phone = phoneArg || '254708374149';
const billRef = billRefArg || 'TEST-PAYMENT';

async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const res = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return res.data.access_token;
}

(async () => {
  console.log('=== M-Pesa C2B sandbox simulator ===');
  console.log(`ShortCode : ${SHORT_CODE}`);
  console.log(`Amount    : ${amount}`);
  console.log(`Phone     : ${phone}`);
  console.log(`BillRef   : ${billRef}\n`);

  if (!CONSUMER_KEY || !CONSUMER_SECRET || CONSUMER_KEY.includes('placeholder')) {
    console.error(
      'MPESA_CONSUMER_KEY/MPESA_CONSUMER_SECRET are not set to real sandbox app credentials ' +
        '(get a free app at https://developer.safaricom.co.ke). Aborting.',
    );
    process.exit(1);
  }

  try {
    const token = await getAccessToken();

    const res = await axios.post(
      `${BASE_URL}/mpesa/c2b/v1/simulate`,
      {
        ShortCode: SHORT_CODE,
        CommandID: 'CustomerPayBillOnline',
        Amount: amount,
        Msisdn: phone,
        BillRefNumber: billRef,
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    console.log('Simulate response:', res.data);
    console.log('\nIf registration succeeded earlier, this should land as a new');
    console.log('row in GET /api/v1/sales/invoices/mpesa/till/pending within a few seconds.');
  } catch (err) {
    console.error('\nError:', err.response?.data || err.message);
    process.exit(1);
  }
})();
