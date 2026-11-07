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

The compose file has a `jupyter` service that mounts `DATA_DIR/notebooks`. Its build context
(`./jupyter`) is not complete in the repository yet, so use the local Poetry route above for now.

::: tip Upgrading from an earlier version
Re-run `npm run jupyter:bootstrap` once so the project-local `.jupyter/` config exists; without it the
embedded page cannot talk to Jupyter. Older versions also wrote an open configuration to
`~/.jupyter/jupyter_lab_config.py` (no token, any origin, XSRF checks off). The app no longer uses it,
but any other `jupyter lab` you run still does, so delete it unless you rely on it. The bootstrap
warns when it finds that file.
:::

::: warning Notebooks run code with access to your database
Jupyter Lab listens on `127.0.0.1` only, requires a token (random on every start unless you set `JUPYTER_TOKEN`), keeps cross-site
request checks on and accepts cross-origin requests only from the app's own address. The Research
page's launch controls are administrator-only, and they hand the tokenised link to the signed-in
administrator. Notebooks receive the app's database credentials (`DATABASE_URL`), so use a database role with only the rights you want notebooks to have. Do not publish port 8888 to a network, and stop Jupyter when you are not using it. The
compose file publishes it on `127.0.0.1`; set `JUPYTER_TOKEN` in `.env` so the app can open it. `JUPYTER_ALLOW_ORIGIN` defaults to `http://localhost:3000` for compose and to `http://localhost:5173` for the local dev scripts.
:::
