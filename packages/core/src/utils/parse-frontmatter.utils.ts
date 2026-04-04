const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface ParsedFrontmatter {
  frontmatter: Record<string, unknown>;
  body: string;
}

function parseScalar(rawValue: string): unknown {
  const trimmedValue = rawValue.trim();

  if (trimmedValue === 'true') return true;
  if (trimmedValue === 'false') return false;
  if (trimmedValue === 'null') return null;
  if (/^-?\d+$/.test(trimmedValue)) return Number.parseInt(trimmedValue, 10);
  if (/^-?\d+\.\d+$/.test(trimmedValue)) return Number.parseFloat(trimmedValue);

  if (
    (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
    (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmedValue);
    } catch {
      return trimmedValue.replace(/^['"]|['"]$/g, '');
    }
  }

  return trimmedValue.replace(/^['"]|['"]$/g, '');
}

function parseYamlLike(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentArray: unknown[] | null = null;

  const flushArray = (): void => {
    if (currentKey && currentArray) {
      result[currentKey] = currentArray;
    }
    currentKey = null;
    currentArray = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const arrayMatch = line.match(/^\s+-\s+(.*)$/);
    if (arrayMatch && currentKey) {
      currentArray ??= [];
      currentArray.push(parseScalar(arrayMatch[1]));
      continue;
    }

    flushArray();

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    const rawValue = line.slice(colonIndex + 1).trim();

    if (!rawValue) {
      currentKey = key;
      currentArray = [];
      continue;
    }

    result[key] = parseScalar(rawValue);
  }

  flushArray();
  return result;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = FRONTMATTER_REGEX.exec(content);
  if (!match) {
    throw new Error('No frontmatter found in file');
  }

  return {
    frontmatter: parseYamlLike(match[1]),
    body: content.slice(match[0].length).trim(),
  };
}
