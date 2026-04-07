#!/usr/bin/env python3
"""
NLP Topic Enrichment for Social Posts

Uses BERTopic (transformer-based) for high-quality topic discovery.
Falls back to TF-IDF + LDA if BERTopic is unavailable or fails.
Writes results to the topics/document_topics tables.
"""

import logging
import sys
import re
import argparse
from datetime import datetime

import numpy as np
import pandas as pd

from db_config import get_connection_context

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Stop words for social media
SOCIAL_STOP_WORDS = [
    'just', 'like', 'get', 'got', 'know', 'think', 'really', 'good', 'want',
    'going', 'would', 'make', 'right', 'way', 'well', 'still', 'things',
    'much', 'something', 'thing', 'need', 'come', 'back', 'look', 'new',
    'time', 'people', 'one', 'day', 'today', 'lol', 'lmao', 'omg', 'yeah',
    'gonna', 'also', 'even', 'say', 'said', 'let', 'see', 'take', 'actually',
    'love', 'great', 'best', 'happy', 'thanks', 'thank', 'yes', 'please',
    'http', 'https', 'com', 'www', 'pic', 'twitter', 'bsky', 'app',
    've', 'll', 'didn', 'don', 'isn', 'im', 'em', 'da', 'ok',
    'youtu', 'jpg', 'png', 'gif', 'fucking', 'fuck', 'damn', 'hell', 'shit',
]

# Noise words for topic names
NOISE_WORDS = {
    've', 'll', 'didn', 'don', 'isn', 'im', 'em', 'da', 'ok', 'oh', 'vs',
    'youtu', 'http', 'https', 'www', 'com', 'jpg', 'png', 'gif',
    '2024', '2025', '2026', '2027',
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12',
    '04 06', '2026 04', 'april 2026', 'pm', 'am', 'min',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december',
    'pra', 'fucking', 'fuck', 'damn', 'hell', 'shit',
    'la', 'que', 'en', 'el', 'se', 'und', 'es', 'die', 'der', 'das',
    'bought', 'honestly', 'paint', 'file', 'cabinet',
}


def clean_text(text):
    """Clean social media text for topic modeling."""
    if not text or not isinstance(text, str):
        return ''
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'@[\w.]+', '', text)
    text = re.sub(r'#(\w+)', r'\1', text)
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip().lower()
    return text


def load_posts(min_length=20, language='en'):
    """Load social media posts from the database."""
    logger.info(f"Loading social media posts (language={language})...")
    with get_connection_context() as conn:
        if language:
            df = pd.read_sql("""
                SELECT p.post_id as id, p.content, p.media_type, p.published_at as created_at
                FROM silver.posts p
                LEFT JOIN language_detection ld ON ld.document_id = p.post_id
                WHERE p.content IS NOT NULL
                  AND LENGTH(p.content) >= %s
                  AND p.media_type != 'gdelt'
                  AND (ld.language_code = %s OR ld.language_code IS NULL)
            """, conn, params=(min_length, language))
        else:
            df = pd.read_sql("""
                SELECT post_id as id, content, media_type, published_at as created_at
                FROM silver.posts
                WHERE content IS NOT NULL
                  AND LENGTH(content) >= %s
                  AND media_type != 'gdelt'
            """, conn, params=(min_length,))

    logger.info(f"Loaded {len(df)} posts")
    return df


def categorize_topic(name, words):
    """Auto-categorize a topic based on its keywords."""
    all_text = ' '.join(words + [name.lower()])
    categories = {
        'Politics & Governance': ['politic', 'government', 'president', 'election', 'vote', 'congress', 'democrat', 'republican', 'trump', 'biden', 'law', 'policy', 'iran', 'war', 'military'],
        'Technology': ['tech', 'ai', 'software', 'app', 'data', 'digital', 'computer', 'code', 'programming', 'internet', 'web', 'ios', 'android', 'bluesky'],
        'Entertainment': ['music', 'movie', 'game', 'play', 'show', 'film', 'art', 'artist', 'book', 'read', 'watch', 'anime', 'manga', 'youtube', 'stream'],
        'Health & Wellness': ['health', 'mental', 'doctor', 'medical', 'care', 'sleep', 'exercise', 'anxiety', 'depression', 'therapy'],
        'Community & Culture': ['community', 'culture', 'friend', 'family', 'social', 'group', 'support', 'share', 'together'],
        'Economy & Jobs': ['work', 'job', 'money', 'business', 'company', 'economy', 'market', 'price', 'pay', 'cost'],
        'Science & Environment': ['science', 'climate', 'environment', 'research', 'study', 'nature', 'space', 'energy'],
        'Media & News': ['news', 'media', 'report', 'press', 'journalist', 'story', 'article'],
        'Sports': ['sport', 'team', 'player', 'win', 'season', 'football', 'basketball', 'baseball', 'soccer'],
        'Food & Lifestyle': ['food', 'cook', 'recipe', 'eat', 'restaurant', 'coffee', 'drink'],
    }
    best_cat, best_score = 'General', 0
    for cat, keywords in categories.items():
        score = sum(1 for kw in keywords if kw in all_text)
        if score > best_score:
            best_score = score
            best_cat = cat
    return best_cat


