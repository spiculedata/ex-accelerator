import { dateBoundToEpochMs } from './dateBounds';

// Builds the query behind "show me the posts": the evidence under a topic, hashtag, phrase or sentiment
// segment. Pure, so the SQL and its validation are tested without a database. Every request value is
// bound as a parameter; none is ever written into the SQL text.

export interface PostSearchFilters {
  /** The topic's slug, for example `topic-transit` (topics.topic_id), as the topic pages know it */
  topic?: string;
  hashtag?: string;
  q?: string;
  sentiment?: string;
  platforms?: string[];
  dateStart?: string;
  dateEnd?: string;
  limit?: number;
  offset?: number;
}

export type PostSearch = { ok: true; sql: string; params: unknown[] } | { ok: false; error: string };

export const POST_SEARCH_DEFAULT_LIMIT = 25;
export const POST_SEARCH_MAX_LIMIT = 100;
const MAX_PHRASE_LENGTH = 200;
const HASHTAG = /^[\p{L}\p{N}_]{1,100}$/u;
const TOPIC_SLUG = /^[A-Za-z0-9_-]{1,100}$/;

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

export function buildPostSearch(filters: PostSearchFilters): PostSearch {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.topic !== undefined) {
    if (!TOPIC_SLUG.test(filters.topic)) return { ok: false, error: 'topic must be a topic id such as topic-transit' };
    conditions.push(
      `EXISTS (SELECT 1 FROM document_topics dt JOIN topics t ON t.id = dt.topic_id WHERE dt.post_id = p.id AND t.topic_id = ${add(filters.topic)})`
    );
  }

  if (filters.hashtag !== undefined) {
    if (!HASHTAG.test(filters.hashtag)) return { ok: false, error: 'hashtag must be letters, numbers or underscores, without the #' };
    // The tag, bounded on both sides, so #tram does not match #tramway
    conditions.push(`p.text ~* ${add(`(^|[^[:alnum:]_])#${filters.hashtag}([^[:alnum:]_]|$)`)}`);
  }

  if (filters.q !== undefined) {
    const phrase = filters.q.trim();
    if (!phrase || phrase.length > MAX_PHRASE_LENGTH) return { ok: false, error: `q must be 1 to ${MAX_PHRASE_LENGTH} characters` };
    conditions.push(`p.text ILIKE ${add(`%${escapeLike(phrase)}%`)} ESCAPE '\\'`);
  }

  if (filters.sentiment !== undefined && filters.sentiment !== '') {
    conditions.push(`LOWER(p.sentiment_category) = ${add(filters.sentiment.toLowerCase())}`);
  }

  if (filters.platforms && filters.platforms.length > 0) {
    conditions.push(`LOWER(p.platform) = ANY(${add(filters.platforms.map((platform) => platform.toLowerCase()))})`);
  }

  for (const [name, value, bound, op] of [
    ['date_start', filters.dateStart, 'start', '>='],
    ['date_end', filters.dateEnd, 'end', '<=']
  ] as const) {
    if (!value) continue;
    const epochMs = dateBoundToEpochMs(value, bound);
    if (epochMs === null) return { ok: false, error: `${name} must be a date (YYYY-MM-DD) or an ISO timestamp with a time zone` };
    conditions.push(`p.timestamp ${op} ${add(epochMs)}`);
  }

  const limit = Math.min(POST_SEARCH_MAX_LIMIT, Math.max(1, Math.trunc(filters.limit ?? POST_SEARCH_DEFAULT_LIMIT)));
  const offset = filters.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0) return { ok: false, error: 'offset must be zero or a positive integer' };

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT p.id, p.text, p.platform, p.author, p.created_at, p.sentiment_category, p.confidence_score,
           p.engagement_likes, p.engagement_shares, p.engagement_comments,
           COUNT(*) OVER() AS total
    FROM posts_with_sentiment p
    ${where}
    ORDER BY p.timestamp DESC, p.id DESC
    LIMIT ${add(limit)} OFFSET ${add(offset)}`;

  return { ok: true, sql, params };
}
