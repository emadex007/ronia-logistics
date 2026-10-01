-- Website chat + contact form inbox
-- source: chat | form ; status: open | closed
CREATE TABLE conversations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source           TEXT NOT NULL DEFAULT 'chat',
  visitor_token    TEXT UNIQUE,
  name             TEXT NOT NULL,
  phone            TEXT,
  email            TEXT,
  subject          TEXT,
  status           TEXT NOT NULL DEFAULT 'open',
  unread_admin     INTEGER NOT NULL DEFAULT 0,
  unread_visitor   INTEGER NOT NULL DEFAULT 0,
  assigned_to      INTEGER REFERENCES users(id),
  page_url         TEXT,
  last_message_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_conv_last ON conversations(status, last_message_at);

CREATE TABLE conversation_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL,              -- visitor | staff
  staff_id        INTEGER REFERENCES users(id),
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_convmsg ON conversation_messages(conversation_id, id);

INSERT OR IGNORE INTO settings (key, value) VALUES ('chat_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('chat_title', 'Chat with Ronia Logistics');
INSERT OR IGNORE INTO settings (key, value) VALUES ('chat_greeting', 'Hello! 👋 How can we help you today? Ask about a delivery, prices or becoming a merchant.');
INSERT OR IGNORE INTO settings (key, value) VALUES ('contact_form_title', 'Send us a message');
