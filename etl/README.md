# ETL Pipeline - PostgreSQL with pg_duckdb

A comprehensive ETL pipeline for processing social media and GDELT news data using PostgreSQL with the pg_duckdb extension.

## 🚀 Quick Start

```bash
# Activate virtual environment
source polars/bin/activate

# Test PostgreSQL connection
python db_config.py

# Download and process social media data
python download.py
python process_posts_pg.py
python process_posts_pg.py silver
python process_posts_pg.py gold

# Or process GDELT data
python gdelt_pipeline_pg.py --test
```

## 📊 What This Provides

### Data Pipeline
- **Bronze Layer**: Raw JSON data flattened (412 columns)
- **Silver Layer**: Cleaned, typed tables with text analysis
- **Gold Layer**: Business-ready insights and aggregations

### Analytics Capabilities
- **Account Performance**: Engagement metrics, rankings, benchmarks
- **Content Analysis**: Text sentiment, readability, topic modeling
- **Temporal Patterns**: Optimal posting times, trend analysis
- **Research Tools**: Political content analysis, engagement prediction

### Sample Insights
- Top performers: Politicians like Rishi Sunak (20K+ avg likes)
- Best timing: Sunday afternoons show highest engagement
- Content optimization: Tweet-length posts perform best
- Topic analysis: Personal content outperforms policy posts

## 🛠 Architecture

### Tech Stack
- **PostgreSQL 18** with pg_duckdb extension for analytics
- **Python 3.12.2** with Polars for data processing
- **psycopg2** for PostgreSQL connectivity
- **Medallion Architecture** (Bronze → Silver → Gold)
- **Text Analysis** with custom NLP features

### Data Flow
```
API → JSON Files → Bronze (Raw) → Silver (Clean) → Gold (Insights)
```

### Key Tables
- `silver.accounts` - Social media account profiles
- `silver.posts` - Cleaned post content and engagement
- `silver.posts_text_analysis` - Text analysis enrichments
- `gold.account_rankings` - Performance leaderboards
- `gold.posting_patterns` - Optimal timing analysis

## 📖 Usage

### Data Download
```bash
python download.py              # Full download (channels + posts)
python download.py channels     # Channels only
python download.py posts        # Posts only
```

### ETL Pipeline
```bash
python process_posts_pg.py          # Bronze layer
python process_posts_pg.py silver   # Silver layer + accounts
python process_posts_pg.py gold     # Gold layer aggregations
python process_posts_pg.py migrate  # Migrate from DuckDB

# GDELT pipeline
python gdelt_pipeline_pg.py --test              # Test with 10 files
python gdelt_pipeline_pg.py --max-files 100    # Process 100 files
python gdelt_pipeline_pg.py --migrate           # Migrate from DuckDB
```

### Database Access
```bash
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
psql postgres              # Interactive SQL

# Sample queries
SELECT * FROM gold.account_rankings ORDER BY likes_rank LIMIT 10;
SELECT * FROM gold.posting_patterns ORDER BY performance_rank LIMIT 5;
SELECT COUNT(*) FROM gdelt_events;
```

## 🔬 Research Applications

### Political Communication
- Sentiment analysis of political messaging
- Topic modeling across policy areas
- Engagement pattern research
- Content optimization strategies

### Text Analysis Features
- **Readability**: Flesch scores, complexity metrics
- **Engagement Signals**: Hashtags, mentions, punctuation
- **Sentiment**: Positive/negative language detection
- **Topics**: Economic, health, security, personal content
- **Style**: Length categorization, capitalization patterns

### Performance Analytics
- Account benchmarking and rankings
- Content performance prediction
- Optimal timing recommendations
- Engagement rate calculations

## 🔧 Development

### Environment Setup
```bash
# Virtual environment
python3 -m venv polars
source polars/bin/activate

# Dependencies
pip install polars duckdb requests pyarrow
```

### File Structure
```
etl/
├── setup.sh                   # Automated setup script
├── download.py                 # API data fetcher
├── process_posts.py           # ETL pipeline
├── duckdatabase              # DuckDB database
├── polars/                   # Python virtual environment
├── data/                     # Raw JSON files
├── DEVELOPER_GUIDE.md        # Detailed documentation
└── CLAUDE.md                 # Project context
```

### Troubleshooting
- **Database locked**: Close DuckDB CLI before running scripts
- **Missing data**: Run `python download.py` first
- **Schema errors**: Pipeline handles type casting automatically

## 📚 Documentation

- **DEVELOPER_GUIDE.md** - Comprehensive technical guide
- **CLAUDE.md** - Project context and instructions
- **setup.sh** - Automated environment setup

## 🎯 Key Features

✅ **Automated Setup** - One-command environment configuration  
✅ **Medallion Architecture** - Industry-standard data organization  
✅ **Text Analysis** - Advanced NLP for social media content  
✅ **Performance Analytics** - Account rankings and benchmarks  
✅ **Temporal Analysis** - Optimal timing and trend insights  
✅ **Research Ready** - Built for political communication research  

## 🤝 Contributing

1. Follow the medallion architecture pattern
2. Add new enrichments to silver layer
3. Create business metrics in gold layer
4. Update documentation for new features

---

**Built with ❤️ for social media research and political communication analysis**