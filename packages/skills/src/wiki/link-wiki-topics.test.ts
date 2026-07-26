import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routeLlmObject } = vi.hoisted(() => ({ routeLlmObject: vi.fn() }));
vi.mock('@llaab/llm', () => ({ routeLlmObject }));

describe('linkWikiTopics', () => {
  const candidates = [
    {
      temporaryKey: 'structured-output',
      finalWikiId: 'structured-output',
      title: 'Structured Output',
      summary: 'Typed model output for optional wiki enrichment.',
      tags: ['d:llm', 'structured-output'],
      operation: 'create' as const,
    },
    {
      temporaryKey: 'semantic-validation',
      finalWikiId: 'semantic-validation',
      title: 'Semantic Validation',
      summary: 'Domain validation remains after schema validation.',
      tags: ['d:llm', 'validation'],
      operation: 'create' as const,
    },
  ];

  beforeEach(() => {
    routeLlmObject.mockReset();
  });

  it('pilots wiki-link enrichment through routeLlmObject', async () => {
    routeLlmObject.mockResolvedValueOnce({
      object: {
        links: [
          {
            source_temporary_key: 'structured-output',
            target: 'semantic-validation',
            relation: 'supports',
            note: 'Structured output reduces parsing ambiguity before domain validation runs.',
          },
        ],
      },
      rawText: '{"links":[]}',
      model: 'test-model',
      provider: 'ollama',
      durationMs: 5,
    });

    const { linkWikiTopics } = await import('./link-wiki-topics.js');
    const result = await linkWikiTopics({ candidates, existingWikis: [] });

    expect(routeLlmObject).toHaveBeenCalledWith(
      'wiki-link',
      expect.stringContaining('batch_pages'),
      expect.objectContaining({ parse: expect.any(Function) }),
      expect.objectContaining({ system: expect.stringContaining('Suggest typed wiki links') }),
    );
    expect(result).toMatchObject({ attempted: true, warnings: [] });
    expect(result.linksBySourceKey.get('structured-output')).toEqual([
      {
        target_wiki_id: 'semantic-validation',
        relation: 'supports',
        note: 'Structured output reduces parsing ambiguity before domain validation runs.',
      },
    ]);
  });

  it('keeps wiki-link enrichment best-effort when structured output fails', async () => {
    routeLlmObject.mockRejectedValueOnce(new Error('Model output failed structured-output validation'));

    const { linkWikiTopics } = await import('./link-wiki-topics.js');
    const result = await linkWikiTopics({ candidates, existingWikis: [] });

    expect(result.attempted).toBe(true);
    expect(result.linksBySourceKey.size).toBe(0);
    expect(result.warnings).toEqual(['wiki-link skipped: Model output failed structured-output validation']);
  });
});
