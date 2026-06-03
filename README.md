# 🌱 LLAAB

Local-first learning loop: structured vault nodes, governed LLM calls, and persisted runs.

## macOS persistent local app

If you want LLAAB available in the browser at any time, the supported local setup is:

- Bun API service on `http://127.0.0.1:3000`
- Astro standalone client on `http://llaab.localhost:4321`
- `launchd` for login-time persistence
- SwiftBar for a menu bar control

### Required installs

1. Install the core runtimes:

   ```bash
   brew install node pnpm yt-dlp swiftbar
   brew install oven-sh/bun/bun
   ```

   This repo currently expects Node 24.x.

2. Install repo dependencies:

   ```bash
   pnpm install
   ```

3. Build the standalone client once:

   ```bash
   pnpm --filter @llaab/client build
   ```

### Persistent-service scripts

The repo includes macOS helper scripts in [`scripts/macos/`](./scripts/macos/):

- `start-persistent-server.sh`
- `start-persistent-client.sh`
- `llaab-service.sh`
- `llaab-swiftbar.15s.sh`

These are intended to be used with user `LaunchAgents`:

- `~/Library/LaunchAgents/com.llaab.server.plist`
- `~/Library/LaunchAgents/com.llaab.client.plist`
- `~/Library/LaunchAgents/com.llaab.icons.plist`

Once installed, useful controls are:

```bash
scripts/macos/llaab-service.sh start
scripts/macos/llaab-service.sh stop
scripts/macos/llaab-service.sh restart
scripts/macos/llaab-service.sh repair-client
scripts/macos/llaab-service.sh status
```

### SwiftBar

Set the SwiftBar plugin folder to:

```text
~/Library/Application Support/SwiftBar/Plugins
```

The LLAAB plugin can then expose quick actions such as:

- open app
- open ingest
- open icons
- repair client
- restart services
- inspect logs

### Notes

- `llaab.localhost` is the low-friction friendly local hostname. No reverse proxy is required.
- This persistent setup intentionally runs outside LLAAB itself. The app does not own an always-on scheduler or watcher.
- The persistent client uses a staged "last-known-good" runtime build, not a live in-place rebuild of the served output.
  See [`docs/process/PERSISTENT_LOCAL_RUNTIME.md`](./docs/process/PERSISTENT_LOCAL_RUNTIME.md).

## Installation

1. **Runtime:** [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) (see `package.json` for the workspace `packageManager` version).
2. **Dependencies:** from the repo root:

   ```bash
   pnpm install
   ```

3. **YouTube ingestion (required only for that path):** the pipeline shells out to [**yt-dlp**](https://github.com/yt-dlp/yt-dlp) for metadata and subtitles. It must be installed separately and available on your **`PATH`** in the same environment you use to run ingestion (e.g. terminal, CI, or IDE-integrated shell).

   ```bash
   # macOS (Homebrew)
   brew install yt-dlp

   which yt-dlp
   yt-dlp --version
   ```

   If `yt-dlp` is missing, ingestion fails with `yt-dlp: command not found` even when the video URL is valid in a browser.

4. **Optional:** [Bun](https://bun.sh/) is used in repo scripts for quick one-off runs; install it if you use the snippet below.

### Development

From the repo root:

```bash
pnpm dev
```

Runs the workspace dev stack (including the Astro client at `http://localhost:4321` — see [`apps/client/README.md`](apps/client/README.md)).

### Client UI stack

`apps/client` now uses:

- Tailwind CSS v4
- shadcn/ui
- an app-local theme preset applied directly in the client workspace

The client no longer depends on PandaCSS or `@finografic/design-system`.

---

### Adding shadcn components

Components are installed into `packages/ui/src/components/` and imported via `@llaab/ui/components/<name>`.
Run the add command from `apps/client` so that `apps/client/components.json` provides the correct
registry and path configuration:

```bash
cd apps/client
pnpm dlx shadcn@latest add <component-name>
```

Browse available components first with:

```bash
pnpm dlx shadcn@latest view @shadcn
```

Installed components use `@llaab/ui/lib/utils` for `cn()` and `@llaab/ui` peer deps — no extra
wiring needed. For `tooltip`, wrap the relevant React island root with `<TooltipProvider>`.

### Icon selector (`@finografic/icons`)

Customize which Lucide icons are available to the client UI. Run from the **repo root** (not `apps/client`):

```bash
pnpm icons
```

This starts the icons API server (`http://localhost:5001`) and the [lucide-manager](https://github.com/finografic/lucide-manager) picker in the browser. On first run, `icons.config.json` is created at the repo root from the published DS default set; each save regenerates `icons.generated.ts` there.

| File                         | Notes                                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| `icons.config.json`          | Source of truth — commit                                           |
| `icons.generated.ts`         | Generated — commit (recommended) so builds work without the server |
| `lucide-manager.config.json` | Written on startup — gitignored                                    |

Root `package.json` already lists `@finografic/icons`, `@finografic/lucide-manager`, and `concurrently` as devDependencies. Wire imports in `apps/client` from `icons.generated.ts` (path relative to your app). To change icons for **all** Finografic apps, edit defaults in the [design-system](https://github.com/finografic/design-system) repo and release `@finografic/icons`.

---

## YouTube ingestion

**Prerequisite (repeat):** `yt-dlp` must be installed and on `PATH` (see [Installation](#installation) step 3). Browsers do not satisfy this—the CLI invokes `yt-dlp`, not the browser.

From the repo root, after `pnpm install`:

```bash
pnpm exec bun -e "
import { ingestYouTube } from './packages/skills/src/ingest-youtube.ts';

await ingestYouTube({
  url: 'https://www.youtube.com/watch?v=VIDEO_ID',
  title: 'Optional title',
  tags: ['trial'],
});
"
```

- **Vault output** defaults to `./vault` under the current working directory (override with `LLAAB_VAULT` if you use a custom vault root).
- **Duplicates:** the same YouTube `videoId` reuses the existing transcript node and skips re-fetching (see `docs/05_CONTROL_LAYER_AND_EXECUTION_MODEL.md`).

## Further reading

- Control layer and execution checklist: [`docs/05_CONTROL_LAYER_AND_EXECUTION_MODEL.md`](docs/05_CONTROL_LAYER_AND_EXECUTION_MODEL.md)
- Ubiquitous language: [`LLAAB_GLOSSARY.md`](LLAAB_GLOSSARY.md)

---

## License

MIT © [Justin Rankin](https://github.com/finografic)