CATEGORY_COLORS = {
    'Politics & Governance': '#ef4444', 'Technology': '#3b82f6',
    'Entertainment': '#a855f7', 'Health & Wellness': '#10b981',
    'Community & Culture': '#f59e0b', 'Economy & Jobs': '#06b6d4',
    'Science & Environment': '#22c55e', 'Media & News': '#6366f1',
    'Sports': '#f97316', 'Food & Lifestyle': '#ec4899', 'General': '#6b7280',
}


def build_topic_name(words, category, used_categories):
    """Build a readable topic name from keywords and category."""
    # Filter out noise, short words, pure numbers, and date fragments
    distinctive = []
    for w in words:
        w_lower = w.lower().strip()
        if w_lower in NOISE_WORDS:
            continue
        if len(w_lower) <= 2:
            continue
        if w_lower.isdigit():
            continue
        # Skip date-like patterns (e.g. "04 06", "2026 04")
        if all(part.isdigit() for part in w_lower.split()):
            continue
        distinctive.append(w.replace('_', ' ').title())
        if len(distinctive) >= 3:
            break

    count = used_categories.get(category, 0)
    used_categories[category] = count + 1
    if distinctive:
        return f"{category}: {' & '.join(distinctive[:2])}"
    return f"{category} #{count + 1}"


# ──────────────────────────────────────────────────────────────────────────────
# BERTopic approach (primary)
# ──────────────────────────────────────────────────────────────────────────────

def run_bertopic(df, nr_topics=12):
    """Run BERTopic for transformer-based topic modeling."""
    from bertopic import BERTopic
    from sklearn.feature_extraction.text import CountVectorizer

    logger.info("Running BERTopic topic modeling...")

    docs = df['clean_text'].tolist()

    # Custom vectorizer to filter social noise
    from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
    all_stop = list(set(ENGLISH_STOP_WORDS) | set(SOCIAL_STOP_WORDS))
    vectorizer = CountVectorizer(stop_words=all_stop, ngram_range=(1, 2), min_df=3)

    model = BERTopic(
        nr_topics=nr_topics,
        vectorizer_model=vectorizer,
        min_topic_size=15,
        verbose=True,
        calculate_probabilities=True,
    )

    topics_assigned, probs = model.fit_transform(docs)

    # Extract topic info
    topic_info = model.get_topic_info()
    topic_info = topic_info[topic_info['Topic'] != -1]  # Remove outlier topic

    used_categories = {}
    topics = []
    for _, row in topic_info.iterrows():
        topic_id = row['Topic']
        top_words_raw = model.get_topic(topic_id)
        top_words = [w for w, _ in top_words_raw[:10]]
        top_weights = [float(s) for _, s in top_words_raw[:10]]

        category = categorize_topic('', top_words)
        name = build_topic_name(top_words, category, used_categories)

        topics.append({
            'topic_id': f'social_topic_{topic_id}',
            'name': name,
            'top_words': top_words,
            'top_weights': top_weights,
            'size': int(row['Count']),
            'weight': float(row['Count']) / len(docs),
        })

    # Build doc-topic matrix from probabilities
    # probs shape: (n_docs, n_topics) if calculate_probabilities=True
    doc_topic_matrix = np.array(probs) if probs is not None else None

    # Map BERTopic topic IDs to our sequential indices
    bt_topic_ids = [t['topic_id'] for t in topics]
    topic_id_map = {int(row['Topic']): f'social_topic_{row["Topic"]}' for _, row in topic_info.iterrows()}

    return topics, topics_assigned, doc_topic_matrix, topic_id_map, model


