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

- `.github/workflows/ci.yml` runs on every push to `main` and every pull request: typecheck,
  lint, unit tests, browser E2E (ubuntu; Electron is not run on Linux).
- `.github/workflows/desktop.yml` runs on manual dispatch and on tags `v*`: the same checks,
  then on macos-latest and windows-latest it builds the installers, runs the Electron E2E
  project and uploads the installers as workflow artifacts (`installers-macos-latest`,
  `installers-windows-latest`). On a tag it also creates a **draft** GitHub Release with the
  installers attached. electron-builder never publishes by itself (`--publish never`).

## Release a version

1. Set `version` in `apps/desktop/package.json` (semver, e.g. `0.2.0`), commit and push to `main`.
2. Tag that commit and push the tag: `git tag v0.2.0 && git push origin v0.2.0`. The workflow
   fails at once when the tag is not `v` + that version.
3. When the run is green, open the draft on the repository's Releases page, check the notes
   (generated from the commits since the previous tag) and the attached `.dmg`/`.exe`, then
   **Publish release**.

A failed run leaves no release: fix, delete the tag (`git push origin :v0.2.0`, `git tag -d
v0.2.0`), and tag again. To build installers without releasing, run the `desktop` workflow by
hand from the Actions tab and download the artifacts from the run page.

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
