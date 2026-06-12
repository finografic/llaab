# TODO — Cross-Tab Sync

> **Status:** Not started. Exploratory — revisit only if one of the trigger scenarios below occurs.

---

## The issue

React components in the Vite SPA already share live state via the root TanStack Query provider in
`main.tsx` — see [`docs/CLIENT_DATA_FETCHING.md`](../CLIENT_DATA_FETCHING.md).
That solves **same-tab** sync only. It does not — and cannot — reach:

- a second browser tab open on `/vault/runs`
- a second window watching `/ingest` while another tab triggers a run

Right now nothing in LLAAB needs that reach. This doc exists so the option (and the reasoning
for picking it) isn't lost the next time the question comes up.

## Candidate solution — `BroadcastChannel`

Browser-native same-origin pub/sub
([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)). Pure
client-side, zero server infrastructure, and a natural extension of the existing
`INGEST_FORM_RESET_EVENT` custom-DOM-event pattern (`lib/ingest-form-events`) — same idea,
just cross-tab instead of same-document.

**WebSocket is explicitly not a fit:** it requires a long-lived server connection, which
conflicts with `.github/instructions/project/agent-execution.instructions.md`'s "no
always-on background processes... LLAAB does not own a scheduler" rule, and with LLAAB's
local-first SPA model (no long-lived client↔server push channel required today).
`BroadcastChannel` needs none of that — it lives entirely in the browser.

## How we'd know "the need has arisen"

Concrete scenarios worth treating as the trigger to actually build this:

- **Live cross-tab run status** — watching `/ingest` in one tab while a run kicked off in
  another tab finishes, and the first tab's `RunsTable`/run badges stay stale until refresh.
- **Stale data after cross-tab mutations** — e.g. following/unfollowing a source in one tab
  doesn't update the follow badge shown in another tab on `/vault/sources`.
- **Multi-window ingest monitoring** — a workflow emerges where the user routinely keeps
  `/ingest` and `/vault/runs` open side by side and expects one to react to the other.
- **Repeated manual-refresh complaints** — if "just refresh the other tab" becomes a habit
  worth automating, that's the signal.

Until one of these actually happens in practice, `queryClient`'s same-page cache is enough —
adding cross-tab sync now would be solving a problem LLAAB doesn't have yet.
