# Foreground · Ember design system

Handoff for Claude Code. This is the system behind the approved splash
(`Foreground Splash.dc.html`) and the app mocks (`Foreground App — Instrument.dc.html`,
option **1g Ember**). Apply it to the React 18 + Tailwind v4 app in
`kileysullivan17/foreground`. It replaces the Organic (cream / terracotta / Caprasimo)
direction entirely.

Reference mocks in this project: `FgWhatNow.dc.html` (phone What now),
`Foreground App — Instrument.dc.html` (1a–1f: What now phone + desktop, Put off,
Projects, Product board, Add item), `Foreground Splash.dc.html` (marketing splash),
`assets/screens/*.png` (2× captures of each mock), `assets/video/ch1–ch4*.mp4`
(splash film chapters).

---

## 1. Principles

1. **One thing is lit.** Exactly one panel per screen carries the accent border and
   glow: the #1 item on What now, the focused field on Add item, the active tab in
   the tab bar. Everything else sits in shadow on the same ground.
2. **Numbers are instruments.** Anything that is a measurement (scores, factor points,
   multipliers, days, counts, labels above data) is set in the mono face, tabular.
   Prose is set in the sans.
3. **Rules, not cards, for lists.** Lists are separated by 1px dotted rules. Panels
   (solid fill + 1px border) are reserved for the lit readout, project groups, story
   cards, inputs, and the tab bar.
4. **Terracotta means time or action.** Deadline points, staleness multipliers, the
   primary button, the "in progress" dot, the active tab. Nothing else is orange.
   Overdue deadlines are the only use of red.
5. **Dark only.** The app ships one theme. Remove the light theme and the toggle
   (`ThemeToggle.tsx`, `lib/theme.ts`, the pre-paint script in `index.html`) or leave
   the plumbing in place but make dark the only variant.

---

## 2. Color

Ground is a cool near-black; type is warm off-white. This warm-on-cool pairing is
the identity. Do not drift the ground warm or the type cool.

| Token            | Value                      | Use |
| ---------------- | -------------------------- | --- |
| `ground`         | `#15171b`                  | Page and screen background |
| `panel`          | `#1b1e23`                  | Lit readout, project groups, story cards, inputs, tab bar |
| `raised`         | `#22262c`                  | Segmented control's active pill, expanded ledger inside a queue row, neutral chips |
| `film`           | `#0f1114`                  | Bezel behind video and screenshots |
| `line`           | `rgba(233,231,225,.10)`    | Panel borders, section dividers, tab-bar top edge |
| `line-strong`    | `rgba(233,231,225,.24)`    | Dotted list rules, outlined pills, inactive segmented border |
| `text`           | `#e9e7e1`                  | Primary text, headings, scores |
| `text-2`         | `#a9abaf`                  | Body copy, factor detail, secondary titles |
| `text-3`         | `#8b8e94`                  | Mono labels, meta, placeholders, inactive tabs |
| `accent`         | `#ee7a3c`                  | The lit color: deadline points, staleness multipliers, #1 score, primary buttons, active tab, focus ring |
| `accent-hover`   | `#f4955f`                  | Primary button hover |
| `accent-soft`    | `rgba(238,122,60,.16)`     | Tinted fills: WSJF chip, secondary Start button, focus halo |
| `accent-line`    | `rgba(238,122,60,.38)`     | The lit panel's border |
| `accent-glow`    | `rgba(238,122,60,.45)`     | Glow shadows and text-shadow on the lit score |
| `accent-ink`     | `#15171b`                  | Text on accent fills (same as ground) |
| `overdue`        | `#ff9d85`                  | Overdue deadline label and points. The only red. |

Contrast (computed): `text` on `ground` 15:1 · `text-2` on `panel` 7.3:1 ·
`text-3` on `panel` 5.1:1 · `accent` on `ground` 6.5:1 · `accent-ink` on `accent`
6.5:1. Everything used for text passes AA; `text-3` is the floor and is only used
at ≥10.5px mono with tracking.

**What happened to sage.** Ember has no second accent. Unblocks, momentum, Done,
and "Touch it" are plain `text` (white) so the eye reads *orange = time pressure,
white = flow*. Do not reintroduce a green.

