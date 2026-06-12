# Layout & Pages Guide

Architecture reference for LLAAB's Vite + React Router client. All client app code lives in
`apps/client/src/`.

---

## Layout Hierarchy

```text
index.html
  src/main.tsx
    QueryClientProvider
      RouterProvider
        AppLayout
          AppHeader
          main
            route component
              PageLayout / PageList / PageDetail
                PageHero
                content
          AppFooter
```

`src/router.tsx` owns the route tree. Route `handle` values can set the page title and full-bleed
layout behavior:

```tsx
{
  path: 'vault/transcripts',
  element: <TranscriptsPage />,
  handle: { title: 'Transcripts', fullBleed: true } satisfies RouteHandle,
}
```

---

## AppLayout

`layouts/AppLayout/AppLayout.tsx` is the shell for all non-login routes. It renders:

- `AppHeader` with the active route title
- `<Outlet />` inside the main content region
- `AppFooter`

`fullBleed` route handles remove the normal page padding for split-view workflows such as
`/vault/transcripts`.

---

## NavMenu

`components/NavMenu/NavMenu.tsx` renders the horizontal shadcn `NavigationMenu` inside `AppHeader`.
Menu structure lives in `lib/nav-menu.config.ts`; active route matching lives in
`lib/nav-menu.utils.ts`.

- Desktop (`md+`): megamenus for Vault, Pipeline, Execute, Models, and System.
- Mobile: sheet + accordion using the same config.
- Future routes: disabled with lock icon until `live: true`.
- Responsive visibility uses Tailwind classes only. Do not put `display` rules on the wrapper CSS
  modules that would override `hidden md:flex` or `md:hidden`.

---

## Page Layouts

Use the route-level layout components instead of hand-rolling page shells:

| Component    | Location                            | Use                                                 |
| ------------ | ----------------------------------- | --------------------------------------------------- |
| `PageLayout` | `layouts/PageLayout/PageLayout.tsx` | General pages with optional hero and aside          |
| `PageList`   | `layouts/PageList/PageList.tsx`     | Vault list pages                                    |
| `PageDetail` | `layouts/PageDetail/PageDetail.tsx` | Vault detail pages                                  |
| `PageHero`   | `components/PageHero/PageHero.tsx`  | Eyebrow/title/description/meta/right actions header |
| `FileList`   | `tables/FileList/FileList.tsx`      | Finder-style TanStack table/list                    |

Example:

```tsx
import { PageHero } from "components/PageHero/PageHero";
import { PageLayout } from "layouts/PageLayout/PageLayout";

export function ExamplePage() {
  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title="Examples"
          description="Browse local vault records."
          right={<button type="button">Action</button>}
        />
      }
    >
      <YourContent />
    </PageLayout>
  );
}
```

---

## Data Loading

The client is a single React tree. Use TanStack Query hooks under `src/queries/*` for server data.
All calls use same-origin `/api/*`, proxied by Vite in development and preview.

- Vault auth/session, tree, nodes, source enrich/profile updates live on `apps/server`.
- Do not import `@llaab/core` or `@llaab/ingestion` in the client.
- The root `QueryClientProvider` in `main.tsx` owns the shared query cache.

---

## CSS System

| Layer            | Location                           | Owns                                     |
| ---------------- | ---------------------------------- | ---------------------------------------- |
| UI globals       | `@llaab/ui/globals.css`            | Tailwind, shadcn tokens, framework reset |
| App tokens       | `styles/app.css`                   | LLAAB semantic tokens and app overrides  |
| Component styles | `*.module.css`                     | Component-scoped layout and presentation |
| Page styles      | `routes/*.module.css` or route CSS | Route-specific layout                    |

`main.tsx` imports UI globals first and `styles/app.css` second. CSS Modules are imported as
`styles` and should prefer app/shadcn tokens over hard-coded colors.

---

## Adding A Page

1. Create `apps/client/src/routes/<name>.tsx`.
2. Compose `PageLayout`, `PageList`, or `PageDetail` with `PageHero`.
3. Fetch data through an existing `queries/*` hook or add a focused hook.
4. Add the route to `src/router.tsx` with a `handle.title`.
5. Add or unlock the nav entry in `lib/nav-menu.config.ts` only after the route works.
6. Run the focused client verification command for the change.
