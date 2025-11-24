-- Android Research Database Schema
-- Princeton SMART Android Research Kit Extended Schema
-- This schema builds on the android_analytics.db base structure and adds advanced research tables

-- Base tables from android_analytics.db (reference - already exist)
-- android_users, android_sessions, android_accessibility_events, android_app_segments, android_screenshots

-- Advanced Research Tables for Behavioral Analysis

-- Temporal usage patterns for 24-hour circadian analysis
CREATE TABLE IF NOT EXISTS android_temporal_patterns (
    id INTEGER PRIMARY KEY,
    id_user VARCHAR(10) NOT NULL,
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
    apk VARCHAR(200) NOT NULL,
    usage_duration_minutes DECIMAL(10,2) NOT NULL,
    session_count INTEGER NOT NULL,
    avg_session_duration DECIMAL(10,2) NOT NULL,
    usage_intensity DECIMAL(5,2) NOT NULL, -- Usage as percentage of total daily usage
    analysis_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- App transition network for behavioral flow analysis
CREATE TABLE IF NOT EXISTS android_app_transitions (
    id INTEGER PRIMARY KEY,
    id_user VARCHAR(10) NOT NULL,
    id_session VARCHAR(50) NOT NULL,
    from_apk VARCHAR(200) NOT NULL,
    to_apk VARCHAR(200) NOT NULL,
    transition_timestamp BIGINT NOT NULL,
    dwell_time_ms INTEGER NOT NULL, -- Time spent in from_apk before transition
    transition_type VARCHAR(50) NOT NULL, -- DIRECT, LAUNCHER, MULTITASK, NOTIFICATION
    context_switch_count INTEGER DEFAULT 1, -- Number of context switches in this transition
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attention span research data for sustained attention analysis
CREATE TABLE IF NOT EXISTS android_attention_spans (
    id INTEGER PRIMARY KEY,
    id_user VARCHAR(10) NOT NULL,
    id_session VARCHAR(50) NOT NULL,
    apk VARCHAR(200) NOT NULL,
    attention_start_ts BIGINT NOT NULL,
    attention_duration_ms INTEGER NOT NULL,
    interruption_count INTEGER NOT NULL,
    task_switches INTEGER NOT NULL,
    depth_level INTEGER NOT NULL, -- How deep into app functionality (1=surface, 5=deep)
    engagement_score DECIMAL(5,2) NOT NULL, -- 0-100 calculated engagement
    context_type VARCHAR(50) NOT NULL, -- FOCUSED, FRAGMENTED, MULTITASKING
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content engagement analysis for digital phenotyping
CREATE TABLE IF NOT EXISTS android_content_engagement (
    id INTEGER PRIMARY KEY,
    id_user VARCHAR(10) NOT NULL,
    content_category VARCHAR(100) NOT NULL, -- SOCIAL_MEDIA, VIDEO_CONTENT, SHOPPING, etc.
    apk VARCHAR(200) NOT NULL,
    engagement_duration_ms INTEGER NOT NULL,
    interaction_depth INTEGER NOT NULL, -- Number of interactions (taps, swipes, etc.)
    return_visits INTEGER NOT NULL, -- Number of times returned to this content type
    engagement_score DECIMAL(5,2) NOT NULL,
    attention_quality VARCHAR(50) NOT NULL, -- SUSTAINED, FRAGMENTED, DISTRACTED
    emotional_valence VARCHAR(50), -- POSITIVE, NEGATIVE, NEUTRAL (if detectable)
    analysis_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cognitive load indicators for mental effort analysis
CREATE TABLE IF NOT EXISTS android_cognitive_load (
    id INTEGER PRIMARY KEY,
    id_user VARCHAR(10) NOT NULL,
    analysis_hour INTEGER NOT NULL CHECK (analysis_hour >= 0 AND analysis_hour <= 23),
    task_switching_rate DECIMAL(8,2) NOT NULL, -- Switches per hour
    multitasking_index DECIMAL(5,2) NOT NULL, -- Simultaneous app usage intensity
    attention_fragmentation DECIMAL(5,2) NOT NULL, -- 0-100, higher means more fragmented
    cognitive_efficiency DECIMAL(5,2) NOT NULL, -- 0-100, task completion effectiveness
    decision_fatigue_score DECIMAL(5,2) NOT NULL, -- 0-100, cumulative decision load
    context_switch_penalty DECIMAL(5,2) NOT NULL, -- Performance cost of switching
    analysis_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Digital phenotype classification for behavioral categorization
CREATE TABLE IF NOT EXISTS android_digital_phenotypes (
    id INTEGER PRIMARY KEY,
    id_user VARCHAR(10) NOT NULL,
    phenotype_date DATE NOT NULL,
    usage_behavior_type VARCHAR(50) NOT NULL, -- LIGHT_USER, MODERATE_USER, HEAVY_USER
    attention_profile VARCHAR(50) NOT NULL, -- SUSTAINED, MODERATE, FRAGMENTED
    usage_pattern VARCHAR(50) NOT NULL, -- MORNING_PEAK, AFTERNOON_PEAK, EVENING_PEAK, DISTRIBUTED
    multitasking_profile VARCHAR(50) NOT NULL, -- HIGH, MODERATE, LOW
    app_diversity_score DECIMAL(5,2) NOT NULL, -- 0-100, variety of apps used
    routine_consistency DECIMAL(5,2) NOT NULL, -- 0-100, predictability of usage patterns
    social_engagement_level VARCHAR(50) NOT NULL, -- HIGH, MODERATE, LOW
    productivity_orientation DECIMAL(5,2) NOT NULL, -- 0-100, work vs leisure focus
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_user, phenotype_date)
);

-- Research findings and insights
CREATE TABLE IF NOT EXISTS android_research_findings (
    id INTEGER PRIMARY KEY,
    id_user VARCHAR(10),
    finding_category VARCHAR(100) NOT NULL, -- ATTENTION, USAGE_PATTERN, TRANSITION, ENGAGEMENT
    finding_title VARCHAR(200) NOT NULL,
    finding_description TEXT NOT NULL,
    statistical_significance DECIMAL(5,4), -- p-value if applicable
    effect_size DECIMAL(6,3), -- Cohen's d or similar
    confidence_level DECIMAL(5,2), -- 0-100 confidence percentage
    research_implications TEXT,
    behavioral_recommendations TEXT,
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Network centrality analysis for app ecosystem understanding
CREATE TABLE IF NOT EXISTS android_network_centrality (
    id INTEGER PRIMARY KEY,
    apk VARCHAR(200) NOT NULL,
    app_category VARCHAR(100) NOT NULL,
    betweenness_centrality DECIMAL(8,4) NOT NULL, -- How often app is on shortest path between others
    closeness_centrality DECIMAL(8,4) NOT NULL, -- How close app is to all other apps
    eigenvector_centrality DECIMAL(8,4) NOT NULL, -- Influence based on connections to influential apps
    pagerank_score DECIMAL(8,4) NOT NULL, -- PageRank-style importance score
    in_degree INTEGER NOT NULL, -- Number of apps that transition TO this app
    out_degree INTEGER NOT NULL, -- Number of apps this app transitions TO
    hub_score DECIMAL(8,4) NOT NULL, -- How good this app is as a hub
    authority_score DECIMAL(8,4) NOT NULL, -- How authoritative this app is as destination
    analysis_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(apk, analysis_date)
);

-- Sample data for Android Research

-- Insert temporal usage patterns (24-hour patterns for 5 users)
INSERT INTO android_temporal_patterns (id, id_user, hour_of_day, day_of_week, apk, usage_duration_minutes, session_count, avg_session_duration, usage_intensity, analysis_date) VALUES
-- User SMART001 patterns
(1, 'SMART001', 7, 1, 'com.google.android.gm', 5.2, 3, 1.7, 8.5, '2024-01-15'),
(2, 'SMART001', 8, 1, 'com.chrome.browser', 12.8, 4, 3.2, 15.2, '2024-01-15'),
(3, 'SMART001', 9, 1, 'com.slack', 8.5, 2, 4.25, 12.1, '2024-01-15'),
(4, 'SMART001', 12, 1, 'com.instagram.android', 15.3, 5, 3.06, 18.7, '2024-01-15'),
(5, 'SMART001', 18, 1, 'com.google.android.youtube', 25.6, 3, 8.53, 32.4, '2024-01-15'),
(6, 'SMART001', 21, 1, 'com.netflix.mediaclient', 18.7, 2, 9.35, 22.8, '2024-01-15'),

-- User SMART002 patterns  
(7, 'SMART002', 6, 2, 'com.whatsapp', 8.2, 4, 2.05, 12.8, '2024-01-16'),
(8, 'SMART002', 10, 2, 'com.chrome.browser', 22.5, 6, 3.75, 28.2, '2024-01-16'),
(9, 'SMART002', 14, 2, 'com.google.android.youtube', 18.9, 4, 4.73, 23.1, '2024-01-16'),
(10, 'SMART002', 16, 2, 'com.instagram.android', 12.4, 7, 1.77, 15.6, '2024-01-16'),
(11, 'SMART002', 20, 2, 'com.spotify.music', 16.3, 2, 8.15, 20.3, '2024-01-16'),

-- User SMART003 heavy usage patterns
(12, 'SMART003', 9, 3, 'com.google.android.gm', 6.8, 5, 1.36, 9.2, '2024-01-17'),
(13, 'SMART003', 11, 3, 'com.chrome.browser', 28.4, 8, 3.55, 31.8, '2024-01-17'),
(14, 'SMART003', 13, 3, 'com.instagram.android', 22.7, 12, 1.89, 25.4, '2024-01-17'),
(15, 'SMART003', 15, 3, 'com.google.android.youtube', 31.2, 5, 6.24, 35.1, '2024-01-17'),
(16, 'SMART003', 19, 3, 'com.whatsapp', 14.6, 8, 1.83, 16.4, '2024-01-17'),
(17, 'SMART003', 22, 3, 'com.netflix.mediaclient', 22.8, 3, 7.6, 25.6, '2024-01-17');

-- Insert app transition data
INSERT INTO android_app_transitions (id, id_user, id_session, from_apk, to_apk, transition_timestamp, dwell_time_ms, transition_type, context_switch_count) VALUES
(1, 'SMART001', 'SESS_001_20240115_08', 'com.android.launcher', 'com.chrome.browser', 1705314000000, 2500, 'DIRECT', 1),
(2, 'SMART001', 'SESS_001_20240115_08', 'com.chrome.browser', 'com.google.android.youtube', 1705314180000, 180000, 'DIRECT', 1),
(3, 'SMART001', 'SESS_001_20240115_08', 'com.google.android.youtube', 'com.instagram.android', 1705314500000, 320000, 'DIRECT', 1),
(4, 'SMART001', 'SESS_001_20240115_08', 'com.instagram.android', 'com.whatsapp', 1705314720000, 220000, 'NOTIFICATION', 2),

(5, 'SMART002', 'SESS_002_20240116_10', 'com.android.launcher', 'com.whatsapp', 1705400400000, 1800, 'DIRECT', 1),
(6, 'SMART002', 'SESS_002_20240116_10', 'com.whatsapp', 'com.chrome.browser', 1705400520000, 120000, 'DIRECT', 1),
(7, 'SMART002', 'SESS_002_20240116_10', 'com.chrome.browser', 'com.google.android.gm', 1705400880000, 360000, 'MULTITASK', 3),

(8, 'SMART003', 'SESS_003_20240117_11', 'com.android.launcher', 'com.instagram.android', 1705486800000, 3200, 'DIRECT', 1),
(9, 'SMART003', 'SESS_003_20240117_11', 'com.instagram.android', 'com.google.android.youtube', 1705487100000, 300000, 'DIRECT', 1),
(10, 'SMART003', 'SESS_003_20240117_11', 'com.google.android.youtube', 'com.chrome.browser', 1705487650000, 550000, 'DIRECT', 1);

-- Insert attention span data
INSERT INTO android_attention_spans (id, id_user, id_session, apk, attention_start_ts, attention_duration_ms, interruption_count, task_switches, depth_level, engagement_score, context_type) VALUES
(1, 'SMART001', 'SESS_001_20240115_08', 'com.google.android.youtube', 1705314000000, 320000, 2, 1, 4, 85.6, 'FOCUSED'),
(2, 'SMART001', 'SESS_001_20240115_08', 'com.instagram.android', 1705314320000, 180000, 5, 3, 2, 62.3, 'FRAGMENTED'),
(3, 'SMART001', 'SESS_001_20240115_08', 'com.chrome.browser', 1705314500000, 450000, 1, 2, 3, 78.9, 'FOCUSED'),

(4, 'SMART002', 'SESS_002_20240116_10', 'com.whatsapp', 1705400400000, 120000, 8, 4, 2, 55.4, 'FRAGMENTED'),
(5, 'SMART002', 'SESS_002_20240116_10', 'com.chrome.browser', 1705400520000, 600000, 3, 2, 4, 82.1, 'FOCUSED'),

(6, 'SMART003', 'SESS_003_20240117_11', 'com.instagram.android', 1705486800000, 90000, 12, 6, 1, 45.2, 'FRAGMENTED'),
(7, 'SMART003', 'SESS_003_20240117_11', 'com.google.android.youtube', 1705487100000, 720000, 2, 1, 5, 91.3, 'FOCUSED'),
(8, 'SMART003', 'SESS_003_20240117_11', 'com.chrome.browser', 1705487650000, 380000, 4, 3, 3, 71.8, 'MULTITASKING');

-- Insert content engagement data
INSERT INTO android_content_engagement (id, id_user, content_category, apk, engagement_duration_ms, interaction_depth, return_visits, engagement_score, attention_quality, emotional_valence, analysis_date) VALUES
(1, 'SMART001', 'VIDEO_CONTENT', 'com.google.android.youtube', 1800000, 15, 8, 92.4, 'SUSTAINED', 'POSITIVE', '2024-01-15'),
(2, 'SMART001', 'SOCIAL_MEDIA', 'com.instagram.android', 720000, 35, 12, 78.6, 'FRAGMENTED', 'POSITIVE', '2024-01-15'),
(3, 'SMART001', 'PRODUCTIVITY', 'com.chrome.browser', 960000, 22, 6, 85.3, 'SUSTAINED', 'NEUTRAL', '2024-01-15'),
(4, 'SMART001', 'COMMUNICATION', 'com.whatsapp', 480000, 18, 15, 88.9, 'FRAGMENTED', 'POSITIVE', '2024-01-15'),

(5, 'SMART002', 'SOCIAL_MEDIA', 'com.instagram.android', 840000, 42, 14, 82.1, 'FRAGMENTED', 'POSITIVE', '2024-01-16'),
(6, 'SMART002', 'VIDEO_CONTENT', 'com.google.android.youtube', 1320000, 12, 6, 89.7, 'SUSTAINED', 'POSITIVE', '2024-01-16'),
(7, 'SMART002', 'COMMUNICATION', 'com.whatsapp', 600000, 28, 20, 91.2, 'FRAGMENTED', 'POSITIVE', '2024-01-16'),

(8, 'SMART003', 'SOCIAL_MEDIA', 'com.instagram.android', 1680000, 68, 25, 75.8, 'FRAGMENTED', 'NEUTRAL', '2024-01-17'),
(9, 'SMART003', 'VIDEO_CONTENT', 'com.google.android.youtube', 2100000, 18, 9, 94.2, 'SUSTAINED', 'POSITIVE', '2024-01-17'),
(10, 'SMART003', 'PRODUCTIVITY', 'com.chrome.browser', 1440000, 31, 8, 81.4, 'MULTITASKING', 'NEUTRAL', '2024-01-17');

-- Insert cognitive load data
INSERT INTO android_cognitive_load (id, id_user, analysis_hour, task_switching_rate, multitasking_index, attention_fragmentation, cognitive_efficiency, decision_fatigue_score, context_switch_penalty, analysis_date) VALUES
(1, 'SMART001', 8, 12.5, 3.2, 25.8, 82.4, 15.6, 8.3, '2024-01-15'),
(2, 'SMART001', 12, 18.7, 5.1, 42.3, 75.9, 28.4, 12.7, '2024-01-15'),
(3, 'SMART001', 18, 8.9, 2.1, 18.5, 88.2, 22.1, 5.8, '2024-01-15'),

(4, 'SMART002', 10, 22.3, 6.8, 55.2, 68.7, 35.9, 18.4, '2024-01-16'),
(5, 'SMART002', 14, 15.6, 4.3, 38.7, 79.1, 31.2, 11.9, '2024-01-16'),
(6, 'SMART002', 20, 9.2, 2.5, 22.1, 85.6, 18.7, 7.3, '2024-01-16'),

(7, 'SMART003', 11, 28.4, 8.9, 68.3, 58.2, 52.7, 25.6, '2024-01-17'),
(8, 'SMART003', 15, 31.7, 9.8, 72.5, 54.8, 58.9, 28.3, '2024-01-17'),
(9, 'SMART003', 19, 25.2, 7.1, 61.4, 62.3, 48.1, 22.7, '2024-01-17');

-- Insert digital phenotype classifications
INSERT INTO android_digital_phenotypes (id, id_user, phenotype_date, usage_behavior_type, attention_profile, usage_pattern, multitasking_profile, app_diversity_score, routine_consistency, social_engagement_level, productivity_orientation) VALUES
(1, 'SMART001', '2024-01-15', 'MODERATE_USER', 'SUSTAINED', 'EVENING_PEAK', 'MODERATE', 72.4, 68.9, 'MODERATE', 65.3),
(2, 'SMART002', '2024-01-16', 'MODERATE_USER', 'MODERATE', 'DISTRIBUTED', 'HIGH', 78.6, 55.2, 'HIGH', 58.7),
(3, 'SMART003', '2024-01-17', 'HEAVY_USER', 'FRAGMENTED', 'AFTERNOON_PEAK', 'HIGH', 65.8, 72.1, 'HIGH', 42.9),
(4, 'SMART004', '2024-01-18', 'LIGHT_USER', 'SUSTAINED', 'MORNING_PEAK', 'LOW', 83.2, 85.6, 'LOW', 78.4),
(5, 'SMART005', '2024-01-19', 'MODERATE_USER', 'MODERATE', 'EVENING_PEAK', 'MODERATE', 69.7, 71.3, 'MODERATE', 61.8);

-- Insert research findings
INSERT INTO android_research_findings (id, id_user, finding_category, finding_title, finding_description, statistical_significance, effect_size, confidence_level, research_implications, behavioral_recommendations, analysis_period_start, analysis_period_end) VALUES
(1, 'SMART001', 'ATTENTION', 'Sustained Attention in Video Content', 'User demonstrates significantly longer attention spans during video content consumption (avg 8.5min) compared to social media (avg 3.2min)', 0.0023, 1.47, 95.8, 'Video content provides optimal engagement window for important information delivery', 'Schedule critical notifications during non-video consumption periods', '2024-01-15', '2024-01-15'),

(2, 'SMART002', 'USAGE_PATTERN', 'High Multitasking Behavior', 'User exhibits elevated task-switching rates (22.3 switches/hour) with associated cognitive efficiency reduction', 0.0145, 0.89, 92.3, 'Multitasking behavior correlates with reduced task completion effectiveness', 'Implement focus-time scheduling and notification batching', '2024-01-16', '2024-01-16'),

(3, 'SMART003', 'ENGAGEMENT', 'Social Media Engagement Saturation', 'Heavy usage patterns show diminishing engagement scores despite increased time investment', 0.0067, 1.23, 94.1, 'Usage intensity does not correlate linearly with engagement quality', 'Consider usage time limits and quality-based engagement metrics', '2024-01-17', '2024-01-17'),

(4, NULL, 'TRANSITION', 'App Ecosystem Hub Pattern', 'YouTube and Chrome serve as primary transition hubs in user navigation patterns across all participants', 0.0001, 2.34, 99.2, 'Certain apps act as gateway nodes in digital behavior networks', 'Target hub applications for behavioral intervention effectiveness', '2024-01-15', '2024-01-19'),

(5, NULL, 'TEMPORAL', 'Evening Peak Usage Universality', 'All users demonstrate peak digital activity between 18:00-22:00 regardless of individual chronotype', 0.0008, 1.89, 98.7, 'Evening hours represent critical attention allocation period across user types', 'Design evening-optimized interfaces and content delivery systems', '2024-01-15', '2024-01-19');

-- Insert network centrality analysis
INSERT INTO android_network_centrality (id, apk, app_category, betweenness_centrality, closeness_centrality, eigenvector_centrality, pagerank_score, in_degree, out_degree, hub_score, authority_score, analysis_date) VALUES
(1, 'com.google.android.youtube', 'ENTERTAINMENT', 0.2847, 0.6523, 0.8912, 0.1845, 18, 12, 0.7834, 0.9156, '2024-01-15'),
(2, 'com.chrome.browser', 'PRODUCTIVITY', 0.3156, 0.7234, 0.7654, 0.1923, 15, 16, 0.8423, 0.7891, '2024-01-15'),
(3, 'com.instagram.android', 'SOCIAL', 0.1923, 0.5678, 0.6789, 0.1456, 12, 14, 0.6234, 0.7345, '2024-01-15'),
(4, 'com.whatsapp', 'COMMUNICATION', 0.1567, 0.5234, 0.5678, 0.1234, 10, 8, 0.5123, 0.6789, '2024-01-15'),
(5, 'com.android.launcher', 'SYSTEM', 0.4234, 0.8456, 0.3456, 0.2345, 25, 22, 0.9234, 0.4567, '2024-01-15'),
(6, 'com.google.android.gm', 'PRODUCTIVITY', 0.0867, 0.4123, 0.4567, 0.0923, 8, 6, 0.3456, 0.5234, '2024-01-15'),
(7, 'com.netflix.mediaclient', 'ENTERTAINMENT', 0.0654, 0.3456, 0.3456, 0.0756, 6, 4, 0.2345, 0.4123, '2024-01-15'),
(8, 'com.spotify.music', 'ENTERTAINMENT', 0.0432, 0.2789, 0.2789, 0.0567, 4, 3, 0.1567, 0.3234, '2024-01-15');

-- Analytical Views for Android Research

-- Comprehensive temporal analysis view
CREATE VIEW IF NOT EXISTS android_temporal_analysis AS
SELECT 
    tp.hour_of_day,
    tp.day_of_week,
    CASE tp.day_of_week
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
        ELSE 'Sunday'
    END as day_name,
    tp.apk,
    CASE 
        WHEN tp.apk LIKE '%youtube%' THEN 'YouTube'
        WHEN tp.apk LIKE '%chrome%' THEN 'Chrome'
        WHEN tp.apk LIKE '%instagram%' THEN 'Instagram'
        WHEN tp.apk LIKE '%whatsapp%' THEN 'WhatsApp'
        WHEN tp.apk LIKE '%spotify%' THEN 'Spotify'
        WHEN tp.apk LIKE '%netflix%' THEN 'Netflix'
        ELSE SUBSTRING(tp.apk, LENGTH(tp.apk) - POSITION('.' IN REVERSE(tp.apk)) + 2)
    END as app_name,
    AVG(tp.usage_duration_minutes) as avg_usage_minutes,
    SUM(tp.session_count) as total_sessions,
    AVG(tp.avg_session_duration) as avg_session_duration,
    AVG(tp.usage_intensity) as avg_intensity
FROM android_temporal_patterns tp
GROUP BY tp.hour_of_day, tp.day_of_week, tp.apk
ORDER BY tp.hour_of_day, avg_usage_minutes DESC;

-- Attention research summary view
CREATE VIEW IF NOT EXISTS android_attention_research AS
SELECT 
    ats.apk,
    CASE 
        WHEN ats.apk LIKE '%youtube%' THEN 'YouTube'
        WHEN ats.apk LIKE '%chrome%' THEN 'Chrome'
        WHEN ats.apk LIKE '%instagram%' THEN 'Instagram'
        WHEN ats.apk LIKE '%whatsapp%' THEN 'WhatsApp'
        WHEN ats.apk LIKE '%spotify%' THEN 'Spotify'
        ELSE SUBSTRING(ats.apk, LENGTH(ats.apk) - POSITION('.' IN REVERSE(ats.apk)) + 2)
    END as app_name,
    COUNT(*) as attention_episodes,
    AVG(ats.attention_duration_ms / 1000.0) as mean_duration_seconds,
    STDDEV(ats.attention_duration_ms / 1000.0) as duration_std_dev,
    AVG(ats.interruption_count) as avg_interruptions,
    AVG(ats.task_switches) as avg_task_switches,
    AVG(ats.depth_level) as avg_depth_level,
    AVG(ats.engagement_score) as avg_engagement_score,
    COUNT(CASE WHEN ats.context_type = 'FOCUSED' THEN 1 END) as focused_episodes,
    COUNT(CASE WHEN ats.context_type = 'FRAGMENTED' THEN 1 END) as fragmented_episodes,
    COUNT(CASE WHEN ats.context_type = 'MULTITASKING' THEN 1 END) as multitasking_episodes
FROM android_attention_spans ats
GROUP BY ats.apk
ORDER BY mean_duration_seconds DESC;

-- Content engagement summary view
CREATE VIEW IF NOT EXISTS android_engagement_summary AS
SELECT 
    ace.content_category,
    COUNT(DISTINCT ace.id_user) as unique_users,
    COUNT(*) as engagement_episodes,
    AVG(ace.engagement_duration_ms / 60000.0) as avg_duration_minutes,
    AVG(ace.interaction_depth) as avg_interaction_depth,
    AVG(ace.return_visits) as avg_return_visits,
    AVG(ace.engagement_score) as avg_engagement_score,
    COUNT(CASE WHEN ace.attention_quality = 'SUSTAINED' THEN 1 END) as sustained_attention_count,
    COUNT(CASE WHEN ace.attention_quality = 'FRAGMENTED' THEN 1 END) as fragmented_attention_count,
    COUNT(CASE WHEN ace.emotional_valence = 'POSITIVE' THEN 1 END) as positive_valence_count,
    COUNT(CASE WHEN ace.emotional_valence = 'NEGATIVE' THEN 1 END) as negative_valence_count
FROM android_content_engagement ace
GROUP BY ace.content_category
ORDER BY avg_engagement_score DESC;

-- Behavioral metrics summary view
CREATE VIEW IF NOT EXISTS android_behavioral_summary AS
SELECT 
    adp.id_user,
    adp.usage_behavior_type,
    adp.attention_profile,
    adp.usage_pattern,
    adp.multitasking_profile,
    adp.app_diversity_score,
    adp.routine_consistency,
    adp.social_engagement_level,
    adp.productivity_orientation,
    
    -- Aggregate temporal data
    COALESCE(tp_agg.total_daily_usage, 0) as total_daily_usage_minutes,
    COALESCE(tp_agg.peak_usage_hour, 12) as peak_usage_hour,
    COALESCE(tp_agg.unique_apps_used, 0) as unique_apps_used,
    
    -- Aggregate attention data
    COALESCE(att_agg.avg_attention_duration, 0) as avg_attention_duration_seconds,
    COALESCE(att_agg.avg_engagement_score, 0) as avg_engagement_score,
    
    -- Aggregate cognitive load
    COALESCE(cog_agg.avg_task_switching_rate, 0) as avg_task_switching_rate,
    COALESCE(cog_agg.avg_cognitive_efficiency, 0) as avg_cognitive_efficiency

FROM android_digital_phenotypes adp

LEFT JOIN (
    SELECT 
        tp.id_user,
        SUM(tp.usage_duration_minutes) as total_daily_usage,
        MAX(CASE WHEN tp.usage_duration_minutes = max_usage.max_duration THEN tp.hour_of_day END) as peak_usage_hour,
        COUNT(DISTINCT tp.apk) as unique_apps_used
    FROM android_temporal_patterns tp
    JOIN (
        SELECT id_user, MAX(usage_duration_minutes) as max_duration
        FROM android_temporal_patterns
        GROUP BY id_user
    ) max_usage ON tp.id_user = max_usage.id_user
    GROUP BY tp.id_user
) tp_agg ON adp.id_user = tp_agg.id_user

LEFT JOIN (
    SELECT 
        ats.id_user,
        AVG(ats.attention_duration_ms / 1000.0) as avg_attention_duration,
        AVG(ats.engagement_score) as avg_engagement_score
    FROM android_attention_spans ats
    GROUP BY ats.id_user
) att_agg ON adp.id_user = att_agg.id_user

LEFT JOIN (
    SELECT 
        acl.id_user,
        AVG(acl.task_switching_rate) as avg_task_switching_rate,
        AVG(acl.cognitive_efficiency) as avg_cognitive_efficiency
    FROM android_cognitive_load acl
    GROUP BY acl.id_user
) cog_agg ON adp.id_user = cog_agg.id_user

ORDER BY adp.phenotype_date DESC;

-- Network analysis view for app transitions
CREATE VIEW IF NOT EXISTS android_network_analysis AS
SELECT 
    anc.apk,
    CASE 
        WHEN anc.apk LIKE '%youtube%' THEN 'YouTube'
        WHEN anc.apk LIKE '%chrome%' THEN 'Chrome'
        WHEN anc.apk LIKE '%instagram%' THEN 'Instagram'
        WHEN anc.apk LIKE '%whatsapp%' THEN 'WhatsApp'
        WHEN anc.apk LIKE '%launcher%' THEN 'Home Screen'
        ELSE SUBSTRING(anc.apk, LENGTH(anc.apk) - POSITION('.' IN REVERSE(anc.apk)) + 2)
    END as app_name,
    anc.app_category,
    anc.betweenness_centrality,
    anc.closeness_centrality,
    anc.eigenvector_centrality,
    anc.pagerank_score,
    anc.in_degree,
    anc.out_degree,
    anc.hub_score,
    anc.authority_score,
    (anc.in_degree + anc.out_degree) as total_degree,
    (anc.betweenness_centrality + anc.closeness_centrality + anc.eigenvector_centrality) / 3 as overall_centrality
FROM android_network_centrality anc
ORDER BY overall_centrality DESC;