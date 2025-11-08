import { WAFEvent, RawWAFRecord } from './types';

// Helper to safely extract string values
function safeString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

// Helper to safely extract string value from unknown
function extractString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function parseWAFRecord(raw: RawWAFRecord): WAFEvent | null {
  try {
    // Extract ray ID - handle both formats: RayID/rayId/ray_id and rayName
    const rayId = extractString(raw.RayID) || extractString(raw.rayId) || 
                  extractString(raw.ray_id) || extractString(raw.rayName) || 
                  extractString(raw.ray_name);
    if (!rayId) return null;

    // Extract and normalize timestamp - handle both formats: EdgeStartTimestamp and datetime
    const timestamp = raw.EdgeStartTimestamp || raw.edgeStartTimestamp || 
                     raw.timestamp || raw.event_timestamp || raw.datetime;
    const eventTs = normalizeTimestamp(timestamp);
    if (!eventTs) return null;

    // Extract IP and geo information - handle clientIP, clientCountryName, clientAsn
    const srcIp = extractString(raw.ClientIP) || extractString(raw.clientIP) || 
                  extractString(raw.client_ip) || extractString(raw.source_ip);
    const srcCountry = extractString(raw.ClientCountry) || extractString(raw.clientCountry) || 
                      extractString(raw.client_country) || extractString(raw.clientCountryName) || 
                      extractString(raw.client_country_name);
    const srcAsn = normalizeNumber(raw.ClientASN || raw.clientASN || raw.client_asn || 
                                   raw.clientAsn || raw.client_asn);
    
    // Extract colo/datacenter - may not be present in all formats
    const colo = extractString(raw.EdgeColoCode) || extractString(raw.edgeColoCode) || 
                 extractString(raw.colo) || extractString(raw.datacenter) || 
                 extractString(raw.edgeColo) || extractString(raw.edge_colo);
    
    // Extract request information - handle clientRequestHTTPHost, clientRequestHTTPMethodName
    const host = extractString(raw.ClientRequestHost) || extractString(raw.clientRequestHost) || 
                 extractString(raw.host) || extractString(raw.hostname) ||
                 extractString(raw.clientRequestHTTPHost) || extractString(raw.client_request_http_host);
    const path = extractString(raw.ClientRequestPath) || extractString(raw.clientRequestPath) || 
                 extractString(raw.path) || extractString(raw.uri) ||
                 extractString(raw.clientRequestPath) || extractString(raw.client_request_path);
    const method = extractString(raw.ClientRequestMethod) || extractString(raw.clientRequestMethod) || 
                   extractString(raw.method) ||
                   extractString(raw.clientRequestHTTPMethodName) || extractString(raw.client_request_http_method_name);
    const status = normalizeNumber(raw.EdgeResponseStatus || raw.edgeResponseStatus || raw.status ||
                                  raw.edgeResponseStatus || raw.edge_response_status);
    
    // Extract WAF/Firewall information - handle both array and singular formats
    let ruleId: string | undefined = undefined;
    if (Array.isArray(raw.FirewallMatchesRuleIDs) && raw.FirewallMatchesRuleIDs.length > 0) {
      ruleId = typeof raw.FirewallMatchesRuleIDs[0] === 'string' ? raw.FirewallMatchesRuleIDs[0] : undefined;
    } else if (Array.isArray(raw.firewallMatchesRuleIDs) && raw.firewallMatchesRuleIDs.length > 0) {
      ruleId = typeof raw.firewallMatchesRuleIDs[0] === 'string' ? raw.firewallMatchesRuleIDs[0] : undefined;
    } else if (typeof raw.rule_id === 'string') {
      ruleId = raw.rule_id;
    } else if (typeof raw.ruleId === 'string') {
      ruleId = raw.ruleId;
    } else if (typeof raw.WAFRuleID === 'string') {
      ruleId = raw.WAFRuleID;
    } else if (typeof raw.wafRuleID === 'string') {
      ruleId = raw.wafRuleID;
    }
    
    let actionValue: string | undefined = undefined;
    if (Array.isArray(raw.FirewallMatchesActions) && raw.FirewallMatchesActions.length > 0) {
      actionValue = typeof raw.FirewallMatchesActions[0] === 'string' ? raw.FirewallMatchesActions[0] : undefined;
    } else if (Array.isArray(raw.firewallMatchesActions) && raw.firewallMatchesActions.length > 0) {
      actionValue = typeof raw.firewallMatchesActions[0] === 'string' ? raw.firewallMatchesActions[0] : undefined;
    } else if (typeof raw.action === 'string') {
      actionValue = raw.action;
    } else if (typeof raw.WAFAction === 'string') {
      actionValue = raw.WAFAction;
    } else if (typeof raw.wafAction === 'string') {
      actionValue = raw.wafAction;
    }
    const action = normalizeAction(actionValue);
    
    // Extract service/source - handle both array and singular formats
    let service: string | undefined = undefined;
    if (Array.isArray(raw.FirewallMatchesSources) && raw.FirewallMatchesSources.length > 0) {
      service = typeof raw.FirewallMatchesSources[0] === 'string' ? raw.FirewallMatchesSources[0] : undefined;
    } else if (Array.isArray(raw.firewallMatchesSources) && raw.firewallMatchesSources.length > 0) {
      service = typeof raw.firewallMatchesSources[0] === 'string' ? raw.firewallMatchesSources[0] : undefined;
    } else if (typeof raw.service === 'string') {
      service = raw.service;
    } else if (typeof raw.source === 'string') {
      service = raw.source;
    }
    
    // Extract rule name and type - handle description field
    const ruleName = safeString(raw.WAFRuleMessage) || safeString(raw.wafRuleMessage) || 
                    safeString(raw.rule_name) || safeString(raw.description);
    const ruleType = determineRuleType(ruleId, service);
    
    // Extract additional fields
    const ua = extractString(raw.ClientRequestUserAgent) || extractString(raw.clientRequestUserAgent) || 
              extractString(raw.user_agent) || extractString(raw.ua) || extractString(raw.userAgent);
    const ja3 = extractString(raw.JA3Hash) || extractString(raw.ja3Hash) || extractString(raw.ja3);
    const bytes = normalizeNumber(raw.ClientRequestBytes || raw.clientRequestBytes || raw.bytes ||
                                 raw.clientRequestBytes || raw.client_request_bytes);
    const threatScore = normalizeNumber(raw.SecurityLevel || raw.securityLevel || raw.threat_score);
    
    return {
      ray_id: rayId,
      event_ts: eventTs,
      src_ip: srcIp || undefined,
      src_country: srcCountry || undefined,
      src_asn: srcAsn || undefined,
      colo: colo || undefined,
      host: host || undefined,
      path: path || undefined,
      method: method || undefined,
      status: status || undefined,
      rule_id: ruleId || undefined,
      rule_name: ruleName,
      rule_type: ruleType,
      action: action,
      service: service || undefined,
      mitigation_reason: safeString(raw.mitigation_reason),
      ua: ua || undefined,
      ja3: ja3 || undefined,
      bytes: bytes || undefined,
      threat_score: threatScore || undefined,
    };
  } catch (error) {
    console.error('Error parsing WAF record:', error);
    return null;
  }
}

