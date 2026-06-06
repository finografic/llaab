import { createContext, createPipeline } from '@finografic/ai-harness';
import type { HarnessStep } from '@finografic/ai-harness';
import type { ControlContext, ControlStage } from '@llaab/control';

export const APPROX_CHARS_PER_TOKEN = 4;
export const DEFAULT_MODEL_CONTEXT_TOKENS = 8_192;
export const EXTRACTION_OUTPUT_TOKEN_RESERVE = 1_024;
export const EXTRACTION_CHUNK_OVERLAP_TOKENS = 128;
export const EXTRACTION_MAX_INPUT_TOKENS = DEFAULT_MODEL_CONTEXT_TOKENS - EXTRACTION_OUTPUT_TOKEN_RESERVE;

interface ExtractionPreparationSeed {
  model: string;
  originalText: string;
}

interface TokenCountedExtractionInput extends ExtractionPreparationSeed {
  estimatedTokens: number;
  maxInputTokens: number;
  stages: ControlStage[];
}

export interface PreparedExtractionChunk {
  endChar: number;
  estimatedTokens: number;
  index: number;
  startChar: number;
  text: string;
}

interface ChunkedExtractionInput extends TokenCountedExtractionInput {
  chunks: PreparedExtractionChunk[];
  wasChunked: boolean;
}

interface ContextualExtractionInput extends ChunkedExtractionInput {
  context: ControlContext;
}

export interface PreparedExtractionInput {
  chunks: PreparedExtractionChunk[];
  context: ControlContext;
  estimatedInputTokens: number;
  harnessBudgetSteps: number;
  maxInputTokens: number;
  model: string;
  preparedText: string;
  stages: ControlStage[];
  wasChunked: boolean;
  wasTruncated: boolean;
}

export interface PrepareExtractionInputParams {
  cwd: string;
  input: string;
  model: string;
}

function estimateTokens(text: string): number {
  // TODO: Graduate this approximation to @finografic/ai-harness when countTokens lands.
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

function maxInputTokensForModel(_model: string): number {
  return EXTRACTION_MAX_INPUT_TOKENS;
}

function chunkText(text: string, maxInputTokens: number): PreparedExtractionChunk[] {
  const maxChars = maxInputTokens * APPROX_CHARS_PER_TOKEN;
  const overlapChars = EXTRACTION_CHUNK_OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;
  const strideChars = maxChars - overlapChars;
  if (strideChars <= 0) {
    throw new Error('Extraction chunk overlap must be smaller than the chunk size');
  }

  const chunks: PreparedExtractionChunk[] = [];
  let startChar = 0;
  while (startChar < text.length) {
    const endChar = Math.min(startChar + maxChars, text.length);
    const chunk = text.slice(startChar, endChar);
    chunks.push({
      endChar,
      estimatedTokens: estimateTokens(chunk),
      index: chunks.length,
      startChar,
      text: chunk,
    });

    if (endChar === text.length) break;
    startChar += strideChars;
  }

  return chunks;
}

const countExtractionTokensStep: HarnessStep<ExtractionPreparationSeed, TokenCountedExtractionInput> = {
  name: 'count-extraction-tokens',
  async run(input) {
    const estimatedTokens = estimateTokens(input.originalText);
    const maxInputTokens = maxInputTokensForModel(input.model);

    return {
      ...input,
      estimatedTokens,
      maxInputTokens,
      stages: [
        {
          name: 'harness:count-extraction-tokens',
          status: 'completed',
          input: {
            inputLength: input.originalText.length,
            model: input.model,
          },
          output: {
            approximation: true,
            charsPerToken: APPROX_CHARS_PER_TOKEN,
            estimatedTokens,
            maxInputTokens,
          },
        },
      ],
    };
  },
};

const chunkIfNeededStep: HarnessStep<TokenCountedExtractionInput, ChunkedExtractionInput> = {
  name: 'chunk-if-needed',
  async run(input) {
    const chunks =
      input.estimatedTokens <= input.maxInputTokens
        ? [
            {
              endChar: input.originalText.length,
              estimatedTokens: input.estimatedTokens,
              index: 0,
              startChar: 0,
              text: input.originalText,
            },
          ]
        : chunkText(input.originalText, input.maxInputTokens);
    const wasChunked = chunks.length > 1;

    return {
      ...input,
      chunks,
      stages: [
        ...input.stages,
        {
          name: 'harness:chunk-if-needed',
          status: 'completed',
          input: {
            estimatedTokens: input.estimatedTokens,
            maxInputTokens: input.maxInputTokens,
            overlapTokens: EXTRACTION_CHUNK_OVERLAP_TOKENS,
          },
          output: {
            chunkCount: chunks.length,
            chunked: wasChunked,
            maxChunkTokens: Math.max(...chunks.map((chunk) => chunk.estimatedTokens)),
          },
        },
      ],
      wasChunked,
    };
  },
};

const buildExtractionContextStep: HarnessStep<ChunkedExtractionInput, ContextualExtractionInput> = {
  name: 'build-extraction-context',
  async run(input) {
    const context: ControlContext = {
      instructions: 'Return structured extracted knowledge as JSON.',
      data: {
        chunkCount: input.chunks.length,
        estimatedInputTokens: input.estimatedTokens,
        model: input.model,
      },
      constraints: ['summary must be non-empty', 'output must be valid JSON'],
    };

    return {
      ...input,
      context,
      stages: [
        ...input.stages,
        {
          name: 'harness:build-extraction-context',
          status: 'completed',
          input: {
            chunkCount: input.chunks.length,
            chunked: input.wasChunked,
          },
          output: {
            constraintCount: context.constraints?.length ?? 0,
            hasInstructions: context.instructions != null,
          },
        },
      ],
    };
  },
};

const validateBudgetStep: HarnessStep<ContextualExtractionInput, PreparedExtractionInput> = {
  name: 'validate-budget',
  async run(input) {
    const maxChunkTokens = Math.max(...input.chunks.map((chunk) => chunk.estimatedTokens));
    if (maxChunkTokens > input.maxInputTokens) {
      throw new Error(
        `Extraction chunk exceeds budget: ${maxChunkTokens} estimated tokens > ${input.maxInputTokens}`,
      );
    }

    return {
      chunks: input.chunks,
      context: input.context,
      estimatedInputTokens: input.estimatedTokens,
      harnessBudgetSteps: 0,
      maxInputTokens: input.maxInputTokens,
      model: input.model,
      preparedText: input.chunks.map((chunk) => chunk.text).join('\n\n'),
      stages: [
        ...input.stages,
        {
          name: 'harness:validate-budget',
          status: 'completed',
          input: {
            chunkCount: input.chunks.length,
            maxChunkTokens,
            maxInputTokens: input.maxInputTokens,
          },
          output: {
            valid: true,
          },
        },
      ],
      wasChunked: input.wasChunked,
      wasTruncated: false,
    };
  },
};

const extractionPreparationPipeline = createPipeline({
  steps: [countExtractionTokensStep, chunkIfNeededStep, buildExtractionContextStep, validateBudgetStep],
});

export async function prepareExtractionInput({
  cwd,
  input,
  model,
}: PrepareExtractionInputParams): Promise<PreparedExtractionInput> {
  const harnessContext = createContext({ cwd });
  const prepared = (await extractionPreparationPipeline.run(
    {
      model,
      originalText: input,
    },
    harnessContext,
  )) as PreparedExtractionInput;

  return {
    ...prepared,
    harnessBudgetSteps: harnessContext.budget.steps,
  };
}
