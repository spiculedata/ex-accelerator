# Research in Jupyter

For analysis beyond the dashboards, the project ships Jupyter Lab with notebook templates that read
from the same database.

**You need:** Python 3.12+ and [Poetry](https://python-poetry.org/), plus the database running and
`DATABASE_URL` set. This tutorial was written from the project's scripts and templates; it has not
been exercised against the demo stack.

## 1. Install and start

From `ex-accell-ui/`:

```bash
npm run jupyter:bootstrap   # once: installs the Python packages and downloads NLTK data
npm run dev:jupyter         # starts the web app and Jupyter Lab together
```

Or start only Jupyter Lab with `npm run jupyter:start` and open `http://localhost:8888`.

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

::: danger Run Jupyter only on a trusted, single-user machine
Notebooks run arbitrary code with access to your database, and the bootstrap script currently writes a
Jupyter configuration with **no authentication and cross-origin access enabled** to your global
`~/.jupyter` folder. While that is the case, any web page you visit could reach a running Jupyter
Lab. Never expose it to a network or the internet, and stop it when you are not using it. Making this
safe is tracked in [#101](https://github.com/spiculedata/ex-accelerator/issues/101). The Research
page's launch controls are administrator-only.
:::
