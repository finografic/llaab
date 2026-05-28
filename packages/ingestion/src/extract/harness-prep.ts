import { createContext, createPipeline } from '@finografic/ai-harness';
import type { HarnessStep } from '@finografic/ai-harness';
import type { ControlContext, ControlStage } from '@llaab/control';

export const EXTRACTION_INPUT_CHAR_LIMIT = 6_000;

const TRANSCRIPT_TRUNCATION_NOTICE = '\n\n[transcript truncated for extraction]';

interface ExtractionPreparationSeed {
  originalText: string;
}

interface TruncatedExtractionInput {
  originalText: string;
  preparedText: string;
  stages: ControlStage[];
  wasTruncated: boolean;
}

export interface PreparedExtractionInput {
  context: ControlContext;
  harnessBudgetSteps: number;
  preparedText: string;
  stages: ControlStage[];
  wasTruncated: boolean;
}

export interface PrepareExtractionInputParams {
  cwd: string;
  input: string;
}

function truncateForExtraction(text: string): { preparedText: string; wasTruncated: boolean } {
  if (text.length <= EXTRACTION_INPUT_CHAR_LIMIT) {
    return {
      preparedText: text,
      wasTruncated: false,
    };
  }

  return {
    preparedText: text.slice(0, EXTRACTION_INPUT_CHAR_LIMIT) + TRANSCRIPT_TRUNCATION_NOTICE,
    wasTruncated: true,
  };
}

const truncateExtractionInputStep: HarnessStep<ExtractionPreparationSeed, TruncatedExtractionInput> = {
  name: 'truncate-extraction-input',
  async run(input) {
    const { preparedText, wasTruncated } = truncateForExtraction(input.originalText);

    return {
      originalText: input.originalText,
      preparedText,
      stages: [
        {
          name: 'harness:truncate-extraction-input',
          status: 'completed',
          input: {
            inputLength: input.originalText.length,
            maxChars: EXTRACTION_INPUT_CHAR_LIMIT,
          },
          output: {
            preparedLength: preparedText.length,
            truncated: wasTruncated,
          },
        },
      ],
      wasTruncated,
    };
  },
};

const buildExtractionContextStep: HarnessStep<TruncatedExtractionInput, PreparedExtractionInput> = {
  name: 'build-extraction-context',
  async run(input) {
    const context: ControlContext = {
      instructions: 'Return structured extracted knowledge as JSON.',
      data: input.preparedText,
      constraints: ['summary must be non-empty', 'output must be valid JSON'],
    };

    return {
      context,
      harnessBudgetSteps: 0,
      preparedText: input.preparedText,
      stages: [
        ...input.stages,
        {
          name: 'harness:build-extraction-context',
          status: 'completed',
          input: {
            preparedLength: input.preparedText.length,
            truncated: input.wasTruncated,
          },
          output: {
            constraintCount: context.constraints?.length ?? 0,
            hasInstructions: context.instructions != null,
          },
        },
      ],
      wasTruncated: input.wasTruncated,
    };
  },
};

const extractionPreparationPipeline = createPipeline({
  steps: [truncateExtractionInputStep, buildExtractionContextStep],
});

export async function prepareExtractionInput({
  cwd,
  input,
}: PrepareExtractionInputParams): Promise<PreparedExtractionInput> {
  const harnessContext = createContext({ cwd });
  const prepared = (await extractionPreparationPipeline.run(
    {
      originalText: input,
    },
    harnessContext,
  )) as PreparedExtractionInput;

  return {
    ...prepared,
    harnessBudgetSteps: harnessContext.budget.steps,
  };
}
