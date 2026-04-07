#!/usr/bin/env python3
"""
Post Enrichment Pipeline
========================
Runs sentiment analysis, language detection, and topic extraction on silver.posts,
then builds gold-layer aggregations.

Pipeline:
  silver.posts → sentiment_posts + sentiment_classifications
               → language_detection
               → emotion_analysis
               → gold.account_engagement_metrics (rebuild)
               → gold.daily_engagement_trends (rebuild)
"""

import logging
import sys
from datetime import datetime

import psycopg2
from psycopg2.extras import execute_values

from db_config import get_connection_context

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Simple keyword-based sentiment (no LLM needed, fast, deterministic)
POSITIVE_WORDS = {'love', 'great', 'amazing', 'awesome', 'excellent', 'wonderful', 'fantastic',
                  'beautiful', 'happy', 'good', 'best', 'perfect', 'brilliant', 'incredible',
                  'thank', 'thanks', 'appreciate', 'enjoy', 'excited', 'congrats', 'congratulations'}
NEGATIVE_WORDS = {'hate', 'terrible', 'awful', 'horrible', 'worst', 'bad', 'ugly', 'stupid',
                  'angry', 'sad', 'disappointed', 'annoyed', 'frustrated', 'garbage', 'trash',
                  'disgusting', 'pathetic', 'waste', 'broken', 'fail', 'failed', 'sucks'}


def classify_sentiment(text: str) -> tuple:
    """Simple keyword-based sentiment classification. Returns (category, confidence)."""
    if not text:
        return 'Neutral', 0.5

    words = set(text.lower().split())
    pos_count = len(words & POSITIVE_WORDS)
    neg_count = len(words & NEGATIVE_WORDS)
    total = pos_count + neg_count

    if total == 0:
        return 'Neutral', 0.5

    if pos_count > neg_count * 2:
        return 'Very Positive', min(0.95, 0.7 + pos_count * 0.05)
    elif pos_count > neg_count:
        return 'Positive', min(0.9, 0.6 + pos_count * 0.05)
    elif neg_count > pos_count * 2:
        return 'Very Negative', min(0.95, 0.7 + neg_count * 0.05)
    elif neg_count > pos_count:
        return 'Negative', min(0.9, 0.6 + neg_count * 0.05)
    else:
        return 'Neutral', 0.5


def detect_language(text: str) -> tuple:
    """Detect language of text. Returns (code, confidence)."""
    try:
        from langdetect import detect_langs, LangDetectException
        if not text or len(text.strip()) < 20:
            return 'und', 0.0
        langs = detect_langs(text)
        if langs:
            return langs[0].lang, langs[0].prob
        return 'und', 0.0
    except (ImportError, Exception):
        return 'und', 0.0


EMOTION_KEYWORDS = {
    'Joy': {'happy', 'joy', 'delighted', 'thrilled', 'excited', 'wonderful', 'love', 'celebrate'},
    'Sadness': {'sad', 'depressed', 'heartbroken', 'grief', 'mourning', 'miss', 'cry', 'tears'},
    'Anger': {'angry', 'furious', 'outraged', 'mad', 'rage', 'hate', 'disgusted', 'infuriated'},
    'Fear': {'scared', 'afraid', 'terrified', 'worried', 'anxious', 'panic', 'fear', 'alarmed'},
    'Surprise': {'surprised', 'shocked', 'amazed', 'astonished', 'unexpected', 'wow', 'whoa'},
    'Trust': {'trust', 'reliable', 'believe', 'faith', 'confident', 'honest', 'loyal', 'depend'},
}


def detect_emotion(text: str) -> tuple:
    """Detect primary emotion. Returns (emotion, intensity)."""
    if not text:
        return 'Neutral', 0.3
    words = set(text.lower().split())
    scores = {}
    for emotion, keywords in EMOTION_KEYWORDS.items():
        score = len(words & keywords)
        if score > 0:
            scores[emotion] = score
    if not scores:
        return 'Neutral', 0.3
    best = max(scores, key=scores.get)
    return best, min(0.95, 0.5 + scores[best] * 0.1)


