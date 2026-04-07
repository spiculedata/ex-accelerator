-- =====================================================
-- Performance Indexes for Social Explorer Database
-- =====================================================
-- This file contains all recommended indexes for optimal query performance
-- Uses CREATE INDEX CONCURRENTLY to avoid blocking in production

-- =====================================================
-- CRITICAL INDEXES (Add Immediately)
-- =====================================================

-- Projects: Improve sorting performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_created_at_desc
  ON projects(created_at DESC);

-- Workspaces: Improve sorting and filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_created_at_desc
  ON workspaces(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_project_id_created_at
  ON workspaces(project_id, created_at DESC);

-- Datasets: Critical for sorting and filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_created_at_desc
  ON datasets(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_status_created_at
  ON datasets(status, created_at DESC);

-- Dataset permissions: Improve permission checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dataset_permissions_expires_at
  ON dataset_permissions(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dataset_permissions_dataset_user
  ON dataset_permissions(dataset_id, user_email);

-- Workspace datasets: Critical for workspace queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_datasets_workspace_status
  ON workspace_datasets(workspace_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_datasets_added_at_desc
  ON workspace_datasets(added_at DESC);

-- Project members: Improve member lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_members_project_id_added_at
  ON project_members(project_id, added_at ASC);

-- Workspace data sources: Improve sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_data_sources_created_at_desc
  ON workspace_data_sources(created_at DESC);

-- =====================================================
-- HIGH PRIORITY INDEXES
-- =====================================================

-- Enable pg_trgm extension for text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Datasets: Text search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_name_trgm
  ON datasets USING gin(name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_description_trgm
  ON datasets USING gin(description gin_trgm_ops);

-- Datasets: Array tag searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_tags_gin
  ON datasets USING gin(tags);

-- Datasets: Compound filtering indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_type_platform_status
  ON datasets(dataset_type, source_platform, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_visibility_status
  ON datasets(visibility, status);

-- Dataset permissions: Compound permission checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dataset_permissions_user_expires
  ON dataset_permissions(user_email, expires_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dataset_permissions_role_expires
  ON dataset_permissions(role_name, expires_at);

-- =====================================================
-- MEDIUM PRIORITY INDEXES
-- =====================================================

-- Datasets: Date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_date_range_start_desc
  ON datasets(date_range_start DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_date_range_end_desc
  ON datasets(date_range_end DESC NULLS LAST);

-- Dataset permissions: Granted timestamp sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dataset_permissions_granted_at_desc
  ON dataset_permissions(granted_at DESC);

-- Workspace datasets: Composite for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_datasets_dataset_status
  ON workspace_datasets(dataset_id, status);

-- Projects and Workspaces: Updated timestamp sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_updated_at_desc
  ON projects(updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_updated_at_desc
  ON workspaces(updated_at DESC);

-- =====================================================
-- OPTIONAL PERFORMANCE TUNING INDEXES
-- =====================================================

-- Covering indexes for view performance (include commonly selected columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_overview_covering
  ON datasets(id, created_at DESC)
  INCLUDE (name, dataset_type, source_platform, status, visibility, record_count);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_overview_covering
  ON workspaces(project_id, created_at DESC)
  INCLUDE (id, name, workspace_type, status);

-- Partial indexes for common filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_active_only
  ON datasets(created_at DESC)
  WHERE status = 'available';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_datasets_active_only
  ON workspace_datasets(workspace_id, added_at DESC)
  WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dataset_permissions_active_only
  ON dataset_permissions(dataset_id, user_email)
  WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

-- =====================================================
-- ANALYZE TABLES
-- =====================================================
-- Update statistics for query planner optimization

ANALYZE projects;
ANALYZE workspaces;
ANALYZE project_members;
ANALYZE workspace_data_sources;
ANALYZE datasets;
ANALYZE dataset_permissions;
ANALYZE workspace_datasets;
ANALYZE dataset_tags;

-- =====================================================
-- INDEX MAINTENANCE NOTES
-- =====================================================
--
-- 1. CONCURRENTLY option allows index creation without blocking writes
--    but requires more disk space and takes longer to build
--
-- 2. Monitor index usage with:
--    SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
--    FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
--
-- 3. Find unused indexes:
--    SELECT schemaname, tablename, indexname
--    FROM pg_stat_user_indexes
--    WHERE idx_scan = 0 AND indexname NOT LIKE 'pg_%';
--
-- 4. Check index size:
--    SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid))
--    FROM pg_stat_user_indexes ORDER BY pg_relation_size(indexrelid) DESC;
--
-- 5. Rebuild bloated indexes:
--    REINDEX INDEX CONCURRENTLY index_name;
--
