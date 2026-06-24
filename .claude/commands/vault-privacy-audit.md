# Vault Privacy Audit

Run an interactive privacy audit of the LLAAB vault before making the repo public.
Scans vault nodes, source files, config, and the lab/ directory for potentially
sensitive content, then walks you through each flagged item so you can decide what
happens to it.

Previously approved files are silently skipped — unless they have been modified
since approval, in which case they surface again for re-review.

## Usage

```
/vault-privacy-audit
```

Run from the repo root. No arguments needed.

## What it does

1. Executes `scripts/vault-privacy-audit.ts` via Bun
2. Loads `scripts/vault-audit-approved.json` — previously approved files are skipped
   if unchanged (git commit date checked against approval date)
3. For each remaining flagged item, shows the content and asks you to choose:
   - **[k] keep** — fine as-is this time, but ask again next run
   - **[a] approve** — remember this file; skip on all future runs unless it changes
   - **[r] redact** — edit the sensitive value in-place (you confirm the diff)
   - **[d] delete** — remove the file entirely (you confirm)
   - **[s] skip** — leave it for now, log to `vault-audit-skipped.log`
4. After the session, writes any new approvals back to `vault-audit-approved.json`
5. Prints a summary table

## Five scan categories

| #   | Category                            | What it looks for                                               |
| --- | ----------------------------------- | --------------------------------------------------------------- |
| 1   | **Secrets**                         | API keys, tokens, passwords (`sk-`, `Bearer`, `API_KEY=`, etc.) |
| 2   | **Personal data**                   | Email addresses, phone numbers                                  |
| 3   | **Employer / colleague references** | Internal team names, colleague names, ticket IDs                |
| 4   | **Draft notes**                     | Vault nodes with `status: draft / inbox / wip`                  |
| 5   | **Lab content**                     | Everything under `lab/` — reviewed file by file                 |

## Approved list

`scripts/vault-audit-approved.json` — committed to the repo. Each entry records:

- `path` — relative file path
- `approvedAt` — ISO date of approval
- `note` — optional reason (you can provide this when approving)

A file is re-surfaced automatically if it has new git commits since `approvedAt`.

## After the audit

- Skipped items → `vault-audit-skipped.log` (gitignored)
- Approved items → `scripts/vault-audit-approved.json` (committed)
- Run again any time — the approved list makes repeat runs fast

---

## Instructions for Claude Code

When this command is invoked:

### 1. Run the script

```bash
bun scripts/vault-privacy-audit.ts
```

Parse the JSON output. Note the `skippedApproved` count — mention it upfront
("X previously approved files were skipped").

### 2. For each flagged item, present:

- File path + line number (if applicable)
- Flag category and reason
- The flagged line with 3 lines of context either side
- Whether the flag is marked `[CHANGED SINCE APPROVAL]`
- The five options:

```
[k] keep        — fine this time, ask again next run
[a] approve     — remember this; skip on future runs unless file changes
[r] redact      — edit sensitive value in-place
[d] delete      — remove the file
[s] skip        — log to vault-audit-skipped.log, revisit later
```

Wait for the user's decision before moving to the next item.

### 3. Handle each decision

**keep** — no action, continue.

**approve** — ask: "Add a note for this approval? (press Enter to skip)"
Collect the note (may be empty). Store the approval in memory for now;
write all approvals to `scripts/vault-audit-approved.json` at the end of
the session (not after each item — batch the writes).

Format to add to the `approved` array:

```json
{
  "path": "lab/decisions.md",
  "approvedAt": "<today's ISO date>",
  "note": "<user's note or empty string>"
}
```

**redact** — ask what the replacement value should be (e.g. `[REDACTED]`).
Make the edit, show the diff, ask for confirmation before saving.

**delete** — show full path, ask "Delete this file? [y/N]", delete on confirm.

**skip** — append `<filePath> | <reason>` to `vault-audit-skipped.log`.

### 4. After all items

Write the updated `scripts/vault-audit-approved.json` (merge new approvals
with existing entries — do not overwrite entries for files not reviewed this session).

Print the summary table:

```
┌──────────────┬───────┐
│ Decision     │ Count │
├──────────────┼───────┤
│ Kept         │ N     │
│ Approved     │ N     │
│ Redacted     │ N     │
│ Deleted      │ N     │
│ Skipped      │ N     │
│ Auto-skipped │ N     │  ← previously approved, unchanged
└──────────────┴───────┘
```

If skipped > 0: remind the user to resolve those before making the repo public.
If approved > 0: remind the user to commit `scripts/vault-audit-approved.json`.

### 5. Rules

- Do NOT auto-approve anything. Every decision belongs to the user.
- Do NOT modify `vault-audit-approved.json` until the end of the session.
- If the script errors, show the raw error and stop.
