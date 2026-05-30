# 🌱 LLAAB

Local-first learning loop: structured vault nodes, governed LLM calls, and persisted runs.

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
