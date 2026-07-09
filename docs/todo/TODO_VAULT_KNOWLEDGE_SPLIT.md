# TODO — Vault and Knowledge Split

> **Status:** Phases 0-6 complete (2026-07-09). Phase 7 partially validated; Phase 8 optional.

## Purpose

Separate fast-changing lab working data from stable project knowledge:

- `vault/` becomes a normal nested Git repo for volatile working memory, generated nodes, runs,
  transcripts, sources, and raw extraction outputs.
- `knowledge/` becomes a committed parent-repo folder for promoted, canonical, slower-changing
  artifacts such as wikis, knowledge-graph summaries, canonical skills, agent profiles, references,
  and mature project knowledge.

This keeps app/source commits clean without losing version control for vault data.

## Target Shape

```text
~/LLAAB/
  .git/                         # parent app/source repo
  .gitignore                    # ignores /vault/
  knowledge/                    # committed stable knowledge artifacts
    README.md
    wikis/
    knowledge-graphs/
    skills/
    agents/
    references/
    prompts/
    decisions/
  vault/
    .git/                       # nested normal Git repo, not a submodule
    nodes/
    runs/
    sources/
    transcripts/
    raw/
```

Important distinction: this is **not** a Git submodule. The parent repo should ignore `vault/`
entirely and must not track `vault` as a gitlink.

## Folder Contract

| Location     | Lifecycle                                    | Commit owner      | Contents                                                                                                            |
| ------------ | -------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `vault/`     | Working, volatile, generated, reviewable     | Nested vault repo | Raw captures, transcripts, source nodes, idea nodes, run nodes, temporary canonical candidates                      |
| `knowledge/` | Promoted, canonical, mature, slower-changing | Parent LLAAB repo | Human/agent-facing wiki pages, knowledge-graph summaries, canonical skill specs, agent profiles, curated references |
| `docs/`      | Project/process documentation                | Parent LLAAB repo | Integration docs, TODO/DONE plans, user-facing project docs                                                         |

## Existing Vault Folder Audit

- [x] Audit `vault/nodes/canonical-ideas/`.
      Keep generated canonical candidates in `vault/`; promote only mature accepted summaries to
      `knowledge/wikis/` or `knowledge/knowledge-graphs/`.
- [x] Audit `vault/nodes/decisions/`.
      Keep raw decision nodes in `vault/`; promote stable project decisions to
      `knowledge/decisions/` only when they become canonical architecture memory.
- [x] Audit `vault/nodes/instructions/` and `vault/nodes/prompts/`.
      Keep generated prompt/instruction nodes in `vault/`; promote reusable canonical prompt specs to
      `knowledge/prompts/`.
- [x] Audit `vault/nodes/resources/`, `vault/sources/`, and `vault/transcripts/`.
      Keep source material and extracted references in `vault/`; promote curated reference summaries to
      `knowledge/references/`.
- [x] Audit `vault/skills/` and `vault/nodes/*skill*` usage.
      Keep experimental/generated skill nodes in `vault/`; promote stable, reusable skill specs to
      `knowledge/skills/`.

## Phase 0 — Safety Snapshot

- [x] Confirm no active ingest/extraction/consolidation run is writing to `vault/`.
- [x] Capture parent repo status before migration.
- [x] Capture a full `vault/` file count and size summary.
- [x] Confirm `.gitmodules` does not exist or does not mention `vault`.
- [x] Decide whether the nested vault repo gets a remote immediately or remains local-first.

## Phase 1 — Initialize Nested Vault Repo

- [x] From `~/LLAAB/vault`, run `git init`.
- [x] Add a vault-local `.gitignore` for transient files such as `.tmp/`, caches, lockfiles, and local
      scratch files.
- [x] Stage the current vault contents inside the nested repo.
- [x] Commit the initial vault snapshot.
- [x] Verify `git -C vault status` reports the expected clean or intentionally dirty vault state.
- [x] Verify the parent repo has not created `.gitmodules`.

## Phase 2 — Stop Parent Repo Tracking Vault Data

- [x] Add `/vault/` to the parent `.gitignore`.
- [x] Remove vault files from the parent index with `git rm -r --cached vault`.
- [x] Confirm all vault files still exist on disk.
- [x] Confirm parent `git status` shows only index removals for old tracked vault files plus the
      `.gitignore` change.
- [x] Commit the parent change that stops tracking generated vault data.
- [x] Confirm parent `git status` no longer shows vault runtime churn.

## Phase 3 — Create Committed Knowledge Skeleton

- [x] Create `knowledge/README.md` explaining the promotion contract.
- [x] Create `knowledge/wikis/README.md`.
- [x] Create `knowledge/knowledge-graphs/README.md`.
- [x] Create `knowledge/skills/README.md`.
- [x] Create `knowledge/agents/README.md`.
- [x] Create `knowledge/references/README.md`.
- [x] Create `knowledge/prompts/README.md`.
- [x] Create `knowledge/decisions/README.md`.
- [x] Commit the `knowledge/` skeleton in the parent repo.

## Phase 4 — Code and Config Audit

