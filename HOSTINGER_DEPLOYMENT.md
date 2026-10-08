# Hostinger Production Deployment Guide
## Humantek Creator Credit Studio (Next.js 16 + Supabase + PayPal)

This document provides a step-by-step production deployment manual tailored specifically for **Hostinger**.

---

### Architectural Overview

```
                      +---------------------------------------+
                      |         Client Browser                |
                      +-------------------+-------------------+
                                          |
                   HTTPS (Pages / APIs)   |   WebSockets (Private Doorbell Chat)
                                          |
                                          v
+-----------------------------------+   +------------------------------------+
|  Hostinger (Node.js 20/22)        |   |  Supabase Cloud (AWS Frankfurt)    |
|  - Next.js 16 SSR & Server Actions|   |  - PostgreSQL Database & RLS       |
|  - PayPal SDK & Webhooks          |   |  - Supabase Auth (SSR Cookies)     |
|  - Production server.js runner    |   |  - Supabase Realtime Channels      |
+-----------------------------------+   |  - Supabase Storage (Brief Assets) |
                                        +------------------------------------+
```

> [!NOTE]
> **Why Hostinger fits seamlessly:** Hostinger does not need to manage WebSockets or persistent socket proxies. Client browsers connect directly to Supabase Realtime over secure WebSockets for chat and instant notifications, while Hostinger handles standard HTTPS page delivery and REST API execution.

---

### Prerequisites & Credentials

Before deploying, ensure you have the following credentials ready from your services:

| Service | Setting | Description |
| :--- | :--- | :--- |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL` | Your project endpoint (e.g. `https://enkqvxdbjahimbtrgwfj.supabase.co`) |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client API key |
| **Supabase** | `SUPABASE_SERVICE_ROLE_KEY` | Secret service-role key (used for server transactions) |
| **Hostinger** | `NEXT_PUBLIC_SITE_URL` | Canonical domain (e.g. `https://studio.humantek.art`) |
| **Admin** | `ADMIN_EMAILS` | Comma-separated admin emails (e.g. `huzaifafurqan22@gmail.com`) |
| **PayPal** | `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Live PayPal REST Client ID |
| **PayPal** | `PAYPAL_CLIENT_SECRET` | Live PayPal REST Secret |
| **PayPal** | `PAYPAL_API_URL` | Set to `https://api-m.paypal.com` for production |
| **PayPal** | `PAYPAL_WEBHOOK_ID` | Webhook ID created in PayPal Developer Dashboard |

---

### Deployment Path A: Hostinger Cloud / Business Hosting (hPanel Node.js Selector)

If you are using Hostinger Cloud Startup / Professional / Enterprise or Business Web Hosting with the **Node.js Application Manager** in hPanel:

#### 1. Configure Node.js Application in hPanel
1. Log in to **Hostinger hPanel**.
2. Navigate to **Websites** -> Select your domain -> Go to **Advanced** -> **Node.js**.
3. Click **Create Application** and configure:
   - **Node.js version:** `20.x` or `22.x LTS` (Recommended).
   - **Application mode:** `Production`.
   - **Application root:** `domains/yourdomain.com/app` (or a dedicated folder outside `public_html`).
   - **Application URL:** Select your target domain or subdomain.
   - **Application startup file:** `server.js`.
4. Click **Create**.

#### 2. Deploy Project Files
You can transfer files via **Git** (recommended) or Hostinger File Manager:
- **Via Git / SSH:**
  ```bash
  cd domains/yourdomain.com/app
  git clone https://github.com/huzaifa321s/humantek-creator-credit-studio.git .
  ```
- *Ensure `.env.local` and `node_modules` are NOT committed or copied directly.*

#### 3. Set Environment Variables
In **hPanel** -> **Node.js** -> **Environment variables**:
Add each key from your `.env.example`:
- `NODE_ENV=production`
- `PORT=3000`
- `NEXT_PUBLIC_SITE_URL=https://yourdomain.com`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `ADMIN_EMAILS=huzaifafurqan22@gmail.com`
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID=...`
- `PAYPAL_CLIENT_SECRET=...`
- `PAYPAL_API_URL=https://api-m.paypal.com`
- `PAYPAL_WEBHOOK_ID=...`

#### 4. Install Dependencies & Build
Open the SSH Terminal in hPanel and run:
```bash
cd domains/yourdomain.com/app
npm install --production=false
npm run build
```

#### 5. Start the Application
Back in hPanel Node.js Manager, click **Restart Application**. Verify status says **Running**.

---

### Deployment Path B: Hostinger VPS (Ubuntu / Debian with PM2 + Nginx)

If you are using a Hostinger VPS plan:

#### 1. Connect to VPS via SSH & Install Node 20 LTS
```bash
ssh root@your-vps-ip

# Install Node.js 20 LTS & PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git
sudo npm install -g pm2
```

#### 2. Clone Repository & Setup
```bash
mkdir -p /var/www/humantek-studio
cd /var/www/humantek-studio
git clone https://github.com/huzaifa321s/humantek-creator-credit-studio.git .

# Copy environment variables
cp .env.example .env.production
nano .env.production # Fill in your live secrets
```

#### 3. Build Application
```bash
npm ci
npm run build
```

#### 4. Launch with PM2 Process Manager
```bash
# Start production server using server.js
pm2 start server.js --name "humantek-studio" --env .env.production

# Configure PM2 to start on system boot
pm2 startup
pm2 save
```

#### 5. Configure Nginx Reverse Proxy
Edit `/etc/nginx/sites-available/humantek-studio`:
```nginx
server {
    server_name studio.humantek.art;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/humantek-studio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. Issue Free SSL Certificate (Certbot)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d studio.humantek.art
```

---

### Post-Deployment Verification Checklist

1. **Supabase Authentication Redirects**:
   - In Supabase Dashboard -> **Authentication** -> **URL Configuration**:
   - Set **Site URL** to `https://yourdomain.com`.
   - Add `https://yourdomain.com/**` to **Redirect URLs**.

2. **Supabase Realtime Connection**:
   - Open browser developer tools on `https://yourdomain.com/messages`.
   - Check the console for clean Realtime subscription (`status="SUBSCRIBED"`, zero unauthorized errors).

3. **PayPal Webhook Registration**:
   - In PayPal Developer Dashboard -> **Webhooks**:
   - Add endpoint URL: `https://yourdomain.com/api/paypal/webhook`.
   - Subscribe to events:
     - `PAYMENT.CAPTURE.COMPLETED`
     - `PAYMENT.CAPTURE.REFUNDED`
     - `PAYMENT.CAPTURE.REVERSED`
     - `CUSTOMER.DISPUTE.CREATED`
   - Copy the Webhook ID into `PAYPAL_WEBHOOK_ID`.

4. **Zero-Downtime Updates Protocol**:
   Whenever you push updates to GitHub, redeploy on Hostinger with:
   ```bash
   git pull origin master
   npm install
   npm run build
   pm2 reload humantek-studio   # Or restart via hPanel
   ```
