# Crawler

The crawler is a Go service that collects posts and writes them as JSONL for the data pipelines.

::: warning Source not yet in this repository
The crawler lives in a separate repository and its source is not part of this checkout yet. The
`crawler` service in `docker-compose.yml` builds from `./crawler`, so it needs that source (or an
image) before it will start. The core app does not depend on it.
:::

## Platforms

- **Telegram** channels, through TDLib. Needs a Telegram API ID and hash from
  <https://my.telegram.org>, plus a phone number and one-time code for login.
- **YouTube** channels, through the YouTube Data API. Needs an API key.
- **Bluesky**, from the public firehose (`--urls=firehose`).

Keep these credentials in your environment or secret store. Never commit them.

## Execution modes

| Mode | Use |
|------|-----|
| `standalone` | One process, no Dapr. Good for trying it out |
| `dapr-standalone` | One process using Dapr state management |
| `dapr-job` | Runs scheduled jobs delivered by the Dapr Jobs API |
| `orchestrator` / `worker` | Distributed crawling coordinated over Dapr pub/sub |

Run `docker compose run --rm crawler --help` for the full flag list (the binary is `socialexplorer-crawler`).

## Scheduling from the web app

The Data Capture page builds a job and posts it to `/api/jobs`, which schedules it through the Dapr
Jobs API. The job's `value` is `platform:jsonConfig`, for example:

```json
{
  "name": "telegram-crawl-example",
  "dueTime": "30s",
  "data": { "value": "telegram:{\"urls\":[\"@channel\"],\"crawlId\":\"example\",\"maxPosts\":1000}" }
}
```

Job progress is kept in the Redis state store and shown on the Schedule tab.

## Trying it with Compose

The `crawler` service in `docker-compose.yml` runs a two-minute Bluesky firehose crawl and exits:

```bash
docker compose run --rm crawler
```
