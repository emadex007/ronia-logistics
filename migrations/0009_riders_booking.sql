-- Rider deliveries with proof of delivery, price list + online booking, phone app settings

-- Proof of delivery (assigned_rider, recipient_signature and proof_image_key already exist)
ALTER TABLE shipments ADD COLUMN signed_by TEXT;          -- who signed for it at the door
ALTER TABLE shipments ADD COLUMN assigned_at TEXT;
ALTER TABLE shipments ADD COLUMN booked_online INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shipments ADD COLUMN pickup_requested INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_shipments_rider ON shipments(assigned_rider, status);

-- Price list. price = base_fee + extra_per_kg × (weight above included_kg, rounded up)
CREATE TABLE rates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  origin        TEXT NOT NULL DEFAULT 'Abuja',
  destination   TEXT NOT NULL,
  service_type  TEXT NOT NULL DEFAULT 'standard',
  base_fee      INTEGER NOT NULL,              -- kobo
  included_kg   REAL NOT NULL DEFAULT 2,
  extra_per_kg  INTEGER NOT NULL DEFAULT 0,    -- kobo per extra kg
  eta           TEXT,                          -- e.g. "1–2 working days"
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_rates_route ON rates(origin, destination, active);

-- Sample prices so the booking page works straight away — edit them in Admin → Prices
INSERT INTO rates (origin, destination, service_type, base_fee, included_kg, extra_per_kg, eta) VALUES
  ('Abuja', 'Abuja', 'same_day', 250000, 3, 30000, 'Same day'),
  ('Abuja', 'Lagos', 'standard', 500000, 2, 50000, '2–3 working days'),
  ('Abuja', 'Lagos', 'express', 800000, 2, 80000, 'Next working day'),
  ('Abuja', 'Port Harcourt', 'standard', 550000, 2, 50000, '2–3 working days'),
  ('Abuja', 'Kano', 'standard', 500000, 2, 50000, '2–3 working days'),
  ('Abuja', 'Kaduna', 'standard', 400000, 2, 40000, '1–2 working days'),
  ('Abuja', 'Enugu', 'standard', 500000, 2, 50000, '2–3 working days'),
  ('Abuja', 'Ibadan', 'standard', 500000, 2, 50000, '2–3 working days');

INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_note', 'Prices include pickup within the city. Fragile or very large items may cost more — we will call you before collecting.');
INSERT OR IGNORE INTO settings (key, value) VALUES ('app_icon_key', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('app_short_name', 'Ronia');
