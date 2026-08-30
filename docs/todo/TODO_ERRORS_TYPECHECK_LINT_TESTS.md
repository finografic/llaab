# TODO — Fix Standing ERRORS (typecheck, lint, tests)

> **Status:** Open. Captured 2026-08-30 while wiring `@finografic/core/viewport` into
> `packages/ui`. All of these are pre-existing and unrelated to that work — verified by
> stashing the change and re-running: the counts were identical before and after.

`packages/ui` is clean. Everything below is in `apps/client` and two backend packages.

## Summary

| Area                      | Count          | Command                                 |
| ------------------------- | -------------- | --------------------------------------- |
| `@llaab/client` typecheck | 11 errors      | `pnpm --filter @llaab/client typecheck` |
| Lint                      | 1 error        | `pnpm lint`                             |
| Tests                     | 2 failed / 695 | `pnpm test`                             |

---

## 1. Typecheck — `VaultFileTree` handle is missing members (5 errors)

`src/components/VaultBrowser/components/VaultFileTree.tsx`

| Line  | Missing on `FileTreeItemHandle` |
| ----- | ------------------------------- |
| 50:43 | `isExpanded`                    |
| 61:40 | `isExpanded`                    |
| 61:59 | `expand`                        |
| 69:39 | `isExpanded`                    |
| 69:58 | `collapse`                      |

The component calls an expand/collapse API the `FileTreeItemHandle` type does not declare.

**Decide first:** did the handle type lose these members, or was the component written
against an API that never shipped? Check the ref target's implementation before adding
anything to the type — declaring members that do not exist at runtime turns 5 compile
errors into a silent runtime failure.

## 2. Typecheck — `quiz.tsx` narrows to `never` (1 error)

`src/routes/quiz.tsx(110,69)` — `Property 'correct' does not exist on type 'never'`.

A union has been narrowed until nothing is left, so the branch is unreachable as typed.
Usually a discriminant test that cannot hold. Fix the narrowing, do not cast.

## 3. Typecheck — `resource-detail.tsx` treats a union as one member (5 errors)

`src/routes/resource-detail.tsx`

| Line   | Error                                                                  |
| ------ | ---------------------------------------------------------------------- |
| 72:34  | `extracted_idea_ids` missing on the union                              |
| 77:42  | `canonical_coverage` missing on the union                              |
| 97:7   | union not assignable to the `type: "resource"` member                  |
| 121:16 | `resource_type` missing on the union                                   |
| 130:7  | union not assignable to the `type: "resource"` member (or `undefined`) |

The route holds a wide record union (11+ members: `instruction`, `idea`, `resource`, …)
and reads fields that only exist on the `resource` member.

**Fix:** narrow on the `type` discriminant once, near the top, and work with the narrowed
value from there. All five errors share this one cause.

## 4. Lint — forbidden `import()` type annotation (1 error)

`apps/client/src/components/TtsPlayer/tts-player.engine.test.ts:4:28`

`typescript(consistent-type-imports)` — replace the inline `import('module').Type` with a
regular `import type { Type } from 'module'`. Mechanical, one line.

## 5. Tests — 2 failing

| File                                                  | Test                                                                                                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ingestion/src/extract/llm-extract.test.ts`  | `returns control trace metadata with accept decision on success` — `expected [ …(5) ] to deeply equal [ …(5) ]`                                                                  |
| `packages/skills/src/wiki/compile-wiki-draft.test.ts` | `rejects mixed-transcript ids from the manual transcript flow before inference` — expected error to contain `'route transcript'`, got `'Manual wiki selection must use canoni…'` |

Both look like the code moved and the assertions did not. **Confirm which side is right
before editing the test** — the second one is asserting on an error message, so a
reworded guard would produce exactly this, but so would a guard that now fires for the
wrong reason.

---

## Suggested order

1. **§4 lint** — one line, unblocks a clean `pnpm lint`.
2. **§3 resource-detail** — one narrowing fix clears 5 of the 11 type errors.
3. **§5 tests** — decide code-vs-test per failure.
4. **§2 quiz** — small, but needs the union understood.
5. **§1 VaultFileTree** — last: needs an API decision, not just a type edit.

## Done when

```bash
pnpm typecheck   # 0 errors
pnpm lint        # 0 errors
pnpm test        # 695 passed
```

Then rename this file to `DONE_ERRORS_TYPECHECK_LINT_TESTS.md`.
