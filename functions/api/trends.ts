import { Env, TimeSeriesData } from '../../lib/types';

export async function handleTrends(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const startTime = url.searchParams.get('start_time') ? 
    parseInt(url.searchParams.get('start_time')!) : 
    Date.now() - 7 * 24 * 60 * 60 * 1000; // Default to last 7 days
  const endTime = url.searchParams.get('end_time') ? 
    parseInt(url.searchParams.get('end_time')!) : 
    Date.now();
  const bucket = url.searchParams.get('bucket') || 'hour'; // minute, hour, day

  try {
    // Determine bucket size in milliseconds
    let bucketSize: number;
    switch (bucket) {
      case 'minute':
        bucketSize = 60 * 1000;
        break;
      case 'hour':
        bucketSize = 60 * 60 * 1000;
        break;
      case 'day':
        bucketSize = 24 * 60 * 60 * 1000;
        break;
      default:
        bucketSize = 60 * 60 * 1000; // Default to hour
    }

    // Get time series data
    const result = await env.DB.prepare(`
      SELECT 
        (event_ts / ?) * ? as timestamp,
        action,
        COUNT(*) as count
      FROM waf_events
      WHERE event_ts >= ? AND event_ts <= ?
      GROUP BY timestamp, action
      ORDER BY timestamp
    `).bind(bucketSize, bucketSize, startTime, endTime)
      .all<{ timestamp: number; action: string; count: number }>();

    // Process results into time series format
    const timeSeriesMap = new Map<number, TimeSeriesData>();
    
    for (const row of result.results || []) {
      if (!timeSeriesMap.has(row.timestamp)) {
        timeSeriesMap.set(row.timestamp, {
          timestamp: row.timestamp,
          total: 0,
        });
      }
      
      const data = timeSeriesMap.get(row.timestamp)!;
      data[row.action as keyof TimeSeriesData] = row.count;
      data.total += row.count;
    }

    // Fill in missing time buckets with zeros
    const filledSeries: TimeSeriesData[] = [];
    for (let ts = startTime; ts <= endTime; ts += bucketSize) {
      const bucketTs = Math.floor(ts / bucketSize) * bucketSize;
      if (timeSeriesMap.has(bucketTs)) {
        filledSeries.push(timeSeriesMap.get(bucketTs)!);
      } else {
        filledSeries.push({
          timestamp: bucketTs,
          total: 0,
          block: 0,
          challenge: 0,
          log: 0,
          allow: 0,
          skip: 0,
        });
      }
    }

    // Remove duplicates and sort
    const uniqueSeries = Array.from(
      new Map(filledSeries.map(item => [item.timestamp, item])).values()
    ).sort((a, b) => a.timestamp - b.timestamp);

    return new Response(
      JSON.stringify({
        bucket,
        bucket_size: bucketSize,
        start_time: startTime,
        end_time: endTime,
        data: uniqueSeries,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Trends error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get trends', message: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
