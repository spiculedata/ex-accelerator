# Data visualisation

Charts are where Social Explorer earns trust. A chart should answer a question, say how it knows, and
be readable by everyone.

## Sentiment

Sentiment runs **blue** (positive) through **grey** (neutral) to **orange** (negative). Red and
green are deliberately not used: they are the pair most often confused in colour blindness, and in
a tool about news and politics they also carry unwanted meaning (red as danger or "bad", green as
approval).

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:0;margin:16px 0;border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px var(--vp-c-divider)">
  <div style="background:var(--se-sentiment-very-positive);color:#fff;padding:18px 12px"><b>Very positive</b><br><code style="background:transparent;color:#fff">#0072b2</code></div>
  <div style="background:var(--se-sentiment-positive);color:#0f1926;padding:18px 12px"><b>Positive</b><br><code style="background:transparent;color:#0f1926">#56b4e9</code></div>
  <div style="background:var(--se-sentiment-neutral);color:#0f1926;padding:18px 12px"><b>Neutral</b><br><code style="background:transparent;color:#0f1926">#98a2ae</code></div>
  <div style="background:var(--se-sentiment-negative);color:#0f1926;padding:18px 12px"><b>Negative</b><br><code style="background:transparent;color:#0f1926">#e69f00</code></div>
  <div style="background:var(--se-sentiment-very-negative);color:#fff;padding:18px 12px"><b>Very negative</b><br><code style="background:transparent;color:#fff">#d55e00</code></div>
</div>

| Level | Token | Hex | Tailwind |
|---|---|---|---|
| Very positive | `--se-sentiment-very-positive` | `#0072b2` | `sentiment-very-positive` |
| Positive | `--se-sentiment-positive` | `#56b4e9` | `sentiment-positive` |
| Neutral | `--se-sentiment-neutral` | `#98a2ae` | `sentiment-neutral` |
| Negative | `--se-sentiment-negative` | `#e69f00` | `sentiment-negative` |
| Very negative | `--se-sentiment-very-negative` | `#d55e00` | `sentiment-very-negative` |

In code, always get sentiment colours from `getSentimentColor()` in `$lib/utils/colorUtils`. It is the
single source for charts and badges; do not write sentiment hex values into a page. Any other colour a chart, canvas or
SVG needs (axis ink, series, status, a network's own colour) comes from `CHART`, `CATEGORICAL` and `DIVERGING` in
`$lib/utils/chartColors`, which hold the brand tokens as hex. A test fails if a page writes a hex colour, or colours
sentiment with green and red classes.

**Rules**

- Always pair colour with a **label** or icon. Direct labels beat legends.
- Badge text is ink 900 on a tint of the sentiment colour, so the label keeps full contrast.
- Large figures may use `sentiment-very-positive` or `sentiment-very-negative` as text (both pass 3:1
  at 24 px bold or larger); smaller text stays ink.
- Order is always positive to negative, left to right or top to bottom.

## Categorical series

For series that are not sentiment (platforms, topics, languages) use the colour-blind-safe
Okabe-Ito set, in this order:

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;margin:16px 0">
  <div style="background:var(--se-cat-1);color:#fff;padding:12px;border-radius:6px;font-size:12px"><b>1</b><br>#0072b2</div>
  <div style="background:var(--se-cat-2);color:#0f1926;padding:12px;border-radius:6px;font-size:12px"><b>2</b><br>#e69f00</div>
  <div style="background:var(--se-cat-3);color:#fff;padding:12px;border-radius:6px;font-size:12px"><b>3</b><br>#009e73</div>
  <div style="background:var(--se-cat-4);color:#0f1926;padding:12px;border-radius:6px;font-size:12px"><b>4</b><br>#cc79a7</div>
  <div style="background:var(--se-cat-5);color:#0f1926;padding:12px;border-radius:6px;font-size:12px"><b>5</b><br>#56b4e9</div>
  <div style="background:var(--se-cat-6);color:#fff;padding:12px;border-radius:6px;font-size:12px"><b>6</b><br>#d55e00</div>
  <div style="background:var(--se-cat-7);color:#0f1926;padding:12px;border-radius:6px;font-size:12px"><b>7</b><br>#f0e442</div>
  <div style="background:var(--se-cat-8);color:#fff;padding:12px;border-radius:6px;font-size:12px"><b>8</b><br>#0f1926</div>
</div>

- Four or fewer series read best. Beyond six, group the tail into "Other".
- Do not use platform brand colours (Telegram blue, YouTube red). They clash with each other and with
  the sentiment scale.
- Do not reuse a sentiment colour for a non-sentiment series on the same page.

## Sequential and diverging

- **Sequential** (counts, density): the primary ramp, 100 to 700, light for low and dark for high.
- **Diverging** (change, correlation): blue `#0072b2` to near-white `#f1f4f8` to orange `#d55e00`,
  centred on zero. A correlation matrix is symmetric with 1 on the diagonal, and says what is correlated.

## Chart rules

1. **The title states the finding or the question**, for example "Negative posts about transit rose
   after 12 October", not "Sentiment chart".
2. **Say how many.** Show the sample size ("n = 1,500 posts") and the date range on the chart or beside it.
3. **Axes have labels and units.** A "Percentage" axis plots percentages. Bars start at zero.
4. **Time runs left to right, oldest to newest.**
5. **No truncated labels.** If a label does not fit, use a table or a horizontal layout, not "N…".
6. **Show the uncertainty.** Confidence below a threshold is marked, and the page says what the
   confidence means and which model produced it.
7. **Gaps are gaps.** Missing data is drawn as a gap, never as a zero.
8. **Interactive means linked.** Clicking a bar, segment, topic or hashtag opens the posts behind it.
9. **Text alternative.** Every chart has a descriptive title and a data table available on demand.
10. **Test it.** Check the chart in greyscale and with a colour-blindness simulator before shipping.

## In code

Charts use ECharts through `initChart()` in `$lib/utils/echarts`, which applies the `social-explorer`
theme: Atkinson Hyperlegible Next for all text, ink for axes and grid, and the categorical order above.
Set per-series colours only for sentiment (use `getSentimentColor`) or when a series has a meaning of its own.
