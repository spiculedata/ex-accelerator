# Voice and content

How Social Explorer talks. The reader is an expert in their own subject and a tired person at the end
of a long day. Be the colleague who explains clearly and does not waste their time.

## Voice

| Principle | In practice |
|---|---|
| **Plain** | Short sentences, common words. Say "dataset", not "data source artefact". |
| **Specific** | Numbers, names, dates. "1,500 posts from 3 sources", not "lots of data". |
| **Honest** | Say what is not working or not available, and why. Never claim more than the product does. |
| **Calm** | No exclamation marks, hype or alarm. Errors explain; they do not shout. |
| **Respectful** | Assume competence. Do not talk down, and do not flatter. |

## Words we use

One name per thing, everywhere: menus, buttons, docs, error messages.

| Use | Not | Meaning |
|---|---|---|
| **Project** | case, engagement | A body of work, with members and workspaces |
| **Workspace** | folder, environment | A scoped view of a project's data, with its own investigations |
| **Dataset** | data source, source (for linked data) | A collection of posts or events that can be linked to a workspace |
| **Link a dataset** | add a data source, import | Make an existing dataset part of a workspace |
| **Investigation** | research, case file | A saved question: keywords, dates, sources, notes and evidence |
| **Topic** | theme, cluster | A group of posts about the same subject, found by topic modelling |
| **Post** | record, event (for social content) | One item from a social platform |
| **Event** | story (for GDELT) | One GDELT news event |
| **Sentiment** | mood, tone | Positive, neutral or negative, with a confidence score |

Keep "Research" for the notebook area and "Investigation" for saved questions, and make the menu say so.

## Patterns

**Buttons and links** say what will happen: "Create investigation", "Link dataset", "Export posts (CSV)".
Avoid "Submit", "OK" and "Click here".

**Success** is a short statement of fact: "Dataset linked." Never "saved successfully" for something that
did not save.

**Errors** have three parts: what happened, why if we know, and what to do.

> We could not load topics for this range. The topic service is not responding. Try again in a moment,
> or check that the database is running.

**Empty states** explain the page, the reason it is empty, and the next step.

> **No GDELT events yet.** Events appear here after the GDELT loader runs. [Load GDELT data](../guide/getting-started)

**AI and models.** Say what produced a label and how sure it is: "Sentiment by VADER, confidence 0.91." Do
not use "AI-powered" as a feature. Explain what a confidence score means.

## Before and after

| Before | After | Why |
|---|---|---|
| "Workflow saved successfully!" (when nothing saved) | "Workflow saved." (and make it true) | Never claim success that did not happen |
| "Error loading data. Please check the browser console." | "We could not load GDELT events. The service is not responding." | Users should not need developer tools |
| `relation "image_objects" does not exist` | "No images analysed yet. Process images to see results." | No internals in the UI |
| "Add Data Source" opening a list | "Link dataset" opening the dialog | The label matches the action |
| "23M+ global events" | "1,204 events loaded" (the real number) | State what is actually there |
| "Stretch Goal" | "Preview" | Internal roadmap words stay internal |

## Numbers, dates and units

- Thousands separators for counts: 1,500. Use "1.6K" only where space is tight, and never in a table.
- Percentages to one decimal place at most; show the count beside them.
- Dates in the interface follow the user's locale; exports and evidence use **ISO 8601 with a time zone**
  (`2026-11-09T14:02:11Z`).
- Ranges are inclusive and say so: "1 Oct to 15 Oct 2026".

## Sensitive tools

Tools that identify people or classify images (face detection, content moderation) carry a short
"Use responsibly" note on every screen: what the tool does, what it cannot do (it makes mistakes and can
be biased across groups), and that the user is responsible for lawful, ethical use.

## Inclusive language

- Use gender-neutral wording and they/them when a person's pronouns are not known.
- Avoid idioms and culture-specific references; this product is used in many languages.
- Describe people and communities by what they said or did, not by assumptions about who they are.
