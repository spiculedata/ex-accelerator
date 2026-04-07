#!/usr/bin/env python3
"""
Topic Modeling & Language Detection ETL Pipeline (PostgreSQL)

Extracts topics from:
  - GDELT GKG themes (structured taxonomy)
  - Social media posts (TF-IDF + clustering)

Detects languages from:
  - Social media post content (langdetect)
  - GDELT GKG translation info

All processing is deterministic and ETL-driven (no LLM).
"""

import logging
import sys
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import re

import psycopg2
from psycopg2.extras import execute_values

from db_config import get_connection_context

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('topic_language_etl.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


# ─── GDELT CAMEO Theme Taxonomy ──────────────────────────────────────────────
# Map raw GKG theme prefixes to human-readable categories
THEME_CATEGORIES = {
    'ARMEDCONFLICT': ('Armed Conflict', 'Security & Conflict', '#ef4444'),
    'TERROR': ('Terrorism', 'Security & Conflict', '#ef4444'),
    'PROTEST': ('Protests', 'Social Unrest', '#f97316'),
    'UNREST': ('Civil Unrest', 'Social Unrest', '#f97316'),
    'CRISISLEX': ('Crisis Events', 'Crisis & Disaster', '#dc2626'),
    'NATURAL_DISASTER': ('Natural Disasters', 'Crisis & Disaster', '#dc2626'),
    'FAMINE': ('Famine & Food', 'Crisis & Disaster', '#dc2626'),
    'DISEASE': ('Disease & Health', 'Health', '#10b981'),
    'HEALTH': ('Health', 'Health', '#10b981'),
    'WB_470_EDUCATION': ('Education', 'Society', '#3b82f6'),
    'WB_2670_JOBS': ('Employment', 'Economy', '#8b5cf6'),
    'WB_2131_EMPLOYABILITY': ('Employability', 'Economy', '#8b5cf6'),
    'TAX_': ('Taxation & Finance', 'Economy', '#8b5cf6'),
    'ECON_': ('Economics', 'Economy', '#8b5cf6'),
    'EPU_': ('Economic Policy', 'Economy', '#8b5cf6'),
    'ENV_': ('Environment', 'Environment', '#22c55e'),
    'UNGP_FORESTS': ('Forests & Nature', 'Environment', '#22c55e'),
    'CLIMATE': ('Climate Change', 'Environment', '#22c55e'),
    'MIGRATION': ('Migration', 'Society', '#3b82f6'),
    'REFUGEES': ('Refugees', 'Society', '#3b82f6'),
    'ELECTION': ('Elections', 'Politics', '#6366f1'),
    'GOVERN': ('Governance', 'Politics', '#6366f1'),
    'USPEC_POLITICS': ('Politics', 'Politics', '#6366f1'),
    'MEDIA_': ('Media', 'Media & Tech', '#06b6d4'),
    'CYBER': ('Cybersecurity', 'Media & Tech', '#06b6d4'),
    'GEN_HOLIDAY': ('Holidays & Culture', 'Culture', '#ec4899'),
    'SPORT': ('Sports', 'Culture', '#ec4899'),
    'RELIGION': ('Religion', 'Culture', '#ec4899'),
    'HUMAN_RIGHTS': ('Human Rights', 'Society', '#3b82f6'),
    'GENDER': ('Gender Issues', 'Society', '#3b82f6'),
    'CHILD': ('Children & Youth', 'Society', '#3b82f6'),
    'CORRUPTION': ('Corruption', 'Governance', '#6366f1'),
    'TRADE': ('Trade', 'Economy', '#8b5cf6'),
    'ENERGY': ('Energy', 'Economy', '#8b5cf6'),
    'INFRASTRUCTURE': ('Infrastructure', 'Economy', '#8b5cf6'),
    'WB_135_TRANSPORT': ('Transport', 'Economy', '#8b5cf6'),
    'SCIENCE': ('Science', 'Media & Tech', '#06b6d4'),
    'SPACE': ('Space', 'Media & Tech', '#06b6d4'),
}

# Category color map
CATEGORY_COLORS = {
    'Security & Conflict': '#ef4444',
    'Social Unrest': '#f97316',
    'Crisis & Disaster': '#dc2626',
    'Health': '#10b981',
    'Society': '#3b82f6',
    'Economy': '#8b5cf6',
    'Environment': '#22c55e',
    'Politics': '#6366f1',
    'Media & Tech': '#06b6d4',
    'Culture': '#ec4899',
    'Governance': '#6366f1',
    'General': '#94a3b8',
}

# Simple keyword-based topic detection for social posts
SOCIAL_TOPIC_KEYWORDS = {
    'Economy & Jobs': ['economy', 'economic', 'jobs', 'employment', 'growth', 'invest', 'billion', 'budget', 'tax', 'trade', 'business', 'market'],
    'Education': ['education', 'school', 'university', 'students', 'learning', 'teachers', 'curriculum'],
    'Healthcare': ['health', 'nhs', 'hospital', 'medical', 'care', 'mental health', 'vaccine'],
    'Housing & Infrastructure': ['housing', 'homes', 'building', 'transport', 'infrastructure', 'roads', 'railway'],
    'Energy & Environment': ['energy', 'climate', 'green', 'renewable', 'nuclear', 'environment', 'carbon'],
    'Social Policy': ['poverty', 'welfare', 'pension', 'benefits', 'meals', 'children', 'families', 'inequality'],
    'Security & Defence': ['security', 'defence', 'military', 'police', 'crime', 'safety'],
    'Politics & Governance': ['government', 'parliament', 'labour', 'conservative', 'policy', 'reform', 'vote', 'election'],
    'Community & Culture': ['community', 'festival', 'culture', 'sport', 'volunteer', 'local', 'charity'],
    'Technology': ['technology', 'digital', 'ai', 'data', 'innovation', 'cyber', 'internet'],
}


def create_schema():
    """Create topics and languages tables"""
    schema_sql = """
    -- Topics table
    CREATE TABLE IF NOT EXISTS topics (
        topic_id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        category VARCHAR NOT NULL,
        category_color VARCHAR DEFAULT '#94a3b8',
        size INTEGER DEFAULT 0,
        weight DOUBLE PRECISION DEFAULT 0.0,
        coherence_score DOUBLE PRECISION DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Topic keywords
    CREATE TABLE IF NOT EXISTS topic_keywords (
        id SERIAL PRIMARY KEY,
        topic_id VARCHAR REFERENCES topics(topic_id) ON DELETE CASCADE,
        keyword VARCHAR NOT NULL,
        weight DOUBLE PRECISION DEFAULT 0.0,
        rank_position INTEGER DEFAULT 0
    );

    -- Document-topic assignments
    CREATE TABLE IF NOT EXISTS document_topics (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR NOT NULL,
        document_source VARCHAR NOT NULL DEFAULT 'social',
        topic_id VARCHAR REFERENCES topics(topic_id) ON DELETE CASCADE,
        relevance_score DOUBLE PRECISION DEFAULT 0.0,
        assigned_at TIMESTAMP DEFAULT NOW()
    );

    -- Topic trends over time
    CREATE TABLE IF NOT EXISTS topic_trends (
        id SERIAL PRIMARY KEY,
        topic_id VARCHAR REFERENCES topics(topic_id) ON DELETE CASCADE,
        analysis_date DATE NOT NULL,
        document_count INTEGER DEFAULT 0,
        average_engagement DOUBLE PRECISION DEFAULT 0.0,
        growth_rate DOUBLE PRECISION DEFAULT 0.0,
        trend_direction VARCHAR DEFAULT 'stable'
    );

    -- Topic relationships (co-occurrence)
    CREATE TABLE IF NOT EXISTS topic_relationships (
        id SERIAL PRIMARY KEY,
        topic1_id VARCHAR REFERENCES topics(topic_id) ON DELETE CASCADE,
        topic2_id VARCHAR REFERENCES topics(topic_id) ON DELETE CASCADE,
        similarity_score DOUBLE PRECISION DEFAULT 0.0,
        relationship_type VARCHAR DEFAULT 'co-occurrence',
        strength VARCHAR DEFAULT 'moderate'
    );

    -- Language detection results
    CREATE TABLE IF NOT EXISTS languages (
        id SERIAL PRIMARY KEY,
        code VARCHAR NOT NULL,
        name VARCHAR NOT NULL,
        UNIQUE(code)
    );

    CREATE TABLE IF NOT EXISTS language_detection (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR NOT NULL,
        document_source VARCHAR NOT NULL DEFAULT 'social',
        language_code VARCHAR NOT NULL,
        confidence DOUBLE PRECISION DEFAULT 0.0,
        detected_at TIMESTAMP DEFAULT NOW()
    );

    -- Language trends
    CREATE TABLE IF NOT EXISTS language_trends (
        id SERIAL PRIMARY KEY,
        language_code VARCHAR NOT NULL,
        analysis_date DATE NOT NULL,
        document_count INTEGER DEFAULT 0,
        avg_confidence DOUBLE PRECISION DEFAULT 0.0
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_topic_keywords_topic ON topic_keywords(topic_id);
    CREATE INDEX IF NOT EXISTS idx_document_topics_doc ON document_topics(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_topics_topic ON document_topics(topic_id);
    CREATE INDEX IF NOT EXISTS idx_topic_trends_date ON topic_trends(analysis_date);
    CREATE INDEX IF NOT EXISTS idx_language_detection_doc ON language_detection(document_id);
    CREATE INDEX IF NOT EXISTS idx_language_trends_date ON language_trends(analysis_date);
    """

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute(schema_sql)
    logger.info("Schema created successfully")


def clear_existing_data():
    """Clear existing topic and language data for a clean re-run"""
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM topic_relationships")
            cur.execute("DELETE FROM topic_trends")
            cur.execute("DELETE FROM document_topics")
            cur.execute("DELETE FROM topic_keywords")
            cur.execute("DELETE FROM topics")
            cur.execute("DELETE FROM language_trends")
            cur.execute("DELETE FROM language_detection")
            cur.execute("DELETE FROM languages")
    logger.info("Cleared existing topic and language data")


# ─── Topic Extraction from GDELT GKG ─────────────────────────────────────────

def classify_theme(theme: str) -> Optional[Tuple[str, str, str]]:
    """Classify a GKG theme into a topic category. Returns (topic_name, category, color) or None."""
    theme_upper = theme.upper().strip()
    for prefix, (name, category, color) in THEME_CATEGORIES.items():
        if theme_upper.startswith(prefix):
            return (name, category, color)
    return None


def extract_gdelt_topics():
    """Extract topic counts from GDELT GKG themes using batched server-side cursor"""
    logger.info("Extracting topics from GDELT GKG themes (counting pass)...")

    theme_counts: Counter = Counter()
    theme_doc_counts: Counter = Counter()
    theme_cooccurrence: Counter = Counter()

    batch_size = 50000
    total_processed = 0

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM gdelt_gkg WHERE themes IS NOT NULL")
            total_rows = cur.fetchone()[0]
            logger.info(f"Total GKG records with themes: {total_rows:,}")

    with get_connection_context() as conn:
        with conn.cursor(name='gkg_count_cursor') as cur:
            cur.itersize = batch_size
            cur.execute("SELECT themes FROM gdelt_gkg WHERE themes IS NOT NULL")

            while True:
                rows = cur.fetchmany(batch_size)
                if not rows:
                    break

                for (themes_raw,) in rows:
                    themes = set()
                    if themes_raw:
                        for t in themes_raw.split(';'):
                            t = t.strip()
                            if t:
                                classified = classify_theme(t)
                                if classified:
                                    themes.add(classified[0])
                                    theme_counts[classified[0]] += 1

                    for t in themes:
                        theme_doc_counts[t] += 1

                    # Track co-occurrence (cap per-doc to limit memory)
                    theme_list = sorted(themes)
                    if len(theme_list) >= 2:
                        for i in range(min(len(theme_list), 5)):
                            for j in range(i + 1, min(len(theme_list), 5)):
                                theme_cooccurrence[(theme_list[i], theme_list[j])] += 1

                total_processed += len(rows)
                if total_processed % 500000 == 0:
                    logger.info(f"Counted {total_processed:,}/{total_rows:,} GKG records...")

    logger.info(f"Counted {total_processed:,} GKG records, found {len(theme_counts)} unique topics")
    return theme_counts, theme_doc_counts, theme_cooccurrence


def populate_gdelt_doc_topics():
    """Second pass: insert GDELT document-topic assignments in batches (topics must exist first)"""
    logger.info("Populating GDELT document-topic assignments (batch insert pass)...")

    batch_size = 50000
    total_inserted = 0

    # Get existing topic IDs
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT topic_id FROM topics")
            existing_topics = {r[0] for r in cur.fetchall()}

    insert_batch: List[tuple] = []

    with get_connection_context() as conn:
        with conn.cursor(name='gkg_insert_cursor') as cur:
            cur.itersize = batch_size
            cur.execute("SELECT gkgrecordid, themes FROM gdelt_gkg WHERE themes IS NOT NULL")

            while True:
                rows = cur.fetchmany(batch_size)
                if not rows:
                    break

                for gkgid, themes_raw in rows:
                    if themes_raw:
                        seen = set()
                        for t in themes_raw.split(';'):
                            t = t.strip()
                            if t:
                                classified = classify_theme(t)
                                if classified and classified[0] not in seen:
                                    seen.add(classified[0])
                                    topic_id = f"gdelt_{re.sub(r'[^a-z0-9]', '_', classified[0].lower())}"
                                    if topic_id in existing_topics:
                                        insert_batch.append((gkgid, 'gdelt_gkg', topic_id, 0.8))

                # Flush periodically
                if len(insert_batch) >= 100000:
                    _flush_insert_batch(insert_batch)
                    total_inserted += len(insert_batch)
                    insert_batch = []
                    if total_inserted % 500000 == 0:
                        logger.info(f"Inserted {total_inserted:,} GDELT doc-topic assignments...")

    # Flush remaining
    if insert_batch:
        _flush_insert_batch(insert_batch)
        total_inserted += len(insert_batch)

    logger.info(f"Inserted {total_inserted:,} GDELT document-topic assignments")


def _flush_insert_batch(batch: List[tuple]):
    """Insert document-topic assignments in bulk"""
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            for i in range(0, len(batch), 10000):
                chunk = batch[i:i+10000]
                execute_values(cur, """
                    INSERT INTO document_topics (document_id, document_source, topic_id, relevance_score)
                    VALUES %s
                """, chunk)


def extract_social_topics():
    """Extract topics from social media posts using keyword matching"""
    logger.info("Extracting topics from social media posts...")

    post_topics: Dict[str, List[str]] = {}
    topic_counts: Counter = Counter()

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT post_id, content FROM silver.posts WHERE content IS NOT NULL AND content != ''")
            rows = cur.fetchall()

    logger.info(f"Processing {len(rows)} social posts for topics...")

    for post_id, content in rows:
        content_lower = content.lower()
        matched_topics = []

        for topic_name, keywords in SOCIAL_TOPIC_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in content_lower)
            if score >= 2:  # require at least 2 keyword hits
                matched_topics.append((topic_name, score / len(keywords)))
                topic_counts[topic_name] += 1

        if matched_topics:
            post_topics[post_id] = [t[0] for t in matched_topics]

    logger.info(f"Matched {sum(topic_counts.values())} topic assignments across {len(post_topics)} posts")
    return topic_counts, post_topics


