# Jupyter image

Builds the JupyterLab container used by `docker-compose.yml`.

- `JUPYTER_TOKEN` is required; the container refuses to start without it.
- `JUPYTER_ALLOW_ORIGIN` is the URL you open the app on (CORS and iframe embedding are limited to it).
- Sample notebooks are baked into `/app/samples` and copied into `/app/notebooks` (the bind mount) on
  start without overwriting your edits. `workspace_utils.py` is importable from any notebook.
- The container runs as the unprivileged user `jupyter` (uid/gid 1000), not root. The notebooks folder you
  bind-mount at `/app/notebooks` (`${DATA_DIR}/notebooks` in compose) must be writable by that user. Docker creates a
  missing host folder as root, so prepare it once: `sudo mkdir -p "$DATA_DIR/notebooks" && sudo chown -R 1000:1000 "$DATA_DIR/notebooks"`.
  If your host user has a different uid, build with `--build-arg JUPYTER_UID=... --build-arg JUPYTER_GID=...`. When
  the folder is not writable the container stops with a message saying so. **Upgrading from the root image:** run the
  same `chown` on the existing folder before starting the new image.
- Jupyter's configuration lives in `/etc/jupyter/jupyter_server_config.py`, not in a home directory.
- Python packages are bounded in `requirements.txt` and pinned exactly in `requirements.lock` (used as a pip
  constraints file), so a rebuild gives the same versions. To update, rebuild without the lock, run
  `docker run --rm --entrypoint pip <image> freeze`, replace the entries in `requirements.lock` (keep its header)
  and let the CI image job confirm the result.
- `gdelt_sample_export.csv` is a small sample of the public [GDELT](https://www.gdeltproject.org/) event data.

## Notebooks that need extra setup

These are examples from earlier experiments and will not run out of the box in the container:

- `duckdb_gdelt_analysis`, `ollama_gdelt_integration` and `deepseek_gdelt_integration` read a local
  `etl/duckdatabase` file that the container does not have.
- `deepseek_openllm_demo` and `deepseek_gdelt_integration` expect an OpenLLM server at
  `http://localhost:3000`, which is not installed here.

Notebooks are committed without outputs; clear them before committing (`jupyter nbconvert --clear-output`).

## Tests

- `cd jupyter && python -m pytest` runs the unit tests for the SQL builders (needs only pytest).
- `jupyter/tests/smoke.sh IMAGE` starts a built image with a token and checks 403 without it, 200 with it, the
  framing header, seeded samples and that it does not run as root. The `Jupyter` workflow runs both.
