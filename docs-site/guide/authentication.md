# Authentication and roles

Social Explorer uses server-side sessions. Users are stored in PostgreSQL (`app_users`, created
automatically) with passwords hashed using scrypt. Signing in sets an `HttpOnly`, `SameSite=Lax`
session cookie that is signed with `SESSION_SECRET`.

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
