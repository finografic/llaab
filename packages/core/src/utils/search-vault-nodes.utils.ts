import { NodeTypeSchema } from '@llaab/schemas';
import type { LabNode, NodeStatus, NodeType } from '@llaab/schemas';

import { listNodes } from './list-nodes.utils.js';
import { getNodeFilePath } from './node-file.utils.js';

export type VaultSearchMatchField = 'title' | 'tag' | 'body';

export interface VaultSearchQuery {
  query: string;
  type?: NodeType;
  status?: NodeStatus;
  tags?: string[];
  limit?: number;
}

export interface VaultSearchMatch {
  field: VaultSearchMatchField;
  value?: string;
}

export interface VaultSearchResult {
  node: LabNode;
  node_id: string;
  node_type: NodeType;
  title: string;
  status: NodeStatus;
  tags: string[];
  path: string;
  score: number;
  snippet: string;
  matches: VaultSearchMatch[];
  provenance: {
    node_id: string;
    node_type: NodeType;
    path: string;
  };
}

export type VaultContextKind = 'direct-source' | 'derived-summary' | 'operational' | 'execution-history';

export interface VaultContextPacket {
  id: string;
  kind: VaultContextKind;
  node_id: string;
  node_type: NodeType;
  title: string;
  path: string;
  score: number;
  reason: string;
  content: string;
  snippet: string;
  matches: VaultSearchMatch[];
  char_count: number;
  provenance: VaultSearchResult['provenance'];
}

export interface VaultContextAssemblyOptions {
  maxPackets?: number;
  maxCharacters?: number;
  maxCharactersPerPacket?: number;
}

interface RankedNode {
  node: LabNode;
  score: number;
  snippet: string;
  matches: VaultSearchMatch[];
}

const TITLE_MATCH_SCORE = 100;
const TAG_MATCH_SCORE = 60;
const BODY_MATCH_SCORE = 20;
const EXACT_TITLE_BONUS = 40;
const SNIPPET_RADIUS = 90;
const DEFAULT_CONTEXT_PACKET_LIMIT = 10;
const DEFAULT_CONTEXT_CHARACTER_LIMIT = 6000;
const DEFAULT_CONTEXT_PACKET_CHARACTER_LIMIT = 1200;

export async function searchVaultNodes(query: VaultSearchQuery): Promise<VaultSearchResult[]> {
  const nodes = await listSearchableNodes(query);
  return rankVaultSearchNodes(nodes, query);
}

export function rankVaultSearchNodes(nodes: LabNode[], query: VaultSearchQuery): VaultSearchResult[] {
  const searchTerms = tokenizeSearchQuery(query.query);
  if (searchTerms.length === 0) return [];

  return nodes
    .filter((node) => matchesNodeFilters(node, query))
    .map((node) => rankNode(node, searchTerms, query.query))
    .filter((entry): entry is RankedNode => entry !== null)
    .sort(compareRankedNodes)
    .slice(0, query.limit ?? Number.POSITIVE_INFINITY)
    .map(toVaultSearchResult);
}

export function buildVaultContextPackets(
  results: VaultSearchResult[],
  options: VaultContextAssemblyOptions = {},
): VaultContextPacket[] {
  const maxPackets = options.maxPackets ?? DEFAULT_CONTEXT_PACKET_LIMIT;
  const maxCharacters = options.maxCharacters ?? DEFAULT_CONTEXT_CHARACTER_LIMIT;
  const maxCharactersPerPacket = options.maxCharactersPerPacket ?? DEFAULT_CONTEXT_PACKET_CHARACTER_LIMIT;
  const packets: VaultContextPacket[] = [];
  let usedCharacters = 0;

  for (const result of results) {
    if (packets.length >= maxPackets) break;
    if (usedCharacters >= maxCharacters) break;

    const remainingCharacters = maxCharacters - usedCharacters;
    const contentLimit = Math.min(maxCharactersPerPacket, remainingCharacters);
    const content = truncateContextContent(result.snippet || result.node.body || result.title, contentLimit);
    if (!content) continue;

    const packet: VaultContextPacket = {
      char_count: content.length,
      content,
      id: `${result.node_type}:${result.node_id}`,
      kind: inferContextKind(result.node_type),
      matches: result.matches,
      node_id: result.node_id,
      node_type: result.node_type,
      path: result.path,
      provenance: result.provenance,
      reason: describeContextReason(result),
      score: result.score,
      snippet: result.snippet,
      title: result.title,
    };

    packets.push(packet);
    usedCharacters += packet.char_count;
  }

  return packets;
}

function tokenizeSearchQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 0),
    ),
  );
}

