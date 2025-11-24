# SQL Directory

This directory contains all SQL-related files for the ex-accelerator UI project.

## Structure

- **`schemas/`** - Database schema definitions
  - `unified_social_analytics_schema.sql` - Main unified database schema
  - Individual module schemas for analytics components
  - Platform-specific schemas (Android, etc.)
  
- **`migrations/`** - Database migration scripts (for future use)
  - Schema updates and data transformations
  - Version control for database changes

## Key Schema Files

- **`unified_social_analytics_schema.sql`** - Complete unified database structure with all analytics modules
- **`dashboard_schema.sql`** - Dashboard-specific views and tables
- **`sentiment_analysis_schema.sql`** - Sentiment analysis tables and indexes
- **`topic_modeling_schema.sql`** - Topic modeling and NLP analysis structures
- **`engagement_analysis_schema.sql`** - Social media engagement metrics
- **`language_detection_schema.sql`** - Language detection and analysis tables

## Usage

These schema files are used by the DuckDB service to initialize and maintain the analytics database. The unified schema combines all analytics modules for cross-table analysis capabilities.