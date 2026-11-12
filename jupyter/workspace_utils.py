"""
Workspace Utilities for Jupyter Notebooks
==========================================
Provides easy access to PostgreSQL, Ollama LLM, and data analysis helpers.

Quick Start:
    from workspace_utils import query_df, ask_llm, gdelt_events, social_posts

    # Query any table
    df = query_df("SELECT * FROM gdelt_events WHERE sqldate >= 20260101 LIMIT 100")

    # Ask the local LLM
    answer = ask_llm("Summarize the key themes in this data", context=df.head(20).to_string())

    # Quick access to common tables
    events = gdelt_events(country='US', days=30, limit=1000)
    posts = social_posts(platform='bluesky', limit=500)
"""

import os
import pandas as pd
from datetime import datetime, timedelta

import query_builders as qb


# ─── Database ─────────────────────────────────────────────────────────────────

def get_connection():
    """Get a PostgreSQL connection."""
    import psycopg2
    return psycopg2.connect(
        host=os.environ.get('PGHOST', 'postgres'),
        port=os.environ.get('PGPORT', '5432'),
        dbname=os.environ.get('PGDATABASE', 'analytics'),
        user=os.environ.get('PGUSER', 'postgres'),
        password=os.environ.get('PGPASSWORD', '')
    )

def query_df(sql, params=None):
    """Execute SQL and return a pandas DataFrame."""
    conn = get_connection()
    try:
        return pd.read_sql_query(sql, conn, params=params)
    finally:
        conn.close()

def get_connection_string():
    """Get DATABASE_URL for SQLAlchemy etc."""
    return os.environ.get('DATABASE_URL', '')


# ─── Quick Data Access ────────────────────────────────────────────────────────

def gdelt_events(country=None, days=None, date_start=None, date_end=None,
                 goldstein_min=None, goldstein_max=None, limit=10000):
    """Quick access to GDELT events with common filters."""
    sql, params = qb.gdelt_events_query(country, days, date_start, date_end,
                                        goldstein_min, goldstein_max, limit)
    return query_df(sql, params)

def gdelt_gkg(days=None, limit=5000):
    """Quick access to GDELT GKG (themes, entities, tone)."""
    sql, params = qb.gdelt_gkg_query(days, limit)
    return query_df(sql, params)

def social_posts(platform=None, limit=500):
    """Quick access to social media posts."""
    sql, params = qb.social_posts_query(platform, limit)
    return query_df(sql, params)

def topics(min_size=0):
    """Get topic model data."""
    sql, params = qb.topics_query(min_size)
    return query_df(sql, params)

def sentiment_data():
    """Get sentiment analysis data with post text."""
    return query_df("""
        SELECT sp.id, sp.text, sp.platform, sp.timestamp,
               sc.sentiment_category, sc.confidence_score
        FROM sentiment_posts sp
        JOIN sentiment_classifications sc ON sp.id = sc.post_id
        ORDER BY sc.confidence_score DESC
    """)

def get_workspace_datasets(workspace_id):
    """Get datasets linked to a specific workspace."""
    return query_df("""
        SELECT d.id, d.name, d.dataset_type, d.source_platform,
               d.table_name, d.schema_name, d.record_count,
               d.date_range_start, d.date_range_end
        FROM datasets d
        JOIN workspace_datasets wd ON d.id = wd.dataset_id
        WHERE wd.workspace_id = %s AND wd.status = 'active'
    """, params=[workspace_id])

def get_all_datasets():
    """Get all available datasets."""
    return query_df("SELECT * FROM datasets WHERE status = 'available' ORDER BY name")


# ─── Ollama LLM ──────────────────────────────────────────────────────────────

