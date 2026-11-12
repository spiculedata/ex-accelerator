import { json } from '@sveltejs/kit';
import { createLogger } from '$lib/utils/logger';
import { BodyTooLargeError, readJsonLimited } from '$lib/server/requestBody';

const log = createLogger('api');

/**
 * Helpers for the API envelope `{ success, data, error }`.
 *
 * Older UI code reads top-level keys (`workflows`, `execution`, ...). `apiOk` keeps those as `legacy`
 * beside `data` so a route can adopt the envelope without breaking its callers.
 */

/** Success: `{ success: true, data, ...legacy }`. */
export function apiOk(data: unknown, legacy: Record<string, unknown> = {}, init?: ResponseInit): Response {
  return json({ success: true, ...legacy, data }, init);
}

/** Failure the caller can act on (validation, not found, forbidden): `{ success: false, data: null, error }`. */
export function apiFail(message: string, status: number): Response {
  return json({ success: false, data: null, error: message }, { status });
}

/** Unexpected failure: the detail is logged here and the client gets only `message` with a 500. */
export function apiServerError(label: string, err: unknown, message: string): Response {
  log.error(`${label} failed`, { detail: err instanceof Error ? err.message : String(err) });
  return apiFail(message, 500);
}

export type JsonObjectResult = { body: Record<string, unknown> } | { failure: Response };

/** Reads a JSON object body. A bad, oversized or non-object body comes back as a ready 4xx `failure`. */
export async function readJsonObject(request: Request, maxBytes: number): Promise<JsonObjectResult> {
  let body: unknown;
  try {
    body = await readJsonLimited(request, maxBytes);
  } catch (err) {
    if (err instanceof BodyTooLargeError) return { failure: apiFail(err.message, 413) };
    return { failure: apiFail('Send a JSON body', 400) };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { failure: apiFail('Send a JSON object', 400) };
  return { body: body as Record<string, unknown> };
}
