import type { VaultNode } from './vault-browser.types';

export function collectVaultFilePaths(nodes: VaultNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === 'file') {
      out.push(node.path);
    } else if (node.children) {
      collectVaultFilePaths(node.children, out);
    }
  }
  return out;
}

/** Unique directory prefixes derived from file paths (parents before children). */
export function collectVaultDirectoryPaths(filePaths: readonly string[]): string[] {
  const dirs = new Set<string>();

  for (const filePath of filePaths) {
    const segments = filePath.split('/');
    let acc = '';
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      if (!segment) continue;
      acc = acc ? `${acc}/${segment}` : segment;
      dirs.add(acc);
    }
  }

  return Array.from(dirs).toSorted((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
}
