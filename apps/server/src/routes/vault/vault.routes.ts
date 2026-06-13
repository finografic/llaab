import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import {
  cleanRecentVaultActivity,
  createNode,
  deleteNode,
  getNodeFilePath,
  listNodes,
  readNode,
  updateNode,
  VAULT_ROOT,
} from '@llaab/core';
import { enrichSourceMetadata, extractKnowledgeFromTranscript } from '@llaab/ingestion';
import { routeLlm } from '@llaab/llm';
import { formatInstantForFilenameId, formatIsoUtcSeconds } from '@llaab/schemas';
import { appendProducedNodeIds, appendRunEvent, setRunLlmTrace } from '@llaab/skills';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppCtx, AppCtxJson, AppCtxQuery } from '../../types/app.types.js';
import type {
  CleanRecentBody,
  CreateNodeBody,
  ListNodesQuery,
  UpdateSourceProfilesBody,
  VaultLoginBody,
} from './vault.schema.js';
import type { CanonicalIdeaNode, IdeaNode, RunNode, SourceNode, TranscriptNode } from '@llaab/schemas';

import {
  getVaultPassword,
  isVaultAuthEnabled,
  isVaultSessionValid,
  VAULT_COOKIE_MAX_AGE,
  VAULT_COOKIE_NAME,
} from '../../lib/vault-auth.js';
import { readVaultRootTree } from '../../lib/vault-tree.js';
import { deleteRunQuerySchema } from './vault.schema.js';

const ConsolidatedIdeaDraftSchema = z
  .object({
    title: z.string().min(1),
    body: z.string().optional().default(''),
    tags: z.array(z.string()).default([]),
    domains: z.array(z.string()).default([]),
    sourceCandidateIdeaIds: z.array(z.string().min(1)).default([]),
    source_candidate_idea_ids: z.array(z.string().min(1)).default([]),
    confidence: z.enum(['low', 'medium', 'high']),
  })
  .transform((idea) => ({
    title: idea.title,
    body: idea.body,
    tags: idea.tags,
    domains: idea.domains,
    sourceCandidateIdeaIds:
      idea.sourceCandidateIdeaIds.length > 0 ? idea.sourceCandidateIdeaIds : idea.source_candidate_idea_ids,
    confidence: idea.confidence,
  }))
  .pipe(
    z.object({
      title: z.string().min(1),
      body: z.string(),
      tags: z.array(z.string()),
      domains: z.array(z.string()),
      sourceCandidateIdeaIds: z.array(z.string().min(1)).min(1),
      confidence: z.enum(['low', 'medium', 'high']),
    }),
  );

const ConsolidatedIdeasResponseSchema = z.object({
  ideas: z.array(ConsolidatedIdeaDraftSchema).min(1),
});

interface CandidateIdeaPayload {
  id: string;
  runId: string;
  title: string;
  body?: string;
  domains: string[];
  tags: string[];
}

function parseJsonFromLlmText(text: string): unknown {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in LLM response');
  return JSON.parse(stripped.slice(start, end + 1));
}

function splitIdeaTags(tags: string[]): { domains: string[]; topics: string[] } {
  return {
    domains: tags.filter((tag) => tag.startsWith('d:')),
    topics: tags.filter((tag) => !tag.startsWith('d:')),
  };
}

