# Schedule a crawl

**Data Capture** collects posts from Telegram and YouTube by scheduling jobs for the crawler.

**You need:** the Dapr sidecar and the crawler service running (`npm run dev:dapr`; see
[Crawler](/architecture/crawler)). The crawler's source is not part of this repository yet, so on a
plain checkout this page opens but reports *Failed to load job states* and cannot run jobs. You also
need credentials for the platform you choose: Telegram API access and a TDLib database archive, or a
YouTube Data API key. Keep them out of version control.

## The four steps

Open **Data → Data Capture** and choose the **Web Crawler** tab (`/data-capture?tab=crawler`). The
form has four numbered steps and a progress bar. **Save as Draft** keeps your place.

**1. Basic Settings.** A **job name** (required), an optional **crawl ID**, the **log level**,
**concurrency** (parallel crawlers; higher is faster but heavier), **timeout** in seconds, a **user
agent**, the **output format** (JSON or CSV) and whether to **skip media download** to save storage.

**2. Platform & URLs.** Choose **Telegram** or **YouTube**.
- Provide at least one **URL** (a channel) or a **URL file URL** pointing to a list of them.
- Telegram also needs at least one **TDLib database URL**, a pre-seeded database archive that lets the
  crawler sign in. The form blocks **Next** until these are present and lists what is missing.
- YouTube needs a **YouTube API key** and offers sampling options (sample size, minimum channel videos).

**3. Filters & Limits.** Narrow what is collected: how far back to go (**Time Ago**), the maximum
number of posts, and similar limits.

**4. Review & Schedule.** Check the summary, then pick an **execution mode**:
- **Run immediately**: execute as soon as the job is created.
- **Run with delay**: execute after a delay (30 seconds up to 1 day).
- **Run at specific time**: execute at a date and time you choose.

## Watch the job

Switch to the **Schedule & Status** tab. Each job shows its status, schedule and items collected, with
**Run**, **Edit**, **Delete** and **Logs** actions. Progress is read from the job state store, so it
updates while the crawl runs. Collected data lands as JSONL files and flows into the database through
the ETL pipelines.

::: tip Related
The **WavePulse** tab configures radio recording and transcription. The **Princeton SMART** tab
previews a planned integration; importing from it is not available yet.
:::
