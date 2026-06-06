import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@llaab/core', () => ({
  autoTag: vi.fn(() => []),
  createNode: vi.fn(),
  getNodeFilePath: vi.fn(),
  listNodes: vi.fn(),
  updateNode: vi.fn(),
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
  normalizeContentTags: vi.fn((tags: string[]) =>
    tags.map((tag) => tag.toLocaleLowerCase().replace(/\s+/g, '-')).filter((tag) => tag.length > 0),
  ),
}));

import { autoTag, createNode, getNodeFilePath, listNodes, updateNode } from '@llaab/core';

import { cleanTranscript } from './clean/transcript.js';
import { llmExtractWithTrace } from './extract/llm-extract.js';
import { fetchYouTube, parseYouTubeUrl } from './fetch/youtube.js';
import { extractKnowledgeFromTranscript, runIngestionPipeline } from './pipeline.js';
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
      channelUrl: 'https://www.youtube.com/@ExampleChannel',
      uploadedDisplay: '2026-04-08 00:00:00',
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
      tags: [],
      llmMeta: {
        model: 'llama3.1:8b',
        provider: 'ollama',
        durationMs: 150,
      },
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
          model: 'llama3.1:8b',
          provider: 'ollama',
          duration_ms: 150,
          raw_output: '{"summary":"usable summary"}',
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
          created_at: '2026-04-08T00:00:00Z',
          updated_at: '2026-04-08T00:00:00Z',
          body: '# Example video\n\n[**https://www.youtube.com/watch?v=abcdefghijk**](https://www.youtube.com/watch?v=abcdefghijk)\n**author:** [**example-channel**](https://www.youtube.com/@ExampleChannel)\n**uploaded:** 2026-04-08 00:00:00\n**ingested:** 2026-04-08 00:00:00\n\n## Transcript\n\nstructured transcript',
          source_id: 'example-channel',
          source_url: 'https://www.youtube.com/watch?v=abcdefghijk',
          source_type: 'youtube',
          author: 'Example Channel',
          summary: 'usable summary',
          raw_length: 1200,
          clean_length: 900,
          structured_paragraphs: 3,
          extracted_idea_ids: [],
          extracted_skill_ids: [],
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
          created_at: '2026-04-08T00:00:00Z',
          updated_at: '2026-04-08T00:00:00Z',
          body: '',
          source_kind: 'channel',
          url: 'https://www.youtube.com/@ExampleChannel',
          platforms: ['youtube'],
          follow: false,
        },
      });

    const result = await runIngestionPipeline({
      sourceType: 'youtube',
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
      tags: ['test'],
    });

    expect(result.producedNodeIds).toEqual(['transcript.example-video', 'example-channel']);
    expect(result.runTrace?.stages.map((stage) => stage.name)).toEqual([
      'fetch:youtube',
      'clean:transcript',
      'sanitize:transcript',
      'structure:text',
      'store:transcript',
      'store:source',
    ]);
    expect(createNode).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'transcript',
        title: 'Example video',
        body: expect.stringMatching(
          /^# Example video\n\n\[\*\*https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk\*\*]\(https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk\)\n\*\*author:\*\* \[\*\*example-channel\*\*]\(https:\/\/www\.youtube\.com\/@ExampleChannel\)\n\*\*uploaded:\*\* 2026-04-08 00:00:00\n\*\*ingested:\*\* \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\n\n## Transcript\n\nstructured transcript$/,
        ),
        extra: expect.objectContaining({
          source_item_id: 'abcdefghijk',
          source_url: 'https://www.youtube.com/watch?v=abcdefghijk',
        }),
      }),
    );
    expect(result.runTrace?.decisions).toEqual([]);
    expect(result.runTrace?.llm).toBeUndefined();
  });

  it('uses transcript.untitled_{datetime} id when youtube metadata has no title and no override', async () => {
    vi.mocked(getNodeFilePath).mockImplementation((type, id) => `/vault/${type}s/${type}.${id}.md`);
    vi.mocked(parseYouTubeUrl).mockReturnValue({
      url: 'https://www.youtube.com/watch?v=uniqueUntitled01',
      videoId: 'uniqueUntitled01',
    });
    vi.mocked(listNodes).mockResolvedValue([]);
    vi.mocked(fetchYouTube).mockResolvedValue({
      title: '',
      channel: 'Example Channel',
      description: '',
      rawTranscript: 'raw transcript',
      duration: 120,
      uploadDate: '20260408',
      channelUrl: 'https://www.youtube.com/@ExampleChannel',
      uploadedDisplay: '2026-04-08 00:00:00',
    });
    vi.mocked(cleanTranscript).mockReturnValue({
      cleanedText: 'clean transcript',
      rawLength: 10,
      cleanLength: 10,
    });
    vi.mocked(structureText).mockReturnValue({
      structuredContent: 'structured transcript',
      paragraphCount: 1,
    });
    vi.mocked(llmExtractWithTrace).mockResolvedValue({
      ideas: [],
      skills: [],
      summary: 'usable summary',
      tags: [],
      llmMeta: {
        model: 'llama3.1:8b',
        provider: 'ollama',
        durationMs: 150,
      },
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
          model: 'llama3.1:8b',
          provider: 'ollama',
          duration_ms: 150,
          raw_output: '{"summary":"usable summary"}',
          parsed: true,
        },
      },
    });
    vi.mocked(createNode)
      .mockResolvedValueOnce({
        id: 'untitled_2026-04-12T15-59-39',
        path: '/vault/transcripts/transcript.untitled_2026-04-12T15-59-39.md',
        node: {} as never,
      })
      .mockResolvedValueOnce({
        id: 'example-channel',
        path: '/vault/sources/source.example-channel.md',
        node: {} as never,
      });

    await runIngestionPipeline({
      sourceType: 'youtube',
      url: 'https://www.youtube.com/watch?v=uniqueUntitled01',
      tags: ['test'],
    });

    expect(createNode).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'transcript',
        id: expect.stringMatching(/^untitled_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/),
        title: 'Untitled transcript',
        body: expect.stringMatching(
          /^# Untitled transcript\n\n\[\*\*https:\/\/www\.youtube\.com\/watch\?v=uniqueUntitled01\*\*]\(https:\/\/www\.youtube\.com\/watch\?v=uniqueUntitled01\)\n\*\*author:\*\* \[\*\*example-channel\*\*]\(https:\/\/www\.youtube\.com\/@ExampleChannel\)\n\*\*uploaded:\*\* 2026-04-08 00:00:00\n\*\*ingested:\*\* \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\n\n## Transcript\n\nstructured transcript$/,
        ),
      }),
    );
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
        created_at: '2026-04-08T00:00:00Z',
        updated_at: '2026-04-08T00:00:00Z',
        body: 'structured transcript',
        source_id: 'example-channel',
        source_item_id: 'abcdefghijk',
        source_url: 'https://youtu.be/abcdefghijk?t=43',
        source_type: 'youtube',
        author: 'Example Channel',
        summary: 'usable summary',
        raw_length: 1200,
        clean_length: 900,
        structured_paragraphs: 3,
        extracted_idea_ids: [],
        extracted_skill_ids: [],
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

  it('merges domain, content, and manual tags onto extracted transcript ideas', async () => {
    vi.mocked(autoTag).mockImplementation((_title, body) => (body.includes('Gemma') ? ['d:llm'] : []));
    vi.mocked(llmExtractWithTrace).mockResolvedValue({
      ideas: ['Gemma 4 runs as an open-weight local model'],
      skills: ['local inference'],
      summary: 'Gemma 4 supports local open-weight inference.',
      tags: ['Gemma 4', 'Open Weight', 'edge inference'],
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
    vi.mocked(updateNode).mockImplementation(async (_path, updater) => ({
      path: '/vault/transcripts/transcript.gemma.md',
      node: updater({
        id: 'transcript.gemma',
        type: 'transcript',
        title: 'Master Gemma 4 in 20 Minutes',
        status: 'seed',
        tags: ['d:ingest', 'manual'],
        related: [],
        created_at: '2026-04-08T00:00:00Z',
        updated_at: '2026-04-08T00:00:00Z',
        body: '',
        source_id: 'example-channel',
        source_url: 'https://www.youtube.com/watch?v=gemma',
        source_type: 'youtube',
        author: 'Example Channel',
        extracted_idea_ids: [],
        extracted_skill_ids: [],
      }),
    }));
    vi.mocked(createNode).mockResolvedValue({
      id: 'idea.gemma-4-runs-as-an-open-weight-local-model',
      path: '/vault/ideas/idea.gemma-4-runs-as-an-open-weight-local-model.md',
      node: {} as never,
    });

    await extractKnowledgeFromTranscript(
      'transcript.gemma',
      '/vault/transcripts/transcript.gemma.md',
      'Gemma 4 is an open weight model for edge inference with a long context window.',
      ['manual'],
    );

    expect(updateNode).toHaveBeenNthCalledWith(
      1,
      '/vault/transcripts/transcript.gemma.md',
      expect.any(Function),
    );
    await expect(vi.mocked(updateNode).mock.results[0]?.value).resolves.toMatchObject({
      node: {
        tags: ['d:ingest', 'manual', 'd:llm', 'gemma-4', 'open-weight', 'edge-inference'],
      },
    });
    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'idea',
        tags: ['d:ingest', 'manual', 'd:llm', 'gemma-4', 'open-weight', 'edge-inference'],
      }),
    );
  });
});
