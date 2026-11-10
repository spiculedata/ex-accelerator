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

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
