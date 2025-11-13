-- Complete Engagement Analysis Schema for DuckDB
-- Creates all required tables and data for engagement analysis dashboard

-- Create data_sources table if it doesn't exist
CREATE TABLE IF NOT EXISTS data_sources (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE, -- Instagram, TikTok, Twitter, LinkedIn, etc.
    type VARCHAR(50) NOT NULL, -- social_media, news, blog, etc.
    api_endpoint VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    data_source_id INTEGER REFERENCES data_sources(id),
    content TEXT,
    author VARCHAR(255),
    author_id VARCHAR(100),
    url VARCHAR(500),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Post engagement metrics (extends base posts table)
CREATE TABLE IF NOT EXISTS post_engagement (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    content_type_id INTEGER REFERENCES content_types(id),
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0, -- Unique users who saw the post
    impressions INTEGER DEFAULT 0, -- Total times the post was displayed
    engagement_rate DECIMAL(5,2) DEFAULT 0.0, -- Total engagements / reach * 100
    click_through_rate DECIMAL(5,2) DEFAULT 0.0, -- For link posts
    video_completion_rate DECIMAL(5,2) DEFAULT 0.0, -- For video posts
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily engagement aggregations by platform
CREATE TABLE IF NOT EXISTS daily_engagement (
    id INTEGER PRIMARY KEY,
    data_source_id INTEGER REFERENCES data_sources(id),
    analysis_date DATE NOT NULL,
    total_likes INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    total_saves INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_reach INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    avg_engagement_rate DECIMAL(5,2) DEFAULT 0.0,
    best_performing_post_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_source_id, analysis_date)
);

-- Content performance by type and platform
CREATE TABLE IF NOT EXISTS content_performance (
    id INTEGER PRIMARY KEY,
    data_source_id INTEGER REFERENCES data_sources(id),
    content_type_id INTEGER REFERENCES content_types(id),
    analysis_date DATE NOT NULL,
    posts_count INTEGER DEFAULT 0,
    avg_likes DECIMAL(8,2) DEFAULT 0.0,
    avg_comments DECIMAL(8,2) DEFAULT 0.0,
    avg_shares DECIMAL(8,2) DEFAULT 0.0,
    avg_engagement_rate DECIMAL(5,2) DEFAULT 0.0,
    avg_reach INTEGER DEFAULT 0,
    total_reach INTEGER DEFAULT 0,
    best_post_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_source_id, content_type_id, analysis_date)
);

-- Engagement patterns and timing analysis
CREATE TABLE IF NOT EXISTS engagement_timing (
    id INTEGER PRIMARY KEY,
    data_source_id INTEGER REFERENCES data_sources(id),
    hour_of_day INTEGER NOT NULL, -- 0-23
    day_of_week INTEGER NOT NULL, -- 1-7 (Monday = 1)
    avg_engagement_rate DECIMAL(5,2) DEFAULT 0.0,
    posts_count INTEGER DEFAULT 0,
    total_engagements INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_source_id, hour_of_day, day_of_week)
);

