"""Unit tests for the SQL builders; they need no database, pandas or psycopg2."""
from datetime import datetime

import pytest

import query_builders as qb

TODAY = datetime(2026, 11, 12)
HOSTILE = "x'; DROP TABLE gdelt_events; --"


def placeholders(sql):
    return sql.count('%s')


class TestQuoteIdentifier:
    def test_quotes_a_plain_name(self):
        assert qb.quote_identifier('silver') == '"silver"'

    @pytest.mark.parametrize('name', ['', 'posts\n', 'a b', 'a;b', 'a"b', '1abc', 'a-b', 'a.b', HOSTILE, None, 5, 'x' * 64])
    def test_rejects_anything_else(self, name):
        with pytest.raises(ValueError):
            qb.quote_identifier(name)


class TestGdeltEvents:
    def test_no_filters_only_limits(self):
        sql, params = qb.gdelt_events_query()
        assert 'WHERE' not in sql
        assert params == [10000]

    def test_values_are_params_never_in_the_sql(self):
        sql, params = qb.gdelt_events_query(country=HOSTILE, goldstein_min=-5, goldstein_max=5, limit=7)
        assert HOSTILE not in sql
        assert params == [HOSTILE, -5.0, 5.0, 7]
        assert placeholders(sql) == len(params)

    def test_days_become_a_yyyymmdd_cutoff(self):
        _, params = qb.gdelt_events_query(days=30, today=TODAY)
        assert params[0] == 20261013

    def test_date_bounds_must_be_numbers(self):
        with pytest.raises(ValueError):
            qb.gdelt_events_query(date_start="20260101; DROP TABLE x")
        sql, params = qb.gdelt_events_query(date_start='20260101', date_end=20260131)
        assert params[:2] == [20260101, 20260131]
        assert placeholders(sql) == len(params)

    def test_limit_must_be_a_non_negative_number(self):
        with pytest.raises(ValueError):
            qb.gdelt_events_query(limit='10; DROP TABLE x')
        with pytest.raises(ValueError):
            qb.gdelt_events_query(limit=-1)

    def test_zero_goldstein_bound_is_kept(self):
        _, params = qb.gdelt_events_query(goldstein_min=0)
        assert params == [0.0, 10000]


class TestGdeltGkg:
    def test_cutoff_is_scaled_to_the_timestamp_column(self):
        sql, params = qb.gdelt_gkg_query(days=1, today=TODAY)
        assert params == [20261111 * 1000000, 5000]
        assert placeholders(sql) == 2

    def test_without_days_has_no_where(self):
        sql, params = qb.gdelt_gkg_query()
        assert 'WHERE' not in sql and params == [5000]


class TestSocialPosts:
    def test_platform_is_a_param(self):
        sql, params = qb.social_posts_query(platform=HOSTILE, limit=5)
        assert HOSTILE not in sql
        assert params == [HOSTILE, 5]

    def test_no_platform_no_where(self):
        sql, params = qb.social_posts_query()
        assert 'WHERE' not in sql and params == [500]


class TestTopics:
    def test_min_size_is_a_param(self):
        sql, params = qb.topics_query(3)
        assert params == [3.0] and placeholders(sql) == 1

    def test_rejects_non_numbers(self):
        with pytest.raises(ValueError):
            qb.topics_query("0; DROP TABLE topics")


class TestDescribeDataset:
    def test_identifiers_are_quoted_and_values_are_params(self):
        queries = qb.describe_dataset_queries('posts', schema='silver', sample=3)
        assert queries['count'] == ('SELECT COUNT(*) as n FROM "silver"."posts"', [])
        assert queries['sample'] == ('SELECT * FROM "silver"."posts" LIMIT %s', [3])
        columns_sql, columns_params = queries['columns']
        assert columns_params == ['silver', 'posts']
        assert placeholders(columns_sql) == 2

    @pytest.mark.parametrize('table', [HOSTILE, 'a b', 'public.posts'])
    def test_rejects_hostile_table_names(self, table):
        with pytest.raises(ValueError):
            qb.describe_dataset_queries(table)

    def test_rejects_hostile_schema_names(self):
        with pytest.raises(ValueError):
            qb.describe_dataset_queries('posts', schema=HOSTILE)


class TestGdeltSummary:
    def test_all_three_queries_use_the_same_cutoff_param(self):
        queries = qb.gdelt_summary_queries(days=30, today=TODAY)
        assert set(queries) == {'stats', 'top_countries', 'top_actors'}
        for sql, params in queries.values():
            assert params == [20261013]
            assert placeholders(sql) == 1


class TestGdeltMap:
    def test_days_and_limit_are_params(self):
        sql, params = qb.gdelt_map_query(days=90, limit=10, today=TODAY)
        assert params == [20260814, 10]
        assert placeholders(sql) == 2

    def test_days_none_drops_the_date_filter(self):
        sql, params = qb.gdelt_map_query(days=None, limit=10)
        assert params == [10] and placeholders(sql) == 1


class TestSentimentTimeline:
    def test_platform_is_a_param_and_days_now_limits_the_window(self):
        sql, params = qb.sentiment_timeline_query(platform=HOSTILE, days=30, today=TODAY)
        assert HOSTILE not in sql
        assert params == ['2026-10-13', HOSTILE]
        assert placeholders(sql) == 2

    def test_without_platform(self):
        sql, params = qb.sentiment_timeline_query(days=7, today=TODAY)
        assert 'sp.platform' not in sql
        assert params == ['2026-11-05']


class TestTopicNetwork:
    def test_min_weight_is_a_param(self):
        sql, params = qb.topic_network_query(0.1)
        assert params == [0.1] and placeholders(sql) == 1


def test_no_builder_leaves_an_f_string_value_in_its_sql():
    """A guard: placeholders and params always line up across every builder."""
    built = [
        qb.gdelt_events_query(country='US', days=3, date_start=1, date_end=2, goldstein_min=1, goldstein_max=2, today=TODAY),
        qb.gdelt_gkg_query(days=2, today=TODAY),
        qb.social_posts_query('bluesky'),
        qb.topics_query(1),
        qb.gdelt_map_query(today=TODAY),
        qb.sentiment_timeline_query('x', today=TODAY),
        qb.topic_network_query(),
    ]
    for sql, params in built:
        assert placeholders(sql) == len(params)
