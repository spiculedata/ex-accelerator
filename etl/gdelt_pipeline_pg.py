#!/usr/bin/env python3
"""
GDELT 2025 Data Processing Pipeline (PostgreSQL Edition)

This script downloads all GDELT files from 2025 and processes them into a PostgreSQL database
using Polars streaming for efficient memory usage.
"""

import argparse
import logging
from pathlib import Path
import sys
from typing import Optional

from gdelt_downloader import GDELTDownloader
from gdelt_processor_pg import GDELTProcessor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('gdelt_pipeline.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class GDELTPipeline:
    def __init__(self,
                 download_dir: str = "data/gdelt_raw",
                 max_workers: int = 4):
        self.download_dir = Path(download_dir)
        self.max_workers = max_workers

        self.downloader = GDELTDownloader(download_dir, max_workers)
        self.processor = GDELTProcessor()

    def run_full_pipeline(self, max_files: Optional[int] = None, resume: bool = False):
        """Run the complete pipeline: download and process all 2025 GDELT files"""
        logger.info("Starting GDELT 2025 data processing pipeline (PostgreSQL)")

        try:
            # Step 1: Get list of 2025 files
            logger.info("Fetching 2025 file list from GDELT masterlist...")
            files_2025 = self.downloader.get_2025_files()

            if max_files:
                files_2025 = files_2025[:max_files]
                logger.info(f"Limited to first {max_files} files")

            # Step 2: Download files
            if not resume:
                logger.info(f"Starting download of {len(files_2025)} files...")
                self.downloader.download_batch(files_2025)
            else:
                logger.info("Resume mode: skipping download, processing existing files")

            # Step 3: Process downloaded files
            logger.info("Processing downloaded files...")
            self.process_downloaded_files()

            # Step 4: Report statistics
            self.report_statistics()

            logger.info("Pipeline completed successfully!")

        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            raise

    def process_downloaded_files(self):
        """Process all downloaded ZIP files"""
        zip_files = list(self.download_dir.glob("*.zip"))
        logger.info(f"Found {len(zip_files)} ZIP files to process")

        if not zip_files:
            logger.warning("No ZIP files found to process")
            return

        processed_count = 0
        for zip_file in zip_files:
            try:
                self.processor.process_zip_file(zip_file)
                processed_count += 1

                if processed_count % 100 == 0:
                    logger.info(f"Processed {processed_count}/{len(zip_files)} files")
                    self.report_statistics()

            except Exception as e:
                logger.error(f"Failed to process {zip_file}: {e}")
                continue

        logger.info(f"Successfully processed {processed_count}/{len(zip_files)} files")

    def report_statistics(self):
        """Report current database statistics"""
        try:
            counts = self.processor.get_table_counts()
            logger.info("Current database statistics:")
            for table, count in counts.items():
                logger.info(f"  {table}: {count:,} rows")

            total_rows = sum(counts.values())
            logger.info(f"  Total rows: {total_rows:,}")

        except Exception as e:
            logger.error(f"Error getting statistics: {e}")

    def migrate_from_duckdb(self, duckdb_path: str = "./duckdatabase"):
        """Migrate data from existing DuckDB database"""
        logger.info(f"Starting migration from DuckDB: {duckdb_path}")
        try:
            self.processor.migrate_from_duckdb(duckdb_path)
            logger.info("Migration completed successfully!")
            self.report_statistics()
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

def main():
    parser = argparse.ArgumentParser(description="GDELT 2025 Data Processing Pipeline (PostgreSQL)")
    parser.add_argument("--max-files", type=int, help="Maximum number of files to process (for testing)")
    parser.add_argument("--max-workers", type=int, default=4, help="Maximum number of download workers")
    parser.add_argument("--download-dir", default="data/gdelt_raw", help="Directory for downloaded files")
    parser.add_argument("--resume", action="store_true", help="Resume processing without downloading")
    parser.add_argument("--test", action="store_true", help="Run test with first 10 files")
    parser.add_argument("--migrate", action="store_true", help="Migrate data from existing DuckDB database")
    parser.add_argument("--duckdb-path", default="./duckdatabase", help="Path to DuckDB database for migration")

    args = parser.parse_args()

    if args.test:
        args.max_files = 10
        logger.info("Running in test mode with 10 files")

    pipeline = GDELTPipeline(
        download_dir=args.download_dir,
        max_workers=args.max_workers
    )

    try:
        if args.migrate:
            # Migrate from existing DuckDB
            pipeline.migrate_from_duckdb(args.duckdb_path)
        else:
            # Run normal pipeline
            pipeline.run_full_pipeline(
                max_files=args.max_files,
                resume=args.resume
            )
    except KeyboardInterrupt:
        logger.info("Pipeline interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