### Tailwind v4 theme

```css
@import "tailwindcss";

@theme {
  --color-ground: #15171b;
  --color-panel: #1b1e23;
  --color-raised: #22262c;
  --color-film: #0f1114;
  --color-line: rgb(233 231 225 / 0.10);
  --color-line-strong: rgb(233 231 225 / 0.24);
  --color-text: #e9e7e1;
  --color-text-2: #a9abaf;
  --color-text-3: #8b8e94;
  --color-accent: #ee7a3c;
  --color-accent-hover: #f4955f;
  --color-accent-soft: rgb(238 122 60 / 0.16);
  --color-accent-line: rgb(238 122 60 / 0.38);
  --color-accent-glow: rgb(238 122 60 / 0.45);
  --color-accent-ink: #15171b;
  --color-overdue: #ff9d85;

  --font-sans: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, Menlo, monospace;

  --radius-pill: 999px;
  --radius-panel: 22px;
  --radius-inner: 16px;   /* ledger inside a row, tiles */
  --radius-card: 18px;    /* story cards */
  --radius-screen: 28px;  /* film / screenshot bezels */

  --shadow-lit: 0 0 0 1px rgb(238 122 60 / 0.16), 0 36px 70px -34px rgb(238 122 60 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.05);
  --shadow-frame: 0 40px 80px -40px rgb(0 0 0 / 0.8);
}
```

Body: `bg-ground text-text font-sans antialiased`. Selection:
`::selection { background: rgb(238 122 60 / .35) }`.

---

## 3. Type

Two faces, loaded from Google Fonts (swap the existing Caprasimo/Figtree link):

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Role | Face | Size / line | Weight | Tracking | Notes |
| --- | --- | --- | --- | --- | --- |
| Screen title (`h1`) | Archivo | 36 / 0.95 | 800 | −0.04em | "What now", "Projects". Desktop: 56 / 0.9, −0.045em |
| Splash display | Archivo | clamp(84px, 15.5vw, 236px) / 0.84 | 800 | −0.05em | "What now?" only |
| Section heading (splash) | Archivo | clamp(38px, 5.2vw, 76px) / 0.98 | 700 | −0.035em | |
| Readout title | Archivo | 19–20 / 1.25 | 600 | −0.01em | Title inside the lit panel; 25 / 1.2 on desktop |
| Row title | Archivo | 15.5 / 1.3 | 600 | 0 | Queue rows, put-off rows, project items (14.5 / 1.3, weight 400) |
| Body | Archivo | 13–14.5 / 1.5 | 400 | 0 | `text-2` |
| Meta | Archivo | 13 / 1.4 | 400 | 0 | "Item tracker · Small job", `text-2` |
| Button | Archivo | 14 / 1 | 600 | 0 | 13 inside rows, 15 for the full-width primary |
| Big score | Archivo | 40 / 1 | 700 | −0.04em | Lit panel, `accent`, tabular, text-shadow `0 0 26px accent-glow`. 56 on desktop |
| Row score | Archivo | 20–22 / 1 | 700 | −0.03em | `text`, tabular |
| Days count | Archivo | 26 / 1 | 700 | −0.04em | Put off; `accent` at ≥21 days, `text` below |
| Mono label | Geist Mono | 10.5 / 1 | 500 | +0.14–0.16em | UPPERCASE. Kickers ("IN THE FOREGROUND"), filter pills, tab labels, column heads, counts |
| Ledger | Geist Mono | 12.5 / 1.3 | 400 | 0 | Factor rows: label `text`, detail `text-2`, points `text`; 12 inside queue rows; 13 on desktop |
| Factor line | Geist Mono | 11 / 1.6 | 400 | 0 | Collapsed row teaser, `text-2`, wraps freely |
| Equation | Geist Mono | 12 / 1 | 400 | 0 | "(19 + 8) ÷ 1 × 1.37", `text-3` |
| Row index | Geist Mono | 11 / 1.6 | 500 | 0 | "02" … `text-3`; `accent` on the first queue row |

