-- Unified Social Analytics Database Schema for DuckDB
-- Combines all analytics modules into a single database for cross-table analysis
-- This replaces all individual schema files and enables comprehensive analytics

-- =============================================================================
-- CORE SOCIAL MEDIA DATA INFRASTRUCTURE
-- =============================================================================

-- Drop existing tables if they exist (in correct order to handle foreign keys)
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS post_analysis;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS data_sources;
DROP TABLE IF EXISTS crawlers;

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
);

-- =============================================================================
-- SAMPLE DATA INSERTION
-- =============================================================================

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

-- Insert supported languages
INSERT INTO languages (id, code, name, native_name, script, direction) VALUES
(1, 'en', 'English', 'English', 'Latin', 'ltr'),
(2, 'es', 'Spanish', 'Español', 'Latin', 'ltr'),
(3, 'fr', 'French', 'Français', 'Latin', 'ltr'),
(4, 'de', 'German', 'Deutsch', 'Latin', 'ltr'),
(5, 'pt', 'Portuguese', 'Português', 'Latin', 'ltr'),
(6, 'it', 'Italian', 'Italiano', 'Latin', 'ltr'),
(7, 'ja', 'Japanese', '日本語', 'Hiragana/Katakana/Kanji', 'ltr'),
(8, 'ko', 'Korean', '한국어', 'Hangul', 'ltr'),
(9, 'zh', 'Chinese', '中文', 'Chinese', 'ltr'),
(10, 'ar', 'Arabic', 'العربية', 'Arabic', 'rtl');

-- Insert content types
INSERT INTO content_types (id, name, description, avg_engagement_rate) VALUES
(1, 'Video', 'Video content posts', 4.85),
(2, 'Image', 'Single image posts', 3.21),
(3, 'Carousel', 'Multiple image carousel posts', 3.67),
(4, 'Text Only', 'Text-only posts without media', 2.14),
(5, 'Link', 'Posts with external links', 1.89),
(6, 'Story', 'Temporary story content', 5.32),
(7, 'Live', 'Live streaming content', 6.78);

-- Insert sample posts
INSERT INTO posts (id, data_source_id, external_id, content, author, language, created_at, collected_at) VALUES
(1, 1, 'tw_001', 'This new product launch is absolutely incredible! Best decision I''ve ever made 🎉', 'user_001', 'en', '2025-01-27 14:32:00', '2025-01-27 14:35:00'),
(2, 2, 'fb_001', 'The customer service was helpful and resolved my issue quickly. Thank you!', 'user_002', 'en', '2025-01-27 13:15:00', '2025-01-27 13:18:00'),
(3, 4, 'rd_001', 'Not sure what to think about the recent updates. Some good, some bad I guess.', 'user_003', 'en', '2025-01-27 12:45:00', '2025-01-27 12:47:00'),
(4, 3, 'ig_001', 'Really disappointed with the quality. Expected much better for the price.', 'user_004', 'en', '2025-01-27 11:20:00', '2025-01-27 11:23:00'),
(5, 1, 'tw_002', 'This is absolutely terrible! Waste of money and time. Completely frustrated!', 'user_005', 'en', '2025-01-27 10:38:00', '2025-01-27 10:41:00'),
(6, 5, 'li_001', 'Great experience overall! The team was professional and efficient.', 'user_006', 'en', '2025-01-27 09:40:00', '2025-01-27 09:43:00'),
(7, 1, 'tw_003', 'Amazing customer support! They went above and beyond to help me.', 'user_007', 'en', '2025-01-27 08:55:00', '2025-01-27 08:58:00'),
(8, 3, 'ig_002', 'The app keeps crashing. Very annoying and frustrating experience.', 'user_008', 'en', '2025-01-27 08:00:00', '2025-01-27 08:03:00'),
(9, 4, 'rd_002', 'It''s okay, nothing special but gets the job done I suppose.', 'user_009', 'en', '2025-01-27 07:20:00', '2025-01-27 07:23:00'),
(10, 2, 'fb_002', 'Love the new features! This update makes everything so much easier.', 'user_010', 'en', '2025-01-27 06:40:00', '2025-01-27 06:43:00');

-- Insert sentiment classifications
INSERT INTO sentiment_classifications (id, post_id, sentiment_category, confidence_score) VALUES
(1, 1, 'Very Positive', 0.94),
(2, 2, 'Positive', 0.87),
(3, 3, 'Neutral', 0.82),
(4, 4, 'Negative', 0.91),
(5, 5, 'Very Negative', 0.96),
(6, 6, 'Positive', 0.89),
(7, 7, 'Very Positive', 0.93),
(8, 8, 'Negative', 0.88),
(9, 9, 'Neutral', 0.79),
(10, 10, 'Positive', 0.92);

