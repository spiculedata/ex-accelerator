# PostgreSQL with pg_duckdb Extension Migration Guide

This document outlines the migration from standalone DuckDB to PostgreSQL with the pg_duckdb extension, including connection pooling.

## Overview

The application now uses **PostgreSQL** as the primary database with the **pg_duckdb extension** to leverage DuckDB's analytical query engine on PostgreSQL tables. This provides:

- ✅ **Connection pooling** for better resource management
- ✅ **DuckDB analytical performance** on PostgreSQL data
- ✅ **Unified database** - all tables in one PostgreSQL instance
- ✅ **Scalability** through PostgreSQL's mature infrastructure
- ✅ **ACID compliance** with PostgreSQL transactions

## Architecture

### Previous Architecture
- Multiple DuckDB database files (`sentiment_analysis.db`, `topic_modeling.db`, etc.)
- Direct file connections without pooling
- Limited to single-process access

### New Architecture
- Single PostgreSQL database with all tables
- Connection pool (default: 20 connections)
- pg_duckdb extension for analytical queries
- Multi-process support with proper connection management

## Installation

### 1. Install PostgreSQL (if not already installed)

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Docker:**
```bash
docker run -d \
  --name postgres-analytics \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=social_analytics \
  -p 5432:5432 \
  postgres:15
```

### 2. Install pg_duckdb Extension

