# Section Count Badges

Item counts that label a **heading or sidebar title** must sit **immediately to the right of
the title text** — never far-right aligned opposite the title.

This is mandatory for every comparable surface: sidebar headers, section headings, panel titles,
and list-group titles.

## Canonical markup

Use the shared `.section__count` class from `apps/client/src/styles/page-detail.css` (global).

```tsx
<div className="flex min-w-0 items-center gap-2">
  <div className="text-base font-medium text-foreground">Vault</div>
  <span className="section__count">{fileCount}</span>
</div>
```

Reference call sites:

- `VaultSidebar` — title + file count
- `TranscriptsSidebar` — title + transcript count (trailing controls stay on a separate
  `justify-between` slot; the count stays next to the title)
- `RunMonitor` `MonitorSection` — section title + run count
- Transcript / source detail section headings — count beside the heading label

## Do

- Place the count in the same inline cluster as the title (`flex items-center gap-2`).
- Prefer `.section__count` over one-off `font-mono text-xs text-muted-foreground` badges for
  these heading counts, so styling stays consistent.
- Keep **actions** (density toggles, dismiss buttons, filter controls) on the far right of the
  row when needed — the count is not an action and must not occupy that slot.

## Do not

- Do **not** use `justify-between` to push a title count to the opposite edge of the row.
- Do **not** invent a second visual language for “N items next to a title” (plain muted mono,
  outline badges, etc.) when `.section__count` fits.
- Do **not** confuse this with **icon-button badges** (e.g. RunMonitor trigger active-run pill).
  Those are overlay counts on controls — see `apps/client/src/layouts/AGENTS.md` § Badges.
