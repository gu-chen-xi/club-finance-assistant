-- 001_init.sql: 初始建表

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  budget INTEGER,
  actual_cost INTEGER NOT NULL DEFAULT 0,
  folder_path TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending',
  review_reject_reason TEXT DEFAULT '',
  paper_submitted INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_cent INTEGER NOT NULL,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  amount_cent INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_ext TEXT NOT NULL,
  head_checked INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  amount_cent INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  card_last_four TEXT NOT NULL,
  is_refund INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  total_price_cent INTEGER,
  quantity INTEGER,
  unit_price_cent INTEGER,
  handler_signed INTEGER NOT NULL DEFAULT 0,
  acceptor_signed INTEGER NOT NULL DEFAULT 0,
  leader_signed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS non_card (
  activity_id TEXT PRIMARY KEY,
  applicable INTEGER NOT NULL DEFAULT 0,
  files TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);