def populate_topics(gdelt_theme_counts, gdelt_doc_counts, social_topic_counts):
    """Insert topics into the database"""
    logger.info("Populating topics table...")

    topics = {}

    # GDELT-sourced topics
    for theme_name, count in gdelt_theme_counts.most_common():
        classified = None
        for prefix, (name, category, color) in THEME_CATEGORIES.items():
            if name == theme_name:
                classified = (name, category, color)
                break
        if classified:
            topic_id = f"gdelt_{re.sub(r'[^a-z0-9]', '_', theme_name.lower())}"
            doc_count = gdelt_doc_counts.get(theme_name, 0)
            coherence = min(1.0, doc_count / max(1, sum(gdelt_doc_counts.values())) * 10)
            topics[topic_id] = {
                'name': classified[0],
                'category': classified[1],
                'category_color': classified[2],
                'size': count,
                'weight': count / max(1, sum(gdelt_theme_counts.values())),
                'coherence_score': round(coherence, 3)
            }

    # Social media topics
    for topic_name, count in social_topic_counts.most_common():
        topic_id = f"social_{re.sub(r'[^a-z0-9]', '_', topic_name.lower())}"
        category = 'General'
        color = '#94a3b8'
        # Map to existing categories
        for cat_name, cat_color in CATEGORY_COLORS.items():
            if cat_name.lower() in topic_name.lower():
                category = cat_name
                color = cat_color
                break
        topics[topic_id] = {
            'name': topic_name,
            'category': category,
            'category_color': color,
            'size': count,
            'weight': count / max(1, sum(social_topic_counts.values())),
            'coherence_score': round(min(1.0, count / 10), 3)
        }

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            data = [(
                tid,
                t['name'], t['category'], t['category_color'],
                t['size'], t['weight'], t['coherence_score']
            ) for tid, t in topics.items()]

            execute_values(cur, """
                INSERT INTO topics (topic_id, name, category, category_color, size, weight, coherence_score)
                VALUES %s
            """, data)

    logger.info(f"Inserted {len(topics)} topics")
    return topics


