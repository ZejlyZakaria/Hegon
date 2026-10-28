export const hasAnyField = (input: object, fields: readonly string[]) => fields.some((f) => Object.prototype.hasOwnProperty.call(input, f));
export const ANALYTICAL_FIELDS = ["history_date", "watched", "in_progress", "want_to_watch", "is_reference", "paused", "dropped", "user_rating", "favorite", "priority", "watched_at", "season_years", "season_ratings", "cour_years", "cour_ratings", "current_season", "current_episode", "tags", "runtime", "episodes", "season_aired", "season_episodes", "cast_members", "directors", "poster_url", "backdrop_url", "title", "year", "release_date"] as const;

export const PEOPLE_FIELDS = ["watched", "in_progress", "paused", "dropped", "is_reference", "cast_members", "directors", "release_date", "year"] as const;
export const PERSON_FIELDS = [...PEOPLE_FIELDS, "want_to_watch", "user_rating", "favorite", "priority", "priority_level", "watched_at", "current_season", "current_episode", "season_aired", "season_episodes", "poster_url", "backdrop_url"] as const;

export const WATCHLIST_FIELDS = ["priority_level", "poster_url", "title", "original_title", "tags", "year", "release_date", "status"] as const;
