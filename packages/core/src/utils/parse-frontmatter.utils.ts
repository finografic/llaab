// ─── Parsing ─────────────────────────────────────────────────────────────────

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface ParsedFrontmatter {
  frontmatter: Record<string, unknown>;
  body: string;
  filePath?: string;
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

function parseKeyValueLine(line: string): [string, unknown] | null {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return null;

  const key = line.slice(0, colonIndex).trim();
  const rawValue = line.slice(colonIndex + 1).trim();
  if (!key) return null;

  return [key, parseScalar(rawValue)];
}

function parseArrayObjectItem(firstLineValue: string, continuationLines: string[]): Record<string, unknown> {
  const item: Record<string, unknown> = {};

  const firstEntry = parseKeyValueLine(firstLineValue);
  if (firstEntry) {
    item[firstEntry[0]] = firstEntry[1];
  }

  for (const line of continuationLines) {
    const entry = parseKeyValueLine(line.trim());
    if (entry) {
      item[entry[0]] = entry[1];
    }
  }

  return item;
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

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? '';
    if (!line.trim()) {
      continue;
    }

    const arrayMatch = line.match(/^(\s+)-\s+(.*)$/);
    if (arrayMatch && currentKey) {
      currentArray ??= [];
      const itemIndent = arrayMatch[1]?.length ?? 0;
      const itemContent = arrayMatch[2] ?? '';

      if (itemContent.includes(':')) {
        const continuation: string[] = [];
        let nextIndex = lineIndex + 1;

        while (nextIndex < lines.length) {
          const nextLine = lines[nextIndex] ?? '';
          if (!nextLine.trim()) {
            nextIndex++;
            continue;
          }

          const nextArrayMatch = nextLine.match(/^(\s+)-\s+/);
          if (nextArrayMatch && (nextArrayMatch[1]?.length ?? 0) === itemIndent) {
            break;
          }

          const nextIndent = nextLine.match(/^(\s+)/)?.[1]?.length ?? 0;
          if (nextIndent > itemIndent && nextLine.includes(':')) {
            continuation.push(nextLine.trim());
            nextIndex++;
            continue;
          }

          break;
        }

        currentArray.push(parseArrayObjectItem(itemContent, continuation));
        lineIndex = nextIndex - 1;
        continue;
      }

      currentArray.push(parseScalar(itemContent));
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

export function parseFrontmatter(content: string, filePath?: string): ParsedFrontmatter {
  const match = FRONTMATTER_REGEX.exec(content);
  if (!match) {
    throw new Error('No frontmatter found in file');
  }

  return {
    frontmatter: parseYamlLike(match[1]),
    body: content.slice(match[0].length).trim(),
    filePath,
  };
}
