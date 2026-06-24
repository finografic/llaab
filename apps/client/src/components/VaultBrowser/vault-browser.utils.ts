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
