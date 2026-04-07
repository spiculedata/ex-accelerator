"""
Dataset Registry Module for ETL Pipeline

This module provides utilities to register datasets in the UI database
after they've been ingested by the ETL pipeline. This enables workspaces
to discover and link to ingested datasets.

Usage:
    from dataset_registry import register_dataset, update_dataset_stats

    # After successful data ingestion
    register_dataset(
        name="Twitter Q1 2025",
        description="Twitter posts from Q1 2025",
        dataset_type="social_media",
        source_platform="twitter",
        table_name="silver.posts",
        crawl_id="twitter-q1-2025",
        record_count=15420,
        date_range_start="2025-01-01",
        date_range_end="2025-03-31"
    )
"""

import os
import psycopg2
import psycopg2.extras
from typing import Optional, Dict, Any
from datetime import datetime
from contextlib import contextmanager
from db_config import DB_CONFIG, get_connection_context


@contextmanager
def get_ui_db_connection():
    """
    Get connection to the UI database (same PostgreSQL instance)
    Uses the same connection config as ETL database
    """
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def register_dataset(
    name: str,
    description: str,
    dataset_type: str,
    source_platform: Optional[str],
    table_name: str,
    crawl_id: Optional[str] = None,
    record_count: int = 0,
    date_range_start: Optional[str] = None,
    date_range_end: Optional[str] = None,
    schema_name: str = "silver",
    source_database: str = "etl_postgres",
    ingestion_method: str = "crawler",
    visibility: str = "private",
    created_by: str = "etl_system",
    metadata: Optional[Dict[str, Any]] = None,
    tags: Optional[list] = None
) -> int:
    """
    Register a dataset in the UI database after ETL ingestion.

    Args:
        name: Unique dataset name (e.g., "Twitter Q1 2025")
        description: Human-readable description
        dataset_type: Type (social_media, gdelt_events, etc.)
        source_platform: Platform name (twitter, telegram, facebook, etc.)
        table_name: Database table name (e.g., "posts")
        crawl_id: Reference to crawler job ID
        record_count: Number of records in dataset
        date_range_start: Start date of data (ISO format or datetime)
        date_range_end: End date of data (ISO format or datetime)
        schema_name: Database schema (bronze, silver, gold)
        source_database: Database identifier (etl_postgres, unified_duckdb)
        ingestion_method: How data was ingested (crawler, api, upload)
        visibility: Access level (private, public, restricted)
        created_by: User/system that created this dataset
        metadata: Additional metadata as dict (e.g., columns, filters)
        tags: List of tags for categorization

    Returns:
        int: Dataset ID

    Example:
        dataset_id = register_dataset(
            name="Twitter Political Q1 2025",
            description="Twitter posts from political accounts Q1 2025",
            dataset_type="social_media",
            source_platform="twitter",
            table_name="posts",
            crawl_id="twitter-political-q1-2025",
            record_count=15420,
            date_range_start="2025-01-01",
            date_range_end="2025-03-31",
            schema_name="silver",
            tags=["twitter", "political", "q1-2025"]
        )
    """

    try:
        with get_ui_db_connection() as conn:
            with conn.cursor() as cur:
                # Prepare metadata JSON
                metadata_json = metadata or {}

                # Insert or update dataset
                insert_query = """
                INSERT INTO datasets (
                    name, description, dataset_type, source_platform,
                    source_database, schema_name, table_name,
                    record_count, date_range_start, date_range_end,
                    crawl_id, ingestion_method, status, visibility,
                    created_by, metadata, last_updated
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (name)
                DO UPDATE SET
                    description = EXCLUDED.description,
                    record_count = EXCLUDED.record_count,
                    date_range_start = EXCLUDED.date_range_start,
                    date_range_end = EXCLUDED.date_range_end,
                    last_updated = EXCLUDED.last_updated,
                    metadata = EXCLUDED.metadata,
                    status = 'available'
                RETURNING id
                """

                cur.execute(insert_query, (
                    name, description, dataset_type, source_platform,
                    source_database, schema_name, table_name,
                    record_count, date_range_start, date_range_end,
                    crawl_id, ingestion_method, 'available', visibility,
                    created_by, psycopg2.extras.Json(metadata_json),
                    datetime.now()
                ))

                dataset_id = cur.fetchone()[0]

                # Add tags if provided
                if tags:
                    for tag in tags:
                        tag_query = """
                        INSERT INTO dataset_tags (dataset_id, tag_name)
                        VALUES (%s, %s)
                        ON CONFLICT (dataset_id, tag_name) DO NOTHING
                        """
                        cur.execute(tag_query, (dataset_id, tag))

                print(f"✓ Dataset registered: {name} (ID: {dataset_id})")
                return dataset_id

    except Exception as e:
        print(f"✗ Failed to register dataset '{name}': {e}")
        raise


