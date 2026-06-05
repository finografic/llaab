# DONE — Fix Restart / Icons Config / Embedded Picker

> **Completed:** 2026-06-05 — Five issues resolved: icons config protected via runtime dir redirect, launchctl bootstrap polling, dynamic picker URL, embedded iframe working, SwiftBar overhauled.

## Summary

| #   | Problem                                 | Status |
| --- | --------------------------------------- | ------ |
| 1   | Icons restart destroys host config      | Fixed  |
| 2   | Config schema mismatch between packages | Fixed  |
| 3   | Branding fallback behaves incorrectly   | Fixed  |
| 4   | Embedded picker hardcoded URL           | Fixed  |
| 5   | `launchctl` restart flakiness           | Fixed  |

---

## Resolution notes

### 1 & 2 — Config destruction / schema mismatch

`packages/icons/scripts/start-icons-server.mjs` redirects the icons server into a
`.icons-server-runtime/` working directory. When `@finografic/icons` `icons-server.ts`
unconditionally writes `lucide-manager.config.json` at startup (legacy `serverUrl` shape),
it writes to `.icons-server-runtime/lucide-manager.config.json` instead of overwriting
`packages/icons/lucide-manager.config.json`.

`icons.config.json` and `icons.generated.ts` are symlinked from the runtime dir back
to the package dir, so reads and writes land in the right place.

The host config at `packages/icons/lucide-manager.config.json` survives restarts intact.

### 3 — Branding fallback

Symptom of problem 1. Once the host config is preserved, `lucide-manager` reads it
correctly. `resolveAppBranding` falls back to `DEFAULT_APP_BRANDING` when
`manager.appBranding` is absent — no changes needed in `@finografic/lucide-manager`.

### 4 — Hardcoded picker URL

`apps/client/src/pages/dev/icons.astro`, `scripts/macos/llaab-service.sh`, and
`scripts/macos/llaab-swiftbar.15s.sh` all derive the icons URL from
`packages/icons/lucide-manager.config.json` at runtime.

### 5 — `launchctl` restart flakiness

`bootstrap_label()` previously called `bootout` immediately followed by `bootstrap`.
Since `bootout` is asynchronous, the service could still be tearing down when `bootstrap`
fired, causing `Bootstrap failed: 5: Input/output error`.

Fix: after `bootout`, poll `label_exists` in a loop (0.2 s intervals, 25 attempts max)
and only call `bootstrap` once the label is confirmed gone.

---

## Files changed

- `packages/icons/scripts/start-icons-server.mjs` — new; runtime dir wrapper
- `scripts/macos/llaab-service.sh` — `bootstrap_label` wait loop; dynamic icons URL
- `scripts/macos/llaab-swiftbar.15s.sh` — dynamic icons URL
- `apps/client/src/pages/dev/icons.astro` — dynamic icons URL
