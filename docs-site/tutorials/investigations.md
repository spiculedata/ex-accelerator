# Investigate a question

An **investigation** follows a set of keywords across your data on one timeline. It suits questions
like "was this a lasting topic or a one-day spike?".

**You need:** the stack running and the demo data loaded. GDELT events and radio transcripts are
optional extra sources; without them the investigation uses your social posts.

## 1. Create the investigation

Open **Investigations** in the navigation and choose **New Investigation**.

![The New Investigation form, filled in](/screenshots/tutorials/investigation-form.png)

1. **Title** is required. Add a **description** of the question, for example *Do tram delays dominate
   the transit conversation?*
2. Type each **keyword** and press **Enter** (or comma): `tram`, `delays`. Keywords match anywhere in
   a post's text, including hashtags, and are not case sensitive.
3. Optionally set a **start** and **end date**. If you leave them blank the investigation covers the
   last 90 days.
4. Under **Data Sources**, untick the sources you have no data for. The demo data only has *Social Media*.
5. Choose **Create**.

::: info Use the Investigations page
The workspace page also shows a *Create Investigation* button, but it does not do anything yet
([#102](https://github.com/spiculedata/ex-accelerator/issues/102)). Always create investigations from
**Investigations** in the navigation.
:::

## 2. Read the workbench

The investigation opens full screen.

![The investigation workbench showing the timeline and matching posts](/screenshots/tutorials/investigation-workbench.png)

- **Timeline** (top): one lane per source, GDELT, Radio and Social, with the volume of matching items
  per day, coloured by sentiment. Here the Social lane shows the spike in transit posts.
- **Tabs** (middle): each source with its count of matches. It opens on the first tab that has results.
  The **Social** tab lists each matching post with its platform, sentiment, engagement and date.
- **Visualizations**: a set of "portals". With social data, **Sentiment** (trend, breakdown, by source)
  and **Volume** (attention, metrics, stacked) work. **Correlation**, **Topics**, **Geography** and
  **Actors** need the optional GDELT and radio data, so they stay empty on the demo.
- **Toolbar** (top right): **Notes**, **Export** and **Save**.

## 3. Try it

- Change the keywords to `fare` and compare the shape of the timeline.
- Narrow the dates around the spike to see only that week.
- Add a note with **Notes** to record what you found, then **Save**.

::: tip Optional data
GDELT events come from the ETL pipeline (`etl/`) and radio transcripts from the WavePulse service.
Once either is loaded, tick its source when creating the investigation and its lane and tab fill in.
:::
