"""
SQL builders for workspace_utils
================================
Pure functions that return ``(sql, params)`` for the helpers in ``workspace_utils``. They never
touch a database (and import neither pandas nor psycopg2), so they can be unit tested on their own.

Rules every builder follows:

* Values (countries, platforms, dates, limits, thresholds) are passed as ``params`` with ``%s``
  placeholders, never formatted into the SQL text.
* Identifiers (schema and table names) cannot be parameters, so they go through
  ``quote_identifier``, which accepts only plain names and double-quotes them.
* A literal ``%`` in the SQL is written ``%%`` because psycopg2 treats ``%`` as a placeholder
  whenever params are passed.
"""

import re
from datetime import datetime, timedelta

_IDENTIFIER = re.compile(r'[A-Za-z_][A-Za-z0-9_]{0,62}')


def quote_identifier(name):
    """Return ``name`` as a double-quoted SQL identifier, or raise ValueError if it is not a plain name."""
    if not isinstance(name, str) or not _IDENTIFIER.fullmatch(name):
        raise ValueError(
            f"Invalid SQL identifier {name!r}: use letters, digits and underscores only, "
            "starting with a letter or underscore (max 63 characters)"
        )
    return f'"{name}"'


def _int(value, label):
    """Coerce to int so a stray string cannot end up in a query; bool is rejected on purpose."""
    if isinstance(value, bool):
        raise ValueError(f"{label} must be a number, not {value!r}")
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{label} must be a whole number, got {value!r}") from None


def _number(value, label):
    if isinstance(value, bool):
        raise ValueError(f"{label} must be a number, not {value!r}")
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{label} must be a number, got {value!r}") from None


def _limit(value):
    limit = _int(value, 'limit')
    if limit < 0:
        raise ValueError('limit must not be negative')
    return limit


def _yyyymmdd_cutoff(days, today=None):
    return int(((today or datetime.now()) - timedelta(days=_int(days, 'days'))).strftime('%Y%m%d'))


def gdelt_events_query(country=None, days=None, date_start=None, date_end=None,
                       goldstein_min=None, goldstein_max=None, limit=10000, today=None):
    conditions, params = [], []
    if country:
        conditions.append('actiongeo_countrycode = %s')
        params.append(str(country))
    if days:
        conditions.append('sqldate >= %s')
        params.append(_yyyymmdd_cutoff(days, today))
    if date_start:
        conditions.append('sqldate >= %s')
        params.append(_int(date_start, 'date_start'))
    if date_end:
        conditions.append('sqldate <= %s')
        params.append(_int(date_end, 'date_end'))
    if goldstein_min is not None:
        conditions.append('goldsteinscale >= %s')
        params.append(_number(goldstein_min, 'goldstein_min'))
    if goldstein_max is not None:
        conditions.append('goldsteinscale <= %s')
        params.append(_number(goldstein_max, 'goldstein_max'))

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ''
    params.append(_limit(limit))
    sql = f"""
        SELECT globaleventid, sqldate, actor1name, actor2name, eventcode, eventrootcode,
               goldsteinscale, avgtone, numarticles, actiongeo_countrycode,
               actiongeo_fullname, actiongeo_lat, actiongeo_long, sourceurl
        FROM gdelt_events {where}
        ORDER BY sqldate DESC LIMIT %s
    """
    return sql, params


def gdelt_gkg_query(days=None, limit=5000, today=None):
    where, params = '', []
    if days:
        where = 'WHERE date >= %s'
        params.append(_yyyymmdd_cutoff(days, today) * 1000000)
    params.append(_limit(limit))
    sql = f"""
        SELECT gkgrecordid, date, sourcecommonname, themes, v2themes,
               locations, persons, organizations, v2tone
        FROM gdelt_gkg {where}
        ORDER BY date DESC LIMIT %s
    """
    return sql, params


def social_posts_query(platform=None, limit=500):
    where, params = '', []
    if platform:
        where = 'WHERE media_type = %s'
        params.append(str(platform))
    params.append(_limit(limit))
    sql = f"""
        SELECT post_id, source_channel_id, post_type, content, language,
               likes_count, shares_count, comments_count, views_count, published_at
        FROM silver.posts {where}
        ORDER BY published_at DESC LIMIT %s
    """
    return sql, params


