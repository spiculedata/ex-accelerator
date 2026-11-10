# Authentication and roles

Social Explorer uses server-side sessions. Users are stored in PostgreSQL (`app_users`, created
automatically) with passwords hashed using scrypt. Signing in sets an `HttpOnly`, `SameSite=Lax`
session cookie that is signed with `SESSION_SECRET`.

## Who can see which project

Projects record their members (the person who creates one becomes its owner, and team members are added from the new
project form). A signed-in user can open only the projects they are a member of, and the workspaces, investigations
and analytics that belong to them; administrators see everything.

- Lists (projects, Home, investigations) show only what you may see.
- A request for something you may not see answers `403`, and a page shows a plain "no access" page.
- A project from before accounts existed has no real member (its owner is a placeholder such as `default_user`), so it
  stays open to every signed-in user until a real person is added to it. This keeps an upgrade from hiding existing
  work.
- An id that is not a plain whole number (`9abc`, ` 9`, `+9`, `09`) is refused with `400` rather than guessed at.
- **What this does not cover:** raw posts and analytics requested *without* a workspace (`/api/posts`,
  `/api/unified-analytics`, `/api/datasets`), GDELT, image processing, crawling jobs and workflows are
  installation-wide, not project-scoped. Anyone signed in can read them; only the project, workspace and
  investigation views above are limited by membership.
- Membership is remembered for 30 seconds, so adding or removing a member takes effect within that time.
- If membership cannot be checked (the database is unreachable) the request gets `503`, not a refusal.

## Ending sessions early

A session is a signed token, so signing out on one device cannot reach a token that is still on another. Each user
has a **session version**: the token carries the version it was issued under, and raising the version on the server
ends every older session. **Sign out on all devices** (the arrow beside *Sign out*) raises it. An account that no
longer exists has no valid session. (There is no password change yet; when there is, it will raise the version too.)

The version is checked on each request but remembered for **30 seconds**. On the instance where you sign out
everywhere the change applies at once; on another instance a revoked session can keep working for up to those 30
seconds. If the database cannot be asked, an answer remembered in the last five minutes is still used; past that, or
for someone never checked, the request gets `503` and the cookie is kept, so an outage never signs anyone out. Sessions issued before this existed count as version 0 and stay valid until their normal expiry.

Writes (`POST`, `PUT`, `PATCH`, `DELETE`) sent by a page on another site are refused with `403`, signed in or not,
as a second layer beside `SameSite`. The check uses the `Sec-Fetch-Site` and `Origin` headers the browser attaches
itself; the `Origin` host must be the one the app is served from (or the one a reverse proxy forwards in
`X-Forwarded-Host`). If you set `ORIGIN` (recommended behind a proxy), it is the only host accepted. Scripts and tools that send neither header are unaffected. If every write returns `403` behind a reverse proxy, set `ORIGIN` to the public address.

## What is protected

Every page and every `/api/*` route requires a session, except the login page, the auth endpoints
for signing in and out, and `/api/health`.

- Signed-out API requests receive `401` JSON.
- Signed-out page requests are redirected to `/login`, then returned to where they were going.

## Roles

| Role | Can do |
|------|--------|
| `admin` | Everything, including deploying and executing workflows and starting Jupyter |
| `user` | Read and write application data |
| `viewer` | Read-only (`GET`, `HEAD`, `OPTIONS`) |

Endpoints that run code or start processes are admin-only: workflow deployment and execution
(and pausing, resuming, cancelling or purging a running one), Python workflow generation, and the Jupyter
endpoints. Anyone can read executions and their status. Editing or deleting a workflow is limited to its creator
and admins. Treat admin accounts as having shell-level
access to the server.

## First admin

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before first start. The account is created if the users table
is empty. See [Configuration](./configuration).

## Sign-in protection

Failed sign-ins are rate limited to 5 attempts per 15 minutes for each IP address and email
combination. Responses do not reveal whether an email exists.

## Current limitations

- There is no user-management screen yet. Additional users must be created in the database.
- Sessions are stateless: signing out removes the cookie but does not revoke the token before it
  expires (12 hours by default).
- Access is by role, not per project or workspace.

These are tracked in [issue #65](https://github.com/spiculedata/social-explorer/issues/65).
