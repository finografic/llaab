/**
 * Commitlint — enforces **header shape** (type, optional scope, subject).
 *
 * What this does NOT enforce (use editor / Codex “commit instructions” or CI review):
 * - Bullet-only body vs prose paragraphs
 * - Banning shell commands in the body
 * - “Verification:” section style
 *
 * Commitizen is optional (interactive `git cz`); it does not replace Commitlint — different jobs.
 *
 * @type {import('@commitlint/types').UserConfig}
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Rule severity is always a number: 0 = off, 1 = warning, 2 = error (like ESLint, but not spelled "error").
    // The `2` here is severity — not a line count. Length limits are the last number in each rule tuple.

    // Overrides default type-enum: drops `perf`, adds `deps` (dependency-only bumps).
    'type-enum': [
      2,
      'always',
      ['build', 'chore', 'ci', 'deps', 'docs', 'feat', 'fix', 'refactor', 'revert', 'style', 'test'],
    ],
    // Scopes are optional; use for package or concern — e.g. `(agents)`, `(skills)`, `(web)`.
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 120],
  },
};
