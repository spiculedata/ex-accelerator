"""
Dataset Registration Script for Existing Data

This script registers all existing ingested datasets in the platform:
1. Social media data from Junkipedia API (Facebook posts)
2. GDELT global events data
3. All layers of the medallion architecture (Bronze, Silver, Gold)

Run this script after data ingestion to make datasets discoverable in workspaces.

Usage:
    python register_existing_datasets.py
"""

import psycopg2
from datetime import datetime
from dataset_registry import register_dataset, list_datasets
from db_config import get_connection_context

def get_table_stats(schema: str, table: str) -> dict:
    """Get basic statistics for a table"""
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Get row count
            cur.execute(f"SELECT COUNT(*) FROM {schema}.{table}")
            count = cur.fetchone()[0]

            return {
                'record_count': count,
                'schema': schema,
                'table': table
            }


def register_social_media_datasets():
    """Register social media datasets from Junkipedia ETL pipeline"""

    print("\n" + "=" * 60)
    print("Registering Social Media Datasets (Junkipedia/Facebook)")
    print("=" * 60)

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Get date ranges from silver.posts
            cur.execute("""
                SELECT
                    MIN(published_at) as date_start,
                    MAX(published_at) as date_end,
                    COUNT(DISTINCT source_channel_id) as unique_channels
                FROM silver.posts
                WHERE published_at IS NOT NULL
            """)
            date_info = cur.fetchone()
            date_start, date_end, unique_channels = date_info

            # Get account statistics
            cur.execute("SELECT COUNT(*) FROM silver.accounts")
            account_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM silver.posts")
            post_count = cur.fetchone()[0]

            # Get platform info
            cur.execute("SELECT DISTINCT platform FROM silver.accounts")
            platforms = [row[0] for row in cur.fetchall()]
            platform_str = ", ".join(platforms) if platforms else "Facebook"

    # 1. Bronze Layer - Raw Posts
    bronze_stats = get_table_stats('bronze', 'posts_raw')
    register_dataset(
        name="Facebook Posts Bronze - Raw API Data",
        description=f"Raw Facebook post data from Junkipedia API ingestion ({bronze_stats['record_count']:,} posts). Unprocessed data with all original API response fields preserved.",
        dataset_type="social_media",
        source_platform="facebook",
        table_name="posts_raw",
        schema_name="bronze",
        source_database="etl_postgres",
        crawl_id="facebook-junkipedia-bronze",
        record_count=bronze_stats['record_count'],
        date_range_start=date_start.isoformat() if date_start else None,
        date_range_end=date_end.isoformat() if date_end else None,
        ingestion_method="api",
        visibility="private",
        created_by="etl_system",
        metadata={
            "layer": "bronze",
            "data_quality": "raw",
            "api_source": "junkipedia",
            "unique_channels": unique_channels,
            "platforms": platforms
        },
        tags=["bronze", "raw", "facebook", "junkipedia", "social-media"]
    )

    # 2. Silver Layer - Cleaned Posts
    register_dataset(
        name="Facebook Posts Silver - Cleaned & Normalized",
        description=f"Cleaned and normalized Facebook posts with engagement metrics ({post_count:,} posts from {account_count} accounts). Includes likes, shares, comments, reactions, and content data.",
        dataset_type="social_media",
        source_platform="facebook",
        table_name="posts",
        schema_name="silver",
        source_database="etl_postgres",
        crawl_id="facebook-junkipedia-silver",
        record_count=post_count,
        date_range_start=date_start.isoformat() if date_start else None,
        date_range_end=date_end.isoformat() if date_end else None,
        ingestion_method="etl",
        visibility="private",
        created_by="etl_system",
        metadata={
            "layer": "silver",
            "data_quality": "cleaned",
            "unique_channels": unique_channels,
            "has_engagement_metrics": True,
            "has_reactions": True,
            "has_content": True,
            "platforms": platforms
        },
        tags=["silver", "posts", "facebook", "engagement", "cleaned"]
    )

    # 3. Silver Layer - Account Profiles
    register_dataset(
        name="Facebook Account Profiles Silver",
        description=f"Facebook account profiles and metadata ({account_count} accounts). Includes follower counts, verification status, account types, and profile information.",
        dataset_type="social_media",
        source_platform="facebook",
        table_name="accounts",
        schema_name="silver",
        source_database="etl_postgres",
        crawl_id="facebook-junkipedia-silver",
        record_count=account_count,
        ingestion_method="etl",
        visibility="private",
        created_by="etl_system",
        metadata={
            "layer": "silver",
            "data_quality": "cleaned",
            "has_follower_counts": True,
            "has_verification_status": True,
            "has_engagement_metrics": True,
            "platforms": platforms
        },
        tags=["silver", "accounts", "facebook", "profiles", "metadata"]
    )

    # 4. Silver Layer - Text Analysis
    text_stats = get_table_stats('silver', 'posts_text_analysis')
    if text_stats['record_count'] > 0:
        register_dataset(
            name="Facebook Posts Text Analysis Silver",
            description=f"Natural language processing analysis of Facebook posts ({text_stats['record_count']:,} analyzed posts). Includes sentiment scores, language detection, and text features.",
            dataset_type="analytics",
            source_platform="facebook",
            table_name="posts_text_analysis",
            schema_name="silver",
            source_database="etl_postgres",
            crawl_id="facebook-junkipedia-nlp",
            record_count=text_stats['record_count'],
            date_range_start=date_start.isoformat() if date_start else None,
            date_range_end=date_end.isoformat() if date_end else None,
            ingestion_method="etl",
            visibility="private",
            created_by="etl_system",
            metadata={
                "layer": "silver",
                "analysis_type": "nlp",
                "has_sentiment": True,
                "has_language": True,
                "platforms": platforms
            },
            tags=["silver", "text-analysis", "nlp", "sentiment", "facebook"]
        )

    # 5. Gold Layer - Account Engagement Metrics
    gold_accounts_stats = get_table_stats('gold', 'account_engagement_metrics')
    if gold_accounts_stats['record_count'] > 0:
        register_dataset(
            name="Account Engagement Metrics Gold",
            description=f"Aggregated engagement metrics per account ({gold_accounts_stats['record_count']:,} accounts). Includes posting frequency, average engagement rates, best performing content, and growth trends.",
            dataset_type="analytics",
            source_platform="facebook",
            table_name="account_engagement_metrics",
            schema_name="gold",
            source_database="etl_postgres",
            crawl_id="facebook-junkipedia-gold",
            record_count=gold_accounts_stats['record_count'],
            ingestion_method="etl",
            visibility="private",
            created_by="etl_system",
            metadata={
                "layer": "gold",
                "aggregation_level": "account",
                "metrics": ["engagement", "volume", "rates", "trends"],
                "time_periods": ["7d", "30d", "all"],
                "platforms": platforms
            },
            tags=["gold", "metrics", "engagement", "accounts", "aggregated"]
        )

    # 6. Gold Layer - Daily Engagement Trends
    gold_daily_stats = get_table_stats('gold', 'daily_engagement_trends')
    if gold_daily_stats['record_count'] > 0:
        register_dataset(
            name="Daily Engagement Trends Gold",
            description=f"Time series of daily engagement patterns ({gold_daily_stats['record_count']:,} daily records). Track posting volume, engagement rates, and content performance over time.",
            dataset_type="analytics",
            source_platform="facebook",
            table_name="daily_engagement_trends",
            schema_name="gold",
            source_database="etl_postgres",
            crawl_id="facebook-junkipedia-gold",
            record_count=gold_daily_stats['record_count'],
            date_range_start=date_start.isoformat() if date_start else None,
            date_range_end=date_end.isoformat() if date_end else None,
            ingestion_method="etl",
            visibility="private",
            created_by="etl_system",
            metadata={
                "layer": "gold",
                "aggregation_level": "daily",
                "metrics": ["engagement", "trends", "volume"],
                "has_day_of_week_analysis": True,
                "platforms": platforms
            },
            tags=["gold", "trends", "daily", "time-series", "engagement"]
        )

    print(f"✓ Registered {6} social media datasets")


