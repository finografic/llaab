# LLAAB — Project Setup Guide

> Initial setup steps for the LLAAB monorepo.
> Technologies: Bun, TypeScript, Turborepo, Zod, Astro, pnpm

---

## Prerequisites

Make sure these are installed before starting:

```bash
# Bun (runtime + package manager alternative)
curl -fsSL https://bun.sh/install | bash
bun --version  # confirm ≥ 1.x

# pnpm (monorepo package manager — Turborepo works best with pnpm)
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version  # confirm ≥ 9.x

# Node.js (still needed for some tooling)
node --version  # confirm ≥ 20.x
```

---

## Step 1 — Create the Monorepo Root

```bash
mkdir llaab && cd llaab
git init
pnpm init
```

Edit the root `package.json`:

```json
{
  "name": "llaab",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.32.1",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "format.check": "oxfmt --check",
    "format.fix": "oxfmt",
    "typecheck": "turbo typecheck",
    "test": "turbo test"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.9.3"
  }
}
```

---

## Step 2 — Configure pnpm Workspaces

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
```

---

## Step 3 — Configure Turborepo

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## Step 4 — TypeScript Base Config

Create `tsconfig.base.json` at the root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "exclude": ["node_modules", "dist"]
}
```

---

## Step 5 — Create Package: `@llaab/schemas`

This is the ubiquitous language — everything depends on it.

```bash
mkdir -p packages/schemas/src
```

`packages/schemas/package.json`:

```json
{
  "name": "@llaab/schemas",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  }
}
```

`packages/schemas/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Copy `schemas.ts` into `packages/schemas/src/index.ts`.

---

## Step 6 — Create Package: `@llaab/core`

Vault operations and utilities.

```bash
mkdir -p packages/core/src/utils
```

`packages/core/package.json`:

```json
{
  "name": "@llaab/core",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llaab/schemas": "workspace:*"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../schemas" }]
}
```

Place files:

- `create-node.utils.ts` → `packages/core/src/utils/`
- `list-nodes.utils.ts` → `packages/core/src/utils/`

Create `packages/core/src/index.ts`:

```typescript
export { createNode } from './utils/create-node.utils.js';
export { listNodes } from './utils/list-nodes.utils.js';
```

---

## Step 7 — Create Package: `@llaab/skills`

Composed workflows built on core utilities.

```bash
mkdir -p packages/skills/src
```

`packages/skills/package.json`:

```json
{
  "name": "@llaab/skills",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llaab/schemas": "workspace:*",
    "@llaab/core": "workspace:*"
  }
}
```

`packages/skills/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../schemas" }, { "path": "../core" }]
}
```

Place files:

- `capture-idea.ts` → `packages/skills/src/`
- `ingest-youtube.ts` → `packages/skills/src/`

---

## Step 8 — Create Package: `@llaab/cli`

The `llaab` command entry point.

```bash
mkdir -p packages/cli/src
```

`packages/cli/package.json`:

```json
{
  "name": "@llaab/cli",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "bin": {
    "llaab": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llaab/schemas": "workspace:*",
    "@llaab/core": "workspace:*",
    "@llaab/skills": "workspace:*"
  }
}
```

`packages/cli/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../schemas" }, { "path": "../core" }, { "path": "../skills" }]
}
```

Create a placeholder `packages/cli/src/index.ts`:

```typescript
#!/usr/bin/env node
console.log('🧪 LLAAB — Learning Loop & Agent Automation Base');
console.log('   Run `llaab --help` for commands.');
```

---

## Step 9 — Create the Vault Structure

The vault is data, not code — it lives outside `packages/`.

```bash
mkdir -p vault/{nodes/{ideas,decisions,prompts,instructions,resources},skills,transcripts,sources,runs}
mkdir -p lab
```

Create `vault/.gitkeep` files to preserve empty directories:

```bash
find vault -type d -empty -exec touch {}/.gitkeep \;
```

Create `lab/decisions.md`:

```markdown
# LLAAB — Architecture Decisions

