-- Overview Dashboard Schema for DuckDB
-- Creates tables for dashboard metrics, activities, and system status

-- Projects tracking table
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active', -- active, completed, archived
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    category VARCHAR(50)
);

-- System activities and events log
CREATE TABLE IF NOT EXISTS system_activities (
    id INTEGER PRIMARY KEY,
    activity_type VARCHAR(50) NOT NULL, -- analysis_completed, data_imported, dashboard_updated, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_id INTEGER REFERENCES projects(id),
    module VARCHAR(50), -- text_analytics, image_processing, dashboards, etc.
    status VARCHAR(20) DEFAULT 'completed', -- running, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON
);

-- App modules status and metrics
CREATE TABLE IF NOT EXISTS app_modules (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE, -- dashboards, text_analytics, image_processing, etc.
    display_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active', -- active, running, queued, idle
    active_jobs INTEGER DEFAULT 0,
    total_processed INTEGER DEFAULT 0,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    icon_color VARCHAR(20),
    module_type VARCHAR(50)
);

-- System metrics and status
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    metric_unit VARCHAR(20), -- percentage, count, bytes, etc.
    metric_category VARCHAR(50), -- storage, performance, pipeline
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) -- healthy, warning, critical
);

-- Reports and analysis results
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50), -- sentiment_analysis, engagement_report, etc.
    status VARCHAR(20) DEFAULT 'ready', -- generating, ready, expired
    project_id INTEGER REFERENCES projects(id),
    module VARCHAR(50),
    file_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Data processing batches
CREATE TABLE IF NOT EXISTS data_batches (
    id INTEGER PRIMARY KEY,
    batch_name VARCHAR(255),
    source_type VARCHAR(50), -- twitter, instagram, facebook, etc.
    records_count INTEGER DEFAULT 0,
    processing_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    project_id INTEGER REFERENCES projects(id)
);

-- Insert sample projects
INSERT OR IGNORE INTO projects (id, name, description, status, category) VALUES
(1, 'Brand Analysis Q4 2024', 'Social media sentiment tracking for major brands', 'active', 'sentiment'),
(2, 'Twitter Campaign Q4', 'Presidential election social media analysis', 'active', 'political'),
(3, 'Instagram Influencer Study', 'Fashion industry influence mapping', 'completed', 'marketing'),
(4, 'LinkedIn Professional Network', 'B2B engagement patterns analysis', 'active', 'business'),
(5, 'TikTok Trend Analysis', 'Viral content pattern recognition', 'active', 'entertainment'),
(6, 'Facebook Community Research', 'Local community engagement study', 'archived', 'community'),
(7, 'YouTube Content Performance', 'Video engagement optimization', 'active', 'content'),
(8, 'Reddit Discussion Mining', 'Forum-based sentiment analysis', 'active', 'discussion'),
(9, 'Crisis Communication Study', 'Brand response effectiveness', 'completed', 'crisis'),
(10, 'Multi-Platform Comparison', 'Cross-platform engagement analysis', 'active', 'comparison'),
(11, 'Seasonal Trends Research', 'Holiday marketing effectiveness', 'completed', 'seasonal'),
(12, 'Competitor Analysis Dashboard', 'Real-time competitive intelligence', 'active', 'competitive'),
(13, 'Customer Feedback Mining', 'Product review sentiment tracking', 'active', 'feedback'),
(14, 'Hashtag Performance Study', 'Social media hashtag optimization', 'active', 'hashtags'),
(15, 'Influencer Impact Measurement', 'ROI analysis for influencer partnerships', 'active', 'influencer');

-- Insert app modules status
INSERT OR IGNORE INTO app_modules (id, name, display_name, status, active_jobs, total_processed, icon_color, module_type) VALUES
(1, 'dashboards', 'Dashboards', 'active', 3, 2847, 'blue', 'visualization'),
(2, 'text_analytics', 'Text Analytics', 'running', 1, 1200, 'emerald', 'analysis'),
(3, 'image_processing', 'Image Processing', 'queued', 2, 456, 'indigo', 'processing'),
(4, 'data_capture', 'Data Capture', 'active', 0, 5200, 'amber', 'ingestion'),
(5, 'android_analytics', 'Android Analytics', 'idle', 0, 0, 'purple', 'research'),
(6, 'android_research', 'Android Research', 'idle', 0, 0, 'pink', 'research');

