-- Android Analytics DuckDB Schema for Princeton SMART / Screenlake Research Kit Data
-- This schema stores mobile device interaction data including accessibility events, app segments, and screenshots

-- Drop existing views if they exist (views first)
DROP VIEW IF EXISTS android_session_analytics;
DROP VIEW IF EXISTS android_app_analytics;
DROP VIEW IF EXISTS android_user_patterns;
DROP VIEW IF EXISTS android_dashboard_stats;

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS android_accessibility_events;
DROP TABLE IF EXISTS android_app_segments; 
DROP TABLE IF EXISTS android_screenshots;
DROP TABLE IF EXISTS android_sessions;
DROP TABLE IF EXISTS android_users;

-- Users table for research participants
CREATE TABLE android_users (
    id_user VARCHAR(10) PRIMARY KEY,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    study_group VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active'
);

-- Sessions table for tracking usage periods
CREATE TABLE android_sessions (
    id_session VARCHAR(50) PRIMARY KEY,
    id_user VARCHAR(10),
    session_start TIMESTAMP,
    session_end TIMESTAMP,
    device_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accessibility events (screen interactions, URLs, session events)
CREATE TABLE android_accessibility_events (
    id INTEGER,
    id_user VARCHAR(10),
    id_session VARCHAR(50),
    type VARCHAR(50) NOT NULL, -- SESSION_START, SCREEN_TEXT, URL, etc.
    t_unix_ts_ms BIGINT NOT NULL,
    apk VARCHAR(200), -- Android package name
    text TEXT, -- Screen text or URL content
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- App usage segments (time spent in each app)
CREATE TABLE android_app_segments (
    id INTEGER,
    id_user VARCHAR(10),
    id_session VARCHAR(50),
    apk VARCHAR(200) NOT NULL,
    t_unix_ts_segment_start BIGINT NOT NULL,
    duration_segment_ms INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Screenshots with OCR text extraction
CREATE TABLE android_screenshots (
    id INTEGER,
    id_user VARCHAR(10),
    file VARCHAR(500) NOT NULL,
    apk VARCHAR(200),
    app VARCHAR(100),
    text TEXT, -- OCR extracted text
    t_epoch_ts_ms BIGINT NOT NULL,
    t_natural_day_ts VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample users
INSERT INTO android_users (id_user, enrollment_date, device_model, os_version, study_group, status) VALUES
('7324', '2025-04-10', 'Samsung Galaxy S23', 'Android 14', 'control', 'active'),
('7325', '2025-04-11', 'Google Pixel 8', 'Android 14', 'intervention', 'active'),
('7326', '2025-04-12', 'OnePlus 11', 'Android 13', 'control', 'active'),
('7327', '2025-04-13', 'Samsung Galaxy S24', 'Android 14', 'intervention', 'active'),
('7328', '2025-04-14', 'iPhone 15 Pro', 'iOS 17.4', 'control', 'active');

-- Insert sample sessions
INSERT INTO android_sessions (id_session, id_user, session_start, session_end, device_id) VALUES
('5db4bc90-8fcf-4d20-b6d7-4474def9786f', '7324', '2025-04-14 18:00:00', '2025-04-14 18:39:00', 'samsung_s23_001'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '7325', '2025-04-14 19:15:00', '2025-04-14 20:30:00', 'pixel_8_002'),
('f9e8d7c6-b5a4-9384-7162-504837291056', '7326', '2025-04-14 20:45:00', '2025-04-14 22:00:00', 'oneplus_11_003'),
('12345678-abcd-efgh-ijkl-123456789012', '7327', '2025-04-14 14:30:00', '2025-04-14 16:15:00', 'samsung_s24_004'),
('98765432-zyxw-vuts-rqpo-987654321098', '7328', '2025-04-14 21:00:00', '2025-04-14 22:45:00', 'iphone_15_005');

-- Insert sample accessibility events (30 records across multiple users)
INSERT INTO android_accessibility_events (id, id_user, id_session, type, t_unix_ts_ms, apk, text) VALUES
-- User 7324 events
(1, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'SESSION_START', 1744765248255, NULL, NULL),
(2, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'SCREEN_TEXT', 1744765268335, 'com.android.systemui', 'Internet AndroidWifi Bluetooth On Flashlight Camera in use Do Not Disturb Off'),
(3, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'URL', 1744765042854, 'com.android.chrome', 'amazon.com/amazonprime'),
(4, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'SCREEN_TEXT', 1744765017542, 'com.android.chrome', 'TAP TO UNMUTE Dialog Search YouTube Account Open App 1 000 000 Villager MANHUNT'),
(5, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'SCREEN_TEXT', 1744765300000, 'com.google.android.youtube', 'Home Shorts Subscriptions Library Search trending videos for you'),
(6, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'SCREEN_TEXT', 1744765350000, 'com.google.android.youtube', 'Tech Review 2025 Best Smartphones Camera Comparison Battery Life Test'),
(7, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'URL', 1744765400000, 'com.android.chrome', 'reddit.com/r/technology'),
(8, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'SCREEN_TEXT', 1744765450000, 'com.android.chrome', 'Reddit Technology Discussion AI News Machine Learning Updates'),

-- User 7325 events
(9, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SESSION_START', 1744768945000, NULL, NULL),
(10, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SCREEN_TEXT', 1744768945123, 'com.whatsapp', 'WhatsApp chat conversation with friends about weekend plans'),
(11, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SCREEN_TEXT', 1744769000000, 'com.whatsapp', 'Hey everyone! Movie night at my place Saturday 8pm? Bring snacks!'),
(12, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SCREEN_TEXT', 1744769100000, 'com.instagram.android', 'Instagram feed photo from vacation sunset beach beautiful view'),
(13, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SCREEN_TEXT', 1744769200000, 'com.instagram.android', 'Stories highlights friends travel food lifestyle wellness tips'),
(14, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'URL', 1744769300000, 'com.android.chrome', 'instagram.com/explore'),
(15, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SCREEN_TEXT', 1744769400000, 'com.netflix.mediaclient', 'Netflix continue watching trending now top picks for you'),

-- User 7326 events  
(16, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'SESSION_START', 1744770000000, NULL, NULL),
(17, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'URL', 1744769234567, 'com.android.chrome', 'youtube.com/watch?v=technology_trends_2025'),
(18, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'SCREEN_TEXT', 1744770100000, 'com.spotify.music', 'Spotify your library recently played discover weekly made for you'),
(19, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'SCREEN_TEXT', 1744770200000, 'com.spotify.music', 'Now playing Technology Trends 2025 Podcast Episode 42 AI Revolution'),
(20, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'SCREEN_TEXT', 1744770300000, 'com.twitter.android', 'Twitter timeline breaking news tech updates AI developments'),
(21, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'SCREEN_TEXT', 1744770400000, 'com.twitter.android', 'Thread about machine learning breakthrough researchers announce new model'),

-- User 7327 events
(22, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'SESSION_START', 1744760000000, NULL, NULL),
(23, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'SCREEN_TEXT', 1744760100000, 'com.slack', 'Slack workspace team updates project deadlines collaboration'),
(24, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'SCREEN_TEXT', 1744760200000, 'com.slack', 'Meeting reminder standup at 2pm design review presentation slides'),
(25, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'URL', 1744760300000, 'com.android.chrome', 'docs.google.com/presentation'),
(26, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'SCREEN_TEXT', 1744760400000, 'com.google.android.apps.docs.editors.slides', 'Google Slides quarterly review performance metrics growth strategy'),
(27, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'SCREEN_TEXT', 1744760500000, 'com.microsoft.teams', 'Microsoft Teams video call join meeting camera microphone settings'),

-- User 7328 events  
(28, '7328', '98765432-zyxw-vuts-rqpo-987654321098', 'SESSION_START', 1744772000000, NULL, NULL),
(29, '7328', '98765432-zyxw-vuts-rqpo-987654321098', 'SCREEN_TEXT', 1744772100000, 'com.apple.mobilemail', 'Mail inbox unread messages important flagged work personal'),
(30, '7328', '98765432-zyxw-vuts-rqpo-987654321098', 'SCREEN_TEXT', 1744772200000, 'com.apple.mobilecal', 'Calendar today tomorrow upcoming appointments meetings schedule');

-- Insert sample app segments (25 records across users and apps)
INSERT INTO android_app_segments (id, id_user, id_session, apk, t_unix_ts_segment_start, duration_segment_ms) VALUES
-- User 7324 segments
(1, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'com.google.android.youtube', 1744668380017, 480032),
(2, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'com.android.chrome', 1744765042854, 245000),
(3, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'com.google.android.apps.nexuslauncher', 1744668862080, 193172),
(4, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'com.screenlake', 1744669057265, 434279),
(5, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'com.google.android.youtube', 1744765300000, 420000),
(6, '7324', '5db4bc90-8fcf-4d20-b6d7-4474def9786f', 'com.android.chrome', 1744765400000, 380000),

-- User 7325 segments
(7, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'com.whatsapp', 1744768945123, 720000),
(8, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'com.instagram.android', 1744769234567, 892000),
(9, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'com.android.chrome', 1744769300000, 180000),
(10, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'com.netflix.mediaclient', 1744769400000, 1800000),
(11, '7325', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'com.whatsapp', 1744770000000, 300000),

-- User 7326 segments
(12, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'com.spotify.music', 1744770123456, 1200000),
(13, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'com.twitter.android', 1744771234567, 650000),
(14, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'com.android.chrome', 1744769234567, 420000),
(15, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'com.spotify.music', 1744770500000, 900000),
(16, '7326', 'f9e8d7c6-b5a4-9384-7162-504837291056', 'com.twitter.android', 1744771000000, 480000),

-- User 7327 segments
(17, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'com.slack', 1744760100000, 600000),
(18, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'com.android.chrome', 1744760300000, 300000),
(19, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'com.google.android.apps.docs.editors.slides', 1744760400000, 1200000),
(20, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'com.microsoft.teams', 1744760500000, 1800000),
(21, '7327', '12345678-abcd-efgh-ijkl-123456789012', 'com.slack', 1744761000000, 480000),

-- User 7328 segments  
(22, '7328', '98765432-zyxw-vuts-rqpo-987654321098', 'com.apple.mobilemail', 1744772100000, 360000),
(23, '7328', '98765432-zyxw-vuts-rqpo-987654321098', 'com.apple.mobilecal', 1744772200000, 240000),
(24, '7328', '98765432-zyxw-vuts-rqpo-987654321098', 'com.apple.mobilesafari', 1744772300000, 600000),
(25, '7328', '98765432-zyxw-vuts-rqpo-987654321098', 'com.apple.news', 1744772400000, 900000);

-- Insert sample screenshots (20 records with realistic OCR text)
INSERT INTO android_screenshots (id, id_user, file, apk, app, text, t_epoch_ts_ms, t_natural_day_ts) VALUES
-- User 7324 screenshots
(1, '7324', 'img_06a60ee6-006f-40f6-95d4-65fdce368553Screenshot_2025-04-14_18-06-14.jpg', 'com.google.android.permissioncontroller', 'Permission controller', 'srk ned screenshot service now taking screenshots every 3 seconds', 1744668374979, '04/14/2025'),
(2, '7324', 'img_d9e776fb-a51b-47a7-a697-0be76429cfb9Screenshot_2025-04-14_18-06-20.jpg', 'com.google.android.youtube', 'YouTube', 'youtube search try searching to get started home shorts subscriptions library', 1744668380017, '04/14/2025'),
(3, '7324', 'img_91c04571-f0ea-4e05-814e-6b0cd36a472fScreenshot_2025-04-14_18-06-25.jpg', 'com.google.android.youtube', 'YouTube', 'cat videos for cats to watch cat videos funny cat videos for kids', 1744668385039, '04/14/2025'),
(4, '7324', 'img_chrome_amazon_screenshot.jpg', 'com.android.chrome', 'Chrome Browser', 'Amazon Prime Video streaming movies TV shows original content', 1744765042854, '04/14/2025'),
(5, '7324', 'img_chrome_reddit_screenshot.jpg', 'com.android.chrome', 'Chrome Browser', 'Reddit r/technology trending posts AI machine learning discussions', 1744765400000, '04/14/2025'),

-- User 7325 screenshots
(6, '7325', 'img_abc123-screenshot-whatsapp.jpg', 'com.whatsapp', 'WhatsApp', 'Hey, are we still meeting tomorrow? Let me know when you get this message!', 1744768945123, '04/14/2025'),
(7, '7325', 'img_instagram_feed_screenshot.jpg', 'com.instagram.android', 'Instagram', 'Instagram stories highlights friends travel food lifestyle wellness posts', 1744769200000, '04/14/2025'),
(8, '7325', 'img_netflix_homepage_screenshot.jpg', 'com.netflix.mediaclient', 'Netflix', 'Netflix continue watching trending now recommended for you action drama comedy', 1744769400000, '04/14/2025'),
(9, '7325', 'img_whatsapp_group_screenshot.jpg', 'com.whatsapp', 'WhatsApp', 'Group chat movie night planning Saturday 8pm everyone invited bring snacks', 1744770000000, '04/14/2025'),

-- User 7326 screenshots
(10, '7326', 'img_def456-screenshot-spotify.jpg', 'com.spotify.music', 'Spotify', 'Now Playing: Technology Trends 2025 Podcast - Episode 42: AI Revolution', 1744770123456, '04/14/2025'),
(11, '7326', 'img_twitter_timeline_screenshot.jpg', 'com.twitter.android', 'Twitter', 'Twitter timeline breaking news tech updates AI developments machine learning', 1744771234567, '04/14/2025'),
(12, '7326', 'img_chrome_youtube_screenshot.jpg', 'com.android.chrome', 'Chrome Browser', 'YouTube technology trends 2025 AI artificial intelligence future predictions', 1744769234567, '04/14/2025'),
(13, '7326', 'img_spotify_discover_screenshot.jpg', 'com.spotify.music', 'Spotify', 'Discover Weekly your library recently played made for you daily mixes', 1744770500000, '04/14/2025'),

-- User 7327 screenshots
(14, '7327', 'img_slack_workspace_screenshot.jpg', 'com.slack', 'Slack', 'Slack workspace team updates project deadlines standup meeting 2pm today', 1744760100000, '04/14/2025'),
(15, '7327', 'img_google_slides_screenshot.jpg', 'com.google.android.apps.docs.editors.slides', 'Google Slides', 'Quarterly Review Performance Metrics Growth Strategy Q4 Results Presentation', 1744760400000, '04/14/2025'),
(16, '7327', 'img_teams_meeting_screenshot.jpg', 'com.microsoft.teams', 'Microsoft Teams', 'Microsoft Teams video call join meeting camera microphone settings participants', 1744760500000, '04/14/2025'),
(17, '7327', 'img_chrome_docs_screenshot.jpg', 'com.android.chrome', 'Chrome Browser', 'Google Docs presentation slides quarterly review performance metrics', 1744760300000, '04/14/2025'),

-- User 7328 screenshots
(18, '7328', 'img_apple_mail_screenshot.jpg', 'com.apple.mobilemail', 'Mail', 'Mail inbox unread messages important flagged work emails personal correspondence', 1744772100000, '04/14/2025'),
(19, '7328', 'img_apple_calendar_screenshot.jpg', 'com.apple.mobilecal', 'Calendar', 'Calendar today schedule upcoming appointments meetings this week next week', 1744772200000, '04/14/2025'),
(20, '7328', 'img_apple_news_screenshot.jpg', 'com.apple.news', 'Apple News', 'Apple News technology section latest updates industry insights innovation trends', 1744772400000, '04/14/2025');

-- Create analytical views for dashboard queries

-- Session analytics view
CREATE VIEW android_session_analytics AS
SELECT 
    s.id_session,
    s.id_user,
    ROUND(EXTRACT(EPOCH FROM (s.session_end - s.session_start)) / 60, 1) as duration_minutes,
    COUNT(DISTINCT seg.apk) as unique_apps_used,
    COUNT(DISTINCT sc.id) as total_screenshots,
    ROUND(SUM(seg.duration_segment_ms) / 60000.0, 1) as total_active_minutes,
    COUNT(DISTINCT ae.id) as total_events
FROM android_sessions s
LEFT JOIN android_app_segments seg ON s.id_session = seg.id_session
LEFT JOIN android_screenshots sc ON s.id_user = sc.id_user
LEFT JOIN android_accessibility_events ae ON s.id_session = ae.id_session
GROUP BY s.id_session, s.id_user, s.session_start, s.session_end;

-- App analytics view
CREATE VIEW android_app_analytics AS
SELECT 
    seg.apk,
    CASE 
        WHEN seg.apk LIKE '%youtube%' THEN 'YouTube'
        WHEN seg.apk LIKE '%chrome%' THEN 'Chrome Browser'
        WHEN seg.apk LIKE '%whatsapp%' THEN 'WhatsApp'
        WHEN seg.apk LIKE '%instagram%' THEN 'Instagram'
        WHEN seg.apk LIKE '%spotify%' THEN 'Spotify'
        WHEN seg.apk LIKE '%netflix%' THEN 'Netflix'
        WHEN seg.apk LIKE '%twitter%' THEN 'Twitter'
        WHEN seg.apk LIKE '%slack%' THEN 'Slack'
        WHEN seg.apk LIKE '%teams%' THEN 'Microsoft Teams'
        WHEN seg.apk LIKE '%slides%' THEN 'Google Slides'
        WHEN seg.apk LIKE '%apple.mobile%' THEN REPLACE(REPLACE(seg.apk, 'com.apple.mobile', ''), 'com.apple.', '')
        ELSE SUBSTRING(seg.apk, LENGTH(seg.apk) - POSITION('.' IN REVERSE(seg.apk)) + 2)
    END as app_name,
    CASE 
        WHEN seg.apk LIKE '%youtube%' OR seg.apk LIKE '%netflix%' THEN 'Entertainment'
        WHEN seg.apk LIKE '%whatsapp%' OR seg.apk LIKE '%chrome%' OR seg.apk LIKE '%mail%' THEN 'Communication'
        WHEN seg.apk LIKE '%instagram%' OR seg.apk LIKE '%twitter%' THEN 'Social'
        WHEN seg.apk LIKE '%spotify%' THEN 'Music'
        WHEN seg.apk LIKE '%slack%' OR seg.apk LIKE '%teams%' OR seg.apk LIKE '%slides%' THEN 'Productivity'
        WHEN seg.apk LIKE '%news%' OR seg.apk LIKE '%safari%' THEN 'News'
        ELSE 'Other'
    END as category,
    COUNT(DISTINCT seg.id_session) as usage_sessions,
    ROUND(SUM(seg.duration_segment_ms) / 60000.0, 1) as total_minutes,
    ROUND(AVG(seg.duration_segment_ms) / 60000.0, 1) as avg_session_minutes,
    COUNT(DISTINCT sc.id) as screenshot_count,
    COUNT(DISTINCT seg.id_user) as unique_users
FROM android_app_segments seg
LEFT JOIN android_screenshots sc ON seg.apk = sc.apk
GROUP BY seg.apk;

-- User behavior patterns view
CREATE VIEW android_user_patterns AS
SELECT 
    u.id_user,
    COUNT(DISTINCT s.id_session) as total_sessions,
    ROUND(SUM(EXTRACT(EPOCH FROM (s.session_end - s.session_start)) / 60), 1) as total_session_minutes,
    COUNT(DISTINCT seg.apk) as unique_apps_used,
    COUNT(DISTINCT sc.id) as total_screenshots,
    COUNT(DISTINCT ae.id) as total_events,
    ROUND(AVG(EXTRACT(EPOCH FROM (s.session_end - s.session_start)) / 60), 1) as avg_session_duration
FROM android_users u
LEFT JOIN android_sessions s ON u.id_user = s.id_user
LEFT JOIN android_app_segments seg ON s.id_session = seg.id_session
LEFT JOIN android_screenshots sc ON u.id_user = sc.id_user
LEFT JOIN android_accessibility_events ae ON s.id_session = ae.id_session
GROUP BY u.id_user;

-- Dashboard statistics view
CREATE VIEW android_dashboard_stats AS
SELECT 
    COUNT(DISTINCT s.id_session) as total_sessions,
    COUNT(DISTINCT sc.id) as total_screenshots,
    COUNT(DISTINCT seg.apk) as unique_apps,
    ROUND(SUM(seg.duration_segment_ms) / 60000.0, 0) as total_duration_minutes,
    COUNT(DISTINCT ae.id) as total_events,
    COUNT(DISTINCT u.id_user) as active_users,
    COUNT(DISTINCT CASE WHEN s.session_start >= CURRENT_DATE THEN s.id_session END) as todays_sessions
FROM android_users u
LEFT JOIN android_sessions s ON u.id_user = s.id_user
LEFT JOIN android_app_segments seg ON s.id_session = seg.id_session
LEFT JOIN android_screenshots sc ON u.id_user = sc.id_user
LEFT JOIN android_accessibility_events ae ON s.id_session = ae.id_session;

-- End of schema