def populate_topic_keywords(gdelt_theme_counts):
    """Generate keywords for each topic based on theme co-occurrence"""
    logger.info("Populating topic keywords...")

    keywords_data = []

    # For GDELT topics, extract keywords from the theme taxonomy
    gdelt_keyword_map = {
        'Armed Conflict': ['conflict', 'war', 'military', 'attack', 'violence', 'weapon', 'army', 'battle'],
        'Terrorism': ['terror', 'extremism', 'attack', 'bomb', 'militant', 'threat', 'security'],
        'Protests': ['protest', 'demonstration', 'rally', 'march', 'activists', 'movement'],
        'Civil Unrest': ['unrest', 'riot', 'crackdown', 'violence', 'tension', 'disorder'],
        'Crisis Events': ['crisis', 'emergency', 'disaster', 'response', 'relief', 'aid'],
        'Natural Disasters': ['earthquake', 'flood', 'hurricane', 'storm', 'wildfire', 'disaster'],
        'Health': ['health', 'disease', 'medical', 'hospital', 'treatment', 'outbreak'],
        'Education': ['education', 'school', 'university', 'student', 'learning', 'teacher'],
        'Employment': ['jobs', 'employment', 'workforce', 'labor', 'hiring', 'unemployment'],
        'Economics': ['economy', 'gdp', 'growth', 'inflation', 'market', 'trade'],
        'Economic Policy': ['policy', 'regulation', 'fiscal', 'monetary', 'reform'],
        'Environment': ['environment', 'climate', 'pollution', 'conservation', 'emissions'],
        'Climate Change': ['climate', 'warming', 'carbon', 'emissions', 'renewable'],
        'Migration': ['migration', 'immigrant', 'refugee', 'border', 'asylum', 'displacement'],
        'Elections': ['election', 'vote', 'ballot', 'candidate', 'campaign', 'democracy'],
        'Politics': ['politics', 'government', 'parliament', 'legislation', 'policy'],
        'Governance': ['governance', 'administration', 'regulation', 'oversight', 'accountability'],
        'Corruption': ['corruption', 'bribery', 'fraud', 'scandal', 'misconduct'],
        'Human Rights': ['rights', 'freedom', 'justice', 'equality', 'dignity'],
        'Trade': ['trade', 'tariff', 'export', 'import', 'commerce'],
        'Energy': ['energy', 'oil', 'gas', 'solar', 'nuclear', 'power'],
        'Transport': ['transport', 'railway', 'highway', 'aviation', 'shipping'],
        'Infrastructure': ['infrastructure', 'construction', 'bridge', 'road', 'network'],
    }

    # Social topic keywords
    for topic_name, keywords in SOCIAL_TOPIC_KEYWORDS.items():
        topic_id = f"social_{re.sub(r'[^a-z0-9]', '_', topic_name.lower())}"
        for rank, kw in enumerate(keywords[:10]):
            weight = 1.0 - (rank * 0.08)
            keywords_data.append((topic_id, kw, round(weight, 3), rank + 1))

    # GDELT topic keywords
    for topic_name, keywords in gdelt_keyword_map.items():
        topic_id = f"gdelt_{re.sub(r'[^a-z0-9]', '_', topic_name.lower())}"
        for rank, kw in enumerate(keywords[:10]):
            weight = 1.0 - (rank * 0.08)
            keywords_data.append((topic_id, kw, round(weight, 3), rank + 1))

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Only insert for topics that exist
            cur.execute("SELECT topic_id FROM topics")
            existing = {r[0] for r in cur.fetchall()}
            keywords_data = [kw for kw in keywords_data if kw[0] in existing]

            execute_values(cur, """
                INSERT INTO topic_keywords (topic_id, keyword, weight, rank_position)
                VALUES %s
            """, keywords_data)

    logger.info(f"Inserted {len(keywords_data)} topic keywords")