function normalizeTag(value: string): string {
  return value
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9:-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function dedupeTags(values: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = normalizeTag(value);
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

function buildConsolidationPrompt(transcript: TranscriptNode, candidates: CandidateIdeaPayload[]): string {
  return JSON.stringify(
    {
      task: 'consolidate-canonical-ideas',
      transcript: {
        id: transcript.id,
        title: transcript.title,
        summary: transcript.summary,
        tags: transcript.tags,
      },
      candidates,
      instructions: [
        'Merge duplicate or substantially overlapping candidate ideas.',
        'Preserve related but distinct ideas as separate canonical ideas.',
        'Do not create ideas unsupported by the candidates.',
        'Every canonical idea must include sourceCandidateIdeaIds referencing one or more candidate ids.',
        'Return concise, improved wording.',
      ],
    },
    null,
    2,
  );
}

const CONSOLIDATION_SYSTEM_PROMPT = `You consolidate extracted transcript ideas into canonical ideas.

Return ONLY valid JSON with this exact shape:
{"ideas":[{"title":"Concise canonical idea","body":"Optional one or two sentence explanation","tags":["topic-tag"],"domains":["d:llm"],"sourceCandidateIdeaIds":["idea-id"],"confidence":"high"}]}

Rules:
- Use only candidate ids from the input.
- Every canonical idea must reference at least one source candidate id.
- Merge duplicates and near-duplicates.
- Do not merge ideas that are merely related but distinct.
- Preserve concrete technical meaning.
- Do not include markdown fences, explanations, or comments.`;

export const vaultAuthLogin = {
  path: '/auth/login' as const,
  handler: async (c: AppCtxJson<VaultLoginBody>) => {
    if (!isVaultAuthEnabled()) {
      return c.json({ ok: true, authRequired: false });
    }

    const { password } = c.req.valid('json');
    const expected = getVaultPassword();
    if (expected === null || password !== expected) {
      return c.json({ ok: false, error: 'Incorrect password.' }, 401);
    }

    setCookie(c, VAULT_COOKIE_NAME, password, {
      path: '/',
      maxAge: VAULT_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'Lax',
    });

    return c.json({ ok: true, authRequired: true });
  },
};

export const vaultAuthLogout = {
  path: '/auth/logout' as const,
  handler: (c: AppCtx) => {
    deleteCookie(c, VAULT_COOKIE_NAME, { path: '/' });
    return c.json({ ok: true });
  },
};

export const vaultAuthSession = {
  path: '/auth/session' as const,
  handler: (c: AppCtx) => {
    if (!isVaultAuthEnabled()) {
      return c.json({ ok: true, authRequired: false });
    }

    if (!isVaultSessionValid(c)) {
      return c.json({ ok: false, authRequired: true }, 401);
    }

    return c.json({ ok: true, authRequired: true });
  },
};

export const vaultTree = {
  path: '/tree' as const,
  handler: async (c: AppCtx) => {
    const tree = await readVaultRootTree();
    return c.json({ tree });
  },
};

export const cleanRecent = {
  path: '/clean-recent' as const,
  handler: async (c: AppCtxJson<CleanRecentBody>) => {
    const { hours } = c.req.valid('json');

    try {
      const removedCount = await cleanRecentVaultActivity(hours);
      return c.json({ success: true, removedCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vault clean failed.';
      return c.json({ success: false, error: message }, 500);
    }
  },
};

export const file = {
  path: '/file' as const,
  handler: async (c: AppCtx) => {
    const filePath = c.req.query('path');
    if (!filePath) return c.json({ error: '`path` query parameter is required.' }, 400);

    const resolved = resolve(VAULT_ROOT, filePath);
    if (!resolved.startsWith(VAULT_ROOT + sep) && resolved !== VAULT_ROOT) {
      return c.json({ error: 'Invalid path.' }, 403);
    }

    try {
      const content = await readFile(resolved, 'utf-8');
      return c.json({ content });
    } catch {
      return c.json({ error: 'File not found.' }, 404);
    }
  },
};

export const listVaultNodes = {
  path: '/nodes' as const,
  handler: async (c: AppCtxQuery<ListNodesQuery>) => {
    const query = c.req.valid('query');
    const nodes = await listNodes(query);
    return c.json({ nodes });
  },
};

export const createVaultNode = {
  path: '/nodes' as const,
  handler: async (c: AppCtxJson<CreateNodeBody>) => {
    const body = c.req.valid('json');
    try {
      const {
        id,
        path: createdPath,
        node,
      } = await createNode({
        type: body.type,
        title: body.title,
        body: body.body,
        tags: body.tags,
      });
      return c.json({ id, path: createdPath, type: node.type }, 201);
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        return c.json({ error: 'A node with that title already exists.' }, 409);
      }
      return c.json({ error: 'Failed to create node.' }, 500);
    }
  },
};

export const nodeDetail = {
  path: '/nodes/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const nodes = await listNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return c.json({ error: 'Node not found' }, 404);
    return c.json({ node });
  },
};

export const transcriptIdeas = {
  path: '/transcripts/:id/ideas' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const allNodes = await listNodes();
    const transcript = allNodes.find((n) => n.id === id && n.type === 'transcript') as
      | TranscriptNode
      | undefined;
    if (!transcript) return c.json({ error: 'Transcript not found' }, 404);
    const ideaIds: string[] = transcript.extracted_idea_ids ?? [];
    const ideas = allNodes
      .filter((n) => n.type === 'idea' && ideaIds.includes(n.id))
      .map((n) => ({ id: n.id, title: n.title }));
    return c.json({ ideas });
  },
};

export const extractTranscript = {
  path: '/transcripts/:id/extract' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const nodes = await listNodes({ type: 'transcript' });
    const node = nodes.find((n) => n.id === id) as TranscriptNode | undefined;
    if (!node) return c.json({ error: 'Transcript not found' }, 404);
    if (!node.body) return c.json({ error: 'Transcript has no body' }, 400);

    const filePath = getNodeFilePath(node.type, node.id);
    const runNodes = await listNodes({ type: 'run' });
    const matchingRuns = (runNodes as RunNode[])
      .filter((n) => n.produced_node_ids?.includes(id))
      .sort((a, b) => {
        const left = a.started_at ?? a.created_at;
        const right = b.started_at ?? b.created_at;
        return right.localeCompare(left);
      });
    const originatingRun = matchingRuns[0];

    if (originatingRun) {
      await appendRunEvent(originatingRun.id, {
        level: 'info',
        message: 'Extracting ideas from transcript',
      });
    }

    try {
      const result = await extractKnowledgeFromTranscript(id, filePath, node.body);

      // Extraction runs as a follow-on step after the originating run was persisted —
      // append the newly created idea node ids so the run's produced-node count stays accurate.
      if (originatingRun) {
        await appendProducedNodeIds(originatingRun.id, result.ideaIds, {
          completedAt: formatIsoUtcSeconds(new Date()),
        });
        await setRunLlmTrace(originatingRun.id, {
          model: result.llmMeta.model,
          provider: result.llmMeta.provider,
          duration_ms: result.llmMeta.durationMs,
          prompt_tokens: result.llmMeta.promptTokens,
          completion_tokens: result.llmMeta.completionTokens,
        });
        await appendRunEvent(originatingRun.id, {
          level: 'success',
          message: `Extracted ${result.ideaIds.length} idea${result.ideaIds.length === 1 ? '' : 's'}`,
          node_ids: result.ideaIds,
        });
      }

      return c.json({ success: true, ...result });
    } catch (err) {
      if (originatingRun) {
        await appendRunEvent(originatingRun.id, {
          level: 'warning',
          message: `Extraction failed (transcript saved): ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      return c.json(
        {
          success: false,
          error: err instanceof Error ? err.message : 'Extraction failed',
        },
        500,
      );
    }
  },
};

export const consolidateTranscriptIdeas = {
  path: '/transcripts/:id/consolidate' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const allNodes = await listNodes();
    const transcript = allNodes.find((node) => node.id === id && node.type === 'transcript') as
      | TranscriptNode
      | undefined;
    if (!transcript) return c.json({ error: 'Transcript not found' }, 404);

    const runs = allNodes.filter(
      (node): node is RunNode => node.type === 'run' && node.produced_node_ids.includes(transcript.id),
    );
    const ideasById = new Map(
      allNodes.filter((node): node is IdeaNode => node.type === 'idea').map((idea) => [idea.id, idea]),
    );
    const candidatesById = new Map<string, CandidateIdeaPayload>();

    for (const run of runs) {
      for (const nodeId of run.produced_node_ids) {
        const idea = ideasById.get(nodeId);
        if (!idea || candidatesById.has(idea.id)) continue;
        const { domains, topics } = splitIdeaTags(idea.tags);
        candidatesById.set(idea.id, {
          id: idea.id,
          runId: run.id,
          title: idea.title,
          body: idea.body || undefined,
          domains,
          tags: topics,
        });
      }
    }

    const candidates = [...candidatesById.values()];
    if (candidates.length === 0) {
      return c.json({ error: 'No candidate ideas found for this transcript.' }, 400);
    }

    try {
      const result = await routeLlm('consolidate', buildConsolidationPrompt(transcript, candidates), {
        system: CONSOLIDATION_SYSTEM_PROMPT,
        bypassCache: true,
      });
      const parsed = ConsolidatedIdeasResponseSchema.parse(parseJsonFromLlmText(result.text));
      const candidateIds = new Set(candidates.map((candidate) => candidate.id));
      const createdAt = new Date();
      const timestamp = formatInstantForFilenameId(createdAt);
      const canonicalIdeas: CanonicalIdeaNode[] = [];

      for (const [index, draft] of parsed.ideas.entries()) {
        const sourceCandidateIdeaIds = [...new Set(draft.sourceCandidateIdeaIds)].filter((candidateId) =>
          candidateIds.has(candidateId),
        );
        if (sourceCandidateIdeaIds.length === 0) continue;

        const tags = dedupeTags([...draft.domains.filter((tag) => tag.startsWith('d:')), ...draft.tags]);
        const created = await createNode({
          type: 'canonical-idea',
          id: `canonical-${transcript.id}-${index + 1}-${timestamp}`,
          title: draft.title,
          body: draft.body,
          tags,
          extra: {
            transcript_id: transcript.id,
            source_candidate_idea_ids: sourceCandidateIdeaIds,
            confidence: draft.confidence,
            llm_model: result.model,
            llm_provider: result.provider,
            llm_duration_ms: result.durationMs,
            llm_prompt_tokens: result.promptTokens,
            llm_completion_tokens: result.completionTokens,
          },
        });
        canonicalIdeas.push(created.node as CanonicalIdeaNode);
      }

      if (canonicalIdeas.length === 0) {
        return c.json({ error: 'Consolidation returned no valid canonical ideas.' }, 422);
      }

      return c.json({
        success: true,
        canonicalIdeaIds: canonicalIdeas.map((idea) => idea.id),
        canonicalIdeas,
        llmMeta: {
          model: result.model,
          provider: result.provider,
          durationMs: result.durationMs,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
        },
      });
    } catch (err) {
      return c.json(
        {
          success: false,
          error: err instanceof Error ? err.message : 'Consolidation failed',
        },
        500,
      );
    }
  },
};

export const discardTranscript = {
  path: '/transcripts/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();

    // Read directly by path — avoids listNodes scan returning stale/incomplete results
    const transcriptPath = getNodeFilePath('transcript', id);
    let transcript: TranscriptNode;
    try {
      transcript = (await readNode(transcriptPath)) as TranscriptNode;
    } catch {
      return c.json({ error: 'Transcript not found' }, 404);
    }

    // Delete idea nodes
    for (const ideaId of transcript.extracted_idea_ids ?? []) {
      try {
        await deleteNode('idea', ideaId);
      } catch {
        /* best-effort */
      }
    }

    // Delete canonical idea nodes for this transcript
    try {
      const canonicalIdeaNodes = await listNodes({ type: 'canonical-idea' });
      for (const canonicalIdea of canonicalIdeaNodes) {
        if (canonicalIdea.type !== 'canonical-idea' || canonicalIdea.transcript_id !== id) continue;
        try {
          await deleteNode('canonical-idea', canonicalIdea.id);
        } catch {
          /* best-effort */
        }
      }
    } catch {
      /* best-effort */
    }

    // Delete source node
    if (transcript.source_id) {
      try {
        await deleteNode('source', transcript.source_id);
      } catch {
        /* best-effort */
      }
    }

    // Delete associated run node (find by produced_node_ids containing this transcript)
    try {
      const runNodes = await listNodes({ type: 'run' });
      for (const n of runNodes) {
        if (n.type === 'run' && (n as RunNode).produced_node_ids?.includes(id)) {
          try {
            await deleteNode('run', n.id);
          } catch {
            /* best-effort */
          }
        }
      }
    } catch {
      /* best-effort */
    }

    await deleteNode('transcript', id);
    return c.json({ success: true });
  },
};

export const deleteRun = {
  path: '/runs/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const { deleteProduced: deleteProducedParam } = deleteRunQuerySchema.parse({
      deleteProduced: c.req.query('deleteProduced'),
    });
    const deleteProduced = deleteProducedParam === 'true';

    const runPath = getNodeFilePath('run', id);
    let run: RunNode;
    try {
      run = (await readNode(runPath)) as RunNode;
    } catch {
      return c.json({ error: 'Run not found' }, 404);
    }

    let deletedProduced = 0;
    if (deleteProduced && run.produced_node_ids.length > 0) {
      const allNodes = await listNodes();
      const nodesById = new Map(allNodes.map((node) => [node.id, node]));
      const otherRuns = allNodes.filter((node): node is RunNode => node.type === 'run' && node.id !== run.id);

      for (const nodeId of run.produced_node_ids) {
        const producedNode = nodesById.get(nodeId);
        if (!producedNode) continue;
        const isReferencedByAnotherRun = otherRuns.some((otherRun) =>
          otherRun.produced_node_ids.includes(nodeId),
        );
        if (isReferencedByAnotherRun) continue;

        try {
          await deleteNode(producedNode.type, nodeId);
          deletedProduced++;
        } catch {
          /* best-effort */
        }
      }
    }

    await deleteNode('run', id);
    return c.json({ success: true, deletedProduced });
  },
};

export const enrichSource = {
  path: '/sources/:id/enrich' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const force = c.req.query('force') === 'true';

    const nodes = await listNodes({ type: 'source' });
    const source = nodes.find((node) => node.id === id) as SourceNode | undefined;
    if (!source) return c.json({ error: 'Source not found' }, 404);

    try {
      const result = await enrichSourceMetadata(source, { force });
      return c.json({
        source: result.source,
        fetched: result.fetched,
        subscriptionChecked: result.subscriptionChecked,
        subscriptionError: result.subscriptionError,
      });
    } catch (err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : 'Failed to enrich source metadata.',
        },
        500,
      );
    }
  },
};

export const updateSourceProfiles = {
  path: '/sources/:id/profiles' as const,
  handler: async (c: AppCtxJson<UpdateSourceProfilesBody>) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Source id is required.' }, 400);
    const { profiles } = c.req.valid('json');
    const sourcePath = getNodeFilePath('source', id);

    try {
      const result = await updateNode(sourcePath, (current) => {
        if (current.type !== 'source') {
          throw new Error('Source not found');
        }

        const profilePlatforms = new Set(profiles.map((profile) => profile.platform));
        const platforms = [
          ...new Set([...current.platforms.filter((platform) => platform !== 'github'), ...profilePlatforms]),
        ];

        return {
          ...current,
          platforms,
          profiles,
        };
      });

      return c.json({ source: result.node });
    } catch (err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : 'Failed to update source profiles.',
        },
        500,
      );
    }
  },
};

export const nodeRaw = {
  path: '/nodes/:id/raw' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const nodes = await listNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return c.json({ error: 'Node not found' }, 404);

    const filePath = getNodeFilePath(node.type, node.id);
    if (!filePath.startsWith(VAULT_ROOT)) return c.json({ error: 'Forbidden' }, 403);

    const content = await readFile(filePath, 'utf-8');
    return c.text(content);
  },
};
