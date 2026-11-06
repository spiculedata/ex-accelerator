# Troubleshooting and FAQ

## Signing in

**"Too many failed attempts. Try again later."** Sign-ins are limited per account (5 failures) and per
client address (20 failures) over 15 minutes. Wait, or restart the app to clear the in-memory counters.
Behind a reverse proxy, set `ADDRESS_HEADER` so the per-address limit sees real client addresses (see
[Deployment](/guide/deployment)); without it the limit applies to the whole site.

**"Your session has expired. Please sign in again."** Sessions last 12 hours by default. Sign in again.

**The app exits at start with a `SESSION_SECRET` error.** Production needs `SESSION_SECRET` (32 or more
characters). Generate one with `openssl rand -hex 32`.

**I signed in but nothing sticks over plain HTTP.** Keep `COOKIE_SECURE=false` for `http://localhost`
and set it to `true` only when the site is served over HTTPS.

**There is no admin account.** The first admin is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD`
(12+ characters) while the user table is empty. See [Authentication and roles](/guide/authentication).

## Empty pages and errors

**A dashboard is empty.** There is no data for that module yet. Load the demo data
(`npm run seed:demo`) or run the pipelines that fill it. Pages for GDELT, radio and image processing
stay empty until their pipelines have run.

**A red banner says "Some data could not be loaded".** A request failed, for example because the
database is unreachable. The banner names each failed request. Reload once the cause is fixed; it
clears when the request succeeds, and when you navigate to another page.

**`extension "pg_duckdb" is not available`.** The app needs PostgreSQL with the `pg_duckdb` extension.
Use the `pgduckdb/pgduckdb:17-main` image (the compose file already does), not plain Postgres.

**`port is already allocated` for 50006.** A local `dapr init` already runs a container on that port.
Stop it (`docker stop dapr_scheduler`) or leave `dapr-placement` out of the compose command.

## Workspaces and datasets

**A dataset would not attach to my workspace.** A notice under the workspaces heading gives the
reason. Administrators can add any dataset; other users need access to it, and granting access is an
administrator action. The demo datasets are public.

**A workspace card says "0 records" although I linked datasets.** Those counters track data sources
added through Data Capture. Linked datasets control what the dashboards show; the Workspace selector
in the navigation shows their post count.

## Data Capture and workflows

**"Failed to load job states."** Data Capture reads job state through Dapr. Start the sidecar with
`npm run dev:dapr` and make sure Redis is running.

**A workflow run fails with `DAPR_SIDECAR_COULD_NOT_BE_STARTED`.** Running a workflow needs the Dapr
sidecar and a Python environment. Building and publishing do not. The failure and its logs are kept on
the execution.

## FAQ

**Is the demo data real?** No. It is generated for a fictional city and contains no real people or
events. Its sources are labelled "Demo".

**Can I use my own data?** Yes. Collect it with the crawler, load datasets with the ETL pipelines (for
example GDELT), or record radio with WavePulse, and add the resulting datasets to a workspace.

**Do I need Dapr?** Only to schedule crawls and run workflows. Browsing dashboards, investigations
and building or publishing workflows work without it.

**How do I reset the demo?** `ALLOW_DEMO_RESET=1 npm run seed:demo -- --reset` on a throwaway database.
It deletes the analytics tables and what hangs off them. Never run it on data you care about.

**Where is data stored?** In one PostgreSQL database. The web app creates and updates its schema
itself on first sign-in (see [Data model](/architecture/data-model)).

**Who can do what?** Administrators can do everything, including running code; users can create and
edit projects, workspaces and investigations; viewers are read-only.

**Something else is wrong.** Check the browser console and the server log, then
[open an issue](https://github.com/spiculedata/ex-accelerator/issues/new/choose). Report security
problems privately as described in the security policy.
