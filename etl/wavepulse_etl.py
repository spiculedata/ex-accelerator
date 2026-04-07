#!/usr/bin/env python3
"""
WavePulse → PostgreSQL ETL
Reads classified transcripts from WavePulse output and inserts into PostgreSQL.
Also registers the Radio Transcripts dataset in the catalog.
"""

import json
import logging
import sys
from pathlib import Path
from datetime import datetime

import psycopg2
from psycopg2.extras import execute_values
from db_config import get_connection_context

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def create_schema():
    """Create radio transcripts table."""
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS radio_transcripts (
                    id SERIAL PRIMARY KEY,
                    radio_name VARCHAR NOT NULL,
                    state VARCHAR,
                    segment_start TIMESTAMP NOT NULL,
                    segment_end TIMESTAMP NOT NULL,
                    duration_seconds INTEGER,
                    transcript TEXT,
                    is_political BOOLEAN,
                    is_ad BOOLEAN,
                    sentiment VARCHAR,
                    emotion VARCHAR,
                    confidence DOUBLE PRECISION,
                    source_url VARCHAR,
                    created_at TIMESTAMP DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_radio_transcripts_date ON radio_transcripts(segment_start);
                CREATE INDEX IF NOT EXISTS idx_radio_transcripts_station ON radio_transcripts(radio_name);
            """)
    logger.info("Radio transcripts schema created")


def register_dataset():
    """Register Radio Transcripts as a dataset in the catalog."""
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO datasets (name, description, dataset_type, source_platform, source_database,
                    schema_name, table_name, ingestion_method, status, visibility, created_by)
                VALUES (
                    'Radio Transcripts',
                    'Live radio stream transcripts with political classification, sentiment, and emotion analysis',
                    'radio',
                    'radio',
                    'etl_postgres',
                    'public',
                    'radio_transcripts',
                    'crawler',
                    'available',
                    'public',
                    'wavepulse_etl'
                )
                ON CONFLICT (name) DO UPDATE SET
                    last_updated = NOW(),
                    record_count = (SELECT COUNT(*) FROM radio_transcripts)
            """)
    logger.info("Radio Transcripts dataset registered")


def load_transcripts(transcripts_dir: str = '/app/data/transcripts'):
    """Load transcript JSON files into PostgreSQL."""
    dir_path = Path(transcripts_dir)
    if not dir_path.exists():
        logger.warning(f"Transcripts directory not found: {transcripts_dir}")
        return 0

    json_files = list(dir_path.glob('*.json'))
    logger.info(f"Found {len(json_files)} transcript files")

    if not json_files:
        return 0

    rows = []
    for f in json_files:
        try:
            data = json.loads(f.read_text())
            rows.append((
                data.get('radio_name', 'Unknown'),
                data.get('state', ''),
                data.get('segment_start', datetime.now().isoformat()),
                data.get('segment_end', datetime.now().isoformat()),
                data.get('duration', 0),
                data.get('text', ''),
                data.get('is_political', None),
                data.get('is_ad', None),
                data.get('sentiment', None),
                data.get('emotion', None),
                data.get('confidence', None),
                data.get('source_url', ''),
            ))
        except Exception as e:
            logger.error(f"Error reading {f}: {e}")

    if rows:
        with get_connection_context() as conn:
            with conn.cursor() as cur:
                execute_values(cur, """
                    INSERT INTO radio_transcripts
                    (radio_name, state, segment_start, segment_end, duration_seconds,
                     transcript, is_political, is_ad, sentiment, emotion, confidence, source_url)
                    VALUES %s
                """, rows)

    logger.info(f"Loaded {len(rows)} transcripts into PostgreSQL")

    # Update dataset record count
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE datasets SET
                    record_count = (SELECT COUNT(*) FROM radio_transcripts),
                    last_updated = NOW()
                WHERE name = 'Radio Transcripts'
            """)

    return len(rows)


def main():
    create_schema()
    register_dataset()
    count = load_transcripts()
    logger.info(f"WavePulse ETL complete: {count} transcripts loaded")


if __name__ == '__main__':
    main()
