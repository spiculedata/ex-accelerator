#!/usr/bin/env python3
"""
Frictionless Data Package Generator for Social Explorer
========================================================
Generates datapackage.json descriptors from PostgreSQL datasets,
including schema inference and preview data.

Usage:
    python datapackage_generator.py --dataset "GDELT Global Events" --preview 100 --output /data/packages/
    python datapackage_generator.py --table gdelt_events --schema public --preview 50
"""

import argparse
import csv
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
from db_config import get_connection_context

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# PostgreSQL type → Frictionless type mapping
PG_TYPE_MAP = {
    'integer': 'integer',
    'bigint': 'integer',
    'smallint': 'integer',
    'serial': 'integer',
    'bigserial': 'integer',
    'real': 'number',
    'double precision': 'number',
    'numeric': 'number',
    'decimal': 'number',
    'boolean': 'boolean',
    'text': 'string',
    'character varying': 'string',
    'varchar': 'string',
    'char': 'string',
    'timestamp without time zone': 'datetime',
    'timestamp with time zone': 'datetime',
    'date': 'date',
    'time': 'time',
    'jsonb': 'object',
    'json': 'object',
    'uuid': 'string',
    'bytea': 'string',
    'ARRAY': 'array',
}


def infer_schema_from_table(table_name: str, schema_name: str = 'public') -> dict:
    """Infer a Frictionless Table Schema from a PostgreSQL table."""
    fields = []

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s
                ORDER BY ordinal_position
            """, [schema_name, table_name])

            for col_name, data_type, nullable, default in cur.fetchall():
                frictionless_type = PG_TYPE_MAP.get(data_type, 'string')
                field = {
                    'name': col_name,
                    'type': frictionless_type,
                }
                if nullable == 'NO':
                    field['constraints'] = {'required': True}
                fields.append(field)

            # Get primary key
            cur.execute("""
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = %s::regclass AND i.indisprimary
            """, [f"{schema_name}.{table_name}"])
            pk_cols = [row[0] for row in cur.fetchall()]

    schema = {'fields': fields}
    if pk_cols:
        schema['primaryKey'] = pk_cols[0] if len(pk_cols) == 1 else pk_cols

    return schema


def get_row_count(table_name: str, schema_name: str = 'public') -> int:
    """Get row count for a table."""
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {schema_name}.{table_name}")
            return cur.fetchone()[0]


def extract_preview(table_name: str, schema_name: str = 'public', limit: int = 100) -> list:
    """Extract preview rows from a table."""
    with get_connection_context() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM {schema_name}.{table_name} LIMIT %s", [limit])
            columns = [desc[0] for desc in cur.description]
            rows = []
            for row in cur.fetchall():
                row_dict = {}
                for i, val in enumerate(row):
                    if isinstance(val, datetime):
                        row_dict[columns[i]] = val.isoformat()
                    elif isinstance(val, (dict, list)):
                        row_dict[columns[i]] = val
                    else:
                        row_dict[columns[i]] = val
                rows.append(row_dict)
            return rows


def generate_datapackage(
    table_name: str,
    schema_name: str = 'public',
    dataset_name: str = None,
    title: str = None,
    description: str = None,
    preview_rows: int = 100,
    output_dir: str = '/data/packages'
) -> dict:
    """Generate a complete Frictionless Data Package for a PostgreSQL table."""

    if not dataset_name:
        dataset_name = f"social-explorer-{table_name}"
    if not title:
        title = f"Social Explorer - {table_name}"

    logger.info(f"Generating datapackage for {schema_name}.{table_name}")

    # Infer schema
    table_schema = infer_schema_from_table(table_name, schema_name)
    row_count = get_row_count(table_name, schema_name)
    logger.info(f"Schema: {len(table_schema['fields'])} fields, {row_count:,} rows")

    # Extract preview
    preview = extract_preview(table_name, schema_name, preview_rows)
    logger.info(f"Preview: {len(preview)} rows extracted")

    # Write preview CSV
    output_path = Path(output_dir) / dataset_name
    output_path.mkdir(parents=True, exist_ok=True)

    preview_csv_path = output_path / f"{table_name}-preview.csv"
    if preview:
        with open(preview_csv_path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[field['name'] for field in table_schema['fields']])
            writer.writeheader()
            for row in preview:
                writer.writerow({k: str(v) if v is not None else '' for k, v in row.items()})

    # Build datapackage.json
    datapackage = {
        'name': dataset_name,
        'title': title,
        'description': description or f"Dataset from Social Explorer platform ({row_count:,} records)",
        'version': '1.0.0',
        'created': datetime.now().isoformat(),
        'licenses': [
            {
                'name': 'CC-BY-4.0',
                'path': 'https://creativecommons.org/licenses/by/4.0/',
                'title': 'Creative Commons Attribution 4.0'
            }
        ],
        'contributors': [
            {
                'title': 'Social Explorer',
                'role': 'publisher'
            }
        ],
        'resources': [
            {
                'name': table_name,
                'path': f'{table_name}.csv',
                'format': 'csv',
                'mediatype': 'text/csv',
                'encoding': 'utf-8',
                'schema': table_schema,
                'row_count': row_count,
                'description': f'Full dataset ({row_count:,} records)'
            },
            {
                'name': f'{table_name}-preview',
                'path': f'{table_name}-preview.csv',
                'format': 'csv',
                'mediatype': 'text/csv',
                'encoding': 'utf-8',
                'schema': table_schema,
                'row_count': len(preview),
                'description': f'Preview: first {len(preview)} rows'
            }
        ],
        'social_explorer': {
            'source_schema': schema_name,
            'source_table': table_name,
            'platform': 'social-explorer',
            'total_rows': row_count,
            'preview_rows': len(preview)
        }
    }

    # Write datapackage.json
    pkg_path = output_path / 'datapackage.json'
    with open(pkg_path, 'w') as f:
        json.dump(datapackage, f, indent=2, default=str)

    logger.info(f"Package written to {output_path}")
    logger.info(f"  datapackage.json: {pkg_path}")
    logger.info(f"  preview CSV: {preview_csv_path}")

    return datapackage


def generate_from_dataset_catalog(dataset_id: int = None, dataset_name: str = None,
                                   preview_rows: int = 100, output_dir: str = '/data/packages') -> dict:
    """Generate a datapackage from a dataset in the Social Explorer catalog."""

    with get_connection_context() as conn:
        with conn.cursor() as cur:
            if dataset_id:
                cur.execute("SELECT * FROM datasets WHERE id = %s", [dataset_id])
            elif dataset_name:
                cur.execute("SELECT * FROM datasets WHERE name = %s", [dataset_name])
            else:
                raise ValueError("Either dataset_id or dataset_name required")

            row = cur.fetchone()
            if not row:
                raise ValueError(f"Dataset not found")

            columns = [desc[0] for desc in cur.description]
            dataset = dict(zip(columns, row))

    table_name = dataset.get('table_name', '')
    schema_name = dataset.get('schema_name', 'public') or 'public'

    if not table_name:
        raise ValueError(f"Dataset '{dataset.get('name')}' has no table_name")

    return generate_datapackage(
        table_name=table_name,
        schema_name=schema_name,
        dataset_name=dataset.get('name', '').lower().replace(' ', '-'),
        title=dataset.get('name'),
        description=dataset.get('description'),
        preview_rows=preview_rows,
        output_dir=output_dir
    )


def main():
    parser = argparse.ArgumentParser(description="Frictionless Data Package Generator")
    parser.add_argument("--table", help="PostgreSQL table name")
    parser.add_argument("--schema", default="public", help="PostgreSQL schema")
    parser.add_argument("--dataset", help="Dataset name from catalog")
    parser.add_argument("--dataset-id", type=int, help="Dataset ID from catalog")
    parser.add_argument("--preview", type=int, default=100, help="Number of preview rows")
    parser.add_argument("--output", default="/data/packages", help="Output directory")
    args = parser.parse_args()

    if args.dataset or args.dataset_id:
        pkg = generate_from_dataset_catalog(
            dataset_id=args.dataset_id,
            dataset_name=args.dataset,
            preview_rows=args.preview,
            output_dir=args.output
        )
    elif args.table:
        pkg = generate_datapackage(
            table_name=args.table,
            schema_name=args.schema,
            preview_rows=args.preview,
            output_dir=args.output
        )
    else:
        parser.error("Specify --table, --dataset, or --dataset-id")

    print(json.dumps(pkg, indent=2, default=str))


if __name__ == "__main__":
    main()
