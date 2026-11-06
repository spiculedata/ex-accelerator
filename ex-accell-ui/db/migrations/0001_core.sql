-- Core data sources table
CREATE TABLE data_sources (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    health_score INTEGER DEFAULT 100,
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crawlers table
CREATE TABLE crawlers (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    data_source_id INTEGER REFERENCES data_sources(id),
    status VARCHAR(20) DEFAULT 'active',
    processing_rate INTEGER DEFAULT 0,
    last_run TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Core posts table (foundation for all analytics)
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

-- Activity logs table
CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY,
    activity_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'info',
    data_source_id INTEGER REFERENCES data_sources(id),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SENTIMENT ANALYSIS MODULE
-- =============================================================================

-- Sentiment classifications for each post
CREATE TABLE sentiment_classifications (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    sentiment_category VARCHAR(50) NOT NULL, -- Very Positive, Positive, Neutral, Negative, Very Negative
    confidence_score DECIMAL(4,3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    analysis_model VARCHAR(100) DEFAULT 'AI_SENTIMENT_V1',
    classification_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emotion analysis for posts
CREATE TABLE emotion_analysis (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    emotion VARCHAR(50) NOT NULL, -- Joy, Trust, Fear, Surprise, Sadness, Disgust, Anger
    intensity_score DECIMAL(5,2) NOT NULL CHECK (intensity_score >= 0 AND intensity_score <= 100),
    confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Temporal sentiment trends for time-based analysis
CREATE TABLE sentiment_temporal_trends (
    id INTEGER PRIMARY KEY,
    analysis_date DATE NOT NULL,
    analysis_hour INTEGER NOT NULL CHECK (analysis_hour >= 0 AND analysis_hour <= 23),
    platform VARCHAR(50) NOT NULL,
    positive_count INTEGER NOT NULL DEFAULT 0,
    negative_count INTEGER NOT NULL DEFAULT 0,
    neutral_count INTEGER NOT NULL DEFAULT 0,
    total_posts INTEGER NOT NULL DEFAULT 0,
    avg_confidence DECIMAL(4,3) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(analysis_date, analysis_hour, platform)
);

-- Sentiment keywords and their impact
CREATE TABLE sentiment_keywords (
    id INTEGER PRIMARY KEY,
    keyword VARCHAR(200) NOT NULL,
    sentiment_type VARCHAR(50) NOT NULL, -- positive, negative, neutral
    frequency INTEGER NOT NULL DEFAULT 0,
    impact_score DECIMAL(4,2) NOT NULL DEFAULT 0, -- 0-10 impact rating
    platforms TEXT, -- JSON array of platforms where keyword appears
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TOPIC MODELING MODULE
-- =============================================================================

-- Topic definitions and metadata
CREATE TABLE topics (
    id INTEGER PRIMARY KEY,
    topic_id VARCHAR(100) NOT NULL UNIQUE, -- Human-readable topic ID
    name VARCHAR(300) NOT NULL,
    category VARCHAR(100) NOT NULL,
    category_color VARCHAR(20) DEFAULT '#3b82f6',
    size INTEGER NOT NULL DEFAULT 0, -- Number of documents in topic
    weight DECIMAL(5,3) NOT NULL DEFAULT 0, -- Topic weight/importance
    coherence_score DECIMAL(4,3), -- Topic coherence measure
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Topic keywords and their weights
CREATE TABLE topic_keywords (
    id INTEGER PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    keyword VARCHAR(200) NOT NULL,
    weight DECIMAL(6,4) NOT NULL, -- Keyword weight in topic
    rank_position INTEGER NOT NULL, -- Rank of keyword in topic
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document-topic assignments (many-to-many relationship with posts)
CREATE TABLE document_topics (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id), -- Links to posts table
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    probability DECIMAL(6,4) NOT NULL, -- Post belongs to topic with this probability
    is_primary BOOLEAN DEFAULT FALSE, -- Whether this is the primary topic for the post
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, topic_id)
);

-- Topic relationships and clustering
CREATE TABLE topic_relationships (
    id INTEGER PRIMARY KEY,
    topic1_id INTEGER NOT NULL REFERENCES topics(id),
    topic2_id INTEGER NOT NULL REFERENCES topics(id),
    similarity_score DECIMAL(5,4) NOT NULL, -- Similarity between topics
    relationship_type VARCHAR(50) NOT NULL, -- SIMILAR, HIERARCHICAL, OVERLAPPING
    strength DECIMAL(3,2) NOT NULL, -- Relationship strength 0-1
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(topic1_id, topic2_id)
);

-- Topic evolution over time
CREATE TABLE topic_trends (
    id INTEGER PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    analysis_date DATE NOT NULL,
    document_count INTEGER NOT NULL,
    average_engagement DECIMAL(5,2),
    growth_rate DECIMAL(6,3), -- Growth rate compared to previous period
    trend_direction VARCHAR(20), -- RISING, FALLING, STABLE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(topic_id, analysis_date)
);

-- =============================================================================
-- LANGUAGE DETECTION MODULE
-- =============================================================================

-- Language definitions and metadata
CREATE TABLE languages (
    id INTEGER PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE, -- ISO 639-1 language codes (en, es, fr, etc.)
    name VARCHAR(100) NOT NULL, -- Full language name (English, Spanish, French, etc.)
    native_name VARCHAR(100), -- Language name in its native script
    script VARCHAR(50), -- Writing system (Latin, Cyrillic, Arabic, etc.)
    direction VARCHAR(10) DEFAULT 'ltr', -- Text direction (ltr, rtl)
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Language detection results for individual posts
CREATE TABLE language_detection (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    language_id INTEGER REFERENCES languages(id),
    confidence_score DECIMAL(4,3) NOT NULL, -- 0.000 to 1.000
    detection_model VARCHAR(50) DEFAULT 'langdetect', -- AI model used for detection
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Language pairs and code-switching detection
CREATE TABLE language_mixing (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    primary_language_id INTEGER REFERENCES languages(id),
    secondary_language_id INTEGER REFERENCES languages(id),
    mixing_type VARCHAR(20) DEFAULT 'code-switching', -- code-switching, borrowing, transliteration
    primary_confidence DECIMAL(4,3),
    secondary_confidence DECIMAL(4,3),
    segment_count INTEGER DEFAULT 1, -- Number of language segments in post
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ENGAGEMENT ANALYSIS MODULE
-- =============================================================================

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

-- Hashtag and mention engagement tracking
CREATE TABLE hashtag_engagement (
    id INTEGER PRIMARY KEY,
    hashtag VARCHAR(100) NOT NULL,
    post_id INTEGER REFERENCES posts(id),
    engagement_boost DECIMAL(5,2) DEFAULT 0.0, -- % increase from baseline
    usage_count INTEGER DEFAULT 1,
    avg_engagement_rate DECIMAL(5,2) DEFAULT 0.0,
    impact_score DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ANDROID ANALYTICS MODULE
-- =============================================================================

-- Android device information
CREATE TABLE android_devices (
    id INTEGER PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL UNIQUE,
    manufacturer VARCHAR(50),
    model VARCHAR(100),
    android_version VARCHAR(20),
    api_level INTEGER,
    screen_resolution VARCHAR(20),
    ram_gb INTEGER,
    storage_gb INTEGER,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Android app usage data
CREATE TABLE android_app_usage (
    id INTEGER PRIMARY KEY,
    device_id VARCHAR(100) REFERENCES android_devices(device_id),
    package_name VARCHAR(200) NOT NULL,
    app_name VARCHAR(200),
    category VARCHAR(50),
    usage_duration_minutes INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    battery_usage_percent DECIMAL(5,2) DEFAULT 0.0,
    data_usage_mb DECIMAL(8,2) DEFAULT 0.0,
    analysis_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, package_name, analysis_date)
);

-- Android system metrics
CREATE TABLE android_system_metrics (
    id INTEGER PRIMARY KEY,
    device_id VARCHAR(100) REFERENCES android_devices(device_id),
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_percent DECIMAL(5,2),
    battery_level INTEGER,
    storage_usage_percent DECIMAL(5,2),
    network_usage_mb DECIMAL(8,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); -- New features post

-- =============================================================================
-- COMPREHENSIVE ANALYTICAL VIEWS FOR CROSS-TABLE ANALYSIS
-- =============================================================================

-- Unified post analysis view (combines all analytics)
CREATE VIEW unified_post_analysis AS
SELECT 
    p.id as post_id,
    p.content,
    p.author,
    p.created_at,
    ds.name as platform,
    ds.platform as platform_code,
    -- Language detection
    l.name as language_name,
    l.code as language_code,
    ld.confidence_score as language_confidence,
    -- Sentiment analysis
    sc.sentiment_category,
    sc.confidence_score as sentiment_confidence,
    -- Emotion analysis (aggregated)
    STRING_AGG(ea.emotion, ', ') as emotions,
    AVG(ea.intensity_score) as avg_emotion_intensity,
    -- Topic modeling
    t.name as primary_topic,
    t.category as topic_category,
    dt.probability as topic_probability,
    -- Engagement metrics
    pe.likes_count,
    pe.comments_count,
    pe.shares_count,
    pe.engagement_rate,
    pe.reach,
    ct.name as content_type
FROM posts p
LEFT JOIN data_sources ds ON p.data_source_id = ds.id
LEFT JOIN language_detection ld ON p.id = ld.post_id
LEFT JOIN languages l ON ld.language_id = l.id
LEFT JOIN sentiment_classifications sc ON p.id = sc.post_id
LEFT JOIN emotion_analysis ea ON p.id = ea.post_id
LEFT JOIN document_topics dt ON p.id = dt.post_id AND dt.is_primary = TRUE
LEFT JOIN topics t ON dt.topic_id = t.id
LEFT JOIN post_engagement pe ON p.id = pe.post_id
LEFT JOIN content_types ct ON pe.content_type_id = ct.id
GROUP BY p.id, p.content, p.author, p.created_at, ds.name, ds.platform, 
         l.name, l.code, ld.confidence_score, sc.sentiment_category, 
         sc.confidence_score, t.name, t.category, dt.probability,
         pe.likes_count, pe.comments_count, pe.shares_count, 
         pe.engagement_rate, pe.reach, ct.name
ORDER BY p.created_at DESC;

-- Cross-platform sentiment comparison
CREATE VIEW cross_platform_sentiment AS
SELECT 
    ds.name as platform,
    sc.sentiment_category,
    COUNT(*) as post_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY ds.name), 1) as platform_percentage,
    ROUND(AVG(sc.confidence_score), 3) as avg_confidence,
    ROUND(AVG(pe.engagement_rate), 2) as avg_engagement_rate
FROM posts p
JOIN data_sources ds ON p.data_source_id = ds.id
JOIN sentiment_classifications sc ON p.id = sc.post_id
LEFT JOIN post_engagement pe ON p.id = pe.post_id
GROUP BY ds.name, sc.sentiment_category
ORDER BY ds.name, post_count DESC;

-- Topic performance across platforms
CREATE VIEW topic_platform_performance AS
SELECT 
    t.name as topic_name,
    t.category as topic_category,
    ds.name as platform,
    COUNT(dt.post_id) as post_count,
    AVG(dt.probability) as avg_topic_probability,
    AVG(pe.engagement_rate) as avg_engagement_rate,
    AVG(pe.likes_count) as avg_likes,
    AVG(pe.comments_count) as avg_comments,
    AVG(pe.shares_count) as avg_shares
FROM topics t
JOIN document_topics dt ON t.id = dt.topic_id
JOIN posts p ON dt.post_id = p.id
JOIN data_sources ds ON p.data_source_id = ds.id
LEFT JOIN post_engagement pe ON p.id = pe.post_id
GROUP BY t.name, t.category, ds.name
HAVING COUNT(dt.post_id) >= 1
ORDER BY avg_engagement_rate DESC;

-- Language-sentiment correlation analysis
CREATE VIEW language_sentiment_correlation AS
SELECT 
    l.name as language_name,
    sc.sentiment_category,
    COUNT(*) as post_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY l.name), 1) as percentage_in_language,
    ROUND(AVG(sc.confidence_score), 3) as avg_sentiment_confidence,
    ROUND(AVG(ld.confidence_score), 3) as avg_language_confidence,
    ROUND(AVG(pe.engagement_rate), 2) as avg_engagement_rate
FROM posts p
JOIN language_detection ld ON p.id = ld.post_id
JOIN languages l ON ld.language_id = l.id
JOIN sentiment_classifications sc ON p.id = sc.post_id
LEFT JOIN post_engagement pe ON p.id = pe.post_id
GROUP BY l.name, sc.sentiment_category
ORDER BY l.name, post_count DESC;

-- Engagement performance by content characteristics
CREATE VIEW content_performance_analysis AS
SELECT 
    ct.name as content_type,
    ds.name as platform,
    sc.sentiment_category,
    COUNT(*) as post_count,
    AVG(pe.engagement_rate) as avg_engagement_rate,
    AVG(pe.likes_count) as avg_likes,
    AVG(pe.comments_count) as avg_comments,
    AVG(pe.shares_count) as avg_shares,
    AVG(pe.reach) as avg_reach,
    ROUND(AVG(sc.confidence_score), 3) as avg_sentiment_confidence
FROM posts p
JOIN data_sources ds ON p.data_source_id = ds.id
JOIN post_engagement pe ON p.id = pe.post_id
JOIN content_types ct ON pe.content_type_id = ct.id
JOIN sentiment_classifications sc ON p.id = sc.post_id
GROUP BY ct.name, ds.name, sc.sentiment_category
HAVING COUNT(*) >= 1
ORDER BY avg_engagement_rate DESC;

-- Comprehensive analytics dashboard view
CREATE VIEW analytics_dashboard_summary AS
SELECT 
    'Total Posts' as metric,
    COUNT(*)::TEXT as value,
    'posts' as unit
FROM posts
UNION ALL
SELECT 
    'Average Engagement Rate' as metric,
    ROUND(AVG(pe.engagement_rate), 2)::TEXT as value,
    '%' as unit
FROM post_engagement pe
UNION ALL
SELECT 
    'Positive Sentiment Ratio' as metric,
    ROUND(COUNT(CASE WHEN sc.sentiment_category IN ('Very Positive', 'Positive') THEN 1 END) * 100.0 / COUNT(*), 1)::TEXT as value,
    '%' as unit
FROM sentiment_classifications sc
UNION ALL
SELECT 
    'Language Diversity' as metric,
    COUNT(DISTINCT ld.language_id)::TEXT as value,
    'languages' as unit
FROM language_detection ld
UNION ALL
SELECT 
    'Active Platforms' as metric,
    COUNT(DISTINCT ds.id)::TEXT as value,
    'platforms' as unit
FROM data_sources ds WHERE ds.status = 'active'
UNION ALL
SELECT 
    'Total Topics' as metric,
    COUNT(*)::TEXT as value,
    'topics' as unit
FROM topics;
