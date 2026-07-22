# TODO — Podcast / RSS Ingest

> **Status:** Not started.
> Adds a second ingestible media type to `/ingest` — podcast episodes, entered as a Pocket Casts
> share link. Reuses the transcript/idea-extraction pipeline; adds a new resolver + audio
> transcription step ahead of it.

---

## What this is

Today `/ingest` accepts YouTube video URLs only (`SourceKind = 'youtube' | 'webpage' | 'unknown'`,
`apps/client/src/forms/IngestForm/ingest-form.types.ts:5`) and hard-gates submission to that one
type. This adds a `'podcast'` source kind, accepting Pocket Casts episode share links like:

```text
https://pca.st/episode/0bd00def-49cf-43f3-a252-acb837815d31
```

Pocket Casts is treated as a **URL resolver only**, not the underlying content source. The resolver
follows the share link, finds the show's RSS feed, matches the specific episode in that feed, and
hands off a provider-neutral episode record to the existing ingestion pipeline. Internally, LLAAB
never depends on Pocket Casts staying up — the durable identity is the RSS feed + episode GUID.

**Transcription is in scope for the MVP**, not deferred — the entire point of ingestion is
audio-to-text, same as YouTube. Priority order for getting text:

1. Podcasting 2.0 `<podcast:transcript>` tag in the RSS `<item>`, if present (rare but free).
2. Otherwise, download the episode audio and transcribe locally with **mlx-whisper** on the
   Mac Studio — Apple Silicon–native (Metal), fits the project's local-first LM Studio setup,
   avoids a cloud STT dependency. `whisper.cpp` (optionally with a Core ML encoder) is the fallback
   if `mlx-whisper` (a Python package) proves awkward to shell out to from Bun/Node — same
   subprocess pattern already used for `yt-dlp`.

Word-level or line-level timestamps are nice-to-have (Podcasting 2.0 feeds and Whisper both can
produce them) but not required — unlike YouTube, exact timestamp alignment isn't the point here.

---

## Why episode-link ingestion, not feed-subscription ingestion

Two different features are possible; only the first is in scope here:

- **Episode-link ingestion (this doc):** paste one Pocket Casts episode URL → ingest that episode.
- **Podcast-feed ingestion (later, separate doc):** paste an RSS feed or show page → browse/select
  episodes → optionally auto-ingest future episodes. This needs episode selection UI, duplicate
  handling across a growing feed, feed refresh scheduling, and retention rules — real product
  surface that isn't needed to satisfy "accept my Pocket Casts links." Do not build it now.

---

## Schema changes

### `TranscriptSourceTypeSchema` — `packages/schemas/src/transcript-node.schema.ts`

Add `'podcast'`:

```ts
export const TranscriptSourceTypeSchema = z.enum(['youtube', 'article', 'repo', 'chat', 'podcast', 'other']);
```

New optional `TranscriptNode` fields (all on the existing schema, no new node type):

```ts
podcast_feed_url: z.string().url().optional(),
podcast_episode_guid: z.string().optional(),
podcast_audio_url: z.string().url().optional(),
transcript_origin: z.enum(['rss', 'generated']).optional(), // how the transcript text was obtained
```

`source_item_id` (already on the schema) carries the dedupe key — for podcasts, the RSS `<guid>`
(fallback: normalized enclosure URL if no guid). `source_url` stores the _original_ Pocket Casts
link the user pasted, for traceability back to what they shared.

### `SourceKindSchema` / `SourceProfilePlatformSchema` — `packages/schemas/src/source-node.schema.ts`

Add `'publication'`-adjacent kind for the show entity — `SourceKindSchema` already has
`'publication'`, reuse it for podcast shows rather than adding a new value. Add a platform value:

```ts
export const SourceProfilePlatformSchema = z.enum([
  'youtube', 'github', 'x', 'bluesky', 'website', 'twitch', 'npm', 'rss',
]);
```

### `IngestionSourceType` — `packages/ingestion/src/pipeline.ts:17`

```ts
export type IngestionSourceType = 'youtube' | 'article' | 'repo' | 'podcast';
```

---

## Resolver + fetch layer — `packages/ingestion/src/fetch/podcast.ts` (new)

Mirrors `fetch/youtube.ts`'s shape: one function that returns everything `createPodcastTranscriptNode`
needs, shelling out to external tools the same way `fetchYouTube` shells out to `yt-dlp`.

