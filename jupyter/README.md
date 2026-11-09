# Jupyter image

Builds the JupyterLab container used by `docker-compose.yml`.

- `JUPYTER_TOKEN` is required; the container refuses to start without it.
- `JUPYTER_ALLOW_ORIGIN` is the URL you open the app on (CORS and iframe embedding are limited to it).
- Sample notebooks are baked into `/app/samples` and copied into `/app/notebooks` (the bind mount) on
  start without overwriting your edits. `workspace_utils.py` is importable from any notebook.
- `gdelt_sample_export.csv` is a small sample of the public [GDELT](https://www.gdeltproject.org/) event data.

## Notebooks that need extra setup

These are examples from earlier experiments and will not run out of the box in the container:

- `duckdb_gdelt_analysis`, `ollama_gdelt_integration` and `deepseek_gdelt_integration` read a local
  `etl/duckdatabase` file that the container does not have.
- `deepseek_openllm_demo` and `deepseek_gdelt_integration` expect an OpenLLM server at
  `http://localhost:3000`, which is not installed here.

Notebooks are committed without outputs; clear them before committing (`jupyter nbconvert --clear-output`).
