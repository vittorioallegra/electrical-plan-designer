# Electrical Plan Designer

A desktop app (macOS, Windows) for electricians who design residential electrical systems. Draw
the system on top of a floor plan, from the panel through junction boxes to terminal boxes, and
get an exact record of how conduits and conductors run, plus a priced bill of materials and a
quote.

- **Plan**: draw walls or import a floor plan from a PDF or image; place boxes, devices and
  conduit runs on several floors.
- **Panel and circuits**: build the panel, assign circuits, and route conductors through the
  conduits.
- **Bill of materials**: cable meters per cross-section and colour, conduit meters per diameter,
  boxes, devices and panel devices, computed from the drawing and never typed by hand.
- **Checks**: warnings about the design (for example conduit fill) while you draw.
- **Exports and quotes**: project PDF, quote PDF and CSV.
- **Library**: company data, catalogs, box presets and defaults kept in the app and used by
  every new project.

Everything stays on your computer: there are no accounts, no server and no network calls. A
project is one `.epd` file that you open and save like any document. The UI is in English and
Italian.

## Install

Download the installers from the repository's Releases page, or build them yourself (see below).
The apps are not code-signed, so the first launch needs a manual approval: see [docs/release.md](docs/release.md#opening-unsigned-apps).

## Development

Requirements: Node 24 and pnpm 12. No Docker, backend or environment variables are needed.

```sh
pnpm setup          # install dependencies and Playwright's Chromium
pnpm desktop:dev    # run the Electron app with hot reload
pnpm dev            # or: the renderer alone in a browser on :5173 (in-memory fakes)
```

Checks and builds:

```sh
pnpm verify                       # typecheck, lint, unit tests, browser and Electron E2E
pnpm desktop:build                # the unpacked app in apps/desktop/release
pnpm --filter @epd/desktop dist   # the installers (dmg on macOS, NSIS on Windows)
```

The full command list, the folder layout and the project conventions are in
[CLAUDE.md](CLAUDE.md); the visual design system is in [DESIGN.md](DESIGN.md); specs and plans
are in `docs/specs/` and `docs/plans/`.

## Project layout

- `apps/desktop/` — Electron shell (main process, preload, native menus and dialogs)
- `apps/web/` — the React renderer (editor, panel, BOM, checks, quotes, exports, settings)
- `packages/domain/` — pure TypeScript model: geometry, routing, BOM, checks, quotes, the
  `.epd` file format
- `packages/bridge/` — the typed IPC contract between the renderer and Electron

## License

[MIT](LICENSE)