def register_gdelt_datasets():
    """Register GDELT global events datasets"""

    print("\n" + "=" * 60)
    print("Registering GDELT Global Events Datasets")
    print("=" * 60)

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Get GDELT events statistics
            cur.execute("""
                SELECT
                    MIN(sqldate) as date_start,
                    MAX(sqldate) as date_end,
                    COUNT(DISTINCT actor1countrycode) as unique_countries,
                    COUNT(DISTINCT eventcode) as unique_event_types,
                    COUNT(*) as total_events
                FROM public.gdelt_events
            """)
            events_info = cur.fetchone()
            date_start_int, date_end_int, countries, event_types, total_events = events_info

            # Convert YYYYMMDD integer to datetime
            date_start = datetime.strptime(str(date_start_int), '%Y%m%d')
            date_end = datetime.strptime(str(date_end_int), '%Y%m%d')

            # Get GDELT mentions statistics
            cur.execute("SELECT COUNT(*) FROM public.gdelt_mentions")
            mentions_count = cur.fetchone()[0]

            # Get GDELT GKG statistics
            cur.execute("SELECT COUNT(*) FROM public.gdelt_gkg")
            gkg_count = cur.fetchone()[0]

    # 1. GDELT Events
    register_dataset(
        name=f"GDELT Global Events 2015-2025",
        description=f"GDELT global events database ({total_events:,} events) covering {countries} countries and {event_types} event types from January 2015 to July 2025. Comprehensive record of global political, social, and conflict events with actor identification, geographic data, and tone analysis.",
        dataset_type="gdelt_events",
        source_platform="gdelt",
        table_name="gdelt_events",
        schema_name="public",
        source_database="etl_postgres",
        crawl_id="gdelt-events-2015-2025",
        record_count=total_events,
        date_range_start=date_start.isoformat(),
        date_range_end=date_end.isoformat(),
        ingestion_method="api",
        visibility="public",
        created_by="etl_system",
        metadata={
            "data_source": "GDELT Project",
            "unique_countries": countries,
            "unique_event_types": event_types,
            "coverage_years": 10,
            "has_actor_data": True,
            "has_geographic_data": True,
            "has_tone_analysis": True,
            "has_goldstein_scale": True,
            "event_codes": "CAMEO event taxonomy",
            "data_url": "https://www.gdeltproject.org/"
        },
        tags=["gdelt", "events", "global", "politics", "conflicts", "geopolitics", "2015-2025"]
    )

    # 2. GDELT Mentions
    register_dataset(
        name=f"GDELT Event Mentions 2015-2025",
        description=f"GDELT event mentions database ({mentions_count:,} mentions). Each mention represents a specific reference to an event in news media, including source metadata and confidence scores. Enables media coverage analysis and source attribution.",
        dataset_type="gdelt_mentions",
        source_platform="gdelt",
        table_name="gdelt_mentions",
        schema_name="public",
        source_database="etl_postgres",
        crawl_id="gdelt-mentions-2015-2025",
        record_count=mentions_count,
        date_range_start=date_start.isoformat(),
        date_range_end=date_end.isoformat(),
        ingestion_method="api",
        visibility="public",
        created_by="etl_system",
        metadata={
            "data_source": "GDELT Project",
            "linked_to": "gdelt_events",
            "has_source_data": True,
            "has_confidence_scores": True,
            "enables_media_analysis": True
        },
        tags=["gdelt", "mentions", "media", "sources", "coverage", "2015-2025"]
    )

    # 3. GDELT Global Knowledge Graph (GKG)
    register_dataset(
        name=f"GDELT Global Knowledge Graph 2015-2025",
        description=f"GDELT Global Knowledge Graph ({gkg_count:,} records). Advanced entity extraction, themes, locations, persons, organizations, and emotional tone from global news. Enables network analysis, theme tracking, and entity relationship mapping.",
        dataset_type="gdelt_gkg",
        source_platform="gdelt",
        table_name="gdelt_gkg",
        schema_name="public",
        source_database="etl_postgres",
        crawl_id="gdelt-gkg-2015-2025",
        record_count=gkg_count,
        date_range_start=date_start.isoformat(),
        date_range_end=date_end.isoformat(),
        ingestion_method="api",
        visibility="public",
        created_by="etl_system",
        metadata={
            "data_source": "GDELT Project",
            "has_entity_extraction": True,
            "has_themes": True,
            "has_locations": True,
            "has_persons": True,
            "has_organizations": True,
            "has_tone_analysis": True,
            "has_gcam_scores": True,
            "enables_network_analysis": True
        },
        tags=["gdelt", "gkg", "knowledge-graph", "entities", "themes", "network-analysis", "2015-2025"]
    )

    print(f"✓ Registered 3 GDELT datasets")


