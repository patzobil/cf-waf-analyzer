import { Env, TopRule, TopIP, AttackPath } from '../../lib/types';

export async function handleTopRules(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const startTime = url.searchParams.get('start_time') ? 
    parseInt(url.searchParams.get('start_time')!) : undefined;
  const endTime = url.searchParams.get('end_time') ? 
    parseInt(url.searchParams.get('end_time')!) : undefined;

  try {
    let query = `
      SELECT rule_id, rule_name, rule_type, COUNT(*) as count, MAX(event_ts) as last_seen
      FROM waf_events
      WHERE rule_id IS NOT NULL
    `;
    const params: (number | string)[] = [];

    if (startTime) {
      query += ' AND event_ts >= ?';
      params.push(startTime);
    }
    if (endTime) {
      query += ' AND event_ts <= ?';
      params.push(endTime);
    }

    query += ' GROUP BY rule_id ORDER BY count DESC LIMIT ?';
    params.push(limit);

    const result = await env.DB.prepare(query)
      .bind(...params)
      .all<TopRule>();

    return new Response(JSON.stringify({ rules: result.results || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Top rules error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get top rules', message: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function handleTopIPs(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const startTime = url.searchParams.get('start_time') ? 
    parseInt(url.searchParams.get('start_time')!) : undefined;
  const endTime = url.searchParams.get('end_time') ? 
    parseInt(url.searchParams.get('end_time')!) : undefined;

  try {
    let query = `
      SELECT 
        src_ip, 
        COUNT(*) as count,
        json_group_array(DISTINCT src_country) as countries,
        json_group_array(DISTINCT src_asn) as asns,
        MAX(event_ts) as last_seen
      FROM waf_events
      WHERE src_ip IS NOT NULL
    `;
    const params: (number | string)[] = [];

    if (startTime) {
      query += ' AND event_ts >= ?';
      params.push(startTime);
    }
    if (endTime) {
      query += ' AND event_ts <= ?';
      params.push(endTime);
    }

    query += ' GROUP BY src_ip ORDER BY count DESC LIMIT ?';
    params.push(limit);

    const result = await env.DB.prepare(query)
      .bind(...params)
      .all<{ src_ip: string; count: number; countries: string; asns: string; last_seen?: number }>();
    
    // Parse JSON arrays
    const ips: TopIP[] = (result.results || []).map(row => ({
      src_ip: row.src_ip,
      count: row.count,
      countries: JSON.parse(row.countries || '[]'),
      asns: JSON.parse(row.asns || '[]'),
      last_seen: row.last_seen,
    }));

    return new Response(JSON.stringify({ ips }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Top IPs error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get top IPs', message: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function handleTopPaths(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const startTime = url.searchParams.get('start_time') ? 
    parseInt(url.searchParams.get('start_time')!) : undefined;
  const endTime = url.searchParams.get('end_time') ? 
    parseInt(url.searchParams.get('end_time')!) : undefined;

  try {
    let query = `
      SELECT 
        path,
        method,
        status,
        COUNT(*) as count,
        MAX(event_ts) as last_seen
      FROM waf_events
      WHERE path IS NOT NULL
    `;
    const params: (number | string)[] = [];

    if (startTime) {
      query += ' AND event_ts >= ?';
      params.push(startTime);
    }
    if (endTime) {
      query += ' AND event_ts <= ?';
      params.push(endTime);
    }

    query += ' GROUP BY path, method, status ORDER BY count DESC LIMIT ?';
    params.push(limit);

    const result = await env.DB.prepare(query)
      .bind(...params)
      .all<AttackPath>();

    return new Response(JSON.stringify({ paths: result.results || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Top paths error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get top paths', message: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
