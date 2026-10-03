# Humantek Creator Credit Studio — Setup & Architecture Guide

A full-stack Next.js application built with **Supabase (PostgreSQL)**, **Tailwind CSS**, and **PayPal Checkout** for digital creative agencies.

---

## 🚀 Quick Start

### 1. Install & Run Locally
```bash
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🗄️ Supabase Database Setup (Free Tier)

This project uses PostgreSQL via Supabase for full ACID transactions, wallet credit ledgers, and secure client orders.

1. Create a free account at [supabase.com](https://supabase.com).
2. Create a new project (e.g., `humantek-studio`).
3. In the Supabase Dashboard, click on **SQL Editor** in the left sidebar.
4. Copy and paste the contents of [`supabase/schema.sql`](file:///e:/Huzaifa%20Furqan(morning)/Projects/Humantek%20Creator%20Credit%20Studio/supabase/schema.sql) and click **Run**.
   * Creates the `profiles`, `wallets`, `credit_ledger`, `projects`, `project_items`, `project_uploads`, and `redeem_codes` tables.
   * Enables Row-Level Security (RLS) policies.
5. In **Project Settings** > **API**, copy your `Project URL` and `anon public key`.
6. Update your `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

---

## 💳 PayPal Checkout Configuration

The application includes `@paypal/react-paypal-js` and server-side capture endpoints.

1. Go to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Under **Apps & Credentials**, select **Sandbox**.
3. Copy your `Client ID` and `Secret Key`.
4. In `.env.local`:
   ```env
   NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id
   PAYPAL_CLIENT_SECRET=your_paypal_secret
   PAYPAL_API_URL=https://api-m.sandbox.paypal.com
   ```
> **Note:** The checkout step also features an instant **"⚡ Test Checkout in Sandbox Mode"** button for immediate testing of the credit ledger and project creation.

---

## 📁 Key Routes & Pages

| Route | Purpose |
| :--- | :--- |
| **`/`** | The complete 5-step interactive Creator Credit Studio (Package selection, live asset configurator, policy check, creative brief, and review/checkout). |
| **`/projects`** | Client project portal with a 6-stage milestone tracker (`Request Received` ➔ `Payment Confirmed` ➔ `Brief Approved` ➔ `In Production` ➔ `Review Round` ➔ `Delivered`). |
| **`/redeem-code`** | Dedicated voucher creation tool with credit amount controls and live preview card. |
| **`/management`** | Agency management console with revenue & credit KPI cards, status changers, project pipeline, and audited transaction ledger. |
| **`/login`** | Supabase authentication page (Sign In / Sign Up). |

---

## ⚙️ Key Backend Endpoints

* **`POST /api/paypal/create-order`**: Initiates a PayPal order with the exact package price.
* **`POST /api/paypal/capture-order`**: Captures payment, confirms transaction, adds package credits to the user wallet, deducts used credits, and logs the project.
* **`POST /api/projects`**: Submits a creative brief for scope review without instant payment.
* **`PATCH /api/projects`**: Updates production and payment status from the management console.
* **`POST /api/uploads`**: Handles reference image uploads.
