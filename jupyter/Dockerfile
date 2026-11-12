FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data
RUN python -c "import nltk; [nltk.download(p) for p in ['punkt', 'punkt_tab', 'stopwords', 'wordnet', 'averaged_perceptron_tagger', 'averaged_perceptron_tagger_eng', 'vader_lexicon']]"

# /app/notebooks is bind-mounted by compose, so the helpers and samples live outside it
COPY workspace_utils.py query_builders.py /app/lib/
ENV PYTHONPATH=/app/lib
COPY notebooks/ /app/samples/

# Token authentication (JUPYTER_TOKEN is required, see entrypoint.sh), XSRF checks on, and
# cross-origin access and iframe embedding limited to JUPYTER_ALLOW_ORIGIN (the app's origin)
COPY jupyter_server_config.py /root/.jupyter/jupyter_server_config.py
COPY entrypoint.sh /app/entrypoint.sh

EXPOSE 8888

CMD ["/app/entrypoint.sh"]
