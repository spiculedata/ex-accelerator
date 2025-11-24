-- Sentiment Analysis Database Schema
-- Comprehensive social media sentiment analysis and emotion classification
-- This schema supports AI-powered sentiment tracking across multiple platforms

-- Core sentiment analysis data
CREATE TABLE IF NOT EXISTS sentiment_posts (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL, -- twitter, facebook, instagram, reddit, linkedin
    timestamp BIGINT NOT NULL,
    post_id VARCHAR(200), -- Platform-specific post ID
    user_id VARCHAR(100), -- Platform-specific user ID (anonymized)
    engagement_likes INTEGER DEFAULT 0,
    engagement_shares INTEGER DEFAULT 0, 
    engagement_comments INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sentiment classifications for each post
CREATE TABLE IF NOT EXISTS sentiment_classifications (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES sentiment_posts(id),
    sentiment_category VARCHAR(50) NOT NULL, -- Very Positive, Positive, Neutral, Negative, Very Negative
    confidence_score DECIMAL(4,3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    analysis_model VARCHAR(100) DEFAULT 'AI_SENTIMENT_V1',
    classification_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emotion analysis for posts
CREATE TABLE IF NOT EXISTS emotion_analysis (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES sentiment_posts(id),
    emotion VARCHAR(50) NOT NULL, -- Joy, Trust, Fear, Surprise, Sadness, Disgust, Anger
    intensity_score DECIMAL(5,2) NOT NULL CHECK (intensity_score >= 0 AND intensity_score <= 100),
    confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Temporal sentiment trends for time-based analysis
CREATE TABLE IF NOT EXISTS sentiment_temporal_trends (
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

-- Platform-specific sentiment performance metrics
CREATE TABLE IF NOT EXISTS platform_sentiment_performance (
    id INTEGER PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    analysis_date DATE NOT NULL,
    total_posts INTEGER NOT NULL,
    positive_percentage DECIMAL(5,2) NOT NULL,
    negative_percentage DECIMAL(5,2) NOT NULL,
    neutral_percentage DECIMAL(5,2) NOT NULL,
    avg_confidence DECIMAL(4,3) NOT NULL,
    avg_engagement_score DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, analysis_date)
);

-- Sentiment keywords and their impact
CREATE TABLE IF NOT EXISTS sentiment_keywords (
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

-- Emotion correlations for understanding emotional patterns
CREATE TABLE IF NOT EXISTS emotion_correlations (
    id INTEGER PRIMARY KEY,
    emotion1 VARCHAR(50) NOT NULL,
    emotion2 VARCHAR(50) NOT NULL,
    correlation_score DECIMAL(4,3) NOT NULL, -- -1 to 1 correlation
    co_occurrence_count INTEGER NOT NULL,
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    statistical_significance DECIMAL(5,4), -- p-value
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(emotion1, emotion2, analysis_period_start)
);

-- Time-of-day sentiment patterns
CREATE TABLE IF NOT EXISTS hourly_sentiment_patterns (
    id INTEGER PRIMARY KEY,
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    avg_positive_percentage DECIMAL(5,2) NOT NULL,
    avg_negative_percentage DECIMAL(5,2) NOT NULL,
    avg_neutral_percentage DECIMAL(5,2) NOT NULL,
    total_posts_analyzed INTEGER NOT NULL,
    pattern_strength DECIMAL(4,3) NOT NULL, -- Statistical strength of pattern
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hour_of_day, analysis_period_start)
);

-- Sample data for sentiment analysis

-- Insert sample posts with realistic social media content
INSERT INTO sentiment_posts (id, text, platform, timestamp, post_id, user_id, engagement_likes, engagement_shares, engagement_comments) VALUES
(1, 'This new product launch is absolutely incredible! Best decision I''ve ever made 🎉', 'twitter', 1706363520000, 'tw_001', 'user_001', 24, 8, 12),
(2, 'The customer service was helpful and resolved my issue quickly. Thank you!', 'facebook', 1706359700000, 'fb_001', 'user_002', 15, 3, 5),
(3, 'Not sure what to think about the recent updates. Some good, some bad I guess.', 'reddit', 1706358100000, 'rd_001', 'user_003', 7, 1, 18),
(4, 'Really disappointed with the quality. Expected much better for the price.', 'instagram', 1706354400000, 'ig_001', 'user_004', 3, 0, 22),
(5, 'This is absolutely terrible! Waste of money and time. Completely frustrated!', 'twitter', 1706352280000, 'tw_002', 'user_005', 1, 0, 34),
(6, 'Great experience overall! The team was professional and efficient.', 'linkedin', 1706349600000, 'li_001', 'user_006', 45, 12, 8),
(7, 'Amazing customer support! They went above and beyond to help me.', 'twitter', 1706346900000, 'tw_003', 'user_007', 32, 14, 6),
(8, 'The app keeps crashing. Very annoying and frustrating experience.', 'instagram', 1706344800000, 'ig_002', 'user_008', 2, 1, 28),
(9, 'It''s okay, nothing special but gets the job done I suppose.', 'reddit', 1706342400000, 'rd_002', 'user_009', 12, 2, 9),
(10, 'Love the new features! This update makes everything so much easier.', 'facebook', 1706340000000, 'fb_002', 'user_010', 28, 7, 11),
(11, 'Fantastic service from start to finish. Highly recommended!', 'linkedin', 1706337200000, 'li_002', 'user_011', 67, 23, 14),
(12, 'Total garbage. Don''t waste your time or money on this junk.', 'twitter', 1706334600000, 'tw_004', 'user_012', 0, 2, 45),
(13, 'The interface is clean and intuitive. Easy to navigate and use.', 'reddit', 1706332000000, 'rd_003', 'user_013', 23, 4, 7),
(14, 'Had some issues initially but support team fixed everything quickly.', 'facebook', 1706329400000, 'fb_003', 'user_014', 18, 5, 12),
(15, 'Absolutely love this! Game-changer for my daily workflow.', 'instagram', 1706326800000, 'ig_003', 'user_015', 89, 34, 19);

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
(10, 10, 'Positive', 0.92),
(11, 11, 'Very Positive', 0.95),
(12, 12, 'Very Negative', 0.98),
(13, 13, 'Positive', 0.85),
(14, 14, 'Positive', 0.83),
(15, 15, 'Very Positive', 0.97);

-- Insert emotion analysis data
INSERT INTO emotion_analysis (id, post_id, emotion, intensity_score, confidence) VALUES
-- Post 1 emotions (Very Positive)
(1, 1, 'Joy', 92.5, 0.94),
(2, 1, 'Trust', 78.3, 0.89),
-- Post 2 emotions (Positive)
(3, 2, 'Trust', 85.7, 0.87),
(4, 2, 'Joy', 65.2, 0.82),
-- Post 3 emotions (Neutral)
(5, 3, 'Surprise', 45.8, 0.76),
-- Post 4 emotions (Negative)
(6, 4, 'Sadness', 72.1, 0.88),
(7, 4, 'Disgust', 68.4, 0.85),
-- Post 5 emotions (Very Negative)
(8, 5, 'Anger', 95.7, 0.96),
(9, 5, 'Disgust', 89.3, 0.93),
-- Post 6 emotions (Positive)
(10, 6, 'Trust', 88.9, 0.91),
(11, 6, 'Joy', 74.6, 0.86),
-- Post 7 emotions (Very Positive)
(12, 7, 'Joy', 91.2, 0.93),
(13, 7, 'Trust', 87.5, 0.90),
(14, 7, 'Surprise', 65.8, 0.82),
-- Post 8 emotions (Negative)
(15, 8, 'Anger', 78.4, 0.88),
(16, 8, 'Disgust', 71.2, 0.84),
-- Post 9 emotions (Neutral)
(17, 9, 'Trust', 52.3, 0.79),
-- Post 10 emotions (Positive)
(18, 10, 'Joy', 86.7, 0.92),
(19, 10, 'Trust', 79.4, 0.89),
-- Post 11 emotions (Very Positive)
(20, 11, 'Joy', 94.8, 0.95),
(21, 11, 'Trust', 91.2, 0.94),
-- Post 12 emotions (Very Negative)
(22, 12, 'Anger', 97.3, 0.98),
(23, 12, 'Disgust', 92.6, 0.96),
-- Post 13 emotions (Positive)
(24, 13, 'Trust', 82.1, 0.85),
(25, 13, 'Joy', 68.4, 0.81),
-- Post 14 emotions (Positive)
(26, 14, 'Trust', 79.8, 0.83),
(27, 14, 'Joy', 72.5, 0.80),
-- Post 15 emotions (Very Positive)
(28, 15, 'Joy', 96.2, 0.97),
(29, 15, 'Trust', 88.7, 0.94);

-- Insert temporal trends data (last 7 days)
INSERT INTO sentiment_temporal_trends (id, analysis_date, analysis_hour, platform, positive_count, negative_count, neutral_count, total_posts, avg_confidence) VALUES
-- January 21, 2025 data
(1, '2025-01-21', 8, 'twitter', 45, 18, 12, 75, 0.89),
(2, '2025-01-21', 12, 'facebook', 32, 15, 8, 55, 0.87),
(3, '2025-01-21', 18, 'instagram', 28, 12, 6, 46, 0.91),
(4, '2025-01-21', 20, 'reddit', 21, 18, 11, 50, 0.85),

-- January 22, 2025 data
(5, '2025-01-22', 9, 'twitter', 52, 22, 14, 88, 0.90),
(6, '2025-01-22', 13, 'facebook', 38, 19, 10, 67, 0.88),
(7, '2025-01-22', 17, 'instagram', 31, 14, 8, 53, 0.92),
(8, '2025-01-22', 21, 'reddit', 18, 21, 13, 52, 0.84),

-- January 23, 2025 data
(9, '2025-01-23', 10, 'twitter', 41, 26, 16, 83, 0.87),
(10, '2025-01-23', 14, 'facebook', 29, 22, 12, 63, 0.86),
(11, '2025-01-23', 19, 'instagram', 25, 17, 9, 51, 0.89),
(12, '2025-01-23', 22, 'reddit', 15, 24, 15, 54, 0.83),

-- January 24, 2025 data
(13, '2025-01-24', 11, 'twitter', 48, 19, 13, 80, 0.91),
(14, '2025-01-24', 15, 'facebook', 35, 16, 9, 60, 0.89),
(15, '2025-01-24', 18, 'instagram', 33, 11, 7, 51, 0.93),
(16, '2025-01-24', 20, 'reddit', 22, 16, 12, 50, 0.86);

-- Insert platform performance data
INSERT INTO platform_sentiment_performance (id, platform, analysis_date, total_posts, positive_percentage, negative_percentage, neutral_percentage, avg_confidence, avg_engagement_score) VALUES
(1, 'twitter', '2025-01-27', 12450, 54.2, 26.8, 19.0, 0.89, 72.4),
(2, 'facebook', '2025-01-27', 8930, 58.1, 23.4, 18.5, 0.87, 78.6),
(3, 'instagram', '2025-01-27', 6720, 61.3, 21.2, 17.5, 0.91, 84.2),
(4, 'reddit', '2025-01-27', 4850, 42.1, 35.6, 22.3, 0.85, 65.8),
(5, 'linkedin', '2025-01-27', 2890, 67.8, 15.4, 16.8, 0.92, 89.3);

-- Insert sentiment keywords
INSERT INTO sentiment_keywords (id, keyword, sentiment_type, frequency, impact_score, platforms, analysis_period_start, analysis_period_end) VALUES
(1, 'amazing', 'positive', 2340, 8.7, '["twitter","facebook","instagram"]', '2025-01-21', '2025-01-27'),
(2, 'terrible', 'negative', 1890, 9.2, '["twitter","reddit","instagram"]', '2025-01-21', '2025-01-27'),
(3, 'love it', 'positive', 1560, 8.1, '["facebook","instagram","linkedin"]', '2025-01-21', '2025-01-27'),
(4, 'hate this', 'negative', 1420, 8.9, '["twitter","reddit"]', '2025-01-21', '2025-01-27'),
(5, 'fantastic', 'positive', 1340, 8.4, '["linkedin","facebook","instagram"]', '2025-01-21', '2025-01-27'),
(6, 'awful', 'negative', 1200, 9.0, '["twitter","reddit","facebook"]', '2025-01-21', '2025-01-27'),
(7, 'disappointed', 'negative', 1180, 7.8, '["facebook","instagram","reddit"]', '2025-01-21', '2025-01-27'),
(8, 'excellent', 'positive', 1090, 8.3, '["linkedin","twitter","facebook"]', '2025-01-21', '2025-01-27'),
(9, 'perfect', 'positive', 980, 8.6, '["instagram","facebook","linkedin"]', '2025-01-21', '2025-01-27'),
(10, 'frustrated', 'negative', 890, 8.1, '["twitter","reddit","facebook"]', '2025-01-21', '2025-01-27');

-- Insert emotion correlations
INSERT INTO emotion_correlations (id, emotion1, emotion2, correlation_score, co_occurrence_count, analysis_period_start, analysis_period_end, statistical_significance) VALUES
(1, 'Joy', 'Trust', 0.78, 4520, '2025-01-21', '2025-01-27', 0.0001),
(2, 'Anger', 'Disgust', 0.72, 2890, '2025-01-21', '2025-01-27', 0.0003),
(3, 'Fear', 'Sadness', 0.68, 3240, '2025-01-21', '2025-01-27', 0.0005),
(4, 'Joy', 'Surprise', 0.61, 2670, '2025-01-21', '2025-01-27', 0.0012),
(5, 'Trust', 'Surprise', 0.58, 2110, '2025-01-21', '2025-01-27', 0.0018),
(6, 'Sadness', 'Disgust', 0.54, 1890, '2025-01-21', '2025-01-27', 0.0024),
(7, 'Fear', 'Anger', 0.51, 1560, '2025-01-21', '2025-01-27', 0.0031),
(8, 'Surprise', 'Trust', 0.48, 1320, '2025-01-21', '2025-01-27', 0.0045);

-- Insert hourly sentiment patterns
INSERT INTO hourly_sentiment_patterns (id, hour_of_day, avg_positive_percentage, avg_negative_percentage, avg_neutral_percentage, total_posts_analyzed, pattern_strength, analysis_period_start, analysis_period_end) VALUES
(1, 0, 35.2, 42.8, 22.0, 1240, 0.82, '2025-01-21', '2025-01-27'),
(2, 1, 32.1, 45.6, 22.3, 980, 0.78, '2025-01-21', '2025-01-27'),
(3, 2, 28.9, 48.2, 22.9, 720, 0.85, '2025-01-21', '2025-01-27'),
(4, 6, 45.3, 32.1, 22.6, 1580, 0.73, '2025-01-21', '2025-01-27'),
(5, 7, 52.8, 28.4, 18.8, 2340, 0.89, '2025-01-21', '2025-01-27'),
(6, 8, 58.2, 24.3, 17.5, 3120, 0.92, '2025-01-21', '2025-01-27'),
(7, 9, 61.4, 22.8, 15.8, 3890, 0.94, '2025-01-21', '2025-01-27'),
(8, 10, 63.7, 21.2, 15.1, 4250, 0.95, '2025-01-21', '2025-01-27'),
(9, 11, 65.2, 19.8, 15.0, 4380, 0.96, '2025-01-21', '2025-01-27'),
(10, 12, 64.8, 20.1, 15.1, 4420, 0.95, '2025-01-21', '2025-01-27'),
(11, 13, 62.3, 22.4, 15.3, 4180, 0.93, '2025-01-21', '2025-01-27'),
(12, 14, 59.7, 24.8, 15.5, 3950, 0.91, '2025-01-21', '2025-01-27'),
(13, 15, 57.1, 26.9, 16.0, 3720, 0.88, '2025-01-21', '2025-01-27'),
(14, 16, 54.8, 28.7, 16.5, 3480, 0.86, '2025-01-21', '2025-01-27'),
(15, 17, 52.3, 30.2, 17.5, 3240, 0.84, '2025-01-21', '2025-01-27'),
(16, 18, 55.9, 27.1, 17.0, 3680, 0.87, '2025-01-21', '2025-01-27'),
(17, 19, 58.4, 25.3, 16.3, 3890, 0.90, '2025-01-21', '2025-01-27'),
(18, 20, 56.7, 26.8, 16.5, 3650, 0.88, '2025-01-21', '2025-01-27'),
(19, 21, 52.1, 30.4, 17.5, 3120, 0.85, '2025-01-21', '2025-01-27'),
(20, 22, 47.3, 34.2, 18.5, 2580, 0.81, '2025-01-21', '2025-01-27'),
(21, 23, 41.8, 38.7, 19.5, 1890, 0.79, '2025-01-21', '2025-01-27');

-- Analytical Views for Sentiment Analysis

-- Overall sentiment statistics view
CREATE VIEW IF NOT EXISTS sentiment_overview AS
SELECT 
    COUNT(CASE WHEN sc.sentiment_category IN ('Very Positive', 'Positive') THEN 1 END) as positive_count,
    COUNT(CASE WHEN sc.sentiment_category IN ('Very Negative', 'Negative') THEN 1 END) as negative_count,
    COUNT(CASE WHEN sc.sentiment_category = 'Neutral' THEN 1 END) as neutral_count,
    COUNT(*) as total_posts,
    ROUND(COUNT(CASE WHEN sc.sentiment_category IN ('Very Positive', 'Positive') THEN 1 END) * 100.0 / COUNT(*), 1) as positive_percentage,
    ROUND(COUNT(CASE WHEN sc.sentiment_category IN ('Very Negative', 'Negative') THEN 1 END) * 100.0 / COUNT(*), 1) as negative_percentage,
    ROUND(COUNT(CASE WHEN sc.sentiment_category = 'Neutral' THEN 1 END) * 100.0 / COUNT(*), 1) as neutral_percentage,
    ROUND(AVG(sc.confidence_score), 3) as avg_confidence
FROM sentiment_classifications sc;

-- Detailed sentiment breakdown view
CREATE VIEW IF NOT EXISTS sentiment_detailed AS
SELECT 
    sc.sentiment_category,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sentiment_classifications), 1) as percentage,
    CASE sc.sentiment_category
        WHEN 'Very Positive' THEN '#06d6a0'
        WHEN 'Positive' THEN '#26d0ce'
        WHEN 'Neutral' THEN '#8b5cf6'
        WHEN 'Negative' THEN '#ff6b9d'
        WHEN 'Very Negative' THEN '#f72585'
        ELSE '#8b5cf6'
    END as color
FROM sentiment_classifications sc
GROUP BY sc.sentiment_category
ORDER BY count DESC;

-- Emotion statistics view
CREATE VIEW IF NOT EXISTS emotion_summary AS
SELECT 
    ea.emotion,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emotion_analysis), 1) as percentage,
    ROUND(AVG(ea.intensity_score), 1) as avg_intensity,
    CASE ea.emotion
        WHEN 'Joy' THEN '#ffd23f'
        WHEN 'Trust' THEN '#06d6a0'
        WHEN 'Fear' THEN '#8b5cf6'
        WHEN 'Surprise' THEN '#26d0ce'
        WHEN 'Sadness' THEN '#667eea'
        WHEN 'Disgust' THEN '#f72585'
        WHEN 'Anger' THEN '#ff6b9d'
        ELSE '#8b5cf6'
    END as color
