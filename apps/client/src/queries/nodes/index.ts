export const QUERY_KEYS = {
  nodes: {
    all: ['nodes'] as const,
    detail: (id: string) => [...QUERY_KEYS.nodes.all, 'detail', id] as const,
    tags: (id: string) => [...QUERY_KEYS.nodes.all, 'tags', id] as const,
    tagsByUsage: () => [...QUERY_KEYS.nodes.all, 'tags-by-usage'] as const,
  },
};

export { useCreateIdea } from './useCreateIdea';
export { useNodeTags, useVaultTagsByUsage, fetchNodeTags } from './useNodeTags';
export type { CreateIdeaInput, CreateIdeaResult } from './useCreateIdea';
