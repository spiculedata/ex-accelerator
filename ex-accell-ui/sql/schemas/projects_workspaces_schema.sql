-- Projects and Workspaces Schema
-- Multi-tiered hierarchy: Projects → Workspaces → Resources

-- Drop existing tables if they exist
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspace_data_sources CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Projects Table (Top Level)
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_type VARCHAR(50) NOT NULL, -- social-media, market-research, customer-feedback, content-analysis
  status VARCHAR(50) DEFAULT 'active', -- active, archived, completed
  created_by VARCHAR(255) NOT NULL DEFAULT 'default_user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settings JSONB DEFAULT '{}', -- Project-level settings
  CONSTRAINT unique_project_name UNIQUE (name)
);

-- Project Members (Team access)
CREATE TABLE project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member', -- owner, admin, member, viewer
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_project_member UNIQUE (project_id, email)
);

-- Workspaces Table (Within Projects)
CREATE TABLE workspaces (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  workspace_type VARCHAR(50) DEFAULT 'general', -- general, analysis, exploration, reporting
  status VARCHAR(50) DEFAULT 'active', -- active, archived
  created_by VARCHAR(255) NOT NULL DEFAULT 'default_user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settings JSONB DEFAULT '{}', -- Workspace-level settings
  CONSTRAINT unique_workspace_name_per_project UNIQUE (project_id, name)
);

-- Workspace Data Sources (Available data within workspace)
CREATE TABLE workspace_data_sources (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL, -- twitter, reddit, telegram, csv-upload, etc.
  source_name VARCHAR(255) NOT NULL,
  connection_details JSONB DEFAULT '{}', -- API keys, credentials, file paths, etc.
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, error
  last_sync TIMESTAMP,
  record_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_workspace_datasource UNIQUE (workspace_id, source_type, source_name)
);

-- Workspace Members (Access control per workspace)
CREATE TABLE workspace_members (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member', -- owner, admin, member, viewer
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_workspace_member UNIQUE (workspace_id, email)
);

-- Create indexes for performance
-- Basic indexes
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_workspaces_project_id ON workspaces(project_id);
CREATE INDEX idx_workspaces_status ON workspaces(status);
CREATE INDEX idx_workspace_data_sources_workspace_id ON workspace_data_sources(workspace_id);
CREATE INDEX idx_workspace_data_sources_status ON workspace_data_sources(status);

-- Performance indexes for sorting and filtering (added for query optimization)
CREATE INDEX idx_projects_created_at_desc ON projects(created_at DESC);
CREATE INDEX idx_projects_updated_at_desc ON projects(updated_at DESC);
CREATE INDEX idx_workspaces_created_at_desc ON workspaces(created_at DESC);
CREATE INDEX idx_workspaces_updated_at_desc ON workspaces(updated_at DESC);
CREATE INDEX idx_workspaces_project_id_created_at ON workspaces(project_id, created_at DESC);
CREATE INDEX idx_workspace_data_sources_created_at_desc ON workspace_data_sources(created_at DESC);
CREATE INDEX idx_project_members_project_id_added_at ON project_members(project_id, added_at ASC);

-- Create views for common queries

-- Project Overview with Workspace Count
CREATE OR REPLACE VIEW project_overview AS
SELECT
  p.id,
  p.name,
  p.description,
  p.project_type,
  p.status,
  p.created_by,
  p.created_at,
  p.updated_at,
  COUNT(DISTINCT w.id)::integer as workspace_count,
  COUNT(DISTINCT pm.email)::integer as member_count,
  COUNT(DISTINCT wds.id)::integer as total_data_sources
FROM projects p
LEFT JOIN workspaces w ON p.id = w.project_id
LEFT JOIN project_members pm ON p.id = pm.project_id
LEFT JOIN workspace_data_sources wds ON w.id = wds.workspace_id
GROUP BY p.id, p.name, p.description, p.project_type, p.status, p.created_by, p.created_at, p.updated_at
ORDER BY p.created_at DESC;

-- Workspace Overview with Data Source Count
CREATE OR REPLACE VIEW workspace_overview AS
SELECT
  w.id,
  w.project_id,
  p.name as project_name,
  w.name,
  w.description,
  w.workspace_type,
  w.status,
  w.created_by,
  w.created_at,
  COUNT(DISTINCT wds.id)::integer as data_source_count,
  COUNT(DISTINCT wm.email)::integer as member_count,
  COALESCE(SUM(wds.record_count), 0)::integer as total_records
FROM workspaces w
JOIN projects p ON w.project_id = p.id
LEFT JOIN workspace_data_sources wds ON w.id = wds.workspace_id
LEFT JOIN workspace_members wm ON w.id = wm.id
GROUP BY w.id, w.project_id, p.name, w.name, w.description, w.workspace_type, w.status, w.created_by, w.created_at
ORDER BY w.created_at DESC;

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

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
