# Persistent Local Runtime

LLAAB supports a macOS-native persistent local runtime for the main app and local development tools.

This setup is meant for a "laboratory" workflow:

- the app is available in a browser at any time
- services resume after login / reboot
- local tooling such as the icons picker can stay alive beside the app

## Services

Current local persistent services:

- `com.llaab.server` — Bun API on `8888`
- `com.llaab.client` — Vite SPA on `3000`
- `com.llaab.icons` — icons write-back server + Lucide Manager picker on `5001` / `5199`

These are managed by macOS `launchd` user agents and controlled through:

- `scripts/macos/llaab-service.sh`
- `scripts/macos/llaab-swiftbar.15s.sh`
- `scripts/macos/repair-persistent-client.sh`

## Why `launchd` is not the fragile part

`launchd` only supervises process lifetime.

If an app process starts successfully but serves a broken build or throws runtime errors, `launchd`
will keep that process alive because from the supervisor's perspective it is still running.

So the important reliability problem is not:

- "how do we keep a process alive?"

It is:

- "how do we update a running built app without replacing the live artifact set with a partial or broken build?"

## Client runtime strategy

The persistent client now uses a **last-known-good build** model.

`scripts/macos/start-persistent-client.sh` does this:

1. builds the Vite app into a fresh staged output directory under `apps/client/.persistent/builds/`
2. verifies `index.html` exists in the staged output
3. promotes that staged build to `apps/client/.persistent/current` only after success
4. starts `vite preview` from the promoted `current` build (`LLAAB_CLIENT_OUT_DIR`)

If a new build fails:

- the staged build is discarded
- the existing `current` build remains untouched
- the client falls back to the last known-good build instead of taking the app down

This is intentionally different from building directly into `apps/client/dist` and serving from there.

## Why this is more robust

Without staged promotion:

- a failed or interrupted build can leave the live output directory half-replaced
- the already-running server can begin resolving missing chunk files
- the browser sees `500` even though the process itself still exists

With staged promotion:

- the live runtime never points at a partially written build
- success is promoted atomically at the directory-link level
- failure preserves service continuity

## Operational notes

- `apps/client/dist` remains the normal ad hoc build output for non-persistent workflows
- `apps/client/.persistent/` is reserved for the launchd-managed runtime
- old persistent builds are pruned automatically; only a small recent set is retained

## Future improvements

Potential future hardening:

- explicit health check for the Vite preview client (e.g. `GET /` on :3000)
- a deploy script that separates "build new runtime" from "restart runtime"
- same last-known-good promotion model for other built local tools if needed

## Repair workflow

When the persistent client needs a manual recovery, use:

```bash
scripts/macos/llaab-service.sh repair-client
```

This is also exposed in SwiftBar as `Repair Client`.

The repair flow does not rebuild in place itself. Instead it restarts the `launchd` client agent and
waits for the staged persistent build flow to finish and become healthy again.
