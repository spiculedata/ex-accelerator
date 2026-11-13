FROM python:3.15-slim

WORKDIR /app

# System deps for audio processing + ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# PyTorch CPU-only (separate install to avoid index conflict)
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchaudio

# Download NLTK data
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab'); nltk.download('stopwords'); nltk.download('vader_lexicon')"

# Copy WavePulse source
COPY src/ /app/src/
COPY assets/ /app/assets/
COPY api_server.py /app/api_server.py

# Data directories
RUN mkdir -p /app/data/recordings /app/data/transcripts /app/data/classified

# CPU mode defaults
ENV DEVICE=cpu
ENV COMPUTE_TYPE=float32
ENV WAVEPULSE_PORT=8890

EXPOSE 8890

# Run the API server (which can start/stop WavePulse)
CMD ["python", "api_server.py"]
