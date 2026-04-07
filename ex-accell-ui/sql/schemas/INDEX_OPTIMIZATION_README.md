# Database Index Optimization Guide

## Overview

This document explains the database indexes that have been added to optimize query performance for the Social Explorer application.

## Index Files

1. **`performance_indexes.sql`** - Standalone file with all performance indexes (can be run independently)
2. **`projects_workspaces_schema.sql`** - Includes critical indexes for projects and workspaces tables
3. **`datasets_schema.sql`** - Includes critical indexes for datasets and related tables

## Summary of Indexes Added

### Projects & Workspaces (projects_workspaces_schema.sql)

**Critical Performance Indexes:**
- `idx_projects_created_at_desc` - Fast sorting of projects by creation date
- `idx_projects_updated_at_desc` - Fast sorting of projects by update date
- `idx_workspaces_created_at_desc` - Fast sorting of workspaces by creation date
- `idx_workspaces_updated_at_desc` - Fast sorting of workspaces by update date
- `idx_workspaces_project_id_created_at` - Optimized for "get workspaces by project, sorted by date"
- `idx_workspace_data_sources_created_at_desc` - Fast sorting of data sources
- `idx_project_members_project_id_added_at` - Optimized member lookups

### Datasets (datasets_schema.sql)

**Sorting & Filtering Indexes:**
- `idx_datasets_created_at_desc` - Fast sorting by creation date
- `idx_datasets_status_created_at` - Combined status filter + date sort
- `idx_datasets_type_platform_status` - Multi-column filtering optimization
- `idx_datasets_visibility_status` - Visibility + status filtering

**Text Search Indexes (PostgreSQL-specific):**
- `idx_datasets_name_trgm` - Fast fuzzy text search on dataset names
- `idx_datasets_description_trgm` - Fast fuzzy text search on descriptions
- `idx_datasets_tags_gin` - Fast array searches on tags

**Permission Optimization:**
- `idx_dataset_permissions_dataset_user` - Fast user permission lookups
- `idx_dataset_permissions_user_expires` - Optimized expiration checks
- `idx_dataset_permissions_expires_at` - Partial index for active permissions
- `idx_dataset_permissions_granted_at_desc` - Fast sorting by grant date

**Workspace-Dataset Links:**
- `idx_workspace_datasets_workspace_status` - Status filtering per workspace
- `idx_workspace_datasets_dataset_status` - Status filtering per dataset
- `idx_workspace_datasets_added_at_desc` - Fast sorting by add date

## Query Patterns Optimized

### 1. Get Workspaces by Project (MOST COMMON)
```sql
SELECT * FROM workspace_overview
WHERE project_id = $1
ORDER BY created_at DESC;
```
**Optimized by:** `idx_workspaces_project_id_created_at`

### 2. Get Datasets with Filters
```sql
SELECT * FROM datasets
WHERE dataset_type = 'social_media'
  AND source_platform = 'twitter'
  AND status = 'available'
ORDER BY created_at DESC;
```
**Optimized by:** `idx_datasets_type_platform_status` + `idx_datasets_created_at_desc`

### 3. Text Search on Datasets
```sql
SELECT * FROM datasets
WHERE name ILIKE '%twitter%'
   OR description ILIKE '%sentiment%';
```
**Optimized by:** `idx_datasets_name_trgm` + `idx_datasets_description_trgm`

### 4. Permission Checks
```sql
SELECT * FROM dataset_permissions
WHERE dataset_id = $1
  AND user_email = $2
  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
```
**Optimized by:** `idx_dataset_permissions_dataset_user` + `idx_dataset_permissions_expires_at`

### 5. Workspace Datasets
```sql
SELECT * FROM workspace_datasets
WHERE workspace_id = $1
  AND status = 'active'
ORDER BY added_at DESC;
```
**Optimized by:** `idx_workspace_datasets_workspace_status` + `idx_workspace_datasets_added_at_desc`

## PostgreSQL Extensions Required

The following PostgreSQL extensions must be enabled:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For trigram text search
```

This extension is automatically created in the schema files.

## Performance Impact

### Expected Query Performance Improvements

| Query Type | Before Index | After Index | Improvement |
|------------|--------------|-------------|-------------|
| Workspace by Project | Full table scan | Index scan | 50-100x faster |
| Dataset text search | Sequential scan | GIN index scan | 20-50x faster |
| Permission check | Multiple joins | Index-only scan | 10-30x faster |
| Sorted dataset list | Sort + scan | Index scan | 5-20x faster |

### Disk Space Impact

Estimated additional disk space per index:
- Simple B-tree indexes: 10-50 MB each
- GIN indexes (text search): 50-200 MB each
- Composite indexes: 20-100 MB each

**Total estimated space:** ~500MB - 1GB for all indexes

## Applying Indexes

### For New Databases
Simply run the schema files in order:
```bash
psql -U your_user -d your_database -f projects_workspaces_schema.sql
psql -U your_user -d your_database -f datasets_schema.sql
```

### For Existing Databases (Production)
Use the standalone performance_indexes.sql file with CONCURRENTLY option:
```bash
psql -U your_user -d your_database -f performance_indexes.sql
```

The `CONCURRENTLY` option allows index creation without blocking writes, but:
- Requires more disk space during creation
- Takes longer to build
- Cannot be run inside a transaction

## Monitoring Index Usage

### Check Index Usage Statistics
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Find Unused Indexes
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE 'pg_%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Check Index Sizes
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
```

## Maintenance

### Rebuild Bloated Indexes
Over time, indexes can become bloated. Rebuild them periodically:
```sql
REINDEX INDEX CONCURRENTLY index_name;
```

### Update Statistics
After significant data changes, update table statistics:
```sql
ANALYZE projects;
ANALYZE workspaces;
ANALYZE datasets;
ANALYZE dataset_permissions;
ANALYZE workspace_datasets;
```

### Vacuum Tables
Regular vacuuming prevents bloat:
```sql
VACUUM ANALYZE projects;
VACUUM ANALYZE workspaces;
VACUUM ANALYZE datasets;
```

## Best Practices

1. **Monitor Index Usage** - Regularly check which indexes are being used
2. **Remove Unused Indexes** - Drop indexes with idx_scan = 0 after sufficient observation time
3. **Update Statistics** - Run ANALYZE after bulk data imports
4. **Rebuild Periodically** - REINDEX bloated indexes in production
5. **Test Query Plans** - Use EXPLAIN ANALYZE to verify index usage

## Troubleshooting

### Index Not Being Used
If queries aren't using indexes:
1. Update statistics: `ANALYZE table_name;`
2. Check query plan: `EXPLAIN ANALYZE your_query;`
3. Verify index exists: `\d table_name` in psql
4. Check PostgreSQL logs for missing statistics

### Slow Index Creation
For large tables:
1. Use `CREATE INDEX CONCURRENTLY` in production
2. Increase `maintenance_work_mem` temporarily
3. Create indexes during off-peak hours
4. Consider creating indexes in batches

### High Disk Usage
If indexes consume too much space:
1. Review unused indexes and drop them
2. Use partial indexes where possible
3. Consider index bloat and rebuild
4. Monitor with `pg_stat_user_indexes`

## References

- [PostgreSQL Index Documentation](https://www.postgresql.org/docs/current/indexes.html)
- [pg_trgm Extension](https://www.postgresql.org/docs/current/pgtrgm.html)
- [GIN Indexes](https://www.postgresql.org/docs/current/gin.html)
- [Index Maintenance](https://www.postgresql.org/docs/current/routine-reindex.html)