```ts
export interface FetchedPodcastEpisode {
  podcastTitle: string;
  episodeTitle: string;
  description?: string;
  publishedAt?: string; // ISO
  durationSeconds?: number;
  episodeGuid: string; // dedupe key
  feedUrl: string;
  audioUrl: string;
  audioMimeType?: string;
  rssTranscriptUrl?: string; // <podcast:transcript> url, if present
  rssTranscriptType?: string; // e.g. text/vtt, text/plain, application/json
  showWebsite?: string;
}

export async function fetchPodcastEpisode(url: string): Promise<FetchedPodcastEpisode>;
```

Steps inside `fetchPodcastEpisode`:

1. **Resolve the share link.** `fetch(url, { redirect: 'follow' })`, read the final URL and HTML.
   Pocket Casts share pages are public and don't require login. Parse:
   - `og:title`, `og:description` meta tags
   - JSON-LD `PodcastEpisode`/`AudioObject` block if present
   - canonical episode URL (contains podcast slug + Pocket Casts podcast UUID + episode slug +
     episode UUID) as a fallback identity if audio isn't directly resolvable from the page

2. **Resolve the RSS feed.** In order, stop at first success:
   - Feed URL embedded in the resolved page's metadata/JSON-LD, if present
   - `<link rel="alternate" type="application/rss+xml">` on the show's website (if the page links
     one)
   - Podcast Index API lookup by podcast title (`https://api.podcastindex.org/api/1.0/search/byterm`
     — requires free API key, see Open questions)
   - Give up with a clear "could not resolve feed" error if all fail — do not silently fall back to
     scraping Pocket Casts' internal (undocumented, unstable) endpoints for the MVP.

3. **Fetch and parse the feed** (`fetch(feedUrl)` → XML). Use a lightweight RSS/Atom parser —
   `fast-xml-parser` (already dependency-light, no new heavy deps) rather than a full podcast SDK.

4. **Match the episode** inside the parsed feed items. Do not assume the Pocket Casts episode UUID
   matches the RSS `<guid>` — it's Pocket Casts' own identifier. Score candidates:

   ```ts
   score =
     titleExactMatch * 100 +
     publishedDateMatch(±1 day) * 40 +
     durationMatch(±5s) * 20 +
     titleSimilarity(fuzzy) * 30;
   ```

   Require a minimum confidence threshold (e.g. `score >= 100`, i.e. an exact title or near-exact
   combination) before accepting a match; otherwise throw a clear "episode not found in feed"
   error rather than silently ingesting the wrong episode.

5. **Extract `<podcast:transcript>` if present** on the matched `<item>` (Podcasting 2.0 namespace
   `podcast: https://podcastindex.org/namespace/1.0`). Prefer `type="text/vtt"` or `text/plain`
   over `application/json` (json shape varies by publisher).

6. Return the `FetchedPodcastEpisode`. Audio is _not_ downloaded at this step — that's a separate
   call, only made if step 5 found nothing.

### Transcription — `packages/ingestion/src/transcribe/mlx-whisper.ts` (new)

```ts
export async function transcribeAudioLocally(
  audioUrl: string,
  opts?: { model?: string }, // default 'large-v3-turbo'
): Promise<{ plainText: string; segments?: Array<{ start: number; end: number; text: string }> }>;
```

1. Download `audioUrl` to `VAULT_ROOT/.tmp/` (same scratch-dir convention as YouTube's subtitle
   fetch in `fetch/youtube.ts`).
2. Normalize with `ffmpeg` (already a hard dependency via yt-dlp usage — confirm it's on the
   Mac Studio running the server, not just this dev machine) to 16kHz mono WAV — Whisper's
   expected input format.
3. Shell out to `mlx_whisper` CLI (installed via `pip install mlx-whisper` — a new _system_
   dependency, not an npm package; document install steps in the Notes section below) with
   `--output-format json` to get a transcript with segment timestamps.
4. Parse the JSON output into `plainText` (joined segments) + `segments`.
5. Delete the scratch audio file after transcription succeeds.

This is a genuinely new kind of dependency for LLAAB (first non-Node runtime requirement beyond
`yt-dlp`/`ffmpeg`, which are already required). Treat `mlx-whisper` like `yt-dlp` — a required
system binary, documented, not vendored.

---

## Pipeline — `packages/ingestion/src/pipeline.ts`

New branch in `runIngestionPipeline`, dispatching on `sourceType === 'podcast'` to a new
`createPodcastTranscriptNode` function (own function, not a shared "createTranscriptNode" abstraction
merged with YouTube — the two have different fetch/parse/dedupe steps; forcing a shared function
would need branching internals with little saved. `extractKnowledgeFromTranscript`, which runs
_after_ node creation, is already source-type-agnostic and needs zero changes).

