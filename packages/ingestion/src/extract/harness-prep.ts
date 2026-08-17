import {
  characterChunkStrategy,
  chunkTextCandidate,
  createCharacterHeuristicTokenCounter,
  createContext,
  createPipeline,
  harnessEventsToControlStages,
  prepareContextPack,
} from '@finografic/ai-harness';
import type { ContextCandidate, HarnessStep, TokenCount, TokenCounter } from '@finografic/ai-harness';
import { ollamaGetModelContextLength } from '@llaab/llm';
import type { ControlContext, ControlStage } from '@llaab/control';

export const APPROX_CHARS_PER_TOKEN = 4;
export const DEFAULT_MODEL_CONTEXT_TOKENS = 8_192;
export const EXTRACTION_OUTPUT_TOKEN_RESERVE = 1_024;
export const EXTRACTION_CHUNK_OVERLAP_TOKENS = 128;
export const EXTRACTION_MAX_INPUT_TOKENS = DEFAULT_MODEL_CONTEXT_TOKENS - EXTRACTION_OUTPUT_TOKEN_RESERVE;

const EXTRACTION_CONTEXT_POLICY_ID = 'llaab-extraction-v1';
const EXTRACTION_INPUT_CANDIDATE_ID = 'extraction-input';

interface ExtractionPreparationSeed {
  contextLimitTokens: number;
  maxInputTokens: number;
  model: string;
  originalText: string;
  tokenCounter: TokenCounter<string>;
}

interface TokenCountedExtractionInput extends ExtractionPreparationSeed {
  inputTokenCount: TokenCount;
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

interface PreparedExtractionPipelineOutput {
  chunks: PreparedExtractionChunk[];
  context: ControlContext;
  contextLimitTokens: number;
  estimatedInputTokens: number;
  inputTokenCount: TokenCount;
  maxInputTokens: number;
  model: string;
  preparedText: string;
  wasChunked: boolean;
  wasTruncated: boolean;
}

export interface PreparedExtractionInput extends PreparedExtractionPipelineOutput {
  harnessBudgetSteps: number;
  stages: ControlStage[];
}

export interface PrepareExtractionInputParams {
  contextLimitTokens?: number;
  cwd: string;
  input: string;
  model: string;
  tokenCounter?: TokenCounter<string>;
}

const fallbackTokenCounter = createCharacterHeuristicTokenCounter({
  charactersPerToken: APPROX_CHARS_PER_TOKEN,
  name: 'llaab-character-heuristic',
  version: '1',
});

async function resolveContextLimitTokens(model: string, suppliedLimit?: number): Promise<number> {
  if (suppliedLimit !== undefined) {
    if (!Number.isInteger(suppliedLimit) || suppliedLimit <= EXTRACTION_OUTPUT_TOKEN_RESERVE) {
      throw new RangeError(
        `contextLimitTokens must be an integer greater than ${EXTRACTION_OUTPUT_TOKEN_RESERVE}`,
      );
    }
    return suppliedLimit;
  }

  return (await ollamaGetModelContextLength(model)) ?? DEFAULT_MODEL_CONTEXT_TOKENS;
}

function createExtractionCandidate(text: string): ContextCandidate<string> {
  return {
    category: 'extraction-input',
    content: text,
    id: EXTRACTION_INPUT_CANDIDATE_ID,
    relevance: 1,
    source: {
      id: EXTRACTION_INPUT_CANDIDATE_ID,
      kind: 'extraction-input',
      sensitivity: 'internal',
      trust: 'trusted',
    },
  };
}

function resolveChunkDimensions(
  text: string,
  inputTokens: number,
  maxInputTokens: number,
): { maxCharacters: number; overlapCharacters: number } {
  const observedCharactersPerToken = inputTokens > 0 ? text.length / inputTokens : APPROX_CHARS_PER_TOKEN;
  const maxCharacters = Math.max(1, Math.floor(maxInputTokens * observedCharactersPerToken));
  const requestedOverlap = Math.floor(EXTRACTION_CHUNK_OVERLAP_TOKENS * observedCharactersPerToken);

  return {
    maxCharacters,
    overlapCharacters: Math.min(requestedOverlap, Math.max(0, maxCharacters - 1)),
  };
}

const countExtractionTokensStep: HarnessStep<ExtractionPreparationSeed, TokenCountedExtractionInput> = {
  name: 'count-extraction-tokens',
  async run(input) {
    return {
      ...input,
      inputTokenCount: await input.tokenCounter.count(input.originalText),
    };
  },
};

const chunkAndPackContextStep: HarnessStep<TokenCountedExtractionInput, ChunkedExtractionInput> = {
  name: 'chunk-and-pack-context',
  async run(input) {
    const candidate = createExtractionCandidate(input.originalText);
    const dimensions = resolveChunkDimensions(
      input.originalText,
      input.inputTokenCount.count,
      input.maxInputTokens,
    );
    const candidates =
      input.inputTokenCount.count <= input.maxInputTokens
        ? [candidate]
        : chunkTextCandidate(candidate, {
            ...dimensions,
            strategy: characterChunkStrategy,
          });
    const packedCandidates = await Promise.all(
      candidates.map(async (chunkCandidate) => {
        const contextPack = await prepareContextPack({
          budget: {
            maxTokens: input.contextLimitTokens,
            reservedOutputTokens: EXTRACTION_OUTPUT_TOKEN_RESERVE,
          },
          candidates: [chunkCandidate],
          policyId: EXTRACTION_CONTEXT_POLICY_ID,
          tokenCounter: input.tokenCounter,
        });
        const packedCandidate = contextPack.candidates[0];
        if (!packedCandidate) {
          throw new Error(
            `Extraction chunk exceeds the ${contextPack.budget.usableInputTokens}-token input budget`,
          );
        }
        return packedCandidate;
      }),
    );
    const strideCharacters = dimensions.maxCharacters - dimensions.overlapCharacters;
    const chunks = packedCandidates.map((packedCandidate, index): PreparedExtractionChunk => {
      const startChar = candidates.length === 1 ? 0 : index * strideCharacters;
      return {
        endChar: startChar + packedCandidate.content.length,
        estimatedTokens: packedCandidate.cost.tokens.count,
        index,
        startChar,
        text: packedCandidate.content,
      };
    });

    return {
      ...input,
      chunks,
      wasChunked: chunks.length > 1,
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
        contextLimitTokens: input.contextLimitTokens,
        estimatedInputTokens: input.inputTokenCount.count,
        model: input.model,
        tokenCountMethod: input.inputTokenCount.method,
        tokenCounter: input.inputTokenCount.counter,
      },
      constraints: ['summary must be non-empty', 'output must be valid JSON'],
    };

    return {
      ...input,
      context,
    };
  },
};