# ──────────────────────────────────────────────────────────────────────────────
# LDA fallback
# ──────────────────────────────────────────────────────────────────────────────

def run_lda(df, n_topics=12):
    """Fallback: TF-IDF + LDA topic modeling."""
    from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
    from sklearn.decomposition import LatentDirichletAllocation

    logger.info("Running LDA topic modeling (fallback)...")

    all_stop = list(set(ENGLISH_STOP_WORDS) | set(SOCIAL_STOP_WORDS))
    vectorizer = TfidfVectorizer(max_features=3000, min_df=3, max_df=0.85,
                                  stop_words=all_stop, ngram_range=(1, 2))
    tfidf_matrix = vectorizer.fit_transform(df['clean_text'])
    logger.info(f"TF-IDF matrix: {tfidf_matrix.shape}")

    lda = LatentDirichletAllocation(n_components=n_topics, random_state=42,
                                     max_iter=20, learning_method='online', batch_size=128)
    doc_topic_matrix = lda.fit_transform(tfidf_matrix)

    feature_names = vectorizer.get_feature_names_out()
    used_categories = {}
    topics = []
    for idx, topic_weights in enumerate(lda.components_):
        top_word_indices = topic_weights.argsort()[-10:][::-1]
        top_words = [feature_names[i] for i in top_word_indices]
        top_weights = [float(topic_weights[i]) for i in top_word_indices]

        category = categorize_topic('', top_words)
        name = build_topic_name(top_words, category, used_categories)

        topics.append({
            'topic_id': f'social_topic_{idx}',
            'name': name,
            'top_words': top_words,
            'top_weights': top_weights,
            'size': int((doc_topic_matrix[:, idx] > 0.1).sum()),
            'weight': float(doc_topic_matrix[:, idx].mean()),
        })

    return topics, doc_topic_matrix


# ──────────────────────────────────────────────────────────────────────────────
# Save results
# ──────────────────────────────────────────────────────────────────────────────

