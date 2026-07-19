import type { WikiCompileResult, WikiEvidenceItem } from '@llaab/schemas';

export interface CompileWikiDraftInput {
  transcriptId: string;
  canonicalIdeaIds: string[];
  suggestedTitle?: string;
  suggestedTopicKey?: string;
  targetWikiId?: string;
  entryPath: 'manual' | 'automatic';
  forceUpdate?: boolean;
}

export interface CompileWikiDraftOutput {
  draftId: string;
  operation: WikiCompileResult['operation'];
  qualityScore: number;
  warnings: string[];
  selectedCanonicalIdeaCount: number;
  selectedTranscriptCount: number;
  selectedSourceCount: number;
  producedNodeIds: string[];
  evidence: WikiEvidenceItem[];
  runTrace: {
    stages: Array<{ name: string; status: 'completed' | 'failed'; output?: unknown; error?: string }>;
    decisions: Array<{ type: 'accept' | 'retry' | 'reject'; reason: string }>;
    llm?: {
      model: string;
      provider: string;
      duration_ms: number;
      prompt_tokens?: number;
      completion_tokens?: number;
      parsed: boolean;
    };
  };
}