def ask_llm(prompt, context=None, model=None, temperature=0.3, max_tokens=2000):
    """Ask the local Ollama LLM a question, optionally with data context.

    Args:
        prompt: Your question
        context: Optional data context (string, DataFrame summary, etc.)
        model: Ollama model name (default: auto-detect first available)
        temperature: Creativity (0=factual, 1=creative)
        max_tokens: Max response length

    Returns:
        str: LLM response text
    """
    try:
        import ollama
    except ImportError:
        return "Error: ollama package not installed. Run: pip install ollama"

    ollama_host = os.environ.get('OLLAMA_HOST', 'http://ollama:11434')
    client = ollama.Client(host=ollama_host)

    # Auto-detect model if not specified
    if not model:
        try:
            models = client.list()
            if models.get('models'):
                model = models['models'][0]['name']
            else:
                return "No models available. Pull one with: ollama pull mistral:7b-q4"
        except Exception as e:
            return f"Cannot connect to Ollama at {ollama_host}: {e}"

    # Build message with context
    if context is not None:
        if isinstance(context, pd.DataFrame):
            context = context.head(50).to_string()
        full_prompt = f"Data context:\n{context}\n\nQuestion: {prompt}"
    else:
        full_prompt = prompt

    try:
        response = client.chat(
            model=model,
            messages=[{"role": "user", "content": full_prompt}],
            options={"temperature": temperature, "num_predict": max_tokens}
        )
        return response['message']['content']
    except Exception as e:
        return f"LLM error: {e}"

def list_models():
    """List available Ollama models."""
    try:
        import ollama
        client = ollama.Client(host=os.environ.get('OLLAMA_HOST', 'http://ollama:11434'))
        models = client.list()
        return [m['name'] for m in models.get('models', [])]
    except Exception as e:
        return f"Cannot connect to Ollama: {e}"

def pull_model(model_name='mistral:7b-instruct-q4_0'):
    """Pull an Ollama model (downloads to server)."""
    try:
        import ollama
        client = ollama.Client(host=os.environ.get('OLLAMA_HOST', 'http://ollama:11434'))
        print(f"Pulling {model_name}... (this may take a few minutes)")
        client.pull(model_name)
        print(f"Done! Model {model_name} is ready.")
    except Exception as e:
        print(f"Error pulling model: {e}")


# ─── Analysis Helpers ─────────────────────────────────────────────────────────

def describe_dataset(table_name, schema='public', sample=5):
    """Quick profile of a database table — columns, types, row count, sample."""
    queries = qb.describe_dataset_queries(table_name, schema, sample)
    count = query_df(*queries['count']).iloc[0]['n']
    cols = query_df(*queries['columns'])
    sample_df = query_df(*queries['sample'])

    print(f"Table: {schema}.{table_name}")
    print(f"Rows: {count:,}")
    print(f"Columns: {len(cols)}")
    print(f"\nSchema:")
    for _, row in cols.iterrows():
        print(f"  {row['column_name']:30s} {row['data_type']}")
    print(f"\nSample ({sample} rows):")
    return sample_df

def gdelt_summary(days=30):
    """Quick summary of recent GDELT activity."""
    queries = qb.gdelt_summary_queries(days)
    stats = query_df(*queries['stats'])
    top_countries = query_df(*queries['top_countries'])
    top_actors = query_df(*queries['top_actors'])

    print(f"GDELT Summary (last {days} days)")
    print(f"  Events: {stats.iloc[0]['total_events']:,.0f}")
    print(f"  Countries: {stats.iloc[0]['countries']:.0f}")
    print(f"  Avg Goldstein: {stats.iloc[0]['avg_goldstein']:.2f}")
    print(f"  Avg Tone: {stats.iloc[0]['avg_tone']:.2f}")
    print(f"\nTop Countries:")
    for _, row in top_countries.iterrows():
        print(f"  {row['country']}: {row['events']:,}")
    print(f"\nTop Actors:")
    for _, row in top_actors.iterrows():
        print(f"  {row['actor']}: {row['mentions']:,}")

    return stats, top_countries, top_actors


# ─── Schema Discovery ────────────────────────────────────────────────────────

def list_tables():
    """Show all tables in the database with row counts."""
    return query_df("""
        SELECT schemaname as schema, relname as table_name,
               n_live_tup as estimated_rows
        FROM pg_stat_user_tables
        ORDER BY schemaname, relname
    """)

