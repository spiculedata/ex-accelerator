-- Hashtag Analysis Database Schema
-- Comprehensive hashtag tracking, sentiment analysis, and trending analysis
-- This schema supports real-time hashtag monitoring and performance analytics

-- Core hashtag posts and mentions
CREATE TABLE IF NOT EXISTS hashtag_posts (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL, -- twitter, instagram, facebook, linkedin, etc.
    timestamp BIGINT NOT NULL,
    post_id VARCHAR(200), -- Platform-specific post ID
    user_id VARCHAR(100), -- User who posted
    likes_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0, -- Estimated reach
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hashtag definitions and metadata
CREATE TABLE IF NOT EXISTS hashtags (
    id INTEGER PRIMARY KEY,
    hashtag VARCHAR(200) NOT NULL UNIQUE, -- Including # symbol
    normalized_tag VARCHAR(200) NOT NULL, -- Lowercase without # for analysis
    category VARCHAR(100), -- Technology, Politics, Sports, etc.
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_trending BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Post-hashtag relationships (many-to-many)
CREATE TABLE IF NOT EXISTS post_hashtags (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES hashtag_posts(id),
    hashtag_id INTEGER NOT NULL REFERENCES hashtags(id),
    position_in_text INTEGER, -- Position where hashtag appears in post
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, hashtag_id)
);

-- Hashtag sentiment analysis
CREATE TABLE IF NOT EXISTS hashtag_sentiment (
    id INTEGER PRIMARY KEY,
    hashtag_id INTEGER NOT NULL REFERENCES hashtags(id),
    post_id INTEGER NOT NULL REFERENCES hashtag_posts(id),
    sentiment VARCHAR(20) NOT NULL, -- positive, negative, neutral, mixed
    confidence DECIMAL(4,3) NOT NULL, -- 0-1 confidence score
    analysis_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily hashtag trends and statistics
CREATE TABLE IF NOT EXISTS hashtag_trends (
    id INTEGER PRIMARY KEY,
    hashtag_id INTEGER NOT NULL REFERENCES hashtags(id),
    analysis_date DATE NOT NULL,
    post_count INTEGER NOT NULL DEFAULT 0,
    total_reach INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    avg_engagement_rate DECIMAL(5,2) DEFAULT 0.0,
    growth_rate DECIMAL(6,3) DEFAULT 0.0, -- % change from previous period
    trend_direction VARCHAR(20) DEFAULT 'stable', -- up, down, stable
    sentiment_score DECIMAL(4,3) DEFAULT 0.5, -- Average sentiment 0-1
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hashtag_id, analysis_date)
);

-- Hashtag platform performance
CREATE TABLE IF NOT EXISTS hashtag_platform_stats (
    id INTEGER PRIMARY KEY,
    hashtag_id INTEGER NOT NULL REFERENCES hashtags(id),
    platform VARCHAR(50) NOT NULL,
    analysis_date DATE NOT NULL,
    post_count INTEGER DEFAULT 0,
    total_reach INTEGER DEFAULT 0,
    avg_engagement_rate DECIMAL(5,2) DEFAULT 0.0,
    dominant_sentiment VARCHAR(20), -- Most common sentiment on this platform
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hashtag_id, platform, analysis_date)
);

-- Related hashtags and co-occurrence analysis
CREATE TABLE IF NOT EXISTS hashtag_relationships (
    id INTEGER PRIMARY KEY,
    hashtag1_id INTEGER NOT NULL REFERENCES hashtags(id),
    hashtag2_id INTEGER NOT NULL REFERENCES hashtags(id),
    co_occurrence_count INTEGER NOT NULL DEFAULT 0,
    correlation_strength DECIMAL(4,3) NOT NULL DEFAULT 0.0, -- 0-1
    relationship_type VARCHAR(50) DEFAULT 'co-occurrence',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hashtag1_id, hashtag2_id)
);

-- Sample data for hashtag analysis

