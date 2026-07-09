# Vault and Knowledge Repos

## Two-repo contract

LLAAB uses a nested private vault data repo inside the parent source checkout:

```text
~/LLAAB/
  .git/       # parent source repo
  knowledge/  # promoted canonical artifacts
  vault/
    .git/     # nested data repo
```

## Rules

- Do not add `vault/` contents to parent LLAAB commits.
- Do not create a Git submodule for `vault/`; there should be no `.gitmodules` entry.
- Commit vault runtime data from the nested repo with `git -C vault ...`.
- Commit promoted artifacts from `knowledge/` in the parent source repo.
- Treat `vault/nodes/canonical-ideas/` as source ingredients for promoted knowledge, not as
  automatically promoted artifacts.
- Keep `docs/process/VAULT_KNOWLEDGE_REPOS.md`, root `README.md`, root `AGENTS.md`, and
  `vault/README.md` aligned when changing the split.
- Do not rewrite parent Git history to purge historical `vault/` files unless the user explicitly
  asks for that destructive migration.