`createPodcastTranscriptNode(url, title?, tags?)`:

1. `fetchPodcastEpisode(url)` → `FetchedPodcastEpisode`.
2. Dedupe check: scan existing `transcript` nodes for `source_type === 'podcast' &&
source_item_id === episodeGuid` (mirrors `findExistingYouTubeTranscript`). Return early
   (`reused: true`) if found.
3. Get transcript text:
   - If `rssTranscriptUrl` present → fetch and parse it (VTT/plain-text parsing — the YouTube path
     already has SRT parsing helpers in `pipeline.ts`; a VTT parser is a small addition, not a new
     subsystem).
   - Else → `transcribeAudioLocally(audioUrl)`.
4. Build the transcript markdown body (header: podcast name, episode title, episode link, air
   date, ingested date — same header pattern as `youtubeTranscriptVisibleHeader`).
5. `createNode({ type: 'transcript', source_type: 'podcast', source_item_id: episodeGuid,
source_url: <original pasted url>, podcast_feed_url, podcast_episode_guid, podcast_audio_url,
transcript_origin, ... })`.
6. Create/reuse a `SourceNode` for the **show** (`source_kind: 'publication'`, `platforms: ['rss']`,
   `profiles: [{ platform: 'rss', url: feedUrl }]`, `related: [transcriptId]`) — same
   tolerant-of-already-exists pattern as the YouTube channel `SourceNode` (`pipeline.ts:336-351`).

---

## Server, client, MCP wiring (mechanical — follows the YouTube pattern exactly)

| Layer           | YouTube reference                                                 | New podcast file/change                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server schema   | `apps/server/src/routes/ingest/ingest.schema.ts`                  | `ingestPodcastBodySchema` (same shape: `url`, `title?`, `tags?`, `skipExtraction?`)                                                                                                                                           |
| Server route    | `apps/server/src/routes/ingest/ingest.routes.ts` + `index.ts`     | `POST /api/ingest/podcast` handler calling `ingestPodcast` skill                                                                                                                                                              |
| Skill           | `packages/skills/src/ingest-youtube.ts`                           | `packages/skills/src/ingest-podcast.ts` — `ingestPodcast(input)` wrapped in `runSkill('ingest-podcast', ...)`, same two-phase (fetch/save always, `extractKnowledgeFromTranscript` best-effort unless `skipExtraction`) split |
| Client type     | `ingest-form.types.ts:5`                                          | `SourceKind = 'youtube' \| 'podcast' \| 'webpage' \| 'unknown'`                                                                                                                                                               |
| Client classify | `ingest-form.utils.ts:18` `classifyUrl`                           | new branch: hostname `pca.st` or `pocketcasts.com` → `'podcast'`                                                                                                                                                              |
| Client mutation | `queries/transcripts/useIngestYoutube.ts`                         | `queries/transcripts/useIngestPodcast.ts` → `api.ingest.podcast.$post`                                                                                                                                                        |
| Client form     | `IngestForm.tsx` `canSubmit`, `onSubmit`, hint text, drop handler | extend all four `sourceKind === 'youtube'` checks to also accept `'podcast'`; hint text becomes provider-aware ("Pocket Casts episode detected" vs "YouTube video detected")                                                  |
| MCP tool        | `packages/cli/src/mcp/server.ts:250` `vault_ingest_youtube`       | `vault_ingest_podcast` proxying `/api/ingest/podcast`, same `postJsonViaApi`/`asRecord` helpers                                                                                                                               |

No new route group, no new node type — this rides entirely on the existing `TranscriptNode` +
`SourceNode` + ingest route group shape.

---

## Implementation phases

### Phase 1 — Schemas

- [ ] Add `'podcast'` to `TranscriptSourceTypeSchema` (`transcript-node.schema.ts`)
- [ ] Add `podcast_feed_url`, `podcast_episode_guid`, `podcast_audio_url`, `transcript_origin`
      optional fields to `TranscriptNodeSchema`
- [ ] Add `'rss'` to `SourceProfilePlatformSchema` (`source-node.schema.ts`)
- [ ] Add `'podcast'` to `IngestionSourceType` (`pipeline.ts:17`)

### Phase 2 — Resolver + feed matching (no transcription yet)

