-- Clear all data from tables (keeps schema intact)
DELETE FROM waf_events;
DELETE FROM uploads;
DELETE FROM daily_actions;
DELETE FROM top_rules;
DELETE FROM top_ips;
DELETE FROM attack_paths;

-- Reset auto-increment counters (SQLite specific)
DELETE FROM sqlite_sequence WHERE name IN ('waf_events', 'uploads', 'daily_actions', 'top_rules', 'top_ips', 'attack_paths');