function normalizeTimestamp(value: unknown): number | null {
  if (!value) return null;
  
  // If already a number, assume it's epoch
  if (typeof value === 'number') {
    // If it's in seconds (10 digits), convert to milliseconds
    if (value < 10000000000) {
      return value * 1000;
    }
    return value;
  }
  
  // Parse ISO8601 or other date strings
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
    
    // Try to parse as epoch string
    const num = parseInt(value);
    if (!isNaN(num)) {
      return num < 10000000000 ? num * 1000 : num;
    }
  }
  
  return null;
}

function normalizeNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return isNaN(value) ? undefined : value;
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

function normalizeAction(action: string | undefined): WAFEvent['action'] {
  if (!action) return 'unknown';
  
  const normalized = action.toLowerCase().replace(/[_-]/g, '');
  switch (normalized) {
    case 'block':
    case 'blocked':
      return 'block';
    case 'challenge':
    case 'challenged':
    case 'jschallenge':
    case 'managedchallenge':
    case 'managed_challenge':
      return 'challenge';
    case 'log':
    case 'logged':
      return 'log';
    case 'skip':
    case 'skipped':
    case 'bypass':
      return 'skip';
    case 'allow':
    case 'allowed':
    case 'pass':
      return 'allow';
    default:
      return 'unknown';
  }
}

function determineRuleType(ruleId: string | undefined, service: string | undefined): WAFEvent['rule_type'] {
  if (!ruleId) return 'unknown';
  
  // Check if it's a managed rule based on ID pattern
  if (ruleId.startsWith('managed_') || ruleId.includes('OWASP') || 
      ruleId.includes('cloudflare') || service === 'managed') {
    return 'managed';
  }
  
  // Check if it's a custom rule
  if (ruleId.startsWith('custom_') || service === 'custom') {
    return 'custom';
  }
  
  // Default to unknown
  return 'unknown';
}

export async function computeChecksum(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
