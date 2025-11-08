import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  R2?: R2Bucket;
  AUTH_TOKEN: string;
  ENABLE_R2_STORAGE?: string;
  MAX_BATCH_SIZE?: string;
  MAX_FILE_SIZE_MB?: string;
}

export interface WAFEvent {
  id?: number;
  ray_id: string;
  event_ts: number;
  src_ip?: string;
  src_country?: string;
  src_asn?: number;
  colo?: string;
  host?: string;
  path?: string;
  method?: string;
  status?: number;
  rule_id?: string;
  rule_name?: string;
  rule_type?: 'managed' | 'custom' | 'unknown';
  action?: 'block' | 'challenge' | 'log' | 'skip' | 'allow' | 'unknown';
  service?: string;
  mitigation_reason?: string;
  ua?: string;
  ja3?: string;
  bytes?: number;
  threat_score?: number;
  file_id?: number;
  ingested_at?: number;
}

export interface Upload {
  id: number;
  filename: string;
  checksum: string;
  size: number;
  uploaded_at: number;
  raw_r2_key?: string;
  total_records?: number;
  inserted_records?: number;
  deduped_records?: number;
}

export interface DailyAction {
  date: string;
  action: string;
  count: number;
}

export interface TopRule {
  rule_id: string;
  rule_name?: string;
  rule_type?: string;
  count: number;
  last_seen?: number;
}

export interface TopIP {
  src_ip: string;
  count: number;
  countries?: string[];
  asns?: number[];
  last_seen?: number;
}

export interface AttackPath {
  path: string;
  method?: string;
  status?: number;
  count: number;
  last_seen?: number;
}

export interface Summary {
  total_events: number;
  unique_ips: number;
  blocked_percentage: number;
  top_rule_today?: TopRule;
  actions_breakdown: Record<string, number>;
  top_rules: TopRule[];
  top_hosts: { host: string; count: number }[];
  top_paths: AttackPath[];
  geo_distribution: Record<string, number>;
  time_series: TimeSeriesData[];
}

export interface TimeSeriesData {
  timestamp: number;
  total: number;
  block?: number;
  challenge?: number;
  log?: number;
  allow?: number;
  skip?: number;
}

export interface EventsQuery {
  start_time?: number;
  end_time?: number;
  action?: string;
  rule_id?: string;
  host?: string;
  src_country?: string;
  colo?: string;
  method?: string;
  status?: number;
  search?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
}

// Raw WAF export field mapping
export interface RawWAFRecord {
  // Common fields across different export formats
  RayID?: string;
  rayId?: string;
  ray_id?: string;
  
  EdgeStartTimestamp?: string | number;
  edgeStartTimestamp?: string | number;
  timestamp?: string | number;
  event_timestamp?: string | number;
  
  ClientIP?: string;
  clientIP?: string;
  client_ip?: string;
  source_ip?: string;
  
  ClientCountry?: string;
  clientCountry?: string;
  client_country?: string;
  
  ClientASN?: number | string;
  clientASN?: number | string;
  client_asn?: number | string;
  
  EdgeColoCode?: string;
  edgeColoCode?: string;
  colo?: string;
  datacenter?: string;
  
  ClientRequestHost?: string;
  clientRequestHost?: string;
  host?: string;
  hostname?: string;
  
  ClientRequestPath?: string;
  clientRequestPath?: string;
  path?: string;
  uri?: string;
  
  ClientRequestMethod?: string;
  clientRequestMethod?: string;
  method?: string;
  
  EdgeResponseStatus?: number | string;
  edgeResponseStatus?: number | string;
  status?: number | string;
  
  FirewallMatchesRuleIDs?: string[];
  firewallMatchesRuleIDs?: string[];
  rule_id?: string;
  ruleId?: string;
  
  FirewallMatchesActions?: string[];
  firewallMatchesActions?: string[];
  action?: string;
  
  FirewallMatchesSources?: string[];
  firewallMatchesSources?: string[];
  service?: string;
  
  ClientRequestUserAgent?: string;
  clientRequestUserAgent?: string;
  user_agent?: string;
  ua?: string;
  
  SecurityLevel?: number | string;
  securityLevel?: number | string;
  threat_score?: number | string;
  
  ClientRequestBytes?: number | string;
  clientRequestBytes?: number | string;
  bytes?: number | string;
  
  JA3Hash?: string;
  ja3Hash?: string;
  ja3?: string;
  
  // WAF specific fields
  WAFRuleID?: string;
  wafRuleID?: string;
  WAFAction?: string;
  wafAction?: string;
  WAFRuleMessage?: string;
  wafRuleMessage?: string;
  
  // Additional fields that might be present
  [key: string]: unknown;
}
