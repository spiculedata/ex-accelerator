# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Python ETL (Extract, Transform, Load) project for processing:
1. Social media data from the Junkipedia API
2. GDELT news data (events, mentions, and GKG tables)

The project uses a **medallion architecture** (Bronze → Silver → Gold) with PostgreSQL as the analytical database, enhanced with the pg_duckdb extension for DuckDB-style analytics.

## Architecture

### Database
- **Database**: PostgreSQL 18 with pg_duckdb extension v1.1.0
- **Connection**: Default localhost:5432, database: postgres
- **Configuration**: See `db_config.py` for connection settings

### Main Scripts

#### Social Media Pipeline
- **download.py** - Downloads data from the Junkipedia API
- **process_posts_pg.py** - Processes JSON posts into PostgreSQL medallion architecture
  - Bronze layer: `bronze.posts_raw` (raw JSON data)
  - Silver layer: `silver.accounts`, `silver.posts`, `silver.posts_text_analysis`
  - Gold layer: `gold.account_engagement_metrics`, `gold.daily_engagement_trends`, etc.

#### GDELT Pipeline
- **gdelt_downloader.py** - Downloads GDELT data files from GDELT server
- **gdelt_processor_pg.py** - Processes GDELT files into PostgreSQL
  - Tables: `gdelt_events`, `gdelt_mentions`, `gdelt_gkg`
- **gdelt_pipeline_pg.py** - Orchestrates full GDELT download and processing pipeline

#### Shared Infrastructure
- **db_config.py** - PostgreSQL connection configuration and utilities
- **setup.sh** - Environment setup script

### Virtual Environment
- **Location**: `polars/`
- **Python version**: 3.12.2
- **Virtual environment path**: `/Users/tombarber/Projects/ex-accelerator/etl/polars`
- **Activation command**: `source polars/bin/activate`

## Common Commands

### Environment Setup
```bash
# Activate the virtual environment
source polars/bin/activate

# Deactivate the virtual environment
deactivate

# Test PostgreSQL connection
python db_config.py
```

### Database Management

```bash
# Connect to PostgreSQL
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
psql postgres

# View all tables
psql postgres -c "\dt bronze.*; \dt silver.*; \dt gold.*;"
```

### Social Media Pipeline

```bash
# Download data from Junkipedia API
python download.py

# Process posts to PostgreSQL bronze layer
python process_posts_pg.py

# Create silver layer tables
python process_posts_pg.py silver

# Create gold layer aggregations
python process_posts_pg.py gold

# Migrate existing DuckDB data to PostgreSQL
python process_posts_pg.py migrate
```

### GDELT Pipeline

```bash
# Run full GDELT pipeline (download + process)
python gdelt_pipeline_pg.py

# Run test with 10 files
python gdelt_pipeline_pg.py --test

# Resume processing existing files without downloading
python gdelt_pipeline_pg.py --resume

# Migrate existing DuckDB GDELT data to PostgreSQL
python gdelt_pipeline_pg.py --migrate --duckdb-path ./duckdatabase

# Process specific number of files
python gdelt_pipeline_pg.py --max-files 100
```

### Package Management
```bash
# Install new packages (ensure virtual environment is activated)
pip install <package-name>

# List installed packages
pip list

# Install from requirements
pip install -r requirements.txt
```

## Key Technical Details

- **Database**: PostgreSQL 18 with pg_duckdb extension for DuckDB-style analytics
- **Data Processing**: Polars for efficient CSV/JSON processing with streaming support
- **Architecture**: Medallion (Bronze → Silver → Gold) for data quality and transformations
- **Batch Processing**: Uses batch inserts (1000-10000 rows) for efficient bulk loading
- **Connection Management**: Context managers ensure proper connection handling and rollback on errors

### Medallion Architecture

**Bronze Layer** (Raw Data)
- Exact copy of source data with minimal transformations
- Schema: `bronze.posts_raw`, GDELT tables directly loaded

**Silver Layer** (Cleaned & Typed)
- Type conversions, data cleaning, normalization
- Schema: `silver.accounts`, `silver.posts`, `silver.posts_text_analysis`
- Relationships established via foreign keys

**Gold Layer** (Business Metrics)
- Aggregations, KPIs, and analytics-ready datasets
- Schema: `gold.account_engagement_metrics`, `gold.daily_engagement_trends`, etc.
- Optimized for reporting and visualization

## Migration from DuckDB

Legacy DuckDB pipelines have been migrated to PostgreSQL:
- **Old files**: `process_posts.py`, `gdelt_processor.py`, `gdelt_pipeline.py` (DuckDB-based)
- **New files**: `process_posts_pg.py`, `gdelt_processor_pg.py`, `gdelt_pipeline_pg.py` (PostgreSQL-based)
- **Database**: `./duckdatabase` (339GB DuckDB file) → PostgreSQL tables
- **Migration tools**: Use `--migrate` flag on new scripts to import DuckDB data

## Documentation Requirements

**IMPORTANT**: When making changes to the project structure, scripts, or functionality, you MUST update the following documentation files to keep them current:

- **DEVELOPER_GUIDE.md**: Update architecture diagrams, usage examples, file structure, and development workflows
- **CLAUDE.md**: Update project overview, technical details, and common commands
- **setup.sh comments**: Update script descriptions and functionality explanations

Always ensure documentation reflects the current state of the codebase and includes any new features, scripts, or architectural changes.