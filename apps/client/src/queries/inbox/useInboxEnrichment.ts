import { useMutation } from '@tanstack/react-query';

import { apiPost } from 'lib/api-client';
import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { buildInboxEnrichmentPrompt, parseInboxEnrichmentSuggestion } from 'lib/inbox-enrichment.utils';
import type { InboxEnrichmentSuggestion } from 'lib/inbox-enrichment.utils';

interface LlmCompleteResponse {
  text?: string;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  error?: string;
}

export interface InboxEnrichmentResult {
  suggestion: InboxEnrichmentSuggestion;
  model?: string;
  provider?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

/** Opt-in AI enrichment for a single inbox capture. Never auto-runs. */
export function useInboxEnrichment() {
  return useMutation({
    mutationFn: async (capture: ParsedInboxCapture): Promise<InboxEnrichmentResult> => {
      const { system, prompt } = buildInboxEnrichmentPrompt(capture);
      const result = await apiPost<LlmCompleteResponse>('/api/llm/complete', {
        task: 'format',
        system,
        prompt,
        maxTokens: 800,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.text) {
        throw new Error('LLM returned an empty enrichment response.');
      }

      return {
        suggestion: parseInboxEnrichmentSuggestion(result.text),
        model: result.model,
        provider: result.provider,
        usage: {
          prompt_tokens: result.promptTokens,
          completion_tokens: result.completionTokens,
        },
      };
    },
  });
}