def enrich_sentiment():
    """Run sentiment analysis on all silver.posts and populate sentiment tables."""
    logger.info("Starting sentiment enrichment...")

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Get posts not yet in sentiment_posts
            cur.execute("""
                SELECT p.post_id, p.content, p.source_channel_id, p.media_type,
                       p.published_at, p.likes_count, p.shares_count, p.comments_count
                FROM silver.posts p
                LEFT JOIN sentiment_posts sp ON p.post_id = sp.post_id::text
                WHERE sp.id IS NULL AND p.content IS NOT NULL AND p.content != ''
            """)
            posts = cur.fetchall()

    logger.info(f"Found {len(posts)} posts to enrich with sentiment")
    if not posts:
        return 0

    sentiment_posts = []
    classifications = []

    for post_id, content, channel_id, platform, published_at, likes, shares, comments in posts:
        category, confidence = classify_sentiment(content or '')

        # Convert timestamp to epoch millis (bigint)
        if published_at:
            if isinstance(published_at, datetime):
                ts_millis = int(published_at.timestamp() * 1000)
            else:
                try:
                    ts_millis = int(datetime.fromisoformat(str(published_at).replace('Z', '+00:00')).timestamp() * 1000)
                except:
                    ts_millis = int(datetime.now().timestamp() * 1000)
        else:
            ts_millis = int(datetime.now().timestamp() * 1000)

        sentiment_posts.append((
            content[:500] if content else '',  # text
            platform or 'unknown',  # platform
            ts_millis,  # timestamp as bigint (epoch millis)
            post_id,  # post_id
            channel_id or '',  # user_id
            likes or 0, shares or 0, comments or 0  # engagement
        ))

        classifications.append((
            len(sentiment_posts),  # will be updated after insert
            category,
            confidence
        ))

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Insert sentiment_posts
            execute_values(cur, """
                INSERT INTO sentiment_posts (text, platform, timestamp, post_id, user_id,
                    engagement_likes, engagement_shares, engagement_comments)
                VALUES %s
                ON CONFLICT DO NOTHING
            """, sentiment_posts)

            # Get the inserted IDs
            cur.execute("SELECT id, post_id FROM sentiment_posts ORDER BY id DESC LIMIT %s", [len(posts)])
            id_map = {str(row[1]): row[0] for row in cur.fetchall()}

            # Insert classifications
            class_rows = []
            for i, (post_id, content, channel_id, platform, published_at, likes, shares, comments) in enumerate(posts):
                sp_id = id_map.get(str(post_id))
                if sp_id:
                    category, confidence = classify_sentiment(content or '')
                    class_rows.append((sp_id, category, confidence))

            if class_rows:
                execute_values(cur, """
                    INSERT INTO sentiment_classifications (post_id, sentiment_category, confidence_score)
                    VALUES %s
                    ON CONFLICT DO NOTHING
                """, class_rows)

    logger.info(f"Sentiment enrichment complete: {len(sentiment_posts)} posts classified")
    return len(sentiment_posts)