Rules: `font-variant-numeric: tabular-nums` on every number. `text-wrap: pretty` on
titles and body. Mono labels are the only uppercase text. Minimum size 10.5px, mono
only, with tracking.

---

## 4. Shape and space

- **Radii (locked):** pills `999px` for every control (buttons, segmented, filter
  chips, inputs, tab pills); panels `22px`; inner ledgers and tiles `16px`; story
  cards `18px`; film and screenshot bezels `28px`; phone frame `32px`.
- **Screen padding:** 20px sides, 20px top to the header (`page-top`). Panels inset 14px from the
  screen edge (so panel content aligns with the 20px text margin).
- **Vertical rhythm:** a named scale in `src/index.css` (`--spacing-*`), used as
  `pt-title-top`, `mt-lede`, `mt-block`, `py-row`. Header → title 24px (44px at
  ≥1024px); title → lede or controls 16px; controls → lit panel 24px (32px at
  ≥1024px); panel → queue 24px (32px); list rows 14px top / bottom padding; lit
  panel internal 18px sides (32px at ≥1024px), sections separated by 12–14px + a
  dotted rule. Add a step to the scale rather than reaching for a raw pixel value.
- **Hit targets:** ≥44px for row actions and primary buttons; 34–38px pills are
  acceptable only inside a 44px-tall row.
- **Ground texture (splash only):** 88px grid of `line` at 0.038 alpha plus one
  radial accent glow behind the film. Not used inside the app.

---

## 5. Components

### Wordmark
Two discs: a `line-strong` disc (10–11px) up-right, an `accent` disc (13–14px) in
front, offset down-left, with `box-shadow: 0 0 12px accent-glow`. Same geometry as
`public/favicon.svg` (vivid circle in front of the faded one). Wordmark
"Foreground" Archivo 600 15px, −0.01em. Recolor the favicon to `#15171b` / `#8b8e94`
/ `#ee7a3c`.

### Header
Wordmark left; "ABOUT" right as a mono label in `text-3`. No border under the
header on phone; desktop header has `border-b border-line` and hosts the nav as
mono labels (active one in `accent` with a glowing 5px dot).

### Filter pills (Area) and Quick wins
Segmented group: outer pill `border border-line-strong p-[3px]`, options 34px tall,
active option `bg-raised text-text`, inactive `text-text-3`. Labels are mono 10.5px
uppercase. Quick wins is a separate outlined pill (42px) with a 6px ring glyph; when
on, the ring fills `accent` and the label turns `text`.

### The lit readout (What now #1)
```
bg-panel border border-accent-line rounded-panel p-[18px] shadow-lit
  kicker row: 7px accent dot (glow, 2.6s blink) · "IN THE FOREGROUND" (accent) · "#1 OF 14" (text-3), mono 10.5 uppercase
  title: Archivo 600 19–20/1.25
  meta: "Item tracker · Small job", Archivo 13, text-2
  ── dotted rule (line-strong)
  ledger: 3-col grid  [label text | detail text-2 (truncates) | points right-aligned]
          Deadline points and staleness multiplier in accent; everything else text
  ── dotted rule
  equation (mono 12, text-3)  ………  score (Archivo 700 40, accent, glow)
  actions: Start (accent fill, accent-ink text, flex 1.2) · Done (outlined text, flex 1) · Park (ghost text-3, flex .9), 44px pills
```
Blink: `@keyframes fgBlink {0%,100%{opacity:1} 50%{opacity:.25}}`, disabled under
`prefers-reduced-motion`.

### Queue rows (ranked list under the readout)
Container: `mx-5 border-b border-dotted border-line-strong`; each row
`border-t border-dotted border-line-strong py-[14px]`, grid `26px 1fr auto`:
index (mono, `text-3`; `accent` on the first row) · title (Archivo 600 15.5) · score
(Archivo 700 20, tabular). Second line (col 2): project · size, mono 11 `text-3`.
Third line (cols 2–3): the full factor string, mono 11/1.6 `text-2`, wrapping:
`+25 due in 5 days · +25 importance · +8 unblocks · ÷2 · ×1.13 stale` with deadline
points and multipliers in `accent`. Never truncate the factor line.

