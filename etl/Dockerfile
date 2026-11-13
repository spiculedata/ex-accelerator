FROM python:3.15-slim

WORKDIR /app

# Install system dependencies for psycopg2 and DuckDB
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    libgl1 \
    libglib2.0-0 \
    libxcb1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-etl.txt ./
RUN pip install --no-cache-dir -r requirements-etl.txt

COPY . .

# Default command - override per-job in compose or CI
CMD ["python", "-m", "gdelt_pipeline"]
