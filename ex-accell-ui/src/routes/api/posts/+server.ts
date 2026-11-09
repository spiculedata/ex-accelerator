// Posts behind a number: the evidence for a topic, hashtag, phrase or sentiment segment.
// GET /api/posts?topic=&hashtag=&q=&sentiment=&platforms=a,b&date_start=&date_end=&limit=&offset=

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
  const offset = integerParam(params.get('offset'));
  if (limit === null || offset === null) {
    return json({ success: false, data: null, error: 'limit and offset must be whole numbers' }, { status: 400 });
  }

  // Platforms follow the page endpoints: an explicit choice wins, then the workspace's social platforms.
  // A `platforms` parameter that is present but empty means every platform is switched off.
  const explicitPlatforms = params.get('platforms');
  const chosen = explicitPlatforms?.split(',').map((p) => p.trim()).filter(Boolean);
  const emptyPage = { posts: [], total: 0, limit: POST_SEARCH_DEFAULT_LIMIT, offset: offset ?? 0 };
  if (explicitPlatforms !== null && chosen && chosen.length === 0) {
    return json({ success: true, data: emptyPage });
  }

  const scope = await resolveWorkspaceScope(url);
  if (scope && !scope.hasSocialMedia) {
    return json({ success: true, data: emptyPage });
  }

  const filters: PostSearchFilters = {
    topic: params.get('topic') ?? undefined,
    hashtag: params.get('hashtag') ?? undefined,
    q: params.get('q') ?? undefined,
    sentiment: params.get('sentiment') ?? undefined,
    platforms: chosen && chosen.length > 0 ? chosen : scope?.socialPlatforms,
    dateStart: params.get('date_start') ?? undefined,
    dateEnd: params.get('date_end') ?? undefined,
    limit,
    offset
  };

  const search = buildPostSearch(filters);
  if (!search.ok) {
    return json({ success: false, data: null, error: search.error }, { status: 400 });
  }

  try {
    const rows = await postgresPool.query(search.sql, search.params);
    const posts = rows.map(({ total: _total, confidence_score, ...post }: any) => ({
      ...post,
      confidence: confidence_score === null || confidence_score === undefined ? null : Number(confidence_score)
    }));
    return json({
      success: true,
      data: { posts, total: rows.length > 0 ? Number(rows[0].total) : 0, limit: search.limit, offset: search.offset }
    });
  } catch (error) {
    return queryErrorResponse('Post search', error, { ...emptyPage, limit: search.limit, offset: search.offset });
  }
};