Tap a row to expand: an inner ledger `bg-raised rounded-inner p-3` indented 36px
(same 3-col grid as the readout, mono 12), a dotted rule, the equation + row score,
then a 40px action row (Start = `bg-accent-soft text-accent`, Done outlined, Park
ghost). Only one row expanded at a time.

Below the list: "BLOCKED · 11 WAITING ON OTHER ITEMS ›" as a mono label row. The
blocked section itself keeps the existing chain UI, restyled: dotted rules,
`text-2` chain text, the actionable root in `text` with an `accent` "start this"
link.

### Stuff I've put off
Subhead in `text-2`; All / Work / Home segmented; count right as a mono label.
Rows: grid `52px 1fr auto` with the day count (Archivo 700 26, `accent` when ≥21
days, `text` otherwise, unit "d" as mono 11 `text-3`), title, and a **Touch it**
outlined pill (34px, mono uppercase; `border-line-strong` normally, `border-text`
on the stalest row). Optional note line in `text-2` (Archivo 12.5). Bottom line:
project name · a 3px gauge (`line-strong` track, `accent` fill = (multiplier − 1) /
0.5) · the multiplier in `accent`. Touching opens an inline pill input + Save
(accent) + Cancel (outlined).

### Projects
Area headings as mono labels with counts right. Each project is a panel
(`bg-panel border-line rounded-panel p-4`): name (Archivo 600 17) with "4 open ·
Aug 6" mono right; goal in `text-2`; item list with dotted rules, 44px rows, grid
`14px 1fr auto`: status dot (8px; `accent` + glow when in progress, `line-strong`
ring otherwise, `text-3` title when blocked with "· blocked" in the margin), title,
size/date mono right (`accent` when a deadline is inside 30 days). Footer: input
pill (`bg-raised`, placeholder `text-3`) + outlined Add pill, 42px. "+ New project"
as an `accent` text link.

### Product board
Phone shows one column at a time: column pills (mono uppercase, active
`bg-raised`, count in `accent`), capture input (panel pill, 46px) + accent Add.
Story cards `bg-panel border-line rounded-card p-4`: story text Archivo 15/1.45,
then chips (26px pills, mono 10.5): WSJF `bg-accent-soft text-accent`, points and
criteria `bg-raised text-text-2`. **Raw captures** are dashed-border cards on the
ground (no fill) with a `Raw capture` chip in `bg-line text-text` and a "GROOM
THIS ›" mono link in `accent` right-aligned. "LATER · 5 V3 CANDIDATES ›" as a mono
row. Desktop shows the four columns side by side with the same cards; column
headers become mono labels with counts.

### Add item
Subhead (`text-2`) with "Import it" as an `accent` underlined link. Title input:
56px pill, `bg-panel`, focused state `border-accent` + `0 0 0 3px accent-soft`,
placeholder "What needs doing?" in `text-3`. Area segmented Home / Work, 40px, full
width. "+ More detail" as a dotted-outline 52px pill: label in `accent`, then the
folded field names as a mono label in `text-3`. Expanded: Project select, Effort
S/M/L segmented, Importance, Hard deadline, Notes, Waits on checkboxes (22px, 7px
radius, `accent` when checked). Submit: full-width 50px `bg-accent text-accent-ink`
"Add item". Success toast: panel pill with `accent` text.

### Tab bar
`bg-panel border-t border-line`, 5 equal columns, 12px top / 16px bottom. Each tab:
a 5px dot (ring in `text-3`; filled `accent` with `0 0 8px accent` glow when active)
over a mono 10px uppercase label (`text-3`, `accent` when active). No icons.

### Buttons
| Variant | Style |
| --- | --- |
| Primary | `bg-accent text-accent-ink font-semibold rounded-pill h-11 px-5`; hover `bg-accent-hover`; active `translate-y-px` |
| Soft | `bg-accent-soft text-accent` (Start inside a queue row) |
| Outlined | `border border-text text-text` (Done) or `border-line-strong text-text` (Cancel, Add) |
| Ghost | `text-text-3`, no border (Park) |
| Disabled | 45% opacity |
| Focus | `outline: 2px solid accent; outline-offset: 3px` on `:focus-visible`, never the default ring |

