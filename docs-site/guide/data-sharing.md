# Data sharing over IPFS

Data sharing packages a dataset as a [Frictionless Data Package](https://datapackage.org/) (a `datapackage.json`
descriptor with a schema, plus CSV files) and, when you turn it on, publishes that package to the
[IPFS](https://ipfs.tech/) peer-to-peer network so another Social Explorer install, or anyone with the content
identifier, can fetch it. Another install can import a package by CID into a new table.

::: danger Published data is public and permanent
Anything published to IPFS can be downloaded by **anyone who has its CID**, from any IPFS node or public gateway,
with no sign-in. Other nodes may keep copies indefinitely. There is no way to withdraw a package once it is
published: deleting it on your server, unpinning it or turning the feature off only stops *your* node serving it.

Because of this, the feature is **off by default**, only administrators can publish, and the app asks for
confirmation before each publish. Read [Before you publish](#before-you-publish) first.
:::

## When to use it

- Sharing an anonymised, licensed dataset with another team or the public without running a download server.
- Giving collaborators a stable, verifiable reference to exactly the data you analysed (the CID changes if a byte changes).
- Receiving a dataset someone else published, straight into a table you can query.

Do not use it for anything you could not post on a public website: personal data, data under an agreement that
limits redistribution, or crawl output you have not reviewed.

Without IPFS turned on you can still generate packages: the descriptor and a preview CSV are written to the
packages directory and the **Copy Link** button gives a link to `/api/data-sharing?action=get&id=...`, which
needs an account on your server. That part never leaves your server.

![The Data Sharing page with peer-to-peer sharing turned off (the default): a panel explains that publishing and importing are unavailable and how an administrator turns the feature on, while packages can still be generated from the catalogued datasets](/screenshots/data-sharing.png)

## How it works

| Piece | What it does |
|-------|--------------|
| Package generation | `POST /api/data-sharing` with a `dataset_id` from the catalogue (the **Data Management** page) reads the table's columns from `information_schema`, counts the rows, takes a preview (100 rows by default, at most 1,000) and writes `datapackage.json` and `<table>-preview.csv` under `PACKAGES_DIR/<package-id>/`. |
| Helia node | When sharing is on, the first publish or import starts a [Helia](https://helia.io/) IPFS node *inside the app process* (no separate daemon). It keeps blocks in `IPFS_BLOCKSTORE_PATH` and its peer identity and routing data in `IPFS_DATASTORE_PATH`. |
| Publishing | Exports the full table to `<table>.csv` (up to `MAX_EXPORT_ROWS`, 500,000 by default), adds every file in the package directory to the node as one directory, **pins** it so the blockstore keeps it, and returns the directory's CID. |
| Registry | The table `ipfs_published_packages` records every package this install published or imported: CID, gateway URL, title, row count, size, status (`published` or `imported`), who did it and when. The **Data Sharing** page reads it to show CIDs next to packages. |
| Gateway | A public HTTP gateway (`IPFS_GATEWAY_URL`, `https://ipfs.io/ipfs` by default) is only used to build a shareable `https://.../ipfs/<cid>` link. The server never fetches from *this* address; see the next paragraph for the gateways Helia itself uses. |
| Importing | Fetches the directory for a CID from the network, checks it, creates a table named `ipfs_` plus the last 40 characters of the CID (lower-cased), loads the CSV with parameterised inserts, adds a row to the `datasets` catalogue and copies the files into `PACKAGES_DIR`. The same CID cannot be imported twice (`409`). |

The node runs with Helia's defaults, which do more than find peers. It listens on random TCP, WebSocket and
WebRTC-direct ports on every interface (IPv4 and IPv6), dials the public bootstrap peers and joins the public DHT
so other peers can find the content it pins. It also asks the router to open ports with **UPnP**, announces itself
on the local network with **mDNS**, acts as a **circuit relay** for other peers' traffic, registers with
`libp2p.direct` for a TLS certificate (**AutoTLS**), uses delegated routing over HTTPS (`delegated-ipfs.dev`) and
fetches blocks over HTTPS from public trustless gateways (`trustless-gateway.link`, `4everland.io`) when peers
are slow. None of this is configurable today ([issue #252](https://github.com/spiculedata/social-explorer/issues/252)).
The node starts on the first publish or import and stops when the app process stops.

## Who may do what

| Action | Role |
|--------|------|
| See generated packages, previews and the registry | any signed-in user |
| Generate a package, publish to IPFS, import from IPFS | administrators only |

Non-admins see the page with those controls hidden; the API answers `403` if they call it anyway. See
[Authentication and roles](/guide/authentication).

## Turning it on

1. Read [Before you publish](#before-you-publish) and decide who will be an administrator.
2. Set the variables below (in `.env` for Docker Compose, or the app's environment) and restart the app.

| Variable | Default | Description |
|----------|---------|-------------|
| `IPFS_ENABLED` | `false` | Must be exactly `true` to turn sharing on. Anything else leaves it off. |
| `IPFS_BLOCKSTORE_PATH` | `/data/ipfs/blocks` | Where published and fetched blocks are kept. Grows with everything you publish or import; put it on a disk with room. |
| `IPFS_DATASTORE_PATH` | `/data/ipfs/datastore` | The node's identity and routing data (LevelDB). Keep it between restarts so the node keeps its peer ID. |
| `IPFS_GATEWAY_URL` | `https://ipfs.io/ipfs` | Gateway used to build shareable links. Point it at your own gateway if you run one. |
| `IPFS_FETCH_TIMEOUT_MS` | `120000` | How long an import waits for the network before answering `504`. |
| `IPFS_MAX_FETCH_BYTES` | `268435456` (256 MB) | Largest package an import accepts; bigger ones are refused with `422`. |
| `PACKAGES_DIR` | `/data/packages` | Where generated and imported packages are written. |
| `MAX_EXPORT_ROWS` | `500000` | Most rows exported in one publish and loaded in one import. |

With Docker Compose the storage paths are fixed inside the container and mounted from `${DATA_DIR:-/data}/ipfs`
and `${DATA_DIR:-/data}/packages`. The compose file forwards `IPFS_ENABLED`, `IPFS_GATEWAY_URL`,
`IPFS_FETCH_TIMEOUT_MS`, `IPFS_MAX_FETCH_BYTES` and `MAX_EXPORT_ROWS` from `.env`; put `IPFS_ENABLED=true` there.

### Network and firewall

The node picks random ports, so there is nothing fixed to open. Outbound traffic must be allowed to the
bootstrap peers and the DHT (TCP and UDP, any port) and over HTTPS to the delegated-routing and trustless-gateway
hosts named above, or publishing works locally but nobody can fetch from you. For other peers to connect *in*,
your node must be reachable; behind NAT or the Compose network it relies on relays (and on UPnP, if your router
allows it), which works but is slower. The Compose file does not publish an IPFS port; a fixed listen address
and port, and turning off UPnP, mDNS, the relay server or the HTTP gateways, are not configurable yet (see
[issue #252](https://github.com/spiculedata/social-explorer/issues/252), which also tracks unpublishing and a
clean node shutdown).

### Disk use

Publishing keeps the full CSV in `PACKAGES_DIR` **and** a copy in the blockstore; importing keeps the fetched
blocks, the package files and the new table. Budget roughly three times the CSV size per published dataset.
Nothing is cleaned up automatically.

## Publish a dataset

1. Open **Data → Data Sharing**. If the page says sharing is turned off, see [Turning it on](#turning-it-on).
2. Under **Available Datasets**, choose a dataset and click **Generate Package**. The package appears under
   **Shared Data Packages**; **Preview** shows its schema and first rows, so check them now.
3. Click **Publish to IPFS**. A dialog explains that the data becomes public and cannot be withdrawn; click
   **Publish publicly** to go ahead. The full table is exported and pinned; this takes a while for large tables.
4. The card now shows the CID. **Copy CID** copies it; **Copy gateway URL** copies an `https://` link anyone can open.

## Share the CID

Send the CID (or the gateway URL) to the person who should have the data. A CID is a hash of the content, so
the recipient gets exactly the files you published, and the same files always have the same CID.

Keep your app running: until other nodes have cached it, your node is the only one serving the package.

## Fetch and import a package

1. On **Data Sharing**, under **Import from IPFS**, paste the CID and click **Fetch & Import**.
2. The server fetches the directory (subject to the timeout and size cap), checks that it holds a
   `datapackage.json` with a CSV resource whose fields are plain identifiers, creates the table and loads it.
3. The new table appears in the catalogue as an `imported` dataset from `ipfs`. The registry table keeps a row
   with status `imported` too, though the **Data Sharing** page and `?action=registry` list published packages
   only. Importing the same CID again is refused (`409`).

Only import CIDs from people you trust. A package is data, not code, and every name in it is checked before it
reaches SQL or the file system, but the rows themselves are whatever the publisher put there.

## Limits

- Preview rows: 100 by default, 1,000 at most.
- Export and import: `MAX_EXPORT_ROWS` rows (500,000 by default). A publish that hits the cap says so in
  `datapackage.json` (`social_explorer.truncated`); an import quietly stops reading the CSV at the cap.
- A package may hold at most 100 files.
- Fetch: `IPFS_FETCH_TIMEOUT_MS` and `IPFS_MAX_FETCH_BYTES`.
- Only datasets in the catalogue can be packaged; application tables (users, projects, memberships, workflows,
  the registry itself) are refused even if a catalogue row points at them.
- Package ids and file names must be plain names; a package whose files have paths in their names is refused.
- The export runs one query per 10,000 rows through the app's database pool, so a huge table takes minutes.

## Troubleshooting

**The page says sharing is turned off.** `IPFS_ENABLED` is not exactly `true` in the app's environment. Set it
and restart. `IPFS_ENABLED=1` or `yes` does not count.

**Publish fails with a 500 and the log says the Helia node failed to start.** Usually the storage paths are not
writable or another process holds the LevelDB lock in `IPFS_DATASTORE_PATH` (a previous app process that did not
exit). Fix the permissions or remove the stale `LOCK` file after making sure nothing else is running.

**Nothing found / import answers 504.** The CID is not reachable from your node within the timeout. Check the
publisher's app is still running and its node can accept connections, that outbound traffic is allowed from
yours, and try again: the first lookup through the DHT can take a minute or two.

**Import answers 422.** The package is not a data package this app can load: no `datapackage.json`, no CSV
resource, field names that are not plain identifiers, a header that does not match the declared fields, a value
that does not fit its declared field type, a file name with a path in it, more than 100 files, or a package over
the size cap. Ask the publisher for a package generated by Social Explorer.

**Import answers 409.** This CID was already imported here; the table is still there.

**Slow retrieval.** Content travels peer-to-peer; the first fetch of a large package can be slow, especially
through relays. A public gateway that has already cached the content is often faster for people outside the
network.

## Before you publish

- **Personal data.** Posts, usernames, profile text and images are personal data in most jurisdictions. Do not
  publish them. Anonymise or aggregate first, and remember that a CID is forever.
- **Licence.** Generated packages declare CC-BY-4.0 by default. Make sure you have the right to grant that for
  the data, including platform terms of service for crawled content.
- **Minimise.** Publish the columns and rows the recipient needs, by creating a view or derived table and
  cataloguing that, rather than the raw crawl.
- **Record it.** The registry keeps who published what and when; keep it, and tell the people whose data it is
  where appropriate.
- **It cannot be unpublished.** If you publish something by mistake, stop your node (turn `IPFS_ENABLED` off and
  restart) so it stops serving the data, remove the files from `PACKAGES_DIR` and the blockstore, and treat the
  data as disclosed.
