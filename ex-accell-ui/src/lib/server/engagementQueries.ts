/**
 * SQL for the Engagement Analysis dashboard, over the core post_engagement, posts and data_sources
 * tables. Every query accepts an optional platform filter as $1, then optional date window conditions.
 */

const BASE_FROM = `
  FROM post_engagement pe
  JOIN posts p ON p.id = pe.post_id
  JOIN data_sources ds ON ds.id = p.data_source_id`;

const TOTAL_ENGAGEMENTS = '(pe.likes_count + pe.comments_count + pe.shares_count + pe.saves_count)';
const POSITIVE_CATEGORIES = "('Very Positive', 'Positive')";

export const ENGAGEMENT_TRENDS_DAYS: Readonly<Record<string, number>> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };

/** Wraps WHERE conditions, adding the optional platform filter. */
const where = (platformFilter: boolean, extra: string[] = []): string => {
  const conditions = [...(platformFilter ? ['ds.platform = ANY($1)'] : []), ...extra];
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};

export const engagementQueries = {
  stats: (platformFilter: boolean, windowConditions: string[] = []): string => `
    SELECT
      COUNT(*) AS total_posts,
      COALESCE(SUM(${TOTAL_ENGAGEMENTS}), 0) AS total_engagements,
      COALESCE(AVG(pe.engagement_rate), 0) AS average_rate,
      COALESCE(SUM(pe.reach), 0) AS total_reach,
      COALESCE(SUM(pe.impressions), 0) AS total_impressions,
      COALESCE(MAX(${TOTAL_ENGAGEMENTS}), 0) AS best_post_engagements,
      COALESCE(AVG(pe.likes_count), 0) AS avg_likes,
      COALESCE(AVG(pe.comments_count), 0) AS avg_comments,
      COALESCE(AVG(pe.shares_count), 0) AS avg_shares
    ${BASE_FROM}
    ${where(platformFilter, windowConditions)}`,

  platforms: (platformFilter: boolean, windowConditions: string[] = []): string => `
    SELECT
      ds.platform,
      COUNT(*) AS posts,
      COALESCE(SUM(${TOTAL_ENGAGEMENTS}), 0) AS total_engagements,
      COALESCE(AVG(pe.engagement_rate), 0) AS engagement_rate,
      COALESCE(SUM(pe.reach), 0) AS total_reach,
      COALESCE(AVG(pe.likes_count), 0) AS avg_likes,
      COALESCE(AVG(pe.comments_count), 0) AS avg_comments,
      COALESCE(AVG(pe.shares_count), 0) AS avg_shares
    ${BASE_FROM}
    ${where(platformFilter, windowConditions)}
    GROUP BY ds.platform
    ORDER BY engagement_rate DESC`,

  contentTypes: (platformFilter: boolean, windowConditions: string[] = []): string => `
    SELECT
      COALESCE(ct.name, 'Unknown') AS content_type,
      COUNT(*) AS posts,
      COALESCE(AVG(pe.engagement_rate), 0) AS engagement_rate,
      COALESCE(SUM(pe.reach), 0) AS reach,
      COALESCE(AVG(pe.likes_count), 0) AS avg_likes,
      COALESCE(AVG(pe.comments_count), 0) AS avg_comments,
      COALESCE(AVG(pe.shares_count), 0) AS avg_shares,
      COALESCE(AVG(CASE WHEN EXISTS (
        SELECT 1 FROM sentiment_classifications sc
        WHERE sc.post_id = p.id AND sc.sentiment_category IN ${POSITIVE_CATEGORIES}
      ) THEN 1.0 ELSE 0.0 END), 0) AS positive_share
    ${BASE_FROM}
    LEFT JOIN content_types ct ON ct.id = pe.content_type_id
    ${where(platformFilter, windowConditions)}
    GROUP BY COALESCE(ct.name, 'Unknown')
    ORDER BY engagement_rate DESC`,

  trends: (platformFilter: boolean, days: number, windowConditions: string[] = []): string => `
    SELECT
      CAST(CAST(p.created_at AS DATE) AS TEXT) AS date,
      COALESCE(SUM(pe.likes_count), 0) AS likes,
      COALESCE(SUM(pe.comments_count), 0) AS comments,
      COALESCE(SUM(pe.shares_count), 0) AS shares,
      COALESCE(SUM(pe.saves_count), 0) AS saves,
      COALESCE(SUM(pe.views_count), 0) AS views,
      COALESCE(SUM(pe.reach), 0) AS reach,
      COALESCE(AVG(pe.engagement_rate), 0) AS engagement_rate
    ${BASE_FROM}
    ${where(platformFilter, windowConditions.length > 0 ? windowConditions : [`p.created_at >= CURRENT_DATE - INTERVAL '${Math.trunc(days)} days'`])}
    GROUP BY CAST(p.created_at AS DATE)
    ORDER BY date`,

  topPosts: (platformFilter: boolean, limitParam: string, windowConditions: string[] = []): string => `
    SELECT
      p.id,
      p.content AS text,
      p.author,
      ds.platform,
      COALESCE(ct.name, 'Unknown') AS content_type,
      pe.likes_count AS likes,
      pe.comments_count AS comments,
      pe.shares_count AS shares,
      pe.saves_count AS saves,
      pe.engagement_rate,
      pe.reach,
      pe.views_count AS views,
      p.created_at AS timestamp
    ${BASE_FROM}
    LEFT JOIN content_types ct ON ct.id = pe.content_type_id
    ${where(platformFilter, windowConditions)}
    ORDER BY ${TOTAL_ENGAGEMENTS} DESC
    LIMIT ${limitParam}`,

  timing: (platformFilter: boolean, windowConditions: string[] = []): string => `
    SELECT
      CAST(EXTRACT(HOUR FROM p.created_at) AS INTEGER) AS hour_of_day,
      CAST(EXTRACT(DOW FROM p.created_at) AS INTEGER) AS day_of_week,
      COALESCE(AVG(pe.engagement_rate), 0) AS avg_engagement_rate,
      COUNT(*) AS total_posts,
      COALESCE(SUM(${TOTAL_ENGAGEMENTS}), 0) AS total_engagements
    ${BASE_FROM}
    ${where(platformFilter, windowConditions)}
    GROUP BY 1, 2
    ORDER BY 2, 1`
};
