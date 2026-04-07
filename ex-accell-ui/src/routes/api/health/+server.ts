// Health check endpoint with real dependency checks
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';

export const GET: RequestHandler = async () => {
  const checks: Record<string, { status: string; detail?: string }> = {};
  let overall = 'healthy';

  // Check PostgreSQL
  try {
    const isHealthy = await postgresPool.healthCheck();
    if (isHealthy) {
      checks.postgres = { status: 'healthy' };
    } else {
      checks.postgres = { status: 'unhealthy', detail: 'Connection test failed' };
      overall = 'degraded';
    }
  } catch (err: any) {
    checks.postgres = { status: 'unhealthy', detail: err.message };
    overall = 'degraded';
  }

  // Check table counts (lightweight query)
  try {
    const rows = await postgresPool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM pg_stat_user_tables"
    );
    checks.tables = { status: 'healthy', detail: `${rows[0]?.count || 0} tables` };
  } catch {
    checks.tables = { status: 'unknown', detail: 'Could not query table count' };
  }

  const health = {
    status: overall,
    timestamp: new Date().toISOString(),
    service: 'ex-accell-ui',
    uptime: process.uptime(),
    checks
  };

  return json(health, {
    status: overall === 'healthy' ? 200 : 503,
    headers: { 'Cache-Control': 'no-cache' }
  });
};

/**
 * HEAD /api/health
 * Minimal health check for simple probes
 */
export const HEAD: RequestHandler = async () => {
  try {
    return new Response(null, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    return new Response(null, {
      status: 503
    });
  }
};