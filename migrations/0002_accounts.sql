-- Customer accounts + merchant applications (admin approval)

-- Businesses applying to become merchants from the website.
-- status: pending | approved | rejected
CREATE TABLE merchant_applications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name   TEXT NOT NULL,
  contact_name    TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT NOT NULL COLLATE NOCASE,
  address         TEXT,
  what_they_sell  TEXT,
  password_hash   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  reject_reason   TEXT,
  merchant_id     INTEGER REFERENCES merchants(id),
  reviewed_by     INTEGER REFERENCES users(id),
  reviewed_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_applications_status ON merchant_applications(status, created_at);
CREATE INDEX idx_applications_email ON merchant_applications(email);

-- Shipments can belong to a registered customer (linked by staff or by matching sender email).
ALTER TABLE shipments ADD COLUMN customer_id INTEGER REFERENCES users(id);
CREATE INDEX idx_shipments_customer ON shipments(customer_id);

-- Tracking numbers a customer chose to follow from their account.
CREATE TABLE customer_watchlist (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, shipment_id)
);
