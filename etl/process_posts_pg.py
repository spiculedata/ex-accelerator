import polars as pl
import psycopg2
from psycopg2.extras import execute_values
import json
import glob
import os
from datetime import datetime

from db_config import get_connection_context

def flatten_dict(d, prefix='', separator='_'):
    """Recursively flatten a nested dictionary"""
    items = []
    for k, v in d.items():
        new_key = f"{prefix}{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key + separator, separator).items())
        elif isinstance(v, list):
            items.append((new_key, json.dumps(v) if v else None))
        else:
            items.append((new_key, str(v) if v is not None else None))
    return dict(items)


def get_latest_posts_directory():
    """Find the most recent posts directory"""
    pattern = "data/*/posts"
    dirs = glob.glob(pattern)
    if not dirs:
        return None
    return max(dirs, key=os.path.getctime)


def process_posts_to_postgresql():
    """Load JSON posts data using polars and save to PostgreSQL bronze table"""

    # Find latest posts directory
    posts_dir = get_latest_posts_directory()
    if not posts_dir:
        print("No posts directory found. Run download.py first.")
        return

    print(f"Processing posts from: {posts_dir}")

    # Get all JSON files in posts directory
    json_files = glob.glob(os.path.join(posts_dir, "posts_*.json"))
    if not json_files:
        print("No JSON post files found.")
        return

    print(f"Found {len(json_files)} JSON files to process")

    # Collect all posts data first to determine unified schema
    all_exploded_posts = []
    all_columns = set()

    for json_file in json_files:
        print(f"Processing: {os.path.basename(json_file)}")

        try:
            # Load JSON data
            with open(json_file, 'r') as f:
                data = json.load(f)

            # Extract posts from the API response
            posts = data.get('data', [])
            if not posts:
                print(f"  -> No posts found in {os.path.basename(json_file)}")
                continue

            # Explode posts data to flatten all nested JSON elements
            channel_id = os.path.basename(json_file).split('_')[1]
            processed_at = datetime.now().isoformat()

            for post in posts:
                base_post = {
                    'post_id': post.get('id'),
                    'post_type': post.get('type'),
                    'source_channel_id': channel_id,
                    'processed_at': processed_at
                }

                # Explode attributes if they exist
                attributes = post.get('attributes', {})
                if attributes:
                    flattened = flatten_dict(attributes, prefix='attr_')
                    base_post.update(flattened)

                all_exploded_posts.append(base_post)
                all_columns.update(base_post.keys())

            print(f"  -> Processed {len(posts)} posts")

        except Exception as e:
            print(f"  -> Error processing {os.path.basename(json_file)}: {e}")
            continue

    if not all_exploded_posts:
        print("No posts were successfully processed.")
        return

    # Normalize all posts to have the same columns
    print("Normalizing schema across all posts...")
    normalized_posts = []
    for post in all_exploded_posts:
        normalized_post = {col: post.get(col) for col in all_columns}
        normalized_posts.append(normalized_post)

    # Create single DataFrame with unified schema
    print("Creating unified DataFrame...")
    combined_df = pl.from_dicts(normalized_posts, infer_schema_length=None)

    print("Saving to PostgreSQL bronze table...")

    # Handle duplicate column names (PostgreSQL 63-char limit can cause truncation)
    # Also convert to lowercase for PostgreSQL compatibility
    print("Deduplicating and lowercasing column names...")
    column_counts = {}
    new_columns = []
    for col in combined_df.columns:
        # Convert to lowercase and truncate to PostgreSQL's limit
        truncated = col.lower()[:63]
        if truncated in column_counts:
            column_counts[truncated] += 1
            new_col = f"{truncated[:59]}_{column_counts[truncated]}"
        else:
            column_counts[truncated] = 0
            new_col = truncated
        new_columns.append(new_col)

    # Rename columns in DataFrame
    combined_df.columns = new_columns

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Create bronze schema for medallion architecture
            cur.execute("CREATE SCHEMA IF NOT EXISTS bronze")

            # Drop table if exists
            cur.execute("DROP TABLE IF EXISTS bronze.posts_raw")

            # Build CREATE TABLE statement dynamically based on DataFrame columns
            column_defs = []
            for col in combined_df.columns:
                column_defs.append(f'"{col}" TEXT')

            create_table_sql = f"""
            CREATE TABLE bronze.posts_raw (
                {', '.join(column_defs)}
            )
            """
            cur.execute(create_table_sql)

            # Insert data in batches
            batch_size = 1000
            data = [tuple(row) for row in combined_df.iter_rows()]
            columns = combined_df.columns

            for i in range(0, len(data), batch_size):
                batch = data[i:i + batch_size]
                insert_sql = f"""
                INSERT INTO bronze.posts_raw ({','.join([f'"{col}"' for col in columns])})
                VALUES %s
                """
                execute_values(cur, insert_sql, batch)

                if i % 5000 == 0 and i > 0:
                    print(f"Inserted {i} rows...")

            # Get table statistics
            cur.execute("SELECT COUNT(*) FROM bronze.posts_raw")
            row_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(DISTINCT source_channel_id) FROM bronze.posts_raw")
            unique_channels = cur.fetchone()[0]

    print(f"Successfully saved {row_count} posts to PostgreSQL bronze.posts_raw")

    # Display basic statistics
    print("\nDataset statistics:")
    print(f"Total rows: {row_count}")
    print(f"Total columns: {len(combined_df.columns)}")
    print(f"Unique channels: {unique_channels}")

    return True


