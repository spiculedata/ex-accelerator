import type { WorkspaceDataScope } from '$lib/services/workspaceContextResolver';
import { windowConditions, type DateWindow } from './dateWindow';

/** SQL for the Language Detection dashboard, over language_detection, languages, posts, data_sources and language_mixing. */

/** A post's platform, which is also how a workspace's datasets are matched to posts. */
export const PLATFORM_CONDITION = (param: string): string => `LOWER(ds.platform) = ANY(${param})`;

/**
 * The conditions and parameters that scope a language query to a workspace's social platforms and a date window.
 * Placeholders are numbered from $1; the caller has already returned empty for a workspace without social data.
 */
export function languageScope(scope: WorkspaceDataScope | null, window: DateWindow): { conditions: string[]; params: unknown[] } {
  const platforms = scope?.hasSocialMedia ? scope.socialPlatforms : [];
  const params: unknown[] = platforms.length > 0 ? [platforms] : [];
  const conditions = platforms.length > 0 ? [PLATFORM_CONDITION('$1')] : [];
  const dated = windowConditions('p.created_at', window, params.length + 1);
  return { conditions: [...conditions, ...dated.conditions], params: [...params, ...dated.params] };
}

/** True when the workspace is known and holds no social media dataset: there is nothing to show, not "everything". */
export const hasNoSocialData = (scope: WorkspaceDataScope | null): boolean => scope !== null && !scope.hasSocialMedia;

export const CONFIDENCE_BUCKETS = { veryHigh: 0.95, high: 0.85, medium: 0.7 } as const;

const TRENDS_ROW_LIMIT = 2000;

/** Joins a table's post_id to its post and data source when there is anything to filter by, with the WHERE clause. */
const scopeJoins = (postIdColumn: string, conditions: string[]): string =>
  conditions.length > 0
    ? `JOIN posts p ON p.id = ${postIdColumn} JOIN data_sources ds ON ds.id = p.data_source_id WHERE ${conditions.join(' AND ')}`
    : '';

export const languageQueries = {
  /** Conditions use positional parameters appended by the caller; they restrict by the post's date. */
  stats: (conditions: string[] = []): string => `
    SELECT
      l.code AS language_code,
      l.name AS language,
      COUNT(ld.id) AS post_count,
      AVG(ld.confidence_score) AS confidence,
      COUNT(*) FILTER (WHERE ld.confidence_score >= ${CONFIDENCE_BUCKETS.veryHigh}) AS very_high_count,
      COUNT(*) FILTER (WHERE ld.confidence_score >= ${CONFIDENCE_BUCKETS.high} AND ld.confidence_score < ${CONFIDENCE_BUCKETS.veryHigh}) AS high_count,
      COUNT(*) FILTER (WHERE ld.confidence_score >= ${CONFIDENCE_BUCKETS.medium} AND ld.confidence_score < ${CONFIDENCE_BUCKETS.high}) AS medium_count,
      COUNT(*) FILTER (WHERE ld.confidence_score < ${CONFIDENCE_BUCKETS.medium}) AS low_count,
      COALESCE(STDDEV_POP(ld.confidence_score), 0) AS confidence_stddev
    FROM language_detection ld
    JOIN languages l ON ld.language_id = l.id
    ${scopeJoins('ld.post_id', conditions)}
    GROUP BY l.code, l.name
    ORDER BY post_count DESC`,

  /** Conditions use positional parameters appended by the caller, in the order given. */
  posts: (conditions: string[], limitParam: string): string => `
    SELECT
      p.id,
      p.content AS text,
      l.code AS language_code,
      l.name AS language_name,
      ld.confidence_score AS confidence,
      CAST(p.created_at AS TEXT) AS timestamp,
      ds.platform,
      (SELECT l2.code FROM language_mixing lm JOIN languages l2 ON l2.id = lm.secondary_language_id
        WHERE lm.post_id = p.id ORDER BY lm.id LIMIT 1) AS secondary_language,
      (SELECT lm.secondary_confidence FROM language_mixing lm
        WHERE lm.post_id = p.id ORDER BY lm.id LIMIT 1) AS secondary_confidence
    FROM language_detection ld
    JOIN languages l ON l.id = ld.language_id
    JOIN posts p ON p.id = ld.post_id
    JOIN data_sources ds ON ds.id = p.data_source_id
    ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY p.created_at DESC
    LIMIT ${limitParam}`,

  /** The top pairs by distinct posts, each with the number of distinct mixed posts overall (a post can appear in several pairs). */
  mixing: (conditions: string[] = []): string => `
    WITH scoped AS (
      SELECT lm.post_id, lm.primary_language_id, lm.secondary_language_id
      FROM language_mixing lm
      ${scopeJoins('lm.post_id', conditions)}
    )
    SELECT
      l1.name AS primary_language,
      l2.name AS secondary_language,
      COUNT(DISTINCT scoped.post_id) AS occurrence_count,
      (SELECT COUNT(DISTINCT post_id) FROM scoped) AS mixed_posts
    FROM scoped
    JOIN languages l1 ON l1.id = scoped.primary_language_id
    JOIN languages l2 ON l2.id = scoped.secondary_language_id
    GROUP BY l1.name, l2.name
    ORDER BY occurrence_count DESC
    LIMIT 10`,

  /** Detections per language and day, computed from the posts' own detections. */
  trends: (conditions: string[] = []): string => `
    SELECT
      l.code AS language_code,
      CAST(CAST(p.created_at AS DATE) AS TEXT) AS analysis_date,
      COUNT(*) AS document_count,
      AVG(ld.confidence_score) AS avg_confidence
    FROM language_detection ld
    JOIN languages l ON l.id = ld.language_id
    JOIN posts p ON p.id = ld.post_id
    JOIN data_sources ds ON ds.id = p.data_source_id
    ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    GROUP BY l.code, CAST(p.created_at AS DATE)
    ORDER BY analysis_date DESC, document_count DESC
    LIMIT ${TRENDS_ROW_LIMIT}`
};
