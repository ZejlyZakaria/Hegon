/* eslint-disable @next/next/no-img-element */
"use client";

import type { WatchProviderInfo } from "../../hooks/useWatchProviders";

const REGION_NAMES: Record<string, string> = {
  MA: "Morocco",
  FR: "France",
  US: "United States",
  GB: "United Kingdom",
};

export function WatchProviders({ info }: { info: WatchProviderInfo | null | undefined }) {
  if (!info || info.flatrate.length === 0) return null;
  const region = REGION_NAMES[info.region] ?? info.region;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-title text-text-primary">Where to watch</h2>
        <span className="text-xs text-text-tertiary">{region}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {info.flatrate.map((p) => {
          const logo = p.logo_url ? (
            <img
              src={p.logo_url}
              alt={p.name}
              title={p.name}
              className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/10"
            />
          ) : (
            <span className="flex h-10 items-center rounded-lg bg-surface-2 px-3 text-xs text-text-secondary ring-1 ring-white/10">
              {p.name}
            </span>
          );
          return info.link ? (
            <a
              key={p.id}
              href={info.link}
              target="_blank"
              rel="noopener noreferrer"
              title={p.name}
              className="transition-transform duration-150 ease-out hover:scale-105"
            >
              {logo}
            </a>
          ) : (
            <div key={p.id}>{logo}</div>
          );
        })}
      </div>

      <p className="mt-2.5 text-[10px] text-text-tertiary/50">Powered by JustWatch</p>
    </div>
  );
}
