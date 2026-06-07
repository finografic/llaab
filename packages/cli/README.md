# @llaab/cli

Command-line interface for LLAAB.

The CLI binary name is `lab`.

---

## Running During Development

From the repository root, run CLI commands through the root `dev:cli` script:

```bash
pnpm dev:cli -- <command>
```

Examples:

```bash
pnpm dev:cli -- doctor
pnpm dev:cli -- adapters list
pnpm dev:cli -- route extract
pnpm dev:cli -- vault list --type transcript
```

This runs the TypeScript source directly with Bun and does not require building or linking the
package.

---

## Built Binary

The package declares this binary:

```json
{
  "bin": {
    "lab": "./dist/index.js"
  }
}
```

Build the package with:

```bash
pnpm --filter @llaab/cli build
```

After the package is built and linked or installed onto your shell `PATH`, the short form is:

```bash
lab doctor
```

Until then, prefer the development form:

```bash
pnpm dev:cli -- doctor
```

---

## Commands

### `doctor`

Check provider availability and orchestration coverage.

```bash
pnpm dev:cli -- doctor
```

Reports:

- LLM provider availability
- executor availability
- covered and missing capabilities
- harness/control status
- registered command bus handlers

### `adapters list`

List registered LLM and executor adapters.

```bash
pnpm dev:cli -- adapters list
```

Filter by capability:

```bash
pnpm dev:cli -- adapters list --capability extract
pnpm dev:cli -- adapters list --capability code_edit
```

### `route <capability>`

Show providers that declare a capability.

```bash
pnpm dev:cli -- route extract
pnpm dev:cli -- route code_edit
```

Explain task routing through the LLM route map:

```bash
pnpm dev:cli -- route extract --explain
```

### `agent run`

Process unprocessed vault nodes through the skill registry once.

```bash
pnpm dev:cli -- agent run
```

Options:

```bash
pnpm dev:cli -- agent run --node <node-id>
pnpm dev:cli -- agent run --force
```

### `agent status`

Show agent loop status and last-run metadata.

```bash
pnpm dev:cli -- agent status
```

### `ingest <url>`

Ingest a YouTube video.

```bash
pnpm dev:cli -- ingest "https://www.youtube.com/watch?v=<VIDEO_ID>"
```

Options:

```bash
pnpm dev:cli -- ingest "<url>" --title "Custom title"
pnpm dev:cli -- ingest "<url>" --tags "d:llm,d:automation"
```

### `vault list`

List vault nodes.

```bash
pnpm dev:cli -- vault list
```

Options:

```bash
pnpm dev:cli -- vault list --type transcript
pnpm dev:cli -- vault list --status seed
pnpm dev:cli -- vault list --limit 20
```

### `mcp`

Start the LLAAB vault MCP server over stdio.

```bash
pnpm dev:cli -- mcp
```

This command stays alive until the MCP client terminates the stdio session.

---

## Browser Terminal Panel

The browser Terminal Panel is a typed command bus, not the primary place to run `lab ...` CLI
commands.

Use Terminal Panel commands such as:

```txt
ai.run extract "Summarize this note into three ideas"
agent.run --force
fs.list transcripts
shell.exec --enable-session --confirm
shell.exec --confirm node --version
shell.exec --disable-session
```
