import polars as pl
import psycopg2
from psycopg2.extras import execute_values
from pathlib import Path
import logging
from typing import Optional, Dict
import zipfile

from db_config import get_connection_context

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GDELTProcessor:
    def __init__(self):
        self.setup_tables()

    def setup_tables(self):
        """Create PostgreSQL tables for GDELT data"""

        # Events/Export table schema
        events_schema = """
        CREATE TABLE IF NOT EXISTS gdelt_events (
            GLOBALEVENTID BIGINT,
            SQLDATE INTEGER,
            MonthYear INTEGER,
            Year INTEGER,
            FractionDate DOUBLE PRECISION,
            Actor1Code VARCHAR,
            Actor1Name VARCHAR,
            Actor1CountryCode VARCHAR,
            Actor1KnownGroupCode VARCHAR,
            Actor1EthnicCode VARCHAR,
            Actor1Religion1Code VARCHAR,
            Actor1Religion2Code VARCHAR,
            Actor1Type1Code VARCHAR,
            Actor1Type2Code VARCHAR,
            Actor1Type3Code VARCHAR,
            Actor2Code VARCHAR,
            Actor2Name VARCHAR,
            Actor2CountryCode VARCHAR,
            Actor2KnownGroupCode VARCHAR,
            Actor2EthnicCode VARCHAR,
            Actor2Religion1Code VARCHAR,
            Actor2Religion2Code VARCHAR,
            Actor2Type1Code VARCHAR,
            Actor2Type2Code VARCHAR,
            Actor2Type3Code VARCHAR,
            IsRootEvent INTEGER,
            EventCode VARCHAR,
            EventBaseCode VARCHAR,
            EventRootCode VARCHAR,
            QuadClass INTEGER,
            GoldsteinScale DOUBLE PRECISION,
            NumMentions INTEGER,
            NumSources INTEGER,
            NumArticles INTEGER,
            AvgTone DOUBLE PRECISION,
            Actor1Geo_Type INTEGER,
            Actor1Geo_Fullname VARCHAR,
            Actor1Geo_CountryCode VARCHAR,
            Actor1Geo_ADM1Code VARCHAR,
            Actor1Geo_ADM2Code VARCHAR,
            Actor1Geo_Lat DOUBLE PRECISION,
            Actor1Geo_Long DOUBLE PRECISION,
            Actor1Geo_FeatureID VARCHAR,
            Actor2Geo_Type INTEGER,
            Actor2Geo_Fullname VARCHAR,
            Actor2Geo_CountryCode VARCHAR,
            Actor2Geo_ADM1Code VARCHAR,
            Actor2Geo_ADM2Code VARCHAR,
            Actor2Geo_Lat DOUBLE PRECISION,
            Actor2Geo_Long DOUBLE PRECISION,
            Actor2Geo_FeatureID VARCHAR,
            ActionGeo_Type INTEGER,
            ActionGeo_Fullname VARCHAR,
            ActionGeo_CountryCode VARCHAR,
            ActionGeo_ADM1Code VARCHAR,
            ActionGeo_ADM2Code VARCHAR,
            ActionGeo_Lat DOUBLE PRECISION,
            ActionGeo_Long DOUBLE PRECISION,
            ActionGeo_FeatureID VARCHAR,
            DATEADDED BIGINT,
            SOURCEURL VARCHAR
        )
        """

        # Mentions table schema
        mentions_schema = """
        CREATE TABLE IF NOT EXISTS gdelt_mentions (
            GLOBALEVENTID BIGINT,
            EventTimeDate BIGINT,
            MentionTimeDate BIGINT,
            MentionType INTEGER,
            MentionSourceName VARCHAR,
            MentionIdentifier VARCHAR,
            SentenceID INTEGER,
            Actor1CharOffset INTEGER,
            Actor2CharOffset INTEGER,
            ActionCharOffset INTEGER,
            InRawText INTEGER,
            Confidence INTEGER,
            MentionDocLen INTEGER,
            MentionDocTone DOUBLE PRECISION,
            MentionDocTranslationInfo VARCHAR,
            Extras VARCHAR
        )
        """

        # GKG table schema
        gkg_schema = """
        CREATE TABLE IF NOT EXISTS gdelt_gkg (
            GKGRECORDID VARCHAR,
            DATE BIGINT,
            SourceCollectionIdentifier INTEGER,
            SourceCommonName VARCHAR,
            DocumentIdentifier VARCHAR,
            Counts VARCHAR,
            V2Counts VARCHAR,
            Themes VARCHAR,
            V2Themes VARCHAR,
            Locations VARCHAR,
            V2Locations VARCHAR,
            Persons VARCHAR,
            V2Persons VARCHAR,
            Organizations VARCHAR,
            V2Organizations VARCHAR,
            V2Tone VARCHAR,
            Dates VARCHAR,
            GCAM VARCHAR,
            SharingImage VARCHAR,
            RelatedImages VARCHAR,
            SocialImageEmbeds VARCHAR,
            SocialVideoEmbeds VARCHAR,
            Quotations VARCHAR,
            AllNames VARCHAR,
            Amounts VARCHAR,
            TranslationInfo VARCHAR,
            Extras VARCHAR
        )
        """

        with get_connection_context() as conn:
            with conn.cursor() as cur:
                cur.execute(events_schema)
                cur.execute(mentions_schema)
                cur.execute(gkg_schema)
                logger.info("Database tables created successfully")

    def get_file_type(self, filename: str) -> Optional[str]:
        """Determine file type from filename"""
        if '.export.' in filename.lower():
            return 'events'
        elif '.mentions.' in filename.lower():
            return 'mentions'
        elif '.gkg.' in filename.lower():
            return 'gkg'
        return None

    def process_csv_streaming(self, csv_path: Path, file_type: str, batch_size: int = 10000):
        """Process CSV file using Polars streaming and insert into PostgreSQL"""
        logger.info(f"Processing {file_type} file: {csv_path.name}")

        try:
            # Use Polars streaming to read large CSV files
            df_stream = pl.scan_csv(
                csv_path,
                has_header=False,
                separator='\t',
                quote_char=None,
                null_values=[''],
                ignore_errors=True
            )

            # Collect the stream to process in batches
            df = df_stream.collect()

            # Process data based on file type
            if file_type == 'events':
                self._process_events_data(df, batch_size)
            elif file_type == 'mentions':
                self._process_mentions_data(df, batch_size)
            elif file_type == 'gkg':
                self._process_gkg_data(df, batch_size)

            processed_rows = len(df)
            logger.info(f"Processed {processed_rows} rows from {csv_path.name}")

        except Exception as e:
            logger.error(f"Error processing {csv_path}: {e}")
            raise

    def _process_events_data(self, df: pl.DataFrame, batch_size: int):
        """Process events data and insert into PostgreSQL"""
        # Ensure we have the right number of columns
        expected_cols = 61
        if df.shape[1] < expected_cols:
            for i in range(df.shape[1], expected_cols):
                df = df.with_columns(pl.lit(None).alias(f"col_{i}"))

        # Rename columns to match schema
        column_names = [
            'GLOBALEVENTID', 'SQLDATE', 'MonthYear', 'Year', 'FractionDate',
            'Actor1Code', 'Actor1Name', 'Actor1CountryCode', 'Actor1KnownGroupCode', 'Actor1EthnicCode',
            'Actor1Religion1Code', 'Actor1Religion2Code', 'Actor1Type1Code', 'Actor1Type2Code', 'Actor1Type3Code',
            'Actor2Code', 'Actor2Name', 'Actor2CountryCode', 'Actor2KnownGroupCode', 'Actor2EthnicCode',
            'Actor2Religion1Code', 'Actor2Religion2Code', 'Actor2Type1Code', 'Actor2Type2Code', 'Actor2Type3Code',
            'IsRootEvent', 'EventCode', 'EventBaseCode', 'EventRootCode', 'QuadClass',
            'GoldsteinScale', 'NumMentions', 'NumSources', 'NumArticles', 'AvgTone',
            'Actor1Geo_Type', 'Actor1Geo_Fullname', 'Actor1Geo_CountryCode', 'Actor1Geo_ADM1Code', 'Actor1Geo_ADM2Code',
            'Actor1Geo_Lat', 'Actor1Geo_Long', 'Actor1Geo_FeatureID',
            'Actor2Geo_Type', 'Actor2Geo_Fullname', 'Actor2Geo_CountryCode', 'Actor2Geo_ADM1Code', 'Actor2Geo_ADM2Code',
            'Actor2Geo_Lat', 'Actor2Geo_Long', 'Actor2Geo_FeatureID',
            'ActionGeo_Type', 'ActionGeo_Fullname', 'ActionGeo_CountryCode', 'ActionGeo_ADM1Code', 'ActionGeo_ADM2Code',
            'ActionGeo_Lat', 'ActionGeo_Long', 'ActionGeo_FeatureID',
            'DATEADDED', 'SOURCEURL'
        ]

        df = df.select([pl.col(f"column_{i+1}").alias(column_names[i]) for i in range(min(len(column_names), df.shape[1]))])

        # Insert in batches using psycopg2
        with get_connection_context() as conn:
            with conn.cursor() as cur:
                for i in range(0, len(df), batch_size):
                    batch = df.slice(i, batch_size)
                    # Convert to list of tuples
                    data = [tuple(row) for row in batch.iter_rows()]

                    insert_sql = f"""
                    INSERT INTO gdelt_events ({','.join(column_names)})
                    VALUES %s
                    """
                    execute_values(cur, insert_sql, data)

                    if i % (batch_size * 10) == 0 and i > 0:
                        logger.info(f"Inserted {i} rows...")

    def _process_mentions_data(self, df: pl.DataFrame, batch_size: int):
        """Process mentions data and insert into PostgreSQL"""
        expected_cols = 16
        if df.shape[1] < expected_cols:
            for i in range(df.shape[1], expected_cols):
                df = df.with_columns(pl.lit(None).alias(f"col_{i}"))

        column_names = [
            'GLOBALEVENTID', 'EventTimeDate', 'MentionTimeDate', 'MentionType', 'MentionSourceName',
            'MentionIdentifier', 'SentenceID', 'Actor1CharOffset', 'Actor2CharOffset', 'ActionCharOffset',
            'InRawText', 'Confidence', 'MentionDocLen', 'MentionDocTone', 'MentionDocTranslationInfo', 'Extras'
        ]

        df = df.select([pl.col(f"column_{i+1}").alias(column_names[i]) for i in range(min(len(column_names), df.shape[1]))])

        with get_connection_context() as conn:
            with conn.cursor() as cur:
                for i in range(0, len(df), batch_size):
                    batch = df.slice(i, batch_size)
                    data = [tuple(row) for row in batch.iter_rows()]

                    insert_sql = f"""
                    INSERT INTO gdelt_mentions ({','.join(column_names)})
                    VALUES %s
                    """
                    execute_values(cur, insert_sql, data)

                    if i % (batch_size * 10) == 0 and i > 0:
                        logger.info(f"Inserted {i} rows...")

    def _process_gkg_data(self, df: pl.DataFrame, batch_size: int):
        """Process GKG data and insert into PostgreSQL"""
        expected_cols = 27
        if df.shape[1] < expected_cols:
            for i in range(df.shape[1], expected_cols):
                df = df.with_columns(pl.lit(None).alias(f"col_{i}"))

        column_names = [
            'GKGRECORDID', 'DATE', 'SourceCollectionIdentifier', 'SourceCommonName', 'DocumentIdentifier',
            'Counts', 'V2Counts', 'Themes', 'V2Themes', 'Locations', 'V2Locations', 'Persons', 'V2Persons',
            'Organizations', 'V2Organizations', 'V2Tone', 'Dates', 'GCAM', 'SharingImage', 'RelatedImages',
            'SocialImageEmbeds', 'SocialVideoEmbeds', 'Quotations', 'AllNames', 'Amounts', 'TranslationInfo', 'Extras'
        ]

        df = df.select([pl.col(f"column_{i+1}").alias(column_names[i]) for i in range(min(len(column_names), df.shape[1]))])

        with get_connection_context() as conn:
            with conn.cursor() as cur:
                for i in range(0, len(df), batch_size):
                    batch = df.slice(i, batch_size)
                    data = [tuple(row) for row in batch.iter_rows()]

                    insert_sql = f"""
                    INSERT INTO gdelt_gkg ({','.join(column_names)})
                    VALUES %s
                    """
                    execute_values(cur, insert_sql, data)

                    if i % (batch_size * 10) == 0 and i > 0:
                        logger.info(f"Inserted {i} rows...")

    def process_zip_file(self, zip_path: Path):
        """Process a single ZIP file"""
        file_type = self.get_file_type(zip_path.name)
        if not file_type:
            logger.warning(f"Unknown file type: {zip_path.name}")
            return

        # Extract and process CSV
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                csv_files = [f for f in zip_ref.namelist() if f.endswith('.csv') or f.endswith('.CSV')]
                if csv_files:
                    csv_file = csv_files[0]
                    zip_ref.extract(csv_file, zip_path.parent)
                    csv_path = zip_path.parent / csv_file

                    self.process_csv_streaming(csv_path, file_type)

                    # Clean up extracted CSV
                    csv_path.unlink()

        except Exception as e:
            logger.error(f"Error processing zip file {zip_path}: {e}")

    def get_table_counts(self) -> Dict[str, int]:
        """Get row counts for all tables"""
        counts = {}
        with get_connection_context() as conn:
            with conn.cursor() as cur:
                for table in ['gdelt_events', 'gdelt_mentions', 'gdelt_gkg']:
                    cur.execute(f"SELECT COUNT(*) FROM {table}")
                    result = cur.fetchone()
                    counts[table] = result[0] if result else 0
        return counts

    def migrate_from_duckdb(self, duckdb_path: str = "./duckdatabase"):
        """Migrate data from existing DuckDB database to PostgreSQL"""
        import duckdb

        logger.info(f"Starting migration from DuckDB: {duckdb_path}")

        # Connect to DuckDB
        duck_conn = duckdb.connect(duckdb_path, read_only=True)

        # Get list of tables to migrate
        tables_to_migrate = ['gdelt_events', 'gdelt_mentions', 'gdelt_gkg']

        for table in tables_to_migrate:
            try:
                # Check if table exists in DuckDB
                result = duck_conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
                row_count = result[0] if result else 0

                if row_count == 0:
                    logger.info(f"Table {table} is empty in DuckDB, skipping...")
                    continue

                logger.info(f"Migrating {row_count} rows from {table}...")

                # Read data from DuckDB in batches
                batch_size = 10000
                offset = 0

                with get_connection_context() as pg_conn:
                    with pg_conn.cursor() as cur:
                        while offset < row_count:
                            # Fetch batch from DuckDB
                            df = duck_conn.execute(
                                f"SELECT * FROM {table} LIMIT {batch_size} OFFSET {offset}"
                            ).pl()

                            if len(df) == 0:
                                break

                            # Get column names
                            col_names = df.columns

                            # Convert to list of tuples
                            data = [tuple(row) for row in df.iter_rows()]

                            # Insert into PostgreSQL
                            insert_sql = f"""
                            INSERT INTO {table} ({','.join(col_names)})
                            VALUES %s
                            """
                            execute_values(cur, insert_sql, data)

                            offset += batch_size
                            logger.info(f"Migrated {offset}/{row_count} rows from {table}...")

                logger.info(f"✓ Successfully migrated {table}")

            except Exception as e:
                logger.error(f"Error migrating {table}: {e}")
                continue

        duck_conn.close()
        logger.info("Migration complete!")

if __name__ == "__main__":
    processor = GDELTProcessor()

    # Check if we should migrate from existing DuckDB
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "migrate":
        processor.migrate_from_duckdb()
    else:
        # Test with downloaded files
        data_dir = Path("data/gdelt_raw")
        if data_dir.exists():
            zip_files = list(data_dir.glob("*.zip"))
            logger.info(f"Found {len(zip_files)} zip files to process")

            for zip_file in zip_files[:5]:  # Process first 5 files as test
                processor.process_zip_file(zip_file)

            counts = processor.get_table_counts()
            logger.info(f"Table counts: {counts}")
        else:
            logger.info("No data directory found. Run gdelt_downloader.py first.")
