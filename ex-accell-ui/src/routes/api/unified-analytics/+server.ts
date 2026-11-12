// Unified Analytics API
// PostgreSQL with pg_duckdb extension for unified database queries.
// This file only validates the request and dispatches on `type`; each handler lives in
// src/lib/server/analytics/ (see registry.ts).

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateDateParams } from '$lib/server/dateBounds';
import { queryErrorResponse } from '$lib/server/queryErrors';
import { resolveWorkspaceScope } from '$lib/services/workspaceContextResolver';
import { findAnalyticsHandler } from '$lib/server/analytics/registry';
import { unsupportedTypeResponse } from '$lib/server/analytics/unsupported';

/** Social-media types that answer an empty list when the platform filter is explicitly emptied. */
const SOCIAL_ENDPOINTS = ['cross-platform-sentiment', 'sentiment-trends', 'sample-posts',
  'platform-performance', 'hourly-patterns', 'topics-overview', 'topic-keywords',
  'topic-trends', 'topic-relationships', 'topic-categories', 'language-stats',
  'language-trends', 'language-detection-detail', 'emotion-stats', 'emotion-correlations',
  'sentiment-keywords', 'top-keywords', 'export-data', 'hashtag-analysis'];

/**
 * GET /api/unified-analytics?type=...
 * Test connection and queries for unified analytics
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const type = url.searchParams.get('type');

    // A bad or reversed date range is the caller's mistake, whatever the endpoint: answer 400, not a database error
    const dateProblem = validateDateParams(url.searchParams);
    if (dateProblem) return json({ success: false, error: dateProblem }, { status: 400 });

    // Resolve workspace scope for dataset-scoped analytics
    const resolved = await resolveWorkspaceScope(url);
    // A requested workspace that does not exist must never fall through to unscoped data
    if (resolved.kind === 'missing') return json({ success: false, data: null, error: 'Workspace not found' }, { status: 404 });
    const scope = resolved.kind === 'scoped' ? resolved.scope : null;

    // Global filter: if platforms param is explicitly empty, return empty for all social endpoints
    const platformsParam = url.searchParams.get('platforms');
    if (platformsParam !== null && platformsParam.split(',').filter(p => p.trim()).length === 0) {
      if (type !== null && SOCIAL_ENDPOINTS.includes(type)) {
        return json({ success: true, data: [] });
      }
    }

    const handler = type === null ? undefined : findAnalyticsHandler(type);
    if (type === null || !handler) return unsupportedTypeResponse(type);

    // await, so a throw inside a handler reaches the catch below
    return await handler({ url, scope, type });
  } catch (err) {
    return queryErrorResponse('Unified analytics request', err, []);
  }
};
