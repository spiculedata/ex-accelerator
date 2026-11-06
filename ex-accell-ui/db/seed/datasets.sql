-- Sample rows extracted from sql/schemas/datasets_schema.sql (demo data, see issue #63)
-- =====================================================
-- Sample Data (for development/testing)
-- =====================================================

-- Sample Datasets
INSERT INTO datasets (name, description, dataset_type, source_platform, source_database, schema_name, table_name, record_count, date_range_start, date_range_end, crawl_id, ingestion_method, status, visibility, created_by) VALUES
('Twitter Q1 2025', 'Twitter posts from Q1 2025 political analysis', 'social_media', 'twitter', 'etl_postgres', 'silver', 'posts', 15420, '2025-01-01', '2025-03-31', 'twitter-q1-2025', 'crawler', 'available', 'private', 'admin@example.com'),
('Telegram News Channels', 'Telegram news channel posts from major outlets', 'social_media', 'telegram', 'etl_postgres', 'silver', 'posts', 8950, '2025-01-15', '2025-03-15', 'telegram-news-001', 'crawler', 'available', 'private', 'admin@example.com'),
('GDELT Global Events Jan 2025', 'GDELT event data for January 2025', 'gdelt_events', 'gdelt', 'etl_postgres', 'public', 'gdelt_events', 125000, '2025-01-01', '2025-01-31', 'gdelt-jan-2025', 'api', 'available', 'public', 'system'),
('Facebook Political Pages', 'Facebook page posts from political organizations', 'social_media', 'facebook', 'etl_postgres', 'silver', 'posts', 12300, '2024-12-01', '2025-02-28', 'facebook-political-001', 'crawler', 'available', 'private', 'admin@example.com'),
('YouTube Video Analytics', 'YouTube video metadata and engagement metrics', 'social_media', 'youtube', 'etl_postgres', 'gold', 'account_engagement_metrics', 3250, '2025-02-01', '2025-03-31', 'youtube-analytics-001', 'api', 'available', 'private', 'admin@example.com')
ON CONFLICT (name) DO NOTHING;

-- Sample Dataset Permissions
INSERT INTO dataset_permissions (dataset_id, permission_type, user_email, access_level, granted_by) VALUES
(1, 'user', 'researcher@example.com', 'read', 'admin@example.com'),
(1, 'user', 'analyst@example.com', 'read', 'admin@example.com'),
(2, 'user', 'researcher@example.com', 'read', 'admin@example.com'),
(3, 'public', NULL, 'read', 'system'),
(4, 'user', 'analyst@example.com', 'read', 'admin@example.com')
ON CONFLICT DO NOTHING;

-- Sample Dataset Tags
INSERT INTO dataset_tags (dataset_id, tag_name) VALUES
(1, 'political'),
(1, 'twitter'),
(1, 'q1-2025'),
(2, 'telegram'),
(2, 'news'),
(3, 'gdelt'),
(3, 'global-events'),
(4, 'facebook'),
(4, 'political'),
(5, 'youtube'),
(5, 'engagement')
ON CONFLICT DO NOTHING;