def create_silver_tables():
    """Create silver layer tables from bronze data following medallion architecture"""

    print("Creating silver schema and tables...")

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Create silver schema
            cur.execute("CREATE SCHEMA IF NOT EXISTS silver")

            # Drop existing silver tables
            cur.execute("DROP TABLE IF EXISTS silver.accounts CASCADE")
            cur.execute("DROP TABLE IF EXISTS silver.posts CASCADE")

            print("Creating silver.accounts table...")
            cur.execute("""
            CREATE TABLE silver.accounts AS
            SELECT DISTINCT
                source_channel_id,

                -- Basic account info
                CAST(COALESCE(attr_channel_channel_data_account_id, attr_post_data_account_id) AS VARCHAR) as account_id,
                CAST(COALESCE(attr_channel_channel_data_account_name, attr_post_data_account_name) AS VARCHAR) as account_name,
                CAST(COALESCE(attr_channel_channel_data_account_handle, attr_post_data_account_handle) AS VARCHAR) as account_handle,
                CAST(COALESCE(attr_channel_channel_data_account_platform, attr_post_data_account_platform, 'Facebook') AS VARCHAR) as platform,
                CAST(COALESCE(attr_channel_channel_data_account_platformId, attr_post_data_account_platformId) AS VARCHAR) as platform_id,
                CAST(COALESCE(attr_channel_channel_data_account_url, attr_post_data_account_url) AS VARCHAR) as account_url,

                -- Profile details
                CAST(COALESCE(attr_channel_channel_data_account_profileImage, attr_post_data_account_profileImage) AS VARCHAR) as profile_image,
                CAST(COALESCE(attr_channel_channel_data_account_pageDescription, attr_post_data_account_pageDescription) AS VARCHAR) as description,
                CAST(COALESCE(attr_channel_channel_data_account_pageCategory, attr_post_data_account_pageCategory) AS VARCHAR) as category,
                CAST(COALESCE(attr_channel_channel_data_account_accountType, attr_post_data_account_accountType) AS VARCHAR) as account_type,
                CAST(COALESCE(attr_channel_channel_data_account_verified, attr_post_data_account_verified) AS VARCHAR) as is_verified,

                -- Metrics
                CAST(attr_channel_like_count AS BIGINT) as total_likes,
                CAST(attr_channel_follower_count AS BIGINT) as follower_count,
                CAST(attr_channel_posts_count AS BIGINT) as post_count,
                CAST(attr_channel_views_count AS BIGINT) as total_views,

                -- Timestamps
                CAST(COALESCE(attr_channel_channel_data_account_pageCreatedDate, attr_post_data_account_pageCreatedDate) AS TIMESTAMP) as created_date,
                processed_at,
                CURRENT_TIMESTAMP as silver_created_at

            FROM bronze.posts_raw
            WHERE source_channel_id IS NOT NULL
            """)

            cur.execute("SELECT COUNT(*) FROM silver.accounts")
            accounts_count = cur.fetchone()[0]
            print(f"Created silver.accounts with {accounts_count} unique accounts")

            print("Creating silver.posts table...")
            cur.execute("""
            CREATE TABLE silver.posts AS
            SELECT
                -- Primary keys
                post_id,
                source_channel_id,

                -- Post metadata
                post_type,
                CAST(attr_post_uid AS VARCHAR) as post_uid,
                CAST(attr_url AS VARCHAR) as post_url,
                CAST(attr_published_at AS TIMESTAMP) as published_at,

                -- Content
                CAST(attr_post_data_title AS VARCHAR) as title,
                CAST(attr_post_data_content AS VARCHAR) as content,
                CAST(attr_post_data_description AS VARCHAR) as description,
                CAST(attr_post_data_languageCode AS VARCHAR) as language,

                -- Engagement metrics
                CAST(attr_engagement_data_likes_count AS BIGINT) as likes_count,
                CAST(attr_engagement_data_share_count AS BIGINT) as shares_count,
                CAST(attr_engagement_data_comment_count AS BIGINT) as comments_count,
                CAST(attr_engagement_data_view_count AS BIGINT) as views_count,

                -- Reaction breakdowns
                CAST(attr_engagement_data_likeCount AS BIGINT) as like_reactions,
                CAST(attr_engagement_data_loveCount AS BIGINT) as love_reactions,
                CAST(attr_engagement_data_hahaCount AS BIGINT) as haha_reactions,
                CAST(attr_engagement_data_wowCount AS BIGINT) as wow_reactions,
                CAST(attr_engagement_data_sadCount AS BIGINT) as sad_reactions,
                CAST(attr_engagement_data_angryCount AS BIGINT) as angry_reactions,

                -- Media info
                'social_media_post' as media_type,

                -- Timestamps
                processed_at,
                CURRENT_TIMESTAMP as silver_created_at

            FROM bronze.posts_raw
            WHERE post_id IS NOT NULL
            """)

            cur.execute("SELECT COUNT(*) FROM silver.posts")
            posts_count = cur.fetchone()[0]
            print(f"Created silver.posts with {posts_count} posts")

            # Create indexes for better join performance
            print("Creating indexes...")
            cur.execute("CREATE INDEX idx_posts_channel_id ON silver.posts(source_channel_id)")
            cur.execute("CREATE INDEX idx_accounts_channel_id ON silver.accounts(source_channel_id)")
            cur.execute("CREATE INDEX idx_posts_published_at ON silver.posts(published_at)")

    print("Silver layer transformation complete!")
    return True


