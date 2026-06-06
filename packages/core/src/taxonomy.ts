/**
 * Taxonomy.ts — shared auto-tagging logic for the LLAAB vault.
 *
 * Tags use a single dimension prefix: `d:` (domain — what the content is about).
 *
 * Other dimensions are handled by dedicated frontmatter fields, NOT tags: • type → idea | transcript | source
 *
 * | skill | snippet (node kind) • status → seed | growing | mature (lifecycle) • origin → manual | youtube |
 *
 * Agent (scope/source)
 *
 * Regex right-side = broad catch-net that funnels into the tag on the left. Rules for regex terms: • Only
 * include words that _almost certainly_ mean this domain. • When in doubt, leave it out — missed auto-tags
 * are fixable; false positives erode trust in the system.
 *
 * Sub-tags: not used yet. When a domain accumulates 40+ nodes and finer filtering is needed, introduce
 * `d:llm-prompting` etc. (one level deep via hyphen, never nested hierarchies).
 */

export const AUTO_TAG_PATTERNS: Array<[string, RegExp]> = [
  [
    'd:llm',
    /\b(llm|gpt|claude|ollama|anthropic|prompt(?:ing)?|gemma|llama|mistral|qwen|phi|gemini|deepseek|open[ -]?weight|inference|fine[ -]?tun\w*|context[ -]?window|token|embedding)\b/i,
  ],
  [
    'd:automation',
    /\b(agent|autonomous|workflow|automation|pipeline|orchestrat\w*|harness|executor|adapter|command[ -]?bus)\b/i,
  ],
  ['d:ingest', /\b(ingest(?:ion)?|transcript|youtube|capture)\b/i],
  ['d:schema', /\b(schema|zod|validation)\b/i],
  ['d:infra', /\b(cli|terminal|bash|monorepo|ci[\s/]cd|launchd|swiftbar|turborepo|pnpm|bun)\b/i],
  ['d:integration', /\b(mcp|cursor|tauri|astro|obsidian|opencode|cline|codex|hermes)\b/i],
  ['d:ui', /\b(ui|frontend|component|layout|react|shadcn|tailwind|xterm)\b/i],
  ['d:meta', /\b(llaab|self-referential|meta)\b/i],
];

/**
 * Infer domain tags from title + optional body text. Returns a deduplicated array of `d:<domain>` strings.
 * Pass an empty string for body when only the title is available.
 */
export function autoTag(title: string, body: string): string[] {
  const text = `${title} ${body}`;
  const tags = AUTO_TAG_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
  return [...new Set(tags)];
}
