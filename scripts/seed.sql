-- Seed data for testing
INSERT INTO uploads (filename, checksum, size, uploaded_at) 
VALUES ('test_data.json', 'abc123def456', 1024, strftime('%s', 'now') * 1000);

-- Insert some test WAF events
INSERT INTO waf_events (
  ray_id, event_ts, src_ip, src_country, src_asn, colo,
  host, path, method, status, rule_id, rule_name, rule_type,
  action, service, mitigation_reason, ua, bytes, threat_score, file_id
) VALUES 
  ('ray_001', strftime('%s', 'now', '-1 hour') * 1000, '192.168.1.1', 'US', 15169, 'SJC',
   'example.com', '/api/login', 'POST', 403, 'rule_001', 'SQL Injection', 'managed',
   'block', 'waf', 'SQL injection detected', 'Mozilla/5.0', 1024, 80, 1),
  
  ('ray_002', strftime('%s', 'now', '-2 hour') * 1000, '10.0.0.1', 'CN', 4134, 'LAX',
   'example.com', '/admin', 'GET', 403, 'rule_002', 'Admin Access', 'custom',
   'challenge', 'waf', 'Unauthorized admin access', 'curl/7.68.0', 512, 60, 1),
  
  ('ray_003', strftime('%s', 'now', '-3 hour') * 1000, '172.16.0.1', 'GB', 8075, 'LHR',
   'api.example.com', '/users', 'GET', 200, 'rule_003', 'Rate Limit', 'managed',
   'log', 'rate-limiting', 'Rate limit threshold', 'Python/3.8', 2048, 20, 1),
  
  ('ray_004', strftime('%s', 'now', '-4 hour') * 1000, '203.0.113.1', 'JP', 2516, 'NRT',
   'example.com', '/search', 'GET', 200, NULL, NULL, NULL,
   'allow', 'waf', NULL, 'Chrome/96.0', 768, 10, 1),
  
  ('ray_005', strftime('%s', 'now', '-5 hour') * 1000, '198.51.100.1', 'DE', 3320, 'FRA',
   'example.com', '/contact', 'POST', 429, 'rule_004', 'Bot Detection', 'managed',
   'block', 'bot-management', 'Automated bot detected', 'bot/1.0', 256, 90, 1);

-- Update analytics tables
INSERT INTO daily_actions (date, action, count)
SELECT 
  date(event_ts / 1000, 'unixepoch') as date,
  action,
  COUNT(*) as count
FROM waf_events
GROUP BY date, action;

INSERT INTO top_rules (rule_id, rule_name, rule_type, count, last_seen)
SELECT 
  rule_id,
  rule_name,
  rule_type,
  COUNT(*) as count,
  MAX(event_ts) as last_seen
FROM waf_events
WHERE rule_id IS NOT NULL
GROUP BY rule_id;

INSERT INTO top_ips (src_ip, count, countries, asns, last_seen)
SELECT 
  src_ip,
  COUNT(*) as count,
  json_group_array(DISTINCT src_country) as countries,
  json_group_array(DISTINCT src_asn) as asns,
  MAX(event_ts) as last_seen
FROM waf_events
WHERE src_ip IS NOT NULL
GROUP BY src_ip;