def populate_document_topics(social_post_topics):
    """Assign social media documents to topics (GDELT docs are flushed during extraction)"""
    logger.info("Populating social media document-topic assignments...")

    assignments = []

    # Social posts → topic (GDELT already inserted during extract_gdelt_topics)
    for post_id, topics in social_post_topics.items():
        for topic_name in topics:
            topic_id = f"social_{re.sub(r'[^a-z0-9]', '_', topic_name.lower())}"
            assignments.append((str(post_id), 'social', topic_id, 0.7))

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT topic_id FROM topics")
            existing = {r[0] for r in cur.fetchall()}
            assignments = [a for a in assignments if a[2] in existing]

            # Insert in batches
            for i in range(0, len(assignments), 5000):
                batch = assignments[i:i+5000]
                execute_values(cur, """
                    INSERT INTO document_topics (document_id, document_source, topic_id, relevance_score)
                    VALUES %s
                """, batch)

    logger.info(f"Inserted {len(assignments)} document-topic assignments")


def populate_topic_trends():
    """Calculate topic trends by date from document assignments"""
    logger.info("Calculating topic trends...")

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # For GDELT: use GKG date field
            cur.execute("""
                INSERT INTO topic_trends (topic_id, analysis_date, document_count, average_engagement, growth_rate, trend_direction)
                SELECT
                    dt.topic_id,
                    TO_DATE(CAST(g.date / 1000000 AS TEXT), 'YYYYMMDD') as analysis_date,
                    COUNT(*) as document_count,
                    0.0 as average_engagement,
                    0.0 as growth_rate,
                    'stable' as trend_direction
                FROM document_topics dt
                JOIN gdelt_gkg g ON dt.document_id = g.gkgrecordid
                WHERE dt.document_source = 'gdelt_gkg'
                GROUP BY dt.topic_id, TO_DATE(CAST(g.date / 1000000 AS TEXT), 'YYYYMMDD')
            """)

            # For social posts: use published_at
            cur.execute("""
                INSERT INTO topic_trends (topic_id, analysis_date, document_count, average_engagement, growth_rate, trend_direction)
                SELECT
                    dt.topic_id,
                    DATE(p.published_at) as analysis_date,
                    COUNT(*) as document_count,
                    AVG(COALESCE(p.likes_count, 0) + COALESCE(p.shares_count, 0) + COALESCE(p.comments_count, 0)) as average_engagement,
                    0.0 as growth_rate,
                    'stable' as trend_direction
                FROM document_topics dt
                JOIN silver.posts p ON dt.document_id = p.post_id
                WHERE dt.document_source = 'social'
                GROUP BY dt.topic_id, DATE(p.published_at)
            """)

            # Calculate growth rates (compare each day to previous)
            cur.execute("""
                UPDATE topic_trends tt
                SET growth_rate = CASE
                    WHEN prev.document_count > 0
                    THEN ROUND(((tt.document_count - prev.document_count)::numeric / prev.document_count * 100), 2)
                    ELSE 0
                END,
                trend_direction = CASE
                    WHEN tt.document_count > COALESCE(prev.document_count, tt.document_count) * 1.1 THEN 'rising'
                    WHEN tt.document_count < COALESCE(prev.document_count, tt.document_count) * 0.9 THEN 'declining'
                    ELSE 'stable'
                END
                FROM topic_trends prev
                WHERE tt.topic_id = prev.topic_id
                    AND tt.analysis_date = prev.analysis_date + INTERVAL '1 day'
            """)

    logger.info("Topic trends calculated")


