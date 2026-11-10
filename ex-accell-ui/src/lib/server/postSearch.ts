import { dateBoundToEpochMs } from './dateBounds';
import { LETTER_RANGES, WORD_RANGES } from './letters';

// Builds the query behind "show me the posts": the evidence under a topic, hashtag, phrase or sentiment
// segment. Pure, so the SQL and its validation are tested without a database. Every request value is
// bound as a parameter; none is ever written into the SQL text.

export interface PostSearchFilters {
  /** The topic's slug, for example `topic-transit` (topics.topic_id), as the topic pages know it */
  topic?: string;
  hashtag?: string;
  q?: string;
  /** A language code such as `es`: posts detected in that language (the codes on the language page). */
  language?: string;
  /** Only posts from the last N days (1 to 366), by the database clock. */
  withinDays?: number;
  /** Two to six words matched as the phrase counts do: any punctuation between them, any case, links ignored. */
  phrase?: string;
  sentiment?: string;
  platforms?: string[];
  dateStart?: string;
  dateEnd?: string;
  limit?: number;
  /** Where the previous page ended, as `<timestamp>_<id>` (from that page's `nextCursor`). Absent for the first page. */
  cursor?: string;
}

/**
 * `limit` is the page size actually applied (clamped). The SQL asks for one row more, to tell whether another page exists.
 * `withTotal` says whether the rows carry the count of all matches: only the first page counts, so paging on does not
 * repeat the expensive count.
 */
export type PostSearch = { ok: true; sql: string; params: unknown[]; limit: number; withTotal: boolean } | { ok: false; error: string };

export const POST_SEARCH_DEFAULT_LIMIT = 25;
export const POST_SEARCH_MAX_LIMIT = 100;
const MAX_PHRASE_LENGTH = 200;
const PHRASE_WORD = /^[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*$/u;
const MIN_PHRASE_WORDS = 2;
const MAX_PHRASE_WORDS = 6;
const MAX_SENTIMENT_LENGTH = 50;
const HASHTAG = /^[\p{L}\p{M}\p{N}_]{1,100}$/u;
// The timestamp is epoch milliseconds (13 digits today) and the id a 32-bit integer, so a larger value cannot be real
const CURSOR = /^([1-9]\d{0,14})_([1-9]\d{0,9})$/;
const MAX_POST_ID = 2_147_483_647;
const MAX_WITHIN_DAYS = 366;
const LANGUAGE_CODE = /^[A-Za-z0-9_-]{1,10}$/;
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
    conditions.push(`p.text ~* ${add(`(^|[^${WORD_RANGES}])#${filters.hashtag}([^${WORD_RANGES}]|$)`)}`);
  }

  if (filters.q !== undefined) {
    const phrase = filters.q.trim();
    if (!phrase || phrase.length > MAX_PHRASE_LENGTH) return { ok: false, error: `q must be 1 to ${MAX_PHRASE_LENGTH} characters` };
    conditions.push(`p.text ILIKE ${add(`%${escapeLike(phrase)}%`)} ESCAPE '\\'`);
  }

  if (filters.phrase !== undefined) {
    const words = filters.phrase.trim().toLowerCase().split(/\s+/);
    const isPhrase = filters.phrase.length <= MAX_PHRASE_LENGTH && words.length >= MIN_PHRASE_WORDS && words.length <= MAX_PHRASE_WORDS && words.every((word) => PHRASE_WORD.test(word));
    if (!isPhrase) return { ok: false, error: `phrase must be ${MIN_PHRASE_WORDS} to ${MAX_PHRASE_WORDS} words made of letters` };
    // The words split by anything that is not a letter, as the phrase counts split text into words; links are dropped first
    // because the counts drop them. Letters are the only characters allowed in a word, so nothing here needs escaping.
    // The text is first reduced to its words separated by single spaces, which is how the counts see it: anything that is not a
    // letter or an apostrophe becomes a space, and links are dropped. An apostrophe stays, so "cat's" is one word, and one that
    // is not joined to a letter (a quote mark) is allowed around a word but never inside it.
    const quote = `['’]`;
    const between = `${quote}*( ${quote}*)+`;
    const phrase = `(^| )${quote}*${words.join(between)}${quote}*( |$)`;
    conditions.push(
      `regexp_replace(regexp_replace(p.text, 'https?://\\S+', ' ', 'gi'), ${add(`[^${LETTER_RANGES}'’]+`)}, ' ', 'g') ~* ${add(phrase)}`
    );
  }

  if (filters.language !== undefined) {
    if (!LANGUAGE_CODE.test(filters.language)) return { ok: false, error: 'language must be a language code such as en' };
    conditions.push(
      `EXISTS (SELECT 1 FROM language_detection ld JOIN languages l ON l.id = ld.language_id WHERE ld.post_id = p.id AND l.code = ${add(filters.language)})`
    );
  }

  if (filters.withinDays !== undefined) {
    if (!Number.isInteger(filters.withinDays) || filters.withinDays < 1 || filters.withinDays > MAX_WITHIN_DAYS) {
      return { ok: false, error: `within_days must be a whole number from 1 to ${MAX_WITHIN_DAYS}` };
    }
    conditions.push(`p.created_at >= CURRENT_TIMESTAMP - make_interval(days => ${add(filters.withinDays)})`);
  }

  if (filters.sentiment !== undefined && filters.sentiment !== '') {
    if (filters.sentiment.length > MAX_SENTIMENT_LENGTH) return { ok: false, error: `sentiment must be at most ${MAX_SENTIMENT_LENGTH} characters` };
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

  // Continue after the last post of the previous page. A keyset condition on the sort key reads only what is needed and
  // does not shift when new posts arrive, unlike skipping a number of rows.
  if (filters.cursor !== undefined) {
    const match = CURSOR.exec(filters.cursor);
    if (!match || Number(match[2]) > MAX_POST_ID) return { ok: false, error: 'cursor must be the nextCursor of a previous page' };
    conditions.push(`(p.timestamp, p.id) < (${add(Number(match[1]))}, ${add(Number(match[2]))})`);
  }
  const withTotal = filters.cursor === undefined;

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT p.id, p.text, p.platform, p.author, p.created_at, p.timestamp, p.sentiment_category, p.confidence_score,
           p.engagement_likes, p.engagement_shares, p.engagement_comments${withTotal ? ',\n           COUNT(*) OVER() AS total' : ''}
    FROM posts_with_sentiment p
    ${where}
    ORDER BY p.timestamp DESC, p.id DESC
    LIMIT ${add(limit + 1)}`;

  return { ok: true, sql, params, limit, withTotal };
}
