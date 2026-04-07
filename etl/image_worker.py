#!/usr/bin/env python3
"""
Image Processing Worker — continuously polls the queue and processes images.
Runs as a long-lived service alongside the main application.
"""

import time
import logging
import sys

from image_pipeline import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

POLL_INTERVAL = 5  # seconds


def main():
    logger.info("Image processing worker started — polling every %ds", POLL_INTERVAL)

    while True:
        try:
            processed = run_pipeline(limit=10)
            if processed > 0:
                logger.info(f"Processed {processed} images, checking for more...")
                continue  # Check immediately for more
        except Exception as e:
            logger.error(f"Pipeline error: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
