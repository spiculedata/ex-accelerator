# Layout and components

The interface should feel like a precise instrument: tight, calm and legible. Borders and space
separate things before shadows do.

## Spacing and layout

- **Base unit 4 px.** Use the Tailwind scale (`1` = 4 px). Prefer 8, 12, 16, 24, 32, 48.
- **Page width.** Content is capped at 80rem (`max-w-7xl`) and centred, with 16 px side gutters on
  phones, 24 px on tablets and 32 px on desktop.
- **Rhythm.** 24 px between cards, 32 to 48 px between page sections.
- **Never rely on horizontal scroll** for the page itself. Tables may scroll inside their own container.

## Shape and elevation

| Token | Value | Used for |
|---|---|---|
| `rounded-md` | 5 px | Buttons, inputs, badges |
| `rounded-lg` | 7 px | Menus, small panels |
| `rounded-xl` | 10 px | Cards |
| `rounded-2xl` | 14 px | Modals, large containers |
| `shadow-sm` | low, cool-tinted | Cards at rest |
| `shadow-md` / `lg` | medium | Menus and popovers |
| `shadow-xl` | high | Modals |

Radii are tighter than a consumer app on purpose. Use a 1 px `ink-200` border on cards; add a shadow
only to things that float above the page.

## Focus, hover and motion

- **Focus** is a 2 px `primary-500` outline with a 2 px offset on every interactive element, and is never removed.
- **Hover** darkens one step (`primary-600` to `primary-700`) or adds an `ink-100` fill.
- **Motion** is short and functional: 150 ms ease-out for state changes. Nothing bounces. All motion
  respects `prefers-reduced-motion`.

## Page header

Every page that opens a section uses the shared `PageHeader` component: an ink band with a faint
Tidewater tint, an icon tile, the title in the display face, a one-line subtitle, the project chip,
and actions on the right. Do not build one-off banners with their own gradients or accent colours.

## Components

### Buttons

| Type | Style | Use |
|---|---|---|
| Primary | `primary-600` fill, white label, `rounded-md` | The single main action in a view |
| Secondary | White fill, `ink-300` border, ink 700 label | Other actions |
| Quiet | No fill, primary 700 label | Low-emphasis actions, in toolbars |
| Danger | `danger-600` fill, white label | Destructive actions, with a confirmation step |

Labels say what happens: "Create investigation", "Link dataset", "Export posts (CSV)". A button that is
disabled must explain why, in a tooltip or adjacent text.

### Forms

Every control has a visible label (placeholder text is not a label), a hint when the format is not
obvious, and an inline error that says what is wrong and how to fix it. Validate on blur and on submit.
Do not use browser `alert()` dialogs for validation or success.

### Badges and status

Status badges pair a colour with a word (and an icon where space allows): "Active", "Failed", "Needs
setup". Sentiment badges use the [sentiment scale](./data-visualisation#sentiment).

### Tables

Right-align numbers and use tabular figures. Sticky header with the Label style. Show the total count
("50 of 1,500 posts") and provide pagination or "load more", never a silent cap. Row actions appear on
hover and on keyboard focus.

### Dialogs

Dialogs use `role="dialog"` and `aria-modal`, move focus inside on open, trap it, close on Esc, and return
focus to the trigger. The primary action is on the right.

### Empty, loading and error states

| State | Pattern | Example |
|---|---|---|
| Empty | What this is, why it is empty, the next step | "No GDELT events yet. Events appear here once the GDELT loader has run. See how to load GDELT." |
| Loading | A skeleton or spinner with a label, after 300 ms | "Loading posts" |
| Error | What happened, what to do, no internals | "We could not load topics. Try again, or check that the database is running." |

Never show SQL, stack traces or "check the console" to a user. Log the detail on the server. Never show
a zero where the real answer is "unavailable".

### Notifications

Use an inline message or a toast that says what happened ("Dataset linked"). Toasts are announced to
screen readers (`role="status"`) and stay long enough to read.

## Accessibility rules

These apply to every screen. They are checked in review.

1. **Contrast** meets WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text and UI components. Use the
   [accessible pairings](./colour#accessible-pairings).
2. **Colour is never the only signal.** Add a label, icon or pattern.
3. **Keyboard.** Everything works without a mouse, in a logical order, with a visible focus ring.
   Drag-only interactions also need a click or keyboard route.
4. **Names and roles.** Controls have accessible names; tabs use tab roles; icon buttons have labels.
5. **Targets** are at least 24 by 24 CSS pixels, with spacing.
6. **Structure.** One `h1` per page. Headings in order. Landmarks for header, nav, main.
7. **Charts** have a text alternative: a title that states the finding and a data table.
8. **Motion** respects reduced-motion settings.
9. **Zoom.** The layout works at 200 percent zoom and at 320 px wide without horizontal scrolling.
