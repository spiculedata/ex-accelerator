-- Sample rows extracted from sql/schemas/unified_social_analytics_schema.sql (demo data, see issue #63)
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
(10, 10, 4, 28, 11, 7, 1200, 980, 4.69);

-- Text only

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
(6, 10, 5, 0.8654, TRUE);
