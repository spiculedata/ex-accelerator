# Logo

## The mark

The mark is a compass ring broken at the north-east, with a needle that passes through the gap. The
ring and the needle tail take the working colour; the needle tip is always Signal amber.

<div class="logo-grid">
  <div class="logo-tile"><img src="/brand/logo.svg" alt="Social Explorer logo on a light background" height="56"></div>
  <div class="logo-tile dark"><img src="/brand/logo-on-dark.svg" alt="Social Explorer logo on a dark background" height="56"></div>
  <div class="logo-tile"><img src="/brand/mark.svg" alt="Social Explorer mark on a light background" height="96"></div>
  <div class="logo-tile dark"><img src="/brand/mark-on-dark.svg" alt="Social Explorer mark on a dark background" height="96"></div>
</div>

## Files

All files are SVG. The wordmark is outlined from Atkinson Hyperlegible Next SemiBold, so the logo
does not depend on an installed font.

| File | Use |
|---|---|
| [logo.svg](/brand/logo.svg) | Mark and wordmark on light backgrounds |
| [logo-on-dark.svg](/brand/logo-on-dark.svg) | Mark and wordmark on ink or other dark backgrounds |
| [mark.svg](/brand/mark.svg) | The mark alone on light backgrounds (app icon, avatar) |
| [mark-on-dark.svg](/brand/mark-on-dark.svg) | The mark alone on dark backgrounds |
| [mark-mono.svg](/brand/mark-mono.svg), [logo-mono.svg](/brand/logo-mono.svg) | One-colour black, for print and fax-like contexts |
| [mark-mono-white.svg](/brand/mark-mono-white.svg), [logo-mono-white.svg](/brand/logo-mono-white.svg) | One-colour white, over photography or colour |

In the app, use the `BrandMark` component (`$lib/components/ui/BrandMark.svelte`) so the ring follows
the surrounding text colour. The favicon adapts to light and dark system themes.

## Colour

| Where | Ring and needle tail | Needle tip |
|---|---|---|
| Light background | Tidewater 700 `#006278` | Signal 400 `#f4af2d` |
| Dark background | Tidewater 300 `#85d2e5` | Signal 400 `#f4af2d` |
| One colour | A single colour for all parts | Same colour |

## Clear space and size

Keep a margin of at least **one ring stroke times four** (a quarter of the mark's width) clear on every
side. Nothing else sits inside it.

- Minimum size: mark **16 px** (the favicon), lockup **120 px** wide
- Lockup proportions are fixed. Do not re-space the mark and wordmark.
- On photography or a busy ground, use a one-colour version on a plain panel.

## The name

Write **Social Explorer**: two words, both capitalised. Not "SocialExplorer", "Social-Explorer", "SE" or
"SocExp". The earlier "SE" tile is retired. In code and URLs use `social-explorer`.

## Misuse

<div class="do-dont">
  <div class="dont"><b>Don't</b><p>Recolour the needle tip, or make the ring and tip the same colour in the full-colour logo.</p></div>
  <div class="dont"><b>Don't</b><p>Rotate, stretch, outline, add shadows or glows, or place the mark inside another shape.</p></div>
  <div class="dont"><b>Don't</b><p>Set the wordmark in another typeface or retype it. Use the supplied files.</p></div>
  <div class="dont"><b>Don't</b><p>Use the dark-background logo on a light ground, or the reverse. Check contrast.</p></div>
</div>
