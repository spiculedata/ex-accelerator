# Your first project

A **project** groups related research. Inside it, **workspaces** hold the datasets you want to
analyse together, and the dashboards can be limited to one workspace's data.

**You need:** the stack running, the demo data loaded and an account (see [Getting started](/guide/getting-started)).

## 1. Create a project

Open **Projects** in the navigation and choose **New Project**, or go to `/projects/new`.

![The Create New Project form](/screenshots/tutorials/new-project.png)

1. Give it a **name** (required, and unique) and an optional description.
2. Pick a **project type**. It labels the project; it does not change what the app does.
3. Tick the **data sources** you *plan* to use. At least one is required. This records your intent;
   it does not connect anything (the project page will still say "Sources: 0").
4. Optionally add team members by email.
5. Choose **Create Project**.

You land on the project page, which is empty until you add a workspace.

![A new project with no workspaces](/screenshots/tutorials/project-empty.png)

## 2. Create a workspace and attach datasets

Choose **+ New Workspace**.

![The New Workspace form with two datasets selected](/screenshots/tutorials/workspace-form.png)

1. Name the workspace and choose a **type** (General, Analysis, Exploration or Reporting). The type is a label.
2. Under **Select Datasets**, tick the datasets to include. With the demo data you will see
   *Demo Telegram local channels*, *Demo YouTube city channels* and *Demo Bluesky local feed*. Tick the first two.
3. Choose **Create Workspace**.

![The project page listing the new workspace](/screenshots/tutorials/workspace-created.png)

::: info Why the card still says "0 records"
The records and sources counters on the project and workspace pages count data sources added through
*Data Capture*. Datasets you link here do their work somewhere else: they decide which posts the
dashboards show. The next step proves it. (Making these counters include linked datasets is on the
[issue tracker](https://github.com/spiculedata/ex-accelerator/issues).)
:::

If a dataset cannot be added, a notice under the workspaces heading says so and why. Administrators
can add any dataset; other users need access to it (the demo datasets are public).

## 3. Scope the dashboards to the workspace

In the navigation, open the **Workspace** selector (it lists *Switch Workspace* and shows each
workspace's post count, here **921 posts**) and choose your workspace. Then open
**Social Analytics → Sentiment Analysis**. The address now ends in `?workspace=<id>`, which is how the
dashboards know which workspace to use.

![Sentiment analysis limited to the workspace's two datasets](/screenshots/tutorials/sentiment-scoped.png)

The source chips at the top list only the platforms in this workspace, and the totals cover only its
posts: **921** instead of the full **1,500**. Switch back to no workspace to see everything again.

::: tip What you learned
- A project holds workspaces; a workspace holds linked datasets.
- Linked datasets decide what every dashboard shows while that workspace is selected.
:::

## Next

[Explore the analytics dashboards](/tutorials/explore-dashboards), or
[investigate a question](/tutorials/investigations).
