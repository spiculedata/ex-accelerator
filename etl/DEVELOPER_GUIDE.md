# Junkipedia ETL Developer Guide

## Overview
This ETL pipeline processes social media data from the Junkipedia API using a medallion architecture (Bronze → Silver → Gold) with DuckDB as the analytical database.

## Setup Script
The `setup.sh` script prepares your development environment by:
- Checking for Python 3.8+ and creating a virtual environment
- Detecting DuckDB CLI availability and offering installation if needed
- Installing Python dependencies (polars, duckdb, requests, pyarrow)
- Staging existing data for development use
- Validating the database setup

### Quick Start
```bash
./setup.sh                          # Full environment setup
source polars/bin/activate          # Activate Python environment
python download.py                  # Download fresh data (if needed)
duckdb ./duckdatabase               # Access database
```

## Architecture

### Data Layers
- **Bronze**: Raw JSON data flattened into structured tables
- **Silver**: Cleaned, typed data with normalized schemas
- **Gold**: Business-ready aggregations and insights

### Key Tables
- `bronze.posts_raw` - Raw flattened post data
- `silver.accounts` - Account profiles and metrics  
- `silver.posts` - Cleaned post content and engagement
- `silver.posts_text_analysis` - Text analysis enrichments
- `gold.account_engagement_metrics` - Account performance KPIs
- `gold.daily_engagement_trends` - Time series data
- `gold.content_performance_insights` - Content analysis
- `gold.account_rankings` - Comparative rankings
- `gold.posting_patterns` - Optimal timing analysis

## Usage

### Data Download
```bash
python download.py                    # Download channels and all posts
python download.py channels          # Download channels only
python download.py posts             # Download posts only
```

### ETL Pipeline
```bash
python process_posts.py              # Bronze layer (JSON → DuckDB)
python process_posts.py silver       # Silver layer (clean & normalize)
python process_posts.py text         # Text analysis enrichments
python process_posts.py gold         # Gold layer aggregations
python process_posts.py query        # Sample bronze queries
```

### Database Access
```bash
duckdb ./duckdatabase                 # Launch DuckDB CLI
```

### Development Workflow
1. Run `./setup.sh` to prepare environment
2. Activate virtual environment: `source polars/bin/activate`
3. Download data: `python download.py`
4. Process data: `python process_posts.py`
5. Query database: `duckdb ./duckdatabase`

## Sample Queries
```sql
-- Top performing accounts
SELECT account_name, avg_likes_per_post, performance_category 
FROM gold.account_rankings 
ORDER BY likes_rank LIMIT 10;

-- Content performance by length
SELECT content_length_category, COUNT(*) as posts, AVG(likes_count) as avg_likes
FROM silver.posts_text_analysis 
GROUP BY content_length_category 
ORDER BY avg_likes DESC;

-- Optimal posting times
SELECT day_name, time_period, avg_likes, posts_count
FROM gold.posting_patterns 
ORDER BY performance_rank LIMIT 5;

-- Topic analysis
SELECT 
  SUM(contains_economic_terms) as economic_posts,
  SUM(contains_health_terms) as health_posts,
  SUM(contains_personal_references) as personal_posts
FROM silver.posts_text_analysis;
```

## Text Analysis Features
- **Readability**: Flesch score, word/sentence complexity
- **Engagement signals**: Hashtags, mentions, punctuation
- **Sentiment**: Positive/negative word detection
- **Topics**: Political categories (economy, health, security, etc.)
- **Style**: Content length, capitalization patterns

## Development Environment

### Dependencies
- Python 3.8+
- DuckDB CLI (automatically installed by setup script)
- Virtual environment in `polars/`
- Python packages: polars, duckdb, requests, pyarrow

### File Structure
```
etl/
├── setup.sh                # Environment setup script
├── download.py              # API data download
├── process_posts.py         # ETL pipeline
├── duckdatabase            # DuckDB database file
├── polars/                 # Python virtual environment
├── data/                   # JSON data files
├── CLAUDE.md              # Project instructions
└── DEVELOPER_GUIDE.md     # This guide
```

### Error Handling
- **Database locks**: Close DuckDB CLI before running scripts
- **Missing data**: Run `python download.py` first
- **Schema conflicts**: Data is normalized with proper casting
- **Permission issues**: Ensure write access to project directory

## Troubleshooting

### Common Issues
1. **"DuckDB CLI not found"**: Setup script will offer to install it automatically
2. **"Virtual environment not found"**: Setup script creates it automatically
3. **"No data files found"**: Run `python download.py` to fetch data
4. **Database connection errors**: Ensure no other processes are using the database

### Performance Tips
- Use `LIMIT` clauses when exploring large datasets
- Create indexes on frequently queried columns
- Use `EXPLAIN` to understand query execution plans
- Monitor memory usage with large transformations

## Research Applications
- Political communication analysis
- Content optimization strategies  
- Engagement pattern research
- Social media benchmarking
- Text analysis and sentiment tracking