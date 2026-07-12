function serializeFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.some((item) => typeof item === 'object' && item !== null)) return JSON.stringify(value);
    return `\n${value.map((item) => `  - ${String(item)}`).join('\n')}`;
  }

  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

export function markdownWithFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string,
  preferredKeyOrder: readonly string[] = [],
): string {
  const definedFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => value !== undefined),
  );
  const keys = [
    ...preferredKeyOrder.filter((key) => key in definedFrontmatter),
    ...Object.keys(definedFrontmatter)
      .filter((key) => !preferredKeyOrder.includes(key))
      .sort(),
  ];
  const frontmatterLines = keys.map((key) => `${key}: ${serializeFrontmatterValue(definedFrontmatter[key])}`);

  return ['---', ...frontmatterLines, '---', '', body].join('\n').trimEnd() + '\n';
}
