# Try it with demo data

A fresh install is empty. The repository includes a generator that fills the database with
**synthetic** posts about a fictional coastal city, "Marlow Bay": transit delays, a harbor festival,
housing, water quality and more. Nothing in it comes from real people or real events, so it is safe
to explore, screenshot and share.

## Load it

You need the stack running (see [Getting started](/guide/getting-started)) and a checkout of the
repository, because the loader runs from source:

```bash
cd ex-accell-ui
npm ci
DATABASE_URL=postgresql://postgres:<your POSTGRES_PASSWORD>@localhost:5432/analytics npm run seed:demo
```

The loader applies any pending schema migrations, then inserts about 1,500 posts across 90 days, with
sentiment, emotions, topics, languages and engagement for each, plus two projects with workspaces and
three datasets. It only loads into an **empty** database and refuses otherwise. To replace existing
data on a throwaway demo database:

```bash
ALLOW_DEMO_RESET=1 npm run seed:demo -- --reset
```

::: danger
`--reset` truncates the analytics tables and, through foreign keys, everything that hangs off
them: posts and their analysis, projects, workspaces, members and datasets. Never run it against a
database you care about.
:::

The data is deterministic apart from its dates, which are relative to the day you load it, so the
default 7, 30 and 90 day filters always show activity.

## A quick tour

Sign in as the admin you created, then pick **Marlow Bay Civic Pulse** in the project switcher.

### Home

Projects appear as cards with their event counts and recent activity.

![Home page with two demo project cards](/screenshots/home.png)

### Projects

Each project groups workspaces, members and data sources.

![Projects page listing the two demo projects](/screenshots/projects.png)

### Sentiment analysis

Under **Social Analytics → Sentiment Analysis**, the headline cards show the positive, negative and
neutral share of posts. The charts show the distribution, the emotions behind it, and the trend over
time. Scroll down for individual posts with their classification and confidence.

Try the demo's built-in storylines: a spike of negative **public transit** posts about two thirds of
the way through the window, a burst of positive **harbor festival** posts earlier, and a **heatwave**
near the end.

![Sentiment analysis dashboard](/screenshots/sentiment-analysis.png)

### Topic modeling

Under **Social Analytics → Topic Modeling**, the network shows how the eight topics relate, and the
table ranks them by post count and weight.

![Topic modeling dashboard](/screenshots/topic-modeling.png)

### Engagement analysis

Under **Social Analytics → Engagement**, totals, average engagement rate and reach are
computed from each post's likes, comments, shares and saves, with breakdowns by platform, content
type and time of day.

![Engagement analysis dashboard](/screenshots/engagement-analysis.png)

### Language detection

Under **Social Analytics → Language Detection**, see the languages found, how confident the detector
was, and the share of posts that mix languages.

![Language detection dashboard](/screenshots/language-detection.png)

### Hashtag analysis

Under **Social Analytics → Hashtags**, see the most used hashtags and which ones appear
together.

![Hashtag analysis dashboard](/screenshots/hashtag-analysis.png)

### Trigram analysis

Under **Social Analytics → Trigrams**, see the three-word phrases that recur in posts, how
positive or negative the posts containing them are, and whether each phrase is rising or fading.

![Trigram analysis dashboard](/screenshots/trigram-analysis.png)

## What the demo does not cover

The demo fills the core analytics tables. Pages backed by optional pipelines (GDELT events, radio
transcripts, image processing, the workflow builder) stay empty until you run those pipelines. The
language page has no geographic breakdown, because posts carry no location data.

## Regenerating the screenshots

::: warning Use a disposable stack
The tutorial spec deletes projects, investigations and workflows named *Tutorial project*, *Tram delays*
and *Sentiment of posts* before it starts, on whatever stack the account can reach. It is skipped unless
you set `ALLOW_DOCS_CLEANUP=1`; do that only against the demo stack.
:::

The images above come from the same data. With the stack running and demo data loaded:

```bash
cd ex-accell-ui
SCREENSHOT_BASE_URL=http://localhost:3000 \
SCREENSHOT_EMAIL=<admin email> SCREENSHOT_PASSWORD=<admin password> \
ALLOW_DOCS_CLEANUP=1 npm run docs:screenshots
```

They are written to `docs-site/public/screenshots/` using a fixed 1440px viewport. The same command also
replays the [tutorials](/tutorials/) against the demo data (creating and then deleting a project, an
investigation and a workflow) and saves their screenshots under `screenshots/tutorials/`.
