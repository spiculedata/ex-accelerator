-- =====================================================
-- Dataset Management Schema
-- =====================================================
-- This schema manages datasets ingested via the ETL pipeline
-- and their associations with workspaces
-- =====================================================

-- Dataset Catalog Table
-- Stores metadata about ingested datasets from ETL pipeline
CREATE TABLE IF NOT EXISTS datasets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,

    -- Dataset Type and Source
    dataset_type VARCHAR(50) NOT NULL, -- social_media, gdelt_events, telegram, youtube, etc.
    source_platform VARCHAR(100), -- twitter, facebook, telegram, youtube, gdelt

    -- Database Location
    source_database VARCHAR(100) NOT NULL, -- etl_postgres, unified_duckdb
    schema_name VARCHAR(100), -- bronze, silver, gold
    table_name VARCHAR(255) NOT NULL, -- posts, gdelt_events, accounts, etc.

    -- Dataset Statistics
    record_count BIGINT DEFAULT 0,
    date_range_start TIMESTAMP,
    date_range_end TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Crawl/Ingestion Metadata
    crawl_id VARCHAR(255), -- Reference to crawler job that created this dataset
    ingestion_method VARCHAR(50), -- crawler, api, upload, manual

    -- Flexible Metadata (JSON)
    metadata JSONB DEFAULT '{}', -- Additional metadata (columns, filters, tags, etc.)

    -- Status and Lifecycle
    status VARCHAR(50) DEFAULT 'available', -- available, processing, archived, error
    visibility VARCHAR(50) DEFAULT 'private', -- private, public, restricted

    -- Ownership and Timestamps
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    CONSTRAINT datasets_name_unique UNIQUE (name)
);

-- Dataset Permissions Table
-- Controls who can access/use which datasets
CREATE TABLE IF NOT EXISTS dataset_permissions (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,

    -- Permission Target (user or role)
    permission_type VARCHAR(50) NOT NULL, -- user, role, public
    user_email VARCHAR(255), -- For user-level permissions
    role_name VARCHAR(100), -- For role-based permissions (admin, analyst, viewer)

    -- Permission Level
    access_level VARCHAR(50) DEFAULT 'read', -- read, write, admin

    -- Timestamps
    granted_by VARCHAR(255),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Optional expiration

    -- Constraints
    CONSTRAINT dataset_permissions_target_check
        CHECK (
            (permission_type = 'user' AND user_email IS NOT NULL) OR
            (permission_type = 'role' AND role_name IS NOT NULL) OR
            (permission_type = 'public')
        ),
    CONSTRAINT unique_dataset_permission
        UNIQUE (dataset_id, permission_type, user_email, role_name)
);

-- Workspace Datasets Junction Table
-- Links datasets to workspaces
CREATE TABLE IF NOT EXISTS workspace_datasets (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,

    -- Association Metadata
    added_by VARCHAR(255),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Workspace-specific Settings for Dataset
    settings JSONB DEFAULT '{}', -- Filters, display preferences, etc.

    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, archived

    -- Constraints
    CONSTRAINT unique_workspace_dataset UNIQUE (workspace_id, dataset_id)
);

