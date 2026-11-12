import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { TRIGRAM_DEFAULT_DAYS, TRIGRAM_MAX_POSTS, TRIGRAM_TIME_RANGE_DAYS, trigramPostsQuery } from '$lib/server/trigramQueries';
import { computeTrigrams, trendWindow } from '$lib/server/trigrams';
import { hasNoSocialData } from '$lib/server/languageQueries';
import { queryErrorResponse } from '$lib/server/queryErrors';
import { parseDateWindow, windowConditions } from '$lib/server/dateWindow';
import type { AnalyticsContext, AnalyticsHandler } from './types';

interface TrigramPostRow {
  id: number | string;
  text: string | null;
  platform: string;
  created_at: string | Date;
  sentiment_category: string | null;
  engagement_rate: string | number | null;
}

async function trigrams({ url, scope }: AnalyticsContext): Promise<Response> {
  const parsed = parseDateWindow(url.searchParams);
  if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
  if (hasNoSocialData(scope)) return json({ success: true, data: [] });
  try {
    const intParam = (name: string, fallback: number, min: number, max: number): number => {
      const parsed = parseInt(url.searchParams.get(name) || '');
      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
    };
    const sentimentParam = (name: string, fallback: number): number => {
      const parsed = parseFloat(url.searchParams.get(name) || '');
      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, -1), 1) : fallback;
    };

    const days = TRIGRAM_TIME_RANGE_DAYS[url.searchParams.get('timeRange') || ''] ?? TRIGRAM_DEFAULT_DAYS;
    const platform = url.searchParams.get('platform');
    const filterByPlatform = !!platform && platform !== 'all';
    const workspacePlatforms = scope?.hasSocialMedia && scope.socialPlatforms.length > 0 ? scope.socialPlatforms : [];

    const params: any[] = [];
    if (workspacePlatforms.length > 0) params.push(workspacePlatforms);
    if (filterByPlatform) params.push(platform);
    const dated = windowConditions('p.created_at', parsed.window, params.length + 1);
    params.push(...dated.params);

    const rows: TrigramPostRow[] = await executeQuery(
      trigramPostsQuery({ workspacePlatforms: workspacePlatforms.length > 0, platform: filterByPlatform }, days, dated.conditions),
      params
    );
    const posts = rows.map((row) => ({
      id: row.id,
      text: String(row.text ?? ''),
      platform: String(row.platform),
      createdAt: new Date(row.created_at),
      sentiment: row.sentiment_category ?? null,
      engagementRate: Number(row.engagement_rate) || 0
    }));

    // When the scan hit its cap, the oldest posts were dropped: measure trends from the oldest one kept
    const now = new Date();
    const truncated = rows.length >= TRIGRAM_MAX_POSTS;
    const oldestKept = posts.reduce((oldest, p) => Math.min(oldest, p.createdAt.getTime()), now.getTime());
    const trendPeriod = trendWindow(parsed.window, days, now, oldestKept, truncated);

    const data = computeTrigrams(posts, {
      now: trendPeriod.end,
      windowStart: trendPeriod.start,
      minFrequency: intParam('minFrequency', 1, 1, 1000),
      maxResults: intParam('maxResults', 100, 1, 500),
      search: url.searchParams.get('search') || undefined,
      sentimentRange: [sentimentParam('minSentiment', -1), sentimentParam('maxSentiment', 1)]
    });
    return json({ success: true, data, meta: { truncated, scannedPosts: rows.length } });
  } catch (error) {
    return queryErrorResponse('Trigram analysis', error, []);
  }
}

export const trigramsHandlers: Record<string, AnalyticsHandler> = {
  'trigrams': trigrams
};
