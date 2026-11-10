alter table watching.episode_highlights
add column source_episode integer;

alter table watching.episode_highlights
add constraint episode_highlights_source_episode_check
check (source_episode is null or source_episode >= 1);

comment on column watching.episode_highlights.source_episode is
'Original episode number returned by the provider. episode is the canonical HEGON season-local coordinate used for progress and rules; source_episode is display metadata only.';