-- Insert sample hashtags
INSERT INTO hashtags (id, hashtag, normalized_tag, category, is_trending) VALUES
(1, '#AI', 'ai', 'Technology', TRUE),
(2, '#ClimateChange', 'climatechange', 'Environment', TRUE),
(3, '#Technology', 'technology', 'Technology', TRUE),
(4, '#Crypto', 'crypto', 'Finance', FALSE),
(5, '#Health', 'health', 'Health', TRUE),
(6, '#Sustainability', 'sustainability', 'Environment', TRUE),
(7, '#Innovation', 'innovation', 'Technology', FALSE),
(8, '#Marketing', 'marketing', 'Business', FALSE),
(9, '#Bitcoin', 'bitcoin', 'Finance', FALSE),
(10, '#MachineLearning', 'machinelearning', 'Technology', TRUE),
(11, '#DataScience', 'datascience', 'Technology', TRUE),
(12, '#DigitalTransformation', 'digitaltransformation', 'Business', FALSE),
(13, '#SocialMedia', 'socialmedia', 'Marketing', FALSE),
(14, '#Blockchain', 'blockchain', 'Technology', FALSE),
(15, '#IoT', 'iot', 'Technology', FALSE);

-- Insert sample posts
INSERT INTO hashtag_posts (id, text, platform, timestamp, post_id, user_id, likes_count, shares_count, comments_count, reach) VALUES
(1, 'The future of #AI is here! Incredible breakthrough in machine learning algorithms 🚀 #Technology #Innovation #MachineLearning', 'twitter', 1706363520000, 'tw_001', 'tech_enthusiast', 245, 89, 34, 12567),
(2, 'Taking action on #ClimateChange is more important than ever. Here\'s what we can do 🌍 #Sustainability #Environment', 'linkedin', 1706359700000, 'li_001', 'climate_activist', 156, 67, 23, 8945),
(3, 'Just launched our new #Health app! Excited to help people live better lives 💪 #HealthTech #Innovation', 'instagram', 1706358100000, 'ig_001', 'health_startup', 89, 23, 12, 4567),
(4, '#Crypto market showing volatility again. Important to stay informed and invest wisely 📈 #Bitcoin #Investing', 'twitter', 1706354400000, 'tw_002', 'crypto_trader', 234, 45, 78, 6789),
(5, 'Amazing progress in #DataScience this year! New tools making analysis more accessible #AI #MachineLearning #Technology', 'linkedin', 1706352280000, 'li_002', 'data_scientist', 178, 56, 29, 9876),
(6, '#Sustainability isn\'t just a trend, it\'s the future of business 🌱 #ClimateChange #Business #Innovation', 'twitter', 1706349600000, 'tw_003', 'business_leader', 167, 43, 21, 7432),
(7, 'Exploring the potential of #Blockchain beyond cryptocurrency. Revolutionary technology! #Technology #Innovation #Crypto', 'linkedin', 1706346900000, 'li_003', 'blockchain_dev', 145, 38, 15, 6543),
(8, '#DigitalTransformation is reshaping industries. Companies must adapt or fall behind #Technology #Business #Innovation', 'twitter', 1706344800000, 'tw_004', 'digital_consultant', 198, 72, 41, 8765),
(9, 'The intersection of #AI and #Health is creating unprecedented opportunities for patient care #HealthTech #MachineLearning', 'linkedin', 1706342400000, 'li_004', 'healthtech_ceo', 134, 29, 18, 5678),
(10, '#IoT devices are becoming smarter every day. The connected future is almost here! #Technology #Innovation #SmartHome', 'twitter', 1706340000000, 'tw_005', 'iot_developer', 112, 31, 14, 4321),
(11, 'Effective #Marketing in the digital age requires understanding data and customer behavior #SocialMedia #DataScience', 'linkedin', 1706337600000, 'li_005', 'marketing_expert', 156, 44, 22, 7890),
(12, '#ClimateChange solutions need technological innovation and policy changes working together 🌍 #Sustainability #Technology', 'twitter', 1706335200000, 'tw_006', 'policy_researcher', 189, 67, 35, 9012),
(13, 'Breaking: New #AI model achieves human-level performance in complex reasoning tasks #MachineLearning #Technology #DataScience', 'twitter', 1706332800000, 'tw_007', 'ai_researcher', 456, 123, 89, 15678),
(14, '#Bitcoin adoption continues to grow despite market volatility. Long-term perspective is key #Crypto #Blockchain #Investing', 'twitter', 1706330400000, 'tw_008', 'crypto_analyst', 278, 56, 67, 8901),
(15, 'The future of #Health monitoring lies in wearable technology and continuous data collection #HealthTech #IoT #DataScience', 'linkedin', 1706328000000, 'li_006', 'wearable_tech_ceo', 167, 41, 26, 7654);