-- Dataset Tags Table (Optional - for categorization)
CREATE TABLE IF NOT EXISTS dataset_tags (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    tag_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_dataset_tag UNIQUE (dataset_id, tag_name)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_datasets_type ON datasets(dataset_type);
CREATE INDEX IF NOT EXISTS idx_datasets_platform ON datasets(source_platform);
CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
CREATE INDEX IF NOT EXISTS idx_datasets_visibility ON datasets(visibility);
CREATE INDEX IF NOT EXISTS idx_datasets_created_by ON datasets(created_by);
CREATE INDEX IF NOT EXISTS idx_datasets_date_range ON datasets(date_range_start, date_range_end);

CREATE INDEX IF NOT EXISTS idx_dataset_permissions_dataset_id ON dataset_permissions(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_permissions_user_email ON dataset_permissions(user_email);
CREATE INDEX IF NOT EXISTS idx_dataset_permissions_role_name ON dataset_permissions(role_name);

CREATE INDEX IF NOT EXISTS idx_workspace_datasets_workspace_id ON workspace_datasets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_datasets_dataset_id ON workspace_datasets(dataset_id);

CREATE INDEX IF NOT EXISTS idx_dataset_tags_dataset_id ON dataset_tags(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_tags_tag_name ON dataset_tags(tag_name);

-- Performance indexes for sorting, filtering, and text search (added for query optimization)
CREATE INDEX IF NOT EXISTS idx_datasets_created_at_desc ON datasets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_datasets_status_created_at ON datasets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_datasets_type_platform_status ON datasets(dataset_type, source_platform, status);
CREATE INDEX IF NOT EXISTS idx_datasets_visibility_status ON datasets(visibility, status);

-- Enable pg_trgm extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_datasets_name_trgm ON datasets USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_datasets_description_trgm ON datasets USING gin(description gin_trgm_ops);

-- Array search optimization for tags
CREATE INDEX IF NOT EXISTS idx_datasets_tags_gin ON datasets USING gin(tags);

-- Dataset permissions optimization
CREATE INDEX IF NOT EXISTS idx_dataset_permissions_dataset_user ON dataset_permissions(dataset_id, user_email);
CREATE INDEX IF NOT EXISTS idx_dataset_permissions_user_expires ON dataset_permissions(user_email, expires_at);
CREATE INDEX IF NOT EXISTS idx_dataset_permissions_expires_at ON dataset_permissions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dataset_permissions_granted_at_desc ON dataset_permissions(granted_at DESC);

-- Workspace datasets optimization
CREATE INDEX IF NOT EXISTS idx_workspace_datasets_workspace_status ON workspace_datasets(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_datasets_dataset_status ON workspace_datasets(dataset_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_datasets_added_at_desc ON workspace_datasets(added_at DESC);

-- =====================================================
-- Views for Common Queries
-- =====================================================

-- Dataset Overview with Permission Count
CREATE OR REPLACE VIEW dataset_overview AS
SELECT
    d.id,
    d.name,
    d.description,
    d.dataset_type,
    d.source_platform,
    d.source_database,
    d.schema_name,
    d.table_name,
    d.record_count,
    d.date_range_start,
    d.date_range_end,
    d.last_updated,
    d.crawl_id,
    d.ingestion_method,
    d.status,
    d.visibility,
    d.created_by,
    d.created_at,
    d.metadata,
    COUNT(DISTINCT dp.id) as permission_count,
    COUNT(DISTINCT wd.workspace_id) as workspace_count,
    ARRAY_AGG(DISTINCT dt.tag_name) FILTER (WHERE dt.tag_name IS NOT NULL) as tags
FROM datasets d
LEFT JOIN dataset_permissions dp ON d.id = dp.dataset_id
LEFT JOIN workspace_datasets wd ON d.id = wd.dataset_id
LEFT JOIN dataset_tags dt ON d.id = dt.dataset_id
GROUP BY
    d.id, d.name, d.description, d.dataset_type, d.source_platform,
    d.source_database, d.schema_name, d.table_name, d.record_count,
    d.date_range_start, d.date_range_end, d.last_updated, d.crawl_id,
    d.ingestion_method, d.status, d.visibility, d.created_by, d.created_at, d.metadata;

-- Workspace Datasets View (Datasets linked to a workspace with metadata)
CREATE OR REPLACE VIEW workspace_dataset_overview AS
SELECT
    wd.workspace_id,
    wd.dataset_id,
    d.name as dataset_name,
    d.description,
    d.dataset_type,
    d.source_platform,
    d.record_count,
    d.date_range_start,
    d.date_range_end,
    wd.added_by,
    wd.added_at,
    wd.settings,
    wd.status,
    d.metadata
FROM workspace_datasets wd
JOIN datasets d ON wd.dataset_id = d.id
WHERE wd.status = 'active';

-- User Dataset Access View (Datasets accessible by a user)
CREATE OR REPLACE VIEW user_dataset_access AS
SELECT
    d.id as dataset_id,
    d.name,
    d.dataset_type,
    d.source_platform,
    d.visibility,
    dp.user_email,
    dp.access_level,
    dp.expires_at,
    CASE
        WHEN d.visibility = 'public' THEN true
        WHEN dp.user_email IS NOT NULL AND (dp.expires_at IS NULL OR dp.expires_at > CURRENT_TIMESTAMP) THEN true
        ELSE false
    END as has_access
FROM datasets d
LEFT JOIN dataset_permissions dp ON d.id = dp.dataset_id
WHERE d.status = 'available';

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

-- =====================================================
-- Trigger to Update updated_at Timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON datasets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE datasets IS 'Catalog of all ingested datasets from ETL pipeline with metadata and location info';
COMMENT ON TABLE dataset_permissions IS 'Access control for datasets - defines who can use which datasets';
COMMENT ON TABLE workspace_datasets IS 'Junction table linking workspaces to their associated datasets';
COMMENT ON TABLE dataset_tags IS 'Tags for categorizing and organizing datasets';

COMMENT ON COLUMN datasets.source_database IS 'Database where the data resides (etl_postgres, unified_duckdb, etc.)';
COMMENT ON COLUMN datasets.schema_name IS 'Schema name in the source database (bronze, silver, gold)';
COMMENT ON COLUMN datasets.table_name IS 'Table name in the source database';
COMMENT ON COLUMN datasets.crawl_id IS 'Reference to the crawler job that generated this dataset';
COMMENT ON COLUMN datasets.metadata IS 'Flexible JSONB field for additional metadata (column names, filters, custom properties)';
COMMENT ON COLUMN datasets.visibility IS 'Controls default visibility: private (requires permissions), public (all users), restricted (specific roles)';

COMMENT ON COLUMN dataset_permissions.permission_type IS 'Type of permission: user (specific user), role (role-based), public (all users)';
COMMENT ON COLUMN dataset_permissions.access_level IS 'Level of access: read (view/use), write (modify), admin (full control)';
COMMENT ON COLUMN dataset_permissions.expires_at IS 'Optional expiration date for time-limited access';

COMMENT ON COLUMN workspace_datasets.settings IS 'Workspace-specific settings for this dataset (filters, display preferences, etc.)';
