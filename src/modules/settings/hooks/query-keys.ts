export const SETTINGS_KEYS = {
  all: ['settings'] as const,
  profile: () => [...SETTINGS_KEYS.all, 'profile'] as const,
  preferences: () => [...SETTINGS_KEYS.all, 'preferences'] as const,
} as const;