def save_bertopic_results(topics, topics_assigned, doc_topic_matrix, topic_id_map, df, threshold=0.05):
    """Save BERTopic results to PostgreSQL."""
    logger.info("Saving BERTopic results to database...")
    with get_connection_context() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM document_topics WHERE topic_id LIKE 'social_topic_%'")
        cur.execute("DELETE FROM topics WHERE topic_id LIKE 'social_topic_%'")
        logger.info(f"Cleaned old social topics")

        for topic in topics:
            category = categorize_topic(topic['name'], topic['top_words'])
            color = CATEGORY_COLORS.get(category, '#6b7280')
            cur.execute("""
                INSERT INTO topics (topic_id, name, category, category_color, size, weight, coherence_score, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (topic_id) DO UPDATE SET
                    name = EXCLUDED.name, category = EXCLUDED.category,
                    category_color = EXCLUDED.category_color, size = EXCLUDED.size,
                    weight = EXCLUDED.weight, created_at = EXCLUDED.created_at
            """, (topic['topic_id'], topic['name'], category, color,
                  topic['size'], topic['weight'], 0.0, datetime.now()))
        logger.info(f"Inserted {len(topics)} social topics")

        # Document-topic assignments
        batch = []
        for i, row in df.iterrows():
            iloc = df.index.get_loc(i)
            assigned_topic = topics_assigned[iloc]
            if assigned_topic == -1:
                continue  # outlier
            topic_id = topic_id_map.get(assigned_topic)
            if not topic_id:
                continue

            # Use probability if available, otherwise 1.0
            score = 1.0
            if doc_topic_matrix is not None and len(doc_topic_matrix.shape) == 2:
                # Find the column for this topic
                topic_cols = sorted(topic_id_map.keys())
                if assigned_topic in topic_cols:
                    col_idx = topic_cols.index(assigned_topic)
                    if col_idx < doc_topic_matrix.shape[1]:
                        score = float(doc_topic_matrix[iloc, col_idx])

            if score >= threshold:
                batch.append((str(row['id']), 'social_post', topic_id, score, datetime.now()))

            if len(batch) >= 5000:
                cur.executemany("""
                    INSERT INTO document_topics (document_id, document_source, topic_id, relevance_score, assigned_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, batch)
                batch = []

        if batch:
            cur.executemany("""
                INSERT INTO document_topics (document_id, document_source, topic_id, relevance_score, assigned_at)
                VALUES (%s, %s, %s, %s, %s)
            """, batch)
        conn.commit()
        logger.info("Document-topic assignments saved")


def save_lda_results(topics, doc_topic_matrix, df, threshold=0.1):
    """Save LDA results to PostgreSQL."""
    logger.info("Saving LDA results to database...")
    with get_connection_context() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM document_topics WHERE topic_id LIKE 'social_topic_%'")
        cur.execute("DELETE FROM topics WHERE topic_id LIKE 'social_topic_%'")

        for topic in topics:
            category = categorize_topic(topic['name'], topic['top_words'])
            color = CATEGORY_COLORS.get(category, '#6b7280')
            cur.execute("""
                INSERT INTO topics (topic_id, name, category, category_color, size, weight, coherence_score, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (topic_id) DO UPDATE SET
                    name = EXCLUDED.name, category = EXCLUDED.category,
                    category_color = EXCLUDED.category_color, size = EXCLUDED.size,
                    weight = EXCLUDED.weight, created_at = EXCLUDED.created_at
            """, (topic['topic_id'], topic['name'], category, color,
                  topic['size'], topic['weight'], 0.0, datetime.now()))
        logger.info(f"Inserted {len(topics)} social topics")

        batch = []
        for i, row in df.iterrows():
            topic_scores = doc_topic_matrix[df.index.get_loc(i)]
            for j, score in enumerate(topic_scores):
                if score >= threshold:
                    batch.append((str(row['id']), 'social_post',
                                  f'social_topic_{j}', float(score), datetime.now()))
            if len(batch) >= 5000:
                cur.executemany("""
                    INSERT INTO document_topics (document_id, document_source, topic_id, relevance_score, assigned_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, batch)
                batch = []
        if batch:
            cur.executemany("""
                INSERT INTO document_topics (document_id, document_source, topic_id, relevance_score, assigned_at)
                VALUES (%s, %s, %s, %s, %s)
            """, batch)
        conn.commit()
        logger.info("Document-topic assignments saved")


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="NLP Topic Enrichment for Social Posts")
    parser.add_argument("--topics", type=int, default=12, help="Number of topics")
    parser.add_argument("--min-length", type=int, default=20, help="Minimum post length")
    parser.add_argument("--threshold", type=float, default=0.05, help="Min relevance score")
    parser.add_argument("--language", type=str, default="en", help="Language filter")
    parser.add_argument("--method", type=str, default="auto", choices=["auto", "bertopic", "lda"],
                        help="Topic modeling method (auto tries BERTopic first)")
    args = parser.parse_args()

    df = load_posts(min_length=args.min_length, language=args.language or None)
    if df.empty:
        logger.error("No posts found")
        sys.exit(1)

    # Clean text
    df['clean_text'] = df['content'].apply(clean_text)
    df = df[df['clean_text'].str.len() >= 15].copy()
    logger.info(f"{len(df)} posts after cleaning")

    if len(df) < 20:
        logger.error("Too few posts for topic modeling")
        sys.exit(1)

    use_bertopic = args.method in ('auto', 'bertopic')

    if use_bertopic:
        try:
            topics, topics_assigned, doc_topic_matrix, topic_id_map, model = run_bertopic(df, nr_topics=args.topics)

            logger.info("\n=== Discovered Topics (BERTopic) ===")
            for t in sorted(topics, key=lambda x: x['size'], reverse=True):
                cat = categorize_topic(t['name'], t['top_words'])
                logger.info(f"  [{cat}] {t['name']} ({t['size']} posts) — {', '.join(t['top_words'][:5])}")

            save_bertopic_results(topics, topics_assigned, doc_topic_matrix, topic_id_map, df, threshold=args.threshold)
            logger.info("BERTopic enrichment complete!")
            return
        except Exception as e:
            if args.method == 'bertopic':
                raise
            logger.warning(f"BERTopic failed ({e}), falling back to LDA...")

    # LDA fallback
    topics, doc_topic_matrix = run_lda(df, n_topics=args.topics)

    logger.info("\n=== Discovered Topics (LDA) ===")
    for t in sorted(topics, key=lambda x: x['size'], reverse=True):
        cat = categorize_topic(t['name'], t['top_words'])
        logger.info(f"  [{cat}] {t['name']} ({t['size']} posts) — {', '.join(t['top_words'][:5])}")

    save_lda_results(topics, doc_topic_matrix, df, threshold=args.threshold)
    logger.info("LDA enrichment complete!")


if __name__ == "__main__":
    main()
