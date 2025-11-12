// Simple health check endpoint for Dapr health probes
// Returns basic application health status

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/health
 * Simple health check endpoint for Dapr probes
 */
export const GET: RequestHandler = async () => {
  try {
    // Basic health checks
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ex-accell-ui',
      uptime: process.uptime(),
      version: '1.0.0'
    };

    return json(health, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    return json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'ex-accell-ui',
      error: error instanceof Error ? error.message : String(error)
    }, {
      status: 503
    });
  }
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