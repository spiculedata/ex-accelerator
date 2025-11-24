-- Engagement Analysis Schema for DuckDB
-- Extends the base dashboard schema with engagement analysis specific tables
-- Supports engagement tracking, performance metrics, and content optimization

-- Content types for categorizing posts
CREATE TABLE content_types (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- Video, Image, Carousel, Story, Text Only, Link, etc.
    description TEXT,
    avg_engagement_rate DECIMAL(4,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Post engagement metrics (extends base posts table)
CREATE TABLE post_engagement (
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
CREATE TABLE daily_engagement (
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
CREATE TABLE content_performance (
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
CREATE TABLE engagement_timing (
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
CREATE TABLE audience_engagement (
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
CREATE TABLE hashtag_engagement (
    id INTEGER PRIMARY KEY,
    hashtag VARCHAR(100) NOT NULL,
    post_id INTEGER REFERENCES posts(id),
    engagement_boost DECIMAL(5,2) DEFAULT 0.0, -- % increase from baseline
    usage_count INTEGER DEFAULT 1,
    avg_engagement_rate DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert content types
INSERT INTO content_types (id, name, description, avg_engagement_rate) VALUES
(1, 'Video', 'Video posts including reels, stories, and regular videos', 7.2),
(2, 'Image', 'Single image posts', 5.1),
(3, 'Carousel', 'Multiple images or slides in one post', 6.8),
(4, 'Story', 'Temporary story content', 4.9),
(5, 'Text Only', 'Text-based posts without media', 2.1),
(6, 'Link', 'Posts with external links', 1.8),
(7, 'Live', 'Live streaming content', 8.5),
(8, 'Poll', 'Interactive poll posts', 6.3);

-- Sample post engagement data
INSERT INTO post_engagement (id, post_id, content_type_id, likes_count, comments_count, shares_count, saves_count, views_count, reach, impressions, engagement_rate)
WITH post_sample AS (
    SELECT generate_series as post_id
    FROM generate_series(1, 30000)
),
engagement_data AS (
    SELECT 
        post_id,
        (1 + random() * 7)::INTEGER as content_type_id,
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
INSERT INTO daily_engagement (id, data_source_id, analysis_date, total_likes, total_comments, total_shares, total_saves, total_views, total_reach, total_impressions, posts_count, avg_engagement_rate)
WITH date_range AS (
    SELECT CURRENT_DATE - INTERVAL (generate_series) DAY as analysis_date
    FROM generate_series(0, 29)
),
source_list AS (
    SELECT generate_series as data_source_id
    FROM generate_series(1, 7) -- 7 data sources
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

-- Sample content performance data
INSERT INTO content_performance (id, data_source_id, content_type_id, analysis_date, posts_count, avg_likes, avg_comments, avg_shares, avg_engagement_rate, avg_reach, total_reach)
WITH date_range AS (
    SELECT CURRENT_DATE - INTERVAL (generate_series) DAY as analysis_date
    FROM generate_series(0, 6) -- Last 7 days
),
source_list AS (
    SELECT generate_series as data_source_id
    FROM generate_series(1, 7)
),
content_list AS (
    SELECT id as content_type_id FROM content_types
)
SELECT 
    row_number() OVER () as id,
    sl.data_source_id,
    cl.content_type_id,
    dr.analysis_date,
    (2 + random() * 5)::INTEGER as posts_count,
    CASE cl.content_type_id
        WHEN 1 THEN (200 + random() * 300)::DECIMAL(8,2)  -- Video
        WHEN 2 THEN (80 + random() * 120)::DECIMAL(8,2)   -- Image
        WHEN 3 THEN (150 + random() * 200)::DECIMAL(8,2)  -- Carousel
        WHEN 4 THEN (60 + random() * 90)::DECIMAL(8,2)    -- Story
        WHEN 5 THEN (20 + random() * 40)::DECIMAL(8,2)    -- Text
        WHEN 6 THEN (15 + random() * 25)::DECIMAL(8,2)    -- Link
        WHEN 7 THEN (300 + random() * 400)::DECIMAL(8,2)  -- Live
        ELSE (70 + random() * 100)::DECIMAL(8,2)          -- Poll
    END as avg_likes,
    CASE cl.content_type_id
        WHEN 1 THEN (40 + random() * 60)::DECIMAL(8,2)
        WHEN 2 THEN (15 + random() * 25)::DECIMAL(8,2)
        WHEN 3 THEN (25 + random() * 35)::DECIMAL(8,2)
        WHEN 4 THEN (10 + random() * 15)::DECIMAL(8,2)
        WHEN 5 THEN (5 + random() * 10)::DECIMAL(8,2)
        WHEN 6 THEN (3 + random() * 7)::DECIMAL(8,2)
        WHEN 7 THEN (60 + random() * 80)::DECIMAL(8,2)
        ELSE (20 + random() * 30)::DECIMAL(8,2)
    END as avg_comments,
    CASE cl.content_type_id
        WHEN 1 THEN (15 + random() * 25)::DECIMAL(8,2)
        WHEN 2 THEN (8 + random() * 12)::DECIMAL(8,2)
        WHEN 3 THEN (12 + random() * 18)::DECIMAL(8,2)
        WHEN 4 THEN (5 + random() * 8)::DECIMAL(8,2)
        WHEN 5 THEN (2 + random() * 4)::DECIMAL(8,2)
        WHEN 6 THEN (1 + random() * 3)::DECIMAL(8,2)
        WHEN 7 THEN (25 + random() * 35)::DECIMAL(8,2)
        ELSE (10 + random() * 15)::DECIMAL(8,2)
    END as avg_shares,
    CASE cl.content_type_id
        WHEN 1 THEN (6.5 + random() * 2.0)::DECIMAL(5,2)
        WHEN 2 THEN (4.5 + random() * 1.5)::DECIMAL(5,2)
        WHEN 3 THEN (6.0 + random() * 1.8)::DECIMAL(5,2)
        WHEN 4 THEN (4.2 + random() * 1.4)::DECIMAL(5,2)
        WHEN 5 THEN (1.8 + random() * 0.8)::DECIMAL(5,2)
        WHEN 6 THEN (1.5 + random() * 0.6)::DECIMAL(5,2)
        WHEN 7 THEN (7.8 + random() * 2.4)::DECIMAL(5,2)
        ELSE (5.8 + random() * 1.6)::DECIMAL(5,2)
    END as avg_engagement_rate,
    (2000 + random() * 3000)::INTEGER as avg_reach,
    (6000 + random() * 9000)::INTEGER as total_reach
FROM date_range dr
CROSS JOIN source_list sl
CROSS JOIN content_list cl;

-- Sample engagement timing data
INSERT INTO engagement_timing (id, data_source_id, hour_of_day, day_of_week, avg_engagement_rate, posts_count, total_engagements)
WITH source_list AS (
    SELECT generate_series as data_source_id
    FROM generate_series(1, 7)
),
time_combinations AS (
    SELECT 
        data_source_id,
        hour_val as hour_of_day,
        dow_val as day_of_week
    FROM source_list
    CROSS JOIN generate_series(0, 23) as hour_val
    CROSS JOIN generate_series(1, 7) as dow_val
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
INSERT INTO hashtag_engagement (id, hashtag, post_id, engagement_boost, usage_count, avg_engagement_rate)
WITH popular_hashtags AS (
    SELECT unnest(['#technology', '#innovation', '#AI', '#startup', '#business', '#socialmedia', '#marketing', '#growth', '#productivity', '#success', '#motivation', '#inspiration', '#entrepreneur', '#leadership', '#teamwork', '#creativity', '#design', '#development', '#coding', '#data']) as hashtag
),
hashtag_posts AS (
    SELECT 
        ph.hashtag,
        (1 + random() * 30000)::INTEGER as post_id,
        (-1.5 + random() * 4.5)::DECIMAL(5,2) as engagement_boost, -- -1.5% to +3.0% boost
        (1 + random() * 50)::INTEGER as usage_count,
        (2.5 + random() * 4.0)::DECIMAL(5,2) as avg_engagement_rate
    FROM popular_hashtags ph
    CROSS JOIN generate_series(1, 100) -- 100 posts per hashtag
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

-- Analytical views for engagement analysis

-- Platform engagement overview
CREATE VIEW platform_engagement_overview AS
SELECT 
    ds.name as platform,
    COUNT(pe.id) as total_posts,
    AVG(pe.engagement_rate) as avg_engagement_rate,
    SUM(pe.likes_count) as total_likes,
    SUM(pe.comments_count) as total_comments,
    SUM(pe.shares_count) as total_shares,
    SUM(pe.reach) as total_reach,
    AVG(pe.likes_count) as avg_likes,
    AVG(pe.comments_count) as avg_comments,
    AVG(pe.shares_count) as avg_shares,
    MAX(pe.engagement_rate) as best_engagement_rate
FROM data_sources ds
JOIN posts p ON ds.id = p.data_source_id
JOIN post_engagement pe ON p.id = pe.post_id
GROUP BY ds.id, ds.name
ORDER BY avg_engagement_rate DESC;

-- Content type performance
CREATE VIEW content_type_performance AS
SELECT 
    ct.name as content_type,
    COUNT(pe.id) as posts_count,
    AVG(pe.engagement_rate) as avg_engagement_rate,
    AVG(pe.likes_count) as avg_likes,
    AVG(pe.comments_count) as avg_comments,
    AVG(pe.shares_count) as avg_shares,
    AVG(pe.reach) as avg_reach,
    SUM(pe.reach) as total_reach,
    MAX(pe.engagement_rate) as best_rate
FROM content_types ct
JOIN post_engagement pe ON ct.id = pe.content_type_id
GROUP BY ct.id, ct.name
ORDER BY avg_engagement_rate DESC;

-- Daily engagement trends
CREATE VIEW daily_engagement_trends AS
SELECT 
    de.analysis_date,
    SUM(de.total_likes) as daily_likes,
    SUM(de.total_comments) as daily_comments,
    SUM(de.total_shares) as daily_shares,
    SUM(de.total_reach) as daily_reach,
    AVG(de.avg_engagement_rate) as avg_engagement_rate,
    SUM(de.posts_count) as total_posts
FROM daily_engagement de
GROUP BY de.analysis_date
ORDER BY de.analysis_date DESC;

-- Top performing posts
CREATE VIEW top_performing_posts AS
SELECT 
    p.id,
    p.content,
    p.author,
    p.created_at,
    ds.name as platform,
    ct.name as content_type,
    pe.likes_count,
    pe.comments_count,
    pe.shares_count,
    pe.reach,
    pe.engagement_rate,
    ROW_NUMBER() OVER (ORDER BY pe.engagement_rate DESC) as performance_rank
FROM posts p
JOIN data_sources ds ON p.data_source_id = ds.id
JOIN post_engagement pe ON p.id = pe.post_id
JOIN content_types ct ON pe.content_type_id = ct.id
WHERE pe.engagement_rate > 0
ORDER BY pe.engagement_rate DESC
LIMIT 100;

-- Engagement timing analysis
CREATE VIEW best_posting_times AS
SELECT 
    et.hour_of_day,
    et.day_of_week,
    CASE et.day_of_week
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday' 
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
        ELSE 'Sunday'
    END as day_name,
    AVG(et.avg_engagement_rate) as avg_engagement_rate,
    SUM(et.posts_count) as total_posts,
    SUM(et.total_engagements) as total_engagements
FROM engagement_timing et
GROUP BY et.hour_of_day, et.day_of_week
ORDER BY avg_engagement_rate DESC;

-- Hashtag performance analysis
CREATE VIEW hashtag_performance AS
SELECT 
    he.hashtag,
    COUNT(*) as usage_count,
    AVG(he.engagement_boost) as avg_boost,
    AVG(he.avg_engagement_rate) as avg_engagement_rate,
    COUNT(*) * AVG(he.engagement_boost) as impact_score
FROM hashtag_engagement he
GROUP BY he.hashtag
HAVING COUNT(*) >= 10 -- Only hashtags used at least 10 times
ORDER BY impact_score DESC
LIMIT 50;