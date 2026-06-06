# @llaab/client — Dev Guide

For engineers with React experience who are new to Astro and file-based routing.
Covers structure, routing, styling, components, and how to add new pages.

---

## Mental model shift from React Router / Next.js

| Concept           | React Router / Next.js           | Astro                                            |
| ----------------- | -------------------------------- | ------------------------------------------------ |
| Page component    | `export default function Page()` | `.astro` file (frontmatter + template)           |
| Routing           | `<Routes>` / `app/` dir          | File in `src/pages/` → route (automatic)         |
| Outlet / children | `<Outlet />`                     | `<slot />` in layout                             |
| Client component  | `"use client"`                   | `client:load` hydration directive                |
| Server component  | default                          | default (all `.astro` is server)                 |
| Nested layouts    | `layout.tsx` wraps children      | Import layout, wrap with it manually             |
| CSS-in-JS scoping | `@emotion` / styled              | `<style>` in `.astro` OR `.module.css` in `.tsx` |

**Key insight:** Astro is a server-first MPA. Every `.astro` file runs on the server. React only
runs in the browser when you add a `client:*` directive. This means you get zero JS by default,
which is the point.

---

## Project structure

```
apps/client/
  src/
    components/          # Shared UI components
      AppHeader/
        AppHeader.astro
      AppFooter/
        AppFooter.astro
      NavbarVertical/
        NavbarVertical.tsx         # React island (needs client:load)
        NavbarVertical.module.css  # CSS Modules — scoped to this component
    layouts/
      AppLayout.astro    # Main shell — sidebar + header + footer + <slot />
      BaseLayout.astro   # Bare html/head/body wrapper (login, error pages)
    pages/               # File-based routes — one file = one URL
      index.astro        # → /
      ingest.astro       # → /ingest
      vault/
        index.astro      # → /vault
        login.astro      # → /vault/login
      api/               # Server-only API handlers (no HTML rendered)
        ingest.ts        # → POST /api/ingest
        vault/
          file.ts        # → GET /api/vault/file
    styles/
      app.css            # Global entry — tokens + reset + utilities
      forms.css          # Global form ecosystem
  docs/
    GUIDE.md             # ← you are here
```

---

## File-based routing

The URL is determined by the file path under `src/pages/`. No route config needed.

| File                                      | URL                  |
| ----------------------------------------- | -------------------- |
| `src/pages/index.astro`                   | `/`                  |
| `src/pages/ingest.astro`                  | `/ingest`            |
| `src/pages/vault/index.astro`             | `/vault`             |
| `src/pages/vault/login.astro`             | `/vault/login`       |
| `src/pages/vault/transcripts/index.astro` | `/vault/transcripts` |
| `src/pages/vault/nodes/index.astro`       | `/vault/nodes`       |
| `src/pages/vault/runs/index.astro`        | `/vault/runs`        |
| `src/pages/vault/runs/[id].astro`         | `/vault/runs/:id`    |
| `src/pages/api/ingest.ts`                 | `/api/ingest`        |

### Dynamic routes

```
src/pages/vault/[id].astro   →  /vault/anything
src/pages/vault/[...slug].astro  →  /vault/a/b/c
```

Access params in frontmatter:

```astro
---
const { id } = Astro.params;
---
```

### API routes

API routes are `.ts` files in `src/pages/api/`. Export a named handler for each HTTP method:

```ts
// src/pages/api/example.ts
import type { APIRoute } from 'astro';

export const prerender = false;  // required — marks this as server-rendered

export const GET: APIRoute = async ({ url }) => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  // ...
  return new Response(JSON.stringify({ received: body }), { status: 201 });
};
```

---

## Astro component anatomy

An `.astro` file has two parts separated by `---`:

```astro
---
// FRONTMATTER — runs on the server, never in the browser
// Import components, fetch data, define props here.

import SomeComponent from '../components/SomeComponent.astro';

interface Props {
  title: string;
}

const { title } = Astro.props;
const data = await fetch('/api/something').then(r => r.json());
---

<!-- TEMPLATE — HTML + expressions, like JSX but no JS logic here -->
<div class="wrapper">
  <h1>{title}</h1>
  <SomeComponent />
</div>

<style>
  /* Scoped to this component — no class name collisions */
  .wrapper { padding: 24px; }
</style>
```

