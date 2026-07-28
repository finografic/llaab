# LLAAB — Navigation Menu Design

> **Status:** Implemented in `apps/client` (2026-06-07). Source of truth for menu structure:
> `apps/client/src/lib/nav-menu.config.ts`. UI: `components/NavMenu/NavMenu.tsx`.
>
> **Purpose:** Define the structure of the shadcn Navigation Menu (Radix) that replaced
> `NavbarVertical`. Each top-level item opens a megamenu-style dropdown with label + description
> pairs. Items marked `[future]` are rendered disabled with a lock icon until implemented.
>
> **Component:** `@radix-ui/react-navigation-menu` via `shadcn/ui`
> **Ref:** https://ui.shadcn.com/docs/components/radix/navigation-menu

---

## Current state → new structure

| Old sidebar item | New location          | Notes                                      |
| ---------------- | --------------------- | ------------------------------------------ |
| Home             | Logo / brand link     | No dropdown — direct link to `/`           |
| Ingest           | **Pipeline** dropdown | Ingest is one stage; extraction is another |
| Vault →          | **Vault** dropdown    | Sub-pages become dropdown items            |
| LLM              | **Models** dropdown   | Expands to cover providers + capabilities  |
| Icons (homepage) | **System** dropdown   | Elevated from homepage card to nav         |

---

## Top-level items

```
[LLAAB logo]   Vault   Registry   Pipeline   Execute   Models   System
```

`LLAAB` is the brand mark / home link (not a dropdown). Top-level items each open a
megamenu panel on **click only** (hover must not open menus). Radix hover is suppressed via
`onPointerMove` / `onPointerLeave` `preventDefault` on each `NavigationMenuTrigger`.

---

## 1. Vault

> Browse the knowledge graph — nodes, transcripts, sources, and structured content.

| Label            | Description                                                 | Route                | Status     |
| ---------------- | ----------------------------------------------------------- | -------------------- | ---------- |
| **Browse Vault** | File-tree browser for the full vault                        | `/vault`             | Live       |
| **Nodes**        | Ideas, skills, resources, prompts, and instructions by type | `/vault/nodes`       | Live       |
| **Transcripts**  | Ingested transcripts with summaries and linked ideas        | `/vault/transcripts` | Live       |
| **Sources**      | Channels, repos, and other origin entities                  | `/vault/sources`     | Live       |
| **Inbox**        | Hermes and Telegram captures awaiting review                | `/vault/inbox`       | Live       |
| **Search**       | Full-text search across vault nodes                         | `/vault/search`      | `[future]` |

### Design notes

"Browse Vault" is the existing gated file-tree browser — it stays as the "explore everything"
entry point. The other items are the typed index pages that already exist. Search is a natural
addition once the vault has enough volume to warrant it, and it gives the dropdown a forward-
looking feel without being speculative.

---

## 2. Registry

> Pin and search npm packages and GitHub repositories.

| Label            | Description                                    | Route             | Status |
| ---------------- | ---------------------------------------------- | ----------------- | ------ |
| **Packages**     | Pinned favourites and npm package search       | `/registry`       | Live   |
| **Repositories** | Pinned favourites and GitHub repository search | `/registry/repos` | Live   |

### Design notes

Packages (formerly “Libraries” in the nav) is the npm registry surface. Repositories is the
GitHub counterpart. Both share pinned/search tabs and the Add New Registry drop-zone toolbar.

---

## 3. Pipeline

> Bring content in and pull structure out — ingestion and extraction.

| Label               | Description                                          | Route               | Status     |
| ------------------- | ---------------------------------------------------- | ------------------- | ---------- |
| **Ingest YouTube**  | Fetch a transcript and store it as a vault node      | `/ingest`           | Live       |
| **Ingest Article**  | Ingest a web article or blog post as a resource node | `/ingest`           | Live       |
| **Ingest Document** | Ingest a local PDF or Office file via liteparse      | `/ingest/document`  | `[future]` |
| **Re-extract**      | Re-run LLM extraction on an existing transcript      | `/pipeline/extract` | `[future]` |

### Design notes

The glossary distinguishes **ingestion** (content moves in) from **extraction** (structure comes
out). The current `/ingest` page already handles both phases sequentially, but as the pipeline
matures, having a dedicated re-extraction surface makes sense — especially for batch re-extraction
after model upgrades. Article ingestion shipped and shares the `/ingest` page (see
`docs/todo/DONE_ARTICLE_INGESTION.md`); document ingestion (PDF/Office via liteparse) is still
future and tracked separately on the roadmap.

---

## 4. Execute

> Run skills, inspect traces, and interact with the command bus.

| Label        | Description                                                   | Route             | Status     |
| ------------ | ------------------------------------------------------------- | ----------------- | ---------- |
| **Runs**     | Inspect agent execution traces and skill run history          | `/vault/runs`     | Live       |
| **Agent**    | Trigger a one-shot agent run and view status                  | `/agent`          | `[future]` |
| **Terminal** | Command panel — dispatch typed commands with streaming output | `/terminal`       | Live       |
| **Skills**   | Browse registered skills and their capabilities               | `/execute/skills` | `[future]` |

### Design notes

Runs already exists at `/vault/runs` — it moves here to sit alongside the execution surfaces
that the orchestration plan introduced. The Terminal item is live as the typed command bus
vertical slice. Agent is the dedicated surface for `POST /api/agent/run`
with status feedback, currently only accessible via API or CLI. Skills is the registry browser
that becomes relevant once capability-based routing (Phase 6) lands and skills declare their
capabilities.

