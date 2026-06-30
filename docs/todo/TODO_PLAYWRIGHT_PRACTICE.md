# TODO — Playwright Practice Playground

> **Status:** Not started.

## Goal

Use LLAAB as a real application playground for learning Playwright through focused, practical
exercises. The point is not full production coverage at first; it is to build confidence with
browser automation, selectors, assertions, fixtures, network waits, and regression checks.

## Setup Playwright

- [ ] Install Playwright test tooling in the workspace.

  ```bash
  pnpm add -D -w @playwright/test
  pnpm exec playwright install chromium
  ```

- [ ] Add a root `playwright.config.ts` with the local client URL:

  ```ts
  import { defineConfig, devices } from '@playwright/test';

  export default defineConfig({
    testDir: './tests/e2e',
    use: {
      baseURL: 'http://llaab.localhost:5050',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
  });
  ```

- [ ] Add package scripts:

  ```json
  {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed"
  }
  ```

- [ ] Create `tests/e2e/` and a first smoke test file.
- [ ] Decide how tests should handle local auth:
  - easiest first pass: set dev auth env so the app opens locally
  - later: add a login helper that fills `LLAAB_PASSWORD`
- [ ] Keep tests local-only at first; do not add CI until the exercises are stable.

## Exercise 1 — Navigational Smoke Test

**Purpose:** Learn basic page navigation, role selectors, URL assertions, and visible text checks.

**Objective:** Prove the main dashboard and primary nav destinations load without crashing.

- [ ] Visit `/`.
- [ ] Assert the `LLAAB` dashboard heading is visible.
- [ ] Click dashboard cards for `Ingest`, `Vault`, `Runs`, `Models`, `Hermes / MCP`, and `Icons`.
- [ ] Assert each route lands on the expected URL and page heading.
- [ ] Prefer accessible selectors such as `getByRole('link', { name: /models/i })`.

## Exercise 2 — Resilient Auth Flow Test

**Purpose:** Practice form filling, submit actions, negative assertions, and reusable helpers.

**Objective:** Cover the app login screen without hard-coding brittle DOM structure.

- [ ] Start with `LLAAB_PASSWORD` enabled.
- [ ] Visit a protected app route.
- [ ] Assert the login page appears.
- [ ] Submit an incorrect password and assert the error message.
- [ ] Submit the configured password and assert navigation into the app.
- [ ] Extract a `login(page)` helper for later tests.

## Exercise 3 — Vault Browsing Test

**Purpose:** Practice waiting for app data, using URL search params, and checking route-driven UI.

**Objective:** Verify the vault browser can open a known vault markdown file.

- [ ] Visit `/vault`.
- [ ] Select or navigate directly to a known vault file path.
- [ ] Assert the file content panel renders.
- [ ] Assert the selected path is reflected in the URL.
- [ ] Add one assertion that protects against the left/right tree selection crash regressing.

## Exercise 4 — Runs Table Interaction Test

**Purpose:** Practice table assertions, grouped rows, expand/collapse behavior, and stable row
selection.

**Objective:** Verify the Runs page can display run history and reveal grouped run details.

- [ ] Visit `/vault/runs`.
- [ ] Assert the Runs page heading and table are visible.
- [ ] Locate a run row by visible text or status badge.
- [ ] Expand a grouped row.
- [ ] Assert child rows align with parent columns and details become visible.
- [ ] Collapse the row and assert details are hidden again.

## Exercise 5 — Hermes / MCP Dashboard Test

**Purpose:** Practice testing static dashboard content that will later become live status.

**Objective:** Protect the new Hermes / MCP page and dashboard card from accidental route/nav
regressions.

- [ ] Visit `/`.
- [ ] Click the `Hermes / MCP` dashboard card.
- [ ] Assert `/hermes` loads.
- [ ] Assert the page shows the gateway callout, current guardrails, model cost-routing card, and
      MCP tool surface.
- [ ] Assert `vault_list`, `vault_read`, and `vault_capture_idea` appear with the expected read/write
      labels.

## Additional Follow-Ups

- Add a screenshot assertion for the home dashboard grid.
- Test the top-right action icons route to Ingest, Transcripts, Models, and Icons.
- Add mobile viewport coverage for the nav menu.
- Add a test for `/llm` model status when Ollama or LM Studio is unavailable.
- Add a test for the Terminal page shell without executing a destructive command.
- Add a test that the Hermes page cost-routing text remains visible.
- Add `data-testid` only where accessible selectors are not stable enough.
- Add a `storageState` fixture after the login helper is stable.
- Add trace review practice by intentionally failing one local test and inspecting the trace.

## Larger Stretch Exercise — User Journey Regression Pack

Build a small end-to-end pack that simulates a real LLAAB session:

1. Log in.
2. Open the dashboard.
3. Navigate to Hermes / MCP and verify the operator surface.
4. Open Vault and read a known node.
5. Open Runs and inspect recent run history.
6. Open Models and confirm routing status renders.

The stretch goal is to practice composing small tests into a meaningful journey without making one
giant brittle test that fails for unrelated reasons.
