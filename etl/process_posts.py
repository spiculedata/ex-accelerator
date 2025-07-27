import polars as pl
import duckdb
import json
import glob
import os
from datetime import datetime


def flatten_dict(d, prefix='', separator='_'):
    """Recursively flatten a nested dictionary"""
    items = []
    for k, v in d.items():
        new_key = f"{prefix}{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key + separator, separator).items())
        elif isinstance(v, list):
            # Convert lists to JSON strings for now to avoid further complexity
            items.append((new_key, json.dumps(v) if v else None))
        else:
            # Convert all values to strings to ensure consistent typing
            items.append((new_key, str(v) if v is not None else None))
    return dict(items)


def get_latest_posts_directory():
    """Find the most recent posts directory"""
    pattern = "data/*/posts"
    dirs = glob.glob(pattern)
    if not dirs:
        return None
    return max(dirs, key=os.path.getctime)


def process_posts_to_duckdb():
    """Load JSON posts data using polars and save to DuckDB bronze table"""
    
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
                    # Flatten nested dictionaries with prefixes
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
    
    # Use existing DuckDB database
    db_file = "./duckdatabase"
    
    print("Saving to DuckDB bronze table...")
    
    # Connect to DuckDB and create bronze table
    conn = duckdb.connect(db_file)
    
    # Create bronze schema for medallion architecture
    conn.execute("CREATE SCHEMA IF NOT EXISTS bronze")
    
    # Drop table if exists and create new one
    conn.execute("DROP TABLE IF EXISTS bronze.posts_raw")
    
    # Convert polars DataFrame to DuckDB table
    conn.execute("CREATE TABLE bronze.posts_raw AS SELECT * FROM combined_df")
    
    # Get table statistics
    row_count = conn.execute("SELECT COUNT(*) FROM bronze.posts_raw").fetchone()[0]
    column_count = len(combined_df.columns)
    unique_channels = conn.execute("SELECT COUNT(DISTINCT source_channel_id) FROM bronze.posts_raw").fetchone()[0]
    
    print(f"Successfully saved {row_count} posts to DuckDB: {db_file}")
    print(f"Database size: {os.path.getsize(db_file)} bytes")
    
    # Display basic statistics
    print("\nDataset statistics:")
    print(f"Total rows: {row_count}")
    print(f"Total columns: {column_count}")
    print(f"Unique channels: {unique_channels}")
    
    # Show table info
    print(f"\nCreated bronze.posts_raw with {column_count} columns")
    
    conn.close()
    return db_file


