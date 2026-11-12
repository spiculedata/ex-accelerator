"""Committed notebooks must not carry outputs or execution counts.

Outputs bloat the repository (one notebook once held 7,000 lines of chart data), make diffs
unreadable and can leak data from a local database. Clear them with ``nbstripout NOTEBOOK``
(``pip install nbstripout``) or ``jupyter nbconvert --clear-output --inplace NOTEBOOK``; the
pre-commit hook in ``.pre-commit-config.yaml`` does it for you.
"""
import json
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
NOTEBOOK_ROOTS = [REPO / 'jupyter' / 'notebooks', REPO / 'ex-accell-ui' / 'notebooks']
NOTEBOOKS = sorted(p for root in NOTEBOOK_ROOTS for p in root.rglob('*.ipynb') if '.ipynb_checkpoints' not in p.parts)


def problems(notebook):
    found = []
    for index, cell in enumerate(notebook.get('cells', [])):
        if cell.get('cell_type') != 'code':
            continue
        if cell.get('outputs'):
            found.append(f'cell {index} has outputs')
        if cell.get('execution_count') is not None:
            found.append(f'cell {index} has an execution count')
    return found


def test_notebooks_are_found():
    assert NOTEBOOKS, 'expected notebooks under jupyter/notebooks and ex-accell-ui/notebooks'


@pytest.mark.parametrize('path', NOTEBOOKS, ids=lambda p: str(p.relative_to(REPO)))
def test_notebook_has_no_outputs(path):
    assert problems(json.loads(path.read_text(encoding='utf-8'))) == []


def test_detector_flags_outputs_and_counts():
    dirty = {'cells': [
        {'cell_type': 'markdown', 'source': []},
        {'cell_type': 'code', 'outputs': [{'output_type': 'stream'}], 'execution_count': 3},
    ]}
    assert problems(dirty) == ['cell 1 has outputs', 'cell 1 has an execution count']
    assert problems({'cells': [{'cell_type': 'code', 'outputs': [], 'execution_count': None}]}) == []
