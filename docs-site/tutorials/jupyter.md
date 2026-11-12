# Research in Jupyter

For analysis beyond the dashboards, the project ships Jupyter Lab with notebook templates that read
from the same database.

**You need:** Python 3.12+ and [Poetry](https://python-poetry.org/), plus the database running and
`DATABASE_URL` set. This tutorial was written from the project's scripts and templates; it has not
been exercised against the demo stack.

## 1. Install and start

From `ex-accell-ui/`:

```bash
npm run jupyter:bootstrap   # once: installs the Python packages, downloads NLTK data, adds any missing templates
npm run dev:jupyter         # starts the web app and Jupyter Lab together
```

The bootstrap never overwrites a notebook. It writes Jupyter's settings to the project-local `ex-accell-ui/.jupyter/` folder and leaves your own `~/.jupyter` alone. Or start only Jupyter Lab with `npm run jupyter:start`, which prints a `http://localhost:8888/?token=...` link; the token is random on every start.

## 2. Open a template

In the app, open **Research** (`/text-analytics/research-investigation`), choose a notebook template
and select **Start JupyterLab**. You can view the notebook embedded in the page or open it directly in
Jupyter Lab.

Templates live in `ex-accell-ui/notebooks/`, including:

| Notebook | Use |
|----------|-----|
| `00_getting_started.ipynb` | Connect to the database and run a first query |
| `sentiment_analysis.ipynb` | Sentiment with TextBlob and VADER |
| `language_detection.ipynb` | Language analysis across posts |
| `text_classification.ipynb` | Train a custom classifier |
| `cross_platform_analytics.ipynb` | Compare platforms |
| `custom_research.ipynb` | A blank template |

## 3. Add your own template

1. Put the `.ipynb` file in `ex-accell-ui/notebooks/`.
2. Add an entry to the `notebookTemplates` array in
   `src/routes/text-analytics/research-investigation/+page.svelte` with an `id`, `name`,
   `description` and the exact `file` name.

## With Docker Compose

The compose file has a `jupyter` service built from `./jupyter`. It mounts `DATA_DIR/notebooks`, which a one-shot `jupyter-init`
service hands to the container's unprivileged user. It refuses to start without `JUPYTER_TOKEN`, so set one in `.env`
(`openssl rand -hex 32`), then run `docker compose up -d jupyter`. The app opens that service for administrators through
`JUPYTER_URL` (default `http://localhost:8888`) and the same token. `JUPYTER_TOKEN` in `.env` matters only for this route, or when you
point the dev server at your own Jupyter with `JUPYTER_URL`; `npm run dev:jupyter` and the **Start JupyterLab** button create a random
token for every launch and ignore it.

::: tip Upgrading from an earlier version
Re-run `npm run jupyter:bootstrap` once so the project-local `.jupyter/` config exists; without it the
embedded page cannot talk to Jupyter. Older versions also wrote an open configuration to
`~/.jupyter/jupyter_lab_config.py` (no token, any origin, XSRF checks off). The app no longer uses it,
but any other `jupyter lab` you run still does, so delete it unless you rely on it. The bootstrap
warns when it finds that file.
:::

::: tip Which environment variables notebooks see
When the app starts Jupyter, it passes on only a short list of variables, not its own environment (so `SESSION_SECRET` and
`ADMIN_PASSWORD` never reach a notebook): the usual shell basics, `DATABASE_URL` and `PG*`, `OLLAMA_HOST`, `JUPYTER_*`, Python and Poetry
settings, proxy variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` in either case), CA bundle paths (`SSL_CERT_FILE`, `SSL_CERT_DIR`,
`REQUESTS_CA_BUNDLE`, `CURL_CA_BUNDLE`) and model-cache locations (`HF_HOME`, `TRANSFORMERS_CACHE`, `TORCH_HOME`, `NLTK_DATA`, `XDG_CACHE_HOME`).
Any variable whose name contains `TOKEN`, `SECRET`, `PASSWORD`, `API_KEY` or `CREDENTIAL` is dropped (so `HF_TOKEN` is not passed; set it inside the notebook), except `PGPASSWORD`, which notebooks need for the database. Proxy URLs are passed as they are, so a password embedded in one reaches notebooks too. Starting Jupyter yourself with
`npm run jupyter:start` uses your shell's full environment instead.
:::

::: warning Notebooks run code with access to your database
Notebooks can do anything the account running Jupyter can, and they receive database credentials (`DATABASE_URL`, `PGPASSWORD`), so use a database
role with only the rights you want notebooks to have. Stop Jupyter when you are not using it, and never publish port 8888 to a network.

What protects the two routes is set in different places, so check the one you use:

- **Local (`npm run dev:jupyter`, `npm run jupyter:start`, the Start button).** Jupyter listens on `127.0.0.1` only, requires a token
  that is random on every start, keeps cross-site request checks on and accepts cross-origin requests and framing only from the app's own
  address (`JUPYTER_ALLOW_ORIGIN`, default `http://localhost:5173`). This comes from the project-local `.jupyter/` config that
  `npm run jupyter:bootstrap` writes and from the launch settings. The launch controls are administrator-only and hand the tokenised link to the
  signed-in administrator.
- **Compose.** The same guarantees come from the image's own `jupyter/jupyter_server_config.py`: token required, XSRF checks on, origin and
  framing limited to `JUPYTER_ALLOW_ORIGIN` (default `http://localhost:3000`, set it to the URL you open the app on), no root, and the port
  published on `127.0.0.1` only.
- **Your own Jupyter (`JUPYTER_URL` and `JUPYTER_TOKEN`).** The app only passes the token on. It cannot check that the server you point it at
  enforces a token, an origin or framing limits, so configure those yourself.
:::