-- Insert post-hashtag relationships
INSERT INTO post_hashtags (id, post_id, hashtag_id, position_in_text) VALUES
-- Post 1 hashtags
(1, 1, 1, 14), -- #AI
(2, 1, 3, 79), -- #Technology
(3, 1, 7, 91), -- #Innovation
(4, 1, 10, 103), -- #MachineLearning

-- Post 2 hashtags
(5, 2, 2, 17), -- #ClimateChange
(6, 2, 6, 83), -- #Sustainability

-- Post 3 hashtags
(7, 3, 5, 21), -- #Health
(8, 3, 7, 89), -- #Innovation

-- Post 4 hashtags
(9, 4, 4, 1), -- #Crypto
(10, 4, 9, 67), -- #Bitcoin

-- Post 5 hashtags
(11, 5, 11, 25), -- #DataScience
(12, 5, 1, 98), -- #AI
(13, 5, 10, 102), -- #MachineLearning
(14, 5, 3, 118), -- #Technology

-- Continue for remaining posts...
(15, 6, 6, 1), -- #Sustainability
(16, 6, 2, 74), -- #ClimateChange
(17, 6, 7, 108), -- #Innovation

(18, 7, 14, 26), -- #Blockchain
(19, 7, 3, 89), -- #Technology
(20, 7, 7, 101), -- #Innovation
(21, 7, 4, 113), -- #Crypto

(22, 8, 12, 1), -- #DigitalTransformation
(23, 8, 3, 76), -- #Technology
(24, 8, 7, 98), -- #Innovation

(25, 9, 1, 19), -- #AI
(26, 9, 5, 27), -- #Health
(27, 9, 10, 89), -- #MachineLearning

(28, 10, 15, 1), -- #IoT
(29, 10, 3, 67), -- #Technology
(30, 10, 7, 79), -- #Innovation

(31, 11, 8, 10), -- #Marketing
(32, 11, 13, 78), -- #SocialMedia
(33, 11, 11, 90), -- #DataScience

(34, 12, 2, 1), -- #ClimateChange
(35, 12, 6, 89), -- #Sustainability
(36, 12, 3, 101), -- #Technology

(37, 13, 1, 13), -- #AI
(38, 13, 10, 76), -- #MachineLearning
(39, 13, 3, 91), -- #Technology
(40, 13, 11, 103), -- #DataScience

(41, 14, 9, 1), -- #Bitcoin
(42, 14, 4, 67), -- #Crypto
(43, 14, 14, 79), -- #Blockchain

(44, 15, 5, 14), -- #Health
(45, 15, 15, 67), -- #IoT
(46, 15, 11, 91); -- #DataScience

-- Insert sentiment analysis data
INSERT INTO hashtag_sentiment (id, hashtag_id, post_id, sentiment, confidence, analysis_date) VALUES
-- AI sentiment (mostly positive)
(1, 1, 1, 'positive', 0.92, '2025-01-27'),
(2, 1, 5, 'positive', 0.89, '2025-01-27'),
(3, 1, 9, 'positive', 0.94, '2025-01-27'),
(4, 1, 13, 'positive', 0.96, '2025-01-27'),

-- Climate Change sentiment (mixed)
(5, 2, 2, 'positive', 0.78, '2025-01-27'),
(6, 2, 6, 'mixed', 0.65, '2025-01-27'),
(7, 2, 12, 'positive', 0.81, '2025-01-27'),

