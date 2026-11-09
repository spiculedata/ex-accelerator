# Brand guidelines

These guidelines describe how Social Explorer looks, reads and behaves. They exist so that a new
screen, a docs page or a conference slide all feel like the same careful tool, and so that anyone
contributing can make a design decision without asking.

## What we are

Social Explorer is an open-source workbench for people who need to understand what is being said
online, and to show their working: researchers, journalists and analysts. It brings posts, news events
and broadcasts into one database, analyses them, and helps you follow a question from a number back to
the evidence behind it.

**The brand idea: evidence you can follow back.** Everything we make should help someone move from a
claim to its source, and say clearly how sure we are.

## Personality

| We are | Which means | We are not |
|---|---|---|
| **Precise** | Exact numbers, named methods, stated limits | Vague, hyped, "AI-powered" |
| **Calm** | Quiet colour, generous space, no alarms unless something is wrong | Neon, flashing, urgent by default |
| **Curious** | We invite exploration and show the next question | Prescriptive, locked down |
| **Open** | Open source, inspectable methods, plain language | Jargon-heavy, black-box |

## Principles

1. **Show the evidence.** A number links to the posts behind it. An estimate says it is an estimate.
2. **Say it plainly.** Use the words a researcher would use. Explain errors in human terms.
3. **Built for long sessions.** Low glare, legible type, steady layout. People work here for hours.
4. **Be inspectable.** Say what a model is, how confident it is, and what it cannot do.
5. **Accessible by default.** WCAG 2.2 AA is the floor, not a stretch goal. Colour never carries meaning alone.

## The visual idea: a field instrument

The identity borrows from survey and navigation instruments. The **mark** is a compass ring that the
needle breaks out of: exploring beyond the edge of what you already know. **Tidewater** (a deep
blue-green) is the working colour, set on cool **ink** neutrals. **Signal** amber appears rarely and
only for the thing that matters most: the needle tip, an evidence highlight. Headlines use a **serif** with
editorial weight; the interface uses a **hyper-legible sans**; data uses a **monospace**.

What it avoids: neon on black, pastel consumer gloss, decorative gradients, emoji as icons, and
red-and-green sentiment.

## What is in these guidelines

- [Logo](./logo): the mark, lockups, clear space and misuse
- [Colour](./colour): the ramps, roles and accessible pairings
- [Typography](./typography): faces, scale and rules
- [Layout and components](./components): shape, spacing, states and accessibility rules
- [Data visualisation](./data-visualisation): the sentiment scale, series colours and chart rules
- [Voice and content](./voice): tone, vocabulary and copy patterns

## Where the code lives

The tokens are one file, `ex-accell-ui/src/lib/styles/brand-tokens.css`. The app reads it through the
`@theme` block in `ex-accell-ui/src/app.css`, and this docs site imports the same file, so the
swatches on these pages are the real values. Tailwind's default colour names (`gray`, `blue`, and so on)
are mapped to brand ramps, so existing classes already follow the brand. New code should use the brand
names directly: `ink`, `primary`, `signal`, `success` and `danger`.

To propose a change, open an issue describing the problem it solves, then change the tokens file and
this section together.