### States
- **Loading:** skeleton bars in `raised` with the same row grid; no spinners.
- **Empty:** title Archivo 600 20 + body `text-2` + one primary pill, centered in the
  list area (copy unchanged from `EmptyState.tsx`).
- **Error:** panel with `border-overdue/40`, message in `text`, retry as an
  outlined pill.
- **Overdue:** the deadline label and points in `overdue` (`#ff9d85`); nothing else
  changes.

---

## 6. Motion

- Page load (splash only): staggered 0.9s ease-out rise (`translateY(18px) → 0`,
  opacity) on the hero blocks; the film fades in over 1.4s.
- Lit dot blink: 2.6s ease-in-out infinite.
- Row expand: height auto with `transition: opacity .25s`; do not animate layout on
  mobile.
- Everything collapses to instant under `@media (prefers-reduced-motion: reduce)`.

---

## 7. Splash page (marketing)

Lives at `/` for logged-out visitors or as a separate `splash.html`; the app keeps
its routes. Structure, top to bottom:

1. **Nav** 64px sticky, `bg-ground/82 backdrop-blur`, wordmark · mono links
   (Framework · Screens · Built) · outlined "Open the demo →".
2. **Hero** 3-column grid at ≥1100px: `1fr | clamp(280px, 32vw, 460px) | 1fr`.
   Left "What" + 20-word subtext; center 9:16 film (four 5s chapters crossfading,
   muted, captions in the right panel); right "now?" flush right, chapter readout +
   progress ticks + Open the demo / Read the framework. Bottom-left is the lit
   readout (the real #1 item). Tablet (700–1099): headline on one line, two columns
   (film left; readout, chapter, actions right). Phone: question → readout → film
   cropped 4:5 → chapter → full-width buttons.
3. **Framework**: `priority = cost of delay ÷ job size × staleness` in mono, then
   three panels: the 35/25/20/6 stacked bar, the ÷1 ÷2 ÷3 tiles, and the staleness
   curve (flat to day 3, 1 + d/60 to 1.5 at day 30) with the #1 item plotted.
4. **Screens**: headline + 5 dotted-rule rows (mono index, name, blurb) driving a
   sticky 4:5 frame of the real screenshot. Phone: frame becomes 4:3 and sticks
   above the list.
5. **Built**: three receipt rows linking FRAMEWORK.md, DECISIONS.md, source.
6. **Footer**: wordmark, per-visitor-demo note, primary "Open the demo →".

Copy for every section is final in `Foreground Splash.dc.html`; lift it verbatim.
One CTA label only: "Open the demo". No em dashes anywhere in copy.

---

## 8. Migration notes for the repo

- `src/index.css`: replace the Organic tokens with the `@theme` block above; delete
  the light-theme variables and `dark:` variants (or keep `dark` as the only
  applied class).
- `index.html`: swap the font link; update `<meta name="theme-color">` to `#15171b`;
  regenerate `public/og-foreground.png` from the new What now.
- `ScoreLedger.tsx`: switch to the 3-column mono grid; color deadline and
  staleness rows `text-accent`, overdue `text-overdue`; render the equation line in
  `text-text-3` and the score in Archivo 700.
- `scoreDisplay.ts` `teaserLine`: keep the full string; the UI must wrap it, never
  ellipsize.
- `FilterChips.tsx` / `Segmented.tsx`: mono uppercase labels, pill group styling
  above.
- `StatusActions.tsx`: Start / Done / Park variants as specified (primary / outlined
  / ghost; soft / outlined / ghost inside rows).
- `Sheet.tsx`, `Toaster.tsx`, `EmptyState.tsx`, `QueryStates.tsx`,
  `BlockedChain.tsx`: restyle per §5 States; no structural change.
- Tab bar in `App.tsx`: dots + mono labels, drop icons.
- Remove `design/organic-tokens.css`; add this file as `design/EMBER.md`.

Verify with the existing Playwright drive (`scripts/verify-drive.mjs`); the DOM
structure and copy of every screen are unchanged except the What now factor line,
which now wraps onto its own row.