def populate_topic_relationships(cooccurrence_counts):
    """Build topic relationship graph from co-occurrence data"""
    logger.info("Building topic relationships...")

    relationships = []
    max_cooc = max(cooccurrence_counts.values()) if cooccurrence_counts else 1

    for (t1_name, t2_name), count in cooccurrence_counts.most_common(100):
        t1_id = f"gdelt_{re.sub(r'[^a-z0-9]', '_', t1_name.lower())}"
        t2_id = f"gdelt_{re.sub(r'[^a-z0-9]', '_', t2_name.lower())}"
        similarity = round(count / max_cooc, 3)
        strength = 'strong' if similarity > 0.5 else 'moderate' if similarity > 0.2 else 'weak'
        relationships.append((t1_id, t2_id, similarity, 'co-occurrence', strength))

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT topic_id FROM topics")
            existing = {r[0] for r in cur.fetchall()}
            relationships = [r for r in relationships if r[0] in existing and r[1] in existing]

            execute_values(cur, """
                INSERT INTO topic_relationships (topic1_id, topic2_id, similarity_score, relationship_type, strength)
                VALUES %s
            """, relationships)

    logger.info(f"Inserted {len(relationships)} topic relationships")


# ─── Language Detection ───────────────────────────────────────────────────────

def detect_languages():
    """Detect languages from social media posts and GDELT data"""
    logger.info("Detecting languages...")

    try:
        from langdetect import detect, detect_langs, LangDetectException
        has_langdetect = True
    except ImportError:
        logger.warning("langdetect not installed, using basic detection")
        has_langdetect = False

    # Known language codes
    language_names = {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
        'it': 'Italian', 'pt': 'Portuguese', 'nl': 'Dutch', 'ru': 'Russian',
        'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'ar': 'Arabic',
        'hi': 'Hindi', 'tr': 'Turkish', 'pl': 'Polish', 'sv': 'Swedish',
        'da': 'Danish', 'no': 'Norwegian', 'fi': 'Finnish', 'el': 'Greek',
        'cs': 'Czech', 'ro': 'Romanian', 'hu': 'Hungarian', 'uk': 'Ukrainian',
        'und': 'Undetermined',
    }

    detected_languages: Counter = Counter()
    detection_results = []

    # Process social posts
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT post_id, content, language
                FROM silver.posts
                WHERE content IS NOT NULL AND content != ''
            """)
            posts = cur.fetchall()

    logger.info(f"Detecting language for {len(posts)} social posts...")

    for post_id, content, existing_lang in posts:
        lang_code = existing_lang or None
        confidence = 0.0

        if has_langdetect and content and len(content.strip()) > 20:
            try:
                langs = detect_langs(content)
                if langs:
                    lang_code = langs[0].lang
                    confidence = langs[0].prob
            except LangDetectException:
                lang_code = 'und'
                confidence = 0.0
        elif existing_lang and existing_lang != '':
            lang_code = existing_lang
            confidence = 0.9
        else:
            lang_code = 'und'
            confidence = 0.0

        if lang_code:
            detected_languages[lang_code] += 1
            detection_results.append((str(post_id), 'social', lang_code, round(confidence, 3)))

    # Insert language reference data
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            lang_data = [(code, language_names.get(code, code.title()))
                         for code in detected_languages.keys()]
            execute_values(cur, """
                INSERT INTO languages (code, name) VALUES %s
                ON CONFLICT (code) DO NOTHING
            """, lang_data)

            # Insert detection results in batches
            for i in range(0, len(detection_results), 5000):
                batch = detection_results[i:i+5000]
                execute_values(cur, """
                    INSERT INTO language_detection (document_id, document_source, language_code, confidence)
                    VALUES %s
                """, batch)

    logger.info(f"Detected languages: {dict(detected_languages.most_common(10))}")
    logger.info(f"Inserted {len(detection_results)} language detections")
    return detected_languages


def populate_language_trends(detected_languages):
    """Calculate language distribution trends by date"""
    logger.info("Calculating language trends...")

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO language_trends (language_code, analysis_date, document_count, avg_confidence)
                SELECT
                    ld.language_code,
                    DATE(p.published_at) as analysis_date,
                    COUNT(*) as document_count,
                    AVG(ld.confidence) as avg_confidence
                FROM language_detection ld
                JOIN silver.posts p ON ld.document_id = p.post_id
                WHERE ld.document_source = 'social'
                GROUP BY ld.language_code, DATE(p.published_at)
            """)

    logger.info("Language trends calculated")


