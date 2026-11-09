FROM python:3.12-slim

WORKDIR /app

# System deps for psycopg2 and matplotlib
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab'); nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('averaged_perceptron_tagger'); nltk.download('vader_lexicon')"

# Copy notebooks and workspace utilities
COPY notebooks/ /app/notebooks/
COPY workspace_utils.py /app/notebooks/workspace_utils.py

# Jupyter config: token authentication (JUPYTER_TOKEN is required at run time), XSRF checks on, and
# cross-origin access and iframe embedding limited to JUPYTER_ALLOW_ORIGIN (the app's origin)
RUN mkdir -p /root/.jupyter && echo "\
import os\n\
app_origin = os.environ.get('JUPYTER_ALLOW_ORIGIN', '')\n\
c.ServerApp.allow_origin = app_origin\n\
c.ServerApp.tornado_settings = {'headers': {'Content-Security-Policy': \"frame-ancestors 'self' \" + app_origin}}\n\
c.ServerApp.allow_remote_access = True\n\
c.ServerApp.ip = '0.0.0.0'\n\
c.ServerApp.port = 8888\n\
c.ServerApp.open_browser = False\n\
c.ServerApp.root_dir = '/app/notebooks'\n\
c.ServerApp.allow_root = True\n\
" > /root/.jupyter/jupyter_lab_config.py

EXPOSE 8888

CMD ["jupyter", "lab"]
