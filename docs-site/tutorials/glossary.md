# Glossary

**Admin, user, viewer.** The three roles. Admins can do everything, including actions that run code.
Users create and edit work. Viewers can only read.

**Confidence.** How sure a classifier was about a result, from 0 to 1. Dashboards let you hide low
confidence results. Language detection groups it as very high (95% or more), high (85–95%), medium
(70–85%) and low (below 70%).

**Crawler.** The Go service that collects posts from Telegram and YouTube. Jobs are scheduled from
Data Capture.

**Dapr.** A runtime that gives the services state storage, messaging, job scheduling and workflows. The
web app talks to a Dapr sidecar for crawl jobs and workflow runs.

**Data source.** Where posts come from, such as a Telegram channel feed or a YouTube channel feed. Each
source belongs to one platform.

**Dataset.** A named collection of records registered in the platform, for example the posts from one
source. Datasets are linked to workspaces.

**DuckDB / `pg_duckdb`.** An analytical engine. The `pg_duckdb` extension lets PostgreSQL run queries
through it, which keeps dashboard queries fast.

**Engagement rate.** A post's likes, comments, shares and saves relative to the number of people it
reached, as a percentage.

**ETL.** The Python pipelines that extract, transform and load datasets (such as GDELT) into the
database.

**GDELT.** A public dataset of world events and media tone. Loaded by the ETL pipeline and used by
investigations and the GDELT pages.

**Investigation.** A saved set of keywords and dates followed across sources on a timeline.

**Migration.** A numbered SQL file in `ex-accell-ui/db/migrations/` that creates part of the schema. The
app applies each one once, on first sign-in.

**Project.** The top-level container for related research. It holds workspaces and members.

**Sentiment.** The tone of a post: Very Positive, Positive, Neutral, Negative or Very Negative, with a
confidence. Emotions (joy, anger and so on) are classified separately.

**Seed.** To fill an empty database with sample rows. `npm run seed:demo` loads the synthetic demo
dataset.

**TDLib.** Telegram's client library. The crawler uses a pre-seeded TDLib database archive to sign in to
Telegram.

**Topic.** A theme found across posts by topic modelling, described by its top keywords and the number
of posts assigned to it.

**Trigram.** A phrase of three consecutive words. The Trigrams dashboard ranks them by how often they
occur.

**WavePulse.** The service that records radio streams and transcribes them. Its transcripts feed the
radio pages and investigations.

**Workflow.** A pipeline of processing steps built in the Workflow Builder and published for execution.
Each run is recorded with its status and logs.

**Workspace.** A subset of a project that holds linked datasets. When one is selected, every dashboard
shows only its datasets.
