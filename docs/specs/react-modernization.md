# Spec: React and TypeScript modernization

## Goal

Bring the Electrical Plan Designer codebase in line with current React + TypeScript practice
without changing what the app does: latest major versions of the core libraries, a folder
structure that follows a published convention, server state handled by a data-fetching
library instead of hand-written effects, smaller components, and a clear boundary between
the web app, the shared domain logic and the backend.

## Why

A post-v1 review found:

- Core libraries one major version behind with no recorded reason: React 18 (latest 19),
  react-konva 18 (19), React Router 7 (8), TypeScript 5.9 (7), ESLint 9 (10).
- Server data loaded with manual `useEffect` + `useState` in `ProjectLoader`, `usePurchases`,
  `useCatalog`, profile and project pages. Two of the robustness bugs fixed after review came
  from this pattern (silent purchase-mark failure, loader stuck on "Loading").
- No error boundary and no route `errorElement`: a render error blanks the whole app.
- Large components: `PlanCanvas.tsx` 853 lines, `CircuitsTab.tsx` 536, `PanelView.tsx` 456,
  `QuotePage.tsx` 373.
- Folders by feature but without internal structure, 46 imports across feature
  folders (`bom`, `catalog`, `auth` used as shared code), app wiring (`App.tsx`, `AppProviders.tsx`,
  `main.tsx`) loose at the root of `src/`.
- Web app, pure domain logic and Supabase backend live in one package; nothing stops the
  domain from being bundled differently or reused by a server.
- `exactOptionalPropertyTypes` is off.

## Reference conventions

- Bulletproof React, project structure: `src/app` (routes, providers, router), `features/*`
  with only the sub-folders they need (`api`, `components`, `hooks`, `stores`, `types`,
  `utils`), shared `components`, `hooks`, `lib`, `stores`, `config`, `testing`, `types`,
  `utils`. Imports flow shared → features → app; no imports between features (compose them
  in `app`); no barrel files (they hurt Vite tree shaking). Enforced with ESLint restricted
  paths. https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- Feature-Sliced Design was considered (layers app/pages/widgets/features/entities/shared,
  segments ui/model/api/lib/config). Rejected for now: more layers than a one-developer app
  of this size needs; Bulletproof's rules give the same one-way dependency guarantee.
  https://feature-sliced.design/docs/get-started/overview
- React Router 8 upgrade guide: needs React 19.2.7+ and Node 22.22+, ESM-only, breaking changes
  are v7 future flags made default (data mode: `v8_middleware`, so loader `context` is always a
  `RouterContextProvider`); `RouterProvider` is imported from `react-router/dom`.
  https://reactrouter.com/upgrading/v7
- TypeScript 7 (native compiler, binary `tsc`): upgrade via 6.0 as the bridge, since 7.0 turns
  6.0 deprecations into errors; `strict` and new defaults. 7.0 has no programmatic API (planned
  for 7.1): typescript-eslint 8.x peers `typescript <6.1.0`, so it keeps a 6.0 `typescript`
  (or `@typescript/typescript6`) while the typecheck uses 7.

## Expected behavior

No user-visible change, except:

- A route that fails to load or render shows an error screen with a way back (projects list)
  and a retry, instead of a blank page or an endless "Loading".
- Server data (projects, project, catalog items, profile, purchase marks) is cached and
  refetched by the data layer; failed loads show the shared error state with retry.

## Acceptance criteria

1. `pnpm outdated` lists no major version behind for react, react-dom, react-konva,
   react-router, eslint, @types/react(-dom), @eslint/js (minor/patch lag allowed). TypeScript:
   the typecheck runs on 7; the `typescript` package that typescript-eslint loads may stay on
   6.0 until typescript-eslint supports 7.
2. Repository is a pnpm workspace: `apps/web` (the Vite app), `packages/domain` (pure domain,
   no React/Supabase, own tests), `supabase/` (backend: migrations, config, seed). The web app
   imports the domain only through the `@epd/domain` package (subpath imports such as
   `@epd/domain/bom`, no barrel).
3. `apps/web/src` follows the Bulletproof layout; ESLint fails on an import from one feature
   into another, from a shared folder into `features` or `app`, or from `features` into
   `app`. No `index.ts` barrel files.
4. No component under `features` or `components` loads server data with `useEffect`; server
   state goes through TanStack Query hooks in `api/` folders; route-level data uses loaders
   that prime the query cache. The open project document stays in the editor store (undo,
   autosave); the query layer only loads its record, always fresh when a project is opened.
   The auth session subscription is not server data and stays an effect.
5. Every route has an `errorElement`; a root error boundary catches render errors.
6. No component file over ~300 lines; `PlanCanvas` split into layers and hooks.
7. `exactOptionalPropertyTypes: true` compiles.
8. All existing tests keep passing at every commit (Vitest, `test:db`, Playwright) with only
   import-path and mechanical API changes; new tests cover error elements and query hooks.
9. `CLAUDE.md` describes the new commands, workspace layout and import rules.

## Out of scope

- New product features or UI redesign.
- Moving business logic to the server (an Edge Function that recomputes BOM/quote is listed
  as an open question in the plan, not part of this change).
- Switching to a meta-framework (Next.js, React Router framework mode) or SSR.
- CI setup (still no remote).
