import type { TokenCounter } from '@finografic/ai-harness';
import { describe, expect, it } from 'vitest';

import { readArticleFixture } from '../fetch/article/__fixtures__/index.js';
import { parseArticle } from '../fetch/article/article.parse.js';
import {
  APPROX_CHARS_PER_TOKEN,
  DEFAULT_MODEL_CONTEXT_TOKENS,
  EXTRACTION_CHUNK_OVERLAP_TOKENS,
  EXTRACTION_MAX_INPUT_TOKENS,
  prepareExtractionInput,
} from './harness-prep.js';

const exactCharacterTokenCounter: TokenCounter<string> = {
  name: 'test-exact-character-counter',
  version: '1',
  count(content) {
    return {
      count: content.length,
      counter: { name: this.name, version: this.version },
      method: 'exact',
    };
  },
};

function semanticArticleText(): string {
  const article = parseArticle({
    finalUrl: 'https://signal.example.com/posts/bounded-fetching',
    html: readArticleFixture('semanticArticle'),
    requestedUrl: 'https://signal.example.com/posts/bounded-fetching',
  });
  if (!article.ok) throw new Error('Expected the semantic article fixture to parse');
  return article.plainText;
}

function legacyFallbackChunks(text: string) {
  const maxCharacters = EXTRACTION_MAX_INPUT_TOKENS * APPROX_CHARS_PER_TOKEN;
  const overlapCharacters = EXTRACTION_CHUNK_OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;
  const chunks = [];

  for (let startChar = 0; startChar < text.length; startChar += maxCharacters - overlapCharacters) {
    const endChar = Math.min(startChar + maxCharacters, text.length);
    const chunkText = text.slice(startChar, endChar);
    chunks.push({
      endChar,
      estimatedTokens: Math.ceil(chunkText.length / APPROX_CHARS_PER_TOKEN),
      index: chunks.length,
      startChar,
      text: chunkText,
    });
    if (endChar === text.length) break;
  }

  return chunks;
}

describe('prepareExtractionInput', () => {
  it('builds structured control context for extraction', async () => {
    const result = await prepareExtractionInput({
      contextLimitTokens: DEFAULT_MODEL_CONTEXT_TOKENS,
      cwd: process.cwd(),
      input: 'example transcript',
      model: 'llama3:latest',
    });

    expect(result.preparedText).toBe('example transcript');
    expect(result.chunks).toHaveLength(1);
    expect(result.wasChunked).toBe(false);
    expect(result.wasTruncated).toBe(false);
    expect(result.harnessBudgetSteps).toBe(4);
    expect(result.context).toEqual({
      constraints: ['summary must be non-empty', 'output must be valid JSON'],
      data: {
        chunkCount: 1,
        contextLimitTokens: DEFAULT_MODEL_CONTEXT_TOKENS,
        estimatedInputTokens: 5,
        model: 'llama3:latest',
        tokenCountMethod: 'estimated',
        tokenCounter: {
          name: 'llaab-character-heuristic',
          version: '1',
        },
      },
      instructions: 'Return structured extracted knowledge as JSON.',
    });
    expect(result.stages.map((stage) => stage.name)).toEqual([
      'harness:count-extraction-tokens',
      'harness:chunk-and-pack-context',
      'harness:build-extraction-context',
      'harness:validate-budget',
    ]);
    expect(result.stages.every((stage) => stage.status === 'completed')).toBe(true);
  });

  it('chunks long input instead of truncating it', async () => {
    const result = await prepareExtractionInput({
      contextLimitTokens: DEFAULT_MODEL_CONTEXT_TOKENS,
      cwd: process.cwd(),
      input: 'x'.repeat(EXTRACTION_MAX_INPUT_TOKENS * 4 + 50),
      model: 'llama3:latest',
    });

    expect(result.wasTruncated).toBe(false);
    expect(result.wasChunked).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.preparedText).not.toContain('[transcript truncated for extraction]');
    expect(result.chunks.every((chunk) => chunk.estimatedTokens <= result.maxInputTokens)).toBe(true);
    expect(Math.max(...result.chunks.map((chunk) => chunk.estimatedTokens))).toBe(result.maxInputTokens);
  });

  it('uses a supplied token counter and preserves the model response reserve', async () => {
    const result = await prepareExtractionInput({
      contextLimitTokens: 2_048,
      cwd: process.cwd(),
      input: 'exact counter',
      model: 'test-model',
      tokenCounter: exactCharacterTokenCounter,
    });

    expect(result.contextLimitTokens).toBe(2_048);
    expect(result.maxInputTokens).toBe(1_024);
    expect(result.estimatedInputTokens).toBe(13);
    expect(result.inputTokenCount).toEqual({
      count: 13,
      counter: {
        name: 'test-exact-character-counter',
        version: '1',
      },
      method: 'exact',
    });
  });

  it('preserves fallback outputs for short and long article fixtures', async () => {
    const shortArticle = semanticArticleText();
    const repetitionCount = Math.ceil(
      (EXTRACTION_MAX_INPUT_TOKENS * APPROX_CHARS_PER_TOKEN + 1) / shortArticle.length,
    );
    const longArticle = Array.from({ length: repetitionCount }, () => shortArticle).join('\n\n');

    for (const input of [shortArticle, longArticle]) {
      const result = await prepareExtractionInput({
        contextLimitTokens: DEFAULT_MODEL_CONTEXT_TOKENS,
        cwd: process.cwd(),
        input,
        model: 'fixture-model',
      });

      expect(result.chunks).toEqual(legacyFallbackChunks(input));
      expect(result.estimatedInputTokens).toBe(Math.ceil(input.length / APPROX_CHARS_PER_TOKEN));
      expect(result.wasTruncated).toBe(false);
    }
  });
});
