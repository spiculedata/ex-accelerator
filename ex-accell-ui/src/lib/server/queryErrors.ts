import { json } from '@sveltejs/kit';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('analytics-api');

const UNDEFINED_TABLE_CODE = '42P01';
const MISSING_TABLE_MESSAGE = /relation ".+" does not exist|Catalog Error: Table with name .+ does not exist/i;

/**
 * True when the failure means a table/view is not provisioned (an optional analytics
 * module that has no data yet), as opposed to a real fault such as a bad query or outage.
 */
export function isMissingRelationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const { code } = error as Error & { code?: unknown };
  return code === UNDEFINED_TABLE_CODE || MISSING_TABLE_MESSAGE.test(error.message);
}

/**
 * Maps a failed analytics query to a response.
 * - Missing table: 200 with the caller's empty shape, flagged `meta.unavailable`.
 * - Anything else: 500 with a generic message. Detail is logged, never sent to the client.
 */
export function queryErrorResponse(label: string, error: unknown, emptyData: unknown): Response {
  const detail = error instanceof Error ? error.message : String(error);

  if (isMissingRelationError(error)) {
    log.warn(`${label}: data source not provisioned`, { detail });
    return json({ success: true, data: emptyData, meta: { unavailable: true } });
  }

  log.error(`${label} failed`, { detail });
  return json({ success: false, data: null, error: 'Query failed' }, { status: 500 });
}