---

## 5. Models

> LLM providers, routing, and execution metadata.

| Label            | Description                                                  | Route               | Status     |
| ---------------- | ------------------------------------------------------------ | ------------------- | ---------- |
| **Status**       | Task routing map with installed and missing model indicators | `/llm`              | Live       |
| **Providers**    | Registered LLM providers, availability, and configuration    | `/llm/providers`    | `[future]` |
| **Capabilities** | Which providers and skills can handle which capabilities     | `/llm/capabilities` | `[future]` |

### Design notes

The current `/llm` page already shows the task → tier → model routing map with installed/missing
dots and the Ollama model list. Providers and capabilities are now architecture-ready because the
provider interface and capability map exist; the remaining work is route/page implementation.

---

## 6. System

> Tooling, diagnostics, and project configuration.

| Label       | Description                                                    | Route             | Status     |
| ----------- | -------------------------------------------------------------- | ----------------- | ---------- |
| **Icons**   | Open the embedded Lucide picker and manage the icon registry   | `/icons`          | Live       |
| **Doctor**  | Provider health, binary availability, and capability coverage  | `/system/doctor`  | `[future]` |
| **Harness** | Harness prep pipeline status and extraction boundary inspector | `/system/harness` | `[future]` |

### Design notes

Icons is currently a homepage card linking to the icons service (port 5001 / lucide-manager on
5199). It makes more sense as a System item since it's a dev tool, not a knowledge feature.
Doctor maps to the `lab doctor` CLI command — this would be the web equivalent showing provider
availability, API key status, binary paths, and capability gaps. Harness is a lighter addition:
a simple view of the current harness prep pipeline configuration and validation status.

---

## Layout and behavior

### Placement

The navigation menu replaces `NavbarVertical` (the current left sidebar). It should be
**horizontal**, positioned in the header area where `AppHeaderV2` currently lives. The sidebar
is removed; `AppLayout` simplifies to header + main content area + footer.

### Open behavior

Desktop megamenus open and close on **click** only — never on hover. Click the same trigger
again (or outside) to close. Mobile continues to use the Sheet + Accordion pattern.

### Megamenu panel style

Each dropdown panel uses the shadcn Navigation Menu's `ListItem` pattern: bold label on top,
muted description below, the full item is clickable. Two-column layout for dropdowns with 4+
items; single column for 3 or fewer.

```
┌─────────────────────────────┬──────────────────────────────┐
│  ■ Browse Vault             │  ■ Transcripts               │
│  File-tree browser for the  │  Ingested transcripts with   │
│  full vault                 │  summaries and linked ideas   │
├─────────────────────────────┼──────────────────────────────┤
│  ■ Nodes                    │  ■ Sources                   │
│  Ideas, skills, resources,  │  Channels, repos, and other  │
│  prompts, and instructions  │  origin entities              │
├─────────────────────────────┼──────────────────────────────┤
│  ■ Search              🔒   │                              │
│  Full-text search across    │                              │
│  vault nodes                │                              │
└─────────────────────────────┴──────────────────────────────┘
```

### Disabled items

Future items are rendered with reduced opacity and `pointer-events: none`. They use a small
lock icon or `(coming soon)` badge to signal unavailability without hiding the feature surface.
This makes the system's direction visible to the user (and to anyone reviewing the project
as a portfolio piece).

### Active state

The active top-level item is highlighted based on the current route prefix. Route matching:

| Top-level | Active when route starts with                    |
| --------- | ------------------------------------------------ |
| Vault     | `/vault`                                         |
| Registry  | `/registry`                                      |
| Pipeline  | `/ingest`, `/pipeline`                           |
| Execute   | `/vault/runs`, `/agent`, `/terminal`, `/execute` |
| Models    | `/llm`                                           |
| System    | `/icons`, `/system`                              |

Note: `/vault/runs` matches both Vault and Execute. **Execute wins** — runs are execution
traces, not knowledge objects. The Vault dropdown's "Browse Vault" and "Nodes" are the
knowledge-browsing entries; runs belong with the execution story.

### Mobile / narrow viewport

On narrow viewports, the navigation menu collapses to a hamburger menu. shadcn's Navigation
Menu doesn't handle this natively — pair with a `Sheet` component for the mobile drawer, using
the same item structure as an accordion.

---

## Route migration checklist

These are the route changes implied by this navigation structure. Existing routes that move
should have redirects.

| Current route | New route (if changed) | Reason                                  |
| ------------- | ---------------------- | --------------------------------------- |
| `/vault/runs` | `/vault/runs` (keep)   | No change — just re-parented in nav     |
| `/ingest`     | `/ingest` (keep)       | Stays; becomes "Ingest YouTube" in menu |
| `/llm`        | `/llm` (keep)          | Stays; becomes "Status" in Models menu  |
| —             | `/agent`               | New — dedicated agent trigger + status  |
| —             | `/terminal`            | Done — command panel route exists       |
| —             | `/llm/providers`       | New — provider registry page            |
| —             | `/llm/capabilities`    | New — capability browser                |
| —             | `/system/doctor`       | New — health check page                 |
| —             | `/system/harness`      | New — harness inspector                 |
| —             | `/vault/inbox`         | Done — Hermes inbox capture review      |
| —             | `/vault/search`        | New — full-text vault search            |
| —             | `/ingest/document`     | New — document ingestion (liteparse)    |
| —             | `/pipeline/extract`    | New — batch re-extraction               |
| —             | `/execute/skills`      | New — skill registry browser            |
| —             | `/icons`               | New route — currently external service  |
