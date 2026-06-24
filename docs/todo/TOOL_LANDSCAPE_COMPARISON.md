# LLAAB — External Tool Landscape: Comparison and Integration Analysis

> **Purpose:** Categorize, compare, and evaluate integration potential for external tools
> alongside LLAAB's existing architecture.
> **Generated:** 2026-06-09 · **Updated:** 2026-06-24 (LM Studio integrated, Graphify active, OpenCode account live)

---

## Categories

These tools fall into four distinct layers. Comparing across layers creates confusion
(glossary principle: "agent tool layering"). Compare within layers, then evaluate integration
points between layers and LLAAB.

| Layer                                          | What it does                                                         | Tools              |
| ---------------------------------------------- | -------------------------------------------------------------------- | ------------------ |
| **Layer 1 — Inference Runtime**                | Runs LLM weights on local hardware                                   | Ollama, LM Studio  |
| **Layer 2 — Coding Agent**                     | Uses an LLM to read, edit, and execute code                          | Cline, OpenCode    |
| **Layer 3 — General-Purpose Autonomous Agent** | Persistent memory, skills, multi-agent orchestration, cross-platform | Hermes, Agent Zero |
| **Layer 0 — Context Layer**                    | Pre-computes structural context so agents consume fewer tokens       | Graphify           |

Layer 0 sits _underneath_ the others — it produces the context that agents at Layers 2 and 3
consume. It is not an agent itself; it is the map that makes agents smarter.

LLAAB itself is none of these — it is a **knowledge management and orchestration platform**
that sits alongside and above these layers, consuming inference from Layer 1, potentially
delegating coding tasks to Layer 2, sharing architectural patterns with Layer 3, and
potentially using Layer 0 to make all of them more context-efficient.

---

## Layer 1 — Inference Runtimes: Ollama vs LM Studio

Both run the same open-weight models (Llama, Gemma, Qwen, Mistral, etc.) on local hardware.
Both use llama.cpp under the hood. The differences are in interface philosophy and operational
model.

### Comparison

| Dimension             | Ollama                                                      | LM Studio                                                                                                |
| --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Interface**         | CLI-first + REST API; no GUI                                | GUI-first + CLI (`lms`) + API + headless daemon (`llmster`)                                              |
| **API**               | Ollama-native (`/api/chat`, `/api/generate`)                | OpenAI-compatible (`/v1/chat/completions` on `:1234`)                                                    |
| **macOS backend**     | llama.cpp (Metal)                                           | MLX (Apple Silicon) — 30–50% faster than llama.cpp on Metal                                              |
| **Model management**  | `ollama pull model:tag`                                     | Visual Hugging Face browser with RAM/VRAM estimates                                                      |
| **Concurrency**       | Handles concurrent requests                                 | Sequential by default (second request waits)                                                             |
| **Startup**           | Background service, always listening                        | App or headless daemon; must be explicitly started                                                       |
| **SDK**               | npm `ollama` package                                        | `@lmstudio/sdk` (JS), `lmstudio` (Python)                                                                |
| **MCP**               | Not an MCP client                                           | MCP client support (can connect to MCP servers)                                                          |
| **License**           | MIT                                                         | Free personal use; commercial tier for enterprise                                                        |
| **LLAAB integration** | Already integrated — `packages/llm/src/providers/ollama.ts` | Integrated — `packages/llm/src/providers/lmstudio.ts`; MLX models downloaded (Gemma 4 E4B + 26B A4B QAT) |

### LM Studio integration status

**Integrated.** `lmstudioProvider` is a first-class `LlmProvider` in `packages/llm`. The
`/api/llm/status` endpoint returns provider-qualified model lists from both Ollama and LM
Studio. Routing updates persist `provider: "lmstudio"` and actual calls route to LM Studio's
OpenAI-compatible API at `http://localhost:1234/v1`.

**Installed models (MLX):**

- Gemma 4 E4B Instruct 4bit (6.86 GB) — workhorse extraction model
- Gemma 4 26B A4B QAT 4bit (15.64 GB) — heavier reasoning tasks

**Configuration:**

- Headless LLM service (`llmster`) enabled for background operation
- Context length: 32768 tokens
- Max idle TTL: 120 minutes
- Temperature: 0.3 (tuned for structured JSON extraction output)
- Max concurrent: 4 (E4B) or 1 (26B)
- Server port: 1234 (no conflict with Ollama on 11434)