**What Astro.props is:** your component's typed interface, passed from the parent just like React props.

**What Astro.url is:** the current request URL object — use `Astro.url.pathname` for active nav state.

**What Astro.request is:** the raw Request — use for cookies, headers, POST bodies in API routes.

---

## Layouts

A layout is just an `.astro` component that uses `<slot />` where child content goes.
It is equivalent to a React component that renders `{children}`.

```astro
---
// src/layouts/AppLayout.astro
import NavbarVertical from '../components/NavbarVertical/NavbarVertical';
import '../styles/app.css';

const { title } = Astro.props;
const pathname = Astro.url.pathname;
---

<html lang="en">
  <head><title>{title} — LLAAB</title></head>
  <body>
    <aside>
      <NavbarVertical pathname={pathname} client:load />
    </aside>
    <main>
      <slot />   <!-- page content goes here -->
    </main>
  </body>
</html>
```

A page uses a layout by importing and wrapping with it:

```astro
---
// src/pages/ingest.astro
import AppLayout from '../layouts/AppLayout.astro';
---

<AppLayout title="Ingest">
  <h1>Ingest a YouTube transcript</h1>
  <!-- everything here replaces <slot /> in the layout -->
</AppLayout>
```

### Named slots

Layouts can have multiple named slots. Useful for things like a page-specific header action:

```astro
<!-- In layout -->
<header>
  <slot name="header-actions" />
</header>
<main>
  <slot />
</main>
```

```astro
<!-- In page -->
<AppLayout>
  <button slot="header-actions">Export</button>
  <p>Main content here</p>
</AppLayout>
```

`AppHeader.astro` already has an `actions` named slot wired up for this.

---

## React islands (client-side components)

Any `.tsx` React component is inert (server-rendered to static HTML) unless you add a
`client:*` directive where it's used in an `.astro` file.

```astro
---
import { MyForm } from '../components/MyForm';
---

<!-- Server HTML only — no interactivity -->
<MyForm />

<!-- Hydrated immediately on page load -->
<MyForm client:load />

<!-- Hydrated when visible in viewport -->
<MyForm client:visible />

<!-- Hydrated when browser is idle -->
<MyForm client:idle />
```

**Rule of thumb:** use `client:load` for anything interactive that needs to work immediately
(forms, nav state). Use `client:visible` for below-the-fold components.

Passing server-side data to a React island works exactly like React props:

```astro
---
const pathname = Astro.url.pathname;
---

<NavbarVertical pathname={pathname} client:load />
```

---

## Styling

### Global styles (`src/styles/`)

Two files, both imported in `AppLayout.astro` (and `BaseLayout.astro`):

| File        | What lives here                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `app.css`   | CSS custom properties (tokens), reset, base elements, typography utilities, surface/card primitives                             |
| `forms.css` | Every form primitive — inputs, buttons (`.btn`, `.btn--primary`, `.btn--outline`, `.btn--ghost`), field wrappers, status blocks |

These use plain CSS class names (`.card`, `.eyebrow`, `.btn--primary`, etc.) and can be applied
anywhere in the app.

### Per-component styles

**In `.astro` files — use `<style>` (auto-scoped):**

```astro
<div class="wrapper">
  <p class="lead">Hello</p>
</div>

<style>
  /* Astro adds a data-astro-cid-* attribute to scope these automatically.
     No class name collisions. No runtime cost. */
  .wrapper { padding: 24px; }
  .lead    { font-size: 18px; color: var(--text-muted); }
</style>
```