def create_silver_tables():
    """Create silver layer tables from bronze data following medallion architecture"""
    db_file = "./duckdatabase"
    conn = duckdb.connect(db_file)
    
    print("Creating silver schema and tables...")
    
    # Create silver schema
    conn.execute("CREATE SCHEMA IF NOT EXISTS silver")
    
    # Drop existing silver tables
    conn.execute("DROP TABLE IF EXISTS silver.accounts")
    conn.execute("DROP TABLE IF EXISTS silver.posts")
    
    print("Creating silver.accounts table...")
    # Create accounts table with cleaned and typed data
    conn.execute("""
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
        
        -- Metrics (simplified)
        TRY_CAST(attr_channel_like_count AS BIGINT) as total_likes,
        TRY_CAST(attr_channel_follower_count AS BIGINT) as follower_count,
        TRY_CAST(attr_channel_posts_count AS BIGINT) as post_count,
        TRY_CAST(attr_channel_views_count AS BIGINT) as total_views,
        
        -- Timestamps
        TRY_CAST(CAST(COALESCE(attr_channel_channel_data_account_pageCreatedDate, attr_post_data_account_pageCreatedDate) AS VARCHAR) AS TIMESTAMP) as created_date,
        processed_at,
        CURRENT_TIMESTAMP as silver_created_at
        
    FROM bronze.posts_raw
    WHERE source_channel_id IS NOT NULL
    """)
    
    accounts_count = conn.execute("SELECT COUNT(*) FROM silver.accounts").fetchone()[0]
    print(f"Created silver.accounts with {accounts_count} unique accounts")
    
    print("Creating silver.posts table...")
    # Create posts table with cleaned and typed data (simplified to avoid type conflicts)
    conn.execute("""
    CREATE TABLE silver.posts AS
    SELECT 
        -- Primary keys
        post_id,
        source_channel_id,
        
        -- Post metadata
        post_type,
        CAST(attr_post_uid AS VARCHAR) as post_uid,
        CAST(attr_url AS VARCHAR) as post_url,
        TRY_CAST(attr_published_at AS TIMESTAMP) as published_at,
        
        -- Content (safe casting)
        CAST(attr_post_data_title AS VARCHAR) as title,
        CAST(attr_post_data_content AS VARCHAR) as content,
        CAST(attr_post_data_description AS VARCHAR) as description,
        CAST(attr_post_data_languageCode AS VARCHAR) as language,
        
        -- Engagement metrics
        TRY_CAST(attr_engagement_data_likes_count AS BIGINT) as likes_count,
        TRY_CAST(attr_engagement_data_share_count AS BIGINT) as shares_count,
        TRY_CAST(attr_engagement_data_comment_count AS BIGINT) as comments_count,
        TRY_CAST(attr_engagement_data_view_count AS BIGINT) as views_count,
        
        -- Reaction breakdowns
        TRY_CAST(attr_engagement_data_likeCount AS BIGINT) as like_reactions,
        TRY_CAST(attr_engagement_data_loveCount AS BIGINT) as love_reactions,
        TRY_CAST(attr_engagement_data_hahaCount AS BIGINT) as haha_reactions,
        TRY_CAST(attr_engagement_data_wowCount AS BIGINT) as wow_reactions,
        TRY_CAST(attr_engagement_data_sadCount AS BIGINT) as sad_reactions,
        TRY_CAST(attr_engagement_data_angryCount AS BIGINT) as angry_reactions,
        
        -- Media info (simplified)
        'social_media_post' as media_type,
        
        -- Timestamps
        processed_at,
        CURRENT_TIMESTAMP as silver_created_at
        
    FROM bronze.posts_raw
    WHERE post_id IS NOT NULL
    """)
    
    posts_count = conn.execute("SELECT COUNT(*) FROM silver.posts").fetchone()[0]
    print(f"Created silver.posts with {posts_count} posts")
    
    # Create indexes for better join performance
    print("Creating indexes...")
    conn.execute("CREATE INDEX idx_posts_channel_id ON silver.posts(source_channel_id)")
    conn.execute("CREATE INDEX idx_accounts_channel_id ON silver.accounts(source_channel_id)")
    conn.execute("CREATE INDEX idx_posts_published_at ON silver.posts(published_at)")
    
    print("Silver layer transformation complete!")
    
    # Show sample join
    print("\nSample join query:")
    sample_query = conn.execute("""
    SELECT 
        p.post_id,
        a.account_name,
        a.platform,
        p.content,
        p.likes_count,
        p.published_at
    FROM silver.posts p
    JOIN silver.accounts a ON p.source_channel_id = a.source_channel_id
    WHERE p.likes_count > 1000
    ORDER BY p.likes_count DESC
    LIMIT 5
    """).pl()
    
    print(sample_query)
    
    conn.close()
    return True