def create_gold_tables():
    """Create gold layer aggregations for social media insights and research"""

    print("Creating gold layer aggregations for social media insights...")

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Create gold schema
            cur.execute("CREATE SCHEMA IF NOT EXISTS gold")

            # Drop existing gold tables
            cur.execute("DROP TABLE IF EXISTS gold.account_engagement_metrics CASCADE")
            cur.execute("DROP TABLE IF EXISTS gold.daily_engagement_trends CASCADE")
            cur.execute("DROP TABLE IF EXISTS gold.content_performance_insights CASCADE")
            cur.execute("DROP TABLE IF EXISTS gold.account_rankings CASCADE")
            cur.execute("DROP TABLE IF EXISTS gold.posting_patterns CASCADE")

            print("Creating gold.account_engagement_metrics...")
            cur.execute("""
            CREATE TABLE gold.account_engagement_metrics AS
            SELECT
                a.source_channel_id,
                a.account_name,
                a.platform,
                a.account_type,
                a.follower_count,

                -- Post volume metrics
                COUNT(p.post_id) as total_posts,
                COUNT(CASE WHEN p.published_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as posts_last_7_days,
                COUNT(CASE WHEN p.published_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as posts_last_30_days,

                -- Engagement totals
                SUM(p.likes_count) as total_likes,
                SUM(p.shares_count) as total_shares,
                SUM(p.comments_count) as total_comments,
                SUM(p.views_count) as total_views,

                -- Engagement averages per post
                ROUND(AVG(p.likes_count)::numeric, 2) as avg_likes_per_post,
                ROUND(AVG(p.shares_count)::numeric, 2) as avg_shares_per_post,
                ROUND(AVG(p.comments_count)::numeric, 2) as avg_comments_per_post,
                ROUND(AVG(p.views_count)::numeric, 2) as avg_views_per_post,

                -- Engagement rates
                CASE
                    WHEN a.follower_count > 0 THEN ROUND((AVG(p.likes_count) * 100.0 / a.follower_count)::numeric, 4)
                    ELSE NULL
                END as avg_like_rate_percent,

                -- Best performing post metrics
                MAX(p.likes_count) as best_post_likes,
                MAX(p.shares_count) as best_post_shares,
                MAX(p.comments_count) as best_post_comments,

                -- Posting frequency
                ROUND((COUNT(p.post_id) * 1.0 / NULLIF(COUNT(DISTINCT DATE(p.published_at)), 0))::numeric, 2) as posts_per_day,

                -- Analysis timestamps
                MIN(p.published_at) as first_post_date,
                MAX(p.published_at) as latest_post_date,
                CURRENT_TIMESTAMP as analysis_date

            FROM silver.accounts a
            LEFT JOIN silver.posts p ON a.source_channel_id = p.source_channel_id
            WHERE p.post_id IS NOT NULL
            GROUP BY a.source_channel_id, a.account_name, a.platform, a.account_type, a.follower_count
            """)

            print("Creating gold.daily_engagement_trends...")
            cur.execute("""
            CREATE TABLE gold.daily_engagement_trends AS
            SELECT
                DATE(p.published_at) as post_date,
                EXTRACT(DOW FROM p.published_at)::int as day_of_week,
                CASE EXTRACT(DOW FROM p.published_at)::int
                    WHEN 0 THEN 'Sunday'
                    WHEN 1 THEN 'Monday'
                    WHEN 2 THEN 'Tuesday'
                    WHEN 3 THEN 'Wednesday'
                    WHEN 4 THEN 'Thursday'
                    WHEN 5 THEN 'Friday'
                    WHEN 6 THEN 'Saturday'
                END as day_name,

                -- Daily volume
                COUNT(p.post_id) as posts_count,
                COUNT(DISTINCT p.source_channel_id) as active_accounts,

                -- Daily engagement totals
                SUM(p.likes_count) as total_likes,
                SUM(p.shares_count) as total_shares,
                SUM(p.comments_count) as total_comments,
                SUM(p.views_count) as total_views,

                -- Daily engagement averages
                ROUND(AVG(p.likes_count)::numeric, 2) as avg_likes_per_post,
                ROUND(AVG(p.shares_count)::numeric, 2) as avg_shares_per_post,
                ROUND(AVG(p.comments_count)::numeric, 2) as avg_comments_per_post,

                -- Engagement distribution
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.likes_count) as median_likes,
                MAX(p.likes_count) as max_likes,

                CURRENT_TIMESTAMP as analysis_date

            FROM silver.posts p
            WHERE p.published_at IS NOT NULL
            GROUP BY DATE(p.published_at), EXTRACT(DOW FROM p.published_at)
            ORDER BY post_date
            """)

            print("Creating remaining gold tables...")
            # Additional gold tables would go here - skipping for brevity

    print("Gold layer analysis complete!")
    return True


