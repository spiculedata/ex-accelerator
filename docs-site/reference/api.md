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

The main groups; others (GDELT, image processing, data sharing, overview and monitoring endpoints) follow the same rules.

| Prefix | Purpose | Role |
|--------|---------|------|
| `/api/auth/*` | Login, logout, current user | public / any |
| `/api/health` | Liveness | public |
| `/api/unified-analytics` | Dashboard queries (`?type=...`) | any signed-in user |
| `/api/projects`, `/api/workspaces`, `/api/datasets` | Organise research | user (write), viewer (read) |
| `/api/jobs`, `/api/job-state`, `/api/crawler` | Schedule and monitor crawls | user |
| `/api/investigations`, `/api/wavepulse` | Transcript investigations and radio data | user |
| `/api/unified-analytics/query`, `/api/unified-analytics/seed` | Raw SQL and destructive seeding | admin |
| `/api/deploy-workflow`, `/api/generate-python-workflow`, `/api/workflows/:id/execute`, `/api/jupyter/*` | Generate, deploy and run code | admin |

Viewers are read-only: requests other than `GET`, `HEAD` and `OPTIONS` return `403` (except the public auth routes, so a viewer can still sign out).

## Analytics errors

`/api/unified-analytics` returns HTTP 200 with empty `data` and `meta.unavailable` when the
underlying table does not exist, so modules you have not set up stay quiet. Any other failure
returns `500` with a generic message; details are logged on the server.
