# TODO — Vault and Knowledge Split

> **Status:** Not started.

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
/Users/justin/LLAAB/
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

- [ ] Audit `vault/nodes/canonical-ideas/`.
      Keep generated canonical candidates in `vault/`; promote only mature accepted summaries to
      `knowledge/wikis/` or `knowledge/knowledge-graphs/`.
- [ ] Audit `vault/nodes/decisions/`.
      Keep raw decision nodes in `vault/`; promote stable project decisions to
      `knowledge/decisions/` only when they become canonical architecture memory.
- [ ] Audit `vault/nodes/instructions/` and `vault/nodes/prompts/`.
      Keep generated prompt/instruction nodes in `vault/`; promote reusable canonical prompt specs to
      `knowledge/prompts/`.
- [ ] Audit `vault/nodes/resources/`, `vault/sources/`, and `vault/transcripts/`.
      Keep source material and extracted references in `vault/`; promote curated reference summaries to
      `knowledge/references/`.
- [ ] Audit `vault/skills/` and `vault/nodes/*skill*` usage.
      Keep experimental/generated skill nodes in `vault/`; promote stable, reusable skill specs to
      `knowledge/skills/`.

## Phase 0 — Safety Snapshot

- [ ] Confirm no active ingest/extraction/consolidation run is writing to `vault/`.
- [ ] Capture parent repo status before migration.
- [ ] Capture a full `vault/` file count and size summary.
- [ ] Confirm `.gitmodules` does not exist or does not mention `vault`.
- [ ] Decide whether the nested vault repo gets a remote immediately or remains local-first.

## Phase 1 — Initialize Nested Vault Repo

- [ ] From `/Users/justin/LLAAB/vault`, run `git init`.
- [ ] Add a vault-local `.gitignore` for transient files such as `.tmp/`, caches, lockfiles, and local
      scratch files.
- [ ] Stage the current vault contents inside the nested repo.
- [ ] Commit the initial vault snapshot.
- [ ] Verify `git -C vault status` reports the expected clean or intentionally dirty vault state.
- [ ] Verify the parent repo has not created `.gitmodules`.

## Phase 2 — Stop Parent Repo Tracking Vault Data

- [ ] Add `/vault/` to the parent `.gitignore`.
- [ ] Remove vault files from the parent index with `git rm -r --cached vault`.
- [ ] Confirm all vault files still exist on disk.
- [ ] Confirm parent `git status` shows only index removals for old tracked vault files plus the
      `.gitignore` change.
- [ ] Commit the parent change that stops tracking generated vault data.
- [ ] Confirm parent `git status` no longer shows vault runtime churn.

## Phase 3 — Create Committed Knowledge Skeleton

- [ ] Create `knowledge/README.md` explaining the promotion contract.
- [ ] Create `knowledge/wikis/README.md`.
- [ ] Create `knowledge/knowledge-graphs/README.md`.
- [ ] Create `knowledge/skills/README.md`.
- [ ] Create `knowledge/agents/README.md`.
- [ ] Create `knowledge/references/README.md`.
- [ ] Create `knowledge/prompts/README.md`.
- [ ] Create `knowledge/decisions/README.md`.
- [ ] Commit the `knowledge/` skeleton in the parent repo.

## Phase 4 — Code and Config Audit

- [ ] Confirm LLAAB runtime can keep using `vault/` at the same path with no code changes.
- [ ] Search for assumptions that `vault/` is parent-repo tracked.
- [ ] Audit vault git helper code that auto-commits metadata.
- [ ] Decide whether vault git operations should run from the nested `vault/.git` repo.
- [ ] Update any server/client labels that imply vault data is committed with source code.
- [ ] Add or update tests for path resolution and vault git status behavior if code changes are needed.

## Phase 5 — Promotion Workflow

- [ ] Define "promoted artifact" criteria.
- [ ] Define how a vault node becomes a `knowledge/` artifact.
- [ ] Decide whether promotion is manual-only for now.
- [ ] Add a future command placeholder, such as `lab knowledge promote <node-id>`, if useful.
- [ ] Document provenance conventions from `knowledge/*` back to vault node ids.
- [ ] Document review expectations before committing `knowledge/` artifacts.

## Phase 6 — Documentation

- [ ] Update `LLAAB_GLOSSARY.md` with `working vault`, `knowledge`, `promoted artifact`, and
      `vault data repo`.
- [ ] Update `.agents/handoff.md` with the new source/data split.
- [ ] Update `docs/integrations/hermes.md` if Hermes inbox receipts mention vault commit behavior.
- [ ] Update any relevant README sections.
- [ ] Add a short "Common Git Commands" section for parent repo vs nested vault repo.

## Phase 7 — Validation

- [ ] Parent repo: source-code change creates a clean app commit with no vault noise.
- [ ] Vault repo: ingest creates expected dirty vault data in `vault/.git`.
- [ ] Vault repo: committing generated nodes works independently.
- [ ] LLAAB app: ingest page still lists runs/transcripts.
- [ ] LLAAB app: source detail and transcript pages still load vault nodes.
- [ ] LLAAB app: discard still removes the expected vault files.
- [ ] Hermes: Telegram YouTube URL still ingests and returns the expected receipt.
- [ ] Hermes: Telegram todo still creates a vault todo node.
- [ ] No `.gitmodules` file is created.

## Phase 8 — Optional Later Move

If nested Git ever feels too hidden, consider a second migration:

```text
/Users/justin/LLAAB/          # source repo
/Users/justin/LLAAB-vault/    # sibling data repo
```

That later move would require adding and validating a configurable `LLAAB_VAULT_DIR`. It is not
required for the first split because keeping `vault/` in place avoids code-path churn.

## Open Questions

- [ ] Should the nested vault repo get a remote now, or stay local until the workflow settles?
- [ ] Should generated run nodes be committed frequently, squashed periodically, or archived outside Git?
- [ ] Should `knowledge/knowledge-graphs/` store Mermaid summaries, Graphify exports, or both?
- [ ] Should promoted agent profiles live as markdown only, or eventually compile into Hermes/LLAAB agent
      config?
- [ ] Should mature canonical skills become schema-backed `SkillNode`s, markdown specs, executable package
      code, or all three?
