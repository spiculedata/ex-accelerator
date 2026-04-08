#!/usr/bin/env python3
"""
Radio Transcript Enrichment Pipeline
=====================================
Enriches the radio_transcripts table with NLP analysis:
  - Sentiment analysis (TextBlob polarity)
  - Emotion classification (keyword matching)
  - Topic extraction (NLTK bigrams/trigrams)
  - Word count
  - Named entity extraction (regex-based)

Processes rows where sentiment IS NULL in batches of 100.
"""

import logging
import os
import re
import sys
from collections import Counter

import psycopg2
from psycopg2.extras import execute_values
from textblob import TextBlob

import nltk
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)
nltk.download('stopwords', quiet=True)

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.util import ngrams

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------

DB_CONFIG = {
    'host': os.getenv('PGHOST', 'postgres'),
    'port': os.getenv('PGPORT', '5432'),
    'dbname': os.getenv('PGDATABASE', 'analytics'),
    'user': os.getenv('PGUSER', 'postgres'),
    'password': os.getenv('PGPASSWORD', 'changeme'),
}

BATCH_SIZE = 100

STOP_WORDS = set(stopwords.words('english'))

# ---------------------------------------------------------------------------
# Emotion keyword sets
# ---------------------------------------------------------------------------

EMOTION_KEYWORDS = {
    'joy': {'happy', 'great', 'wonderful', 'celebrate', 'win', 'success', 'love', 'exciting'},
    'anger': {'angry', 'outrage', 'furious', 'attack', 'condemn', 'fight', 'war'},
    'fear': {'threat', 'danger', 'warning', 'crisis', 'emergency', 'concern', 'worry'},
    'sadness': {'tragic', 'loss', 'death', 'suffer', 'victim', 'mourn', 'devastat'},
    'surprise': {'unexpected', 'shock', 'breaking', 'sudden', 'reveal', 'stun'},
    'trust': {'agree', 'support', 'bipartisan', 'cooperat', 'commit', 'promis'},
}

# ---------------------------------------------------------------------------
# Known entity patterns
# ---------------------------------------------------------------------------

PERSON_PATTERNS = re.compile(
    r'\b(?:President|Senator|Governor|Representative|Secretary|General|'
    r'Minister|Chairman|Director|Chief|Judge|Justice|Dr|Mr|Mrs|Ms)\b',
    re.IGNORECASE,
)

ORG_PATTERNS = re.compile(
    r'\b(?:Department|Agency|Bureau|Commission|Committee|Council|'
    r'Corporation|Inc|LLC|Foundation|Institute|University|Association|'
    r'Party|Congress|Senate|House|NATO|FBI|CIA|NSA|EPA|FDA|CDC|WHO|UN)\b',
    re.IGNORECASE,
)

GPE_PATTERNS = re.compile(
    r'\b(?:United States|America|China|Russia|Ukraine|Israel|Palestine|'
    r'Washington|New York|California|Texas|Florida|London|Beijing|Moscow|'
    r'European Union|Middle East|North Korea|South Korea)\b',
    re.IGNORECASE,
)

# Regex to find capitalised multi-word sequences (potential entities)
ENTITY_RE = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b')


# ---------------------------------------------------------------------------
# Schema setup
# ---------------------------------------------------------------------------

def ensure_schema(conn):
    """Add enrichment columns and create supporting tables."""
    with conn.cursor() as cur:
        cur.execute("""
            ALTER TABLE radio_transcripts ADD COLUMN IF NOT EXISTS topics TEXT[];
            ALTER TABLE radio_transcripts ADD COLUMN IF NOT EXISTS entities JSONB;
            ALTER TABLE radio_transcripts ADD COLUMN IF NOT EXISTS word_count INTEGER;

            CREATE TABLE IF NOT EXISTS radio_topics (
                id SERIAL PRIMARY KEY,
                transcript_id INTEGER REFERENCES radio_transcripts(id),
                topic VARCHAR NOT NULL,
                relevance DOUBLE PRECISION DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_radio_topics_transcript ON radio_topics(transcript_id);

            CREATE TABLE IF NOT EXISTS radio_entities (
                id SERIAL PRIMARY KEY,
                transcript_id INTEGER REFERENCES radio_transcripts(id),
                entity_text VARCHAR NOT NULL,
                entity_type VARCHAR NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_radio_entities_transcript ON radio_entities(transcript_id);
        """)
    conn.commit()
    logger.info("Schema verified / updated")


# ---------------------------------------------------------------------------
# NLP helpers
# ---------------------------------------------------------------------------

def analyse_sentiment(text: str):
    """Return (label, confidence) using TextBlob polarity."""
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    if polarity > 0.1:
        label = 'positive'
    elif polarity < -0.1:
        label = 'negative'
    else:
        label = 'neutral'
    confidence = round(abs(polarity), 4)
    return label, confidence