-- Insert recent system activities
INSERT OR IGNORE INTO system_activities (id, activity_type, title, description, module, status, created_at) VALUES
(1, 'analysis_completed', 'Text analysis completed for Twitter Campaign Q4', 'Sentiment analysis processing finished successfully', 'text_analytics', 'completed', CURRENT_TIMESTAMP - INTERVAL 2 HOUR),
(2, 'data_imported', 'New data batch imported: 5,230 posts', 'Social media posts from multiple platforms imported', 'data_capture', 'completed', CURRENT_TIMESTAMP - INTERVAL 4 HOUR),
(3, 'dashboard_updated', 'Dashboard Brand Sentiment updated', 'Real-time dashboard refresh with latest metrics', 'dashboards', 'completed', CURRENT_TIMESTAMP - INTERVAL 6 HOUR),
(4, 'job_started', 'Image processing job started for Instagram Posts', 'Computer vision analysis pipeline initiated', 'image_processing', 'running', CURRENT_TIMESTAMP - INTERVAL 8 HOUR),
(5, 'analysis_completed', 'Engagement analysis completed for LinkedIn Campaign', 'Professional network engagement metrics calculated', 'text_analytics', 'completed', CURRENT_TIMESTAMP - INTERVAL 12 HOUR),
(6, 'data_exported', 'Report generated: Q4 Social Media Performance', 'Comprehensive quarterly analysis report created', 'dashboards', 'completed', CURRENT_TIMESTAMP - INTERVAL 1 DAY),  
(7, 'pipeline_maintenance', 'Data pipeline maintenance completed', 'Scheduled system optimization and cleanup', 'system', 'completed', CURRENT_TIMESTAMP - INTERVAL 1 DAY),
(8, 'model_updated', 'Sentiment analysis model updated to v2.1', 'Machine learning model refresh with improved accuracy', 'text_analytics', 'completed', CURRENT_TIMESTAMP - INTERVAL 2 DAY);

-- Insert system metrics
INSERT OR IGNORE INTO system_metrics (id, metric_name, metric_value, metric_unit, metric_category, status, recorded_at) VALUES
(1, 'data_pipeline_health', 98.5, 'percentage', 'pipeline', 'healthy', CURRENT_TIMESTAMP),
(2, 'analytics_engine_utilization', 73.2, 'percentage', 'performance', 'healthy', CURRENT_TIMESTAMP),
(3, 'storage_usage', 85.0, 'percentage', 'storage', 'warning', CURRENT_TIMESTAMP),
(4, 'daily_posts_processed', 12847, 'count', 'throughput', 'healthy', CURRENT_TIMESTAMP),
(5, 'active_connections', 156, 'count', 'network', 'healthy', CURRENT_TIMESTAMP),
(6, 'cache_hit_ratio', 94.3, 'percentage', 'performance', 'healthy', CURRENT_TIMESTAMP),
(7, 'error_rate', 0.8, 'percentage', 'reliability', 'healthy', CURRENT_TIMESTAMP),
(8, 'response_time', 145.6, 'milliseconds', 'performance', 'healthy', CURRENT_TIMESTAMP);

