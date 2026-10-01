-- Incoming email (Cloudflare Email Routing → this Worker) lands in Admin → Messages
ALTER TABLE conversation_messages ADD COLUMN attachments TEXT;   -- JSON [{name,key,size,type}]
ALTER TABLE conversations ADD COLUMN email_message_id TEXT;      -- last incoming Message-ID, so replies thread in Gmail
CREATE INDEX IF NOT EXISTS idx_conv_email ON conversations(email, last_message_at);

INSERT OR IGNORE INTO settings (key, value) VALUES ('forward_email_to', '');
