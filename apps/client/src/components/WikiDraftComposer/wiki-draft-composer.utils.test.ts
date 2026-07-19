import { describe, expect, it } from 'vitest';
import type { CreateWikiDraftResult } from 'queries/transcripts';

import {
  formatWikiCreationSuccessMessage,
  isActiveWikiCreationRun,
  isForbiddenWikiCreationPath,
} from './wiki-draft-composer.utils';

describe('wiki draft composer utils', () => {
  it('treats the parent compile-transcript-wikis run as the durable creation progress signal', () => {
    expect(
      isActiveWikiCreationRun(
        {
          skill_id: 'compile-transcript-wikis',
          status: 'running',
          raw_input_summary: 'transcript-abc',
        },
        'transcript-abc',
      ),
    ).toBe(true);
    expect(
      isActiveWikiCreationRun(
        {
          skill_id: 'compile-transcript-wikis',
          status: 'completed',
          raw_input_summary: 'transcript-abc',
        },
        'transcript-abc',
      ),
    ).toBe(false);
  });

  it('never routes successful creation through draft or candidate review paths', () => {
    expect(isForbiddenWikiCreationPath('/knowledge/wikis/agent-isolation')).toBe(false);
    expect(isForbiddenWikiCreationPath('/vault/wiki-drafts/draft-a')).toBe(true);
    expect(isForbiddenWikiCreationPath('/vault/wiki-candidates/candidate-a')).toBe(true);
  });

  it('summarizes multi-branch create outcomes without mentioning draft review', () => {
    const result = {
      success: true,
      draftId: 'draft-a',
      draftIds: ['draft-a', 'draft-b'],
      draftCount: 2,
      runId: 'run-1',
      runIds: ['run-1'],
      qualityScore: 80,
      warnings: [],
      wikiId: 'wiki-a',
      wikiIds: ['wiki-a', 'wiki-b'],
      wikiCount: 2,
      wikis: [],
      branches: [
        { outcome: 'promoted-create', wiki_id: 'wiki-a' },
        { outcome: 'promoted-update', wiki_id: 'wiki-b' },
        { outcome: 'skipped', reason: 'Ambiguous topic.' },
      ],
    } as CreateWikiDraftResult;

    const message = formatWikiCreationSuccessMessage(result);
    expect(message.toLowerCase()).not.toMatch(/draft review|promote manually/);
    expect(message).toContain('2 focused wikis published');
    expect(message).toContain('skipped');
  });
});
