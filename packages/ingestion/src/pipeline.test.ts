import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@llaab/core', () => ({
  createNode: vi.fn(),
  getNodeFilePath: vi.fn(),
  listNodes: vi.fn(),
}));

vi.mock('./fetch/youtube.js', () => ({
  fetchYouTube: vi.fn(),
  parseYouTubeUrl: vi.fn((url: string) => ({
    url: 'https://www.youtube.com/watch?v=abcdefghijk',
    videoId: 'abcdefghijk',
    originalUrl: url,
  })),
}));

vi.mock('./clean/transcript.js', () => ({
  cleanTranscript: vi.fn(),
}));

vi.mock('./structure/text.js', () => ({
  structureText: vi.fn(),
}));

vi.mock('./extract/llm-extract.js', () => ({
  llmExtractWithTrace: vi.fn(),
}));

import { createNode, getNodeFilePath, listNodes } from '@llaab/core';

import { cleanTranscript } from './clean/transcript.js';
import { llmExtractWithTrace } from './extract/llm-extract.js';
import { fetchYouTube, parseYouTubeUrl } from './fetch/youtube.js';
import { runIngestionPipeline } from './pipeline.js';
import { structureText } from './structure/text.js';

describe('runIngestionPipeline', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates fetch, clean, structure, extract, and store stages for YouTube ingestion', async () => {
    vi.mocked(getNodeFilePath).mockImplementation((type, id) => `/vault/${type}s/${type}.${id}.md`);
    vi.mocked(parseYouTubeUrl).mockReturnValue({
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
      videoId: 'abcdefghijk',
    });
    vi.mocked(listNodes).mockResolvedValue([]);
    vi.mocked(fetchYouTube).mockResolvedValue({
      title: 'Example video',
      channel: 'Example Channel',
      description: 'Example description',
      rawTranscript: 'raw transcript',
      duration: 120,
      uploadDate: '20260408',
    });
    vi.mocked(cleanTranscript).mockReturnValue({
      cleanedText: 'clean transcript',
      rawLength: 1200,
      cleanLength: 900,
    });
    vi.mocked(structureText).mockReturnValue({
      structuredContent: 'structured transcript',
      paragraphCount: 3,
    });
    vi.mocked(llmExtractWithTrace).mockResolvedValue({
      ideas: [],
      skills: [],
      summary: 'usable summary',
      runTrace: {
        stages: [
          {
            name: 'control:extract-knowledge',
            status: 'completed',
            output: { summary: 'usable summary' },
          },
        ],
        decisions: [
          {
            type: 'accept',
            reason: 'Schema validation passed for task "extract-knowledge".',
          },
        ],
        llm: {
          model: 'ollama',
          rawOutput: '{"summary":"usable summary"}',
          parsed: true,
        },
      },
    });
    vi.mocked(createNode)
      .mockResolvedValueOnce({
        id: 'transcript.example-video',
        path: '/vault/transcripts/transcript.example-video.md',
        node: {
          id: 'transcript.example-video',
          type: 'transcript',
          title: 'Example video',
          status: 'seed',
          tags: ['test', 'ingested', 'youtube'],
          related: [],
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T00:00:00.000Z',
          body: 'structured transcript',
          sourceId: 'example-channel',
          sourceUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
          sourceType: 'youtube',
          author: 'Example Channel',
          summary: 'usable summary',
          rawLength: 1200,
          cleanLength: 900,
          structuredParagraphs: 3,
          extractedIdeaIds: [],
          extractedSkillIds: [],
        },
      })
      .mockResolvedValueOnce({
        id: 'example-channel',
        path: '/vault/sources/source.example-channel.md',
        node: {
          id: 'example-channel',
          type: 'source',
          title: 'Example Channel',
          status: 'seed',
          tags: ['youtube', 'channel'],
          related: [],
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T00:00:00.000Z',
          body: '',
          sourceKind: 'channel',
          url: 'https://www.youtube.com/@ExampleChannel',
          platforms: ['youtube'],
          follow: false,
        },
      });

    const result = await runIngestionPipeline({
      sourceType: 'youtube',
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
      title: 'Example video',
      tags: ['test'],
    });

    expect(result.producedNodeIds).toEqual(['transcript.example-video', 'example-channel']);
    expect(result.runTrace?.stages.map((stage) => stage.name)).toEqual([
      'fetch:youtube',
      'clean:transcript',
      'structure:text',
      'control:extract-knowledge',
      'store:transcript',
      'store:source',
    ]);
    expect(createNode).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'transcript',
        extra: expect.objectContaining({
          sourceItemId: 'abcdefghijk',
          sourceUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
        }),
      }),
    );
    expect(result.runTrace?.decisions.at(-1)?.type).toBe('accept');
    expect(result.runTrace?.llm?.model).toBe('ollama');
  });

  it('reuses an existing transcript for the same youtube video id and skips expensive stages', async () => {
    vi.mocked(getNodeFilePath).mockImplementation((type, id) => `/vault/${type}s/${type}.${id}.md`);
    vi.mocked(parseYouTubeUrl).mockReturnValue({
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
      videoId: 'abcdefghijk',
    });
    vi.mocked(listNodes).mockResolvedValue([
      {
        id: 'transcript.example-video',
        type: 'transcript',
        title: 'Example video',
        status: 'seed',
        tags: ['ingested', 'youtube'],
        related: [],
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-08T00:00:00.000Z',
        body: 'structured transcript',
        sourceId: 'example-channel',
        sourceItemId: 'abcdefghijk',
        sourceUrl: 'https://youtu.be/abcdefghijk?t=43',
        sourceType: 'youtube',
        author: 'Example Channel',
        summary: 'usable summary',
        rawLength: 1200,
        cleanLength: 900,
        structuredParagraphs: 3,
        extractedIdeaIds: [],
        extractedSkillIds: [],
      } as unknown as Awaited<ReturnType<typeof listNodes>>[number],
    ]);

    const result = await runIngestionPipeline({
      sourceType: 'youtube',
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
      title: 'Ignored title on duplicate',
      tags: ['test'],
    });

    expect(fetchYouTube).not.toHaveBeenCalled();
    expect(cleanTranscript).not.toHaveBeenCalled();
    expect(structureText).not.toHaveBeenCalled();
    expect(llmExtractWithTrace).not.toHaveBeenCalled();
    expect(createNode).not.toHaveBeenCalled();

    expect(result).toMatchObject({
      id: 'transcript.example-video',
      type: 'transcript',
      producedNodeIds: ['transcript.example-video'],
    });
    expect(result.runTrace?.stages.map((stage) => stage.name)).toEqual(['dedupe:transcript']);
    expect(result.runTrace?.decisions.map((decision) => decision.type)).toEqual(['accept']);
  });
});
