# Ronia Logistics

Package tracking, staff dashboard, merchant portal and income/expense records for **Ronia Logistics, Abuja**.
Built by Emadex Creations on TanStack Start + Cloudflare Workers, D1 and R2 (same stack as Emawealth Store).

## Build phases

| Phase | What's in it | Status |
|---|---|---|
| 1 | Public site, package tracking page, staff login, first-admin setup, dashboard, shipments (create, status updates, timeline, who-handled-what), printable receipt & label, staff management | ✅ this build |
| 2 | Merchant portal: merchants, products/stock in warehouse, stock in/out/sold, merchant's own dashboard & statements | next |
| 3 | Income & expenses (who handled it, monthly totals, printable reports), Paystack online payments, merchant payouts | |
| 4 | SMS / WhatsApp / email notifications (Termii + Resend), website settings & page editor, logo upload | |

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

# 3. Run locally → http://localhost:3000  (first visit to /login sends you to /setup to create the admin)
npm run dev

# 4. Deploy
npm run deploy
```

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

## Roles

- **Administrator**: everything, including adding and disabling staff
- **Manager**: all operations and money figures, can view staff
- **Front desk / Warehouse** and **Rider / Driver**: create shipments, update statuses, record payments
- **Merchant** (Phase 2): their own portal only
