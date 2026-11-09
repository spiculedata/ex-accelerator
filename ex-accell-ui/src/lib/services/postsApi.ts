// Client for GET /api/posts: the posts behind a number

export interface PostFilters {
  /** Scopes the posts to a workspace's datasets, as the page's own queries are */
  workspaceId?: string;
  topic?: string;
  hashtag?: string;
  q?: string;
  sentiment?: string;
  platforms?: string[];
  dateStart?: string;
  dateEnd?: string;
}

export interface Post {
  id: number;
  text: string;
  platform: string;
  author: string | null;
  created_at: string;
  sentiment_category: string | null;
  confidence: number | null;
  engagement_likes: number | null;
  engagement_shares: number | null;
  engagement_comments: number | null;
}

export interface PostPage {
  /** True when the posts view does not exist yet, so an empty list does not mean "no matches" */
  unavailable?: boolean;
  posts: Post[];
  total: number;
  limit: number;
  offset: number;
}

export function buildPostsQuery(filters: PostFilters, page: { limit?: number; offset?: number } = {}): string {
  const params = new URLSearchParams();
  if (filters.workspaceId) params.set('workspace_id', filters.workspaceId);
  if (filters.topic) params.set('topic', filters.topic);
  if (filters.hashtag) params.set('hashtag', filters.hashtag.replace(/^#/, ''));
  if (filters.q) params.set('q', filters.q);
  if (filters.sentiment) params.set('sentiment', filters.sentiment);
  // An empty list is kept: the server reads platforms= as every platform switched off, as the pages do
  if (filters.platforms) params.set('platforms', filters.platforms.join(','));
  if (filters.dateStart) params.set('date_start', filters.dateStart);
  if (filters.dateEnd) params.set('date_end', filters.dateEnd);
  if (page.limit !== undefined) params.set('limit', String(page.limit));
  if (page.offset !== undefined) params.set('offset', String(page.offset));
  return params.toString();
}

/** Fetches one page of posts. Throws an Error with a user-readable message when the request fails. */
export async function fetchPosts(filters: PostFilters, page: { limit?: number; offset?: number } = {}): Promise<PostPage> {
  const response = await fetch(`/api/posts?${buildPostsQuery(filters, page)}`);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.error ?? `Request failed (HTTP ${response.status})`);
  return { ...(result.data as PostPage), unavailable: !!result.meta?.unavailable };
}

/** Reads the workspace, platform and date filters out of the params the shared filter bar produces. */
export function filtersFromParams(params: Record<string, string>): Pick<PostFilters, 'workspaceId' | 'platforms' | 'dateStart' | 'dateEnd'> {
  // `platforms` present but empty means every platform is switched off, which must stay "nothing", not "all"
  const platforms = params.platforms === undefined ? undefined : params.platforms.split(',').map((p) => p.trim()).filter(Boolean);
  return {
    ...(params.workspace_id ? { workspaceId: params.workspace_id } : {}),
    ...(platforms !== undefined ? { platforms } : {}),
    ...(params.date_start ? { dateStart: params.date_start } : {}),
    ...(params.date_end ? { dateEnd: params.date_end } : {})
  };
}
