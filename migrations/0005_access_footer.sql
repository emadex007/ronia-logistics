-- Per-staff access (JSON list of sections; NULL = defaults for their role) + logo/text size + footer settings
ALTER TABLE users ADD COLUMN permissions TEXT;

INSERT OR IGNORE INTO settings (key, value) VALUES ('logo_height', '44');
INSERT OR IGNORE INTO settings (key, value) VALUES ('logo_show_name', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('logo_name_size', '20');
INSERT OR IGNORE INTO settings (key, value) VALUES ('base_font_size', '16');
INSERT OR IGNORE INTO settings (key, value) VALUES ('footer_bg', '#000000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('footer_text', '#cbd5e1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('footer_heading', '#ffffff');
INSERT OR IGNORE INTO settings (key, value) VALUES ('footer_about', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('footer_copyright', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('footer_show_logo', '1');
