/**
 * SQL that fetches the posts trigrams are computed from. Parameters are positional and added in this
 * order when used: workspace platforms ($1, an array) then the explicit platform filter.
 */

export const TRIGRAM_TIME_RANGE_DAYS: Readonly<Record<string, number>> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };
export const TRIGRAM_DEFAULT_DAYS = 7;

/** Upper bound on posts scanned per request. */
export const TRIGRAM_MAX_POSTS = 20_000;

export interface TrigramQueryFilters {
  /** Restrict to the workspace's platforms ($1). */
  workspacePlatforms: boolean;
  /** Restrict to one platform (next parameter). */
  platform: boolean;
}

export function trigramPostsQuery(filters: TrigramQueryFilters, days: number): string {
  if (!Number.isFinite(days) || days < 1) throw new Error('days must be a positive number');
  const safeDays = Math.trunc(days);
  let next = 1;
  const conditions: string[] = [];
  if (filters.workspacePlatforms) conditions.push(`ds.platform = ANY($${next++})`);
  if (filters.platform) conditions.push(`ds.platform = $${next++}`);

  return `
    SELECT
      p.id,
      p.content AS text,
      ds.platform,
      p.created_at,
      (SELECT sc.sentiment_category FROM sentiment_classifications sc
        WHERE sc.post_id = p.id ORDER BY sc.id DESC LIMIT 1) AS sentiment_category,
      COALESCE((SELECT pe.engagement_rate FROM post_engagement pe
        WHERE pe.post_id = p.id ORDER BY pe.id DESC LIMIT 1), 0) AS engagement_rate
    FROM posts p
    JOIN data_sources ds ON ds.id = p.data_source_id
    WHERE p.content IS NOT NULL
      AND p.created_at >= CURRENT_TIMESTAMP - INTERVAL '${safeDays} days'
      ${conditions.map((condition) => `AND ${condition}`).join('\n      ')}
    ORDER BY p.created_at DESC
    LIMIT ${TRIGRAM_MAX_POSTS}`;
}