def classify_emotion(text: str) -> str:
    """Return the dominant emotion using keyword matching."""
    lower = text.lower()
    scores = {}
    for emotion, keywords in EMOTION_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in lower)
        if count > 0:
            scores[emotion] = count

    if not scores:
        return 'neutral'

    max_count = max(scores.values())
    top = [e for e, c in scores.items() if c == max_count]
    if len(top) == 1:
        return top[0]
    return 'neutral'


def extract_topics(text: str, top_n: int = 5):
    """Extract top bigrams and trigrams as topic phrases."""
    tokens = word_tokenize(text.lower())
    filtered = [t for t in tokens if t.isalpha() and t not in STOP_WORDS and len(t) > 2]

    if len(filtered) < 2:
        return []

    bi = [' '.join(g) for g in ngrams(filtered, 2)]
    tri = [' '.join(g) for g in ngrams(filtered, 3)]
    all_grams = bi + tri

    if not all_grams:
        return []

    counts = Counter(all_grams)
    return [phrase for phrase, _ in counts.most_common(top_n)]


def extract_entities(text: str):
    """Extract named entities using regex heuristics.

    Returns list of dicts: [{text, type}, ...]
    """
    candidates = set(ENTITY_RE.findall(text))
    entities = []
    seen = set()

    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)

        if PERSON_PATTERNS.search(candidate):
            etype = 'PERSON'
        elif ORG_PATTERNS.search(candidate):
            etype = 'ORG'
        elif GPE_PATTERNS.search(candidate):
            etype = 'GPE'
        else:
            etype = 'OTHER'

        entities.append({'text': candidate, 'type': etype})

    # Also catch known GPE phrases that may not be multi-word capitalised
    for match in GPE_PATTERNS.finditer(text):
        val = match.group()
        if val not in seen:
            seen.add(val)
            entities.append({'text': val, 'type': 'GPE'})

    return entities


# ---------------------------------------------------------------------------
# Main processing loop
# ---------------------------------------------------------------------------

def fetch_batch(conn):
    """Fetch the next batch of un-enriched rows."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, transcript FROM radio_transcripts WHERE sentiment IS NULL LIMIT %s",
            (BATCH_SIZE,),
        )
        return cur.fetchall()


def enrich_batch(conn, rows):
    """Run enrichment on a batch and persist results."""
    import json

    topic_inserts = []
    entity_inserts = []

    with conn.cursor() as cur:
        for row_id, transcript in rows:
            text = transcript or ''

            # Sentiment
            sentiment, confidence = analyse_sentiment(text)

            # Emotion
            emotion = classify_emotion(text)

            # Word count
            word_count = len(text.split())

            # Topics
            topics = extract_topics(text)

            # Entities
            entities = extract_entities(text)
            entities_json = json.dumps(entities)

            # Update the transcript row
            cur.execute(
                """
                UPDATE radio_transcripts
                SET sentiment   = %s,
                    confidence  = %s,
                    emotion     = %s,
                    word_count  = %s,
                    topics      = %s,
                    entities    = %s
                WHERE id = %s
                """,
                (sentiment, confidence, emotion, word_count, topics, entities_json, row_id),
            )

            # Collect topic inserts
            for rank, topic_phrase in enumerate(topics, 1):
                relevance = round(1.0 / rank, 4)
                topic_inserts.append((row_id, topic_phrase, relevance))

            # Collect entity inserts
            for ent in entities:
                entity_inserts.append((row_id, ent['text'], ent['type']))

        # Bulk insert topics
        if topic_inserts:
            execute_values(
                cur,
                "INSERT INTO radio_topics (transcript_id, topic, relevance) VALUES %s",
                topic_inserts,
            )

        # Bulk insert entities
        if entity_inserts:
            execute_values(
                cur,
                "INSERT INTO radio_entities (transcript_id, entity_text, entity_type) VALUES %s",
                entity_inserts,
            )

    conn.commit()


def run():
    """Main entry point: connect, ensure schema, process in batches."""
    logger.info("Connecting to PostgreSQL at %s:%s/%s", DB_CONFIG['host'], DB_CONFIG['port'], DB_CONFIG['dbname'])
    conn = psycopg2.connect(**DB_CONFIG)

    try:
        ensure_schema(conn)

        total_processed = 0
        while True:
            rows = fetch_batch(conn)
            if not rows:
                break

            enrich_batch(conn, rows)
            total_processed += len(rows)
            logger.info("Enriched %d rows (%d total)", len(rows), total_processed)

        if total_processed == 0:
            logger.info("No un-enriched rows found — nothing to do")
        else:
            logger.info("Enrichment complete: %d rows processed", total_processed)
    except Exception:
        logger.exception("Enrichment pipeline failed")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    run()
