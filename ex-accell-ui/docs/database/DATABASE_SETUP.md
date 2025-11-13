# Dashboard Database Setup

This document explains the database structure and SQL queries that power the overview dashboard.

## Database Schema

The dashboard is powered by a DuckDB database with the following tables:

### Core Tables

#### `data_sources`
Stores information about social media platforms and their connection status.
```sql
CREATE TABLE data_sources (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    health_score INTEGER DEFAULT 100,
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `posts`
Contains all collected social media posts.
```sql
CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    data_source_id INTEGER REFERENCES data_sources(id),
    external_id VARCHAR(255),
    content TEXT,
    author VARCHAR(255),
    post_type VARCHAR(50) DEFAULT 'post',
    language VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `post_analysis`
Stores NLP analysis results for posts.
```sql
CREATE TABLE post_analysis (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    sentiment VARCHAR(20),
    sentiment_score DECIMAL(3,2),
    language VARCHAR(10),
    topics TEXT[],
    keywords TEXT[],
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `crawlers`
Tracks web crawler status and performance.
```sql
CREATE TABLE crawlers (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    data_source_id INTEGER REFERENCES data_sources(id),
    status VARCHAR(20) DEFAULT 'active',
    processing_rate INTEGER DEFAULT 0,
    last_run TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `activity_logs`
Records system activities and events.
```sql
CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY,
    activity_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'info',
    data_source_id INTEGER REFERENCES data_sources(id),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Dashboard Queries

### 1. Dashboard Statistics
```sql
SELECT 
    COUNT(*) as total_posts,
    COUNT(DISTINCT data_source_id) as total_sources,
    (SELECT COUNT(*) FROM crawlers WHERE status = 'active') as active_crawlers,
    MAX(collected_at) as last_updated,
    (SELECT COALESCE(AVG(processing_rate), 0)::INTEGER FROM crawlers WHERE status = 'active') as processing_rate,
    (SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posts) 
     FROM post_analysis WHERE processed_at IS NOT NULL) as data_quality
FROM posts;
```

### 2. Data Source Breakdown
```sql
SELECT 
    ds.name,
    COUNT(p.id) as posts,
    ROUND(COUNT(p.id) * 100.0 / (SELECT COUNT(*) FROM posts), 1) as percentage,
    ds.status,
    ds.last_sync,
    ds.health_score as health
FROM data_sources ds
LEFT JOIN posts p ON ds.id = p.data_source_id
GROUP BY ds.id, ds.name, ds.status, ds.last_sync, ds.health_score
ORDER BY posts DESC;
```

### 3. Sentiment Analysis
```sql
SELECT 
    sentiment,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM post_analysis), 1) as percentage
FROM post_analysis
WHERE sentiment IS NOT NULL
GROUP BY sentiment;
```

### 4. Language Distribution
```sql
SELECT 
    language,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posts WHERE language IS NOT NULL), 1) as percentage
FROM posts
WHERE language IS NOT NULL
GROUP BY language
ORDER BY count DESC;
```

### 5. Top Topics
```sql
WITH topic_counts AS (
    SELECT 
        unnest(topics) as topic,
        COUNT(*) as posts
    FROM post_analysis
    WHERE topics IS NOT NULL
    GROUP BY unnest(topics)
)
SELECT topic, posts, 'up' as trend
FROM topic_counts
ORDER BY posts DESC
LIMIT 10;
```

### 6. Hourly Activity
```sql
SELECT 
    DATE_TRUNC('hour', created_at)::TIME as hour,
    COUNT(*) as posts
FROM posts
WHERE created_at >= NOW() - interval '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour;
```

### 7. Recent Activity
```sql
SELECT 
    id,
    activity_type as type,
    message,
    created_at as timestamp,
    status
FROM activity_logs
ORDER BY created_at DESC
LIMIT 10;
```

## Implementation Notes

### Current Implementation
The current implementation uses a simulated database service (`dashboardDb.ts`) that returns the same data structure as the SQL queries would provide. This allows for:

1. **Consistent API**: The frontend code remains unchanged whether using simulated or real data
2. **Easy Migration**: When ready to connect to a real DuckDB instance, only the service implementation needs to change
3. **Realistic Data**: All returned data matches the expected schema and relationships

### Production Migration
To connect to a real DuckDB instance:

1. **Backend API**: Create a backend service that executes these queries against a real DuckDB database
2. **Update Service**: Modify `dashboardDb.ts` to make HTTP calls to the backend API instead of returning simulated data
3. **Data Pipeline**: Set up ETL processes to populate the database with real social media data

## File Structure
```
├── dashboard_schema.sql          # Complete database schema with sample data
├── src/lib/services/
│   └── dashboardDb.ts           # Database service (currently simulated)
├── src/routes/dashboards/
│   └── +page.svelte            # Dashboard component using the service
└── DATABASE_SETUP.md           # This documentation
```

## Benefits

1. **Structured Data**: Clear relational model for social media analytics
2. **Scalable Queries**: Optimized SQL queries for dashboard performance  
3. **Flexible Schema**: Easy to extend with new data types and analysis
4. **Real-time Ready**: Designed for live data updates and streaming
5. **Analytics-First**: Schema optimized for common dashboard queries