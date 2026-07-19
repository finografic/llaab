import type { WikiDraftNode, WikiSourceRef } from '@llaab/schemas';

export type WikiDraftReviewAction = 'promote' | 'reject' | 'edit' | 'regenerate' | 'resolve-topic';

export function getWikiDraftReviewActions(draft: WikiDraftNode): WikiDraftReviewAction[] {
  if (draft.draft_status !== 'proposed') return ['regenerate'];

  const actions: WikiDraftReviewAction[] = ['reject', 'regenerate'];
  if (draft.operation === 'create' || draft.operation === 'update') actions.unshift('promote');
  if (draft.operation !== 'no-op') actions.splice(actions.length - 1, 0, 'edit');
  if (draft.operation === 'needs-review' && draft.topic_matches.length > 0) actions.push('resolve-topic');
  return actions;
}

export function knowledgeWikiDetailPath(id: string): string {
  return `/knowledge/wikis/${id}`;
}

export function wikiDraftDetailPath(id: string): string {
  return `/vault/wiki-drafts/${id}`;
}

export function vaultNodeDetailPath(id: string): string {
  return `/vault/nodes/${id}`;
}

export function vaultTranscriptDetailPath(id: string): string {
  return `/vault/transcripts/${id}`;
}

export function vaultRunDetailPath(id: string): string {
  return `/vault/runs/${id}`;
}

/** Prefer internal vault routes; fall back to external URL when no node is available. */
export function sourceRefInternalPath(ref: WikiSourceRef): string | null {
  if (ref.kind === 'transcript') {
    const id = ref.node_id ?? ref.id;
    return vaultTranscriptDetailPath(id);
  }
  if (ref.kind === 'canonical-idea' || ref.kind === 'source') {
    const id = ref.node_id ?? ref.id;
    return vaultNodeDetailPath(id);
  }
  return null;
}

export function dedupeWarningMessages(
  warning: string | undefined,
  validationIssues: Array<{ message: string }>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const message = raw.trim();
    if (!message) return;
    const key = message.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(message);
  };

  for (const issue of validationIssues) push(issue.message);

  if (warning) {
    for (const part of warning.split(/(?<=[.!?])\s+/)) push(part);
  }

  return out;
}
