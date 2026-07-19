import type {
  WikiCompileResult,
  WikiEvidenceItem,
  WikiEvidenceMetrics,
  WikiOperation,
  WikiTopicProposal,
} from '@llaab/schemas';

export interface CompileWikiDraftInput {
  transcriptId: string;
  /** Flattened idea ids (primary ∪ supporting) for source resolution compatibility. */
  canonicalIdeaIds: string[];
  primaryCanonicalIdeaIds?: string[];
  supportingCanonicalIdeaIds?: string[];
  /** Internally validated discovery proposal for one compile invocation. */
  proposal?: Pick<
    WikiTopicProposal,
    | 'id'
    | 'discovery_batch_id'
    | 'topic_key'
    | 'title'
    | 'rationale'
    | 'primary_canonical_idea_ids'
    | 'supporting_canonical_idea_ids'
    | 'domains'
    | 'tags'
    | 'operation'
    | 'existing_wiki_id'
    | 'coherence_score'
    | 'warnings'
  >;
  discoveryBatchId?: string;
  /** Parent Create Wiki(s) / orchestration run id for lineage. */
  parentRunId?: string;
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
  /** @deprecated Prefer `evidenceMetrics.unique_source_node_count`. */
  selectedSourceCount: number;
  evidenceMetrics: WikiEvidenceMetrics;
  producedNodeIds: string[];
  evidence: WikiEvidenceItem[];
  /** Harmless schema-drift fixes applied before validation. */
  normalizationActions: string[];
  /** True when mechanical/source-shaped coherence gates failed. */
  coherenceFailed: boolean;
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

export type CompileWikiDraftProposalOperation = Extract<
  WikiOperation,
  'create' | 'update' | 'no-op' | 'needs-review'
>;