**Operational note:** LM Studio must be running with a model loaded before LLAAB routes calls
to it. Unlike Ollama (which auto-loads models on first request), LM Studio requires explicit
model loading via GUI or `lms` CLI. The `isAvailable()` check on the provider handles graceful
fallback when LM Studio isn't running.

---

## Layer 2 — Coding Agents: Cline vs OpenCode

Both are AI coding agents that read your codebase, edit files, run terminal commands, and
iterate until tests pass. The key difference is where they live.

### Comparison

| Dimension             | Cline                                                            | OpenCode                                                                                           |
| --------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Interface**         | IDE extension (VS Code, JetBrains, Cursor, Windsurf) + CLI + SDK | Terminal TUI (Go) + desktop app + IDE extension                                                    |
| **Primary paradigm**  | IDE-native — inline diffs, selection-aware context               | Terminal-first — operates on files, not editor buffers                                             |
| **Plan/Act modes**    | Yes — Plan mode is non-destructive reasoning, Act mode executes  | Yes — Plan mode (read-only), Build mode (full access)                                              |
| **Model support**     | 30+ providers, BYOK, local via Ollama/LM Studio                  | 75+ providers, BYOK, local via Ollama/LM Studio                                                    |
| **MCP**               | MCP client (connects to MCP servers for tools)                   | MCP client + custom commands via markdown                                                          |
| **Multi-agent**       | Kanban board — coordinator delegates to specialists              | Multi-session — run parallel agents on the same project                                            |
| **LSP**               | Relies on IDE's built-in LSP                                     | Built-in LSP integration (18+ languages) — feeds diagnostics back to model                         |
| **Human-in-the-loop** | Every file edit and command requires approval                    | Approval by default; auto-approve mode available                                                   |
| **Stars**             | 61K+ GitHub                                                      | 160K+ GitHub                                                                                       |
| **Language**          | TypeScript                                                       | Go                                                                                                 |
| **LLAAB relevance**   | Already in `.mcp.json` as an MCP server entry                    | Test account active; API key in `.env` as `OPENCODE_API_KEY`; `OpenCodeAdapter` target for Phase 9 |

### How they integrate with LLAAB

Both Cline and OpenCode are **consumers of LLAAB's MCP server** — LLAAB already exposes
`vault_list` and `vault_read` tools via `llaab mcp`. A coding agent connecting to LLAAB's MCP
server can read vault nodes, understand the project's knowledge graph, and use that context
when making code changes.

The integration surface from the orchestration plan (Phase 9) is:

```
LLAAB prepares a context bundle (vault nodes + task + constraints)
  → dispatches to an external coding agent (Cline or OpenCode)
  → coding agent executes changes in the codebase
  → LLAAB logs the result as a RunNode
```

**Cline integration path:** Cline's SDK (`@anthropic-ai/cline-sdk` or programmatic API) allows
headless invocation from Node.js. LLAAB could call Cline programmatically with a prepared
context bundle, a task description, and a `.clinerules` file that teaches Cline LLAAB's coding
conventions.

**OpenCode integration path:** OpenCode's non-interactive mode
(`opencode -p "task description" -f json`) makes it trivially scriptable from LLAAB's Bun
server. The JSON output format is parseable. OpenCode's LSP integration means it gets richer
code intelligence than Cline for TypeScript-heavy projects like LLAAB.

**Recommendation:** OpenCode is the better fit for LLAAB because:

1. Terminal-first matches LLAAB's architecture (no VS Code dependency)
2. Non-interactive mode (`-p`) is directly scriptable from `packages/cli` or the server
3. LSP feedback produces more thorough TypeScript edits
4. The orchestration plan already names `OpenCodeAdapter` as a Phase 9 target
5. Go binary with no runtime dependencies — easy to `which opencode` for availability checks

Cline remains useful as a _manual_ tool for you (the developer) working on LLAAB in VS Code —
it just wouldn't be the programmatic adapter target.

---

## Layer 3 — General-Purpose Autonomous Agents: Hermes vs Agent Zero

These are fundamentally different from coding agents. They are persistent, self-improving
agents that run on a server, remember across sessions, create and refine skills, and can be
reached from Telegram, Discord, Slack, or a desktop app. They are closer to what LLAAB
_aspires to be_ than to what LLAAB _consumes_.

### Comparison

