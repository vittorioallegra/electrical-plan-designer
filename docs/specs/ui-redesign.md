# UI/UX redesign

Status: agreed (2026-10-27). Related: docs/specs/desktop-app.md (behavior that must not change),
docs/plans/ui-redesign.md (plan), DESIGN.md (design system, written during planning).

## Context

The desktop app (Electron, renderer in `apps/web`) works, but its interface looks like an
unstyled prototype: system font, default blue, inconsistent spacing and control sizes, no dark
theme, and a layout without hierarchy. The users are electricians who spend hours in the plan
editor; they need a tool that looks and feels like a professional desktop application. The
first public release has not happened yet, so this is the moment to fix the interface before
users learn it.

Target style: a modern pro tool (Figma, Linear, Fusion): dense but clean, the canvas at the
centre, compact side panels, light and dark theme, a sober neutral palette with one accent
colour.

## Current state (verified 2026-10-27 on `claude/ui-redesign-e65cb2`)

- Styling: Tailwind v4 utilities, one stylesheet `apps/web/src/app/styles.css` (79 lines) with
  light-only `@theme` tokens (accent `#1d4ed8`), `ui-sans-serif, system-ui` font, a
  `data-density` switch. No dark theme, no `prefers-color-scheme`. Radix dialog, dropdown,
  tabs and toast; `lucide-react` icons.
- Hardcoded colours outside the tokens: `src/lib/colors.ts` (conductor colours),
  `src/features/panel/utils/rcdGroups.ts`, `src/features/editor/background/importFile.ts`.
  Canvas colours come from `--color-canvas-*` read once per mount
  (`features/editor/canvas/canvasColors.ts`), so they would not follow a theme change.
- Editor frame `src/app/layouts/ProjectFrame.tsx` (279 lines), one top bar holding: Home link,
  save status, Save, Undo/Redo, view links Plan/Panel/Quote/Settings, Update from library,
  Library link, Export menu (PDF, JSON, Import JSON), language select. Below it
  `ProgressStrip.tsx`, a second navigation row (Plan, Panel, Conduits, Boxes, Circuits, BOM
  with done/next state). At the bottom a drawer with tabs Circuits / BOM / Warnings that takes
  a large share of the window and is often empty.
- Plan view `features/editor/components/PlanView.tsx`: left column = `FloorsPanel` (list, add,
  floor properties) stacked with `ToolPalette`; centre canvas; right `Inspector`. "Import
  plan" shows in the empty-canvas overlay and in the inspector's background panel at once.
- Start screen `features/start/components/StartPage.tsx`: title, New/Open/Library buttons,
  plain recent-files list, recovery banner. No identity, recent files not prominent.
- Library `features/library/components/*`: section nav, raw tables, a price `NumberInput` on
  every catalog row ("No price €" placeholders everywhere).
- Duplicates of the native menu (`apps/desktop/src/main/menu.ts`): Save, Undo/Redo, Home
  (= Close project). Export, Import JSON, Library, language: in-app only.
- Tests: 11 Playwright specs (5 web, 6 desktop), about 30 selectors tied to layout labels; no
  screenshot tests. 751 i18n keys in `en.json`/`it.json`.

## Goal

Every screen of the renderer is redesigned on one design system, with the same features.

### Decisions already taken (with the user)

1. Scope is the on-screen app only. PDF and CSV exports keep their current look.
2. The plan canvas follows the theme: background, grid, walls, symbols, runs and selection
   come from theme tokens and switch live when the theme changes.
3. Theme: `System` (default), `Light`, `Dark`, chosen by the user and stored as an app
   preference.
