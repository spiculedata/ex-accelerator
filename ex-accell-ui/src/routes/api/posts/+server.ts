// Posts behind a number: the evidence for a topic, hashtag, phrase or sentiment segment.
// GET /api/posts?topic=&hashtag=&q=&phrase=&language=&within_days=&sentiment=&platforms=a,b&date_start=&date_end=&limit=&cursor=
// Pages by keyset: each response carries `nextCursor` (null on the last page) to pass as `cursor`. Only the first page
// (no cursor) counts the matches; later pages report `total: null`.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';
import { buildPostSearch, POST_SEARCH_DEFAULT_LIMIT, type PostSearchFilters } from '$lib/server/postSearch';
import { resolveWorkspaceScope } from '$lib/services/workspaceContextResolver';
import { queryErrorResponse } from '$lib/server/queryErrors';

const integerParam = (value: string | null): number | undefined | null => {
  if (value === null || value === '') return undefined;
  return /^-?\d+$/.test(value) ? Number(value) : null; // null means "present but not an integer"
};

export const GET: RequestHandler = async ({ url }) => {
  const params = url.searchParams;
  const limit = integerParam(params.get('limit'));
  const withinDays = integerParam(params.get('within_days'));
  if (limit === null || withinDays === null) {
    return json({ success: false, data: null, error: 'limit and within_days must be whole numbers' }, { status: 400 });
  }

  // Platforms follow the page endpoints: an explicit choice wins, then the workspace's social platforms.
  // A `platforms` parameter that is present but empty means every platform is switched off.
  const explicitPlatforms = params.get('platforms');
  const chosen = explicitPlatforms?.split(',').map((p) => p.trim()).filter(Boolean);
  const emptyPage = { posts: [], total: 0, limit: POST_SEARCH_DEFAULT_LIMIT, nextCursor: null };
  if (explicitPlatforms !== null && chosen && chosen.length === 0) {
    return json({ success: true, data: emptyPage });
  }

  let resolved: Awaited<ReturnType<typeof resolveWorkspaceScope>>;
  try {
    resolved = await resolveWorkspaceScope(url);
  } catch (error) {
    // Never fall back to unscoped posts when the workspace could not be resolved
    return queryErrorResponse('Post search', error, emptyPage);
  }
  // A workspace that does not exist has no posts; it must not widen to every post
  if (resolved.kind === 'missing') {
    return json({ success: true, data: emptyPage });
  }
  const scope = resolved.kind === 'scoped' ? resolved.scope : null;
  if (scope && !scope.hasSocialMedia) {
    return json({ success: true, data: emptyPage });
  }

  const filters: PostSearchFilters = {
    topic: params.get('topic') ?? undefined,
    hashtag: params.get('hashtag') ?? undefined,
    q: params.get('q') ?? undefined,
    phrase: params.get('phrase') ?? undefined,
    language: params.get('language') ?? undefined,
    withinDays,
    sentiment: params.get('sentiment') ?? undefined,
    platforms: chosen && chosen.length > 0 ? chosen : scope?.socialPlatforms,
    dateStart: params.get('date_start') ?? undefined,
    dateEnd: params.get('date_end') ?? undefined,
    limit,
    cursor: params.get('cursor') ?? undefined
  };

  const search = buildPostSearch(filters);
  if (!search.ok) {
    return json({ success: false, data: null, error: search.error }, { status: 400 });
  }

  try {
    const rows = await postgresPool.query(search.sql, search.params);
    // The query asks for one row more than the page; having it means another page exists
    const hasMore = rows.length > search.limit;
    const pageRows = hasMore ? rows.slice(0, search.limit) : rows;
    const last = pageRows[pageRows.length - 1];
    // A post with no usable time cannot start the next page, so paging stops there rather than send a cursor that would be refused
    const lastTime = last ? Number(last.timestamp) : NaN;
    const posts = pageRows.map(({ total: _total, timestamp: _timestamp, confidence_score, ...post }: any) => ({
      ...post,
      confidence: confidence_score === null || confidence_score === undefined ? null : Number(confidence_score)
    }));
    return json({
      success: true,
      data: {
        posts,
        total: search.withTotal ? (rows.length > 0 ? Number(rows[0].total) : 0) : null,
        limit: search.limit,
        nextCursor: hasMore && Number.isFinite(lastTime) && lastTime > 0 ? `${lastTime}_${Number(last.id)}` : null
      }
    });
  } catch (error) {
    return queryErrorResponse('Post search', error, { ...emptyPage, limit: search.limit });
  }
};
