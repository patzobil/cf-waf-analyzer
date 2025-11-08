import { Env } from '../../lib/types';
import { parseWAFRecord } from '../../lib/parser';

export async function handleReindex(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { checksum?: string; file_id?: number };
    
    if (!body.checksum && !body.file_id) {
      return new Response(
        JSON.stringify({ error: 'Either checksum or file_id is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get file info
    let fileQuery = 'SELECT * FROM uploads WHERE ';
    let fileParam: string | number;
    
    if (body.checksum) {
      fileQuery += 'checksum = ?';
      fileParam = body.checksum;
    } else {
      fileQuery += 'id = ?';
      fileParam = body.file_id!;
    }

    const fileInfo = await env.DB.prepare(fileQuery).bind(fileParam).first<{
      id: number;
      filename: string;
      checksum: string;
      raw_r2_key?: string;
    }>();

    if (!fileInfo) {
      return new Response(
        JSON.stringify({ error: 'File not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if raw file exists in R2
    if (!env.R2 || !fileInfo.raw_r2_key) {
      return new Response(
        JSON.stringify({ error: 'Raw file not available for reprocessing' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get raw file from R2
    const r2Object = await env.R2.get(fileInfo.raw_r2_key);
    if (!r2Object) {
      return new Response(
        JSON.stringify({ error: 'Raw file not found in R2' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const content = await r2Object.text();

    // Delete existing events for this file
    await env.DB.prepare('DELETE FROM waf_events WHERE file_id = ?')
      .bind(fileInfo.id).run();

    // Reparse and insert events
    const events = [];
    const errors = [];

    // Try to parse as JSON array first
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        for (const record of data) {
          try {
            const event = parseWAFRecord(record);
            if (event) events.push(event);
          } catch (e) {
            errors.push(`Failed to parse record: ${e}`);
          }
        }
      }
    } catch {
      // Parse as NDJSON
      const lines = content.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          const event = parseWAFRecord(record);
          if (event) events.push(event);
        } catch (e) {
          errors.push(`Failed to parse line: ${e}`);
        }
      }
    }

    // Batch insert events
    const batchSize = parseInt(env.MAX_BATCH_SIZE || '1000');
    let totalInserted = 0;
    let totalDeduped = 0;

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      const stmt = env.DB.prepare(`
        INSERT OR IGNORE INTO waf_events (
          ray_id, event_ts, src_ip, src_country, src_asn, colo,
          host, path, method, status, rule_id, rule_name, rule_type,
          action, service, mitigation_reason, ua, ja3, bytes, threat_score,
          file_id, ingested_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const batchStmts = [];
      for (const event of batch) {
        batchStmts.push(stmt.bind(
          event.ray_id,
          event.event_ts,
          event.src_ip || null,
          event.src_country || null,
          event.src_asn || null,
          event.colo || null,
          event.host || null,
          event.path || null,
          event.method || null,
          event.status || null,
          event.rule_id || null,
          event.rule_name || null,
          event.rule_type || 'unknown',
          event.action || 'unknown',
          event.service || null,
          event.mitigation_reason || null,
          event.ua || null,
          event.ja3 || null,
          event.bytes || null,
          event.threat_score || null,
          fileInfo.id,
          Date.now()
        ));
      }

      const results = await env.DB.batch(batchStmts);
      
      for (const result of results) {
        if (result.meta.changes > 0) {
          totalInserted++;
        } else {
          totalDeduped++;
        }
      }
    }

    // Update upload stats
    await env.DB.prepare(
      'UPDATE uploads SET total_records = ?, inserted_records = ?, deduped_records = ? WHERE id = ?'
    ).bind(events.length, totalInserted, totalDeduped, fileInfo.id).run();

    return new Response(
      JSON.stringify({
        success: true,
        file_id: fileInfo.id,
        filename: fileInfo.filename,
        total_events: events.length,
        inserted: totalInserted,
        deduped: totalDeduped,
        errors: errors.slice(0, 10),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Reindex error:', error);
    return new Response(
      JSON.stringify({ error: 'Reindex failed', message: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