-- Insert sample reports
INSERT OR IGNORE INTO reports (id, name, report_type, status, module, created_at) VALUES
(1, 'Twitter Sentiment Analysis Q4', 'sentiment_analysis', 'ready', 'text_analytics', CURRENT_TIMESTAMP - INTERVAL 2 HOUR),
(2, 'Instagram Engagement Report', 'engagement_analysis', 'ready', 'text_analytics', CURRENT_TIMESTAMP - INTERVAL 4 HOUR),
(3, 'Multi-Platform Performance Dashboard', 'dashboard_report', 'ready', 'dashboards', CURRENT_TIMESTAMP - INTERVAL 6 HOUR),
(4, 'LinkedIn Professional Network Analysis', 'network_analysis', 'ready', 'text_analytics', CURRENT_TIMESTAMP - INTERVAL 8 HOUR),
(5, 'TikTok Trend Identification Report', 'trend_analysis', 'ready', 'text_analytics', CURRENT_TIMESTAMP - INTERVAL 12 HOUR),
(6, 'Brand Crisis Communication Study', 'crisis_analysis', 'ready', 'text_analytics', CURRENT_TIMESTAMP - INTERVAL 1 DAY),
(7, 'YouTube Content Performance Metrics', 'content_analysis', 'ready', 'text_analytics', CURRENT_TIMESTAMP - INTERVAL 1 DAY),
(8, 'Reddit Discussion Mining Results', 'discussion_analysis', 'ready', 'text_analytics', CURRENT_TIMESTAMP - INTERVAL 2 DAY),
(9, 'Hashtag Performance Optimization', 'hashtag_analysis', 'ready', 'text_analytics', CURRENT_TIMESTAMP - INTERVAL 2 DAY),
(10, 'Competitor Analysis Summary', 'competitive_analysis', 'ready', 'dashboards', CURRENT_TIMESTAMP - INTERVAL 3 DAY),
(11, 'Customer Feedback Sentiment Report', 'feedback_analysis', 'ready', 'text_analytics', CURRENT_TIMESTAMP - INTERVAL 3 DAY),
(12, 'Influencer Impact Assessment', 'influencer_analysis', 'ready', 'text_analytics', CURRENT_TIMESTAMP - INTERVAL 4 DAY);

-- Insert data processing batches
INSERT OR IGNORE INTO data_batches (id, batch_name, source_type, records_count, processing_status, imported_at, project_id) VALUES
(1, 'Twitter Q4 Presidential Election', 'twitter', 25847, 'completed', CURRENT_TIMESTAMP - INTERVAL 2 HOUR, 2),
(2, 'Instagram Fashion Influencers', 'instagram', 8964, 'completed', CURRENT_TIMESTAMP - INTERVAL 4 HOUR, 3),
(3, 'LinkedIn Professional Network', 'linkedin', 12456, 'completed', CURRENT_TIMESTAMP - INTERVAL 6 HOUR, 4),
(4, 'TikTok Viral Content Analysis', 'tiktok', 18732, 'completed', CURRENT_TIMESTAMP - INTERVAL 8 HOUR, 5),
(5, 'Facebook Community Posts', 'facebook', 9876, 'processing', CURRENT_TIMESTAMP - INTERVAL 12 HOUR, 6),
(6, 'YouTube Video Comments', 'youtube', 15634, 'completed', CURRENT_TIMESTAMP - INTERVAL 1 DAY, 7),
(7, 'Reddit Discussion Threads', 'reddit', 7892, 'completed', CURRENT_TIMESTAMP - INTERVAL 1 DAY, 8),
(8, 'Multi-Platform Crisis Data', 'multi_platform', 31247, 'completed', CURRENT_TIMESTAMP - INTERVAL 2 DAY, 9);

-- Views for overview dashboard queries

