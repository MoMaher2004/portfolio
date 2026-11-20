-- Managed by the deployment script. D1 (SQLite).
CREATE TABLE IF NOT EXISTS content_items (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL CHECK (json_valid(content)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS content_items_ordered ON content_items(collection, position);
CREATE TABLE IF NOT EXISTS configuration (
  name TEXT PRIMARY KEY,
  content TEXT NOT NULL CHECK (json_valid(content)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS messages_recent ON messages(created_at DESC);
CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS visit_hours (
  date TEXT NOT NULL,
  hour INTEGER NOT NULL,
  country TEXT NOT NULL,
  path TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(date, hour, country, path)
);
CREATE TABLE IF NOT EXISTS auth_attempts (
  ip_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS contact_limits (
  ip_hash TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
