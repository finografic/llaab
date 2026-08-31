# Runtime Agent Instructions

These rules apply when editing, generating, or organizing LLAAB-owned runtime agents.

Canonical reference: [`docs/agents/RUNTIME_AGENTS.md`](../../../docs/agents/RUNTIME_AGENTS.md).

## Boundary

- External agent files instruct Codex, Claude Code, Cursor, Hermes, OpenCode, and similar tools
  working on the repo.
- Runtime agent files define agents that LLAAB itself runs.
- Do not put canonical runtime agent definitions directly in `AGENTS.md` or `.github/instructions/`.
  Add short pointers there instead.

## Locations

- Runtime-agent architecture and implementation rules: `docs/agents/`.
- Promoted runtime agent definitions: `knowledge/agents/`.
- Promoted runtime skills: `knowledge/skills/runtime/`.
- Mature skills for working on LLAAB itself: `knowledge/skills/development/`.
- Draft/generated agent and skill candidates: `vault/`.

## Rules

- Use `runtime agent` as the canonical term.
- Use `local agent`, `worker agent`, or `operator agent` only when location, role, or permission
  level matters.
- Follow the one-shot processor pattern; do not add always-on loops, watchers, or internal
  schedulers.
- Persist meaningful runtime-agent execution as `RunNode` traces.
- Runtime agents must write through LLAAB APIs/tools, not arbitrary filesystem mutation.
- Keep tool-specific external-agent instructions separate from LLAAB runtime agent definitions.