FROM emotion_analysis ea
GROUP BY ea.emotion
ORDER BY count DESC;

-- Posts with sentiment details view
CREATE VIEW IF NOT EXISTS posts_with_sentiment AS
SELECT 
    sp.id,
    sp.text,
    sp.platform,
    sp.timestamp,
    sc.sentiment_category,
    sc.confidence_score,
    sp.engagement_likes,
    sp.engagement_shares,
    sp.engagement_comments,
    GROUP_CONCAT(ea.emotion) as emotions
FROM sentiment_posts sp
JOIN sentiment_classifications sc ON sp.id = sc.post_id
LEFT JOIN emotion_analysis ea ON sp.id = ea.post_id
GROUP BY sp.id, sp.text, sp.platform, sp.timestamp, sc.sentiment_category, sc.confidence_score, sp.engagement_likes, sp.engagement_shares, sp.engagement_comments
ORDER BY sp.timestamp DESC;

-- Daily sentiment trends view
CREATE VIEW IF NOT EXISTS daily_sentiment_trends AS
SELECT 
    DATE(datetime(sp.timestamp/1000, 'unixepoch')) as date,
    ROUND(COUNT(CASE WHEN sc.sentiment_category IN ('Very Positive', 'Positive') THEN 1 END) * 100.0 / COUNT(*), 0) as positive,
    ROUND(COUNT(CASE WHEN sc.sentiment_category IN ('Very Negative', 'Negative') THEN 1 END) * 100.0 / COUNT(*), 0) as negative,
    ROUND(COUNT(CASE WHEN sc.sentiment_category = 'Neutral' THEN 1 END) * 100.0 / COUNT(*), 0) as neutral,
    COUNT(*) as total_posts
