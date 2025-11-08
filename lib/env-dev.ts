// Mock environment for local development
// In production, this will be provided by Cloudflare Workers

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

export async function getDevEnv() {
  // For local development, we'll need to use wrangler's local D1
  // This is a placeholder - in practice, you'd connect to local D1 via wrangler
  return {
    DB: null as unknown as D1Database, // Will be set up via wrangler in cf:dev
    R2: null as unknown as R2Bucket,
    AUTH_TOKEN: process.env.AUTH_TOKEN || 'dev_token_123',
    ENABLE_R2_STORAGE: process.env.ENABLE_R2_STORAGE || 'false',
    MAX_BATCH_SIZE: process.env.MAX_BATCH_SIZE || '1000',
    MAX_FILE_SIZE_MB: process.env.MAX_FILE_SIZE_MB || '50',
  };
}

// Note: For full local development with D1, use `npm run cf:dev` instead
// This file is a placeholder for when we implement full Next.js API routes
