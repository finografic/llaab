# Prettier — Astro Formatting Setup

📅 Jun 6, 2026

Prettier is used **exclusively for `.astro` files** in `apps/client`. All other file types
(`.ts`, `.tsx`, `.js`, `.css`, `.json`, etc.) are formatted by oxfmt via the OXC toolchain.

---

## ## Files

| File                                | Purpose                                          |
| ----------------------------------- | ------------------------------------------------ |
| `apps/client/prettier.config.ts`    | Prettier config with `prettier-plugin-astro`     |
| `apps/client/src/declarations.d.ts` | Ambient module declaration for untyped plugin    |
| `apps/client/oxfmt.config.ts`       | Excludes `**/*.astro` from oxfmt                 |
| `.vscode/settings.json`             | Wires VS Code to use the correct prettier binary |
| Root `package.json` `lint-staged`   | Runs `prettier --write` on staged `.astro` files |

---

## ## Config — `prettier.config.ts`

The config is TypeScript (Prettier 3.4+ supports `.ts` config files). It uses `satisfies Config`
for type safety instead of a JSDoc `@type` comment.

```ts
import * as prettierPluginAstro from 'prettier-plugin-astro';
import type { Config } from 'prettier';

export default {
  // ... options
  plugins: [prettierPluginAstro],
  overrides: [
    {
      files: ['*.astro'],
      options: { parser: 'astro', singleQuote: true },
    },
  ],
} satisfies Config;
```

**Why `import * as` (namespace import)?**
`prettier-plugin-astro` has no default export — it exports named members (`parsers`, `printers`,
etc.). Prettier accepts a plugin object that matches those named exports, so the namespace import
is the correct form. A default import (`import plugin from '...'`) fails at runtime.

**Why `src/declarations.d.ts`?**
The plugin ships no TypeScript declarations. The ambient module declaration suppresses TS7016
without weakening the rest of the config's type checking:

```ts
// prettier-plugin-astro ships no type declarations; bare ambient module types it as `any`
declare module 'prettier-plugin-astro';
```

---

## ## VS Code Setup

Three settings in [`.vscode/settings.json`](/.vscode/settings.json) are required:

```jsonc
// Point the extension at the project's prettier, not the global install.
// The global prettier is typically older and does not support .ts config files.
"prettier.prettierPath": "./node_modules/prettier/index.cjs",

// Explicit path is required in a monorepo — the extension does not reliably
// walk up from the file being formatted to find apps/client/prettier.config.ts.
"prettier.configPath": "apps/client/prettier.config.ts",

// Use the Prettier extension (not the Astro extension) for .astro files.
// The Astro VS Code extension has its own bundled prettier with default settings
// and does NOT read the project prettier config.
"[astro]": {
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

**Why not the Astro extension formatter?**
`astro-build.astro-vscode` bundles its own prettier instance with default settings. It ignores
`prettier.config.ts`, so it formats with double quotes and other prettier defaults regardless of
the project config.

**Why `prettier.prettierPath`?**
Without it, the VS Code Prettier extension resolves to the globally installed prettier
(`/usr/local/lib/node_modules/prettier`). The global version predates `.ts` config file support
and throws `Error: No loader specified for extension ".ts"`.

**Verifying it works** — open the Output panel (View → Output → Prettier). A working setup logs:

```
["INFO"] Using config file at /Users/.../LLAAB/apps/client/prettier.config.ts
["INFO"] Resolved config: { "singleQuote": true, ... }
```

---

## ## oxfmt Exclusion

`apps/client/oxfmt.config.ts` excludes `.astro` files so that running oxfmt directly
(e.g. `pnpm oxfmt .`) does not attempt to process them:

```ts
ignorePatterns: [...ignorePatterns, '**/*.astro'],
```

lint-staged already handles this separation via distinct glob patterns, but the ignore is
needed for manual and turbo-driven oxfmt runs.

---

## ## lint-staged

Staged `.astro` files are formatted by prettier at commit time. The pattern is scoped to
`apps/client` so prettier is never invoked on non-Astro workspaces:

```jsonc
// root package.json
"lint-staged": {
  "*.{ts,tsx,js,jsx,mjs,cjs}": ["oxfmt --no-error-on-unmatched-pattern", "oxlint --fix"],
  "apps/client/**/*.astro": ["prettier --write"]
}
```

---

## ## Dependencies

| Package                 | Location             | Notes                                                                          |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------ |
| `prettier`              | root devDep          | Must be at root; the VS Code extension resolves it via `prettier.prettierPath` |
| `prettier-plugin-astro` | `apps/client` devDep | Resolved from `apps/client/node_modules` via ESM import in the config          |
