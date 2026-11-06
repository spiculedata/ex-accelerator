# Data model

All analytics live in one PostgreSQL database. Posts from every platform land in a shared `posts`
table, and each analytics module adds its own tables keyed to it. Schema definitions are in
`ex-accell-ui/sql/schemas/`.

::: warning Work in progress
A fresh install does not yet create these tables automatically; see
[issue #83](https://github.com/spiculedata/ex-accelerator/issues/83). Until then, apply the schema
files you need with `psql`. Until a table exists, the related dashboards show an empty state.
:::

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

Separate schema files cover projects and workspaces, datasets, the workflow builder, dashboards and
GDELT events.

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
