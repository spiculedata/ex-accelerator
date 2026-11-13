FROM python:3.15-slim

# Jupyter runs notebooks, which are arbitrary code with the database credentials, so it must not be root.
# 1000:1000 is the usual first user on a Linux host; change both numbers if your bind mount is owned by
# someone else (see README.md).
ARG JUPYTER_UID=1000
ARG JUPYTER_GID=1000
RUN groupadd --non-unique --gid ${JUPYTER_GID} jupyter \
    && useradd --non-unique --uid ${JUPYTER_UID} --gid ${JUPYTER_GID} --create-home --shell /usr/sbin/nologin jupyter

WORKDIR /app

# requirements.txt says what we use; requirements.lock pins every package, direct and transitive
COPY requirements.txt requirements.lock ./
RUN pip install --no-cache-dir -r requirements.txt -c requirements.lock

# NLTK data is shared by every user, so it lives outside any home directory
ENV NLTK_DATA=/usr/share/nltk_data
RUN python -c "import nltk; [nltk.download(p, download_dir='/usr/share/nltk_data') for p in ['punkt', 'punkt_tab', 'stopwords', 'wordnet', 'averaged_perceptron_tagger', 'averaged_perceptron_tagger_eng', 'vader_lexicon']]"

# /app/notebooks is bind-mounted by compose, so the helpers and samples live outside it
COPY workspace_utils.py query_builders.py /app/lib/
ENV PYTHONPATH=/app/lib
COPY notebooks/ /app/samples/

# Token authentication (JUPYTER_TOKEN is required, see entrypoint.sh), XSRF checks on, and
# cross-origin access and iframe embedding limited to JUPYTER_ALLOW_ORIGIN (the app's origin).
# The system-wide config path is used so it applies whatever the user's home directory holds.
COPY jupyter_server_config.py /etc/jupyter/jupyter_server_config.py
COPY entrypoint.sh /app/entrypoint.sh

# Only /app/notebooks (the bind mount) and the user's home need to be writable
RUN mkdir -p /app/notebooks && chown jupyter:jupyter /app/notebooks && chmod +x /app/entrypoint.sh

USER jupyter
EXPOSE 8888

CMD ["/app/entrypoint.sh"]
