-- Ronia Logistics — full database schema (all phases)
-- Dates are ISO-8601 UTC strings.

-- ───────────── Users, roles, sessions ─────────────
-- role: admin | manager | staff | rider | merchant
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',
  branch        TEXT,
  merchant_id   INTEGER REFERENCES merchants(id),
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,           -- sha-256 of the cookie token
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ───────────── Site settings (editable from admin) ─────────────
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('company_name',   'Ronia Logistics'),
  ('tagline',        'Fast, safe and trackable deliveries across Nigeria and beyond.'),
  ('hero_title',     'Your packages, delivered with care.'),
  ('hero_subtitle',  'Send parcels within Abuja, across Nigeria and internationally — and follow every step with live tracking.'),
  ('phone',          '+234 800 000 0000'),
  ('whatsapp',       '+234 800 000 0000'),
  ('email',          'info@ronialogistics.com'),
  ('address',        'Abuja, FCT, Nigeria'),
  ('primary_color',  '#0b2545'),
  ('accent_color',   '#f97316'),
  ('logo_key',       ''),
  ('receipt_footer', 'Thank you for choosing Ronia Logistics. Keep this receipt for tracking and claims.'),
  ('tracking_prefix','RL');

-- Editable content blocks for public pages (about, services, FAQ, etc.)
CREATE TABLE pages (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO pages (slug, title, body) VALUES
  ('about',    'About Ronia Logistics', 'Ronia Logistics is an Abuja-based logistics company offering same-day, interstate and international deliveries, plus secure warehousing and order fulfilment for vendors.'),
  ('services', 'Our Services',          'Same-day delivery in Abuja\nInterstate delivery across Nigeria\nInternational shipping\nWarehousing & fulfilment for vendors\nCash-on-delivery collection');

-- ───────────── Merchants / vendors who keep stock with Ronia ─────────────
CREATE TABLE merchants (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name  TEXT NOT NULL,
  contact_name   TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  bank_name      TEXT,
  account_name   TEXT,
  account_number TEXT,
  notes          TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE products (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id         INTEGER NOT NULL REFERENCES merchants(id),
  sku                 TEXT,
  name                TEXT NOT NULL,
  description         TEXT,
  unit_price          INTEGER NOT NULL DEFAULT 0,   -- kobo
  quantity            INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  shelf_location      TEXT,
  image_key           TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_products_merchant ON products(merchant_id);

-- type: received | sold | dispatched | returned | adjustment
CREATE TABLE stock_movements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  type        TEXT NOT NULL,
  quantity    INTEGER NOT NULL,
  unit_price  INTEGER NOT NULL DEFAULT 0,          -- kobo
  shipment_id INTEGER REFERENCES shipments(id),
  reference   TEXT,
  note        TEXT,
  handled_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_stock_product ON stock_movements(product_id);
CREATE INDEX idx_stock_merchant ON stock_movements(merchant_id, created_at);

-- ───────────── Shipments & tracking ─────────────
-- status: pending | received | in_transit | arrived_hub | out_for_delivery | delivered | returned | cancelled
CREATE TABLE shipments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_code       TEXT NOT NULL UNIQUE,
  sender_name         TEXT NOT NULL,
  sender_phone        TEXT NOT NULL,
  sender_email        TEXT,
  sender_address      TEXT,
  receiver_name       TEXT NOT NULL,
  receiver_phone      TEXT NOT NULL,
  receiver_email      TEXT,
  receiver_address    TEXT NOT NULL,
  origin_city         TEXT NOT NULL DEFAULT 'Abuja',
  destination_city    TEXT NOT NULL,
  destination_country TEXT NOT NULL DEFAULT 'Nigeria',
  service_type        TEXT NOT NULL DEFAULT 'standard',  -- same_day | standard | express | international
  description         TEXT,
  quantity            INTEGER NOT NULL DEFAULT 1,
  weight_kg           REAL,
  declared_value      INTEGER NOT NULL DEFAULT 0,        -- kobo
  shipping_fee        INTEGER NOT NULL DEFAULT 0,        -- kobo
  cod_amount          INTEGER NOT NULL DEFAULT 0,        -- kobo to collect on delivery
  payment_status      TEXT NOT NULL DEFAULT 'unpaid',    -- unpaid | paid | cod
  payment_method      TEXT,                              -- cash | transfer | pos | paystack
  status              TEXT NOT NULL DEFAULT 'received',
  current_location    TEXT,
  merchant_id         INTEGER REFERENCES merchants(id),
  created_by          INTEGER REFERENCES users(id),
  received_by         INTEGER REFERENCES users(id),
  dispatched_by       INTEGER REFERENCES users(id),
  delivered_by        INTEGER REFERENCES users(id),
  assigned_rider      INTEGER REFERENCES users(id),
  estimated_delivery  TEXT,
  delivered_at        TEXT,
  recipient_signature TEXT,
  proof_image_key     TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_created ON shipments(created_at);
CREATE INDEX idx_shipments_merchant ON shipments(merchant_id);

CREATE TABLE shipment_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  location    TEXT,
  note        TEXT,
  staff_id    INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_events_shipment ON shipment_events(shipment_id, created_at);

-- ───────────── Finance: income & expenses ─────────────
-- type: income | expense
CREATE TABLE transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  category    TEXT NOT NULL,       -- e.g. Shipping fee, Storage fee, Fuel, Salaries, Rent
  amount      INTEGER NOT NULL,    -- kobo
  description TEXT,
  method      TEXT,                -- cash | transfer | pos | paystack
  reference   TEXT,
  shipment_id INTEGER REFERENCES shipments(id),
  merchant_id INTEGER REFERENCES merchants(id),
  handled_by  INTEGER REFERENCES users(id),
  txn_date    TEXT NOT NULL,       -- YYYY-MM-DD
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_txn_date ON transactions(txn_date);
CREATE INDEX idx_txn_type ON transactions(type, txn_date);

-- Online payments (Paystack)
CREATE TABLE payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER REFERENCES shipments(id),
  merchant_id INTEGER REFERENCES merchants(id),
  provider    TEXT NOT NULL DEFAULT 'paystack',
  reference   TEXT NOT NULL UNIQUE,
  amount      INTEGER NOT NULL,    -- kobo
  email       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | success | failed
  paid_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Payouts from Ronia to merchants (money collected on their sales)
CREATE TABLE merchant_payouts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  amount      INTEGER NOT NULL,    -- kobo
  method      TEXT,
  reference   TEXT,
  note        TEXT,
  handled_by  INTEGER REFERENCES users(id),
  paid_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ───────────── Notifications & audit ─────────────
-- channel: dashboard | email | sms | whatsapp
CREATE TABLE notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel     TEXT NOT NULL DEFAULT 'dashboard',
  recipient   TEXT,               -- phone/email, or NULL for dashboard
  user_id     INTEGER REFERENCES users(id),
  merchant_id INTEGER REFERENCES merchants(id),
  shipment_id INTEGER REFERENCES shipments(id),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued', -- queued | sent | failed | read
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notif_status ON notifications(status, created_at);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  INTEGER,
  details    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_audit_created ON audit_log(created_at);
