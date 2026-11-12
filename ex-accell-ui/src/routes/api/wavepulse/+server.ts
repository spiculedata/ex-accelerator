// WavePulse Radio Service Proxy API
// Forwards requests to the WavePulse Docker service

import type { RequestHandler } from './$types';
import { apiFail, apiOk, readJsonObject } from '$lib/server/apiResponse';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('wavepulse-api');

const WAVEPULSE_URL = process.env.WAVEPULSE_URL || 'http://wavepulse:8890';
const MAX_BODY_BYTES = 64 * 1024;
const GET_PATHS: Record<string, string> = {
  status: '/status',
  recordings: '/recordings',
  transcripts: '/transcripts',
  health: '/health'
};

/** Calls WavePulse and returns its JSON object, or the envelope failure to send. */
async function proxyToWavePulse(path: string, method = 'GET', body?: unknown): Promise<{ payload: Record<string, unknown> } | { failure: Response }> {
  try {
    const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${WAVEPULSE_URL}${path}`, options);
    const result = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('WavePulse answered with something other than an object');

    const { success: _success, data: _data, error, ...rest } = result as Record<string, unknown>;
    if (error) {
      log.warn(`${method} ${path}: WavePulse reported an error`, { detail: String(error) });
      return { failure: apiFail('WavePulse reported an error', 502) };
    }
    return { payload: rest };
  } catch (err) {
    log.warn(`${method} ${path}: WavePulse unreachable`, { detail: err instanceof Error ? err.message : String(err) });
    return { failure: apiFail('WavePulse service unavailable', 503) };
  }
}

const respond = (result: Awaited<ReturnType<typeof proxyToWavePulse>>) =>
  'failure' in result ? result.failure : apiOk(result.payload, result.payload);

/**
 * GET /api/wavepulse — get status, recordings, or transcripts
 */
export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action') || 'status';
  const path = Object.hasOwn(GET_PATHS, action) ? GET_PATHS[action] : undefined;
  if (!path) return apiFail('Unknown action', 400);

  return respond(await proxyToWavePulse(path));
};

/**
 * POST /api/wavepulse — start or stop WavePulse
 */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = await readJsonObject(request, MAX_BODY_BYTES);
  if ('failure' in parsed) return parsed.failure;
  const { action, config } = parsed.body;

  if (action === 'start') return respond(await proxyToWavePulse('/start', 'POST', config || {}));
  if (action === 'stop') return respond(await proxyToWavePulse('/stop', 'POST'));
  return apiFail('Unknown action', 400);
};