-- Technology sentiment (positive)
(8, 3, 1, 'positive', 0.88, '2025-01-27'),
(9, 3, 5, 'positive', 0.90, '2025-01-27'),
(10, 3, 7, 'positive', 0.85, '2025-01-27'),
(11, 3, 8, 'neutral', 0.72, '2025-01-27'),
(12, 3, 10, 'positive', 0.87, '2025-01-27'),
(13, 3, 12, 'positive', 0.84, '2025-01-27'),
(14, 3, 13, 'positive', 0.93, '2025-01-27'),

-- Crypto sentiment (mixed/negative)
(15, 4, 4, 'negative', 0.76, '2025-01-27'),
(16, 4, 7, 'neutral', 0.68, '2025-01-27'),
(17, 4, 14, 'mixed', 0.71, '2025-01-27'),

-- Health sentiment (positive)
(18, 5, 3, 'positive', 0.91, '2025-01-27'),
(19, 5, 9, 'positive', 0.89, '2025-01-27'),
(20, 5, 15, 'positive', 0.86, '2025-01-27');

-- Insert hashtag trends (last 7 days)
INSERT INTO hashtag_trends (id, hashtag_id, analysis_date, post_count, total_reach, total_likes, total_shares, total_comments, avg_engagement_rate, growth_rate, trend_direction, sentiment_score) VALUES
-- AI trends (trending up)
(1, 1, '2025-01-27', 47, 45678, 1234, 456, 234, 8.4, 45.2, 'up', 0.84),
(2, 1, '2025-01-26', 32, 34567, 987, 345, 178, 7.8, 38.1, 'up', 0.82),
(3, 1, '2025-01-25', 23, 25678, 756, 234, 123, 7.2, 28.9, 'up', 0.79),
(4, 1, '2025-01-24', 18, 19234, 567, 178, 89, 6.9, 22.3, 'up', 0.81),
(5, 1, '2025-01-23', 15, 16789, 456, 145, 67, 6.5, 18.7, 'up', 0.80),
(6, 1, '2025-01-22', 13, 14234, 389, 123, 56, 6.1, 15.2, 'up', 0.78),
(7, 1, '2025-01-21', 11, 12567, 334, 98, 45, 5.8, 12.1, 'up', 0.76),

-- Climate Change trends (trending up)
(8, 2, '2025-01-27', 32, 23456, 789, 234, 123, 6.2, 23.1, 'up', 0.67),
(9, 2, '2025-01-26', 26, 19876, 645, 189, 98, 5.9, 18.9, 'up', 0.65),
(10, 2, '2025-01-25', 22, 16789, 534, 156, 78, 5.6, 15.3, 'up', 0.68),
(11, 2, '2025-01-24', 19, 14567, 467, 134, 67, 5.4, 12.8, 'up', 0.66),
(12, 2, '2025-01-23', 17, 13234, 398, 112, 56, 5.1, 9.7, 'up', 0.64),
(13, 2, '2025-01-22', 16, 12456, 356, 98, 45, 4.9, 7.2, 'up', 0.63),
(14, 2, '2025-01-21', 15, 11678, 323, 87, 39, 4.7, 5.1, 'up', 0.62),

-- Technology trends (stable)
(15, 3, '2025-01-27', 28, 18923, 567, 178, 89, 5.8, 2.4, 'stable', 0.76),
(16, 3, '2025-01-26', 27, 18456, 534, 167, 84, 5.7, 1.8, 'stable', 0.75),
(17, 3, '2025-01-25', 27, 18123, 512, 156, 78, 5.6, 0.9, 'stable', 0.74),
(18, 3, '2025-01-24', 26, 17890, 489, 145, 73, 5.5, -0.3, 'stable', 0.73),
(19, 3, '2025-01-23', 27, 18234, 498, 149, 76, 5.6, 1.2, 'stable', 0.75),
(20, 3, '2025-01-22', 26, 17987, 476, 142, 71, 5.4, -1.1, 'stable', 0.74),
(21, 3, '2025-01-21', 27, 18456, 501, 151, 77, 5.7, 2.1, 'stable', 0.76),

