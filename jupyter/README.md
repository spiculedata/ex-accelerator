# Jupyter image

Builds the JupyterLab container used by `docker-compose.yml`.

- `JUPYTER_TOKEN` is required; the container refuses to start without it.
- `JUPYTER_ALLOW_ORIGIN` is the URL you open the app on (CORS and iframe embedding are limited to it).
- Sample notebooks are baked into `/app/samples` and copied into `/app/notebooks` (the bind mount) on
  start without overwriting your edits. `workspace_utils.py` is importable from any notebook.
- The container runs as the unprivileged user `jupyter` (uid/gid 1000), not root. The notebooks folder bind-mounted at
  `/app/notebooks` must be writable by that user. In `docker-compose.yml` the one-shot `jupyter-init` service does that
  (`chown -R 1000:1000`) before Jupyter starts, including for a folder Docker just created as root and for one left
  by the earlier root image. If you run the image yourself, prepare the folder once:
  `sudo mkdir -p notebooks && sudo chown -R 1000:1000 notebooks`. For another uid, build with
  `--build-arg JUPYTER_UID=... --build-arg JUPYTER_GID=...` (and change the numbers in `jupyter-init`). When the folder is not
  writable the container stops with a message saying so.
- Jupyter's configuration lives in `/etc/jupyter/jupyter_server_config.py`, not in a home directory.
- Python packages are bounded in `requirements.txt` and pinned exactly in `requirements.lock` (used as a pip
  constraints file), so a rebuild gives the same versions. To update, rebuild without the lock, run
  `docker run --rm --entrypoint pip <image> freeze`, replace the entries in `requirements.lock` (keep its header)
  and let the CI image job confirm the result.
- `gdelt_sample_export.csv` is a small sample of the public [GDELT](https://www.gdeltproject.org/) event data.

## Example notebooks that need extra setup

The notebooks in `notebooks/examples/` are experiments from earlier work. They are not ported to
`workspace_utils` and Postgres, so they will not run out of the box in the container; they are kept as
starting points. (A notebook that does run against the database, such as `sentiment_analysis`, lives
one level up.)

- `duckdb_gdelt_analysis`, `ollama_gdelt_integration` and `deepseek_gdelt_integration` read a local
  `etl/duckdatabase` file that the container does not have.
- `deepseek_openllm_demo` and `deepseek_gdelt_integration` expect an OpenLLM server at
  `http://localhost:3000`, which is not installed here.

Notebooks are committed without outputs or execution counts. `.pre-commit-config.yaml` runs `nbstripout` for you
(`pip install pre-commit && pre-commit install`), and a test in CI fails if one slips through; to fix a notebook by hand run
`pip install nbstripout && nbstripout path/to/notebook.ipynb`.

## Tests

- `cd jupyter && python -m pytest` runs the unit tests for the SQL builders and the notebook-output check (needs only pytest).
- `jupyter/tests/smoke.sh IMAGE` starts a built image with a token and checks 403 without it, 200 with it, the
  framing header, seeded samples and that it does not run as root. The `Jupyter` workflow runs both.
