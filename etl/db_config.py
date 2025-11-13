"""
Database configuration for PostgreSQL with pg_duckdb extension.

This module provides connection settings and utilities for connecting to PostgreSQL
using the pg_duckdb extension, which allows DuckDB-style analytics on PostgreSQL data.
"""

import os
import psycopg2
from contextlib import contextmanager

# PostgreSQL connection parameters
DB_CONFIG = {
    'host': os.getenv('PGHOST', 'localhost'),
    'port': os.getenv('PGPORT', '5432'),
    'database': os.getenv('PGDATABASE', 'postgres'),
    'user': os.getenv('PGUSER', os.getenv('USER', 'postgres')),
    'password': os.getenv('PGPASSWORD', ''),
}

def get_connection_string():
    """Get PostgreSQL connection string"""
    if DB_CONFIG['password']:
        return f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
    else:
        return f"postgresql://{DB_CONFIG['user']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"

def get_connection():
    """Create a new PostgreSQL connection"""
    return psycopg2.connect(**DB_CONFIG)

@contextmanager
def get_connection_context():
    """Context manager for PostgreSQL connections"""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def test_connection():
    """Test PostgreSQL connection"""
    try:
        with get_connection_context() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version()")
                version = cur.fetchone()[0]
                print(f"✓ Connected to PostgreSQL: {version}")

                # Check if pg_duckdb extension is available
                cur.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_duckdb'")
                result = cur.fetchone()
                if result:
                    print(f"✓ pg_duckdb extension version: {result[1]}")
                else:
                    print("⚠ pg_duckdb extension not found")

                return True
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_connection()
