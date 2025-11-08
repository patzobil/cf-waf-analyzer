import { Env, EventsQuery, WAFEvent } from '../../lib/types';

export async function handleEvents(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query: EventsQuery = {
    start_time: url.searchParams.get('start_time') ? parseInt(url.searchParams.get('start_time')!) : undefined,
    end_time: url.searchParams.get('end_time') ? parseInt(url.searchParams.get('end_time')!) : undefined,
    action: url.searchParams.get('action') || undefined,
    rule_id: url.searchParams.get('rule_id') || undefined,
    host: url.searchParams.get('host') || undefined,
    src_country: url.searchParams.get('src_country') || undefined,
    colo: url.searchParams.get('colo') || undefined,
    method: url.searchParams.get('method') || undefined,
    status: url.searchParams.get('status') ? parseInt(url.searchParams.get('status')!) : undefined,
    search: url.searchParams.get('search') || undefined,
    limit: parseInt(url.searchParams.get('limit') || '50'),
    offset: parseInt(url.searchParams.get('offset') || '0'),
  };

  try {
    // Build query
    const conditions: string[] = [];
    const params: (number | string)[] = [];
    
    if (query.start_time) {
      conditions.push('event_ts >= ?');
      params.push(query.start_time);
    }
    
    if (query.end_time) {
      conditions.push('event_ts <= ?');
      params.push(query.end_time);
    }
    
    if (query.action) {
      conditions.push('action = ?');
      params.push(query.action);
    }
    
    if (query.rule_id) {
      conditions.push('rule_id = ?');
      params.push(query.rule_id);
    }
    
    if (query.host) {
      conditions.push('host = ?');
      params.push(query.host);
    }
    
    if (query.src_country) {
      conditions.push('src_country = ?');
      params.push(query.src_country);
    }
    
    if (query.colo) {
      conditions.push('colo = ?');
      params.push(query.colo);
    }
    
    if (query.method) {
      conditions.push('method = ?');
      params.push(query.method);
    }
    
    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    
    if (query.search) {
      conditions.push('(path LIKE ? OR ua LIKE ? OR host LIKE ?)');
      const searchPattern = `%${query.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM waf_events ${whereClause}`;
    const countResult = await env.DB.prepare(countQuery)
      .bind(...params)
      .first<{ total: number }>();
    const total = countResult?.total || 0;
    
    // Get events
    const eventsQuery = `
      SELECT 
        id, ray_id, event_ts, src_ip, src_country, src_asn, colo,
        host, path, method, status, rule_id, rule_name, rule_type,
        action, service, mitigation_reason, ua, ja3, bytes, threat_score
      FROM waf_events 
      ${whereClause}
      ORDER BY event_ts DESC
      LIMIT ? OFFSET ?
    `;
    
    const result = await env.DB.prepare(eventsQuery)
      .bind(...params, query.limit, query.offset)
      .all<WAFEvent>();
    
    return new Response(
      JSON.stringify({
        events: result.results || [],
        total,
        limit: query.limit,
        offset: query.offset,
        has_more: query.offset + query.limit < total,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Events query error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to query events', message: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