To break out of scoping (e.g. to style a child React component's root element):

```astro
<style>
  :global(.some-react-class) { color: red; }
</style>
```

**In React `.tsx` files — use CSS Modules (`.module.css`):**

```
components/
  MyComponent/
    MyComponent.tsx
    MyComponent.module.css   ← same folder, same name
```

```css
/* MyComponent.module.css */
.wrapper  { padding: 24px; background: var(--surface); }
.title    { font-size: 18px; font-weight: 600; }
```

```tsx
// MyComponent.tsx
import s from './MyComponent.module.css';

export function MyComponent() {
  return (
    <div className={s.wrapper}>
      <h2 className={s.title}>Hello</h2>
    </div>
  );
}
```

Vite (which Astro uses under the hood) transforms `.module.css` into scoped class names at build
time. Same scoping concept as `@emotion`, zero runtime.

### Style ownership hierarchy

When deciding where a style belongs, work through this order:

| Layer                | File(s)                                 | Owns                                                            |
| -------------------- | --------------------------------------- | --------------------------------------------------------------- |
| 1. Theme foundation  | `app.css`, Tailwind, shadcn/ui          | Theme tokens, resets, shared component primitives               |
| 2. Global primitives | `app.css`, `forms.css`                  | Tokens, element defaults, `.btn`, `.card`, `.status*`, `.field` |
| 3. Layout shell      | `AppLayout.astro` `<style>`             | Sidebar, header, main-pane grid                                 |
| 4. Page layout       | `pages/*.astro` `<style>`               | Max-width, gap, heading sizes specific to one route             |
| 5. Component styles  | `*.module.css` or `<style>` in `.astro` | Everything internal to a reusable component                     |

**The rule:** apply the style at the lowest layer that covers it. Never duplicate a token or
primitive in a higher layer just because it's convenient.

### Bridging primitive gaps with `:global()`

React components that predate full shared primitive usage often use plain HTML elements
(`<button type="submit">`, `<input>`) without the `.btn` / `.field` class names that `forms.css`
depends on for layout. `forms.css` sets colors on `button[type='submit']` via the `.btn--primary`
selector, but padding, `display`, `border-radius`, etc. live on the `.btn` base class — so an
unstyled submit button gets color but no shape.

Bridge the gap with a scoped `:global()` in the page's `<style>`, annotated with a removal note:

```astro
<style>
  /* Submit button base layout — forms.css colours via .btn--primary; shape lives
     on .btn which this component doesn't use. Remove once DS button is wired up. */
  :global(.my-form button[type='submit']) {
    display: inline-flex;
    align-items: center;
    padding: 10px 20px;
    border: none;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }
</style>
```

Keep the selector tight (`.my-form button[type='submit']`, not just `button[type='submit']`) so
the override doesn't leak to other forms on the same page.

### Component-level overrides of global form styles

`forms.css` sets `font-family: var(--font-sans)` on all inputs. Some fields intentionally want
monospace (URL fields, IDs, code snippets). Override at the component level, not globally:

```astro
<!-- in the page that owns the form, or in the component's .module.css -->
<style>
  :global(.ingest-form .field input) {
    font-family: var(--font-mono);
    font-size: 13px;
  }
</style>
```

If the same override is needed in multiple components, promote it to `forms.css` as a
utility modifier (e.g. `.field--mono input { font-family: var(--font-mono); }`).

### CSS custom properties (tokens)

All design tokens are defined in `:root` in `app.css` and available everywhere:

```css
/* backgrounds */   --bg  --bg-subtle  --surface  --surface-raised
/* borders */       --border  --border-subtle  --border-focus
/* text */          --text  --text-muted  --text-faint
/* accent */        --accent  --accent-hover  --accent-subtle
/* semantic */      --success-*  --error-*  --warning-*
/* typography */    --font-sans  --font-mono
/* radii */         --radius-sm  --radius  --radius-lg
/* spacing */       --space-1 through --space-16  (4px steps)
/* layout */        --sidebar-w  --header-h  --content-max
/* motion */        --duration-fast  --duration  --ease
```

---

## Vault page patterns

All vault sub-pages share the same three-part structure.

### Auth gate

Every vault page starts with a cookie check. Copy this block verbatim — do not move it to a
middleware, the per-page guard keeps each route self-contained:

```astro
---
const COOKIE_NAME = 'vault_key';
const password = import.meta.env.VAULT_PASSWORD ?? 'llaab';
const cookie = Astro.cookies.get(COOKIE_NAME);
if (cookie?.value !== password) return Astro.redirect('/vault/login', 302);
---
```

### Reading vault data

Use `listNodes` from `@llaab/core` in frontmatter. It scans the vault and returns
`LabNode[]` (the discriminated union). Cast to the specific type after filtering:

```astro
---
import { listNodes } from '@llaab/core';
import type { TranscriptNode } from '@llaab/schemas';

const all = await listNodes({ type: 'transcript' });
const transcripts = all as TranscriptNode[];
---
```

For the run detail page, filter by id:

```astro
---
const { id } = Astro.params;
const all = await listNodes({ type: 'run' });
const run = (all as RunNode[]).find((r) => r.id === id);
if (!run) return Astro.redirect('/vault/runs', 302);
---
```

### Tag pills

Domain tags (`d:llm`, `d:automation`, etc.) render as colored pills. The color is driven by
a `--tag-color` CSS custom property set per `data-tag` attribute — no class proliferation:

```astro
<div class="tag-row">
  {node.tags.map((tag) => (
    <span class="tag" data-tag={tag}>{tag}</span>
  ))}
</div>
```

```css
.tag {
  padding: 2px 7px;
  border-radius: 99px;
  font-size: 10px;
  font-family: var(--font-mono);
  background: color-mix(in srgb, var(--tag-color, var(--accent)) 12%, transparent);
  color: var(--tag-color, var(--accent));
  border: 1px solid color-mix(in srgb, var(--tag-color, var(--accent)) 30%, transparent);
}

.tag[data-tag='d:llm']         { --tag-color: #3b82f6; }
.tag[data-tag='d:automation']  { --tag-color: #8b5cf6; }
.tag[data-tag='d:ingest']      { --tag-color: #f59e0b; }
.tag[data-tag='d:schema']      { --tag-color: #14b8a6; }
.tag[data-tag='d:infra']       { --tag-color: #6b7280; }
.tag[data-tag='d:integration'] { --tag-color: #f97316; }
.tag[data-tag='d:ui']          { --tag-color: #ec4899; }
.tag[data-tag='d:meta']        { --tag-color: #22c55e; }
```

Tags without a known `data-tag` value fall back to `var(--accent)`.

### Badges

Status/type badges use the same `.badge` base class with a modifier that sets colors.
The full palette is defined in each vault page's `<style>` block — copy from the nearest
existing page rather than inventing new colors.

```css
.badge { /* base: surface-raised bg, text-muted, border-subtle */ }

/* RunStatus */
.badge--pending   { /* gray */ }
.badge--running   { /* orange */ }
.badge--completed { /* green */ }
.badge--failed    { /* red */ }
.badge--cancelled { /* gray, 0.6 opacity */ }
```

---

## Adding a new page

1. Create `src/pages/my-section.astro` (or `src/pages/my-section/index.astro`).
2. Use `AppLayout` as the wrapper.
3. Add a nav entry in `lib/nav-menu.config.ts` (see `docs/NAV_MENU_DESIGN.md`).
4. Style with a `<style>` block in the `.astro` file.

```astro
---
import AppLayout from '../layouts/AppLayout.astro';
---

<AppLayout title="My Section">
  <div class="page">
    <p class="eyebrow">My Section</p>
    <h1 class="page__heading">Hello</h1>
  </div>
</AppLayout>

<style>
  .page         { max-width: var(--content-max); }
  .page__heading { font-size: 28px; font-weight: 600; }
</style>
```

---

## Adding a new component

**Astro component** (server-rendered, no interactivity needed):

```
src/components/MyThing/MyThing.astro
```

**React island** (interactive, needs `useState` / `useEffect` / event handlers):

```
src/components/MyThing/
  MyThing.tsx
  MyThing.module.css
```

Import in an `.astro` file and add `client:load` if it needs to be interactive.

---

## Dev commands

```bash
# Start dev server (from monorepo root)
pnpm --filter @llaab/client dev

# Or from apps/client directly
pnpm dev

# Typecheck
pnpm typecheck

# Build
pnpm build
```

---

## Common gotchas

| Gotcha                                            | Fix                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| React component has no interactivity              | Add `client:load` where you use it in `.astro`                                           |
| `useState` / `useEffect` throws on server         | You're importing a React hook in an `.astro` frontmatter — move logic into a `.tsx` file |
| CSS from `<style>` not applying to React children | Use `:global(.class)` or move styles to `.module.css` in the React file                  |
| `Astro.url` not available                         | You're in a `.tsx` file — pass `pathname` as a prop from the `.astro` parent             |
| Route not found after adding a file               | Check the file is under `src/pages/` and has the right extension (`.astro` or `.ts`)     |
| API route returns HTML instead of JSON            | Add `export const prerender = false;` at the top of the file                             |
