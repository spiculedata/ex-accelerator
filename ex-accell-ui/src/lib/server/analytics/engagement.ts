import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { ENGAGEMENT_TRENDS_DAYS, engagementQueries } from '$lib/server/engagementQueries';
import { hasNoSocialData } from '$lib/server/languageQueries';
import { queryErrorResponse } from '$lib/server/queryErrors';
import { parseDateWindow, windowConditions } from '$lib/server/dateWindow';
import type { AnalyticsContext, AnalyticsHandler } from './types';

const ENGAGEMENT_TYPES = ['engagement-stats', 'engagement-platforms', 'engagement-content-types', 'engagement-trends', 'engagement-top-posts', 'engagement-timing'];

export async function engagementAnalytics({ url, scope, type }: AnalyticsContext): Promise<Response> {
  const parsed = parseDateWindow(url.searchParams);
  if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
  // Only known engagement queries: an unknown type is still a 400 below
  if (ENGAGEMENT_TYPES.includes(type) && hasNoSocialData(scope)) return json({ success: true, data: [] });
  try {
    let platforms: string[] = [];
    if (scope?.hasSocialMedia && scope.socialPlatforms.length > 0) platforms = scope.socialPlatforms;
    const filter = platforms.length > 0;
    const params: any[] = filter ? [platforms] : [];
    const dated = windowConditions('p.created_at', parsed.window, params.length + 1);
    params.push(...dated.params);
    const dateConditions = dated.conditions;
    const limitParam = `$${params.length + 1}`;
    const days = ENGAGEMENT_TRENDS_DAYS[url.searchParams.get('timeRange') || '7d'] ?? 7;
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10') || 10, 1), 100);

    const queries: Record<string, { sql: string; extra?: any[] }> = {
      'engagement-stats': { sql: engagementQueries.stats(filter, dateConditions) },
      'engagement-platforms': { sql: engagementQueries.platforms(filter, dateConditions) },
      'engagement-content-types': { sql: engagementQueries.contentTypes(filter, dateConditions) },
      'engagement-trends': { sql: engagementQueries.trends(filter, days, dateConditions) },
      'engagement-top-posts': { sql: engagementQueries.topPosts(filter, limitParam, dateConditions), extra: [limit] },
      'engagement-timing': { sql: engagementQueries.timing(filter, dateConditions) }
    };
    const query = queries[type];
    if (!query) return json({ success: false, error: `Unknown engagement query: ${type}` }, { status: 400 });

    const data = await executeQuery(query.sql, [...params, ...(query.extra ?? [])]);
    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('Engagement analysis', error, []);
  }
}

export const engagementHandlers: Record<string, AnalyticsHandler> = {
  'engagement-stats': engagementAnalytics,
  'engagement-platforms': engagementAnalytics,
  'engagement-content-types': engagementAnalytics,
  'engagement-trends': engagementAnalytics,
  'engagement-top-posts': engagementAnalytics,
  'engagement-timing': engagementAnalytics
};