| Dimension           | Hermes (Nous Research)                                                   | Agent Zero                                                                   |
| ------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Core philosophy** | Self-improving agent with a closed learning loop                         | Fully autonomous OS-level agent in Docker                                    |
| **Memory**          | SQLite FTS + LLM summarization; cross-session; persistent                | Hybrid memory — facts, solutions, behavioral adjustments; auto-consolidation |
| **Skills**          | Creates skills from experience (Markdown files); 90K+ community skills   | Plugin system with community index; AI-driven security scans                 |
| **Learning loop**   | Yes — evaluates outcomes, extracts patterns, reuses on similar tasks     | Yes — adapts and grows organically from interactions                         |
| **Multi-agent**     | Subagent delegation with isolated context; Kanban orchestration          | Subordinate agent spawning in isolated Docker containers                     |
| **Execution**       | Code execution via `execute_code` tool; sandboxed RPC                    | Full OS access inside Docker — installs software, runs commands              |
| **Messaging**       | 17 platforms: Telegram, Discord, Slack, WhatsApp, Signal, iMessage, etc. | Web UI + Docker terminal                                                     |
| **Model support**   | 300+ via Nous Portal/OpenRouter; any endpoint                            | Any via OpenAI API, Anthropic, Ollama, etc.                                  |
| **MCP**             | MCP client AND server (can expose itself to other tools)                 | MCP server support (streamable HTTP)                                         |
| **Browser**         | Multiple backends: Browserbase, Browser Use, local Chrome/CDP            | Integrated browser + private SearXNG search                                  |
| **Desktop app**     | Yes — native macOS/Windows/Linux (public preview, June 2026)             | Web UI accessible via browser                                                |
| **Stars**           | 188K GitHub (fastest-growing agent framework of 2026)                    | 15K GitHub                                                                   |
| **Backing**         | Nous Research (the lab behind Hermes models, Psyche training network)    | Agent Zero s.r.o. (Czech company) + crypto token (A0T)                       |
| **License**         | MIT                                                                      | Open source                                                                  |

### How they relate to LLAAB

This is where it gets interesting. **LLAAB and Hermes share deep architectural DNA:**

| LLAAB concept                  | Hermes equivalent                                |
| ------------------------------ | ------------------------------------------------ |
| Vault nodes (Markdown)         | Skills (Markdown files)                          |
| Skill registry                 | Skills Hub (90K+ community skills)               |
| RunNode (execution trace)      | Trajectory export (ShareGPT format)              |
| `autoTag` + LLM-extracted tags | Auto-created skill metadata                      |
| `control.execute()` governance | Prompt injection scanning + credential filtering |
| One-shot agent loop            | Persistent agent loop with evaluation            |
| `@finografic/ai-harness` prep  | Context window management                        |
| Human-in-the-loop              | Approval workflows across messaging platforms    |

The key difference: **LLAAB is the vault; Hermes is the agent.** LLAAB captures, structures,
and governs knowledge. Hermes acts on knowledge, learns from outcomes, and gets more capable
over time. They are complementary, not competing.

### Integration possibilities

**Hermes as a LLAAB consumer (via MCP):**
Hermes is an MCP client. LLAAB already has an MCP server (`llaab mcp`). Connecting them means
Hermes could read LLAAB vault nodes, query the knowledge graph, and use LLAAB's structured
knowledge as context for its tasks. This is the lightest integration — zero code changes to
either project.

**LLAAB as a Hermes skill:**
A Hermes skill could wrap LLAAB's ingestion pipeline: "Ingest this YouTube URL into LLAAB"
becomes a Hermes command that calls `POST /api/ingest/youtube`. The skill file is Markdown —
fits LLAAB's vault philosophy.

**Hermes trajectory export → LLAAB vault:**
Hermes exports execution trajectories in ShareGPT format. A LLAAB ingestion adapter could
import these as RunNodes, making Hermes execution traces queryable in the vault.

**Shared skill format:**
Both use Markdown files for skills. A future bridge could synchronize skill definitions between
LLAAB's skill registry and Hermes's Skills Hub, though the schemas would need alignment.

**Agent Zero** serves a different niche — it's more about autonomous OS-level execution in a
sandboxed Docker environment. Its integration with LLAAB would be similar to Hermes (MCP
server connection, API calls), but Hermes is the stronger candidate because of:

- Hermes's MCP client/server support is more mature
- Hermes's MIT license is cleaner (no crypto token governance)
- Hermes has Nous Research (a serious ML lab) behind it
- Hermes's skill format (Markdown) aligns with LLAAB's vault

