# API reference

The web app's HTTP API lives under `/api`. It is an internal API for the UI and may change before
1.0; this page describes its conventions.

## Authentication

Every endpoint except `/api/auth/login`, `/api/auth/logout` and `/api/health` requires a session
cookie obtained from `POST /api/auth/login`. Unauthenticated requests get `401`; requests the role
does not allow get `403`. See [Authentication and roles](/guide/authentication).

```bash
curl -c cookies.txt -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"..."}' http://localhost:3000/api/auth/login
curl -b cookies.txt http://localhost:3000/api/auth/me
```

## Response envelope

```json
{ "success": true, "data": [], "error": null }
```

Errors set `success` to `false` and return a message in `error` with a matching HTTP status. Some endpoints add an optional `meta` object (for example `meta.unavailable` below).

## Endpoint groups

The main groups; others (GDELT, image processing, overview and monitoring endpoints) follow the same rules.

| Prefix | Purpose | Role |
|--------|---------|------|
| `/api/auth/*` | Login, logout, current user | public / any |
| `/api/health` | Liveness | public |
| `/api/unified-analytics` | Dashboard queries (`?type=...`) | any signed-in user |
| `/api/projects`, `/api/workspaces`, `/api/datasets` | Organise research | user (write), viewer (read) |
| `/api/jobs`, `/api/job-state`, `/api/crawler` | Schedule and monitor crawls | user |
| `/api/investigations`, `/api/wavepulse` | Transcript investigations and radio data | user |
| `/api/unified-analytics/query` | Raw SQL | admin |
| `/api/deploy-workflow`, `/api/generate-python-workflow`, `/api/workflows/:id/execute`, `/api/jupyter/*` | Generate, deploy and run code | admin |
| `/api/data-sharing` | Data packages and IPFS publishing ([details](#data-sharing)) | any signed-in user (read), admin (write) |

Viewers are read-only: requests other than `GET`, `HEAD` and `OPTIONS` return `403` (except the public auth routes, so a viewer can still sign out).

## Analytics errors

`/api/unified-analytics` returns HTTP 200 with empty `data` and `meta.unavailable` when the
underlying table does not exist, so modules you have not set up stay quiet. Any other failure
returns `500` with a generic message; details are logged on the server.

## Data sharing

`/api/data-sharing` generates Frictionless Data Packages and publishes them to, or imports them from, the IPFS
network. See the [data sharing guide](/guide/data-sharing); publishing is public, and a withdrawal only stops this node serving it. Reads are open
to every signed-in role; `POST` is admin-only (`403` otherwise). When `IPFS_ENABLED` is not `true`, publishing
and importing answer `503` and the other actions still work.

### `GET /api/data-sharing?action=...`

| Action | Parameters | Response (`200`) |
|--------|------------|------------------|
| `status` | none | `{ success, data: { enabled, connected } }`: `connected` is true once the node has started; asking never starts it |
| `list` (default) | none | `{ success, packages: [{ id, name, title, description, version, created, resources, totalRows, previewRows, publishable }] }` (`publishable` is false for an imported package) |
| `get` | `id` (package id: letters, digits, `-`, `_`) | `{ success, datapackage, preview }` with up to 20 preview rows as objects. `400` for a malformed id, `404` if unknown |
| `registry` | none | `{ success, enabled, packages: [registry rows] }`: packages this install published (rows with status `imported` are kept in the table but not listed) |
| `resolve` | `cid` | `{ success, found: true, package }` when the registry knows the CID, else `{ success, found: false, gateway_url }`. `400` for a malformed CID |

Registry rows have `id`, `dataset_id`, `package_id`, `cid`, `gateway_url`, `package_name`, `description`,
`row_count`, `file_size_bytes`, `status` (`published`, `imported` or `withdrawn`), `published_at`, `withdrawn_at`
and `metadata`; admins also get `published_by` and `withdrawn_by`. The `registry` action lists only `published`
rows; `resolve` also returns a `withdrawn` one, with its status.

### `POST /api/data-sharing` (admin)

The JSON body's `action` selects the operation; without one, a package is generated.

| Body | What happens | Response |
|------|--------------|----------|
| `{ dataset_id, preview_rows? }` | Generates a package for a catalogued dataset: writes `datapackage.json` and a preview CSV (`preview_rows` defaults to 100, at most 1,000). A bare `table_name` is not accepted. | `{ success, package_id, datapackage, preview }`. `400` for a bad id, `404` for an unknown dataset or table, `403` for an application table, `422` when the catalogue row names a table that cannot be exported |
| `{ action: "publish", package_id }` | Exports the full table (up to `MAX_EXPORT_ROWS`), publishes and pins the package directory, records it in the registry. | `{ success, cid, gateway_url, package_id }`. `400`, `403`, `404`, `422` as above; `503` when sharing is off |
| `{ action: "withdraw", cid }` | Unpins a package this install published, garbage-collects the blockstore so the node stops serving it, and marks the registry row `withdrawn` (who and when). It cannot recall copies other nodes already fetched. Repeating it on a withdrawn package answers `200` with `already_withdrawn`. Takes turns with publishing. | `{ success, cid, withdrawn: true, unpinned }` (`unpinned` is false if the package had no pin of its own). `400` for a malformed CID, `404` if the CID is not in the registry, `409` for an imported package, `503` when sharing is off (the node must run to unpin) |
| `{ action: "import", cid }` | Fetches the package, validates it and loads it into a new table named `ipfs_` plus the last 40 characters of the CID (lower-cased), cataloguing it as an `imported` dataset. | `{ success, table_name, row_count, fields, cid, package_title }`. `400` for a malformed CID, `409` if the CID was already imported, `422` when the package is not one this app can load (bad names, header, values or file count) or is over `IPFS_MAX_FETCH_BYTES`, `504` after `IPFS_FETCH_TIMEOUT_MS`, `503` when sharing is off |

Any other failure is a `500` with a generic message; the detail is logged on the server.

```bash
curl -b cookies.txt -H 'content-type: application/json' \
  -d '{"dataset_id": 3}' http://localhost:3000/api/data-sharing
curl -b cookies.txt -H 'content-type: application/json' \
  -d '{"action": "publish", "package_id": "telegram-posts"}' http://localhost:3000/api/data-sharing
```
