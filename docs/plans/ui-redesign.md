# UI/UX redesign — plan

Spec: docs/specs/ui-redesign.md. Design system: DESIGN.md. Mockups (open in a browser):
docs/design/mockups/{editor,start,library}.html (variant A of each is the chosen one; the
library mockup's sidebar becomes the Settings sidebar), docs/design/design-system-preview.html.

## Steps

Every step keeps behavior unchanged, follows DESIGN.md, puts every new string in `en.json` and
`it.json`, updates the unit and E2E tests it breaks (same behavior covered, card comment kept
accurate) and leaves typecheck, lint and the touched tests green.

1. **Tokens, fonts, theme-aware canvas.** Add `@fontsource-variable/ibm-plex-sans` and
   `@fontsource/ibm-plex-mono` (400, 500) to `@epd/web`, import them in `src/app/main.tsx`.
   Rewrite `src/app/styles.css`: every DESIGN.md colour as a `@theme` token (light), the dark set
   under `@media (prefers-color-scheme: dark)` on `:root:not([data-theme='light'])` and under
   `:root[data-theme='dark']`; radii, shadows, font families (`--font-sans`, `--font-mono`), type
   scale, `tnum` utility; keep `data-density` (compact 28px; touch stays 44px as today, out of
   scope). Tokens that only JS or inline `var()` read (`canvas-*`, `conductor-*`, `rcd-*`) must be
   emitted even when no utility uses them: verify Tailwind v4 output and use `@theme static` or
   plain `:root` variables if needed (otherwise `getComputedStyle` silently returns empty). Move conductor swatches
   (`src/lib/colors.ts`) and RCD group colours (`features/panel/utils/rcdGroups.ts`) to tokens
   (`--color-conductor-*`, `--color-rcd-*`), returning `var(...)` strings; yellow-green becomes two
   tokens and `ConductorBadge` builds the gradient. `importFile.ts`'s white is the flatten fill of
   imported backgrounds, not UI: allowlisted, not a token. Conduit runs:
   one `canvas-run` colour, laying type by dash pattern only (floor `6 4`, ceiling `8 3 2 3`,
   direct `2 3`; legend updated); selection teal. `features/editor/canvas/canvasColors.ts` re-reads tokens when
   the resolved theme changes (subscribe to `matchMedia('(prefers-color-scheme: dark)')` and to
   `data-theme` changes on `<html>`; the `useMemo([])` in `PlanCanvas.tsx` depends on the resolved
   theme) and adds `canvas-warning`, `canvas-wall-fill`, `canvas-label`. Konva text is redrawn
   after `document.fonts.ready` so the first paint does not keep fallback-font metrics. Old token names used
   by components are mapped to the new ones in this step so nothing renders unstyled.
   Tests: repo test `tests/lint/` (or the existing repo project) failing on any hex/rgb/hsl
   literal in `apps/web/src/**/*.{ts,tsx,css}` outside `styles.css` and the PDF modules (explicit
   allowlist with reasons); unit test that every text/surface pair in both themes meets 4.5:1
   (3:1 for `text-faint`, icons, borders-as-indicators) by parsing `styles.css`; a test that the
   DESIGN.md front-matter colours equal the `styles.css` tokens; canvas colours recompute on a
   theme change (jsdom, mocked `getComputedStyle`).

2. **Theme preference end to end.** `packages/bridge`: `ThemePreference = 'system' | 'light' |
   'dark'`, `EpdBridge.preferences.getTheme(): Promise<ThemePreference>` and
   `setTheme(theme): Promise<void>`, channels, validation. `apps/desktop/src/main/preferences.ts`:
   `userData/preferences.json` (atomic write, tolerant read with defaults), applied to
   `nativeTheme.themeSource` before the first window is created and on every change, so the CSS
   media query, native menus and dialogs follow; `BrowserWindow.backgroundColor` comes from
   `nativeTheme.shouldUseDarkColors` (no white flash). Every window is told about a change
   (`preferences.onThemeChanged`) so another window's Settings control does not go stale. `apps/web/src/lib/theme/`: `useThemePreference()`
   over the bridge; without `window.epd` (browser dev/E2E) it stores in `localStorage` and sets
   `data-theme` on `<html>`. Wire into the repositories/services pattern
   (`src/lib/repositories/`, `useEditorServices()` or a sibling) and the in-memory fake.
   Tests: main unit (read/write/defaults/invalid file), IPC validation, renderer hook (both
   backends), desktop E2E with two windows (theme change reaches both).

3. **UI kit.** Add `@radix-ui/react-select`, `@radix-ui/react-tooltip`,
   `@radix-ui/react-toggle-group`, `@radix-ui/react-popover` (versions at least two weeks old,
   matching the installed Radix majors) and `react-resizable-panels` (4.x). In `src/components/ui`:
   restyle `Button` (primary, secondary, ghost, danger-ghost; sizes sm 24 / md 28 / lg 36; icon slot),
   new `IconButton` (required label, tooltip with optional shortcut), `Tooltip`, `TextField` and
   `NumberInput` (unit suffix, mono value, invalid state), new `Select`, new
   `SegmentedControl`, `Tabs` (underline variant + segmented variant), `Menu`, `Dialog`
   (title, description, footer; 12px radius, shadow), `Table` (sticky header, numeric columns
   right-aligned mono, selectable rows, empty state), new `Badge`, `Toast`, new `PanelSection`
   (11px uppercase header + actions), new `Toolbar`, new `EmptyState`, `FileDropZone`,
   `RouteError` restyle. Replace the native `<select>`s (NodeInspector, DeviceInspector,
   IssuedQuotes, LanguageSwitch) and CatalogPage's local `Badge`. Tests: unit tests for the new
   components' behavior (keyboard, labels, states); existing tests updated for role changes.

4. **Routes and names: Settings and Project.** Move `features/library` to
   `features/app-settings` (the app Settings screen) and `features/settings` to
   `features/project-details` (the per-project data view); update ESLint feature boundaries, imports and
   test paths. Routes: `/settings/<general|company|catalog|presets|new-projects>` (index →
   `general`) replaces `/library/*` (redirect from `/library/*`, tested); `/project/details`
   replaces `/project/settings` (redirect too). Fix hard-coded paths such as
   `StartPage.tsx` `navigate('/library/company')`. i18n: "Library" disappears from the UI, "Update from library"
   becomes "Update from catalog", "Settings" names the app screen and "Project" the view. Add
   an empty `General` section (filled in step 6). `src/stores/library` and the `.epl` file keep
   their names (internal; data format unchanged). Tests and E2E selectors follow.

5. **Native menu: Settings and Export.** Bridge `MenuCommand` gains `settings`, `exportPdf`,
   `exportJson`, `importJson`. `menu.ts`: macOS app menu `Settings…` (`Cmd+,`) after About;
   Windows File menu `Settings…` (`Ctrl+,`); File ▸ Export ▸ PDF… / JSON…, File ▸ Import JSON…,
   enabled only when the focused window has a project (like Save); labels come from the renderer
   like the others. macOS `Settings…` with no window open creates a window, then routes to
   Settings.
   `MenuCommands.tsx` routes `settings` to `/settings/general` (project stays open) and runs the
   existing export/import actions. Tests: `menu.test.ts`, MenuCommands unit, desktop E2E menu
   items (incl. enablement per focused window).

6. **Settings screen.** Layout from the library mockup: a sidebar (General, Company, Catalog,
   Presets, New projects, plus the list of imported catalogs under Catalog) and a content area
   with a page header; a back link to the open project (or to the start screen). General holds
   the theme `SegmentedControl` (System / Light / Dark, via step 2) and the language `Select`
   (moved from the top bar and `AppShell`). Company, Presets and New projects restyled on the
   kit. Library import/export (`LibraryTransfer`) sits in General or the sidebar footer.
   Tests: General section unit (theme and language change), layout navigation.

7. **Catalog.** CatalogPage per mockup A: toolbar with search (name and code), category
   `SegmentedControl`, catalog filter from the sidebar, "show archived" toggle, "N without price"
   badge that filters; table without inputs (check a catalog of ~1,300 items renders
   without virtualization) (price shown, "—" when missing); a fixed detail
   panel on the right for the selected item where price and fields are edited (commit as today,
   on blur/Enter, no Save button; when a filter hides the selected item the panel shows the empty
   state) (replaces editing
   through `ItemDialog`; `ItemDialog` stays for "New item" if simpler); catalog actions (import,
   replace, export, remove) on the catalog rows in the sidebar. Tests: search filter, price edit
   in the detail panel, missing-price filter; E2E catalog flows updated.

8. **Start screen.** Mockup A: sidebar with app mark, name, version, New (primary, `⌘N`),
   Open (`⌘O`), Settings (`⌘,`); main area with the recovery banner, the "continue" entry for the
   open project, and recent files (name, folder, modified date, missing badge, remove, overflow
   menu). Bridge `RecentFile.modifiedAt?: number` filled by `recent.ts` with `fs.stat` (absent
   when missing). An app mark (SVG, teal tile with a bolt) added to `src/components/`, used in the UI only
   (release icons are out of scope). Tests: StartPage unit states (empty, missing,
   recovery), `recent.test.ts` for `modifiedAt`.

9. **Editor shell.** `ProjectFrame` per mockup A: 40px title bar with project name, save state,
   views `SegmentedControl` (Plan, Panel, Quote, Project) as links, Settings gear, a compact
   Export menu and the "Update from catalog" action in a project overflow menu; Home, Save,
   Undo, Redo and language buttons removed (native menu). macOS: `titleBarStyle: 'hiddenInset'`
   in `window.ts`, traffic-light inset, CSS drag regions (`app-region: drag`, `no-drag` on
   controls); the same drag strip and inset on the start screen and Settings (`AppShell`); no inset in
   macOS full screen. Windows keeps the native frame. `EpdBridge.platform` comes from preload.
   The Cmd/Ctrl+S and Z / Shift+Z key handlers stay (only path in browser mode). A "Close
   project" item in the project overflow menu replaces Home. Status
   bar: Circuits, BOM, Warnings (count badge always visible) open the bottom panel
   (`react-resizable-panels`, collapsible, closed by default; open state and size live in the
   editor store next to `drawerTab` but outside undo history, the dirty flag and the recovery
   copy; its slide respects `prefers-reduced-motion`); a
   progress control replaces `ProgressStrip` (current stage, menu of stages with done/next,
   same actions as today). Read-only and narrow-screen notices restyled as banners. `window.ts` `minWidth` 960 → 1024 (the
   narrow notice then only matters in the browser). Tests:
   frame unit (one navigation landmark, no Save/Undo buttons), bottom panel open/close, progress
   control actions; E2E selectors updated.

10. **Plan view.** Tool rail (vertical, 32px tools, tooltips with shortcuts, groups) from
    `ToolPalette`; left panel (resizable 200–400px, collapsible) with Floors (list, add, rename)
    + floor properties section + Background section; right inspector (resizable) restyled with
    `PanelSection`s (Node, Segment, Box contents); floating zoom control on the canvas; the empty
    canvas `EmptyState` is the only "Import plan" while the floor has no background, the
    Background section offers it only when the canvas is not empty. A small, collapsible
    on-canvas legend in a canvas corner shows the three conduit run dash patterns (floor,
    ceiling, direct); labels via i18n. Canvas check in both themes.
    Tests: "Import plan" rendered once (unit + E2E), panel collapse; the legend shows the three
    patterns (unit) and collapses; web E2E plan flows updated.

11. **Panel, circuits, BOM, warnings, quote, project details.** Restyle PanelView (palette,
    front, inspectors), CircuitsTab/CircuitEditor, BomTab, WarningsTab (rows with severity
    badge and location, click selects), QuotePage (materials table with mono numbers, totals,
    labor lines, issued quotes), Project details form, on the kit and layout grammar. Tests
    updated where roles/labels change.

12. **Dialogs and states pass.** Restyle every dialog (NewProject, BackgroundImport,
    Calibration, delete confirm, Import catalog, Replace catalog, Update from catalog, library
    transfer) and toasts; empty, loading and error states for each route; reduced-motion.
    Tests updated.

13. **E2E and docs.** New desktop E2E: Settings via menu (also with no window on macOS), theme
    persists across restart (preferences.json + nativeTheme), Export menu items enabled only
    with a project; new web E2E: bottom panel with warnings badge, catalog search and price
    edit, dark theme on every route (`emulateMedia`) and a live canvas switch, canvas ≥70% of
    the window at 1440×900 and no horizontal overflow at 1280×800 (English and Italian), Tab
    through each route with a visible focus ring in both themes. Update CLAUDE.md
    (feature folders, routes, design system line), docs/specs/desktop-app.md and
    docs/release.md wording (Library → Settings). Full `pnpm verify`.

## Risks

- **Structural steps.** Steps 4, 5 and 9 run the full web and desktop E2E before committing.
- **Late fonts and tokens.** The first canvas paint can use fallback metrics or colours; step 1
  redraws after `document.fonts.ready` and on theme resolution.

- **E2E churn.** About 30 layout-tied selectors change across steps 4–11; each step fixes what
  it breaks, step 13 runs everything. Keep accessible names stable where the new UI allows.
- **Canvas theming.** Konva caches colours per mount; step 1 must re-render layers on theme
  change or stale colours stay until reload.
- **hiddenInset title bar.** Drag regions can swallow clicks; every control in the bar needs
  `no-drag`. Electron E2E covers clicks in the bar.
- **Folder renames** (step 4) touch many imports and the ESLint boundary config; done in one
  step with no visual change to keep the diff reviewable.
- **Fonts and CSP.** Fonts are bundled assets served by `app://` (`font-src 'self'` already);
  verify in the packaged app, not only in dev.
- **Scope creep.** No new features: layer visibility, thumbnails and similar ideas seen in
  mockups are out (the editor mockup's "Livelli" section is not built).

## Architecture

**Styling.** Tailwind v4 stays, with DESIGN.md tokens in `src/app/styles.css` (`@theme`).
Dark theme is a token override driven by `prefers-color-scheme` (Electron follows
`nativeTheme.themeSource`), plus `data-theme` on `<html>` as the browser fallback. No CSS modules
or CSS-in-JS. Rejected: renderer-only theming (native menus/dialogs stay light, white flash at
start).

**Theme preference.** Owned by the main process (`preferences.ts`, `userData/preferences.json`),
exposed through `@epd/bridge` (`preferences.getTheme/setTheme`), applied to `nativeTheme`. The
renderer reads/writes it through a repository with an in-memory/localStorage fake for the browser.
Language stays where it is today (renderer `localStorage`), only its control moves.

**Components.** Radix primitives + our own components in `src/components/ui`, styled with tokens.
New deps: `@radix-ui/react-select`, `@radix-ui/react-tooltip`, `@radix-ui/react-toggle-group`,
`@radix-ui/react-popover` (MIT, React 19, released 2026-10), `react-resizable-panels` 4.x (MIT,
React 19, 2026-10), `@fontsource-variable/ibm-plex-sans` and `@fontsource/ibm-plex-mono` 5.3
(OFL-1.1). Rejected: shadcn/ui copy-in (its default look must be rewritten anyway), Mantine
(second styling system next to Tailwind), a hand-written splitter.

**Navigation.** One navigation per context: the editor's views in the title bar; Settings has a
sidebar; File/Edit commands, Settings and Export live in the native menu. Routes: `/` start,
`/settings/<section>`, `/project/<plan|panel|quote|details>`.

**Folders.**
```
apps/web/src/
  app/styles.css                tokens (light, dark, canvas, conductor), fonts, base
  components/ui/                Button, IconButton, Tooltip, TextField, NumberInput, Select,
                                SegmentedControl, Tabs, Menu, Dialog, Table, Badge, Toast,
                                PanelSection, Toolbar, EmptyState, FileDropZone, RouteError
  components/AppMark.tsx
  features/app-settings/        (was features/library) Settings screen and sections
  features/project-details/     (was features/settings) per-project details view
  lib/theme/                    useThemePreference, resolved theme
apps/desktop/src/main/preferences.ts
packages/bridge/src/            ThemePreference, preferences API, new menu commands
```

## Progress

Phase: done
Branch: claude/ui-redesign-e65cb2
Base: 8850b93
Spec: docs/specs/ui-redesign.md
Architecture: agreed
Approved: yes (2026-10-27)

### Steps
- [x] 1. Tokens, fonts, theme-aware canvas — `feat: add design tokens, bundled fonts and a theme-aware canvas`
- [x] 2. Theme preference end to end — `feat: add the theme preference end to end`
- [x] 3. UI kit — `feat: replace native selects and the catalog badge with the UI kit`
- [x] 4. Routes and names: Settings and Project — `refactor: rename library to app-settings and settings to project-details, with Settings and Project routes`
- [x] 5. Native menu: Settings and Export — `feat: add Settings and Export items to the native menu`
- [x] 6. Settings screen — `feat: add the Settings screen with sidebar, General section and kit-styled sections`
- [x] 7. Catalog — `feat: add the catalog table with detail panel, sidebar catalog actions and kit selects`
- [x] 8. Start screen — `feat: add the start screen sidebar layout, app mark and recent file dates`
- [x] 9. Editor shell — `feat: add the editor shell with title bar, status bar, bottom panel and progress control`
- [x] 10. Plan view — `feat: restyle the plan view with a tool rail, resizable side panels, zoom control and conduit legend`
- [x] 11. Panel, circuits, BOM, warnings, quote, project details — `feat: restyle the project details page and settings form with grouped rows and a kit run elevation select`
- [x] 12. Dialogs and states pass — `feat: restyle dialogs and states with ghost cancel, wide dialogs, shared loading and empty states and reduced motion`
- [x] 13. E2E and docs — `test: add web E2E for the warnings badge, catalog search and price edit, dark theme, canvas size, overflow and focus rings`

### Verification
- qa: done
  - Bottom panel reopened at the minimum height after being dragged shut — `fix: remember the bottom panel height only when a drag ends so reopening restores it`
  - Catalog table needed horizontal scrolling at 1024px, hiding the price column — `fix: hide the catalog column and narrow the detail panel below 1180px so the price column stays visible`
- review: done
  - File > Import JSON from the native menu did nothing: the page's file input needs a user activation a menu command does not give (the Electron E2E hid it by touching the page first) — `fix: import JSON from the native menu through a main-process dialog, since a page file input does not open without a click in the page`
  - The library notices rendered above the frames: on macOS under the traffic lights, above the title bar, and pushing the window-high frame's status bar off screen — `fix: show the library notices under each frame's title bar so they no longer sit under the macOS traffic lights and push the status bar off screen`

### Follow-ups
- File > Import JSON stayed enabled in the native menu for a read-only project, where it does nothing — `fix: disable Import JSON in the native menu for a read-only project by reporting the read-only state to main`
- The window background kept the colour of the theme at creation after a theme change — `fix: repaint every window's background when the theme changes instead of keeping the colour it was created with`
- A menu command (Settings) sent while all windows were minimized went to a window left hidden — `fix: show and focus the target window before delivering a menu command when no window has focus, so Settings is not opened in a hidden window`
- The `EPD_TEST_HOOKS` hook was active in a packaged app too — `fix: enable the EPD_TEST_HOOKS window hook only in an unpackaged app`
- The root and frame-level error screens had no macOS drag strip, so the window could not be dragged and the traffic lights overlapped the message — `fix: give the error screens that replace a whole frame the macOS drag strip, so the window can be dragged and the traffic lights clear the message`
- `Menu` wrapped each item in an extra `div` — `refactor: render Menu items as direct children of the Radix content instead of wrapping each in a div`
- Hand-styled buttons in StartPage recent rows, CatalogList, FloorsPanel, PanelFront and BackgroundImportDialog — `refactor: add a kit ListRow and use it for the recent files, the catalog import row and the floors, and Button for the page thumbnails and panel devices, instead of hand-styled buttons in features`
- Hand-styled buttons in StatusBar, ZoomControl and RunLegend (the status bar ones 20px high instead of 24px) — `fix: draw the status bar tabs, the zoom level and the run legend toggle with Button, so the status bar buttons are 24px high as DESIGN.md says`
- `Toolbar`, the status bar and the tool rail used `role="toolbar"` without arrow-key navigation — `fix: add roving focus (one tab stop, arrows, Home and End) to the kit Toolbar, the status bar and the tool rail, which declared role toolbar without the keyboard behaviour`
- The catalog category chips showed a horizontal scrollbar in Italian at common widths — `fix: let the catalog category chips wrap inside the toolbar instead of scrolling horizontally in Italian`

### Decisions
- Scope: on-screen app only; PDF/CSV exports keep their look.
- The plan canvas follows the theme (tokens, live switch).
- Theme: System (default) / Light / Dark, an app preference.
- Export PDF/JSON and Import JSON also in the native File menu.
- Design system agreed and written to DESIGN.md (2026-10-27): teal accent (not a conductor colour), cool graphite neutrals, IBM Plex Sans + Plex Mono bundled via @fontsource, radii 6/8/12, 28px controls, light/dark tokens incl. canvas; user asked for 'modern, simple, functional and also beautiful'.
- Library + app preferences merge into one Settings screen (/settings/<section>: General, Company, Catalog, Presets, New projects), opened by native `Settings…` (Cmd+, / Ctrl+,), the start screen and a gear; per-project view renamed Project; 'Update from library' -> 'Update from catalog' (user: Library vs Settings was confusing, prefers Settings/Impostazioni).
- Layouts (HTML mockups, all variant A): editor Figma-like with tool rail and status-bar bottom panel; start = sidebar + recent list; catalog = section sidebar + table + fixed detail panel. Workflow strip becomes a compact progress control in the status bar.
- Mockups are HTML (gstack AI mockup generator unavailable: no OpenAI key); kept in docs/design/.
- E2E selectors may change with the structure; behaviors stay covered.
- Theme owned by the main process (preferences.json + nativeTheme.themeSource), CSS via prefers-color-scheme; browser fallback localStorage + data-theme.
- Components: Radix primitives + own kit; add select, tooltip, toggle-group, popover; react-resizable-panels for panels.
- Recent files show a modified date: `RecentFile.modifiedAt` from fs.stat in main.
- Autoplan (CEO/design/eng, one in-host reviewer; DX and outside voices skipped) corrections integrated.
- Conduit runs share one colour; laying type by dash pattern only (user choice).
- Minimum window width 1024 (window.ts minWidth from 960).
- Catalog price edits commit as today (blur/Enter), no Save button.
- 'Close project' in the project overflow menu replaces the Home button.
- Per-project view folder: features/project-details.
- Light theme: text-faint, text-muted, warning, success darkened (same hue) so every pair meets 4.5:1 / 3:1 (user choice).
- Plan view gets a small collapsible on-canvas legend of the conduit dash patterns (step 10; user choice).

### Open questions
- (none)

### Next
Ask the user whether to publish (ship)
