# Vault Privacy Audit

Interactive pre-publish privacy sweep for LLAAB. Scans the vault, lab notes, and
configs for anything that shouldn't be public, then walks you through each item
so you decide what happens to it.

Previously approved files are remembered and silently skipped on future runs —
unless they've been modified since approval, in which case they surface again.

---

## Files

```
.claude/commands/vault-privacy-audit.md    ← Claude Code slash command
scripts/vault-privacy-audit.ts             ← Scanner script
scripts/vault-audit-approved.json          ← Approved file list (commit this)
vault-audit-skipped.log                    ← Auto-generated; gitignored
```

---

## Quickstart

### Interactive session (recommended)

Open Claude Code from the repo root, then:

```
/vault-privacy-audit
```

Claude Code runs the scanner and walks you through every flagged item one by one.

### Dry-run report (no interaction, just see what would be flagged)

```bash
bun scripts/vault-privacy-audit.ts --report
```

Prints a summary to stdout. Nothing is changed.

---

## What gets scanned

| Category                | What triggers it                                                |
| ----------------------- | --------------------------------------------------------------- |
| **Secrets**             | API keys, tokens, Bearer headers, passwords                     |
| **Personal data**       | Email addresses, phone numbers                                  |
| **Employer references** | Colleague names, internal tool/channel names, ticket IDs        |
| **Draft nodes**         | Vault nodes with `status: draft / inbox / wip`                  |
| **Lab content**         | Everything under `lab/` — flagged wholesale for explicit review |

Scanned directories: `vault/`, `lab/`, `configs/`
Scanned extensions: `.md`, `.ts`, `.json`, `.yaml`, `.yml`, `.env`
Gitignored files are always silently skipped.

---

## Decision options

| Key | Action                                                                  | Remembered?                       |
| --- | ----------------------------------------------------------------------- | --------------------------------- |
| `k` | **Keep** — fine this time, ask again next run                           | No                                |
| `a` | **Approve** — remember this file, skip on future runs unless it changes | Yes → `vault-audit-approved.json` |
| `r` | **Redact** — agent edits the value in-place; you confirm the diff       | —                                 |
| `d` | **Delete** — removes the file; you confirm first                        | —                                 |
| `s` | **Skip** — logs to `vault-audit-skipped.log`, revisit later             | Skipped log only                  |

---

## The approved list

`scripts/vault-audit-approved.json` is committed to the repo. It records every
file you've explicitly approved, with the date and an optional note:

```json
{
  "approved": [
    {
      "path": "lab/decisions.md",
      "approvedAt": "2026-05-28T12:00:00+10:00",
      "note": "architecture decision log, no sensitive content"
    }
  ]
}
```

**A file is re-surfaced if it has new git commits since `approvedAt`.** This means
you only review what's actually new or changed — the list gets smarter over time.

After a session where you approve files, Claude Code will remind you to commit
`vault-audit-approved.json` so the approvals persist.

---

## Skipped items

Items you skip are appended to `vault-audit-skipped.log` (gitignored). This is
your "to-do before public" list. Resolve all skipped items before making the repo
public.

---

## Running periodically

Good moments to run:

- Before making the repo public for the first time
- After a batch of ingestions that brought in new vault content
- Before sharing the repo URL with anyone
- As a pre-push reminder (add `bun scripts/vault-privacy-audit.ts --report` to a hook)

---

## Extending the patterns

Patterns live at the top of `scripts/vault-privacy-audit.ts`:

```ts
const SECRET_PATTERNS: RegExp[] = [ ... ]
const PERSONAL_DATA_PATTERNS: RegExp[] = [ ... ]
const EMPLOYER_PATTERNS: RegExp[] = [ ... ]
```

Add patterns for internal tool names, colleague handles, project codenames, etc.
