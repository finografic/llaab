# Vault and Knowledge Repos

LLAAB separates volatile working data from stable source and promoted knowledge.

## Layout

```text
~/LLAAB/
  .git/                         # parent LLAAB source repo
  AGENTS.md
  README.md
  apps/
  docs/
  packages/
  knowledge/                    # promoted canonical artifacts
    README.md
    wikis/
    knowledge-graphs/
    skills/
    agents/
    references/
    prompts/
    decisions/
  vault/
    .git/                       # nested private vault data repo, not a submodule
    README.md
    AGENTS.md
    INBOX.md
    raw/
    nodes/
      canonical-ideas/
      decisions/
      ideas/
      instructions/
      prompts/
      resources/
    runs/
    skills/
    sources/
    transcripts/
```

## Repo Roles

| Repo              | Owns                                                                        | Does not own                                  |
| ----------------- | --------------------------------------------------------------------------- | --------------------------------------------- |
| Parent LLAAB repo | App/source code, packages, docs, `knowledge/`                               | Runtime vault data                            |
| Nested vault repo | Runtime captures, run traces, sources, transcripts, generated nodes, drafts | App/source code, promoted canonical knowledge |

The nested vault repo is a normal Git repo at `vault/.git`. It is not a submodule: the parent repo
must not track `vault` as a gitlink and must not have a `.gitmodules` entry for it.

## Current History Boundary

`vault/` is ignored and untracked in the current parent repo tree. That keeps future parent commits
clean.

Older parent commits still contain historical `vault/` files. Removing those from all historical
commits requires a deliberate destructive history rewrite, such as `git filter-repo`, followed by
force-pushing and coordinating every clone. Do not do that unless explicitly requested.

## Working Vault

The working vault contains runtime and generated material:

- inbox drops
- raw files
- transcripts
- source nodes
- run traces
- extracted idea nodes
- canonical-idea candidates
- prompt, resource, decision, instruction, and draft skill nodes

Canonical-idea nodes are high-value intermediate artifacts. They are usually the best ingredients for
future `knowledge/wikis/` pages and `knowledge/knowledge-graphs/` summaries, but they remain vault
data until reviewed and promoted.

## Promoted Knowledge

`knowledge/` contains stable artifacts that should travel with the main LLAAB source repo:

- wiki pages
- knowledge-graph summaries
- canonical skill specs
- durable agent profiles
- curated references
- reusable prompt specs
- stable decisions

Promotion is manual for now:

1. Select source material from `vault/`.
2. Review and consolidate it.
3. Rewrite it as a stable artifact under the right `knowledge/` folder.
4. Preserve provenance back to vault node ids, transcript ids, source ids, run ids, or URLs.
5. Commit the promoted artifact in the parent LLAAB repo.

Expected first promotion path:

```text
vault transcripts/sources -> extracted ideas -> canonical ideas
  -> reviewed wiki page or knowledge-graph summary in knowledge/
```

## Git Commands

Parent source repo:

```bash
git status --short
git add README.md AGENTS.md docs knowledge apps packages
git commit -m "docs(knowledge): update repo split docs"
```

Nested vault repo:

```bash
git -C vault status --short
git -C vault add --all
git -C vault commit -m "docs(vault): document data repo"
git -C vault push
```

Check that the parent is not tracking vault data:

```bash
git ls-files vault
test ! -e .gitmodules
```

`git log --all -- vault` may still show historical parent commits before the split. That is expected
unless a separate history rewrite is performed.
