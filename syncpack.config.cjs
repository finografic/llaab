/** @type {import('syncpack').RcFile} */
module.exports = {
  versionGroups: [
    {
      // workspace:* links — not version-comparable
      dependencies: ['@llaab/*'],
      isIgnored: true,
    },
    {
      // link: local paths — not version-comparable
      dependencies: ['@finografic/*'],
      isIgnored: true,
    },
    {
      // "latest" tag — not version-comparable
      dependencies: ['@types/bun'],
      isIgnored: true,
    },
    {
      // Sync these critical packages across all packages
      dependencies: [
        '@modelcontextprotocol/sdk',
        '@types/node',
        '@types/react',
        '@types/react-dom',
        'hono',
        'oxfmt',
        'oxlint',
        'oxlint-tsgolint',
        'picocolors',
        'react',
        'react-dom',
        'tsdown',
        'typescript',
        'vitest',
        'zod',
      ],
      packages: ['**'],
    },
  ],
};