Captured decisions during development. Each entry becomes a DecisionNode when the ingestion pipeline is ready.

---

## 001 — Monorepo with Turborepo + pnpm

- **Context**: Need multi-package structure with clean dependency boundaries
- **Decision**: Turborepo for task orchestration, pnpm workspaces for package management
- **Rationale**: Familiar tooling, fast builds, one-directional dependency flow
- **Date**: 2026-03-30
```

---

## Step 10 — Install Dependencies and Verify

```bash
# Install everything
pnpm install

# Verify the dependency graph
turbo build

# Should see:
#   @llaab/schemas → builds first
#   @llaab/core → builds second (depends on schemas)
#   @llaab/skills → builds third (depends on core + schemas)
#   @llaab/cli → builds last (depends on everything)
```

---

## Step 11 — Git Hooks and Formatting (with your existing tooling)

```bash
pnpm add -Dw simple-git-hooks lint-staged oxfmt @finografic/oxfmt-config
```

Add to root `package.json`:

```json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged --allow-empty && oxfmt --check && pnpm typecheck"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mjs,cjs}": ["eslint --fix", "oxfmt --no-error-on-unmatched-pattern"],
    "*.md": ["oxfmt --no-error-on-unmatched-pattern"],
    "*.{json,jsonc,yml,yaml,toml}": ["oxfmt --no-error-on-unmatched-pattern"]
  }
}
```

Then:

```bash
npx simple-git-hooks
```

---

## Step 12 — Astro Web Package (When Ready)

Not needed yet, but when you're ready for the UI:

```bash
cd packages
pnpm create astro@latest web -- --template minimal --typescript strict
```

Then update `packages/web/package.json` to add workspace dependencies:

```json
{
  "dependencies": {
    "@llaab/schemas": "workspace:*",
    "@llaab/core": "workspace:*"
  }
}
```

---

## Final File Tree

```
llaab/
├── package.json                # Root — workspaces, scripts, devDeps
├── pnpm-workspace.yaml         # Workspace definition
├── turbo.json                  # Task orchestration
├── tsconfig.base.json          # Shared TS config
├── oxfmt.config.ts             # Formatter config (your @finografic/oxfmt-config)
│
├── packages/
│   ├── schemas/                # @llaab/schemas — ubiquitous language
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   │
│   ├── core/                   # @llaab/core — vault operations
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── utils/
│   │       │   ├── create-node.utils.ts
│   │       │   ├── list-nodes.utils.ts
│   │       │   └── parse-frontmatter.utils.ts
│   │       └── index.ts
│   │
│   ├── skills/                 # @llaab/skills — composed workflows
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── capture-idea.ts
│   │       ├── ingest-youtube.ts
│   │       └── index.ts
│   │
│   ├── cli/                    # @llaab/cli — the `llaab` command
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   │
│   └── web/                    # (future — Astro + React)
│
├── vault/                      # Knowledge base (data, not code)
│   ├── INBOX.md
│   ├── nodes/
│   │   ├── ideas/
│   │   ├── decisions/
│   │   ├── prompts/
│   │   ├── instructions/
│   │   └── resources/
│   ├── skills/
│   ├── transcripts/
│   ├── sources/
│   └── runs/
│
├── lab/                        # Meta — the lab about itself
│   ├── decisions.md
│   ├── ideas.md
│   └── roadmap.md
│
└── plugins/                    # (future — optional integrations)
```

---

## Dependency Flow

```
schemas  ←  core  ←  skills  ←  cli
                                 ↑
                                web (future)
```

Nothing reaches backwards. Schemas is the root of everything.

---

## Next Steps

1. Run `turbo build` — verify the dependency chain compiles cleanly
2. Run `llaab idea "First idea from the live system"` — test the capture flow
3. Start `lab/decisions.md` — log every choice as you build
4. Ingest your first YouTube transcript — close the loop