4. "Library" and app preferences merge into one **Settings** screen (route `/settings/<section>`),
   opened from a native menu item `Settings…` (macOS: app menu, `Cmd+,`; Windows: File menu,
   `Ctrl+,`), from the start screen and from a gear button in the editor. Sections: General
   (theme, language), Company, Catalog, Presets, New projects (today's library defaults). The
   word "Library" leaves the UI; "Update from library" becomes "Update from catalog". Behavior
   is unchanged: this data stays app-level, projects keep their copies, the open project stays
   open while Settings is shown. The per-project view formerly called "Settings" is renamed
   "Project". The language select leaves the top bar.
5. Export PDF, Export JSON and Import JSON are added to the native File menu (Export ▸ …).
   In-app, export stays reachable from a single compact control.
6. Layouts chosen on HTML mockups (all variant A): editor = Figma-like (views Plan / Panel /
   Quote / Project in the title bar, vertical tool rail, left panel with floors, floor
   properties and background, right inspector, status bar with Circuits / BOM / Warnings that opens the bottom
   panel on demand); start = sidebar with identity and actions plus recent files list; catalog =
   section sidebar, searchable table, fixed detail panel on the right. The workflow strip is
   removed as a row; its done/next guidance survives as a compact progress control in the
   status bar.
7. E2E selectors may change with the structure, as long as every behavior stays covered.

### Design process (before any code)

1. Design system via `/design-consultation`, written to `DESIGN.md` at the repo root:
   typography (a bundled font, the app is offline and its CSP allows no remote fonts),
   colour tokens for both themes, spacing scale, control sizes, radii, elevation, icon
   style, motion, density.
2. Mockups (HTML, 3 variants each) for the start screen, the plan editor and the catalog; the
   user picked a direction for each. Panel, quote and the other settings sections follow the same
   system without their own shotgun round unless the user asks.

### Expected result per area

- **Visual system.** Tokens in `styles.css` (`@theme` plus a dark override) cover every colour
  used by the UI and the canvas, including conductor colours and RCD group colours. Shared
  components in `src/components/ui` (button, icon button, input, select, segmented control,
  tabs, menu, dialog, table, badge, toolbar, panel/section header, empty state, tooltip) are
  the only way screens draw controls. Native `<select>` elements and local one-off badges are
  replaced by them.
- **Editor shell.** One navigation for the project (no second row). The top bar holds only the
  project identity (name, save state) and the actions that have no native menu equivalent;
  Home, Save, Undo/Redo and language leave it (they live in the native menu; the user can
  still close the project and reach the start screen). Settings and Update from catalog stay
  reachable.
- **Plan editor.** Clear regions: tools, floors, canvas, inspector, secondary data (circuits,
  BOM, warnings). Floor properties are not stacked in the same column as the tool palette
  without hierarchy. The secondary data panel is collapsible and takes no space when closed;
  the warnings count stays visible when it is closed. "Import plan" appears once per screen.
- **Start screen.** App identity (name, mark), recent files as the main content (name, path,
  modified date, missing state), New and Open as primary actions, the recovery banner and the
  "continue" entry for the open project kept.
- **Settings (ex Library).** Section navigation, catalog browsing with search and category filter, prices
  edited in the item detail (or inline only on demand) instead of an input on every row,
  catalogs listed with their actions.
- **Quote, panel, project data.** Restyled on the same components and layout grammar.
- **Native feel.** macOS: hidden-inset title bar with traffic lights in the top bar's drag
  region; Windows: the native frame stays (title bar overlay only if it does not risk the
  release). Non-interactive regions are not text-selectable; the cursor stays default on
  chrome.

## Acceptance criteria

1. `DESIGN.md` exists at the repo root and lists every token used by the app; no hex/rgb
   literal remains in `apps/web/src` outside `styles.css` (lint or unit test enforces it,
   PDF code excepted).
2. With the OS in dark mode and theme `System`, every route renders with dark tokens; switching
   theme in Settings applies to the open window and the canvas without reload; the choice
   survives an app restart (Electron E2E).
3. The editor has exactly one navigation landmark for project views; the native menu covers
   New, Open, Open Recent, Save, Save As, Close, Export ▸ PDF/JSON, Import JSON, Undo/Redo,
   Settings; none of Save, Undo, Redo, Home, language is a button in the top bar.
4. On the plan view at 1440×900 with the bottom panel closed, the canvas takes at least 70% of
   the window area; at 1280×800 no panel overflows horizontally.
5. "Import plan" is rendered at most once in the plan view at any time.
6. The start screen lists recent files first, each with name, folder and modified date; a
   missing file is marked and removable.
7. The catalog table has no per-row price input; price is edited in one place per
   item; search filters by name and code.
8. Every UI string goes through `t()`; every new key exists in `en.json` and `it.json`.
9. All behaviors in docs/specs/desktop-app.md still pass: `pnpm verify` green (typecheck,
   lint, unit, web E2E, desktop E2E). Every test that changed keeps covering the same
   behavior, and its card comment says so.
10. Keyboard: every control reachable by Tab with a visible focus ring in both themes; text
    contrast at least 4.5:1 (body) and 3:1 (large text, icons) in both themes.
11. `/qa` and `/review` done, findings fixed in separate commits; nothing pushed.

## Testing plan

| Layer | What | Count |
|---|---|---|
| Unit (repo) | no colour literals outside tokens; every i18n key in both locales (exists) | +1 |
| Unit (web) | theme preference resolution (system/light/dark), canvas colours recompute on theme change, Settings screen sections, start screen recent list states | +6 |
| Web E2E | editor navigation, bottom panel open/close with warnings badge, import plan once, catalog search/price edit | update existing + ~3 |
| Desktop E2E | Settings via menu, theme persists across restart, Export menu items | +3 |

Each test carries `// protects=...; fails_when=...; no_claim=...`.

## Rollback

All work sits on `claude/ui-redesign-e65cb2`; nothing is pushed. Dropping the branch restores
the current UI. File formats and stored data are untouched (theme and language live in app
preferences, not in `.epd` or the library).

## Out of scope

- New features or changed behavior (data model, file formats, calculations, checks, quotes).
- PDF/CSV export layout.
- New symbols or a change to symbol drawings beyond their colours.
- Touch/tablet layouts beyond keeping the existing density switch working.
- Publishing, signing, release.
