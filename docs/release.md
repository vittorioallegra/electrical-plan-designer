# Releasing

The app is an Electron desktop app for macOS (arm64, x64) and Windows (x64). There is no
backend, no environment variable and no hosting.

## Build locally

- `pnpm desktop:build` — typecheck, bundle, and write the unpacked app to
  `apps/desktop/release/` (`--dir`, used to check that the packaged app launches).
- `pnpm --filter @epd/desktop dist` — bundle and build the installers for the current OS into
  `apps/desktop/release/`: macOS gives `Electrical Plan Designer-<version>-arm64.dmg` and
  `-x64.dmg`; Windows gives `Electrical Plan Designer-<version>-Setup.exe` (NSIS, x64).
  Build the Windows installer on Windows (CI does it); the macOS ones on a Mac.
- `pnpm desktop:dev` runs the app with hot reload; `pnpm dev` runs the same renderer in a
  browser with in-memory fakes (for development and the browser E2E project only).

The version comes from `apps/desktop/package.json`. Installers are not auto-updated: users
install a new one over the old one.

## CI

`.github/workflows/desktop.yml` runs on manual dispatch and on tags `v*`:

- ubuntu: typecheck, lint, unit tests, browser E2E (Electron is not run on Linux);
- macos-latest and windows-latest: build the installers, run the Electron E2E project,
  upload the installers as workflow artifacts (`installers-macos-latest`, `installers-windows-latest`).

Download the artifacts from the workflow run page. Nothing is published automatically.

## Opening unsigned apps

The apps have no Developer ID and no Authenticode certificate. macOS builds are ad-hoc signed
(an unsigned arm64 app refuses to launch as "damaged"), so the first launch needs a manual
approval.

- **macOS**: drag the app from the `.dmg` to Applications and open it. When macOS refuses,
  open System Settings → Privacy & Security, scroll to the message about the app, and choose
  **Open Anyway**; confirm with your password. This is needed once per installed version. If
  the app still says it is damaged after a download, run
  `xattr -dr com.apple.quarantine "/Applications/Electrical Plan Designer.app"`.
- **Windows**: run the installer. When SmartScreen shows "Windows protected your PC", choose
  **More info** → **Run anyway**.

## Compatibility

Projects are `.epd` files on the user's computer and the library (edited in Settings) lives in the
app data folder, so an update never touches them; a new app version must still open old `.epd` and
`.epl` files (see the versioning rule in `CLAUDE.md`).