-- Audience engagement demographics (if available)
CREATE TABLE IF NOT EXISTS audience_engagement (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    age_group VARCHAR(20), -- 18-24, 25-34, 35-44, 45-54, 55+
    gender VARCHAR(10), -- Male, Female, Other
    location VARCHAR(100), -- Country or region
    engagement_type VARCHAR(20), -- like, comment, share, save
    engagement_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hashtag and mention engagement tracking
CREATE TABLE IF NOT EXISTS hashtag_engagement (
    id INTEGER PRIMARY KEY,
    hashtag VARCHAR(100) NOT NULL,
    post_id INTEGER REFERENCES posts(id),
    engagement_boost DECIMAL(5,2) DEFAULT 0.0, -- % increase from baseline
    usage_count INTEGER DEFAULT 1,
    avg_engagement_rate DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert data sources if they don't exist
INSERT OR IGNORE INTO data_sources (id, name, type) VALUES
(1, 'Instagram', 'social_media'),
(2, 'TikTok', 'social_media'),
(3, 'Twitter', 'social_media'),
(4, 'LinkedIn', 'social_media'),
(5, 'Facebook', 'social_media'),
(6, 'YouTube', 'social_media'),
(7, 'Reddit', 'social_media');

-- Update content_types with proper data if needed
INSERT OR IGNORE INTO content_types (id, name, description, avg_engagement_rate) VALUES
(1, 'Video', 'Video posts including reels, stories, and regular videos', 7.2),
(2, 'Image', 'Single image posts', 5.1),
(3, 'Carousel', 'Multiple images or slides in one post', 6.8),
(4, 'Story', 'Temporary story content', 4.9),
(5, 'Text Only', 'Text-based posts without media', 2.1),
(6, 'Link', 'Posts with external links', 1.8),
(7, 'Live', 'Live streaming content', 8.5),
(8, 'Poll', 'Interactive poll posts', 6.3);

-- Generate sample posts data
INSERT OR IGNORE INTO posts (id, data_source_id, content, author, published_at)
WITH post_sample AS (
    SELECT gs.generate_series as id
    FROM generate_series(1, 30000) gs
)
SELECT 
    ps.id,
    (1 + (ps.id % 7)) as data_source_id,
    'Sample post content for analysis #' || ps.id as content,
    'User' || (ps.id % 1000) as author,
    CURRENT_TIMESTAMP - INTERVAL (ps.id % 365) DAY as published_at
FROM post_sample ps;

-- Sample post engagement data
INSERT OR IGNORE INTO post_engagement (id, post_id, content_type_id, likes_count, comments_count, shares_count, saves_count, views_count, reach, impressions, engagement_rate)
WITH post_sample AS (
    SELECT id as post_id
    FROM posts
    WHERE id <= 30000
),
engagement_data AS (
    SELECT 
        post_id,
        (1 + (post_id % 8)) as content_type_id,
        CASE 
            WHEN random() < 0.1 THEN (500 + random() * 2000)::INTEGER  -- Viral posts
            WHEN random() < 0.3 THEN (100 + random() * 400)::INTEGER   -- Good performing
            ELSE (5 + random() * 95)::INTEGER                          -- Average posts
        END as likes_count,
        CASE 
            WHEN random() < 0.1 THEN (50 + random() * 200)::INTEGER
            WHEN random() < 0.3 THEN (10 + random() * 40)::INTEGER
            ELSE (0 + random() * 20)::INTEGER
        END as comments_count,
        CASE 
            WHEN random() < 0.1 THEN (20 + random() * 100)::INTEGER
            WHEN random() < 0.3 THEN (3 + random() * 15)::INTEGER
            ELSE (0 + random() * 5)::INTEGER
        END as shares_count,
        (random() * 50)::INTEGER as saves_count,
        (1000 + random() * 9000)::INTEGER as views_count,
        (500 + random() * 4500)::INTEGER as reach,
        (800 + random() * 7200)::INTEGER as impressions
    FROM post_sample
)
SELECT 
    row_number() OVER () as id,
    post_id,
    content_type_id,
    likes_count,
    comments_count,
    shares_count,
    saves_count,
    views_count,
    reach,
    impressions,
    CASE 
        WHEN reach > 0 THEN ((likes_count + comments_count + shares_count + saves_count) * 100.0 / reach)::DECIMAL(5,2)
        ELSE 0.0
    END as engagement_rate
FROM engagement_data;

-- Sample daily engagement data (last 30 days)
INSERT OR IGNORE INTO daily_engagement (id, data_source_id, analysis_date, total_likes, total_comments, total_shares, total_saves, total_views, total_reach, total_impressions, posts_count, avg_engagement_rate)
WITH date_range AS (
    SELECT CURRENT_DATE - INTERVAL (gs.generate_series) DAY as analysis_date
    FROM generate_series(0, 29) gs
),
source_list AS (
    SELECT id as data_source_id
    FROM data_sources
)
SELECT 
    row_number() OVER () as id,
    sl.data_source_id,
    dr.analysis_date,
    (8000 + random() * 4000)::INTEGER as total_likes,
    (2000 + random() * 1500)::INTEGER as total_comments,
    (800 + random() * 600)::INTEGER as total_shares,
    (400 + random() * 300)::INTEGER as total_saves,
    (50000 + random() * 30000)::INTEGER as total_views,
    (25000 + random() * 15000)::INTEGER as total_reach,
    (40000 + random() * 25000)::INTEGER as total_impressions,
    (15 + random() * 10)::INTEGER as posts_count,
    (2.5 + random() * 3.5)::DECIMAL(5,2) as avg_engagement_rate
FROM date_range dr
CROSS JOIN source_list sl;

-- Sample engagement timing data
INSERT OR IGNORE INTO engagement_timing (id, data_source_id, hour_of_day, day_of_week, avg_engagement_rate, posts_count, total_engagements)
WITH source_list AS (
    SELECT id as data_source_id
    FROM data_sources
),
time_combinations AS (
    SELECT 
        data_source_id,
        hour_val as hour_of_day,
        dow_val as day_of_week
    FROM source_list
    CROSS JOIN generate_series(0, 23) hour_val(hour_val)
    CROSS JOIN generate_series(1, 7) dow_val(dow_val)
)
SELECT 
    row_number() OVER () as id,
    data_source_id,
    hour_of_day,
    day_of_week,
    -- Simulate realistic engagement patterns
    CASE 
        WHEN hour_of_day BETWEEN 9 AND 11 OR hour_of_day BETWEEN 19 AND 21 THEN (4.5 + random() * 2.5)::DECIMAL(5,2)
        WHEN hour_of_day BETWEEN 12 AND 14 OR hour_of_day BETWEEN 17 AND 19 THEN (3.8 + random() * 2.0)::DECIMAL(5,2)
        WHEN hour_of_day BETWEEN 22 AND 23 OR hour_of_day BETWEEN 7 AND 9 THEN (3.2 + random() * 1.8)::DECIMAL(5,2)
        ELSE (2.1 + random() * 1.5)::DECIMAL(5,2)
    END as avg_engagement_rate,
    (5 + random() * 15)::INTEGER as posts_count,
    (100 + random() * 400)::INTEGER as total_engagements
FROM time_combinations;

-- Sample hashtag engagement data
INSERT OR IGNORE INTO hashtag_engagement (id, hashtag, post_id, engagement_boost, usage_count, avg_engagement_rate)
WITH popular_hashtags AS (
    SELECT unnest(['#technology', '#innovation', '#AI', '#startup', '#business', '#socialmedia', '#marketing', '#growth', '#productivity', '#success', '#motivation', '#inspiration', '#entrepreneur', '#leadership', '#teamwork', '#creativity', '#design', '#development', '#coding', '#data']) as hashtag
),
hashtag_posts AS (
    SELECT 
        ph.hashtag,
        (1 + (row_number() OVER () % 30000)) as post_id,
        (-1.5 + random() * 4.5)::DECIMAL(5,2) as engagement_boost, -- -1.5% to +3.0% boost
        (1 + random() * 50)::INTEGER as usage_count,
        (2.5 + random() * 4.0)::DECIMAL(5,2) as avg_engagement_rate
    FROM popular_hashtags ph
    CROSS JOIN generate_series(1, 100) gs -- 100 posts per hashtag
    WHERE random() < 0.3 -- Only 30% of combinations exist
)
SELECT 
    row_number() OVER () as id,
    hashtag,
    post_id,
    engagement_boost,
    usage_count,
    avg_engagement_rate
FROM hashtag_posts;