# Typography

Three typefaces, each with one job. All are open source (SIL OFL) and self-hosted in the app and
this site, so no page makes a request to a third-party font service.

| Role | Typeface | Used for |
|---|---|---|
| **Display** | Newsreader (variable) | Page titles and the largest headlines. The editorial voice. |
| **Interface** | Atkinson Hyperlegible Next (variable) | Everything you read and operate: body, labels, buttons, tables |
| **Data** | JetBrains Mono (variable) | IDs, code, query text, anything where character width matters |

Atkinson Hyperlegible was designed by the Braille Institute for maximum character distinction, which
suits a tool people read in for hours. Newsreader adds the gravity of a newsroom to titles without
slowing down the interface.

<div class="type-sample"><small>Display, Newsreader 600, 40/48</small><div style="font-family:var(--se-font-display);font-weight:600;font-size:40px;line-height:48px;letter-spacing:-0.005em">Follow a story across social, news and radio</div></div>
<div class="type-sample"><small>Interface, Atkinson Hyperlegible Next 400, 16/26</small><div style="font-family:var(--se-font-sans);font-size:16px;line-height:26px;max-width:65ch">Topics are surfaced from the data itself, with their volume, weight and keywords, so you can see what a community is talking about before you decide what to dig into.</div></div>
<div class="type-sample"><small>Data, JetBrains Mono 400, 13/20</small><div style="font-family:var(--se-font-mono);font-size:13px;line-height:20px">post_id 1791171796894 · 2026-11-09T14:02:11Z · negative · 0.91</div></div>

## Scale

| Style | Size / line height | Weight | Face | Use |
|---|---|---|---|---|
| Display | 40 / 48 | 600 | Display | Landing headlines |
| Title (h1) | 36 / 44 | 600 | Display | Page titles |
| Heading (h2) | 24 / 32 | 600 | Interface | Section headings |
| Subheading (h3) | 18 / 26 | 600 | Interface | Card and panel titles |
| Body | 16 / 26 | 400 | Interface | Running text |
| UI | 14 / 20 | 500 | Interface | Buttons, tabs, table cells, form labels |
| Caption | 12 / 16 | 400 | Interface | Hints, timestamps, chart notes |
| Label | 12 / 16, +0.06em | 600, uppercase | Interface | Section eyebrows, table headers |
| Code | 13 / 20 | 400 | Data | Code, IDs, query text |

## Rules

- **Sentence case** for headings, buttons and labels ("Create investigation", not "Create Investigation").
  Uppercase is only for the small **Label** style.
- **Line length** of about 65 characters for running text. Do not stretch prose across a wide screen.
- **Numbers in columns** use tabular figures: `font-variant-numeric: tabular-nums`. Right-align them.
- **Weights.** 400 for text, 500 for UI, 600 for headings. Avoid 700 and above in the interface.
- **Minimum size** is 12 px, and only for captions and labels. Never set text smaller to fit a layout:
  shorten the text or change the layout.
- **Do not use the display face below 24 px**, in buttons, or in tables.
- **Language.** The data is multilingual. Keep the Latin Extended subset loaded; never assume English
  line breaks or length.

## Fallbacks

```css
--se-font-sans: 'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
--se-font-display: 'Newsreader Variable', ui-serif, Georgia, 'Times New Roman', serif;
--se-font-mono: 'JetBrains Mono Variable', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
```

In the app these are Tailwind's `font-sans`, `font-display` (and `font-serif`) and `font-mono`. Every
`h1` uses the display face by default.
