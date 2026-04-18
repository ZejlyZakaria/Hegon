// =====================================================
// F1 QUERY KEYS
// =====================================================

export const F1_KEYS = {
  all: ['f1'] as const,
  page: () => [...F1_KEYS.all, 'page'] as const,
} as const;
