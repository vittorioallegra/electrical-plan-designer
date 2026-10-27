---
# gstack: design-md-format=spec
name: Electrical Plan Designer
description: A modern, simple and functional pro tool; cool graphite surfaces, one teal accent, calm precision.
colors:
  # Light theme
  chrome: "#F4F5F6"
  panel: "#FFFFFF"
  raised: "#FFFFFF"
  hover: "#EEF0F2"
  pressed: "#E6E8EB"
  border: "#E1E3E6"
  border-strong: "#CDD1D6"
  text: "#1A1C1F"
  text-muted: "#646A73"
  text-faint: "#8B9099"
  accent: "#0F766E"
  accent-hover: "#0C635C"
  on-accent: "#FFFFFF"
  accent-subtle: "#E3F3F1"
  accent-text: "#0B6B63"
  focus: "#0F766E"
  error: "#C2342B"
  error-subtle: "#FBEAE8"
  warning: "#A86A12"
  warning-subtle: "#FBF1DF"
  success: "#2F7D3B"
  success-subtle: "#E6F2E7"
  canvas-bg: "#FFFFFF"
  canvas-grid: "#D5D9DE"
  canvas-wall: "#2B2E33"
  canvas-wall-fill: "#F1F2F4"
  canvas-node: "#1A1C1F"
  canvas-label: "#646A73"
  canvas-selection: "#0F766E"
  canvas-run: "#5B6470"
  canvas-riser: "#BE185D"
  canvas-warning: "#A86A12"
  canvas-highlight: "#2F7D3B"
  # Dark theme
  dark-chrome: "#141517"
  dark-panel: "#1B1C1F"
  dark-raised: "#232529"
  dark-hover: "#26282C"
  dark-pressed: "#2E3135"
  dark-border: "#2A2D32"
  dark-border-strong: "#3A3E44"
  dark-text: "#E4E6E9"
  dark-text-muted: "#9AA0A9"
  dark-text-faint: "#6E747D"
  dark-accent: "#2DB3A6"
  dark-accent-hover: "#45C2B6"
  dark-on-accent: "#062320"
  dark-accent-subtle: "#163633"
  dark-accent-text: "#5CCFC3"
  dark-focus: "#2DB3A6"
  dark-error: "#EF6A60"
  dark-error-subtle: "#3A1F1D"
  dark-warning: "#E0A23F"
  dark-warning-subtle: "#3A2D17"
  dark-success: "#5DB36A"
  dark-success-subtle: "#1D3220"
  dark-canvas-bg: "#111214"
  dark-canvas-grid: "#2A2D31"
  dark-canvas-wall: "#C9CDD3"
  dark-canvas-wall-fill: "#1C1E21"
  dark-canvas-node: "#E4E6E9"
  dark-canvas-label: "#9AA0A9"
  dark-canvas-selection: "#2DB3A6"
  dark-canvas-run: "#A3ABB6"
  dark-canvas-riser: "#F472B6"
  dark-canvas-warning: "#E0A23F"
  dark-canvas-highlight: "#5DB36A"
typography:
  title:
    fontFamily: IBM Plex Sans Variable
    fontWeight: 600
    fontSize: 24px
    letterSpacing: -0.01em
  heading:
    fontFamily: IBM Plex Sans Variable
    fontWeight: 600
    fontSize: 15px
  body:
    fontFamily: IBM Plex Sans Variable
    fontWeight: 400
    fontSize: 13px
    lineHeight: 1.45
  small:
    fontFamily: IBM Plex Sans Variable
    fontWeight: 400
    fontSize: 12px
  label:
    fontFamily: IBM Plex Sans Variable
    fontWeight: 600
    fontSize: 11px
    letterSpacing: 0.02em
  mono:
    fontFamily: IBM Plex Mono
    fontWeight: 400
    fontSize: 13px
    fontFeature: tnum
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  0.5: 2px
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  6: 24px
  8: 32px
  12: 48px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
    height: 28px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.raised}"
    borderColor: "{colors.border-strong}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: 28px
  button-ghost:
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    height: 28px
  icon-button:
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    size: 28px
  input:
    backgroundColor: "{colors.chrome}"
    borderColor: "{colors.border}"
    rounded: "{rounded.sm}"
    height: 28px
  segmented:
    backgroundColor: "{colors.hover}"
    selectedBackgroundColor: "{colors.raised}"
    rounded: "{rounded.sm}"
    height: 28px
  list-row-selected:
    backgroundColor: "{colors.accent-subtle}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.sm}"
    height: 28px
  popover:
    backgroundColor: "{colors.raised}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
  dialog:
    backgroundColor: "{colors.raised}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
  badge:
    rounded: "{rounded.xs}"
    height: 20px
---

# Electrical Plan Designer

## Overview

