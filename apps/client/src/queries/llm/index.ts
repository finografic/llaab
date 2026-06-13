export const QUERY_KEYS = {
  llm: {
    all: ['llm'] as const,
    status: () => [...QUERY_KEYS.llm.all, 'status'] as const,
  },
};
