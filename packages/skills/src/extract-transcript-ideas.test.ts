import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@llaab/core', () => ({
  autoTag: vi.fn(() => []),
  createNode: vi.fn(),
  getNodeFilePath: vi.fn(),
  updateNode: vi.fn(),
}));

vi.mock('@llaab/ingestion', () => ({
  llmExtractWithTrace: vi.fn(),
  normalizeContentTags: vi.fn((tags: string[]) =>
    tags.map((tag) => tag.toLocaleLowerCase().replace(/\s+/g, '-')),
  ),
}));

vi.mock('./runner.js', () => ({
  runSkill: vi.fn(async (_name, execute, input) => execute(input)),
}));

import { autoTag, createNode, getNodeFilePath, updateNode } from '@llaab/core';
import { llmExtractWithTrace } from '@llaab/ingestion';
import type { TranscriptNode } from '@llaab/schemas';

import { extractTranscriptIdeas } from './extract-transcript-ideas.js';

describe('extractTranscriptIdeas', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes transcript body to autoTag and merges normalized LLM tags', async () => {
    const transcript: TranscriptNode = {
      id: 'transcript.gemma',
      type: 'transcript',
      title: 'Master Gemma 4 in 20 Minutes',
      status: 'seed',
      tags: ['d:ingest'],
      related: [],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-08T00:00:00Z',
      body: 'Gemma 4 is an open weight model for edge inference.',
      source_id: 'example-channel',
      source_url: 'https://www.youtube.com/watch?v=gemma',
      source_type: 'youtube',
      author: 'Example Channel',
      extracted_idea_ids: [],
      extracted_skill_ids: [],
    };
    vi.mocked(autoTag).mockImplementation((_title, body) => (body.includes('Gemma') ? ['d:llm'] : []));
    vi.mocked(llmExtractWithTrace).mockResolvedValue({
      ideas: ['Gemma 4 runs locally'],
      skills: ['local inference'],
      summary: 'Gemma 4 supports local inference.',
      tags: ['Gemma 4', 'Open Weight'],
      llmMeta: {
        model: 'llama3.1:8b',
        provider: 'ollama',
        durationMs: 150,
      },
      runTrace: {
        stages: [],
        decisions: [],
        llm: undefined,
      },
    });
    vi.mocked(createNode).mockResolvedValue({
      id: 'idea.gemma-4-runs-locally',
      path: '/vault/ideas/idea.gemma-4-runs-locally.md',
      node: {} as never,
    });
    vi.mocked(getNodeFilePath).mockReturnValue('/vault/transcripts/transcript.gemma.md');
    vi.mocked(updateNode).mockImplementation(async (_path, updater) => ({
      path: '/vault/transcripts/transcript.gemma.md',
      node: updater(transcript),
    }));

    await extractTranscriptIdeas({ transcript });

    expect(autoTag).toHaveBeenCalledWith(transcript.title, transcript.body);
    expect(autoTag).toHaveBeenCalledWith('Gemma 4 runs locally', transcript.body);
    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'idea',
        tags: ['d:ingest', 'd:llm', 'gemma-4', 'open-weight'],
      }),
    );
    await expect(vi.mocked(updateNode).mock.results[0]?.value).resolves.toMatchObject({
      node: {
        tags: ['d:ingest', 'd:llm', 'gemma-4', 'open-weight'],
      },
    });
  });
});
