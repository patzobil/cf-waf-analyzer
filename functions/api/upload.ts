import { Env, WAFEvent, RawWAFRecord } from '../../lib/types';
import { parseWAFRecord, computeChecksum } from '../../lib/parser';

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  const maxFileSize = parseInt(env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024;
  const batchSize = parseInt(env.MAX_BATCH_SIZE || '1000');
  
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (files.length === 0) {
      return new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = [];
    
    for (const file of files) {
      if (file.size > maxFileSize) {
        results.push({
          filename: file.name,
          error: `File size ${file.size} exceeds maximum ${maxFileSize} bytes`,
        });
        continue;
      }

      try {
        const result = await processFile(file, env, batchSize);
        results.push(result);
      } catch (error) {
        results.push({
          filename: file.name,
          error: error instanceof Error ? error.message : 'Processing failed',
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ error: 'Upload failed', message: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function processFile(file: File, env: Env, batchSize: number) {
  const content = await file.text();
  const checksum = await computeChecksum(content);
  
  // Check if file already uploaded
  const existingUpload = await env.DB.prepare(
    'SELECT id, inserted_records, deduped_records, total_records FROM uploads WHERE checksum = ?'
  ).bind(checksum).first<{ id: number; inserted_records: number; deduped_records: number; total_records: number }>();
  
  if (existingUpload) {
    // If file was previously uploaded but has 0 inserted records, allow reprocessing
    // This handles cases where parsing failed or format wasn't recognized
    const insertedCount = existingUpload.inserted_records || 0;
    if (insertedCount === 0) {
      console.log(`File ${file.name} was previously uploaded but has 0 inserted records. Reprocessing...`);
      // Delete the old upload record and continue to reprocess
      await env.DB.prepare('DELETE FROM uploads WHERE id = ?').bind(existingUpload.id).run();
    } else {
      return {
        filename: file.name,
        checksum,
        status: 'already_processed',
        file_id: existingUpload.id,
        inserted: insertedCount,
        deduped: existingUpload.deduped_records || 0,
        total: existingUpload.total_records || 0,
        note: 'File was already processed. Use /api/reindex to reprocess.',
      };
    }
  }

  // Store file metadata
  const uploadResult = await env.DB.prepare(
    'INSERT INTO uploads (filename, checksum, size, uploaded_at) VALUES (?, ?, ?, ?)'
  ).bind(file.name, checksum, file.size, Date.now()).run();
  
  const fileId = uploadResult.meta.last_row_id;
  
  // Optionally store raw file in R2
  if (env.R2 && env.ENABLE_R2_STORAGE === 'true') {
    const r2Key = `uploads/${checksum}`;
    await env.R2.put(r2Key, file.stream());
    await env.DB.prepare('UPDATE uploads SET raw_r2_key = ? WHERE id = ?')
      .bind(r2Key, fileId).run();
  }

  // Parse and ingest events
  const { events, errors } = parseContent(content);
  
  console.log(`Parsed ${events.length} events from ${file.name}, ${errors.length} errors`);
  if (events.length > 0) {
    console.log(`Sample event:`, JSON.stringify(events[0], null, 2));
  }
  
  if (events.length === 0) {
    await env.DB.prepare('UPDATE uploads SET total_records = 0 WHERE id = ?')
      .bind(fileId).run();
    return {
      filename: file.name,
      checksum,
      file_id: fileId,
      status: 'no_valid_events',
      errors: errors.slice(0, 10),
      parse_errors: errors.length,
    };
  }

  // Batch insert events
  let totalInserted = 0;
  let totalDeduped = 0;
  
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const { inserted, deduped } = await insertEventBatch(batch, fileId, env);
    totalInserted += inserted;
    totalDeduped += deduped;
  }

  console.log(`Inserted ${totalInserted} events, ${totalDeduped} deduped from ${file.name}`);

  // Update upload stats
  await env.DB.prepare(
    'UPDATE uploads SET total_records = ?, inserted_records = ?, deduped_records = ? WHERE id = ?'
  ).bind(events.length, totalInserted, totalDeduped, fileId).run();

  // Update analytics tables
  await updateAnalyticsTables(fileId, env);

  // Get time range of inserted events for user feedback
  const timeRange = events.length > 0 ? {
    earliest: Math.min(...events.map(e => e.event_ts)),
    latest: Math.max(...events.map(e => e.event_ts)),
  } : null;

  return {
    filename: file.name,
    checksum,
    file_id: fileId,
    status: 'success',
    total: events.length,
    inserted: totalInserted,
    deduped: totalDeduped,
    errors: errors.slice(0, 10),
    time_range: timeRange ? {
      earliest: new Date(timeRange.earliest).toISOString(),
      latest: new Date(timeRange.latest).toISOString(),
    } : null,
    note: timeRange && timeRange.earliest < Date.now() - 24 * 60 * 60 * 1000
      ? 'Events are outside the default 24-hour dashboard view. Adjust the date range to see them.'
      : undefined,
  };
}

function parseContent(content: string): { events: WAFEvent[]; errors: string[] } {
  const events: WAFEvent[] = [];
  const errors: string[] = [];
  
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
      return { events, errors };
    }
  } catch {
    // Not a JSON array, try NDJSON
  }

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

  return { events, errors };
}

async function insertEventBatch(events: WAFEvent[], fileId: number, env: Env) {
  let inserted = 0;
  let deduped = 0;
  
  const stmt = env.DB.prepare(`
    INSERT OR IGNORE INTO waf_events (
      ray_id, event_ts, src_ip, src_country, src_asn, colo,
      host, path, method, status, rule_id, rule_name, rule_type,
      action, service, mitigation_reason, ua, ja3, bytes, threat_score,
      file_id, ingested_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const batch = [];
  for (const event of events) {
    batch.push(stmt.bind(
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
      fileId,
      Date.now()
    ));
  }

  const results = await env.DB.batch(batch);
  
  for (const result of results) {
    if (result.meta.changes > 0) {
      inserted++;
    } else {
      deduped++;
    }
  }

  return { inserted, deduped };
}

async function updateAnalyticsTables(fileId: number, env: Env) {
  // Update daily actions
  await env.DB.prepare(`
    INSERT INTO daily_actions (date, action, count)
    SELECT 
      date(event_ts / 1000, 'unixepoch') as date,
      action,
      COUNT(*) as count
    FROM waf_events
    WHERE file_id = ?
    GROUP BY date, action
    ON CONFLICT(date, action) DO UPDATE SET
      count = daily_actions.count + excluded.count,
      last_updated = strftime('%s', 'now') * 1000
  `).bind(fileId).run();

  // Update top rules
  await env.DB.prepare(`
    INSERT INTO top_rules (rule_id, rule_name, rule_type, count, last_seen)
    SELECT 
      rule_id,
      MAX(rule_name) as rule_name,
      MAX(rule_type) as rule_type,
      COUNT(*) as count,
      MAX(event_ts) as last_seen
    FROM waf_events
    WHERE file_id = ? AND rule_id IS NOT NULL
    GROUP BY rule_id
    ON CONFLICT(rule_id) DO UPDATE SET
      count = count + excluded.count,
      last_seen = MAX(last_seen, excluded.last_seen),
      last_updated = strftime('%s', 'now') * 1000
  `).bind(fileId).run();

  // Update top IPs
  await env.DB.prepare(`
    INSERT INTO top_ips (src_ip, count, countries, asns, last_seen)
    SELECT 
      src_ip,
      COUNT(*) as count,
      json_group_array(DISTINCT src_country) as countries,
      json_group_array(DISTINCT src_asn) as asns,
      MAX(event_ts) as last_seen
    FROM waf_events
    WHERE file_id = ? AND src_ip IS NOT NULL
    GROUP BY src_ip
    ON CONFLICT(src_ip) DO UPDATE SET
      count = count + excluded.count,
      last_seen = MAX(last_seen, excluded.last_seen),
      last_updated = strftime('%s', 'now') * 1000
  `).bind(fileId).run();

  // Update attack paths
  await env.DB.prepare(`
    INSERT INTO attack_paths (path_hash, path, method, status, count, last_seen)
    SELECT 
      lower(hex(randomblob(16))) as path_hash,
      path,
      method,
      status,
      COUNT(*) as count,
      MAX(event_ts) as last_seen
    FROM waf_events
    WHERE file_id = ? AND path IS NOT NULL
    GROUP BY path, method, status
    ON CONFLICT(path_hash) DO UPDATE SET
      count = count + excluded.count,
      last_seen = MAX(last_seen, excluded.last_seen),
      last_updated = strftime('%s', 'now') * 1000
  `).bind(fileId).run();
}
