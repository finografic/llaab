import { MONOREPO_ROOT, buildVaultContextPackets, searchKnowledgeDocs, searchVaultNodes } from '@llaab/core';
import { streamLlm } from '@llaab/llm';
import type { ChatScope, KnowledgeDocSearchResult, VaultContextPacket } from '@llaab/core';
import type { NodeType } from '@llaab/schemas';

export type ChatSourceOrigin = 'knowledge' | 'vault';

export interface ChatSource {
  origin: ChatSourceOrigin;
  title: string;
  path: string;
  score: number;
  href?: string;
  snippet: string;
}

export interface ChatContext {
  knowledge: KnowledgeDocSearchResult[];
  vault: VaultContextPacket[];
  sources: ChatSource[];
}

export interface ChatTurn {
  question: string;
  answer: string;
}

const DEFAULT_SOURCE_LIMIT = 8;
const KNOWLEDGE_SNIPPET_LIMIT = 1200;
const MAX_REMEMBERED_TURNS = 4;

const CHAT_SYSTEM_PROMPT = [
  'You are the LLAAB vault assistant. You answer the operator using their own knowledge base.',
  'Context is supplied in two tiers: KNOWLEDGE (reviewed, canonical) and VAULT (raw captures, transcripts, ideas).',
  'Precedence: KNOWLEDGE outranks VAULT, and both outrank your own training knowledge.',
  '',
  'Rules:',
  '- Answer in at most six sentences, or a short bullet list. No preamble, no restating the question.',
  '- Ground claims in the supplied context. Never invent titles, paths, quotes, or figures.',
  '- If the context does not cover the question, say so in one line, then answer from general',
  '  knowledge under the heading "Outside the vault:".',
  '- Do not write a sources or references list — the terminal renders sources separately.',
].join('\n');

/** In-process, per-terminal chat memory. Cleared on server restart by design. */
const chatSessions = new Map<string, ChatTurn[]>();

export function readChatSession(sessionId: string | undefined): ChatTurn[] {
  if (!sessionId) return [];
  return chatSessions.get(sessionId) ?? [];
}

export function recordChatTurn(sessionId: string | undefined, turn: ChatTurn): void {
  if (!sessionId) return;
  const turns = [...readChatSession(sessionId), turn].slice(-MAX_REMEMBERED_TURNS);
  chatSessions.set(sessionId, turns);
}

export function clearChatSession(sessionId: string | undefined): void {
  if (!sessionId) return;
  chatSessions.delete(sessionId);
}

export async function assembleChatContext(input: {
  question: string;
  scope: ChatScope;
  limit: number;
}): Promise<ChatContext> {
  const useKnowledge = input.scope === 'all' || input.scope === 'knowledge';
  const useVault = input.scope === 'all' || input.scope === 'vault';

  const [knowledge, vaultResults] = await Promise.all([
    useKnowledge ? searchKnowledgeDocs({ limit: input.limit, query: input.question }) : [],
    useVault ? searchVaultNodes({ limit: input.limit, query: input.question }) : [],
  ]);

  const vault = buildVaultContextPackets(vaultResults, { maxPackets: input.limit });

  return {
    knowledge,
    sources: [
      ...knowledge.map(
        (doc): ChatSource => ({
          href: doc.href,
          origin: 'knowledge',
          path: `knowledge/${doc.path}`,
          score: doc.score,
          snippet: doc.snippet,
          title: doc.title,
        }),
      ),
      ...vault.map(
        (packet): ChatSource => ({
          href: vaultNodeHref(packet.node_type, packet.node_id),
          origin: 'vault',
          path: toRepoRelativePath(packet.path),
          score: packet.score,
          snippet: packet.snippet,
          title: packet.title,
        }),
      ),
    ].slice(0, DEFAULT_SOURCE_LIMIT * 2),
    vault,
  };
}

export function buildChatPrompt(input: {
  question: string;
  context: ChatContext;
  history: ChatTurn[];
}): string {
  const sections: string[] = [];

  if (input.history.length > 0) {
    sections.push(
      '## Earlier in this conversation',
      input.history
        .map((turn) => `Q: ${turn.question}\nA: ${collapseWhitespace(turn.answer, 600)}`)
        .join('\n\n'),
    );
  }

  sections.push('## KNOWLEDGE context (canonical — prefer this)');
  sections.push(
    input.context.knowledge.length === 0
      ? '(no matching knowledge documents)'
      : input.context.knowledge
          .map(
            (doc, index) =>
              `[K${index + 1}] ${doc.title} — knowledge/${doc.path}\n${collapseWhitespace(doc.body, KNOWLEDGE_SNIPPET_LIMIT)}`,
          )
          .join('\n\n'),
  );

  sections.push('## VAULT context (raw captures — secondary)');
  sections.push(
    input.context.vault.length === 0
      ? '(no matching vault nodes)'
      : input.context.vault
          .map(
            (packet, index) =>
              `[V${index + 1}] ${packet.title} — ${packet.path} (${packet.node_type})\n${packet.content}`,
          )
          .join('\n\n'),
  );

  sections.push('## Question', input.question);

  return sections.join('\n\n');
}

export async function* streamChatAnswer(input: { prompt: string; model?: string }): AsyncGenerator<string> {
  yield* streamLlm('reason', input.prompt, { model: input.model, system: CHAT_SYSTEM_PROMPT });
}

function vaultNodeHref(nodeType: NodeType, nodeId: string): string {
  switch (nodeType) {
    case 'transcript':
      return `/vault/transcripts/${nodeId}`;
    case 'source':
      return `/vault/sources/${nodeId}`;
    case 'run':
      return `/vault/runs/${nodeId}`;
    case 'wiki-draft':
      return `/vault/wiki-drafts/${nodeId}`;
    case 'wiki-candidate':
      return `/vault/wiki-candidates/${nodeId}`;
    default:
      return `/vault/nodes/${nodeId}`;
  }
}

/** Vault search returns absolute paths; sources display them alongside repo-relative `knowledge/` paths. */
function toRepoRelativePath(path: string): string {
  return path.startsWith(`${MONOREPO_ROOT}/`) ? path.slice(MONOREPO_ROOT.length + 1) : path;
}

function collapseWhitespace(text: string, maxCharacters: number): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxCharacters) return compact;
  return `${compact.slice(0, maxCharacters - 3).trimEnd()}...`;
}
