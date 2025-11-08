import { Env, Summary, TopRule, AttackPath } from '../../lib/types';

export async function handleSummary(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const startTime = url.searchParams.get('start_time') ? 
    parseInt(url.searchParams.get('start_time')!) : 
    Date.now() - 24 * 60 * 60 * 1000; // Default to last 24 hours
  const endTime = url.searchParams.get('end_time') ? 
    parseInt(url.searchParams.get('end_time')!) : 
    Date.now();

  try {
    // Get total events
    const totalResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM waf_events WHERE event_ts >= ? AND event_ts <= ?'
    ).bind(startTime, endTime).first<{ total: number }>();
    const totalEvents = totalResult?.total || 0;

    // Get unique IPs
    const uniqueIpsResult = await env.DB.prepare(
      'SELECT COUNT(DISTINCT src_ip) as count FROM waf_events WHERE event_ts >= ? AND event_ts <= ?'
    ).bind(startTime, endTime).first<{ count: number }>();
    const uniqueIps = uniqueIpsResult?.count || 0;

    // Get actions breakdown
    const actionsResult = await env.DB.prepare(
      'SELECT action, COUNT(*) as count FROM waf_events WHERE event_ts >= ? AND event_ts <= ? GROUP BY action'
    ).bind(startTime, endTime).all<{ action: string; count: number }>();
    
    const actionsBreakdown: Record<string, number> = {};
    let blockedCount = 0;
    
    for (const row of actionsResult.results || []) {
      actionsBreakdown[row.action] = row.count;
      if (row.action === 'block' || row.action === 'challenge') {
        blockedCount += row.count;
      }
    }
    
    const blockedPercentage = totalEvents > 0 ? (blockedCount / totalEvents) * 100 : 0;

    // Get top rule today
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const topRuleResult = await env.DB.prepare(`
      SELECT rule_id, rule_name, rule_type, COUNT(*) as count 
      FROM waf_events 
      WHERE event_ts >= ? AND rule_id IS NOT NULL
      GROUP BY rule_id 
      ORDER BY count DESC 
      LIMIT 1
    `).bind(todayStart).first<TopRule>();

    // Get top rules
    const topRulesResult = await env.DB.prepare(`
      SELECT rule_id, rule_name, rule_type, COUNT(*) as count 
      FROM waf_events 
      WHERE event_ts >= ? AND event_ts <= ? AND rule_id IS NOT NULL
      GROUP BY rule_id 
      ORDER BY count DESC 
      LIMIT 10
    `).bind(startTime, endTime).all<TopRule>();

    // Get top hosts
    const topHostsResult = await env.DB.prepare(`
      SELECT host, COUNT(*) as count 
      FROM waf_events 
      WHERE event_ts >= ? AND event_ts <= ? AND host IS NOT NULL
      GROUP BY host 
      ORDER BY count DESC 
      LIMIT 10
    `).bind(startTime, endTime).all<{ host: string; count: number }>();

    // Get top paths
    const topPathsResult = await env.DB.prepare(`
      SELECT path, method, status, COUNT(*) as count, MAX(event_ts) as last_seen
      FROM waf_events 
      WHERE event_ts >= ? AND event_ts <= ? AND path IS NOT NULL
      GROUP BY path, method, status 
      ORDER BY count DESC 
      LIMIT 10
    `).bind(startTime, endTime).all<AttackPath>();

    // Get geo distribution
    const geoResult = await env.DB.prepare(`
      SELECT src_country, COUNT(*) as count 
      FROM waf_events 
      WHERE event_ts >= ? AND event_ts <= ? AND src_country IS NOT NULL
      GROUP BY src_country 
      ORDER BY count DESC 
      LIMIT 20
    `).bind(startTime, endTime).all<{ src_country: string; count: number }>();
    
    const geoDistribution: Record<string, number> = {};
    for (const row of geoResult.results || []) {
      geoDistribution[row.src_country] = row.count;
    }

    // Get time series data (hourly buckets)
    const bucketSize = 60 * 60 * 1000; // 1 hour in milliseconds
    const timeSeriesResult = await env.DB.prepare(`
      SELECT 
        (event_ts / ${bucketSize}) * ${bucketSize} as bucket,
        action,
        COUNT(*) as count
      FROM waf_events
      WHERE event_ts >= ? AND event_ts <= ?
      GROUP BY bucket, action
      ORDER BY bucket
    `).bind(startTime, endTime).all<{ bucket: number; action: string; count: number }>();

    // Process time series data
    const timeSeriesMap = new Map<number, Record<string, number>>();
    for (const row of timeSeriesResult.results || []) {
      if (!timeSeriesMap.has(row.bucket)) {
        timeSeriesMap.set(row.bucket, { total: 0 });
      }
      const bucket = timeSeriesMap.get(row.bucket)!;
      bucket[row.action] = row.count;
      bucket.total += row.count;
    }

    const timeSeries = Array.from(timeSeriesMap.entries()).map(([timestamp, data]) => ({
      timestamp,
      ...data,
    }));

    const summary: Summary = {
      total_events: totalEvents,
      unique_ips: uniqueIps,
      blocked_percentage: blockedPercentage,
      top_rule_today: topRuleResult || undefined,
      actions_breakdown: actionsBreakdown,
      top_rules: topRulesResult.results || [],
      top_hosts: topHostsResult.results || [],
      top_paths: topPathsResult.results || [],
      geo_distribution: geoDistribution,
      time_series: timeSeries,
    };

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Summary error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate summary', message: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