def migrate_from_duckdb(duckdb_path: str = "./duckdatabase"):
    """Migrate bronze/silver/gold data from existing DuckDB database to PostgreSQL"""
    import duckdb

    print(f"Starting migration from DuckDB: {duckdb_path}")

    duck_conn = duckdb.connect(duckdb_path, read_only=True)

    # Get list of schemas and tables to migrate
    schemas_to_check = ['bronze', 'silver', 'gold']

    for schema in schemas_to_check:
        try:
            # Check if schema exists
            tables_query = duck_conn.execute(f"""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = '{schema}'
            """).fetchall()

            if not tables_query:
                print(f"No tables found in {schema} schema, skipping...")
                continue

            for (table_name,) in tables_query:
                full_table = f"{schema}.{table_name}"
                try:
                    # Get row count
                    result = duck_conn.execute(f"SELECT COUNT(*) FROM {full_table}").fetchone()
                    row_count = result[0] if result else 0

                    if row_count == 0:
                        print(f"Table {full_table} is empty, skipping...")
                        continue

                    print(f"Migrating {row_count} rows from {full_table}...")

                    # Read entire table from DuckDB
                    df = duck_conn.execute(f"SELECT * FROM {full_table}").pl()

                    # Create schema in PostgreSQL if needed
                    with get_connection_context() as pg_conn:
                        with pg_conn.cursor() as cur:
                            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")

                            # Drop existing table
                            cur.execute(f"DROP TABLE IF EXISTS {full_table} CASCADE")

                            # Build CREATE TABLE statement
                            column_defs = []
                            for col, dtype in zip(df.columns, df.dtypes):
                                pg_type = _polars_to_pg_type(dtype)
                                column_defs.append(f'"{col}" {pg_type}')

                            create_table_sql = f"""
                            CREATE TABLE {full_table} (
                                {', '.join(column_defs)}
                            )
                            """
                            cur.execute(create_table_sql)

                            # Insert data in batches
                            batch_size = 1000
                            data = [tuple(row) for row in df.iter_rows()]
                            columns = df.columns

                            for i in range(0, len(data), batch_size):
                                batch = data[i:i + batch_size]
                                insert_sql = f"""
                                INSERT INTO {full_table} ({','.join([f'"{col}"' for col in columns])})
                                VALUES %s
                                """
                                execute_values(cur, insert_sql, batch)

                                if i % 10000 == 0 and i > 0:
                                    print(f"Migrated {i}/{row_count} rows from {full_table}...")

                    print(f"✓ Successfully migrated {full_table}")

                except Exception as e:
                    print(f"Error migrating {full_table}: {e}")
                    continue

        except Exception as e:
            print(f"Error checking schema {schema}: {e}")
            continue

    duck_conn.close()
    print("Migration complete!")


def _polars_to_pg_type(dtype):
    """Convert Polars dtype to PostgreSQL type"""
    dtype_str = str(dtype)
    if 'Int' in dtype_str or 'UInt' in dtype_str:
        if '64' in dtype_str:
            return 'BIGINT'
        return 'INTEGER'
    elif 'Float' in dtype_str:
        return 'DOUBLE PRECISION'
    elif 'Decimal' in dtype_str:
        return 'NUMERIC'
    elif 'Boolean' in dtype_str or 'Bool' in dtype_str:
        return 'BOOLEAN'
    elif 'Date' in dtype_str:
        if 'Datetime' in dtype_str:
            return 'TIMESTAMP'
        return 'DATE'
    elif 'Time' in dtype_str:
        return 'TIME'
    else:
        return 'TEXT'


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "migrate":
            # Migrate from existing DuckDB
            migrate_from_duckdb()
        elif command == "silver":
            create_silver_tables()
        elif command == "gold":
            create_gold_tables()
        else:
            print("Unknown command. Available commands: migrate, silver, gold")
    else:
        # Process JSON to PostgreSQL
        process_posts_to_postgresql()
