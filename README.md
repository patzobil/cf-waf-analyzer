# WAF Analytics - Cloudflare Workers Application

A production-ready Cloudflare Workers web application for ingesting and analyzing Cloudflare WAF export JSON files. Features real-time analytics, data visualization, and persistent storage using Cloudflare D1.

## Features

- **File Ingestion**: Drag-and-drop upload for WAF export JSON/NDJSON files (up to 50MB)
- **Real-time Analytics**: Dashboard with KPIs, time series charts, and geographic distribution
- **Data Exploration**: Searchable, filterable table with pagination for browsing events
- **Persistent Storage**: Normalized data storage in Cloudflare D1 with deduplication
- **Performance Optimized**: Stream parsing, batch inserts, and indexed queries
- **Modern UI**: React + Tailwind CSS + ShadCN components with dark mode support

## Architecture

- **Runtime**: Cloudflare Workers/Pages Functions
- **Database**: Cloudflare D1 (SQLite)
- **Object Storage**: R2 (optional, for raw file storage)
- **Frontend**: Next.js + React + TypeScript
- **UI Components**: ShadCN UI + Tailwind CSS
- **Charts**: Recharts

## Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository>
cd waf-analytics
npm install
```

### 2. Create Cloudflare D1 Database

```bash
# Create the D1 database
wrangler d1 create waf-analytics-db

# Note the database_id from the output and update wrangler.toml
```

### 3. Update Configuration

Edit `wrangler.toml` and replace the placeholder values:

```toml
[[d1_databases]]
binding = "DB"
database_name = "waf-analytics-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID

[vars]
AUTH_TOKEN = "YOUR_SECRET_TOKEN_HERE"  # Replace with a secure token
```

### 4. Apply Database Migrations

```bash
# Apply migrations to local D1
npm run db:migrate

# For production
npm run db:migrate:prod
```

**Note:** If you encounter schema conflicts after updating migrations, you can reset your local database:

```bash
# Reset local database and reapply migrations
npm run db:reset
```

### 5. (Optional) Seed Test Data

```bash
npm run db:seed
```

**Note:** The seed file is located in `scripts/seed.sql` (not in migrations). If you get a UNIQUE constraint error when seeding, the data may already exist. You can reset the database first using `npm run db:reset` and then run the seed again.

### 6. Run Development Server

There are two development modes:

**Option A: Full Stack Development (Recommended)**
```bash
# Builds the app and runs with Cloudflare Pages Functions
# This provides access to D1, R2, and all API routes
npm run cf:dev
```

**If the build seems stuck**, try building and serving separately:
```bash
# Step 1: Build the app (this may take 30-60 seconds)
npm run cf:build

# Step 2: Once build completes, serve it
npm run cf:serve
```

This will:
- Build the Next.js app to static files (first time may take 30-60 seconds)
- Run wrangler pages dev with D1 and R2 bindings
- Make all API routes functional
- Available at `http://localhost:8788` (or the port wrangler assigns)

**Note:** The first build can take a while as Next.js optimizes assets and downloads fonts. Subsequent builds are faster.

**Option B: Frontend-Only Development**
```bash
# Runs Next.js dev server (fast refresh, no build step)
# API routes will return 503 errors - use this for UI development only
npm run dev
```
This will:
- Start Next.js dev server with hot reload
- Fast development iteration for UI components
- API routes are not functional (they require Cloudflare bindings)
- Available at `http://localhost:3000` (or next available port)

**Note:** For full functionality including database operations, always use `npm run cf:dev`.

### 7. Deploy to Production

```bash
# Build and deploy to Cloudflare Pages
npm run cf:deploy
```

## Environment Variables

Configure these in `wrangler.toml`:

- `AUTH_TOKEN`: Bearer token for API authentication
- `ENABLE_R2_STORAGE`: Enable R2 storage for raw files (true/false)
- `MAX_BATCH_SIZE`: Maximum batch size for DB inserts (default: 1000)
- `MAX_FILE_SIZE_MB`: Maximum file upload size in MB (default: 50)

## API Endpoints

All API endpoints are available at `/api/*`:

### Upload
- `POST /api/upload` - Upload WAF export files
  - Accepts multipart/form-data with JSON/NDJSON files
  - Returns processing statistics

### Query
- `GET /api/events` - Query WAF events with filters
  - Query params: `start_time`, `end_time`, `action`, `rule_id`, `host`, `search`, `limit`, `offset`
  
- `GET /api/summary` - Get dashboard summary statistics
  - Query params: `start_time`, `end_time`
  
