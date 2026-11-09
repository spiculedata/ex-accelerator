# Colour

Colour is quiet by default. Most of the interface is **ink** neutrals; **primary** (Tidewater) marks
what you can act on; **signal** points at the one thing that matters; **success** and **danger** report
state. Charts have their own scales in [Data visualisation](./data-visualisation).

## The ramps

Every ramp has eleven steps, from 50 (lightest) to 950 (darkest). Steps are defined in OKLCH, so
equal steps look equally different, and the lightness curve is shared, which keeps contrast
predictable: a `-600` text on a `-50` background behaves similarly in every ramp.

### Ink

Neutrals with a slight cool blue lean. Text, surfaces, borders and anything that is not a call to action.

<ColorRamp name="ink" />

| Step | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#f8fafd` | `#f1f4f8` | `#e3e8ee` | `#cfd5de` | `#98a2ae` | `#667384` | `#485567` | `#344253` | `#1e2938` | `#0f1926` | `#020712` |

### Primary: Tidewater

The brand colour. Links, buttons, selection, focus, active navigation, and the logo.

<ColorRamp name="primary" />

| Step | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#edf9fd` | `#d6f1f8` | `#b2e5f2` | `#85d2e5` | `#46b5ce` | `#0097b1` | `#007b95` | `#006278` | `#004d5e` | `#003846` | `#00222b` |

### Signal

Amber, for highlights and evidence marks (the needle tip, a keyword highlight, a "new" marker).
It is a **fill** colour. Never set text in signal on white: it does not reach contrast.

<ColorRamp name="signal" />

| Step | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#fff9ec` | `#ffefd1` | `#ffdea0` | `#ffc96a` | `#f4af2d` | `#de9800` | `#b87b00` | `#936000` | `#704a00` | `#523700` | `#312003` |

### Success

Confirmations and healthy states. Not used for positive sentiment.

<ColorRamp name="success" />

| Step | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#effaf4` | `#dbf2e4` | `#bce7ce` | `#96d5b2` | `#68b88f` | `#3f9a6f` | `#247e56` | `#116543` | `#0c4f33` | `#073a25` | `#012415` |

### Danger

Errors and destructive actions only. Not used for negative sentiment.

<ColorRamp name="danger" />

| Step | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#fff3f2` | `#ffe4e0` | `#ffccc6` | `#feaba1` | `#f9786c` | `#e6443d` | `#c51e21` | `#a20711` | `#80070d` | `#5f0608` | `#3c0405` |

## Roles

Components should reach for a **role** before a raw step. Roles flip between light and dark themes;
the ramps stay put.

| Role | Light | Dark | Use |
|---|---|---|---|
| `--se-bg` | ink 50 | ink 950 | Page background |
| `--se-surface` | white | ink 900 | Cards, panels, menus |
| `--se-surface-sunken` | ink 100 | ink 950 | Wells, table headers |
| `--se-border` | ink 200 | ink 800 | Dividers, card edges |
| `--se-border-strong` | ink 300 | ink 700 | Inputs, emphasised edges |
| `--se-text` | ink 900 | ink 100 | Body text |
| `--se-text-muted` | ink 500 | ink 400 | Secondary text, captions |
| `--se-link` | primary 700 | primary 300 | Links |
| `--se-action` | primary 600 | primary 500 | Primary buttons, selected states |
| `--se-focus` | primary 500 | primary 400 | Focus ring |
| `--se-highlight` | signal 200 | signal 700 | Evidence and keyword highlight |

## Accessible pairings

These pairings meet WCAG 2.2 AA for normal text (4.5:1) unless stated. Contrast was calculated from the
hex values above.

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| ink 900 `#0f1926` | white | 17.7:1 | Body text |
| ink 700 `#344253` | white | 10.2:1 | Strong secondary text |
| ink 500 `#667384` | white | 4.8:1 | Secondary text, captions (the lightest text allowed) |
| white | primary 600 `#007b95` | 4.9:1 | Primary button label |
| primary 700 `#006278` | white | 7.0:1 | Links |
| primary 300 `#85d2e5` | ink 900 | 10.4:1 | Links and marks on dark |
| ink 200 `#e3e8ee` | ink 900 | 14.4:1 | Body text on dark |
| danger 600 `#c51e21` | white | 5.9:1 | Error text |
| success 700 `#116543` | white | 7.1:1 | Success text |
| ink 900 | signal 500 `#de9800` | 7.2:1 | Text on a signal fill |
| primary 500 `#0097b1` | white | 3.5:1 | **Large text and UI components only** (3:1) |
| signal 500 / 600 | white | 2.4 / 3.6 | **Never as text.** Fill only |

## Usage guidance

- **Proportion.** Roughly: ink 85 percent, primary 12 percent, signal under 2 percent, state colours as needed.
- **One primary action** per view gets the filled primary button.
- **Signal is scarce.** If everything is highlighted, nothing is. Use it once per view.
- **State is never colour alone.** Pair success, danger and status colours with an icon or a word.
- **Do not use `danger` for sentiment** or `success` for positive sentiment. See the sentiment scale.

<div class="do-dont">
  <div class="do"><b>Do</b><p>Use <code>primary-600</code> for the main button and <code>primary-700</code> for links on white.</p></div>
  <div class="do"><b>Do</b><p>Use ink 200 borders to separate cards; let space and borders do the work before shadows.</p></div>
  <div class="dont"><b>Don't</b><p>Put signal-coloured text on a white background, or use it for charts as the only distinguishing colour.</p></div>
  <div class="dont"><b>Don't</b><p>Introduce a new hue for a single feature. If a role is missing, propose it here first.</p></div>
</div>

## In code

```svelte
<button class="bg-primary-600 hover:bg-primary-700 text-white rounded-md px-4 py-2">Save</button>
<p class="text-ink-500">Updated 3 minutes ago</p>
<span class="bg-signal-200 text-ink-900">tram</span>
```

Tailwind's default names are mapped for compatibility: `gray`, `slate`, `zinc`, `neutral`, `stone` to
ink; `blue`, `sky`, `cyan`, `teal`, `indigo`, `violet`, `purple`, `fuchsia`, `pink` to primary; `green`,
`emerald`, `lime` to success; `red`, `rose` to danger; `orange`, `amber`, `yellow` to signal.
Several families now share a ramp, so never use them to tell categories apart: use the categorical colours or a label.
New code should use the brand names.