**Creative North Star:** a modern, simple and functional pro tool: precise like a measuring
instrument, but polished and easy on the eyes like Figma or Linear.
**Product context:** an offline Electron desktop app (macOS, Windows) for electricians and small
installation firms: floor plan editor on a canvas, panel builder, circuits, bill of materials,
checks and quotes, plus an app library of catalogs and prices. Italian and English UI.
**Mode per surface:** Operate everywhere (editor, panel, library, quote); the start screen is the
only place with a little more air.
**Reference products:** Figma, Linear, Fusion 360 (from design knowledge; no web research).
**Key characteristics:**
- The canvas is the hero: chrome is quiet, neutral and thin.
- One accent colour, teal, used only for the active tool, selection, focus and the primary action.
- Numbers (lengths, cross sections, currents, prices) are set in a tabular monospace.
- Hierarchy comes from type weight, 1px hairlines and surface tone, not from cards and shadows.
- Light and dark are equal citizens, and the plan canvas follows the theme.

The one thing a first-time user should remember: "this is a serious tool".

## Colors

**Strategy:** Restrained. Cool graphite neutrals plus one accent; colour is rare and meaningful.

**Why teal and not blue.** Every strong hue an electrician sees on a drawing already means a
conductor: blue is neutral, brown, black and grey are phases, yellow-green is earth, and red,
orange, violet and pink are used too (`src/lib/colors.ts`). Teal is the one saturated hue that
never reads as a cable, so selection and focus on the canvas stay unambiguous. Success green is
kept darker and always paired with an icon and text so it never competes with the accent.

**Light or dark:** decided by the user and the room, not by the category. The default follows the
OS (`System`); `Light` and `Dark` can be forced in Settings. Electricians work in offices by day
and on laptops on site; both themes must be complete.

**Roles.**
- `chrome` is the window background (title bar, gaps); `panel` holds side panels and tables;
  `raised` is for popovers, dialogs and floating toolbars; `hover` and `pressed` are state fills.
- `border` separates regions; `border-strong` outlines secondary buttons and hovered inputs.
- `text` / `text-muted` / `text-faint`: primary, secondary (labels, metadata), tertiary (units,
  placeholders, missing values such as an unset price shown as "—").
- `accent` fills the primary button and the canvas selection; `accent-subtle` + `accent-text`
  mark the selected row and the active tool. Never use the accent for decoration.
- `error`, `warning`, `success` each have a `-subtle` background for badges and banners.
- Canvas tokens (`canvas-*`) are read by the Konva layers. Conduit runs share one neutral colour
  (`canvas-run`) and the laying type is told apart by the dash pattern only: floor dashed
  (6 4), ceiling dash-dot (8 3 2 3), direct dotted (2 3); the legend shows the three patterns.
  A selected run turns teal. The riser keeps its own colour. The old cyan ceiling colour is
  retired because it collided with teal.

**Dark theme.** Surfaces step up in lightness with elevation (chrome < panel < raised) instead of
inverting the light theme. The accent is lightened for contrast and the primary button uses dark
text on it (`on-accent`). Canvas walls become light grey on a near-black ground; the run colour is
lightened by one step.

**Contrast.** Body text at least 4.5:1 and icons/large text at least 3:1 on their surface, in
both themes. Status is never colour alone: always an icon or a word too.

## Typography

**Faces.** IBM Plex Sans (variable) for all UI text; IBM Plex Mono for every number a user reads
or edits (lengths, mm², A, %, €, codes) with tabular figures. Plex comes from IBM's engineering
world, it is precise without being cold, has full Italian coverage and a true monospace sibling.
Both are OFL-1.1 and bundled with the app from `@fontsource-variable/ibm-plex-sans` and
`@fontsource/ibm-plex-mono` (5.3.x, verified on npm 2026-10-27). No runtime font requests: the
app is offline and its CSP allows only bundled assets.

**Scale.** 11 (section labels, uppercase, +0.02em) / 12 (secondary, metadata, table headers) /
13 (base UI and body) / 15 (dialog and panel titles) / 18 (page titles in library and quote) /
24 (start screen title). Headings are semibold (600); body is 400; buttons and selected rows
are 500. Nothing larger than 24px anywhere.

**Italian is longer.** Labels must tolerate +30% length: no fixed-width buttons, truncate with an
ellipsis and a tooltip in lists, wrap in inspector labels.

## Layout

- Desktop app, minimum window 1024×640 (`window.ts` `minWidth` 1024); designed at 1440×900 and 1280×800.
- Editor: 40px title bar (macOS: hidden-inset with traffic lights; Windows: native frame, the same
  bar below it), 44px vertical tool rail, left panel 248px, right inspector 280px (both
  resizable 200–400px and collapsible), canvas fills the rest, a 28px status bar at the bottom
  that expands into the circuits / BOM / warnings panel on demand.
