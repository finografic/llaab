/**
 * Hono RPC client — typed end-to-end from server route definitions.
 *
 * Usage: const res = await api.vault.nodes.$get({ query: { type: 'idea' } }); const { nodes } = await
 * res.json(); // typed as { nodes: LabNode[] }
 *
 * In dev, Vite proxies /api/* → apps/server. Requests stay same-origin so the proxy fires correctly.
 */

import { hc } from 'hono/client';
import type { AppType } from '../../../server/src/app.js';
import type { TranscriptCanonicalCoverage } from '@llaab/schemas';

const baseUrl = globalThis.window?.location.origin ?? 'http://localhost:3000';

const client = hc<AppType>(baseUrl, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, {
      ...init,
      credentials: 'include',
    }),
  headers: () => ({ 'Content-Type': 'application/json' }),
});

/** Typed API client. Mirrors the server's /api/* route tree. */
export const { api } = client;

/** DELETE /api/vault/runs/:id — optional produced-node cascade. */
export async function deleteVaultRun(id: string, deleteProduced: boolean) {
  return api.vault.runs[':id'].$delete({
    param: { id },
    query: { deleteProduced: deleteProduced ? 'true' : 'false' },
  } as { param: { id: string } });
}

/** POST /api/vault/runs/delete-preview — preview what a run/batch delete would affect. */
export async function previewDeleteVaultRuns(ids: string[]) {
  return api.vault.runs['delete-preview'].$post({ json: { ids } });
}

/** POST /api/vault/transcripts/:id/canonical-ideas/promote — promote a missed candidate idea to canonical. */
export async function promoteCanonicalIdea(transcriptId: string, candidateId: string) {
  return api.vault.transcripts[':id']['canonical-ideas'].promote.$post({
    param: { id: transcriptId },
    json: { candidateId },
  });
}

export interface ResolveCanonicalIdeaConflictPayload {
  keep: 'existing' | 'incoming';
  incomingCanonicalIdeaIds: string[];
  existingCanonicalIdeaIds: string[];
  pendingCoverage?: TranscriptCanonicalCoverage;
}

/**
 * POST /api/vault/transcripts/:id/canonical-ideas/resolve-conflict — keep exactly one
 * canonical-idea set when a re-consolidation produced a second, conflicting one.
 */
export async function resolveCanonicalIdeaConflict(
  transcriptId: string,
  body: ResolveCanonicalIdeaConflictPayload,
) {
  return api.vault.transcripts[':id']['canonical-ideas']['resolve-conflict'].$post({
    param: { id: transcriptId },
    json: body,
  });
}

/**
 * POST /api/vault/transcripts/:id/canonical-ideas/clean — deletes every CanonicalIdeaNode and
 * consolidate-canonical-ideas RunNode tied to this transcript and clears canonical_coverage, even
 * for artifacts not currently referenced (orphaned by an unresolved conflict or manual file deletes).
 */
export async function cleanCanonicalIdeaArtifacts(transcriptId: string) {
  return api.vault.transcripts[':id']['canonical-ideas'].clean.$post({
    param: { id: transcriptId },
  });
}