def enrich_language():
    """Run language detection on silver.posts."""
    logger.info("Starting language enrichment...")

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.post_id, p.content
                FROM silver.posts p
                LEFT JOIN language_detection ld ON p.post_id = ld.document_id AND ld.document_source = 'social'
                WHERE ld.id IS NULL AND p.content IS NOT NULL AND p.content != ''
            """)
            posts = cur.fetchall()

    logger.info(f"Found {len(posts)} posts for language detection")
    if not posts:
        return 0

    detections = []
    for post_id, content in posts:
        lang_code, confidence = detect_language(content or '')
        detections.append((str(post_id), 'social', lang_code, round(confidence, 3)))

    # Ensure language entries exist
    lang_codes = set(d[2] for d in detections)
    lang_names = {'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
                  'pt': 'Portuguese', 'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese',
                  'ar': 'Arabic', 'ru': 'Russian', 'it': 'Italian', 'nl': 'Dutch',
                  'cy': 'Welsh', 'und': 'Undetermined'}

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            for code in lang_codes:
                cur.execute("""
                    INSERT INTO languages (code, name) VALUES (%s, %s)
                    ON CONFLICT (code) DO NOTHING
                """, [code, lang_names.get(code, code.title())])

            for i in range(0, len(detections), 5000):
                batch = detections[i:i+5000]
                execute_values(cur, """
                    INSERT INTO language_detection (document_id, document_source, language_code, confidence)
                    VALUES %s
                """, batch)

    logger.info(f"Language detection complete: {len(detections)} posts classified")
    return len(detections)


def enrich_emotion():
    """Run emotion detection on sentiment posts."""
    logger.info("Starting emotion enrichment...")

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT sp.id, sp.text
                FROM sentiment_posts sp
                LEFT JOIN emotion_analysis ea ON sp.id = ea.post_id
                WHERE ea.id IS NULL AND sp.text IS NOT NULL AND sp.text != ''
            """)
            posts = cur.fetchall()

    logger.info(f"Found {len(posts)} posts for emotion detection")
    if not posts:
        return 0

    emotions = []
    for post_id, text in posts:
        emotion, intensity = detect_emotion(text or '')
        confidence = round(intensity * 0.9, 3)  # confidence slightly lower than intensity
        emotions.append((post_id, emotion, round(intensity, 3), confidence))

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO emotion_analysis (post_id, emotion, intensity_score, confidence)
                VALUES %s
                ON CONFLICT DO NOTHING
            """, emotions)

    logger.info(f"Emotion detection complete: {len(emotions)} posts analysed")
    return len(emotions)


def rebuild_gold_layer():
    """Rebuild gold aggregation tables from enriched data."""
    logger.info("Rebuilding gold layer...")

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Rebuild daily engagement trends
            cur.execute("DELETE FROM gold.daily_engagement_trends")
            cur.execute("""
                INSERT INTO gold.daily_engagement_trends
                    (post_date, day_of_week, day_name, posts_count, active_accounts,
                     total_likes, total_shares, total_comments, total_views,
                     avg_likes_per_post, avg_shares_per_post, avg_comments_per_post,
                     median_likes, max_likes, analysis_date)
                SELECT
                    DATE(published_at) as post_date,
                    EXTRACT(DOW FROM published_at)::int as day_of_week,
                    TO_CHAR(published_at, 'Day') as day_name,
                    COUNT(*) as posts_count,
                    COUNT(DISTINCT source_channel_id) as active_accounts,
                    SUM(COALESCE(likes_count, 0)) as total_likes,
                    SUM(COALESCE(shares_count, 0)) as total_shares,
                    SUM(COALESCE(comments_count, 0)) as total_comments,
                    SUM(COALESCE(views_count, 0)) as total_views,
                    AVG(COALESCE(likes_count, 0)) as avg_likes_per_post,
                    AVG(COALESCE(shares_count, 0)) as avg_shares_per_post,
                    AVG(COALESCE(comments_count, 0)) as avg_comments_per_post,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(likes_count, 0)) as median_likes,
                    MAX(COALESCE(likes_count, 0)) as max_likes,
                    NOW() as analysis_date
                FROM silver.posts
                WHERE published_at IS NOT NULL
                GROUP BY DATE(published_at), EXTRACT(DOW FROM published_at)::int, TO_CHAR(published_at, 'Day')
            """)

            # Rebuild account engagement metrics
            cur.execute("DELETE FROM gold.account_engagement_metrics")
            cur.execute("""
                INSERT INTO gold.account_engagement_metrics
                    (source_channel_id, account_name, platform, total_posts,
                     total_likes, total_shares, total_comments, total_views,
                     avg_likes_per_post, avg_shares_per_post, avg_comments_per_post,
                     first_post_date, latest_post_date, analysis_date)
                SELECT
                    source_channel_id,
                    source_channel_id as account_name,
                    media_type as platform,
                    COUNT(*) as total_posts,
                    SUM(COALESCE(likes_count, 0)) as total_likes,
                    SUM(COALESCE(shares_count, 0)) as total_shares,
                    SUM(COALESCE(comments_count, 0)) as total_comments,
                    SUM(COALESCE(views_count, 0)) as total_views,
                    AVG(COALESCE(likes_count, 0)) as avg_likes_per_post,
                    AVG(COALESCE(shares_count, 0)) as avg_shares_per_post,
                    AVG(COALESCE(comments_count, 0)) as avg_comments_per_post,
                    MIN(published_at) as first_post_date,
                    MAX(published_at) as latest_post_date,
                    NOW() as analysis_date
                FROM silver.posts
                WHERE source_channel_id IS NOT NULL AND source_channel_id != ''
                GROUP BY source_channel_id, media_type
                ORDER BY COUNT(*) DESC
            """)

            # Get counts
            cur.execute("SELECT count(*) FROM gold.daily_engagement_trends")
            trends_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM gold.account_engagement_metrics")
            accounts_count = cur.fetchone()[0]

    logger.info(f"Gold layer rebuilt: {trends_count} daily trends, {accounts_count} account metrics")


def update_dataset_counts():
    """Update record counts in the datasets catalog."""
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            # Update Bluesky Firehose count
            cur.execute("""
                UPDATE datasets SET
                    record_count = (SELECT COUNT(*) FROM silver.posts WHERE media_type = 'bluesky'),
                    last_updated = NOW()
                WHERE name = 'Bluesky Firehose'
            """)

    logger.info("Dataset counts updated")


def main():
    logger.info("=" * 60)
    logger.info("POST ENRICHMENT PIPELINE")
    logger.info("=" * 60)

    sentiment_count = enrich_sentiment()
    language_count = enrich_language()
    emotion_count = enrich_emotion()
    rebuild_gold_layer()
    update_dataset_counts()

    logger.info("=" * 60)
    logger.info(f"Pipeline complete:")
    logger.info(f"  Sentiment: {sentiment_count} posts")
    logger.info(f"  Language: {language_count} posts")
    logger.info(f"  Emotion: {emotion_count} posts")
    logger.info(f"  Gold layer: rebuilt")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
