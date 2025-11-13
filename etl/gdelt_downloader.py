import requests
import zipfile
import os
import time
from pathlib import Path
from typing import List, Tuple
import polars as pl
import duckdb
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GDELTDownloader:
    def __init__(self, download_dir: str = "data/gdelt_raw", max_workers: int = 4):
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.max_workers = max_workers
        self.session = requests.Session()
        
    def get_2025_files(self) -> List[Tuple[str, str, str]]:
        """Fetch GDELT masterlist and filter for 2025 files"""
        logger.info("Fetching GDELT masterlist...")
        
        try:
            response = self.session.get(
                'http://data.gdeltproject.org/gdeltv2/masterfilelist.txt',
                verify=False,
                timeout=30
            )
            response.raise_for_status()
            
            files_2025 = []
            for line in response.text.split('\n'):
                if not line.strip():
                    continue
                    
                parts = line.split()
                if len(parts) >= 3:
                    size, hash_val, url = parts[0], parts[1], parts[2]
                    filename = url.split('/')[-1]
                    
                    if filename.startswith('2025'):
                        files_2025.append((size, hash_val, url))
            
            logger.info(f"Found {len(files_2025)} files from 2025")
            return files_2025
            
        except Exception as e:
            logger.error(f"Error fetching masterlist: {e}")
            raise
    
    def download_file(self, url: str, expected_size: str = None) -> Path:
        """Download a single GDELT file"""
        filename = url.split('/')[-1]
        filepath = self.download_dir / filename
        
        if filepath.exists():
            logger.debug(f"File already exists: {filename}")
            return filepath
        
        try:
            logger.info(f"Downloading {filename}...")
            response = self.session.get(url, verify=False, timeout=60, stream=True)
            response.raise_for_status()
            
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            if expected_size and os.path.getsize(filepath) != int(expected_size):
                logger.warning(f"Size mismatch for {filename}: expected {expected_size}, got {os.path.getsize(filepath)}")
            
            return filepath
            
        except Exception as e:
            logger.error(f"Error downloading {filename}: {e}")
            if filepath.exists():
                filepath.unlink()
            raise
    
    def extract_csv(self, zip_path: Path) -> Path:
        """Extract CSV from zip file"""
        csv_path = zip_path.with_suffix('.csv')
        
        if csv_path.exists():
            return csv_path
        
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                csv_files = [f for f in zip_ref.namelist() if f.endswith('.csv') or f.endswith('.CSV')]
                if csv_files:
                    zip_ref.extract(csv_files[0], self.download_dir)
                    extracted_path = self.download_dir / csv_files[0]
                    if extracted_path != csv_path:
                        extracted_path.rename(csv_path)
                    return csv_path
                else:
                    logger.error(f"No CSV file found in {zip_path}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error extracting {zip_path}: {e}")
            return None
    
    def download_batch(self, file_list: List[Tuple[str, str, str]], max_files: int = None):
        """Download a batch of files with threading"""
        if max_files:
            file_list = file_list[:max_files]
        
        logger.info(f"Starting download of {len(file_list)} files...")
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_url = {
                executor.submit(self.download_file, url, size): (url, size) 
                for size, hash_val, url in file_list
            }
            
            completed = 0
            for future in as_completed(future_to_url):
                url, size = future_to_url[future]
                try:
                    filepath = future.result()
                    completed += 1
                    if completed % 100 == 0:
                        logger.info(f"Downloaded {completed}/{len(file_list)} files")
                except Exception as e:
                    logger.error(f"Failed to download {url}: {e}")

if __name__ == "__main__":
    downloader = GDELTDownloader()
    files_2025 = downloader.get_2025_files()
    
    # Download first 10 files as a test
    logger.info("Starting test download of first 10 files...")
    downloader.download_batch(files_2025[:10])