CREATE TABLE IF NOT EXISTS users (
  fid INTEGER PRIMARY KEY,
  signer_uuid TEXT,
  wallet_address TEXT,
  tone_prompt TEXT DEFAULT 'Be helpful and engaging',
  subscription_active INTEGER DEFAULT 0,
  subscription_expires INTEGER DEFAULT 0,
  subscription_tier TEXT DEFAULT 'human',
  daily_post_count INTEGER DEFAULT 0,
  last_post_date TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fid INTEGER,
  tx_hash TEXT UNIQUE,
  amount_usdc TEXT,
  tier TEXT DEFAULT 'human',
  verified INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reply_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  replier_fid INTEGER,
  target_cast_hash TEXT,
  reply_cast_hash TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(replier_fid, target_cast_hash)
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fid INTEGER,
  text TEXT,
  post_at INTEGER,
  posted INTEGER DEFAULT 0
);
