# Ronia Logistics

Package tracking, staff dashboard, merchant portal and income/expense records for **Ronia Logistics, Abuja**.
Built by Emadex Creations on TanStack Start + Cloudflare Workers, D1 and R2 (same stack as Emawealth Store).

## Build phases

| Phase | What's in it | Status |
|---|---|---|
| 1 | Public site, package tracking page, staff login, first-admin setup, dashboard, shipments (create, status updates, timeline, who-handled-what), printable receipt & label, staff management | ✅ done |
| 2 | Merchant portal: merchants, products/stock in warehouse, stock in/out/sold, merchant's own dashboard, deliveries & printable statements | ✅ done |
| 3 | Income & expenses (who handled it, monthly totals, breakdowns, printable report), merchant payouts & balances, Paystack online payment on the tracking page | ✅ done |
| 4 (next) | SMS / WhatsApp / email notifications (Termii + Resend), website settings & page editor, logo upload | |

The database already has every table for all four phases (`migrations/0001_init.sql`), so later phases don't need risky migrations.

## Set up (Windows, PowerShell)

```powershell
cd C:\Users\LENOVO\Documents\GitHub\ronia-logistics
nvm use 22
npm install

# 1. Cloudflare resources
npx wrangler login
npx wrangler d1 create ronia_logistics_db        # copy the database_id into wrangler.toml
npx wrangler r2 bucket create ronia-logistics-media

# 2. Database tables
npm run db:migrate:local      # for local dev
npm run db:migrate:remote     # for the live site

# 3. Run locally → http://localhost:3000  (first visit to /staff/login sends you to /setup to create the admin)
npm run dev

# 4. Deploy
npm run deploy
```

## Paystack (online payments)

1. Get your keys at https://dashboard.paystack.com/#/settings/developers
2. Local: copy `.dev.vars.example` to `.dev.vars` and put your **test** secret key in it, then restart `npm run dev`
3. Live: `npx wrangler secret put PAYSTACK_SECRET_KEY` and paste the **live** secret key
4. Until a key is set, the tracking page just says "pay at our office"

## GitHub

```powershell
git remote add origin https://github.com/emadex007/ronia-logistics.git
git push -u origin main
```

## Where things are

- `src/routes/`: pages (`index` home, `track`, `login`, `setup`, `admin/*`, `print.$id` receipt/label)
- `src/fns/`: server functions (all database reads and writes, with role checks)
- `src/server/`: D1 helpers and auth (PBKDF2 passwords, D1 sessions)
- `migrations/`: D1 schema
- Money is stored in **kobo** (₦1 = 100)

## Website editor

Admin → **Website** lets you change the logo, site icon, colours, home-page banner (picture **or** video), services with photos,
About text and photo, merchant banner, gallery, steps, FAQ, contact details, map, social links and receipt text.
Uploads go to the R2 bucket and are served from `/media/…`. The default photos are free Unsplash images; replace them with Ronia's own.

Only the **Administrator** and staff ticked as **Website editor** on the Staff page can open it.

## Login pages

| Who | Page | Notes |
|---|---|---|
| Admin & staff | `/staff/login` | Not linked on the website — bookmark it |
| Merchants | `/merchant/login` | "Merchant login" button on the website. New merchants **apply** here; an admin must approve before they can sign in |
| Customers | `/login` | Optional. Anyone can track without an account. Shipments whose sender email matches the account appear automatically |

## Roles

- **Administrator**: everything, including adding and disabling staff
- **Manager**: all operations and money figures, can view staff
- **Front desk / Warehouse** and **Rider / Driver**: create shipments, update statuses, record payments
- **Merchant**: their own portal only (`/merchant`): stock, history, deliveries, statements
- **Customer**: `/account`: their packages and packages they follow