async function listSearchableNodes(query: VaultSearchQuery): Promise<LabNode[]> {
  if (query.type) {
    return listNodes({ status: query.status, tags: query.tags, type: query.type });
  }

  const byType = await Promise.all(
    NodeTypeSchema.options.map((type) => listNodes({ status: query.status, tags: query.tags, type })),
  );

  return byType.flat();
}

function matchesNodeFilters(node: LabNode, query: VaultSearchQuery): boolean {
  if (query.type && node.type !== query.type) return false;
  if (query.status && node.status !== query.status) return false;
  if (query.tags?.length && !query.tags.some((tag) => node.tags.includes(tag))) return false;
  return true;
}

function rankNode(node: LabNode, searchTerms: string[], rawQuery: string): RankedNode | null {
  const title = node.title.toLowerCase();
  const body = node.body.toLowerCase();
  const matches: VaultSearchMatch[] = [];
  let score = 0;

  for (const term of searchTerms) {
    if (title.includes(term)) {
      score += TITLE_MATCH_SCORE;
      addMatch(matches, { field: 'title', value: node.title });
    }

    for (const tag of node.tags) {
      if (tag.toLowerCase().includes(term)) {
        score += TAG_MATCH_SCORE;
        addMatch(matches, { field: 'tag', value: tag });
      }
    }

    if (body.includes(term)) {
      score += BODY_MATCH_SCORE;
      addMatch(matches, { field: 'body' });
    }
  }

  if (score === 0) return null;

  if (title === rawQuery.trim().toLowerCase()) {
    score += EXACT_TITLE_BONUS;
  }

  return {
    matches,
    node,
    score,
    snippet: buildSnippet(node, searchTerms),
  };
}

function addMatch(matches: VaultSearchMatch[], next: VaultSearchMatch): void {
  if (matches.some((match) => match.field === next.field && match.value === next.value)) return;
  matches.push(next);
}

function buildSnippet(node: LabNode, searchTerms: string[]): string {
  const compactBody = node.body.replace(/\s+/g, ' ').trim();
  if (compactBody.length === 0) return node.title;

  const lowerBody = compactBody.toLowerCase();
  const hitIndex = searchTerms
    .map((term) => lowerBody.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (hitIndex === undefined) return node.title;

  const start = Math.max(0, hitIndex - SNIPPET_RADIUS);
  const end = Math.min(compactBody.length, hitIndex + SNIPPET_RADIUS);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < compactBody.length ? '...' : '';

  return `${prefix}${compactBody.slice(start, end)}${suffix}`;
}

function compareRankedNodes(a: RankedNode, b: RankedNode): number {
  const scoreDelta = b.score - a.score;
  if (scoreDelta !== 0) return scoreDelta;

  const recencyDelta = getNodeTimestamp(b.node) - getNodeTimestamp(a.node);
  if (recencyDelta !== 0) return recencyDelta;

  const titleDelta = a.node.title.localeCompare(b.node.title);
  if (titleDelta !== 0) return titleDelta;

  return a.node.id.localeCompare(b.node.id);
}

function getNodeTimestamp(node: LabNode): number {
  return Date.parse(node.updated_at ?? node.created_at);
}

function toVaultSearchResult(entry: RankedNode): VaultSearchResult {
  const path = getNodeFilePath(entry.node.type, entry.node.id);

  return {
    matches: entry.matches,
    node: entry.node,
    node_id: entry.node.id,
    node_type: entry.node.type,
    path,
    provenance: {
      node_id: entry.node.id,
      node_type: entry.node.type,
      path,
    },
    score: entry.score,
    snippet: entry.snippet,
    status: entry.node.status,
    tags: entry.node.tags,
    title: entry.node.title,
  };
}

function inferContextKind(nodeType: NodeType): VaultContextKind {
  switch (nodeType) {
    case 'transcript':
    case 'source':
    case 'resource':
      return 'direct-source';
    case 'instruction':
    case 'prompt':
    case 'skill':
      return 'operational';
    case 'decision':
    case 'run':
      return 'execution-history';
    case 'canonical-idea':
    case 'idea':
    case 'wiki-candidate':
    case 'wiki-draft':
      return 'derived-summary';
  }
}

function describeContextReason(result: VaultSearchResult): string {
  const fields = result.matches.map((match) => (match.value ? `${match.field}:${match.value}` : match.field));
  return `Matched ${fields.join(', ')} with score ${result.score}`;
}

function truncateContextContent(content: string, maxCharacters: number): string {
  if (maxCharacters <= 0) return '';

  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxCharacters) return compact;
  if (maxCharacters <= 3) return compact.slice(0, maxCharacters);

  return `${compact.slice(0, maxCharacters - 3).trimEnd()}...`;
}
