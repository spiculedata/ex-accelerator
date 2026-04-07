#!/usr/bin/env python3
"""
Bluesky ETL — Ingests crawler JSONL output into PostgreSQL medallion architecture.

Reads Bluesky Post JSONL files from the crawler's storage root and loads them
into silver.posts with proper types, then registers as a dataset.
"""

import json
import logging
import sys
import os
import argparse
from pathlib import Path
from datetime import datetime

import psycopg2
from psycopg2.extras import execute_values

from db_config import get_connection_context

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def find_jsonl_files(crawl_dir: str) -> list:
    """Find all JSONL/JSON files in crawl output directory."""
    crawl_path = Path(crawl_dir)
    files = []
    for ext in ['*.jsonl', '*.json']:
        files.extend(crawl_path.rglob(ext))
    # Also check for data.jsonl in subdirectories (crawler's output pattern)
    files.extend(crawl_path.rglob('data.jsonl'))
    return sorted(set(files))


def parse_post(line: str) -> dict | None:
    """Parse a single JSONL line into a normalized post dict."""
    try:
        post = json.loads(line.strip())
        if not post:
            return None

        # Handle nested structure (crawler may wrap in attributes)
        if 'attributes' in post:
            attrs = post['attributes']
            post_data = attrs.get('post_data', attrs)
        else:
            post_data = post

        # Extract core fields from unified Post model
        return {
            'post_id': post_data.get('post_uid') or post_data.get('PostUID') or post_data.get('id', ''),
            'source_channel_id': post_data.get('channel_id') or post_data.get('ChannelID') or post_data.get('handle') or post_data.get('Handle', ''),
            'post_type': ','.join(post_data.get('post_type') or post_data.get('PostType') or ['post']),
            'post_uid': post_data.get('post_uid') or post_data.get('PostUID', ''),
            'post_url': post_data.get('url') or post_data.get('URL', ''),
            'published_at': post_data.get('published_at') or post_data.get('PublishedAt', ''),
            'title': post_data.get('title') or post_data.get('Title', ''),
            'content': post_data.get('description') or post_data.get('Description') or post_data.get('content', ''),
            'description': post_data.get('description') or post_data.get('Description', ''),
            'language': post_data.get('language_code') or post_data.get('LanguageCode', ''),
            'likes_count': int(post_data.get('like_count') or post_data.get('LikeCount') or 0),
            'shares_count': int(post_data.get('share_count') or post_data.get('ShareCount') or 0),
            'comments_count': int(post_data.get('comment_count') or post_data.get('CommentCount') or 0),
            'views_count': int(post_data.get('view_count') or post_data.get('ViewCount') or 0),
            'media_type': 'bluesky',
        }
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        return None


def load_posts(crawl_dir: str) -> int:
    """Load Bluesky posts from JSONL files into silver.posts."""
    files = find_jsonl_files(crawl_dir)
    logger.info(f"Found {len(files)} JSONL files in {crawl_dir}")

    if not files:
        logger.warning("No JSONL files found")
        return 0

    total_loaded = 0
    batch = []
    batch_size = 1000

    for f in files:
        logger.info(f"Processing {f.name}...")
        try:
            with open(f) as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    post = parse_post(line)
                    if post and post['post_id']:
                        batch.append(post)

                    if len(batch) >= batch_size:
                        _insert_batch(batch)
                        total_loaded += len(batch)
                        batch = []
                        if total_loaded % 10000 == 0:
                            logger.info(f"Loaded {total_loaded:,} posts...")

        except Exception as e:
            logger.error(f"Error processing {f}: {e}")

    # Flush remaining
    if batch:
        _insert_batch(batch)
        total_loaded += len(batch)

    logger.info(f"Total: loaded {total_loaded:,} Bluesky posts into silver.posts")
    return total_loaded


def _insert_batch(posts: list):
    """Insert a batch of posts into silver.posts."""
    rows = [(
        p['post_id'], p['source_channel_id'], p['post_type'], p['post_uid'],
        p['post_url'], p['published_at'] or None, p['title'], p['content'],
        p['description'], p['language'],
        p['likes_count'], p['shares_count'], p['comments_count'], p['views_count'],
        p['media_type'], datetime.now().isoformat(), datetime.now()
    ) for p in posts]

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO silver.posts
                (post_id, source_channel_id, post_type, post_uid, post_url,
                 published_at, title, content, description, language,
                 likes_count, shares_count, comments_count, views_count,
                 media_type, processed_at, silver_created_at)
                VALUES %s
                ON CONFLICT (post_id) DO NOTHING
            """, rows)


def register_dataset(record_count: int):
    """Register Bluesky dataset in the catalog."""
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO datasets (name, description, dataset_type, source_platform, source_database,
                    schema_name, table_name, record_count, ingestion_method, status, visibility, created_by)
                VALUES (
                    'Bluesky Firehose',
                    'Real-time Bluesky social network posts from the AT Protocol firehose',
                    'social_media',
                    'bluesky',
                    'etl_postgres',
                    'silver',
                    'posts',
                    %s,
                    'crawler',
                    'available',
                    'public',
                    'bluesky_etl'
                )
                ON CONFLICT (name) DO UPDATE SET
                    record_count = %s,
                    last_updated = NOW()
            """, [record_count, record_count])
    logger.info(f"Registered Bluesky Firehose dataset ({record_count:,} records)")


def main():
    parser = argparse.ArgumentParser(description="Bluesky ETL — JSONL → PostgreSQL")
    parser.add_argument("--input", default="/data/crawls", help="Directory with crawler JSONL output")
    parser.add_argument("--crawl-id", help="Specific crawl ID subdirectory to process")
    args = parser.parse_args()

    crawl_dir = args.input
    if args.crawl_id:
        crawl_dir = os.path.join(args.input, args.crawl_id)

    logger.info(f"Bluesky ETL starting — input: {crawl_dir}")

    count = load_posts(crawl_dir)

    if count > 0:
        register_dataset(count)
        logger.info(f"Bluesky ETL complete: {count:,} posts loaded and registered")

        # Auto-run topic enrichment on new data
        logger.info("Running post-ingestion topic enrichment...")
        try:
            import subprocess
            result = subprocess.run(
                ["python", "nlp_topic_enrichment.py", "--topics", "12", "--language", "en", "--method", "auto"],
                capture_output=True, text=True, timeout=600
            )
            if result.returncode == 0:
                logger.info("Topic enrichment completed successfully")
            else:
                logger.warning(f"Topic enrichment failed: {result.stderr[-500:]}")
        except Exception as e:
            logger.warning(f"Topic enrichment error: {e}")
    else:
        logger.warning("No posts loaded — check input directory")


if __name__ == "__main__":
    main()
