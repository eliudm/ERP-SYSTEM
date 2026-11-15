# Payment Providers Setup Guide

## 1. M-Pesa (Safaricom Daraja)

### Get Sandbox Credentials
1. Go to https://developer.safaricom.co.ke and create an account
2. Create an app under **Sandbox** → get **Consumer Key** and **Consumer Secret**
3. Use the sandbox shortcode **174379** and passkey from the portal

### Expose Your Local Server (for sandbox callbacks)
```bash
# Install ngrok: https://ngrok.com
ngrok http 3000
# Copy the https URL e.g. https://abc123.ngrok-free.app
```

### Update `.env`
```env
MPESA_BASE_URL=https://sandbox.safaricom.co.ke
MPESA_CONSUMER_KEY=<your_consumer_key>
MPESA_CONSUMER_SECRET=<your_consumer_secret>
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
BACKEND_URL=https://abc123.ngrok-free.app   # your ngrok URL
```

### Production
- Register a PayBill or Till Number with Safaricom
- Change `MPESA_BASE_URL` to `https://api.safaricom.co.ke`
- Use your production shortcode, passkey, and `BACKEND_URL` = your server's public URL

---

## 2. Stripe (Card Payments)

### Get Test Credentials
1. Go to https://dashboard.stripe.com and sign up
2. In **Developers → API keys**, copy the **Secret key** (`sk_test_...`)

### Set Up Webhook (for automatic activation)
```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/v1/billing/stripe/webhook
# Copy the webhook signing secret shown: whsec_...
```

### Update `.env`
```env
STRIPE_SECRET_KEY=sk_test_<your_secret_key>
STRIPE_WEBHOOK_SECRET=whsec_<from_stripe_listen>
APP_URL=http://localhost:5173    # frontend URL (for redirect after checkout)
```

### Test Cards
| Card Number         | Result    |
|---------------------|-----------|
| 4242 4242 4242 4242 | Success   |
| 4000 0000 0000 0002 | Declined  |
| 4000 0025 0000 3155 | 3D Secure |

Use any future expiry, any 3-digit CVV, any ZIP.

### Production
- Activate your Stripe account for live payments
- Replace `sk_test_` with `sk_live_` key
- Register webhook at dashboard.stripe.com/webhooks pointing to `https://your-server.com/api/v1/billing/stripe/webhook`
- Update `STRIPE_WEBHOOK_SECRET` with the live webhook secret

---

## 3. PayPal

### Get Sandbox Credentials
1. Go to https://developer.paypal.com and log in
2. Under **Apps & Credentials** → **Sandbox**, create an app
3. Copy the **Client ID** and **Secret**

### Update `.env`
```env
PAYPAL_CLIENT_ID=<your_sandbox_client_id>
PAYPAL_CLIENT_SECRET=<your_sandbox_client_secret>
PAYPAL_ENV=sandbox
```

### Update Frontend `.env`
```env
VITE_PAYPAL_CLIENT_ID=<your_sandbox_client_id>
```

### Set Up Webhook (optional — for server-side confirmation)
1. In PayPal Developer Dashboard → **Webhooks**
2. Add webhook URL: `https://your-ngrok-url.ngrok-free.app/api/v1/billing/paypal/webhook`
3. Subscribe to event: `PAYMENT.CAPTURE.COMPLETED`
4. Copy the **Webhook ID** to `.env`:
```env
PAYPAL_WEBHOOK_ID=<your_webhook_id>
```

### Test Accounts
In the PayPal sandbox, use the auto-generated buyer account credentials from
developer.paypal.com → Sandbox → Accounts.

### USD Prices
PayPal processes in USD. The app uses these fixed USD prices:
| Plan         | Monthly | Annual |
|--------------|---------|--------|
| Starter      | $19     | $190   |
| Professional | $57     | $570   |
| Enterprise   | $190    | $1,900 |

### Production
- Change `PAYPAL_ENV=production`
- Replace sandbox credentials with live credentials

---

## Quick Test Flow

### M-Pesa (sandbox)
1. Click "Pay & Upgrade" on a plan
2. M-Pesa tab: enter **254708374149** (Safaricom test number)
3. The STK push goes to sandbox (no real phone needed)
4. The sandbox auto-completes after a few seconds
5. Backend callback activates the subscription

### Stripe (test)
1. Click "Pay & Upgrade" → Card tab → "Pay with Card"
2. You're redirected to Stripe Checkout
3. Enter card **4242 4242 4242 4242**, any expiry/CVV
4. Stripe redirects back with `?stripe_session=...&status=success`
5. App verifies the session and activates the subscription

### PayPal (sandbox)
1. Click "Pay & Upgrade" → PayPal tab
2. Click the PayPal button
3. Log in with your sandbox buyer account
4. Approve the payment
5. App captures the payment and activates the subscription