def table_schema(table_name, schema='public'):
    """Show columns, types, and nullability for a table."""
    return query_df("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
    """, params=[schema, table_name])

def search_columns(keyword):
    """Find columns across all tables matching a keyword."""
    return query_df("""
        SELECT table_schema, table_name, column_name, data_type
        FROM information_schema.columns
        WHERE column_name ILIKE %s AND table_schema NOT IN ('pg_catalog','information_schema')
        ORDER BY table_schema, table_name, column_name
    """, params=[f'%{keyword}%'])


# ─── Quick Analysis Shortcuts ────────────────────────────────────────────────

def platform_summary():
    """Summary stats per social media platform."""
    return query_df("""
        SELECT media_type as platform, COUNT(*) as posts,
               AVG(likes_count) as avg_likes, AVG(shares_count) as avg_shares,
               AVG(comments_count) as avg_comments
        FROM silver.posts
        GROUP BY media_type ORDER BY posts DESC
    """)

def daily_timeline(metric='posts', days=30):
    """Time series of post count over the last N days."""
    cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    return query_df("""
        SELECT DATE(published_at) as date, COUNT(*) as posts
        FROM silver.posts WHERE published_at >= %s
        GROUP BY DATE(published_at) ORDER BY date
    """, params=[cutoff])

def top_hashtags(limit=20):
    """Most used hashtags from social posts."""
    return query_df("""
        WITH hashtags AS (
            SELECT unnest(regexp_matches(content, '#([A-Za-z0-9_]+)', 'g')) as tag
            FROM silver.posts WHERE content LIKE '%%#%%'
        )
        SELECT lower(tag) as hashtag, COUNT(*) as count
        FROM hashtags GROUP BY lower(tag)
        HAVING COUNT(*) >= 2 ORDER BY count DESC LIMIT %s
    """, params=[limit])

def language_breakdown():
    """Language distribution across all posts."""
    return query_df("""
        SELECT language_code, language_name, COUNT(*) as post_count,
               ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
        FROM language_detection ld
        LEFT JOIN languages l ON ld.language_code = l.code
        GROUP BY language_code, language_name
        ORDER BY post_count DESC
    """)

def image_analysis_summary():
    """Summary of image processing results."""
    return query_df("""
        SELECT
            (SELECT COUNT(*) FROM image_analysis) as total_images,
            (SELECT COUNT(*) FROM image_objects) as total_objects,
            (SELECT COUNT(DISTINCT object_class) FROM image_objects) as unique_classes,
            (SELECT COALESCE(SUM(face_count), 0) FROM image_faces) as total_faces,
            (SELECT COUNT(*) FILTER (WHERE NOT is_safe) FROM image_moderation) as flagged_images,
            (SELECT COUNT(DISTINCT tag) FROM image_classification) as unique_tags
    """)


# ─── Visualization Helpers ───────────────────────────────────────────────────

def plot_gdelt_map(country_filter=None, days=90, limit=50):
    """Interactive choropleth map of GDELT events by country."""
    import plotly.express as px

    sql, params = qb.gdelt_map_query(days, limit)
    df = query_df(sql, params)

    if df.empty:
        print("No GDELT data found for the given period")
        return None

    fig = px.choropleth(df, locations='iso_alpha', locationmode='ISO-3',
                        color='events', hover_name='iso_alpha',
                        hover_data=['avg_goldstein', 'avg_tone'],
                        color_continuous_scale='Viridis',
                        title=f'GDELT Events by Country (last {days} days)')
    fig.update_layout(height=500)
    fig.show()
    return fig

def plot_sentiment_timeline(platform=None, days=30):
    """Sentiment trend over time with positive/negative/neutral lines."""
    import matplotlib.pyplot as plt

    sql, params = qb.sentiment_timeline_query(platform, days)
    df = query_df(sql, params)

    if df.empty:
        print("No sentiment data found")
        return None

    fig, ax = plt.subplots(figsize=(12, 5))
    colors = {'Positive': '#06d6a0', 'Very Positive': '#06d6a0',
              'Negative': '#f72585', 'Very Negative': '#f72585',
              'Neutral': '#8b5cf6'}

    for cat in df['sentiment_category'].unique():
        subset = df[df['sentiment_category'] == cat]
        ax.plot(subset['date'], subset['count'], label=cat,
                color=colors.get(cat, '#6b7280'), linewidth=2)

    ax.set_title(f'Sentiment Over Time{" (" + platform + ")" if platform else ""}')
    ax.set_xlabel('Date')
    ax.set_ylabel('Posts')
    ax.legend()
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.show()
    return fig

def plot_topic_network(min_weight=0.05):
    """Network graph of topic relationships."""
    import matplotlib.pyplot as plt
    import networkx as nx

    sql, params = qb.topic_network_query(min_weight)
    df = query_df(sql, params)

    if df.empty:
        print("No topic relationships found")
        return None

    G = nx.from_pandas_edgelist(df, 'source', 'target', edge_attr='weight')
    fig, ax = plt.subplots(figsize=(12, 10))
    pos = nx.spring_layout(G, k=2)
    nx.draw(G, pos, ax=ax, with_labels=True, node_size=1000,
            node_color='#8b5cf6', font_size=8, font_weight='bold',
            edge_color='#d1d5db', width=[G[u][v]['weight'] * 5 for u, v in G.edges()])
    ax.set_title('Topic Relationship Network')
    plt.tight_layout()
    plt.show()
    return fig

def plot_wordcloud(text_series, title='Word Cloud'):
    """Word cloud from a pandas Series of text."""
    from wordcloud import WordCloud
    import matplotlib.pyplot as plt

    text = ' '.join(text_series.dropna().astype(str))
    if not text.strip():
        print("No text to generate word cloud from")
        return None

    wc = WordCloud(width=800, height=400, background_color='white',
                   colormap='viridis', max_words=100).generate(text)
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.imshow(wc, interpolation='bilinear')
    ax.axis('off')
    ax.set_title(title)
    plt.tight_layout()
    plt.show()
    return fig


# ─── LLM Analysis Helpers ───────────────────────────────────────────────────

def analyze_dataframe(df, question):
    """Ask Ollama to analyze a DataFrame."""
    context = f"DataFrame shape: {df.shape}\n\nColumn summary:\n{df.describe().to_string()}\n\nFirst 10 rows:\n{df.head(10).to_string()}"
    return ask_llm(question, context=context)

def summarize_texts(texts, max_texts=10):
    """Use LLM to summarize a list of text snippets."""
    sample = list(texts[:max_texts])
    context = '\n---\n'.join(sample)
    return ask_llm("Summarize the key themes and topics across these text samples:", context=context)

def classify_texts(texts, categories):
    """Use LLM to classify texts into given categories."""
    cats = ', '.join(categories)
    results = []
    for text in texts[:20]:  # Limit to avoid timeout
        response = ask_llm(
            f"Classify this text into exactly one of: {cats}. Reply with just the category name.",
            context=str(text)
        )
        results.append({'text': str(text)[:100], 'category': response.strip()})
    return pd.DataFrame(results)


# ─── Export Helpers ──────────────────────────────────────────────────────────

def save_to_csv(df, filename):
    """Save DataFrame to /app/notebooks/exports/."""
    export_dir = '/app/notebooks/exports'
    os.makedirs(export_dir, exist_ok=True)
    path = os.path.join(export_dir, f'{filename}.csv')
    df.to_csv(path, index=False)
    print(f"Saved to {path} ({len(df)} rows)")
    return path

def save_plot(fig, filename):
    """Save a matplotlib figure to /app/notebooks/exports/."""
    export_dir = '/app/notebooks/exports'
    os.makedirs(export_dir, exist_ok=True)
    path = os.path.join(export_dir, f'{filename}.png')
    fig.savefig(path, dpi=150, bbox_inches='tight')
    print(f"Saved plot to {path}")
    return path


# ─── Auto-connect on import ──────────────────────────────────────────────────

if __name__ != '__main__':
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM gdelt_events")
        gdelt_count = cur.fetchone()[0]
        conn.close()
        print(f"✓ Connected to Social Explorer database ({gdelt_count:,} GDELT events)")

        # Check Ollama
        try:
            models = list_models()
            if isinstance(models, list) and models:
                print(f"✓ Ollama available: {', '.join(models)}")
            else:
                print("○ Ollama available (no models pulled yet — use pull_model())")
        except:
            print("○ Ollama not available")
    except Exception as e:
        print(f"Database connection available (connect with get_connection())")
