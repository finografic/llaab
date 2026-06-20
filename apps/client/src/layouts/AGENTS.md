# AGENTS.md — apps/client/src/layouts

Guidance for chrome-level layout work: `AppLayout`, `PageLayout`/`PageDetail`/`PageList`, and the
sticky bars they compose. Page-level content rules live in component/route AGENTS docs, not here.

## Layout primitives

- `AppLayout` is the app shell: sticky `AppHeader`, the `SecondaryActionBar` (header of the
  resizable `AppSidebarLayout`), the routed `<Outlet>`, and `AppFooter`. One instance, mounted once.
- `PageLayout` / `PageDetail` / `PageList` are per-route content wrappers rendered inside
  `AppLayout`'s `<Outlet>`. Don't duplicate chrome (headers, global icon rows) inside them — that
  belongs at the `AppLayout` level so it's consistent across routes.
- Route `handle: { fullBleed }` controls `AppLayout`'s main padding, not the route component.

## Icon button styling

Two tiers, kept visually distinct so users can tell "navigation" from "contextual action" at a glance:

1. **Primary nav** (`AppHeader.tsx` — Ingest, Transcripts, LLM, Icons): `buttonVariants({ variant:
'outline', size: 'icon' })`, always-on accent-green icon, no hover-color shift. These are
   destinations (`<Link>`), not actions.
2. **Contextual / secondary actions** (`SecondaryActionBar.tsx` — Clean Vault, Vault Changes,
   Activity/RunMonitor toggle): shadcn `<Button variant="ghost" size="icon">`, default
   (white/`--text`) icon, no border, `color: var(--accent-hover)` on `:hover`/`:focus-visible` (and
   `[aria-pressed="true"]` for toggles). No background fill, no per-button accent color — one shared
   look for every icon in this row. `RunMonitorTrigger`'s `.trigger` class in `RunMonitor.module.css`
   is the reference implementation; copy its hover rule rather than inventing a new variant.

When adding a new icon button, decide which tier it belongs to first — don't mix outline/ghost
styling within the same row.

## Secondary Action Bar

`SecondaryActionBar.tsx` is the thin bar directly under `AppHeader`, split into two flex slots:

- `secondaryLeading` — per-route content, set via `useSecondaryActionBar().setLeadingAction(node)`
  (`SecondaryActionBarContext`). Routes opt in; default is empty. Don't reach into
  `SecondaryActionBar` directly from a route — go through the context.
- `secondaryTrailing` — global, always-mounted controls that apply everywhere (Clean Vault, Vault
  Changes, RunMonitor toggle). Order is left-to-right by how "destructive/infrequent" →
  "informational" the action is (Clean Vault, a rare maintenance action, sits left of Vault Changes,
  which sits left of the frequently-toggled Activity monitor). New global icon actions go here, not
  in `AppHeader`, unless they're a navigation destination.

The left-sidebar toggle is owned by `SecondaryActionBar`, but only renders when the current route
registers left-sidebar content through `useAppLeftSidebar()` (`AppLeftSidebarContext`). Routes own
the content; `AppLayout` owns the physical panel, width, collapse state, and toggle.

Dialog triggers (e.g. `CleanVaultDialog`) are fully self-contained and drop straight into
`secondaryTrailing` with zero wiring. Sidebar-panel triggers (`VaultGitTrigger`, `RunMonitorTrigger`)
are _not_ self-contained — there is one right sidebar slot for multiple panels, so `AppLayout` owns
which panel is active and passes each trigger its `isOpen`/`isActive` + `onToggle` as props. See
Dialogs & sidebar toggles below.

## Badges (live counts on icon buttons)

Pattern: absolutely-positioned pill in the button's top-right corner, only mounted when there's
something to show.

- **Show/hide**: render the badge node conditionally (`count > 0 ? <span/> : null`) — never render
  an empty/zero badge. Zero state is "no badge", not "badge showing 0".
- **Reactivity**: badge count comes from the same TanStack Query hook that drives the feature it
  represents (e.g. `useRunMonitor()` for the Activity badge's active-run count), not a separate
  fetch. If the query already polls/invalidates on mutation, the badge is reactive for free —
  don't add bespoke polling for a badge.
- **Styling**: copy `.triggerBadge` in `RunMonitor.module.css` — `position: absolute; top: -5px;
right: -5px`, pill shape (`border-radius: 999px`), `border: 1px solid var(--background)` so it
  separates from the icon, mono font, `var(--info-text)` background. Use this for neutral "N items"
  counts; reach for `--warning`/`--error` tokens only if the count represents a problem state.

## Dialogs & sidebar toggles

- **Dialogs** (`apps/client/src/dialogs/*`): self-contained. The component owns its own
  `useState(false)` open flag and renders both the trigger `<Button>` and the shadcn `<Dialog>` in
  one return — see `CleanVaultDialog.tsx`. Don't lift dialog open-state to a parent or context
  unless something _outside_ the component genuinely needs to open it imperatively; the
  self-contained shape is what lets a dialog be moved between routes/layout slots (as Clean Vault
  was) with zero call-site wiring.
- **Left route sidebar** (page-owned navigation/context): route components register content with
  `useAppLeftSidebar({ id, content, defaultOpen, minWidth, maxWidth, defaultWidth })`. Do not build a
  nested local split layout inside a route for app-level sidebars; inject the content into
  `AppLayout` so the global toggle and resizing behavior stay consistent.
  - Keep `id` stable for the route feature (`vault-transcripts`, `source-browser`, etc.).
  - Memoize `content` and the config object so registration does not churn on every render.
  - Set `defaultOpen` only for first registration / feature changes. After mount, user toggle state
    belongs to `AppLayout`, not the route.
  - Width fields are CSS-unit strings (`500px`, `40%`, `32rem`). Use fixed min/max when the sidebar
    is a fixed navigation rail, as transcripts does.
  - The hook clears its own content on unmount. Do not manually close/collapse the panel from route
    components.
  - `AppLayout` intentionally updates sidebar config and open state together via a reducer, then
    defers imperative `panel.resize()` / `panel.collapse()` with `requestAnimationFrame`. Do not
    split route-sidebar config and open state into separate effects; `react-resizable-panels` can
    throw "Panel constraints not found" if a dynamic panel is collapsed before its constraints are
    registered.
- **Right global sidebar** (RunMonitor, VaultGitPanel): `AppLayout` owns a single
  `activePanel: 'runs' | 'vaultGit' | null` state (the `SecondaryPanel` type it exports) as the one
  source of truth for "which panel, if any, is open" — not a per-feature provider. It picks the
  sidebar's content (`activePanel === 'vaultGit' ? <VaultGitPanel/> : activePanel === 'runs' ?
<RunMonitor/> : null`), syncs `isOpen = activePanel !== null` to the `AppSidebarLayout` panel
  imperatively via `usePanelRef()` + `panel.resize()/collapse()` in a `useEffect`, and feeds manual
  drag-resize back via `onCollapse` (→ `null`) / `onExpand` (→ falls back to `'runs'` if nothing was
  active). Each panel component takes `onClose` as a prop and calls it instead of owning its own
  open state. A feature-specific provider (e.g. `RunMonitorProvider`) may still exist for that
  feature's _other_ state (selected run, dismissed runs) — just don't let it also own "is my panel
  open", since only `AppLayout` can answer that with multiple panels sharing one slot.
  Adding a third panel means adding a third arm to `activePanel`'s union and the slot-picking
  ternary — not a new sidebar instance.
