-- Create uploads table
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  checksum TEXT UNIQUE NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  raw_r2_key TEXT,
  total_records INTEGER DEFAULT 0,
  inserted_records INTEGER DEFAULT 0,
  deduped_records INTEGER DEFAULT 0
);

-- Create waf_events table
CREATE TABLE IF NOT EXISTS waf_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ray_id TEXT NOT NULL,
  event_ts INTEGER NOT NULL,
  src_ip TEXT,
  src_country TEXT,
  src_asn INTEGER,
  colo TEXT,
  host TEXT,
  path TEXT,
  method TEXT,
  status INTEGER,
  rule_id TEXT,
  rule_name TEXT,
  rule_type TEXT CHECK(rule_type IN ('managed', 'custom', 'unknown')),
  action TEXT CHECK(action IN ('block', 'challenge', 'log', 'skip', 'allow', 'unknown')),
  service TEXT,
  mitigation_reason TEXT,
  ua TEXT,
  ja3 TEXT,
  bytes INTEGER,
  threat_score INTEGER,
  file_id INTEGER REFERENCES uploads(id) ON DELETE CASCADE,
  ingested_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(ray_id, event_ts)
);

-- Create indexes for performance
CREATE INDEX idx_waf_events_event_ts ON waf_events(event_ts);
CREATE INDEX idx_waf_events_action ON waf_events(action);
CREATE INDEX idx_waf_events_rule_id ON waf_events(rule_id);
CREATE INDEX idx_waf_events_src_ip ON waf_events(src_ip);
CREATE INDEX idx_waf_events_colo ON waf_events(colo);
CREATE INDEX idx_waf_events_host ON waf_events(host);
CREATE INDEX idx_waf_events_event_ts_action ON waf_events(event_ts, action);
CREATE INDEX idx_waf_events_event_ts_rule_id ON waf_events(event_ts, rule_id);
CREATE INDEX idx_waf_events_file_id ON waf_events(file_id);

-- Create materialized views/tables for analytics
CREATE TABLE IF NOT EXISTS daily_actions (
  date TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  PRIMARY KEY(date, action)
);

CREATE INDEX idx_daily_actions_date_action ON daily_actions(date, action);

CREATE TABLE IF NOT EXISTS top_rules (
  rule_id TEXT PRIMARY KEY,
  rule_name TEXT,
  rule_type TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER,
  last_updated INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS top_ips (
  src_ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  countries TEXT, -- JSON array of countries
  asns TEXT, -- JSON array of ASNs
  last_seen INTEGER,
  last_updated INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS attack_paths (
  path_hash TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  method TEXT,
  status INTEGER,
  count INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER,
  last_updated INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_attack_paths_count ON attack_paths(count DESC);