# ─── Main Pipeline ────────────────────────────────────────────────────────────

def run_pipeline(clean: bool = False):
    """Run the full topic modeling and language detection pipeline"""
    logger.info("Starting Topic & Language ETL Pipeline")

    # Step 1: Create schema
    create_schema()

    # Step 2: Clear existing data if requested
    if clean:
        clear_existing_data()

    # Step 3: Count topics from GDELT (memory-efficient streaming)
    gdelt_themes, gdelt_doc_counts, gdelt_cooccurrence = extract_gdelt_topics()
    social_topics, social_post_topics = extract_social_topics()

    # Step 4: Create topic rows, keywords, then insert doc-topic assignments
    topics = populate_topics(gdelt_themes, gdelt_doc_counts, social_topics)
    populate_topic_keywords(gdelt_themes)
    populate_gdelt_doc_topics()  # Second pass — needs topics to exist first
    populate_document_topics(social_post_topics)

    # Step 5: Calculate trends and relationships
    populate_topic_trends()
    populate_topic_relationships(gdelt_cooccurrence)

    # Step 6: Language detection
    detected_langs = detect_languages()
    populate_language_trends(detected_langs)

    # Step 7: Report
    report_statistics()

    logger.info("Pipeline completed successfully!")


def report_statistics():
    """Report current database statistics"""
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            tables = ['topics', 'topic_keywords', 'document_topics', 'topic_trends',
                      'topic_relationships', 'languages', 'language_detection', 'language_trends']
            for table in tables:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                count = cur.fetchone()[0]
                logger.info(f"  {table}: {count:,} rows")


def main():
    parser = argparse.ArgumentParser(description="Topic Modeling & Language Detection ETL")
    parser.add_argument("--clean", action="store_true", help="Clear existing data before running")
    parser.add_argument("--topics-only", action="store_true", help="Only run topic extraction")
    parser.add_argument("--languages-only", action="store_true", help="Only run language detection")
    args = parser.parse_args()

    try:
        if args.topics_only:
            create_schema()
            gdelt_themes, gdelt_doc_counts, gdelt_cooccurrence = extract_gdelt_topics()
            social_topics, social_post_topics = extract_social_topics()
            populate_topics(gdelt_themes, gdelt_doc_counts, social_topics)
            populate_topic_keywords(gdelt_themes)
            populate_gdelt_doc_topics()
            populate_document_topics(social_post_topics)
            populate_topic_trends()
            populate_topic_relationships(gdelt_cooccurrence)
        elif args.languages_only:
            create_schema()
            detected_langs = detect_languages()
            populate_language_trends(detected_langs)
        else:
            run_pipeline(clean=args.clean)

        report_statistics()

    except KeyboardInterrupt:
        logger.info("Pipeline interrupted")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
