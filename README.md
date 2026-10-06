# Humantek Creator Credit Studio

A modern creative agency studio application built with **Next.js (App Router)**, **Tailwind CSS**, and **Supabase (PostgreSQL)** for bespoke digital creator assets, credit-based scope allocation, and interactive milestone tracking.

---

## 🎨 Studio Architecture & Core Flow

### Client Acquisition & Project Wizard (`/`)
The primary studio workflow guides creators through an intuitive structured pipeline:

1. **Step 1: Choose a Package**
   - **Creator Forge** ($1,500 · 660 CR): Essential creator kit for single-channel launch.
   - **Studio Momentum** ($2,500 · 1,160 CR · Most Popular): Scaled package with +160 bonus credits, priority queue, and multi-tier access.
   - **Signature Collective** ($4,000 · 1,920 CR): Comprehensive studio rollout with +320 volume bonus credits, VIP turnaround, and dedicated Lead Producer.
   - *Unit rule*: 1 CR ≈ 1 basic creative asset task.

2. **Step 2: Service Selection & Scope Allocation**
   - Interactive service catalog across 8 categories (Branding, Overlays, Emotes, VTubers, 3D Assets, Alerts, Motion, Sound).
   - Real-time credit calculator with live wallet ledger validation.

3. **Step 3: Studio Policies & Scope Coverage**
   - Transparent delivery terms, turnaround benchmarks, revision policies, and rollover guarantees (unused credits valid for 12 months).

4. **Step 4: Creative Brief & Reference Assets**
   - Channel brand identity, preferred art style, color hex codes, streaming platform, and direct file upload dropzone.

5. **Step 5: Review & Checkout**
   - Line-by-line itemized statement, PayPal checkout integration, and instant Sandbox order testing.

*(Note: In fast-track mode, steps 2 & 3 can be viewed concurrently, and steps 4 & 5 combined for a 3-stage condensed flow).*

---

## 📂 Key Pages & Features

| Route | View | Description |
| :--- | :--- | :--- |
| **`/`** | Creator Studio Wizard | 5-step interactive creative asset configurator and order checkout. |
| **`/projects`** | Client Project Tracker | Live milestone pipeline (`Request Received` ➔ `Payment Confirmed` ➔ `Brief Approved` ➔ `In Production` ➔ `Review Round` ➔ `Delivered`), reconciled credit accounting, and direct project chat. |
| **`/management`** | Agency Console | Internal operations dashboard with studio revenue KPIs, active production queues, and audited credit ledgers. |
| **`/redeem-code`** | Voucher Tool | Creator promo code generator and credit balance top-up simulator. |

---

## 🛠️ Design System & Consistency Principles

- **Typography Hierarchy**: Page titles standardized to ~32px (`text-[32px]`), project cards to 22–24px, body text to 15px, and all secondary metadata (dates, IDs, statuses, tags) to a minimum of 12px (`text-xs`).
- **Color Discipline**: Deep onyx dark-mode headers with restrained warm amber accent reserved for brand identity and primary call-to-actions; neutral/slate tones for metadata and eyebrows to avoid color fatigue.
- **Credit Reconciliation**: Strict zero-discrepancy math across wallets, allocations, and asset itemizations ($660\text{ CR package} - 580\text{ CR assets} = 80\text{ CR remaining}$).
- **Global Studio Concierge**: Context-aware floating chat widget that provides instant support during ordering and dedicated project threads (`HT-9428-FORGE`) during active production.

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the studio.
