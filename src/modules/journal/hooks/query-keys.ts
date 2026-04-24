export const JOURNAL_KEYS = {
  all:      ['journal'] as const,
  today:    () => [...JOURNAL_KEYS.all, 'today'] as const,
  byDate:   (date: string) => [...JOURNAL_KEYS.all, 'entry', date] as const,
  list:     (opts?: { search?: string; mood?: string; offset?: number }) =>
    [...JOURNAL_KEYS.all, 'list', opts ?? {}] as const,
  calendar: (year: number, month: number) => [...JOURNAL_KEYS.all, 'calendar', year, month] as const,
  streak:   () => [...JOURNAL_KEYS.all, 'streak'] as const,
} as const;