def update_dataset_stats(
    dataset_name: str,
    record_count: int,
    date_range_start: Optional[str] = None,
    date_range_end: Optional[str] = None
) -> bool:
    """
    Update dataset statistics after data refresh.

    Args:
        dataset_name: Name of the dataset to update
        record_count: New record count
        date_range_start: Updated start date (optional)
        date_range_end: Updated end date (optional)

    Returns:
        bool: True if successful
    """
    try:
        with get_ui_db_connection() as conn:
            with conn.cursor() as cur:
                update_query = """
                UPDATE datasets
                SET record_count = %s,
                    date_range_start = COALESCE(%s, date_range_start),
                    date_range_end = COALESCE(%s, date_range_end),
                    last_updated = %s,
                    status = 'available'
                WHERE name = %s
                """

                cur.execute(update_query, (
                    record_count,
                    date_range_start,
                    date_range_end,
                    datetime.now(),
                    dataset_name
                ))

                if cur.rowcount > 0:
                    print(f"✓ Dataset stats updated: {dataset_name} ({record_count:,} records)")
                    return True
                else:
                    print(f"⚠ Dataset not found: {dataset_name}")
                    return False

    except Exception as e:
        print(f"✗ Failed to update dataset stats: {e}")
        return False


def mark_dataset_processing(dataset_name: str) -> bool:
    """
    Mark a dataset as currently processing (useful during ingestion).

    Args:
        dataset_name: Name of the dataset

    Returns:
        bool: True if successful
    """
    try:
        with get_ui_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE datasets SET status = 'processing' WHERE name = %s",
                    (dataset_name,)
                )
                return cur.rowcount > 0
    except Exception as e:
        print(f"✗ Failed to mark dataset as processing: {e}")
        return False


def mark_dataset_error(dataset_name: str, error_message: str) -> bool:
    """
    Mark a dataset as having an error.

    Args:
        dataset_name: Name of the dataset
        error_message: Error description

    Returns:
        bool: True if successful
    """
    try:
        with get_ui_db_connection() as conn:
            with conn.cursor() as cur:
                metadata_update = """
                UPDATE datasets
                SET status = 'error',
                    metadata = metadata || %s,
                    last_updated = %s
                WHERE name = %s
                """

                error_metadata = psycopg2.extras.Json({
                    'last_error': error_message,
                    'error_timestamp': datetime.now().isoformat()
                })

                cur.execute(metadata_update, (
                    error_metadata,
                    datetime.now(),
                    dataset_name
                ))

                return cur.rowcount > 0
    except Exception as e:
        print(f"✗ Failed to mark dataset error: {e}")
        return False


def get_dataset_info(dataset_name: str) -> Optional[Dict[str, Any]]:
    """
    Get dataset information from the registry.

    Args:
        dataset_name: Name of the dataset

    Returns:
        dict: Dataset information or None if not found
    """
    try:
        with get_ui_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, name, dataset_type, source_platform,
                           schema_name, table_name, record_count,
                           date_range_start, date_range_end, status,
                           last_updated
                    FROM datasets
                    WHERE name = %s
                """, (dataset_name,))

                row = cur.fetchone()
                if row:
                    return {
                        'id': row[0],
                        'name': row[1],
                        'dataset_type': row[2],
                        'source_platform': row[3],
                        'schema_name': row[4],
                        'table_name': row[5],
                        'record_count': row[6],
                        'date_range_start': row[7],
                        'date_range_end': row[8],
                        'status': row[9],
                        'last_updated': row[10]
                    }
                return None
    except Exception as e:
        print(f"✗ Failed to get dataset info: {e}")
        return None


def list_datasets(dataset_type: Optional[str] = None) -> list:
    """
    List all registered datasets, optionally filtered by type.

    Args:
        dataset_type: Filter by dataset type (optional)

    Returns:
        list: List of dataset dictionaries
    """
    try:
        with get_ui_db_connection() as conn:
            with conn.cursor() as cur:
                if dataset_type:
                    cur.execute("""
                        SELECT name, dataset_type, source_platform, record_count, status
                        FROM datasets
                        WHERE dataset_type = %s
                        ORDER BY created_at DESC
                    """, (dataset_type,))
                else:
                    cur.execute("""
                        SELECT name, dataset_type, source_platform, record_count, status
                        FROM datasets
                        ORDER BY created_at DESC
                    """)

                datasets = []
                for row in cur.fetchall():
                    datasets.append({
                        'name': row[0],
                        'dataset_type': row[1],
                        'source_platform': row[2],
                        'record_count': row[3],
                        'status': row[4]
                    })

                return datasets
    except Exception as e:
        print(f"✗ Failed to list datasets: {e}")
        return []


def test_connection():
    """Test connection to UI database and check if datasets table exists"""
    try:
        with get_ui_db_connection() as conn:
            with conn.cursor() as cur:
                # Check if datasets table exists
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_name = 'datasets'
                    )
                """)

                table_exists = cur.fetchone()[0]

                if table_exists:
                    print("✓ Connected to UI database")
                    print("✓ Datasets table exists")

                    # Get count of registered datasets
                    cur.execute("SELECT COUNT(*) FROM datasets")
                    count = cur.fetchone()[0]
                    print(f"✓ Registered datasets: {count}")

                    return True
                else:
                    print("⚠ Datasets table not found")
                    print("  Please run: psql postgres < sql/schemas/datasets_schema.sql")
                    return False

    except Exception as e:
        print(f"✗ Connection test failed: {e}")
        return False


if __name__ == "__main__":
    print("Dataset Registry Connection Test")
    print("=" * 50)
    test_connection()

    print("\nRegistered Datasets:")
    print("=" * 50)
    datasets = list_datasets()
    for ds in datasets:
        print(f"  - {ds['name']} ({ds['dataset_type']}/{ds['source_platform']}) "
              f"- {ds['record_count']:,} records [{ds['status']}]")