- [ ] `packages/ingestion/src/fetch/podcast.ts` — `fetchPodcastEpisode`: Pocket Casts redirect
      follow, page metadata extraction, feed resolution, `fast-xml-parser`-based RSS parse,
      episode scoring/matching, `<podcast:transcript>` extraction
- [ ] Add `fast-xml-parser` dependency to `packages/ingestion`
- [ ] Unit test the episode-matching scorer against a few real feeds (fixture-based, no live
      network calls in tests)

### Phase 3 — Local transcription

- [ ] Confirm `mlx-whisper` install path on the Mac Studio (system Python, not the repo's Node
      toolchain) — document exact install command in Notes below once verified
- [ ] `packages/ingestion/src/transcribe/mlx-whisper.ts` — download, `ffmpeg` normalize, shell out,
      parse JSON output
- [ ] Scratch-dir cleanup on success and on failure (don't leak large audio files into
      `VAULT_ROOT/.tmp`)

### Phase 4 — Pipeline integration

- [ ] `createPodcastTranscriptNode` in `pipeline.ts` — dedupe, transcript-text resolution
      (RSS-first, transcribe-fallback), markdown body, `TranscriptNode` + show `SourceNode` creation
- [ ] Wire `'podcast'` branch into `runIngestionPipeline`'s dispatch
- [ ] Confirm `extractKnowledgeFromTranscript` needs no changes (should be a no-op verification,
      not new code)

### Phase 5 — Skill + server + MCP

- [ ] `packages/skills/src/ingest-podcast.ts` — `ingestPodcast` skill (mirrors `ingest-youtube.ts`)
- [ ] `ingestPodcastBodySchema` in `ingest.schema.ts`
- [ ] `POST /api/ingest/podcast` route + handler in `ingest.routes.ts` / `index.ts`
- [ ] `vault_ingest_podcast` MCP tool in `packages/cli/src/mcp/server.ts`

### Phase 6 — Client UI

- [ ] `SourceKind` gains `'podcast'`; `classifyUrl` detects `pca.st`/`pocketcasts.com`
- [ ] `useIngestPodcast` mutation hook
- [ ] `IngestForm.tsx`: extend `canSubmit`/`onSubmit`/drop-handler gates to include `'podcast'`;
      provider-aware detected-hint text (reuse the existing green-check hint pattern, swap icon/copy)
- [ ] Manual test: paste `https://pca.st/episode/0bd00def-49cf-43f3-a252-acb837815d31`, confirm
      end-to-end ingest (resolve → feed match → transcript-or-transcribe → node created → idea
      extraction runs)

---

## Open questions

- **Podcast Index API key** — free registration required (`https://api.podcastindex.org`) for the
  feed-lookup fallback in step 2 of the resolver. Needs an env var (`PODCASTINDEX_API_KEY` +
  `PODCASTINDEX_API_SECRET`) added to root `.env`. Confirm before Phase 2 whether Pocket Casts'
  page metadata alone resolves feeds often enough to make this optional at MVP, or whether it's
  needed from day one.
- **`mlx-whisper` packaging** — it's a Python package, so the server process needs a working Python
  env with it installed (likely a venv referenced by absolute path, similar to how `yt-dlp` is
  assumed to be on `PATH`). Needs a decision on whether to pin a venv path via env var
  (`LLAAB_MLX_WHISPER_PYTHON`) or require it on `PATH` like `yt-dlp`/`ffmpeg`.
- **Transcription duration** — an hour-long episode will take real wall-clock time to transcribe
  locally even on Apple Silicon. This should run through the existing `RunNode`/run-events
  machinery (same as YouTube) so it shows up in the run monitor as "transcribing" rather than
  looking hung; confirm `LLAAB_RUN_STALE_MS` default (30m) is generous enough or needs a
  per-skill override for `ingest-podcast` (mirrors existing per-skill stale-timeout overrides).

---

## Notes

- Pocket Casts is a resolver, not a content source — nothing in the stored `TranscriptNode`/
  `SourceNode` should assume Pocket Casts stays reachable; `podcast_feed_url` + `episodeGuid` are
  the durable identity.
- Apple Podcasts, Overcast, and bare RSS links are natural follow-ups once this ships — the
  resolver interface (`fetchPodcastEpisode(url): Promise<FetchedPodcastEpisode>`) is intentionally
  the only Pocket-Casts-specific surface; a second resolver for another provider slots in beside it
  without touching the pipeline/schema/route layers.
- Feed-subscription ingestion (browse a feed, ingest multiple episodes, auto-ingest new ones) is
  explicitly out of scope — see "Why episode-link ingestion" above.