def main():
    """Main function to register all existing datasets"""

    print("=" * 60)
    print("Dataset Registration for Existing Ingested Data")
    print("=" * 60)
    print()
    print("This script will register all existing datasets in the platform:")
    print("  1. Social media data (Facebook via Junkipedia)")
    print("  2. GDELT global events data")
    print("  3. All layers: Bronze (raw), Silver (cleaned), Gold (aggregated)")
    print()

    # Test database connection
    print("Testing database connection...")
    try:
        from dataset_registry import test_connection
        if not test_connection():
            print("\n❌ Database connection failed. Please check your configuration.")
            return
    except Exception as e:
        print(f"\n❌ Connection test failed: {e}")
        return

    print("\n" + "=" * 60)
    print("Starting Dataset Registration")
    print("=" * 60)

    try:
        # Register social media datasets
        register_social_media_datasets()

        # Register GDELT datasets
        register_gdelt_datasets()

        print("\n" + "=" * 60)
        print("Dataset Registration Complete!")
        print("=" * 60)

        # Show summary
        print("\nRegistered Datasets Summary:")
        print("-" * 60)
        datasets = list_datasets()

        dataset_types = {}
        total_records = 0

        for ds in datasets:
            ds_type = ds['dataset_type']
            if ds_type not in dataset_types:
                dataset_types[ds_type] = {'count': 0, 'records': 0}
            dataset_types[ds_type]['count'] += 1
            dataset_types[ds_type]['records'] += ds['record_count']
            total_records += ds['record_count']

        print(f"\nTotal Datasets: {len(datasets)}")
        print(f"Total Records: {total_records:,}")
        print("\nBy Type:")
        for ds_type, stats in dataset_types.items():
            print(f"  - {ds_type}: {stats['count']} datasets ({stats['records']:,} records)")

        print("\nDatasets are now available in workspaces!")
        print("Navigate to the UI to create workspaces and link these datasets.")

    except Exception as e:
        print(f"\n❌ Error during registration: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