-- Insert emotion analysis data
INSERT INTO emotion_analysis (id, post_id, emotion, intensity_score, confidence) VALUES
-- Post 1 emotions (Very Positive)
(1, 1, 'Joy', 92.5, 0.94),
(2, 1, 'Trust', 78.3, 0.89),
-- Post 2 emotions (Positive)
(3, 2, 'Trust', 85.7, 0.87),
(4, 2, 'Joy', 65.2, 0.82),
-- Post 5 emotions (Very Negative)
(5, 5, 'Anger', 95.7, 0.96),
(6, 5, 'Disgust', 89.3, 0.93),
-- Post 7 emotions (Very Positive)
(7, 7, 'Joy', 91.2, 0.93),
(8, 7, 'Trust', 87.5, 0.90),
-- Post 8 emotions (Negative)
(9, 8, 'Anger', 78.4, 0.88),
(10, 8, 'Disgust', 71.2, 0.84);

-- Insert language detection for posts
INSERT INTO language_detection (id, post_id, language_id, confidence_score) VALUES
(1, 1, 1, 0.98), -- English
(2, 2, 1, 0.96),
(3, 3, 1, 0.94),
(4, 4, 1, 0.97),
(5, 5, 1, 0.95),
(6, 6, 1, 0.99),
(7, 7, 1, 0.98),
(8, 8, 1, 0.93),
(9, 9, 1, 0.91),
(10, 10, 1, 0.97);

-- Insert post engagement data
INSERT INTO post_engagement (id, post_id, content_type_id, likes_count, comments_count, shares_count, views_count, reach, engagement_rate) VALUES
(1, 1, 2, 24, 12, 8, 1240, 980, 4.49), -- Image post
(2, 2, 4, 15, 5, 3, 890, 720, 3.19),   -- Text only
(3, 3, 4, 7, 18, 1, 650, 540, 4.81),   -- Text only
(4, 4, 2, 3, 22, 0, 780, 650, 3.85),   -- Image post
(5, 5, 4, 1, 34, 0, 1120, 950, 3.68),  -- Text only
(6, 6, 4, 45, 8, 12, 1580, 1200, 5.42), -- Text only
(7, 7, 4, 32, 6, 14, 1340, 1100, 4.73), -- Text only
(8, 8, 4, 2, 28, 1, 920, 780, 3.97),   -- Text only
(9, 9, 4, 12, 9, 2, 690, 580, 3.97),   -- Text only
(10, 10, 4, 28, 11, 7, 1200, 980, 4.69); -- Text only

-- Insert topics
INSERT INTO topics (id, topic_id, name, category, category_color, size, weight, coherence_score) VALUES
(1, 'tech-ai', 'Artificial Intelligence', 'Technology', '#3b82f6', 847, 0.245, 0.892),
(2, 'health-mental', 'Mental Health Awareness', 'Health', '#ef4444', 723, 0.201, 0.867),
(3, 'env-climate', 'Climate Change Impact', 'Environment', '#10b981', 656, 0.189, 0.834),
(4, 'customer-service', 'Customer Service Experience', 'Business', '#8b5cf6', 534, 0.156, 0.798),
(5, 'product-quality', 'Product Quality & Reviews', 'Business', '#f59e0b', 467, 0.134, 0.756);

-- Insert topic keywords
INSERT INTO topic_keywords (id, topic_id, keyword, weight, rank_position) VALUES
-- Customer Service topic keywords
(1, 4, 'customer service', 0.3012, 1),
(2, 4, 'support', 0.2456, 2),
(3, 4, 'help', 0.2134, 3),
(4, 4, 'team', 0.1789, 4),
(5, 4, 'experience', 0.1456, 5),
-- Product Quality keywords
(6, 5, 'quality', 0.2987, 1),
(7, 5, 'product', 0.2234, 2),
(8, 5, 'price', 0.1998, 3),
(9, 5, 'disappointed', 0.1656, 4),
(10, 5, 'features', 0.1423, 5);

-- Insert document-topic assignments
INSERT INTO document_topics (id, post_id, topic_id, probability, is_primary) VALUES
(1, 2, 4, 0.8945, TRUE),  -- Customer service post
(2, 6, 4, 0.9234, TRUE),  -- Professional team post
(3, 7, 4, 0.8765, TRUE),  -- Customer support post
(4, 4, 5, 0.9123, TRUE),  -- Quality disappointment post
(5, 1, 5, 0.7876, TRUE),  -- Product launch post
(6, 10, 5, 0.8654, TRUE); -- New features post

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