"""The helpers in workspace_utils pass the builders' SQL and params straight to query_df.

pandas is stubbed when it is not installed, so these run with nothing but pytest.
"""
import importlib
import re
import sys
import types
from pathlib import Path

import pytest

SOURCE = Path(__file__).resolve().parent.parent / 'workspace_utils.py'


@pytest.fixture
def workspace_utils(monkeypatch):
    monkeypatch.setenv('PGHOST', '127.0.0.1')  # the import-time connection check should fail fast
    if 'pandas' not in sys.modules:
        try:
            importlib.import_module('pandas')
        except ImportError:
            monkeypatch.setitem(sys.modules, 'pandas', types.ModuleType('pandas'))
    sys.modules.pop('workspace_utils', None)
    module = importlib.import_module('workspace_utils')
    calls = []
    monkeypatch.setattr(module, 'query_df', lambda sql, params=None: calls.append((sql, params)) or 'frame')
    yield module, calls
    sys.modules.pop('workspace_utils', None)


def test_gdelt_events_passes_values_as_params(workspace_utils):
    module, calls = workspace_utils
    assert module.gdelt_events(country="US' OR '1'='1", limit=5) == 'frame'
    sql, params = calls[0]
    assert "OR '1'='1" not in sql
    assert params == ["US' OR '1'='1", 5]


def test_social_posts_passes_platform_as_a_param(workspace_utils):
    module, calls = workspace_utils
    module.social_posts(platform="x'; DROP TABLE silver.posts; --")
    sql, params = calls[0]
    assert 'DROP TABLE' not in sql
    assert params[0] == "x'; DROP TABLE silver.posts; --"


def test_topics_and_gkg_use_params(workspace_utils):
    module, calls = workspace_utils
    module.topics(min_size=4)
    module.gdelt_gkg(limit=3)
    assert calls[0][1] == [4.0]
    assert calls[1][1] == [3]


def test_describe_dataset_rejects_a_hostile_table_name_before_querying(workspace_utils):
    module, calls = workspace_utils
    with pytest.raises(ValueError):
        module.describe_dataset('posts; DROP TABLE posts')
    assert calls == []


def test_no_query_in_workspace_utils_is_built_with_an_f_string():
    source = SOURCE.read_text()
    assert not re.search(r'query_df\(\s*f["\']', source), 'query_df must not receive an f-string'
    assert 'f"""' not in source and "f'''" not in source
