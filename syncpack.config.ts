import type { RcFile } from 'syncpack';

export default {
  semverGroups: [
    // Workspace protocol — exempt from semver range rules
    {
      label: 'Workspace protocol — ignored',
      specifierTypes: ['workspace-protocol'],
      isIgnored: true,
    },
    // Pinned exact — no range prefix
    {
      label: 'Exact pins — no range',
      dependencies: ['typescript', '@types/node', '@types/bun'],
      range: '',
    },
    // @types/bun — only present in root + server; ignore cross-package sync
    // (it is a bun-runtime type, not a universal Node dep)
    // Everything else — caret range
    {
      label: 'Default — caret range',
      dependencies: ['**'],
      range: '^',
    },
  ],

  versionGroups: [
    // Internal workspace packages — always workspace:*, never flag
    {
      label: 'Local workspace packages — ignored',
      dependencies: ['@llaab/*'],
      isIgnored: true,
    },
    // @types/bun — runtime-specific, only root + server; skip cross-package sync
    {
      label: '@types/bun — ignored',
      dependencies: ['@types/bun'],
      isIgnored: true,
    },
    // TypeScript — hard-pinned across the entire monorepo
    {
      label: 'TypeScript — pinned',
      dependencies: ['typescript'],
      pinVersion: '6.0.3',
    },
    // Node types — exact pin, same version everywhere
    {
      label: 'Node.js types — same version',
      dependencies: ['@types/node'],
      policy: 'sameRange',
    },
    // React runtime
    {
      label: 'React — same range',
      dependencies: ['react', 'react-dom'],
      policy: 'sameRange',
    },
    // React types
    {
      label: 'React types — same range',
      dependencies: ['@types/react', '@types/react-dom'],
      policy: 'sameRange',
    },
    // Zod — shared schema primitive
    {
      label: 'Zod — same range',
      dependencies: ['zod'],
      policy: 'sameRange',
    },
    // Hono
    {
      label: 'Hono — same range',
      dependencies: ['hono', '@hono/*'],
      policy: 'sameRange',
    },
    // Tailwind ecosystem
    {
      label: 'Tailwind ecosystem — same range',
      dependencies: ['tailwindcss', '@tailwindcss/vite', 'tailwind-merge', 'tw-animate-css'],
      policy: 'sameRange',
    },
    // shadcn/ui component ecosystem
    {
      label: 'shadcn/ui ecosystem — same range',
      dependencies: [
        'shadcn',
        'class-variance-authority',
        'clsx',
        'radix-ui',
        'lucide-react',
        '@fontsource-variable/*',
      ],
      policy: 'sameRange',
    },
    // @finografic internal tooling
    {
      label: 'Finografic packages — same range',
      dependencies: ['@finografic/*'],
      policy: 'sameRange',
    },
    // OXC toolchain
    {
      label: 'OXC toolchain — same range',
      dependencies: ['oxfmt', 'oxlint', 'oxlint-tsgolint'],
      policy: 'sameRange',
    },
    // Prettier
    {
      label: 'Prettier — same range',
      dependencies: ['prettier'],
      policy: 'sameRange',
    },
  ],
} satisfies RcFile;