FROM sentiment_posts sp
JOIN sentiment_classifications sc ON sp.id = sc.post_id
GROUP BY DATE(datetime(sp.timestamp/1000, 'unixepoch'))
ORDER BY date DESC
LIMIT 90;

-- Top sentiment keywords view  
CREATE VIEW IF NOT EXISTS top_sentiment_keywords AS
SELECT 
    sk.keyword,
    sk.sentiment_type,
    sk.frequency,
    sk.impact_score
FROM sentiment_keywords sk
ORDER BY sk.frequency DESC, sk.impact_score DESC;

-- Platform performance summary view
CREATE VIEW IF NOT EXISTS platform_performance_summary AS
SELECT 
    psp.platform,
    psp.total_posts,
    psp.positive_percentage,
    psp.negative_percentage, 
    psp.neutral_percentage,
    psp.avg_confidence,
    psp.avg_engagement_score
FROM platform_sentiment_performance psp
WHERE psp.analysis_date = (SELECT MAX(analysis_date) FROM platform_sentiment_performance)
ORDER BY psp.avg_engagement_score DESC;

-- Hourly sentiment distribution view
CREATE VIEW IF NOT EXISTS hourly_sentiment_distribution AS
SELECT 
    hsp.hour_of_day,
    hsp.avg_positive_percentage as positive,
    hsp.avg_negative_percentage as negative,
    hsp.avg_neutral_percentage as neutral,
    hsp.total_posts_analyzed,
    hsp.pattern_strength
FROM hourly_sentiment_patterns hsp
ORDER BY hsp.hour_of_day;