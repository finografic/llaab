# Next Steps

> Maintained working list. Larger initiatives live in [`ROADMAP.md`](./ROADMAP.md) — this doc
> covers concrete near-term tasks, manual testing, and small fixes not large enough for ROADMAP.
>
> Last updated: 2026-07-19 (one-step wiki pipeline)

---

## Manual Testing Checklist

### One-step wiki creation (live LLM smoke)

Automated fixtures cover discovery/compile/link/promote contracts. Confirm once against a real
transcript after `dev-refresh.sh`:

- [ ] Consolidate a broad regression transcript and click **Create Wiki(s)** once
- [ ] Confirm several coherent topics auto-promote without draft/candidate review steps
- [ ] Confirm an ambiguous/invalid branch creates no suffixed wiki and does not block siblings
- [ ] Confirm evidence metrics label refs / transcripts / channels / independent sources separately
- [ ] Re-run unchanged generation → stable no-op/update; try Unpublish, section delete, section regen

### Broader (carry-forward)

- [ ] Open `/terminal` → confirm socket connects and typed commands stream output
- [ ] Run `ai.run extract "..."` from `/terminal` → confirm a `RunNode` is created
- [ ] Verify dark mode renders correctly across all pages (no light backgrounds)

---

## Up Next

- [ ] **Hermes first run — CLI, Discord, then read-only LLAAB MCP** — see
      [`ROADMAP.md`](./ROADMAP.md) Hermes Layer
