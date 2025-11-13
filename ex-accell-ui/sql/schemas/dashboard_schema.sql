-- Social Media Analytics Dashboard Schema for DuckDB
-- This schema supports the overview dashboard with comprehensive social media data

-- Drop existing tables if they exist
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS post_analysis;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS data_sources;
DROP TABLE IF EXISTS crawlers;

-- Create data sources table
CREATE TABLE data_sources (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    health_score INTEGER DEFAULT 100,
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create crawlers table
CREATE TABLE crawlers (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    data_source_id INTEGER REFERENCES data_sources(id),
    status VARCHAR(20) DEFAULT 'active',
    processing_rate INTEGER DEFAULT 0,
    last_run TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create posts table
CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    data_source_id INTEGER REFERENCES data_sources(id),
    external_id VARCHAR(255),
    content TEXT,
    author VARCHAR(255),
    post_type VARCHAR(50) DEFAULT 'post',
    language VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create post analysis table for NLP results
CREATE TABLE post_analysis (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    sentiment VARCHAR(20),
    sentiment_score DECIMAL(3,2),
    language VARCHAR(10),
    topics TEXT[], -- Array of detected topics
    keywords TEXT[], -- Array of keywords
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create activity logs table
CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY,
    activity_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'info',
    data_source_id INTEGER REFERENCES data_sources(id),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data sources
INSERT INTO data_sources (id, name, platform, status, health_score, last_sync) VALUES
(1, 'Twitter', 'twitter', 'active', 98, '2025-01-27 15:25:00'),
(2, 'Facebook', 'facebook', 'active', 96, '2025-01-27 15:20:00'),
(3, 'Instagram', 'instagram', 'active', 94, '2025-01-27 15:15:00'),
(4, 'Reddit', 'reddit', 'active', 92, '2025-01-27 15:10:00'),
(5, 'LinkedIn', 'linkedin', 'active', 99, '2025-01-27 15:05:00'),
(6, 'TikTok', 'tiktok', 'paused', 87, '2025-01-27 14:30:00'),
(7, 'YouTube', 'youtube', 'active', 95, '2025-01-27 15:00:00');

-- Insert sample crawlers
INSERT INTO crawlers (id, name, data_source_id, status, processing_rate, last_run) VALUES
(1, 'Twitter Main Crawler', 1, 'active', 1247, '2025-01-27 15:25:00'),
(2, 'Facebook Pages Crawler', 2, 'active', 892, '2025-01-27 15:20:00'),
(3, 'Instagram Posts Crawler', 3, 'active', 654, '2025-01-27 15:15:00'),
(4, 'Reddit Subreddits Crawler', 4, 'active', 543, '2025-01-27 15:10:00'),
(5, 'LinkedIn Company Crawler', 5, 'active', 321, '2025-01-27 15:05:00'),
(6, 'TikTok Videos Crawler', 6, 'paused', 0, '2025-01-27 14:30:00'),
(7, 'YouTube Comments Crawler', 7, 'active', 234, '2025-01-27 15:00:00'),
(8, 'Twitter Trending Crawler', 1, 'active', 456, '2025-01-27 15:25:00');

-- Generate sample posts with realistic distribution
INSERT INTO posts (id, data_source_id, external_id, content, author, language, created_at, collected_at)
SELECT 
    row_number() OVER () as id,
    CASE 
        WHEN random() < 0.383 THEN 1  -- Twitter 38.3%
        WHEN random() < 0.606 THEN 2  -- Facebook 22.3%
        WHEN random() < 0.778 THEN 3  -- Instagram 17.2%
        WHEN random() < 0.884 THEN 4  -- Reddit 10.6%
        WHEN random() < 0.951 THEN 5  -- LinkedIn 6.7%
        WHEN random() < 0.992 THEN 6  -- TikTok 4.1%
        ELSE 7                        -- YouTube 0.8%
    END as data_source_id,
    'ext_' || row_number() OVER () as external_id,
    'Sample post content ' || row_number() OVER () as content,
    'user_' || (random() * 1000)::INTEGER as author,
    CASE 
        WHEN random() < 0.801 THEN 'en'  -- English 80.1%
        WHEN random() < 0.907 THEN 'es'  -- Spanish 10.6%
        WHEN random() < 0.961 THEN 'fr'  -- French 5.4%
        WHEN random() < 0.989 THEN 'de'  -- German 2.8%
        ELSE 'pt'                        -- Portuguese 1.1%
    END as language,
    timestamp '2025-01-27 00:00:00' + (random() * interval '24 hours') as created_at,
    NOW() - (random() * interval '1 hour') as collected_at
FROM generate_series(1, 847293) as t(i);

-- Generate sample post analysis
INSERT INTO post_analysis (post_id, sentiment, sentiment_score, language, topics, keywords, processed_at)
SELECT 
    p.id as post_id,
    CASE 
        WHEN random() < 0.539 THEN 'positive'  -- 53.9%
        WHEN random() < 0.816 THEN 'negative'  -- 27.7%
        ELSE 'neutral'                         -- 18.4%
    END as sentiment,
    (random() * 2 - 1)::DECIMAL(3,2) as sentiment_score,
    p.language,
    CASE 
        WHEN random() < 0.2 THEN ['Artificial Intelligence', 'Technology']
        WHEN random() < 0.4 THEN ['Climate Change', 'Environment']
        WHEN random() < 0.6 THEN ['Cryptocurrency', 'Finance']
        WHEN random() < 0.8 THEN ['Health & Wellness', 'Lifestyle']
        ELSE ['Technology Trends', 'Innovation']
    END as topics,
    ['keyword1', 'keyword2', 'keyword3'] as keywords,
    p.collected_at + interval '5 minutes' as processed_at
FROM posts p
WHERE random() < 0.95; -- 95% of posts have been analyzed

-- Generate sample activity logs
INSERT INTO activity_logs (activity_type, message, status, data_source_id, created_at) VALUES
('data_ingestion', 'Successfully processed 2,456 new posts from Twitter', 'success', 1, '2025-01-27 15:25:00'),
('sentiment_analysis', 'Completed sentiment analysis for 1,892 posts', 'success', NULL, '2025-01-27 15:20:00'),
('language_detection', 'Detected 8 new languages in recent posts', 'info', NULL, '2025-01-27 15:15:00'),
('topic_modeling', 'Updated topic relationships for Technology category', 'success', NULL, '2025-01-27 15:10:00'),
('crawler_warning', 'TikTok crawler paused due to rate limiting', 'warning', 6, '2025-01-27 14:30:00'),
('data_ingestion', 'Successfully processed 1,234 new posts from Facebook', 'success', 2, '2025-01-27 15:22:00'),
('data_quality', 'Data quality check completed - 94.8% success rate', 'success', NULL, '2025-01-27 15:18:00'),
('topic_modeling', 'Identified trending topic: Climate Summit 2025', 'info', NULL, '2025-01-27 15:12:00');

-- Create useful views for dashboard queries
CREATE VIEW dashboard_stats AS
SELECT 
    COUNT(*) as total_posts,
    COUNT(DISTINCT data_source_id) as total_sources,
    (SELECT COUNT(*) FROM crawlers WHERE status = 'active') as active_crawlers,
    MAX(collected_at) as last_updated,
    (SELECT COALESCE(AVG(processing_rate), 0)::INTEGER FROM crawlers WHERE status = 'active') as processing_rate,
    (SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posts) 
     FROM post_analysis WHERE processed_at IS NOT NULL) as data_quality
FROM posts;

CREATE VIEW source_breakdown AS
SELECT 
    ds.name,
    COUNT(p.id) as posts,
    ROUND(COUNT(p.id) * 100.0 / (SELECT COUNT(*) FROM posts), 1) as percentage,
    ds.status,
    ds.last_sync,
    ds.health_score as health
FROM data_sources ds
LEFT JOIN posts p ON ds.id = p.data_source_id
GROUP BY ds.id, ds.name, ds.status, ds.last_sync, ds.health_score
ORDER BY posts DESC;

CREATE VIEW sentiment_breakdown AS
SELECT 
    sentiment,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM post_analysis), 1) as percentage
FROM post_analysis
WHERE sentiment IS NOT NULL
GROUP BY sentiment;

CREATE VIEW language_breakdown AS
SELECT 
    language,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posts WHERE language IS NOT NULL), 1) as percentage
FROM posts
WHERE language IS NOT NULL
GROUP BY language
ORDER BY count DESC;

CREATE VIEW topic_trends AS
WITH topic_counts AS (
    SELECT 
        unnest(topics) as topic,
        COUNT(*) as posts,
        CASE 
            WHEN random() < 0.6 THEN 'up'
            WHEN random() < 0.8 THEN 'down'
            ELSE 'stable'
        END as trend
    FROM post_analysis
    WHERE topics IS NOT NULL
    GROUP BY unnest(topics), trend
)
SELECT topic, posts, trend
FROM topic_counts
ORDER BY posts DESC
LIMIT 10;

CREATE VIEW hourly_activity AS
SELECT 
    DATE_TRUNC('hour', created_at)::TIME as hour,
    COUNT(*) as posts
FROM posts
WHERE created_at >= NOW() - interval '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour;