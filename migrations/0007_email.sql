-- Email notifications through Resend
ALTER TABLE conversations ADD COLUMN visitor_seen_at TEXT;
ALTER TABLE notifications ADD COLUMN error TEXT;

INSERT OR IGNORE INTO settings (key, value) VALUES ('site_url', 'https://ronialogistics.com');
INSERT OR IGNORE INTO settings (key, value) VALUES ('email_from', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('notify_email', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('email_office_on', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('email_customers_on', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('email_merchants_on', '1');