- `GET /api/trends` - Get time series data
  - Query params: `start_time`, `end_time`, `bucket` (minute/hour/day)

### Analytics
- `GET /api/rules/top` - Get top triggered rules
- `GET /api/ips/top` - Get top source IPs
- `GET /api/paths/top` - Get most attacked paths

### Admin
- `POST /api/reindex` - Reprocess a file from R2 storage
  - Requires authentication
  - Body: `{ checksum: string }` or `{ file_id: number }`

## Data Schema

### WAF Events Table
- Stores normalized WAF events with fields:
  - Event identifiers: `ray_id`, `event_ts`
  - Source info: `src_ip`, `src_country`, `src_asn`, `colo`
  - Request details: `host`, `path`, `method`, `status`
  - WAF details: `rule_id`, `rule_name`, `action`, `service`
  - Additional: `ua`, `ja3`, `bytes`, `threat_score`

### Analytics Tables
- `daily_actions`: Aggregated actions by day
- `top_rules`: Most triggered rules with counts
- `top_ips`: Top source IPs with geographic info
- `attack_paths`: Most targeted paths

## File Format Support

The application supports two WAF export formats:

1. **JSON Array**: Standard JSON array of event objects
```json
[
  { "RayID": "...", "EdgeStartTimestamp": "...", ... },
  { "RayID": "...", "EdgeStartTimestamp": "...", ... }
]
```

2. **NDJSON**: Newline-delimited JSON (one object per line)
```
{"RayID": "...", "EdgeStartTimestamp": "...", ...}
{"RayID": "...", "EdgeStartTimestamp": "...", ...}
```

## Field Mapping

The parser automatically maps common field variations:
- Ray ID: `RayID`, `rayId`, `ray_id`
- Timestamp: `EdgeStartTimestamp`, `timestamp`, `event_timestamp`
- Client IP: `ClientIP`, `client_ip`, `source_ip`
- And more...

## Authentication

The application uses bearer token authentication for protected endpoints:

```javascript
// Set token in localStorage
localStorage.setItem('auth_token', 'YOUR_TOKEN');

// API calls will automatically include the token
Authorization: Bearer YOUR_TOKEN
```

## Performance Considerations

- **Streaming Parser**: Handles large files without memory issues
- **Batch Inserts**: Groups database operations for efficiency
- **Deduplication**: Prevents duplicate events via unique constraints
- **Indexed Queries**: Optimized database indexes for common queries
- **Pagination**: Server-side pagination for large result sets

## Development

### Project Structure
```
├── app/                  # Next.js pages
├── components/          # React components
│   ├── ui/             # ShadCN UI components
│   └── layout/         # Layout components
├── functions/          # Cloudflare Workers functions
│   └── api/           # API route handlers
├── lib/               # Shared utilities
├── migrations/        # D1 database migrations
└── public/           # Static assets
```

### Local Development
```bash
# Run Next.js dev server
npm run dev

# Run with Cloudflare bindings
npm run cf:dev

# Run linter
npm run lint

# Build for production
npm run build
```

### Testing with Sample Data

Create a sample WAF export file:
```json
[
  {
    "RayID": "test_ray_001",
    "EdgeStartTimestamp": "2024-01-01T00:00:00Z",
    "ClientIP": "192.168.1.1",
    "ClientCountry": "US",
    "ClientRequestHost": "example.com",
    "ClientRequestPath": "/api/test",
    "ClientRequestMethod": "POST",
    "EdgeResponseStatus": 403,
    "FirewallMatchesActions": ["block"],
    "FirewallMatchesRuleIDs": ["rule_001"],
    "WAFRuleMessage": "SQL Injection Detected"
  }
]
```

## Troubleshooting

### Database Connection Issues
- Ensure D1 database is created and ID is correctly set in `wrangler.toml`
- Check migrations have been applied: `npm run db:migrate`

### Upload Failures
- Verify file size is under 50MB limit
- Check file format is valid JSON/NDJSON
- Ensure AUTH_TOKEN is set for protected endpoints

### Performance Issues
- Increase `MAX_BATCH_SIZE` for faster bulk inserts
- Enable R2 storage to offload raw files
- Use time-based filters to limit query scope

## Security Considerations

- Always use HTTPS in production
- Rotate AUTH_TOKEN regularly
- Consider implementing Cloudflare Access for additional security
- Sanitize user inputs and implement rate limiting
- Hash or redact PII in accordance with privacy policies

## License

MIT

## Support

For issues, questions, or contributions, please open an issue on GitHub.