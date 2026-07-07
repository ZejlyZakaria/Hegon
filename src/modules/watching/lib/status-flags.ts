// Spread into any "positive" status write (Mark as watched / Start watching / Want
// to watch) so it always clears the on-hold + abandoned flags. Guarantees a media
// is never in two states at once (deriveWatchStatus checks dropped/paused first, so
// a lingering flag would win over watched/in_progress). Single source of truth.
export const RESET_STATUS = { dropped: false, paused: false, drop_reason: null } as const;
