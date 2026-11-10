# Authentication and roles

Social Explorer uses server-side sessions. Users are stored in PostgreSQL (`app_users`, created
automatically) with passwords hashed using scrypt. Signing in sets an `HttpOnly`, `SameSite=Lax`
session cookie that is signed with `SESSION_SECRET`.

## Ending sessions early

A session is a signed token, so signing out on one device cannot reach a token that is still on another. Each user
has a **session version**: the token carries the version it was issued under, and raising the version on the server
ends every older session. **Sign out on all devices** (the arrow beside *Sign out*) raises it, as would a password
change or removing the user (an account that no longer exists has no valid session).

The version is checked on each request but remembered for **30 seconds**. On the instance where you sign out
everywhere the change applies at once; on another instance a revoked session can keep working for up to those 30
seconds. If the database cannot be asked and nothing is remembered for a user, the session is refused rather than
trusted. Sessions issued before this existed count as version 0 and stay valid until their normal expiry.

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

Endpoints that run code or start processes are admin-only: workflow deployment and execution,
Python workflow generation, and the Jupyter endpoints. Treat admin accounts as having shell-level
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
