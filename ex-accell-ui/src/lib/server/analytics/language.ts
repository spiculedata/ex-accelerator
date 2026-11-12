import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { PLATFORM_CONDITION, hasNoSocialData, languageQueries, languageScope } from '$lib/server/languageQueries';
import { queryErrorResponse } from '$lib/server/queryErrors';
import { parseDateWindow, windowConditions } from '$lib/server/dateWindow';
import type { AnalyticsContext, AnalyticsHandler } from './types';

async function languageStats({ url, scope }: AnalyticsContext): Promise<Response> {
  const parsed = parseDateWindow(url.searchParams);
  if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
  if (hasNoSocialData(scope)) return json({ success: true, data: [] });
  try {
    const scoped = languageScope(scope, parsed.window);
    const data = await executeQuery(languageQueries.stats(scoped.conditions), scoped.params);
    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('Language stats', error, []);
  }
}

async function languagePosts({ url, scope }: AnalyticsContext): Promise<Response> {
  const parsed = parseDateWindow(url.searchParams);
  if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
  if (hasNoSocialData(scope)) return json({ success: true, data: [] });
  try {
    const params: any[] = [];
    const conditions: string[] = [];
    const platform = url.searchParams.get('platform');
    const language = url.searchParams.get('language');
    const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '');
    if (platform && platform !== 'all') { params.push(platform); conditions.push(`ds.platform = $${params.length}`); }
    if (language && language !== 'all') { params.push(language); conditions.push(`l.code = $${params.length}`); }
    if (Number.isFinite(minConfidence)) { params.push(minConfidence); conditions.push(`ld.confidence_score >= $${params.length}`); }
    if (scope?.hasSocialMedia) { params.push(scope.socialPlatforms); conditions.push(PLATFORM_CONDITION(`$${params.length}`)); }
    const dated = windowConditions('p.created_at', parsed.window, params.length + 1);
    params.push(...dated.params);
    conditions.push(...dated.conditions);
    params.push(Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50') || 50, 1), 200));

    const data = await executeQuery(languageQueries.posts(conditions, `$${params.length}`), params);
    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('Language posts', error, []);
  }
}

async function languageMixing({ url, scope }: AnalyticsContext): Promise<Response> {
  const parsed = parseDateWindow(url.searchParams);
  if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
  if (hasNoSocialData(scope)) return json({ success: true, data: [] });
  try {
    const scoped = languageScope(scope, parsed.window);
    const data = await executeQuery(languageQueries.mixing(scoped.conditions), scoped.params);
    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('Language mixing', error, []);
  }
}

async function languageTrends({ url, scope }: AnalyticsContext): Promise<Response> {
  const parsed = parseDateWindow(url.searchParams);
  if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
  if (hasNoSocialData(scope)) return json({ success: true, data: [] });
  try {
    const scoped = languageScope(scope, parsed.window);
    const data = await executeQuery(languageQueries.trends(scoped.conditions), scoped.params);
    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('Language trends', error, []);
  }
}

async function languageDetectionDetail({ url, scope }: AnalyticsContext): Promise<Response> {
  if (hasNoSocialData(scope)) return json({ success: true, data: [] });
  try {
    const langCode = url.searchParams.get('language') || 'all';
    const params: any[] = [];
    const detailConditions: string[] = [];
    if (langCode !== 'all') {
      params.push(langCode);
      detailConditions.push(`l.code = $${params.length}`);
    }
    if (scope?.hasSocialMedia) {
      params.push(scope.socialPlatforms);
      detailConditions.push(PLATFORM_CONDITION(`$${params.length}`));
    }
    const whereClause = detailConditions.length > 0 ? `WHERE ${detailConditions.join(' AND ')}` : '';
    const data = await executeQuery(`
      SELECT
        ld.post_id AS document_id,
        ds.platform AS document_source,
        l.code AS language_code,
        ld.confidence_score AS confidence,
        l.name AS language_name
      FROM language_detection ld
      JOIN languages l ON ld.language_id = l.id
      LEFT JOIN posts p ON p.id = ld.post_id
      LEFT JOIN data_sources ds ON ds.id = p.data_source_id
      ${whereClause}
      ORDER BY ld.confidence_score DESC
      LIMIT 100
    `, params);
    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('Language detection detail', error, []);
  }
}

export const languageHandlers: Record<string, AnalyticsHandler> = {
  'language-stats': languageStats,
  'language-posts': languagePosts,
  'language-mixing': languageMixing,
  'language-trends': languageTrends,
  'language-detection-detail': languageDetectionDetail
};