-- Crypto trends (trending down)
(22, 4, '2025-01-27', 24, 16789, 445, 123, 89, 7.1, -15.3, 'down', 0.42),
(23, 4, '2025-01-26', 28, 19234, 523, 145, 104, 8.2, -12.1, 'down', 0.39),
(24, 4, '2025-01-25', 32, 21567, 612, 167, 123, 9.1, -8.7, 'down', 0.37),
(25, 4, '2025-01-24', 35, 23456, 678, 189, 134, 9.8, -5.2, 'down', 0.35),
(26, 4, '2025-01-23', 37, 24789, 723, 201, 145, 10.3, -2.1, 'down', 0.33),
(27, 4, '2025-01-22', 38, 25234, 745, 212, 156, 10.5, 0.8, 'stable', 0.31),
(28, 4, '2025-01-21', 37, 24987, 734, 198, 149, 10.4, -1.3, 'down', 0.32);

-- Insert platform statistics
INSERT INTO hashtag_platform_stats (id, hashtag_id, platform, analysis_date, post_count, total_reach, avg_engagement_rate, dominant_sentiment) VALUES
-- AI platform stats
(1, 1, 'twitter', '2025-01-27', 28, 25678, 8.9, 'positive'),
(2, 1, 'linkedin', '2025-01-27', 15, 15234, 7.2, 'positive'),
(3, 1, 'instagram', '2025-01-27', 4, 4766, 9.8, 'positive'),

-- Climate Change platform stats
(4, 2, 'twitter', '2025-01-27', 18, 12345, 6.8, 'mixed'),
(5, 2, 'facebook', '2025-01-27', 10, 7890, 5.1, 'positive'),
(6, 2, 'linkedin', '2025-01-27', 4, 3221, 7.9, 'positive'),

-- Technology platform stats
(7, 3, 'twitter', '2025-01-27', 16, 10234, 5.9, 'positive'),
(8, 3, 'linkedin', '2025-01-27', 12, 8689, 5.7, 'positive'),

-- Crypto platform stats
(9, 4, 'twitter', '2025-01-27', 20, 13456, 7.8, 'negative'),
(10, 4, 'reddit', '2025-01-27', 4, 3333, 5.4, 'mixed');

-- Insert hashtag relationships
INSERT INTO hashtag_relationships (id, hashtag1_id, hashtag2_id, co_occurrence_count, correlation_strength, relationship_type) VALUES
(1, 1, 3, 4, 0.85, 'co-occurrence'), -- AI + Technology
(2, 1, 10, 3, 0.92, 'co-occurrence'), -- AI + MachineLearning
(3, 1, 11, 2, 0.78, 'co-occurrence'), -- AI + DataScience
(4, 2, 6, 3, 0.89, 'co-occurrence'), -- ClimateChange + Sustainability
(5, 3, 7, 5, 0.73, 'co-occurrence'), -- Technology + Innovation
(6, 4, 9, 2, 0.94, 'co-occurrence'), -- Crypto + Bitcoin
(7, 4, 14, 2, 0.87, 'co-occurrence'), -- Crypto + Blockchain
(8, 5, 15, 1, 0.82, 'co-occurrence'), -- Health + IoT
(9, 10, 11, 2, 0.91, 'co-occurrence'), -- MachineLearning + DataScience
(10, 8, 13, 1, 0.76, 'co-occurrence'); -- Marketing + SocialMedia

-- Analytical Views for Hashtag Analysis

-- Trending hashtags overview
CREATE VIEW IF NOT EXISTS trending_hashtags_overview AS
SELECT 
    h.hashtag,
    h.category,
    h.is_trending,
    COUNT(DISTINCT ph.post_id) as post_count,
    SUM(hp.reach) as total_reach,
    SUM(hp.likes_count) as total_likes,
    SUM(hp.shares_count) as total_shares,
    SUM(hp.comments_count) as total_comments,
    AVG(CASE 
        WHEN hp.reach > 0 THEN 
            ((hp.likes_count + hp.shares_count + hp.comments_count) * 100.0 / hp.reach)
        ELSE 0 
    END) as avg_engagement_rate,
    AVG(hs.sentiment_score) as avg_sentiment_score,
    ht.growth_rate,
    ht.trend_direction,
    GROUP_CONCAT(DISTINCT hp.platform) as platforms
