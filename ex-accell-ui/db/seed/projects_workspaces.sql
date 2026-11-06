-- Sample rows extracted from sql/schemas/projects_workspaces_schema.sql (demo data, see issue #63)
-- Insert sample data
INSERT INTO projects (name, description, project_type, created_by) VALUES
  ('Social Media Sentiment Analysis', 'Track public sentiment across Twitter, Reddit, and Telegram', 'social-media', 'admin@example.com'),
  ('Market Intelligence Dashboard', 'Monitor competitor activity and market trends', 'market-research', 'admin@example.com'),
  ('Customer Feedback Analytics', 'Analyze customer reviews and support tickets', 'customer-feedback', 'admin@example.com');

INSERT INTO project_members (project_id, email, role) VALUES
  (1, 'admin@example.com', 'owner'),
  (1, 'analyst@example.com', 'member'),
  (2, 'admin@example.com', 'owner'),
  (3, 'admin@example.com', 'owner');

INSERT INTO workspaces (project_id, name, description, workspace_type, created_by) VALUES
  (1, 'Twitter Analysis', 'Real-time Twitter sentiment tracking', 'analysis', 'admin@example.com'),
  (1, 'Reddit Monitoring', 'Reddit community sentiment and trends', 'analysis', 'admin@example.com'),
  (1, 'Telegram Channels', 'Monitor Telegram channel activity', 'exploration', 'admin@example.com'),
  (2, 'Competitor Tracking', 'Track competitor social media activity', 'analysis', 'admin@example.com'),
  (2, 'Brand Mentions', 'Monitor brand mentions across platforms', 'reporting', 'admin@example.com');

INSERT INTO workspace_data_sources (workspace_id, source_type, source_name, status, record_count) VALUES
  (1, 'twitter', 'Twitter API v2', 'active', 15000),
  (2, 'reddit', 'Reddit API', 'active', 8500),
  (3, 'telegram', 'Telegram Scraper', 'active', 12000),
  (4, 'twitter', 'Twitter Competitor Feed', 'active', 5000),
  (5, 'twitter', 'Brand Monitoring', 'active', 3200);
