"use client";

import type { WatchingMedia } from "../../types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold text-text-primary">{children}</h2>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-text-tertiary">{label}</span>
      <span className="text-right text-xs font-medium text-text-secondary">{value}</span>
    </div>
  );
}

interface Props {
  media: WatchingMedia;
  typeLabel: string;
  isSeries: boolean;
}

export function MediaDetails({ media, typeLabel, isSeries }: Props) {
  return (
    <section>
      <SectionLabel>Details</SectionLabel>
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-1/40">
        <div className="divide-y divide-border-subtle px-4">
          <DetailRow label="Type" value={typeLabel} />
          {media.year ? <DetailRow label="Year" value={media.year} /> : null}
          {media.runtime ? (
            <DetailRow
              label="Runtime"
              value={media.type === "film" ? `${media.runtime} min` : `~${media.runtime} min/ep`}
            />
          ) : null}
          {isSeries && media.seasons ? <DetailRow label="Seasons" value={media.seasons} /> : null}
          {isSeries && media.episodes ? <DetailRow label="Episodes" value={media.episodes} /> : null}
          {media.status ? (
            <DetailRow label="Status" value={<span className="capitalize">{media.status}</span>} />
          ) : null}
          {media.studio ? <DetailRow label="Studio" value={media.studio} /> : null}
        </div>
      </div>
    </section>
  );
}
