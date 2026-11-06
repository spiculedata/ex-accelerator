/** SQL for the Language Detection dashboard, over language_detection, languages, posts and language_mixing. */

export const CONFIDENCE_BUCKETS = { veryHigh: 0.95, high: 0.85, medium: 0.7 } as const;

export const languageQueries = {
  stats: (): string => `
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
      l2.code AS secondary_language,
      lm.secondary_confidence
    FROM language_detection ld
    JOIN languages l ON l.id = ld.language_id
    JOIN posts p ON p.id = ld.post_id
    JOIN data_sources ds ON ds.id = p.data_source_id
    LEFT JOIN language_mixing lm ON lm.post_id = p.id
    LEFT JOIN languages l2 ON l2.id = lm.secondary_language_id
    ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY p.created_at DESC
    LIMIT ${limitParam}`,

  mixing: (): string => `
    SELECT
      l1.name AS primary_language,
      l2.name AS secondary_language,
      COUNT(*) AS occurrence_count
    FROM language_mixing lm
    JOIN languages l1 ON l1.id = lm.primary_language_id
    JOIN languages l2 ON l2.id = lm.secondary_language_id
    GROUP BY l1.name, l2.name
    ORDER BY occurrence_count DESC
    LIMIT 10`
};