def topics_query(min_size=0):
    sql = """
        SELECT t.topic_id, t.name, t.category, t.category_color, t.size, t.weight, t.coherence_score,
               array_agg(tk.keyword ORDER BY tk.rank_position) as keywords
        FROM topics t
        LEFT JOIN topic_keywords tk ON t.topic_id = tk.topic_id
        WHERE t.size >= %s
        GROUP BY t.topic_id, t.name, t.category, t.category_color, t.size, t.weight, t.coherence_score
        ORDER BY t.size DESC
    """
    return sql, [_number(min_size, 'min_size')]


def describe_dataset_queries(table_name, schema='public', sample=5):
    """The three queries behind ``describe_dataset``: row count, columns and a sample.

    Names are matched exactly: quoting makes them case-sensitive, so use the lower-case name a
    table has unless it was created with a quoted mixed-case name.
    """
    relation = f'{quote_identifier(schema)}.{quote_identifier(table_name)}'
    return {
        'count': (f'SELECT COUNT(*) as n FROM {relation}', []),
        'columns': ("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, [schema, table_name]),
        'sample': (f'SELECT * FROM {relation} LIMIT %s', [_limit(sample)]),
    }


def gdelt_summary_queries(days=30, today=None):
    cutoff = _yyyymmdd_cutoff(days, today)
    return {
        'stats': ("""
            SELECT
                COUNT(*) as total_events,
                COUNT(DISTINCT actiongeo_countrycode) as countries,
                AVG(goldsteinscale) as avg_goldstein,
                AVG(avgtone) as avg_tone,
                MIN(sqldate) as date_min,
                MAX(sqldate) as date_max
            FROM gdelt_events WHERE sqldate >= %s
        """, [cutoff]),
        'top_countries': ("""
            SELECT actiongeo_countrycode as country, COUNT(*) as events
            FROM gdelt_events WHERE sqldate >= %s AND actiongeo_countrycode IS NOT NULL
            GROUP BY actiongeo_countrycode ORDER BY events DESC LIMIT 10
        """, [cutoff]),
        'top_actors': ("""
            SELECT actor1name as actor, COUNT(*) as mentions
            FROM gdelt_events WHERE sqldate >= %s AND actor1name IS NOT NULL
            GROUP BY actor1name ORDER BY mentions DESC LIMIT 10
        """, [cutoff]),
    }


def gdelt_map_query(days=90, limit=50, today=None):
    conditions, params = ['actiongeo_countrycode IS NOT NULL'], []
    if days:
        conditions.append('sqldate >= %s')
        params.append(_yyyymmdd_cutoff(days, today))
    params.append(_limit(limit))
    sql = f"""
        SELECT actiongeo_countrycode as iso_alpha, COUNT(*) as events,
               AVG(goldsteinscale) as avg_goldstein, AVG(avgtone) as avg_tone
        FROM gdelt_events WHERE {' AND '.join(conditions)}
        GROUP BY actiongeo_countrycode
        ORDER BY events DESC LIMIT %s
    """
    return sql, params


def sentiment_timeline_query(platform=None, days=30, today=None):
    """Daily sentiment counts. ``days`` limits the window (it was previously accepted but ignored)."""
    conditions, params = ['sp.timestamp IS NOT NULL'], []
    if days:
        cutoff = (today or datetime.now()) - timedelta(days=_int(days, 'days'))
        conditions.append('DATE(sp.timestamp) >= %s')
        params.append(cutoff.strftime('%Y-%m-%d'))
    if platform:
        conditions.append('sp.platform = %s')
        params.append(str(platform))
    sql = f"""
        SELECT DATE(sp.timestamp) as date, sc.sentiment_category, COUNT(*) as count
        FROM sentiment_posts sp
        JOIN sentiment_classifications sc ON sp.id = sc.post_id
        WHERE {' AND '.join(conditions)}
        GROUP BY DATE(sp.timestamp), sc.sentiment_category
        ORDER BY date
    """
    return sql, params


def topic_network_query(min_weight=0.05):
    sql = """
        SELECT t1.name as source, t2.name as target, tr.weight
        FROM topic_relationships tr
        JOIN topics t1 ON tr.topic_id_1 = t1.topic_id
        JOIN topics t2 ON tr.topic_id_2 = t2.topic_id
        WHERE tr.weight >= %s
        LIMIT 100
    """
    return sql, [_number(min_weight, 'min_weight')]
