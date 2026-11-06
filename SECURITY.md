# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub: go to the repository's **Security** tab and choose
**Report a vulnerability** (<https://github.com/spiculedata/ex-accelerator/security/advisories/new>).

Include what you found, how to reproduce it, and the impact you expect. We will acknowledge
your report as soon as we can, keep you updated while we investigate, and credit you in the
fix unless you prefer to stay anonymous.

## Supported versions

The project is pre-1.0. Security fixes are made on the `main` branch only.

## Deployment hardening

If you run ex-accelerator yourself:

- **Set `SESSION_SECRET`** to a random value of at least 32 characters (`openssl rand -hex 32`).
  Production refuses to start without it.
- **Create the first admin** with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (12+ characters), then remove
  the password from your environment.
- **Serve over HTTPS** and keep `COOKIE_SECURE=true` (the default in production).
- **Change the default database password** (`changeme` in `docker-compose.yml`) and do not expose
  Postgres, Redis or the Dapr ports to untrusted networks.
- Code-execution endpoints (workflow deploy/execute, Jupyter) are restricted to the `admin` role.
  Treat admin accounts as having shell-level access to the server.
- Never commit `.env` files, API keys or Telegram/YouTube credentials. CI runs
  [gitleaks](https://github.com/gitleaks/gitleaks) on every push and pull request.
