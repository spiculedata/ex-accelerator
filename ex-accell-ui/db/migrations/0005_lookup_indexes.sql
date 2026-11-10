-- Indexes for the per-post lookups the dashboards run (latest classification, engagement, language
-- and emotion per post) and for time-window scans of posts. IF NOT EXISTS keeps this safe on
-- databases that already have equivalent indexes.
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_classifications_post_id ON sentiment_classifications (post_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_post_engagement_post_id ON post_engagement (post_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_analysis_post_id ON emotion_analysis (post_id);
CREATE INDEX IF NOT EXISTS idx_language_detection_post_id ON language_detection (post_id);
CREATE INDEX IF NOT EXISTS idx_language_mixing_post_id ON language_mixing (post_id);