-- Overview statistics view
CREATE VIEW IF NOT EXISTS overview_stats AS
SELECT 
    (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
    (SELECT SUM(records_count) FROM data_batches WHERE processing_status = 'completed') as posts_analyzed,
    (SELECT COUNT(*) FROM reports WHERE status = 'ready') as reports_ready,
    (SELECT COUNT(*) FROM system_activities WHERE created_at >= CURRENT_DATE) as todays_activities;

-- App modules status view
CREATE VIEW IF NOT EXISTS app_modules_status AS
SELECT 
    am.name,
    am.display_name,
    am.status,
    am.active_jobs,
    am.total_processed,
    am.last_activity,
    am.icon_color,
    CASE 
        WHEN am.status = 'running' THEN 'Running'
        WHEN am.active_jobs > 0 THEN CAST(am.active_jobs AS VARCHAR) || ' Active'
        WHEN am.status = 'queued' THEN CAST(am.active_jobs AS VARCHAR) || ' Queued'
        WHEN am.total_processed > 0 THEN 'Ready'
        ELSE 'Idle'
    END as status_display,
    CASE 
        WHEN am.name = 'text_analytics' AND am.status = 'running' THEN 'Processing ' || CAST((am.total_processed / 1000.0) AS DECIMAL(3,1)) || 'K posts'
        WHEN am.name = 'data_capture' THEN CAST((am.total_processed / 1000.0) AS DECIMAL(3,1)) || 'K posts today'
        WHEN am.name = 'android_analytics' THEN 'Princeton SMART data'
        WHEN am.name = 'android_research' THEN 'ECharts visualizations'
        WHEN am.last_activity IS NOT NULL THEN 'Updated ' || 
            CASE 
                WHEN am.last_activity >= CURRENT_TIMESTAMP - INTERVAL 1 HOUR THEN '1 hour ago'
                WHEN am.last_activity >= CURRENT_TIMESTAMP - INTERVAL 1 DAY THEN CAST(EXTRACT(HOUR FROM CURRENT_TIMESTAMP - am.last_activity) AS INTEGER) || ' hours ago'
                ELSE CAST(EXTRACT(DAY FROM CURRENT_TIMESTAMP - am.last_activity) AS INTEGER) || ' days ago'
            END
        ELSE 'No recent activity'
    END as activity_display
FROM app_modules am;

-- Recent activities view
CREATE VIEW IF NOT EXISTS recent_activities_view AS
SELECT 
    sa.id,
    sa.activity_type,
    sa.title,
    sa.description,
    sa.module,
    sa.status,
    sa.created_at,
    CASE 
        WHEN sa.created_at >= CURRENT_TIMESTAMP - INTERVAL 1 HOUR THEN 
            CAST(EXTRACT(MINUTE FROM CURRENT_TIMESTAMP - sa.created_at) AS INTEGER) || ' minutes ago'
        WHEN sa.created_at >= CURRENT_TIMESTAMP - INTERVAL 1 DAY THEN 
            CAST(EXTRACT(HOUR FROM CURRENT_TIMESTAMP - sa.created_at) AS INTEGER) || ' hours ago'
        ELSE 
            CAST(EXTRACT(DAY FROM CURRENT_TIMESTAMP - sa.created_at) AS INTEGER) || ' days ago'
    END as time_ago,
    CASE sa.activity_type
        WHEN 'analysis_completed' THEN 'blue'
        WHEN 'data_imported' THEN 'amber'  
        WHEN 'dashboard_updated' THEN 'indigo'
        WHEN 'job_started' THEN 'rose'
        WHEN 'data_exported' THEN 'emerald'
        WHEN 'pipeline_maintenance' THEN 'purple'
        WHEN 'model_updated' THEN 'cyan'
        ELSE 'gray'
    END as icon_color
FROM system_activities sa
ORDER BY sa.created_at DESC;

-- System status view
CREATE VIEW IF NOT EXISTS system_status_view AS
SELECT 
    sm.metric_name,
    sm.metric_value,
    sm.metric_unit,
    sm.status,
    CASE sm.metric_name
        WHEN 'data_pipeline_health' THEN 'Data Pipeline'
        WHEN 'analytics_engine_utilization' THEN 'Analytics Engine'
        WHEN 'storage_usage' THEN 'Storage'
        ELSE REPLACE(REPLACE(sm.metric_name, '_', ' '), 'utilization', '')
    END as display_name,
    CASE sm.status
        WHEN 'healthy' THEN 'bg-blue-400'
        WHEN 'warning' THEN 'bg-yellow-400'
        WHEN 'critical' THEN 'bg-red-400'
        ELSE 'bg-gray-400'
    END as status_color,
    CASE sm.status
        WHEN 'healthy' THEN 
            CASE sm.metric_name
                WHEN 'data_pipeline_health' THEN 'Healthy'
                WHEN 'analytics_engine_utilization' THEN 'Running'
                ELSE 'Normal'
            END
        WHEN 'warning' THEN 
            CASE sm.metric_name
                WHEN 'storage_usage' THEN CAST(sm.metric_value AS INTEGER) || '% Used'
                ELSE 'Warning'
            END
        WHEN 'critical' THEN 'Critical'
        ELSE 'Unknown'
    END as status_display
FROM system_metrics sm
WHERE sm.recorded_at >= CURRENT_TIMESTAMP - INTERVAL 1 HOUR
AND sm.metric_name IN ('data_pipeline_health', 'analytics_engine_utilization', 'storage_usage');