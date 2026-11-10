# Data model

All analytics live in one PostgreSQL database. Posts from every platform land in a shared `posts`
table, and each analytics module adds its own tables keyed to it. The core definitions are in
`ex-accell-ui/db/migrations/`.

## Schema management

The web app creates and updates the core schema itself. On the first sign-in it applies the SQL files
in `ex-accell-ui/db/migrations/` in order and records each in a `schema_migrations` table, so every
file runs once. A database that already contains the core tables (an install from before migrations
existed) is recorded as up to date without running anything, so existing data is never touched.

To change the schema, add the next numbered file (for example `0004_add_thing.sql`). Keep migrations
to non-destructive DDL (no `DROP TABLE`, `DROP COLUMN`, `DELETE` or `INSERT`); sample data belongs in
`ex-accell-ui/db/seed/`. Each migration runs in a transaction, so statements that cannot (such as
`CREATE INDEX CONCURRENTLY`) do not belong in one.

The database role the app connects with needs permission to create tables and the `pg_trgm`
extension (`CREATE` on the database). The default compose setup uses the `postgres` superuser, so
this only matters if you provision a restricted role.

Tables for optional pipelines (GDELT, radio, image processing) are created by their ETL jobs, not by
migrations. Until a table exists, the related dashboards show an empty state.

## Core tables

| Table | Holds |
|-------|-------|
| `data_sources` | Platforms or feeds posts come from |
| `crawlers` | Collection processes that feed a source |
| `posts` | One row per collected post; the foundation every module links to |
| `activity_logs` | Operational events |

## Analytics modules

| Module | Tables |
|--------|--------|
| Sentiment | `sentiment_classifications`, `emotion_analysis`, `sentiment_temporal_trends`, `sentiment_keywords` |
| Topics | `topics`, `topic_keywords`, `document_topics`, `topic_relationships`, `topic_trends` |
| Language | `languages`, `language_detection`, `language_mixing` |
| Engagement | `content_types`, `post_engagement`, `hashtag_engagement` |
| Android | `android_devices`, `android_app_usage`, `android_system_metrics` |

The Android pages (`/android-analytics` and `/android-research`) read data from the Princeton SMART /
Screenlake research kit. Loading that data is not available in this release (the Data Capture tab for
it is a preview and the Android API endpoints are not implemented), so the pages show an empty state.
They never show sample or generated figures.

The workflow builder stores its definitions and run history in `published_workflows` and
`workflow_executions` (deleting a workflow also deletes its runs). Separate schema files cover
projects and workspaces, datasets, dashboards and GDELT events.

## Cross-module views

Views join the modules so one query can compare, for example, sentiment across platforms:

- `unified_post_analysis`: every post with sentiment, topic, language and engagement data
- `cross_platform_sentiment`
- `topic_platform_performance`
- `language_sentiment_correlation`
- `content_performance_analysis`
- `analytics_dashboard_summary`

## How the app queries it

Server code uses a pooled PostgreSQL connection (`src/lib/services/postgres.ts`) and can route
analytical queries through DuckDB's engine via `pg_duckdb`. Browser code never talks to the database;
it calls `/api/unified-analytics?type=...`, which returns empty data for a missing table and a
generic error for real failures. See the [API reference](/reference/api).