- Panels are divided into sections with an 11px uppercase label, 12px padding and a hairline
  between sections. No cards inside panels and no card inside a card.
- Rows and controls are 28px high (24px inside toolbars and floating bars); the existing `touch`
  density raises them to 36px.
- Spacing on a 4px grid: 4 / 8 / 12 / 16 / 24 / 32 / 48. Gaps inside a control group are 4–8px;
  between groups 16px; page padding in library and quote 24px.
- Library and quote are full-width pages with a toolbar row (search, filters, actions) above a
  table; item details open in a side panel, not a modal, when editing is frequent.

## Elevation & Depth

Flat by default: regions are separated by `border` hairlines and surface tone. Shadows only on
things that float above the canvas or the page: popovers, menus, floating toolbars, dialogs
(`shadow-pop`: 0 1px 2px + 0 8px 24px -4px; `shadow-dialog`: 0 2px 4px + 0 24px 48px -12px, both
neutral, darker in the dark theme). No coloured or zero-offset glows.

## Shapes

Radii: 4px badges and checkboxes, 6px controls and rows, 8px popovers, menus and floating bars,
12px dialogs and the few content boxes on the start screen. A nested element uses the outer
radius minus the gap. Icons: lucide-react at 16px with 1.5 stroke (14px inside rows).

## Components

All screens draw controls through `src/components/ui`; no native `<select>` or ad-hoc styled
buttons in features.

- **Button** (primary, secondary, ghost, danger-ghost): 28px, 12px horizontal padding, 500
  weight. Hover darkens/fills, active uses `pressed`, `focus-visible` shows a 2px `focus` ring with
  1px offset, disabled at 45% opacity with no hover.
- **IconButton**: 28×28, `text-muted`, tooltip with the label and shortcut; required
  `aria-label`.
- **Input / NumberInput**: 28px, `chrome` fill, `border` hairline, unit suffix in `text-faint`,
  value in mono. Invalid: `error` border and a message below.
- **Select / Combobox**: Radix-based, same box as Input, menu as a popover.
- **SegmentedControl**: for 2–5 exclusive options (theme, view switch, category filter).
- **Tabs**: underline style inside panels; segmented style for top-level view switches.
- **ListRow**: 28px, icon + label + right-aligned meta; selected = `accent-subtle` fill.
- **Table**: 32px header in `text-muted` 12px, 36px rows, hairline separators, numeric columns
  right-aligned in mono, row hover fill, sticky header, empty state inside the table frame.
- **Badge**: 20px, 4px radius, neutral / accent / success / warning / error variants, always
  with text.
- **Panel section header**, **Toolbar**, **Floating toolbar**, **Status bar**, **Empty state**
  (one sentence plus the one action that fixes it), **Dialog** (title, description, content,
  footer with ghost cancel and one primary), **Menu**, **Toast**, **Tooltip**.

Every component designs its empty, loading, error and long-content states.

## Do's and Don'ts

- Do keep exactly one primary button per view or dialog.
- Do set every number in mono with its unit in `text-faint`.
- Do read every colour from a token; the canvas reads `canvas-*` and re-reads on theme change.
- Do show each action once per screen; the native menu is where File and Edit commands live.
- Do label icon-only buttons and give them tooltips with shortcuts.
- Don't use the accent for decoration, headings or illustrations.
- Don't tell conduit laying types apart by colour; use the dash pattern.
- Don't signal selection, focus or hover on the canvas with blue, brown, grey, black,
  yellow-green, red, orange, violet or pink: they are conductor colours. State is teal.
- Don't wrap panel content in cards or put shadows on docked panels.
- Don't use system-ui as the primary face or load fonts from the network.
- Don't add a second navigation row, kicker labels above headings, or gradients.

## Motion

- **Approach:** minimal-functional.
- **Easing:** enter ease-out, exit ease-in, move ease-in-out.
- **Duration:** hover and press 80ms; panel open/close and popovers 120–160ms; dialogs 160ms.
  No entrance animations, no motion on the canvas except pan/zoom. Respect
  `prefers-reduced-motion` (durations drop to 0).
- **The one authored moment:** the bottom panel sliding up from the status bar when a warnings
  badge is clicked.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-27 | Initial design system created | /design-consultation from product context and design knowledge; the user asked for "modern, simple but functional, and also beautiful" |
| 2026-10-27 | Teal accent | The only strong hue that is not a conductor colour; selection never reads as a cable |
| 2026-10-27 | IBM Plex Sans + Plex Mono, bundled | Engineering register, Italian coverage, tabular numerals; offline CSP |
| 2026-10-27 | Conduit runs: one neutral colour, laying type by dash pattern | Cyan collided with teal and blue reads as the neutral conductor; the user chose dash patterns only |
| 2026-10-27 | Theme System / Light / Dark, canvas follows it | Agreed in docs/specs/ui-redesign.md |