def create_gold_tables():
    """Create gold layer aggregations for social media insights and research"""
    db_file = "./duckdatabase"
    conn = duckdb.connect(db_file)
    
    print("Creating gold layer aggregations for social media insights...")
    
    # Create gold schema
    conn.execute("CREATE SCHEMA IF NOT EXISTS gold")
    
    # Drop existing gold tables
    conn.execute("DROP TABLE IF EXISTS gold.account_engagement_metrics")
    conn.execute("DROP TABLE IF EXISTS gold.daily_engagement_trends") 
    conn.execute("DROP TABLE IF EXISTS gold.content_performance_insights")
    conn.execute("DROP TABLE IF EXISTS gold.account_rankings")
    conn.execute("DROP TABLE IF EXISTS gold.posting_patterns")
    
    print("Creating gold.account_engagement_metrics...")
    # Account-level engagement performance metrics
    conn.execute("""
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
        ROUND(AVG(p.likes_count), 2) as avg_likes_per_post,
        ROUND(AVG(p.shares_count), 2) as avg_shares_per_post,
        ROUND(AVG(p.comments_count), 2) as avg_comments_per_post,
        ROUND(AVG(p.views_count), 2) as avg_views_per_post,
        
        -- Engagement rates (if follower count available)
        CASE 
            WHEN a.follower_count > 0 THEN ROUND((AVG(p.likes_count) * 100.0 / a.follower_count), 4)
            ELSE NULL 
        END as avg_like_rate_percent,
        
        -- Best performing post metrics
        MAX(p.likes_count) as best_post_likes,
        MAX(p.shares_count) as best_post_shares,
        MAX(p.comments_count) as best_post_comments,
        
        -- Posting frequency
        ROUND(COUNT(p.post_id) * 1.0 / COUNT(DISTINCT DATE(p.published_at)), 2) as posts_per_day,
        
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
    # Daily engagement trends for time series analysis
    conn.execute("""
    CREATE TABLE gold.daily_engagement_trends AS
    SELECT 
        DATE(p.published_at) as post_date,
        EXTRACT(DOW FROM p.published_at) as day_of_week, -- 0=Sunday, 6=Saturday
        CASE EXTRACT(DOW FROM p.published_at)
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
        ROUND(AVG(p.likes_count), 2) as avg_likes_per_post,
        ROUND(AVG(p.shares_count), 2) as avg_shares_per_post,
        ROUND(AVG(p.comments_count), 2) as avg_comments_per_post,
        
        -- Engagement distribution
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.likes_count) as median_likes,
        MAX(p.likes_count) as max_likes,
        
        CURRENT_TIMESTAMP as analysis_date
        
    FROM silver.posts p
    WHERE p.published_at IS NOT NULL
    GROUP BY DATE(p.published_at), EXTRACT(DOW FROM p.published_at)
    ORDER BY post_date
    """)
    
    print("Creating gold.content_performance_insights...")
    # Content performance insights
    conn.execute("""
    CREATE TABLE gold.content_performance_insights AS
    WITH content_metrics AS (
        SELECT 
            p.post_id,
            p.source_channel_id,
            a.account_name,
            p.published_at,
            p.media_type,
            
            -- Content characteristics
            LENGTH(p.title) as title_length,
            LENGTH(p.content) as content_length,
            CASE 
                WHEN LENGTH(p.content) = 0 THEN 'No Content'
                WHEN LENGTH(p.content) <= 100 THEN 'Short (≤100 chars)'
                WHEN LENGTH(p.content) <= 500 THEN 'Medium (101-500 chars)'
                ELSE 'Long (>500 chars)'
            END as content_length_category,
            
            -- Engagement metrics
            p.likes_count,
            p.shares_count, 
            p.comments_count,
            p.views_count,
            
            -- Calculate total engagement
            (COALESCE(p.likes_count, 0) + COALESCE(p.shares_count, 0) + COALESCE(p.comments_count, 0)) as total_engagement,
            
            -- Engagement ratios
            CASE 
                WHEN p.likes_count > 0 THEN ROUND(p.comments_count * 1.0 / p.likes_count, 3)
                ELSE 0 
            END as comment_to_like_ratio,
            
            CASE 
                WHEN p.likes_count > 0 THEN ROUND(p.shares_count * 1.0 / p.likes_count, 3)
                ELSE 0 
            END as share_to_like_ratio
            
        FROM silver.posts p
        JOIN silver.accounts a ON p.source_channel_id = a.source_channel_id
        WHERE p.likes_count IS NOT NULL
    )
    SELECT 
        *,
        -- Performance rankings within account
        ROW_NUMBER() OVER (PARTITION BY source_channel_id ORDER BY total_engagement DESC) as engagement_rank_in_account,
        ROW_NUMBER() OVER (PARTITION BY source_channel_id ORDER BY likes_count DESC) as like_rank_in_account,
        
        -- Performance percentiles across all posts
        PERCENT_RANK() OVER (ORDER BY total_engagement) as engagement_percentile,
        PERCENT_RANK() OVER (ORDER BY likes_count) as like_percentile,
        
        -- Performance categories
        CASE 
            WHEN PERCENT_RANK() OVER (ORDER BY total_engagement) >= 0.9 THEN 'Top 10%'
            WHEN PERCENT_RANK() OVER (ORDER BY total_engagement) >= 0.75 THEN 'Top 25%'
            WHEN PERCENT_RANK() OVER (ORDER BY total_engagement) >= 0.5 THEN 'Above Average'
            ELSE 'Below Average'
        END as performance_tier,
        
        CURRENT_TIMESTAMP as analysis_date
        
    FROM content_metrics
    """)
    
    print("Creating gold.account_rankings...")
    # Account performance rankings and benchmarks
    conn.execute("""
    CREATE TABLE gold.account_rankings AS
    WITH account_stats AS (
        SELECT 
            source_channel_id,
            account_name,
            platform,
            account_type,
            follower_count,
            total_posts,
            avg_likes_per_post,
            avg_shares_per_post,
            avg_comments_per_post,
            avg_like_rate_percent,
            posts_per_day,
            best_post_likes
        FROM gold.account_engagement_metrics
    )
    SELECT 
        *,
        -- Rankings across all accounts
        ROW_NUMBER() OVER (ORDER BY avg_likes_per_post DESC) as likes_rank,
        ROW_NUMBER() OVER (ORDER BY avg_shares_per_post DESC) as shares_rank,
        ROW_NUMBER() OVER (ORDER BY avg_comments_per_post DESC) as comments_rank,
        ROW_NUMBER() OVER (ORDER BY avg_like_rate_percent DESC) as engagement_rate_rank,
        ROW_NUMBER() OVER (ORDER BY posts_per_day DESC) as posting_frequency_rank,
        ROW_NUMBER() OVER (ORDER BY best_post_likes DESC) as viral_content_rank,
        
        -- Performance tiers
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY avg_likes_per_post DESC) <= 3 THEN 'Top Performer'
            WHEN ROW_NUMBER() OVER (ORDER BY avg_likes_per_post DESC) <= 10 THEN 'High Performer'
            WHEN ROW_NUMBER() OVER (ORDER BY avg_likes_per_post DESC) <= 20 THEN 'Medium Performer'
            ELSE 'Low Performer'
        END as performance_category,
        
        -- Benchmarking percentiles
        PERCENT_RANK() OVER (ORDER BY avg_likes_per_post) as likes_percentile,
        PERCENT_RANK() OVER (ORDER BY avg_like_rate_percent) as engagement_rate_percentile,
        PERCENT_RANK() OVER (ORDER BY posts_per_day) as posting_frequency_percentile,
        
        CURRENT_TIMESTAMP as analysis_date
        
    FROM account_stats
    WHERE total_posts >= 1  -- Only accounts with at least 1 post
    """)
    
    print("Creating gold.posting_patterns...")
    # Posting patterns and optimal timing insights
    conn.execute("""
    CREATE TABLE gold.posting_patterns AS
    SELECT 
        EXTRACT(HOUR FROM p.published_at) as hour_of_day,
        EXTRACT(DOW FROM p.published_at) as day_of_week,
        CASE EXTRACT(DOW FROM p.published_at)
            WHEN 0 THEN 'Sunday'
            WHEN 1 THEN 'Monday' 
            WHEN 2 THEN 'Tuesday'
            WHEN 3 THEN 'Wednesday'
            WHEN 4 THEN 'Thursday'
            WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
        END as day_name,
        
        CASE 
            WHEN EXTRACT(HOUR FROM p.published_at) BETWEEN 6 AND 11 THEN 'Morning (6-11)'
            WHEN EXTRACT(HOUR FROM p.published_at) BETWEEN 12 AND 17 THEN 'Afternoon (12-17)'
            WHEN EXTRACT(HOUR FROM p.published_at) BETWEEN 18 AND 22 THEN 'Evening (18-22)'
            ELSE 'Night/Early Morning'
        END as time_period,
        
        -- Volume metrics
        COUNT(p.post_id) as posts_count,
        COUNT(DISTINCT p.source_channel_id) as unique_accounts,
        
        -- Performance metrics
        ROUND(AVG(p.likes_count), 2) as avg_likes,
        ROUND(AVG(p.shares_count), 2) as avg_shares,
        ROUND(AVG(p.comments_count), 2) as avg_comments,
        
        -- Best performance
        MAX(p.likes_count) as max_likes,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.likes_count) as median_likes,
        
        -- Performance ranking
        RANK() OVER (ORDER BY AVG(p.likes_count) DESC) as performance_rank,
        
        CURRENT_TIMESTAMP as analysis_date
        
    FROM silver.posts p
    WHERE p.published_at IS NOT NULL
    GROUP BY 
        EXTRACT(HOUR FROM p.published_at),
        EXTRACT(DOW FROM p.published_at)
    ORDER BY avg_likes DESC
    """)
    
    # Get summary statistics
    accounts_analyzed = conn.execute("SELECT COUNT(*) FROM gold.account_engagement_metrics").fetchone()[0]
    posts_analyzed = conn.execute("SELECT COUNT(*) FROM gold.content_performance_insights").fetchone()[0]
    date_range = conn.execute("SELECT MIN(post_date), MAX(post_date) FROM gold.daily_engagement_trends").fetchone()
    
    print(f"Gold layer analysis complete!")
    print(f"- Analyzed {accounts_analyzed} accounts")
    print(f"- Analyzed {posts_analyzed} posts") 
    print(f"- Date range: {date_range[0]} to {date_range[1]}")
    
    # Show sample insights
    print("\nSample insights:")
    
    # Top performing accounts
    top_accounts = conn.execute("""
        SELECT account_name, avg_likes_per_post, performance_category, likes_rank
        FROM gold.account_rankings 
        ORDER BY likes_rank 
        LIMIT 5
    """).pl()
    print("\nTop 5 accounts by average likes:")
    print(top_accounts)
    
    # Best posting times
    best_times = conn.execute("""
        SELECT day_name, time_period, avg_likes, posts_count, performance_rank
        FROM gold.posting_patterns 
        ORDER BY performance_rank 
        LIMIT 5
    """).pl()
    print("\nBest posting times by engagement:")
    print(best_times)
    
    conn.close()
    return True


def create_text_enrichments():
    """Add text analysis enrichments to silver layer for social media insights"""
    db_file = "./duckdatabase"
    conn = duckdb.connect(db_file)
    
    print("Creating text analysis enrichments for silver layer...")
    
    # Drop existing enrichment table
    conn.execute("DROP TABLE IF EXISTS silver.posts_text_analysis")
    
    print("Creating silver.posts_text_analysis with comprehensive text metrics...")
    
    # Create comprehensive text analysis table
    conn.execute("""
    CREATE TABLE silver.posts_text_analysis AS
    SELECT 
        p.post_id,
        p.source_channel_id,
        a.account_name,
        p.published_at,
        p.title,
        p.content,
        p.likes_count,
        p.shares_count,
        p.comments_count,
        
        -- Basic text metrics
        LENGTH(p.content) as content_char_count,
        LENGTH(REPLACE(p.content, ' ', '')) as content_char_count_no_spaces,
        array_length(string_split(p.content, ' ')) as word_count,
        array_length(string_split(p.content, '.')) - 1 as sentence_count,
        
        -- Readability metrics
        CASE 
            WHEN array_length(string_split(p.content, ' ')) > 0 
            THEN ROUND(LENGTH(p.content) * 1.0 / array_length(string_split(p.content, ' ')), 2)
            ELSE 0 
        END as avg_word_length,
        
        CASE 
            WHEN (array_length(string_split(p.content, '.')) - 1) > 0 
            THEN ROUND(array_length(string_split(p.content, ' ')) * 1.0 / (array_length(string_split(p.content, '.')) - 1), 2)
            ELSE 0 
        END as avg_words_per_sentence,
        
        -- Content categorization
        CASE 
            WHEN LENGTH(p.content) = 0 THEN 'No Content'
            WHEN LENGTH(p.content) <= 50 THEN 'Very Short (≤50 chars)'
            WHEN LENGTH(p.content) <= 140 THEN 'Tweet-like (51-140 chars)'
            WHEN LENGTH(p.content) <= 280 THEN 'Extended Tweet (141-280 chars)'
            WHEN LENGTH(p.content) <= 500 THEN 'Medium Post (281-500 chars)'
            WHEN LENGTH(p.content) <= 1000 THEN 'Long Post (501-1000 chars)'
            ELSE 'Very Long Post (>1000 chars)'
        END as content_length_category,
        
        -- Emotional and engagement language indicators
        CASE 
            WHEN UPPER(p.content) LIKE '%!%' THEN length(p.content) - length(replace(p.content, '!', ''))
            ELSE 0
        END as exclamation_count,
        
        CASE 
            WHEN UPPER(p.content) LIKE '%?%' THEN length(p.content) - length(replace(p.content, '?', ''))
            ELSE 0
        END as question_count,
        
        CASE 
            WHEN p.content LIKE '%#%' THEN array_length(regexp_extract_all(p.content, '#\\w+'))
            ELSE 0
        END as hashtag_count,
        
        CASE 
            WHEN p.content LIKE '%@%' THEN array_length(regexp_extract_all(p.content, '@\\w+'))
            ELSE 0
        END as mention_count,
        
        -- Capitalization patterns (intensity indicators)
        CASE 
            WHEN LENGTH(p.content) > 0 
            THEN ROUND((LENGTH(p.content) - LENGTH(LOWER(p.content))) * 100.0 / LENGTH(p.content), 2)
            ELSE 0 
        END as uppercase_percentage,
        
        -- Political/emotional keywords (basic sentiment indicators)
        CASE 
            WHEN UPPER(p.content) ~ '.*(GREAT|EXCELLENT|AMAZING|FANTASTIC|WONDERFUL|PROUD|SUCCESS|WIN|VICTORY|BRILLIANT).*' THEN 1
            ELSE 0
        END as contains_positive_words,
        
        CASE 
            WHEN UPPER(p.content) ~ '.*(TERRIBLE|AWFUL|DISASTER|CRISIS|FAILURE|WRONG|PROBLEM|CONCERN|WORRY|DANGER).*' THEN 1
            ELSE 0
        END as contains_negative_words,
        
        CASE 
            WHEN UPPER(p.content) ~ '.*(ECONOMY|ECONOMIC|JOBS|UNEMPLOYMENT|INFLATION|BREXIT|EU|TRADE|BUSINESS|INVESTMENT).*' THEN 1
            ELSE 0
        END as contains_economic_terms,
        
        CASE 
            WHEN UPPER(p.content) ~ '.*(NHS|HEALTH|HEALTHCARE|HOSPITAL|DOCTOR|MEDICINE|VACCINE|COVID|PANDEMIC).*' THEN 1
            ELSE 0
        END as contains_health_terms,
        
        CASE 
            WHEN UPPER(p.content) ~ '.*(EDUCATION|SCHOOL|UNIVERSITY|STUDENT|TEACHER|LEARNING|SKILLS).*' THEN 1
            ELSE 0
        END as contains_education_terms,
        
        CASE 
            WHEN UPPER(p.content) ~ '.*(ENVIRONMENT|CLIMATE|GREEN|CARBON|ENERGY|RENEWABLE|POLLUTION).*' THEN 1
            ELSE 0
        END as contains_environment_terms,
        
        CASE 
            WHEN UPPER(p.content) ~ '.*(SECURITY|DEFENCE|MILITARY|POLICE|CRIME|TERROR|IMMIGRATION|BORDER).*' THEN 1
            ELSE 0
        END as contains_security_terms,
        
        -- Action-oriented language
        CASE 
            WHEN UPPER(p.content) ~ '.*(WE WILL|WE MUST|I WILL|LET.S|JOIN|SUPPORT|FIGHT|DELIVER|COMMIT|PROMISE).*' THEN 1
            ELSE 0
        END as contains_action_language,
        
        -- Personal/family references
        CASE 
            WHEN UPPER(p.content) ~ '.*(FAMILY|CHILDREN|WIFE|HUSBAND|DAUGHTER|SON|HOME|PERSONAL|MY|AKSHATA).*' THEN 1
            ELSE 0
        END as contains_personal_references,
        
        -- Time references
        CASE 
            WHEN UPPER(p.content) ~ '.*(TODAY|YESTERDAY|TOMORROW|WEEK|MONTH|YEAR|NOW|FUTURE|PAST|RECENT).*' THEN 1
            ELSE 0
        END as contains_time_references,
        
        -- Extract hashtags and mentions as arrays (for potential further analysis)
        regexp_extract_all(p.content, '#\\w+') as hashtags_array,
        regexp_extract_all(p.content, '@\\w+') as mentions_array,
        
        -- Readability score (simplified Flesch-like calculation)
        CASE 
            WHEN array_length(string_split(p.content, ' ')) > 0 AND (array_length(string_split(p.content, '.')) - 1) > 0
            THEN ROUND(206.835 - 1.015 * (array_length(string_split(p.content, ' ')) / (array_length(string_split(p.content, '.')) - 1)) 
                 - 84.6 * (LENGTH(p.content) / array_length(string_split(p.content, ' '))), 2)
            ELSE NULL
        END as readability_score,
        
        -- Engagement prediction score (simple heuristic)
        (
            (CASE WHEN exclamation_count > 0 THEN 1 ELSE 0 END) +
            (CASE WHEN question_count > 0 THEN 1 ELSE 0 END) +
            (CASE WHEN hashtag_count > 0 THEN 1 ELSE 0 END) +
            (CASE WHEN mention_count > 0 THEN 1 ELSE 0 END) +
            (CASE WHEN contains_positive_words = 1 THEN 1 ELSE 0 END) +
            (CASE WHEN contains_action_language = 1 THEN 1 ELSE 0 END) +
            (CASE WHEN contains_personal_references = 1 THEN 1 ELSE 0 END)
        ) as engagement_signals_score,
        
        CURRENT_TIMESTAMP as analysis_date
        
    FROM silver.posts p
    JOIN silver.accounts a ON p.source_channel_id = a.source_channel_id
    WHERE p.content IS NOT NULL AND LENGTH(p.content) > 0
    """)
    
    posts_analyzed = conn.execute("SELECT COUNT(*) FROM silver.posts_text_analysis").fetchone()[0]
    print(f"Text analysis complete for {posts_analyzed} posts")
    
    # Create indexes for better performance
    print("Creating indexes for text analysis...")
    conn.execute("CREATE INDEX idx_text_analysis_channel ON silver.posts_text_analysis(source_channel_id)")
    conn.execute("CREATE INDEX idx_text_analysis_date ON silver.posts_text_analysis(published_at)")
    conn.execute("CREATE INDEX idx_text_analysis_engagement ON silver.posts_text_analysis(engagement_signals_score)")
    
    # Show sample insights
    print("\nSample text analysis insights:")
    
    # Top performing content by engagement signals
    high_engagement_signals = conn.execute("""
        SELECT 
            account_name,
            LEFT(content, 100) || '...' as content_preview,
            word_count,
            hashtag_count,
            engagement_signals_score,
            likes_count
        FROM silver.posts_text_analysis 
        WHERE engagement_signals_score >= 4
        ORDER BY likes_count DESC 
        LIMIT 5
    """).pl()
    print("\nHigh engagement signal posts:")
    print(high_engagement_signals)
    
    # Content length vs performance analysis
    length_performance = conn.execute("""
        SELECT 
            content_length_category,
            COUNT(*) as post_count,
            ROUND(AVG(likes_count), 0) as avg_likes,
            ROUND(AVG(word_count), 1) as avg_words,
            ROUND(AVG(engagement_signals_score), 2) as avg_engagement_signals
        FROM silver.posts_text_analysis 
        GROUP BY content_length_category
        ORDER BY avg_likes DESC
    """).pl()
    print("\nContent length vs performance:")
    print(length_performance)
    
    # Topic distribution analysis
    topic_analysis = conn.execute("""
        SELECT 
            'Economic Terms' as topic,
            SUM(contains_economic_terms) as post_count,
            ROUND(AVG(CASE WHEN contains_economic_terms = 1 THEN likes_count END), 0) as avg_likes
        FROM silver.posts_text_analysis
        WHERE contains_economic_terms = 1
        
        UNION ALL
        
        SELECT 
            'Health Terms',
            SUM(contains_health_terms),
            ROUND(AVG(CASE WHEN contains_health_terms = 1 THEN likes_count END), 0)
        FROM silver.posts_text_analysis
        WHERE contains_health_terms = 1
        
        UNION ALL
        
        SELECT 
            'Personal References',
            SUM(contains_personal_references),
            ROUND(AVG(CASE WHEN contains_personal_references = 1 THEN likes_count END), 0)
        FROM silver.posts_text_analysis
        WHERE contains_personal_references = 1
        
        ORDER BY avg_likes DESC
    """).pl()
    print("\nTopic performance analysis:")
    print(topic_analysis)
    
    conn.close()
    return True


def load_parquet_streaming(parquet_file):
    """Demonstrate loading parquet file with streaming mode"""
    print(f"Loading parquet file with streaming: {parquet_file}")
    
    # Use lazy loading for streaming
    lazy_df = pl.scan_parquet(parquet_file)
    
    # Example streaming operations
    result = (
        lazy_df
        .select([
            "source_channel_id",
            "post_id",
            "post_type",
            "processed_at"
        ])
        .filter(pl.col("post_id").is_not_null())
        .collect(streaming=True)
    )
    
    print(f"Streamed {len(result)} rows")
    return result


def query_bronze_table(db_file):
    """Demonstrate querying DuckDB bronze table"""
    print(f"Querying DuckDB bronze table: {db_file}")
    
    conn = duckdb.connect(db_file)
    
    # 1. Basic aggregation by channel
    channel_stats = conn.execute("""
        SELECT 
            source_channel_id,
            COUNT(*) as post_count,
            COUNT(DISTINCT post_id) as unique_posts
        FROM bronze.posts_raw
        GROUP BY source_channel_id
        ORDER BY post_count DESC
        LIMIT 10
    """).pl()
    
    print("Top 10 channels by post count:")
    print(channel_stats)
    print()
    
    # 2. Posts with engagement data
    engagement_query = conn.execute("""
        SELECT 
            source_channel_id,
            post_id,
            attr_engagement_data_likes_count,
            attr_engagement_data_share_count,
            attr_engagement_data_comment_count,
            attr_published_at
        FROM bronze.posts_raw
        WHERE attr_engagement_data_likes_count IS NOT NULL 
        AND TRY_CAST(attr_engagement_data_likes_count AS INTEGER) > 0
        ORDER BY TRY_CAST(attr_engagement_data_likes_count AS INTEGER) DESC
        LIMIT 10
    """).pl()
    
    print("Top 10 posts by likes:")
    print(engagement_query)
    print()
    
    # 3. Recent posts analysis
    recent_posts = conn.execute("""
        SELECT 
            source_channel_id,
            COUNT(*) as recent_post_count,
            AVG(TRY_CAST(attr_engagement_data_likes_count AS INTEGER)) as avg_likes
        FROM bronze.posts_raw
        WHERE attr_published_at IS NOT NULL
        AND attr_published_at > '2025-06-20'
        AND attr_engagement_data_likes_count IS NOT NULL
        GROUP BY source_channel_id
        HAVING COUNT(*) > 1
        ORDER BY avg_likes DESC
    """).pl()
    
    print("Channels with recent posts (avg engagement):")
    print(recent_posts)
    
    conn.close()
    
    return {
        'channel_stats': channel_stats,
        'engagement_query': engagement_query, 
        'recent_posts': recent_posts
    }


def get_latest_duckdb_file():
    """Return the DuckDB database file"""
    return "./duckdatabase"


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "query":
        # Query DuckDB bronze table
        db_file = get_latest_duckdb_file()
        query_bronze_table(db_file)
    elif len(sys.argv) > 1 and sys.argv[1] == "silver":
        # Create silver tables
        create_silver_tables()
    elif len(sys.argv) > 1 and sys.argv[1] == "gold":
        # Create gold layer aggregations
        create_gold_tables()
    elif len(sys.argv) > 1 and sys.argv[1] == "text":
        # Create text analysis enrichments
        create_text_enrichments()
    else:
        # Process JSON to DuckDB
        db_file = process_posts_to_duckdb()
        
        if db_file:
            print("\nUsage options:")
            print("python process_posts.py query   # Query bronze table with DuckDB SQL")
            print("python process_posts.py silver  # Create silver layer tables")
            print("python process_posts.py gold    # Create gold layer aggregations")
            print("python process_posts.py text    # Create text analysis enrichments")
            print(f"\nBronze table location: {db_file}")
            print("Schema: bronze.posts_raw")