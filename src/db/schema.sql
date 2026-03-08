CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fid INTEGER UNIQUE NOT NULL,
  signer_uuid TEXT NOT NULL,
  wallet_address TEXT,
  tone_prompt TEXT DEFAULT 'Be concise, direct, and human. No fluff.',
  subscription_active INTEGER DEFAULT 0,
  subscription_expires INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fid INTEGER NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  amount_usdc TEXT NOT NULL,
  verified INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (fid) REFERENCES users(fid)
);

CREATE TABLE IF NOT EXISTS reply_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  replier_fid INTEGER NOT NULL,
  target_cast_hash TEXT NOT NULL,
  reply_cast_hash TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(replier_fid, target_cast_hash)
);

CREATE INDEX IF NOT EXISTS idx_users_fid ON users(fid);
CREATE INDEX IF NOT EXISTS idx_reply_log_replier ON reply_log(replier_fid);
CREATE INDEX IF NOT EXISTS idx_reply_log_target ON reply_log(target_cast_hash);
