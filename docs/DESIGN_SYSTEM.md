# Design System

## Philosophy

Folio borrows the *principles* of premium product pages — not their look: one idea per screen,
oversized editorial type, generous whitespace, restrained colour, and motion that explains rather
than decorates. The landing story and the dashboard share the same grid, type scale and section
rhythm so the product reads as one continuous piece, not a marketing page with a tool bolted on.

Rules we hold to:
- **Content over containers.** Hairlines and whitespace separate content; there are almost no cards.
- **One accent.** Blue marks "your portfolio" everywhere — chart lines, the active step, the hero
  curve's endpoint. Everything else is ink, paper and grey.
- **Numbers are the hero.** Key figures are set very large in tabular figures; labels stay small.
- **Honesty is a design feature.** Data-quality notes, assumptions and "Not defined" states are
  designed in, never hidden.

## Typography

| Role | Face | Size (Tailwind token) | Notes |
|---|---|---|---|
| Display (hero) | Instrument Serif | `text-display` clamp(3.25rem, 9vw, 8.5rem) | Line-height 0.92, tracking −3.5% |
| Section headline | Inter Tight 600 + Instrument Serif italic accent word | `text-headline` clamp(2.5rem, 5.6vw, 5rem) | Mixed sans/serif gives the editorial voice |
| Statement | Inter Tight 500 | `text-statement` clamp(1.9rem, 4.2vw, 3.75rem) | Emphasis words switch to serif italic |
| Title | Inter Tight 600 | `text-title` clamp(1.75rem, 3vw, 2.5rem) | Dashboard section titles |
| Hero figure | Inter Tight 600 | clamp(3rem, 10vw, 8.5rem) | Tracking −4.5%, tabular numerals |
| Body | Inter Tight 400 | 15–20px | Line-height relaxed (1.625) |
| Eyebrow | Inter Tight 600 | 11px, uppercase, tracking 0.18em | Section labels with a numeric index |

Fluid `clamp()` sizes scale smoothly from phone to desktop without breakpoint jumps. Numeric
columns and figures use `font-variant-numeric: tabular-nums` (`.num`) so digits align and counters
don't jitter.

## Colour

| Token | Hex | Use |
|---|---|---|
| `paper` | `#f6f5f1` | Page background (warm off-white) |
| `paper-2` | `#efede7` | Methodology band, hover wash |
| `ink` | `#0f0f0f` | Primary text, primary button |
| `ink-2` / `ink-3` / `ink-mute` | `#3d3c39` / `#6b6963` / `#8b8880` | Secondary, tertiary, muted text |
| `line` | `rgba(15,15,15,0.10)` | Hairline dividers and borders |
| `night` / `night-2` | `#0c0c0d` / `#161617` | Immersive "How it works" chapter, footer |
| `series.portfolio` / `accent` | `#2a78d6` | Portfolio series, links, focus ring |
| `series.benchmark` | `#8b8880` | Benchmark series (recessive, dashed) |
| `gain` / `loss` | `#0b6e3a` / `#b63a2b` | Positive / negative values (always with ▲/▼ or sign) |

**Charts** follow a validated categorical order (blue, orange, aqua, yellow, magenta, green,
violet, red), assigned by holding position, never cycled; a ninth+ holding folds into "Other".
Gridlines `#e1e0d9`, axis `#c3c2b7`, tick labels `#8b8880`. Text never takes a series colour.
Colour is never the only signal: gains/losses carry signs and ▲/▼ glyphs; series carry solid vs
dashed strokes and legends.

## Spacing & layout

- Page container: `max-w-[1240px]` with 16px (phone) / 32px / 40px gutters (`.page`).
- Section rhythm: 112–176px vertical padding (`py-28 sm:py-36/44`), dashboard sections 80–112px.
- Two-column editorial headers: title left, short explanation right-aligned (3 : 2).
- Grids of metrics use the "gap-px over a hairline background" technique for crisp 1px dividers.
- Radii are small and consistent (6px fields, 10–14px panels, full pills for buttons and chips).

## Components

| Component | File | Notes |
|---|---|---|
| Nav | `components/Nav.tsx` | Transparent at top; frosted (86% paper + blur) after 24px of scroll |
| Primary button | `.btn-primary` | Ink pill, lifts with a soft shadow on hover, scales to 98% on press |
| Ghost button | `.btn-ghost` | Text button with a faint wash on hover |
| Field | `.field` / `.field-invalid` | 1px hairline, white on focus; invalid state tints red and shows a message below |
| InfoTip | `components/InfoTip.tsx` | Hover/focus/tap; Escape and outside-click close; `role="tooltip"` + `aria-describedby` |
| AnimatedNumber | `components/AnimatedNumber.tsx` | Visual count-up with the final value exposed to screen readers |
| DashSection | `sections/dashboard/DashSection.tsx` | Numbered eyebrow, title, description, content |
| Allocation meter | `Configurator.tsx` | Live total with "x% left / over by x% / 100% allocated" |
| Data-quality notice | `DataQualityNotice.tsx` | Collapsible; opens automatically when data is incomplete |

## Motion

All scroll animation uses GSAP ScrollTrigger inside `gsap.matchMedia()`:

| Effect | Where | Behaviour |
|---|---|---|
| Masked headline reveal | Hero | Words rise from a clip mask with 90ms stagger (power4.out) |
| Line draw | Hero curve | `stroke-dashoffset` animates the abstract curve; endpoint dot pops in |
| Ambient drift | Hero glows | 18s CSS keyframe drift, very low contrast |
| Parallax + recede | Hero on scroll | Content scales to 94% and fades; curve moves at a different rate (desktop only) |
| Scrubbed word reveal | Statement | Each word's opacity tied to scroll position (0.14 → 1) |
| Sticky chapter | How it works | Left column sticks; numeral slides and visual cross-fades as each step passes |
| Fade-and-rise | All `[data-reveal]` | 28px rise, 1s, once per element |
| Count-up | Overview & metrics | easeOutQuart from 0 when 30% visible |
| Chart draw-in | All charts | Charts mount when they enter the viewport so their entry animation is seen |

Principles: durations 0.6–1.8s with ease-out curves; animate only `transform` and `opacity`;
nothing loops except the barely-visible ambient drift and scroll cue; animations never block input.

**Reduced motion.** With `prefers-reduced-motion: reduce`, GSAP effects are not registered (so
nothing starts hidden), counters show final values, chart animations are disabled, smooth scrolling
is off, and CSS animations are effectively removed. Pinning and parallax are also disabled below
900px width.

## Responsive behaviour

- Phone (< 640px): single column; holdings rows keep ticker, weight and remove; metric grid
  stacks; table scrolls horizontally within its own container; How-it-works shows each step's
  visual inline instead of a sticky column.
- Tablet: two-column metric and insight grids.
- Desktop (≥ 1024px): configurator splits holdings (7) and parameters (4) with a hairline;
  sticky storytelling enabled.

## Accessibility

- Semantic landmarks (`header`, `nav`, `main`, `section`, `footer`), one `h1`, ordered headings.
- Skip link to the portfolio builder.
- Every input has a visible or screen-reader label; invalid fields set `aria-invalid`.
- Sortable table headers are buttons with `aria-sort`.
- Live regions announce allocation totals and loading progress; errors use `role="alert"`.
- Charts have `role="img"` with descriptive labels; the holdings table provides the same data in
  text form.
- Visible focus ring (2px accent) on all interactive elements.
- Text contrast: primary and secondary ink on paper exceed WCAG AA for body text.