const validateBudgetStep: HarnessStep<ContextualExtractionInput, PreparedExtractionPipelineOutput> = {
  name: 'validate-budget',
  async run(input) {
    const maxChunkTokens = Math.max(0, ...input.chunks.map((chunk) => chunk.estimatedTokens));
    if (maxChunkTokens > input.maxInputTokens) {
      throw new Error(`Extraction chunk exceeds budget: ${maxChunkTokens} tokens > ${input.maxInputTokens}`);
    }

    return {
      chunks: input.chunks,
      context: input.context,
      contextLimitTokens: input.contextLimitTokens,
      estimatedInputTokens: input.inputTokenCount.count,
      inputTokenCount: input.inputTokenCount,
      maxInputTokens: input.maxInputTokens,
      model: input.model,
      preparedText: input.chunks.map((chunk) => chunk.text).join('\n\n'),
      wasChunked: input.wasChunked,
      wasTruncated: false,
    };
  },
};

const extractionPreparationPipeline = createPipeline({
  steps: [countExtractionTokensStep, chunkAndPackContextStep, buildExtractionContextStep, validateBudgetStep],
});

export async function prepareExtractionInput({
  contextLimitTokens: suppliedContextLimitTokens,
  cwd,
  input,
  model,
  tokenCounter = fallbackTokenCounter,
}: PrepareExtractionInputParams): Promise<PreparedExtractionInput> {
  const contextLimitTokens = await resolveContextLimitTokens(model, suppliedContextLimitTokens);
  const harnessContext = createContext({ cwd });
  const prepared = await extractionPreparationPipeline.run(
    {
      contextLimitTokens,
      maxInputTokens: contextLimitTokens - EXTRACTION_OUTPUT_TOKEN_RESERVE,
      model,
      originalText: input,
      tokenCounter,
    },
    harnessContext,
  );

  return {
    ...prepared,
    harnessBudgetSteps: harnessContext.budget.steps,
    stages: harnessEventsToControlStages(harnessContext.events),
  };
}
