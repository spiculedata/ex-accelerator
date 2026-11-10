# SQL Directory

> **The core schema now lives in `../db/migrations/`** and is applied automatically on first
> sign-in (see the data model docs). The files here are reference material from earlier
> DuckDB-based work; several are DuckDB-dialect and do not apply to PostgreSQL unchanged.

This directory contains all SQL-related files for the Social Explorer UI project.

## Contents

Reference schema definitions from earlier DuckDB-based work, one file per analytics module
(`unified_social_analytics_schema.sql`, `sentiment_analysis_schema.sql`, and so on). Several use
DuckDB-only syntax and some overlap each other, so they are not applied automatically. Treat them as
design notes; add real schema changes as numbered files in `../db/migrations/`.