Follow the instructions from the [pg_duckdb repository](https://github.com/duckdb/pg_duckdb):

```bash
# Clone and build pg_duckdb
git clone https://github.com/duckdb/pg_duckdb.git
cd pg_duckdb
make
sudo make install
```

**Or use the pre-built packages:**
```bash
# On Ubuntu/Debian
sudo apt-get install postgresql-15-duckdb

# On macOS with Homebrew
brew install pg_duckdb
```

### 3. Create Database and Enable Extension

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE social_analytics;

# Connect to the database
\c social_analytics

# Enable pg_duckdb extension
CREATE EXTENSION IF NOT EXISTS pg_duckdb;

# Verify installation
SELECT * FROM pg_extension WHERE extname = 'pg_duckdb';
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and update with your settings:

```bash
cp .env.example .env
```

Edit `.env`:
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=social_analytics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword
POSTGRES_POOL_MAX=20
```

### 5. Install Node.js Dependencies

```bash
npm install
```

This installs the `pg` (node-postgres) client library with TypeScript types.

## Migration from DuckDB Files

If you have existing DuckDB databases, you need to migrate the data to PostgreSQL:

### Option 1: Using DuckDB CLI to Export

```bash
# Export from DuckDB to CSV
duckdb sentiment_analysis.db <<EOF
COPY posts TO 'posts.csv' (HEADER, DELIMITER ',');
COPY sentiment_classifications TO 'sentiment_classifications.csv' (HEADER, DELIMITER ',');
EOF

# Import to PostgreSQL
psql -U postgres -d social_analytics <<EOF
COPY posts FROM '/path/to/posts.csv' WITH (FORMAT CSV, HEADER);
COPY sentiment_classifications FROM '/path/to/sentiment_classifications.csv' WITH (FORMAT CSV, HEADER);
EOF
```

### Option 2: Using pg_duckdb to Query DuckDB Files

The pg_duckdb extension can query DuckDB files directly:

```sql
-- Attach DuckDB database
SELECT duckdb_execute('ATTACH ''/path/to/sentiment_analysis.db'' AS sentiment');

-- Query DuckDB tables and insert into PostgreSQL
INSERT INTO posts
SELECT * FROM duckdb_query('SELECT * FROM sentiment.posts');
```

### Option 3: Use the Migration Script (Recommended)

We provide a migration script in `scripts/migrate-duckdb-to-postgres.js`:

```bash
node scripts/migrate-duckdb-to-postgres.js
```

## Connection Pooling

The application uses connection pooling with the following default settings:

- **Max connections**: 20
- **Idle timeout**: 30 seconds
- **Connection timeout**: 5 seconds

### Pool Statistics

You can monitor pool statistics via the API:

```bash
curl http://localhost:5173/api/unified-analytics?type=test
```

Response includes:
```json
{
  "success": true,
  "message": "PostgreSQL with pg_duckdb extension connected",
  "poolStats": {
    "totalCount": 5,
    "idleCount": 3,
    "waitingCount": 0
  }
}
```

## Using pg_duckdb for Queries

### Standard PostgreSQL Query

```typescript
import { postgresPool } from '$lib/services/postgres';

// Regular PostgreSQL query
const users = await postgresPool.query('SELECT * FROM users WHERE active = $1', [true]);
```

### DuckDB Analytical Query

```typescript
// Analytical query using DuckDB execution engine
const analytics = await postgresPool.duckdbQuery(`
  SELECT
    platform,
    sentiment_category,
    COUNT(*) as post_count,
    AVG(confidence_score) as avg_confidence
  FROM posts_with_sentiment
  GROUP BY platform, sentiment_category
  ORDER BY post_count DESC
`);
```

### When to Use DuckDB Execution

Use `duckdbQuery()` for:
- Complex aggregations (GROUP BY, HAVING)
- Window functions
- Statistical analysis
- Time-series analysis
- Large dataset scans

Use regular `query()` for:
- Simple CRUD operations
- Transactional queries
- Single-row lookups

## API Changes

### Before (DuckDB)
```typescript
import { DuckDBInstance } from '@duckdb/node-api';

const db = await DuckDBInstance.create('sentiment_analysis.db');
const conn = await db.connect();
const result = await conn.runAndReadAll('SELECT * FROM posts');
```

### After (PostgreSQL with pg_duckdb)
```typescript
import { postgresPool } from '$lib/services/postgres';

// Analytical query with DuckDB engine
const result = await postgresPool.duckdbQuery('SELECT * FROM posts');

// Or regular PostgreSQL query
const result = await postgresPool.query('SELECT * FROM posts WHERE id = $1', [123]);
```

## Performance Considerations

### Connection Pool Tuning

Adjust pool size based on your workload:

```env
# For high-concurrency read workloads
POSTGRES_POOL_MAX=50

# For write-heavy workloads
POSTGRES_POOL_MAX=20
```

### Query Optimization

- Use `EXPLAIN ANALYZE` to understand query performance
- Create indexes for frequently queried columns
- Use DuckDB execution for analytical queries
- Use PostgreSQL for transactional queries

### Monitoring

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'social_analytics';

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Troubleshooting

### Connection Errors

**Error:** `ECONNREFUSED` or `Connection refused`
- Check PostgreSQL is running: `pg_isready`
- Verify connection settings in `.env`
- Check firewall rules

**Error:** `password authentication failed`
- Verify username and password in `.env`
- Check `pg_hba.conf` for authentication settings

### pg_duckdb Extension Errors

**Error:** `extension "pg_duckdb" does not exist`
- Reinstall pg_duckdb extension
- Verify PostgreSQL version compatibility (requires PG 11+)

**Error:** `DuckDB execution failed`
- Check if DuckDB execution is enabled: `SHOW duckdb.execution;`
- Try regular PostgreSQL query first to isolate the issue

### Pool Exhaustion

**Error:** `sorry, too many clients already`
- Increase `POSTGRES_POOL_MAX`
- Check for connection leaks (unreleased clients)
- Monitor pool statistics

## Development Workflow

### Local Development

```bash
# Start PostgreSQL
brew services start postgresql@15

# Start development server
npm run dev

# Test database connection
curl http://localhost:5173/api/unified-analytics?type=test
```

### Testing

```bash
# Run tests with PostgreSQL
npm run test

# Run E2E tests
npm run cypress:run
```

## Production Deployment

### Environment Variables

Set these in your production environment:

```env
POSTGRES_HOST=your-production-db.example.com
POSTGRES_PORT=5432
POSTGRES_DB=social_analytics
POSTGRES_USER=app_user
POSTGRES_PASSWORD=secure_password
POSTGRES_POOL_MAX=50
NODE_ENV=production
```

### SSL Configuration

For production, enable SSL:

```typescript
// Update postgres.ts connection config
const pool = new Pool({
  ...config,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-certificate.crt').toString(),
  }
});
```

## References

- [pg_duckdb Documentation](https://github.com/duckdb/pg_duckdb)
- [node-postgres Documentation](https://node-postgres.com/)
- [DuckDB SQL Reference](https://duckdb.org/docs/sql/introduction)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## Support

For issues or questions:
1. Check this migration guide
2. Review the [pg_duckdb README](https://github.com/duckdb/pg_duckdb/blob/main/README.md)
3. Open an issue in the project repository
