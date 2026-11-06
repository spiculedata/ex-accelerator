-- Views and tables the dashboards read, expressed over the core tables.
-- Views are created only when absent so an existing, hand-built definition is never replaced.

-- One row per classified post, with its source platform and engagement. `timestamp` is epoch milliseconds.
DO $migration$ BEGIN IF to_regclass('public.posts_with_sentiment') IS NULL THEN EXECUTE $view$
CREATE VIEW posts_with_sentiment AS
SELECT
    p.id,
    p.content AS text,
    ds.platform,
    (EXTRACT(EPOCH FROM p.created_at) * 1000)::bigint AS timestamp,
    p.created_at,
    p.author,
    p.language,
    p.data_source_id,
    sc.sentiment_category,
    sc.confidence_score,
    COALESCE(pe.likes_count, 0) AS engagement_likes,
    COALESCE(pe.shares_count, 0) AS engagement_shares,
    COALESCE(pe.comments_count, 0) AS engagement_comments,
    COALESCE(pe.views_count, 0) AS engagement_views,
    (SELECT string_agg(ea.emotion, ',') FROM emotion_analysis ea WHERE ea.post_id = p.id) AS emotions
FROM posts p
JOIN data_sources ds ON ds.id = p.data_source_id
JOIN sentiment_classifications sc ON sc.post_id = p.id
LEFT JOIN post_engagement pe ON pe.post_id = p.id
$view$; END IF; END $migration$;

-- Average sentiment mix by hour of day, computed from the posts.
DO $migration$ BEGIN IF to_regclass('public.hourly_sentiment_patterns') IS NULL THEN EXECUTE $view$
CREATE VIEW hourly_sentiment_patterns AS
SELECT
    EXTRACT(HOUR FROM created_at)::integer AS hour_of_day,
    ROUND(100.0 * COUNT(*) FILTER (WHERE sentiment_category IN ('Very Positive', 'Positive')) / COUNT(*), 2) AS avg_positive_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE sentiment_category IN ('Very Negative', 'Negative')) / COUNT(*), 2) AS avg_negative_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE sentiment_category = 'Neutral') / COUNT(*), 2) AS avg_neutral_percentage,
    COUNT(*)::integer AS total_posts_analyzed
FROM posts_with_sentiment
GROUP BY EXTRACT(HOUR FROM created_at)
$view$; END IF; END $migration$;

-- Saved investigations (also created on demand by the investigations API).
CREATE TABLE IF NOT EXISTS investigations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query_config JSONB NOT NULL,
    layout_config JSONB DEFAULT '{}',
    pinned_views JSONB DEFAULT '[]',
    annotations JSONB DEFAULT '[]',
    created_by VARCHAR(255),
    workspace_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
