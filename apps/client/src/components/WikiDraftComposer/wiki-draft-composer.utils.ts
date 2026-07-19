import {
  formatWikiOneStepSuccessMessage,
  isForbiddenWikiCreationPath,
  summarizeWikiOneStepBranches,
} from '@llaab/schemas';
import type { CreateWikiDraftResult } from 'queries/transcripts';

const WIKI_PARENT_SKILL_IDS = new Set(['compile-transcript-wikis', 'create-transcript-wikis']);
const WIKI_CHILD_SKILL_IDS = new Set(['compile-wiki-draft']);

export function isActiveWikiCreationRun(
  run: { skill_id?: string; raw_input_summary?: string; status?: string },
  transcriptId: string,
): boolean {
  if (run.status !== 'pending' && run.status !== 'running') return false;
  const skillId = run.skill_id;
  if (!skillId) return false;
  if (!WIKI_PARENT_SKILL_IDS.has(skillId) && !WIKI_CHILD_SKILL_IDS.has(skillId)) return false;
  return run.raw_input_summary?.includes(transcriptId) === true;
}

export function summarizeWikiCreationBranches(
  branches: NonNullable<CreateWikiDraftResult['branches']>,
): string {
  return summarizeWikiOneStepBranches(branches);
}

export function formatWikiCreationSuccessMessage(result: CreateWikiDraftResult): string {
  return formatWikiOneStepSuccessMessage({
    wikiCount: result.wikiCount,
    branches: result.branches ?? [],
  });
}

export { isForbiddenWikiCreationPath };
