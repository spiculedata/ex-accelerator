# Configuration

The web app is configured with environment variables. Copy `ex-accell-ui/.env.example` to `.env`
to get started.

## Database

Use either `DATABASE_URL` or the individual settings. `DATABASE_URL` takes effect when set.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | none | Full connection string, e.g. `postgresql://user:pass@host:5432/analytics` |
| `POSTGRES_HOST` | `localhost` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_DB` | none | Database name |
| `POSTGRES_USER` | none | Database user |
| `POSTGRES_PASSWORD` | none | Database password |
| `POSTGRES_POOL_MAX` | pool default | Maximum pooled connections |

## Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SECRET` | generated in dev | Signing key for session cookies, at least 32 characters. **Required in production.** Generate with `openssl rand -hex 32`. In development an ephemeral key is generated, so sessions end when the server restarts. |
| `SESSION_TTL_HOURS` | `12` | How long a sign-in lasts |
| `COOKIE_SECURE` | `true` in production | Set to `false` only when serving plain HTTP outside localhost |
| `ADMIN_EMAIL` | none | Email of the first admin, created when no users exist |
| `ADMIN_PASSWORD` | none | Password for that admin, at least 12 characters |
| `ADMIN_NAME` | `Administrator` | Display name for that admin |

## Server

| Variable | Description |
|----------|-------------|
| `PORT` | Port for the production server (`node build`) |
| `ORIGIN` | Public URL of the app (for example `https://analytics.example.com`). SvelteKit uses it to build URLs and for its cross-site request check, so set it whenever the server sits behind a proxy |
| `BODY_SIZE_LIMIT` | Largest request body the server accepts, in bytes (suffixes `K`, `M`, `G` work). Defaults to `512K`; larger requests get a `413` before any route runs. Raise it only if you need bigger workflow definitions or uploads |
| `API_RATE_LIMIT_PER_MINUTE` | How many `/api/*` requests one signed-in person may make a minute. Defaults to `1200`; `0` turns the limit off. Over the limit the server answers `429` with a `Retry-After` header. The count is kept in memory, per server process |
| `LOG_LEVEL` | `debug`, `info` (default), `warn` or `error` |
| `NODE_ENV` | `development` or `production` |

## Data sharing (IPFS)

Off by default. Read [Data sharing over IPFS](./data-sharing) before turning it on: anything published is public
on the IPFS network; an administrator can stop your node serving it, but copies others fetched cannot be recalled.

| Variable | Default | Description |
|----------|---------|-------------|
| `IPFS_ENABLED` | `false` | Must be exactly `true` to turn peer-to-peer sharing on; any other value leaves it off |
| `IPFS_BLOCKSTORE_PATH` | `/data/ipfs/blocks` | Where the node keeps published and fetched blocks |
| `IPFS_DATASTORE_PATH` | `/data/ipfs/datastore` | The node's identity and routing data; keep it between restarts |
| `IPFS_GATEWAY_URL` | `https://ipfs.io/ipfs` | Public gateway used to build shareable links; the server never fetches from this address (the node itself does use other public gateways, see the guide) |
| `IPFS_FETCH_TIMEOUT_MS` | `120000` | How long an import waits for the network before answering `504` |
| `IPFS_MAX_FETCH_BYTES` | `268435456` | Largest package an import accepts (256 MB); bigger ones get `422` |
| `PACKAGES_DIR` | `/data/packages` | Where generated and imported data packages are written |
| `IPFS_LISTEN_ADDRS` | libp2p defaults | Comma-separated multiaddrs the node listens on, replacing the default random ports (for example `/ip4/0.0.0.0/tcp/4001`) |
| `IPFS_ANNOUNCE_ADDRS` | none | Comma-separated multiaddrs announced to peers instead of the detected ones |
| `IPFS_UPNP` | `true` | `false` stops the node asking the router to open ports |
| `IPFS_RELAY_SERVER` | `true` | `false` stops the node relaying other peers' traffic |
| `IPFS_AUTOTLS` | `true` | `false` stops the node requesting a `libp2p.direct` TLS certificate |
| `MAX_EXPORT_ROWS` | `500000` | Most rows exported in one publish and loaded in one import |

::: warning Keep secrets out of git
`.env` files are ignored by git. Never commit real credentials. CI scans every push for secrets.
:::