Agent Zero's Docker sandbox model is interesting if you wanted LLAAB to delegate untrusted
execution to an isolated environment, but that's a more complex integration with less
immediate payoff.

---

## Layer 0 — Context Layer: Graphify

Graphify is not an agent, an inference runtime, or a coding tool. It is a **knowledge graph
builder** that converts a folder of code, docs, PDFs, images, and Markdown into a queryable
graph of entities, relationships, and communities. Agents then navigate the graph instead of
re-reading files from scratch on every session.

### What it actually does

Graphify runs a three-pass pipeline:

1. **AST extraction (local, no LLM):** Tree-sitter parses 33 languages and extracts every
   function, class, import, call graph, and docstring. Source code never leaves your machine.
2. **Graph construction:** Extracted entities become nodes; relationships become edges in a
   NetworkX graph. Leiden community detection surfaces clusters. God-nodes (highest
   betweenness-centrality) identify the files/functions that connect the most communities.
3. **Semantic enrichment (optional, uses your LLM):** An LLM call adds semantic descriptions,
   confidence tags (`EXTRACTED`, `INFERRED`, `AMBIGUOUS`), and design rationale. This is the
   only step that makes an API call — using your own configured key.

Output: three files in `graphify-out/`:

- `graph.html` — interactive browser visualization
- `GRAPH_REPORT.md` — human-readable highlights (god-nodes, surprising connections, suggested
  questions)
- `graph.json` — full graph, queryable without re-reading source files

Incremental updates patch only changed files — a 3-file change updates in ~0.8 seconds on a
500K-node graph, versus a full RAG rebuild that would re-embed everything.

### The token claim — reality check

The headline is "71.5x fewer tokens per query." The reality: that's the best-case comparison
between a cold-start grep session (reading dozens of files to orient) versus a pre-built graph
query. Per-call, the actual savings are closer to 2x (292 tokens vs 550 tokens per lookup).
The big win is eliminating the session-start orientation cost — the 20K+ tokens an agent
typically burns just figuring out the architecture before writing a single line of code.

For a codebase LLAAB's size (~350 files), the savings are real but modest. Your existing
`handoff.md` + `AGENTS.md` + `ROADMAP.md` pattern already solves most of the orientation
problem manually. Graphify automates it. For larger codebases (1000+ files), the value
compounds significantly.

### Platform support

Graphify installs as a skill/hook into most major coding agents:

| Platform     | Install command                                                               |
| ------------ | ----------------------------------------------------------------------------- |
| Claude Code  | `graphify claude install` (writes `CLAUDE.md` + PreToolUse hook)              |
| OpenCode     | `graphify opencode install` (writes `AGENTS.md` + tool.execute.before plugin) |
| Codex        | `graphify codex install`                                                      |
| Cursor       | `graphify cursor install`                                                     |
| Cline / Kilo | `graphify kilo install`                                                       |
| Standalone   | `graphify extract ./path`                                                     |

### Three LLAAB integration surfaces

#### 1. Graphify on external projects (highest immediate value)

For any project you work on outside LLAAB — client work, side projects, larger codebases —
Graphify is a straightforward win. Run `graphify extract ./src`, hand the `GRAPH_REPORT.md`
to your coding agent (Claude Code, OpenCode, Cline), and the agent starts with architectural
understanding instead of blind grep. Install: `pip install graphifyy && graphify install`.

#### 2. Graphify on the LLAAB codebase (done — active)

Graphify has been run on the LLAAB monorepo (excluding vault). Results:

- **8,433 nodes, 19,726 edges, 413 communities**
- `GRAPH_REPORT.md` generated with god-nodes, community map, and suggested questions
- Post-commit and post-checkout git hooks installed — graph updates incrementally on every commit
- `graphify-out/` is gitignored (build artifact, not source)
- Hooks for Claude Code, Codex, and Cursor installed — agents automatically consult the graph
- Semantic enrichment runs through local LM Studio (Gemma 4 E4B MLX), zero API cost

#### 3. Graphify on LLAAB's vault (most architecturally interesting)

This is the angle that overlaps with the "Karpathy Pattern — Vault Graph Integration" item
on the ROADMAP P3 backlog. Graphify can parse Markdown files. LLAAB's vault is entirely
Markdown with YAML frontmatter. Running `graphify extract ./vault` would produce a knowledge
graph of transcript nodes, idea nodes, source nodes, and their `related`, `source_id`, and
`extracted_idea_ids` links.

