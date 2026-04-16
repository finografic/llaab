# Agent Execution Rules

These rules apply to all agent, background, and automation features in LLAAB.
They are non-negotiable and must not be relaxed without explicit user approval.

## No always-on background processes

LLAAB does not run background agents, file watchers, or polling loops as part of normal
server operation. These patterns are banned:

- `chokidar` or any file system watcher triggering skill or LLM execution
- `setInterval` / `setTimeout` loops that repeatedly invoke skills or LLM calls
- Always-on server modes enabled by env vars (e.g. `AGENT_LOOP=true`)
- Polling the vault or any external resource on a timer

**Why:** Background processes drain power continuously — even when idle, the OS must
schedule them, and any filesystem event or timer fire can silently kick off expensive
LLM calls. The user explicitly chose explicit-over-automatic as a core principle.

## One-shot processor pattern

All agent/automation features use the **one-shot processor** pattern:

1. An explicit trigger arrives (CLI command, HTTP request, or external cron job)
2. The processor runs: scans for work, executes skills, persists traces
3. The processor exits

The trigger is always explicit. The processor always terminates. There is no idle loop.

## LLAAB does not own scheduling

If the user wants automation to run on a schedule, they add an OS crontab entry or use
an external scheduler. LLAAB provides the mechanism (`llaab agent run`, `POST /api/agent/run`);
the user controls the frequency. Never build an internal scheduler into `apps/server`.

## LLM calls follow the same rule

No background LLM calls. No pre-warming, no speculative generation, no ambient summarisation.
LLM calls happen when a user or an explicitly-triggered processor requests them.
Cache aggressively (already implemented in `@llaab/llm`) to avoid redundant calls.

## When proposing new features

Before proposing any automation, background job, or agent feature, check:

- Does it require a long-running process? → use one-shot + external trigger instead
- Does it react to filesystem events? → use explicit scan on demand instead
- Does it poll an external resource? → use on-demand fetch instead
- Does it run LLM calls in the background? → make it explicit and user-initiated