- [x] Confirm LLAAB runtime can keep using `vault/` at the same path with no code changes.
- [x] Search for assumptions that `vault/` is parent-repo tracked.
- [x] Audit vault git helper code that auto-commits metadata.
- [x] Decide whether vault git operations should run from the nested `vault/.git` repo.
- [x] Update any server/client labels that imply vault data is committed with source code.
- [x] Add or update tests for path resolution and vault git status behavior if code changes are needed.

## Phase 5 — Promotion Workflow

- [x] Define "promoted artifact" criteria.
- [x] Define how a vault node becomes a `knowledge/` artifact.
- [x] Decide whether promotion is manual-only for now.
- [x] Add a future command placeholder, such as `lab knowledge promote <node-id>`, if useful.
- [x] Document provenance conventions from `knowledge/*` back to vault node ids.
- [x] Document review expectations before committing `knowledge/` artifacts.

Promotion criteria:

- The artifact has been reviewed by a human or a deliberate review pass.
- It is stable enough to help future source checkouts without requiring the originating raw context.
- It has a clear destination under `knowledge/` and is not merely a generated vault node copied as-is.
- It preserves provenance back to source vault node ids, transcript ids, source ids, run ids, or URLs.
- Canonical-idea nodes are preferred source ingredients for `knowledge/wikis/` and
  `knowledge/knowledge-graphs/`, but they remain working vault data until reviewed and promoted.

Promotion process:

1. Select a candidate from the working vault.
2. Rewrite or consolidate it into a stable artifact for the relevant `knowledge/` folder.
3. Add provenance metadata or a short "Sources" section that points back to the originating vault data.
4. Review the artifact for usefulness, privacy, and duplication.
5. Commit the promoted artifact in the parent LLAAB repo.

Expected first promotion path:

```text
vault transcripts/sources -> extracted ideas -> canonical ideas
  -> reviewed wiki page or knowledge-graph summary in knowledge/
```

Promotion is manual-only for now. A future CLI shape can be:

```bash
lab knowledge promote <node-id>
```

That command should prepare a draft artifact and provenance, not silently commit it.

## Phase 6 — Documentation

- [x] Update `LLAAB_GLOSSARY.md` with `working vault`, `knowledge`, `promoted artifact`, and
      `vault data repo`.
- [x] Update `.agents/handoff.md` with the new source/data split.
- [x] Update `docs/integrations/hermes.md` if Hermes inbox receipts mention vault commit behavior.
- [x] Update any relevant README sections.
- [x] Add a short "Common Git Commands" section for parent repo vs nested vault repo.

Common Git commands:

```bash
# Parent source repo
git status --short
git add knowledge docs apps packages
git commit -m "docs(knowledge): promote artifact"

# Nested vault data repo
git -C vault status --short
git -C vault add --all
git -C vault commit -m "chore(vault): commit generated data"
```

GitHub remote setup for `vault/`:

1. Create an empty GitHub repo with no README, license, or `.gitignore`.
2. Add it from the parent checkout:

   ```bash
   git -C vault remote add origin <repo-url>
   git -C vault branch -M main
   git -C vault push -u origin main
   ```

3. Keep the parent LLAAB repo separate; do not add `vault/` as a submodule.

## Phase 7 — Validation

- [x] Parent repo: source-code change creates a clean app commit with no vault noise.
- [ ] Vault repo: ingest creates expected dirty vault data in `vault/.git`.
- [x] Vault repo: committing generated nodes works independently.
- [ ] LLAAB app: ingest page still lists runs/transcripts.
- [ ] LLAAB app: source detail and transcript pages still load vault nodes.
- [ ] LLAAB app: discard still removes the expected vault files.
- [ ] Hermes: Telegram YouTube URL still ingests and returns the expected receipt.
- [ ] Hermes: Telegram todo still creates a vault todo node.
- [x] No `.gitmodules` file is created.

Validated automatically on 2026-07-09:

- Parent `git status --short` ignores a temporary `vault/raw/*` file.
- Nested vault repo can track and commit vault-local structure independently.
- `GET /api/vault/git/status` logic reads from nested `vault/.git` and expands untracked files with
  `--untracked-files=all`.
- Vault git path validation rejects absolute paths and `..` escapes.

## Phase 8 — Optional Later Move

If nested Git ever feels too hidden, consider a second migration:

```text
~/LLAAB/          # source repo
~/LLAAB-vault/    # sibling data repo
```

That later move would require adding and validating a configurable `LLAAB_VAULT_DIR`. It is not
required for the first split because keeping `vault/` in place avoids code-path churn.

## Open Questions

- [ ] Should the nested vault repo get a remote now, or stay local until the workflow settles?
- [ ] Should generated run nodes be committed frequently, squashed periodically, or archived outside Git?
- [ ] Should `knowledge/knowledge-graphs/` store Mermaid summaries, structured graph JSON, or both?
- [ ] Should promoted agent profiles live as markdown only, or eventually compile into Hermes/LLAAB agent
      config?
- [ ] Should mature canonical skills become schema-backed `SkillNode`s, markdown specs, executable package
      code, or all three?