This could serve as a shortcut to the vault graph visualization without building a custom
React island. The graph would show which transcripts produced which ideas, which sources are
most prolific, and which ideas are orphaned. Confidence tagging would distinguish LLAAB's
structural links (extracted from frontmatter) from semantic similarities Graphify infers.

Potential approach: run `graphify extract ./vault` → render `graph.html` in an iframe on a
vault overview page → link to `GRAPH_REPORT.md` for god-node analysis.

### What Graphify does NOT do

- It is not an agent — it does not execute tasks, edit code, or make decisions
- It does not replace `AGENTS.md` or `handoff.md` — it automates part of what they provide
- It does not provide real-time context during execution — it pre-computes a static graph
  that agents query
- The "100% local" claim is true for AST parsing but not for semantic enrichment (that step
  calls your configured LLM)
- Incremental updates are fast but not instantaneous — large refactors may benefit from
  `--force` full rebuilds

---

## Summary Matrix

| Tool           | Layer            | LLAAB relationship                                                                     | Integration effort              | Status           |
| -------------- | ---------------- | -------------------------------------------------------------------------------------- | ------------------------------- | ---------------- |
| **Graphify**   | Context          | Codebase graph active; git hooks installed; agent hooks for Claude Code, Codex, Cursor | Done                            | ✅ Active        |
| **Ollama**     | Inference        | Integrated as `ollamaProvider`                                                         | Done                            | ✅ Active        |
| **LM Studio**  | Inference        | Integrated as `lmstudioProvider`; MLX Gemma 4 models downloaded                        | Done                            | ✅ Active        |
| **OpenCode**   | Coding agent     | Test account active; API key in `.env`; future `OpenCodeAdapter`                       | Medium (shell-out + JSON parse) | 🟡 Account ready |
| **Cline**      | Coding agent     | Manual dev tool; lower priority as programmatic adapter                                | Medium (SDK or MCP)             | 🔵 Available     |
| **Hermes**     | Autonomous agent | MCP-based knowledge consumer; potential skill bridge                                   | Low (MCP connection)            | ⚪ Not started   |
| **Agent Zero** | Autonomous agent | Docker-sandboxed execution; similar MCP path                                           | Medium                          | ⚪ Not started   |

---

## Recommended Order of Integration

1. ~~**Graphify (external projects)**~~ — ✅ Done.
2. ~~**Ollama**~~ — ✅ Done.
3. ~~**Graphify (LLAAB codebase)**~~ — ✅ Done. Graph built (8,433 nodes), git hooks active,
   agent hooks installed for Claude Code, Codex, and Cursor.
4. ~~**LM Studio**~~ — ✅ Done. `lmstudioProvider` integrated. Gemma 4 E4B (MLX) and 26B A4B
   QAT (MLX) downloaded. Headless service enabled. Server on port 1234.
5. **Graphify (vault)** — run `graphify extract ./vault` and evaluate the output as a shortcut
   to the Karpathy graph visualization on the ROADMAP P3 backlog. Use the E4B model with
   max concurrent 1 or 2.
6. **OpenCode** — test account active, API key in `.env`. Next step: manual experimentation
   on a real LLAAB coding task to evaluate speed, quality, and cost. Implement
   `OpenCodeAdapter` per Phase 9 when the command bus and capability routing are stable.
7. **Hermes** — connect via MCP as an experiment. Zero code changes; just configure Hermes to
   connect to `llaab mcp`. Evaluate whether vault-as-context makes Hermes meaningfully better
   at tasks.
8. **Cline** — use manually in VS Code for LLAAB development; defer programmatic integration
   unless OpenCode proves insufficient.
9. **Agent Zero** — lowest priority; evaluate only if Docker-sandboxed execution becomes a
   real requirement.

---

## Design rules for external tool integration (from TODO_ORCHESTRATION_V5)

- External coding adapters receive a prepared context bundle and task, not vague raw prompts.
- External coding adapters do not write directly to vault memory unless routed through
  LLAAB APIs.
- Cloud or paid adapters must log provider, model, duration, and fallback reason.
- Expensive or high-risk adapter calls should support explicit human confirmation.
- Do not make external executors default before local LLM, harness, command bus, and
  RunNode tracing are stable.
