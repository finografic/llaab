import type { SkillRunRecord } from '../runner.js';
import type { LabNode, NodeType, TranscriptNode } from '@llaab/schemas';

import { extractTranscriptIdeas } from '../extract-transcript-ideas.js';

export interface SkillRoute {
  nodeType: NodeType;
  skill: string;
  execute: (node: LabNode) => Promise<{ record: SkillRunRecord }>;
  filter?: (node: LabNode) => boolean;
}

export const REGISTRY: SkillRoute[] = [
  {
    nodeType: 'transcript',
    skill: 'extract-transcript-ideas',
    execute: (node) => extractTranscriptIdeas({ transcript: node as TranscriptNode }),
  },
  // Source Auto-Follow — uncomment when that feature is built:
  // {
  //   nodeType: 'source',
  //   skill: 'ingest-youtube',
  //   execute: (node) => ingestYouTube({ url: (node as SourceNode).platforms[0]?.url ?? '' }),
  //   filter: (node) => (node as SourceNode).follow === true,
  // },
];

export function getRoutesFor(nodeType: NodeType): SkillRoute[] {
  return REGISTRY.filter((r) => r.nodeType === nodeType);
}