FROM hashtags h
LEFT JOIN post_hashtags ph ON h.id = ph.hashtag_id
LEFT JOIN hashtag_posts hp ON ph.post_id = hp.id
LEFT JOIN (
    SELECT hashtag_id, AVG(
        CASE sentiment 
            WHEN 'positive' THEN 0.8
            WHEN 'mixed' THEN 0.5
            WHEN 'neutral' THEN 0.5
            WHEN 'negative' THEN 0.2
            ELSE 0.5
        END
    ) as sentiment_score
    FROM hashtag_sentiment 
    WHERE analysis_date >= DATE('now', '-7 days')
    GROUP BY hashtag_id
) hs ON h.id = hs.hashtag_id
LEFT JOIN (
    SELECT hashtag_id, growth_rate, trend_direction
    FROM hashtag_trends 
    WHERE analysis_date = DATE('now')
) ht ON h.id = ht.hashtag_id
WHERE ph.post_id IS NOT NULL
GROUP BY h.id, h.hashtag, h.category, h.is_trending, ht.growth_rate, ht.trend_direction
ORDER BY post_count DESC;

-- Hashtag performance by platform
CREATE VIEW IF NOT EXISTS hashtag_platform_performance AS
SELECT 
    h.hashtag,
    hp.platform,
    COUNT(*) as post_count,
    SUM(hp.reach) as total_reach,
    AVG(hp.likes_count) as avg_likes,
    AVG(hp.shares_count) as avg_shares,
    AVG(hp.comments_count) as avg_comments,
    AVG(CASE 
        WHEN hp.reach > 0 THEN 
            ((hp.likes_count + hp.shares_count + hp.comments_count) * 100.0 / hp.reach)
        ELSE 0 
    END) as avg_engagement_rate
FROM hashtags h
JOIN post_hashtags ph ON h.id = ph.hashtag_id
JOIN hashtag_posts hp ON ph.post_id = hp.id
WHERE hp.timestamp >= (EXTRACT(EPOCH FROM DATE('now', '-7 days')) * 1000)
GROUP BY h.hashtag, hp.platform
ORDER BY h.hashtag, avg_engagement_rate DESC;

-- Recent posts with hashtags
CREATE VIEW IF NOT EXISTS recent_hashtag_posts AS
SELECT 
    hp.id,
    hp.text,
    hp.platform,
    hp.timestamp,
    hp.likes_count,
    hp.shares_count,
    hp.comments_count,
    hp.reach,
    GROUP_CONCAT(h.hashtag) as hashtags,
    AVG(CASE 
        WHEN hp.reach > 0 THEN 
            ((hp.likes_count + hp.shares_count + hp.comments_count) * 100.0 / hp.reach)
        ELSE 0 
    END) as engagement_rate
FROM hashtag_posts hp
JOIN post_hashtags ph ON hp.id = ph.post_id
JOIN hashtags h ON ph.hashtag_id = h.id
WHERE hp.timestamp >= (EXTRACT(EPOCH FROM DATE('now', '-7 days')) * 1000)
GROUP BY hp.id, hp.text, hp.platform, hp.timestamp, hp.likes_count, hp.shares_count, hp.comments_count, hp.reach
ORDER BY hp.timestamp DESC;

-- Hashtag sentiment analysis summary
CREATE VIEW IF NOT EXISTS hashtag_sentiment_summary AS
SELECT 
    h.hashtag,
    hs.sentiment,
    COUNT(*) as sentiment_count,
    AVG(hs.confidence) as avg_confidence,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY h.hashtag) as sentiment_percentage
FROM hashtags h
JOIN hashtag_sentiment hs ON h.id = hs.hashtag_id
WHERE hs.analysis_date >= DATE('now', '-7 days')
GROUP BY h.hashtag, hs.sentiment
ORDER BY h.hashtag, sentiment_count DESC;