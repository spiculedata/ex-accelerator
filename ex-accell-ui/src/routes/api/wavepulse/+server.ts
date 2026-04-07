// WavePulse Radio Service Proxy API
// Forwards requests to the WavePulse Docker service

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const WAVEPULSE_URL = process.env.WAVEPULSE_URL || 'http://wavepulse:8890';

async function proxyToWavePulse(path: string, method: string = 'GET', body?: any): Promise<any> {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${WAVEPULSE_URL}${path}`, options);
    return await response.json();
  } catch (error: any) {
    return { error: `WavePulse service unavailable: ${error.message}`, status: 'offline' };
  }
}

/**
 * GET /api/wavepulse — get status, recordings, or transcripts
 */
export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action') || 'status';

  if (action === 'status') {
    const result = await proxyToWavePulse('/status');
    return json({ success: !result.error, ...result });
  }

  if (action === 'recordings') {
    const result = await proxyToWavePulse('/recordings');
    return json({ success: !result.error, ...result });
  }

  if (action === 'transcripts') {
    const result = await proxyToWavePulse('/transcripts');
    return json({ success: !result.error, ...result });
  }

  if (action === 'health') {
    const result = await proxyToWavePulse('/health');
    return json({ success: !result.error, ...result });
  }

  return json({ error: `Unknown action: ${action}` }, { status: 400 });
};

/**
 * POST /api/wavepulse — start or stop WavePulse
 */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const action = body.action;

  if (action === 'start') {
    const result = await proxyToWavePulse('/start', 'POST', body.config || {});
    return json({ success: !result.error, ...result });
  }

  if (action === 'stop') {
    const result = await proxyToWavePulse('/stop', 'POST');
    return json({ success: !result.error, ...result });
  }

  return json({ error: `Unknown action: ${action}` }, { status: 400 });
};
