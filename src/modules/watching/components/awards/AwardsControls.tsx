"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import type { AwardCeremony } from "../../types";

const CEREMONIES: { value: AwardCeremony; label: string }[] = [{value:"oscars",label:"Oscars"},{value:"emmys",label:"Emmys"}];
export function AwardCeremonyControl({ ceremony }: { ceremony: AwardCeremony }) {
  const router = useRouter();
  return <SegmentedControl items={CEREMONIES} value={ceremony} onChange={c => router.replace(`/perso/watching/awards?c=${c}`, {scroll:false})} size="sm" />;
}
export function AwardBackBar({ ceremony = "oscars" }: { ceremony?: AwardCeremony }) {
  const router = useRouter();
  return <div className="flex items-center gap-2 border-b border-border-subtle bg-zinc-950 px-4 py-3 sm:px-6"><button type="button" onClick={() => router.push(`/perso/watching/awards?c=${ceremony}`)} className="flex shrink-0 items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"><ArrowLeft size={14}/><span className="hidden sm:inline">Back to Awards</span><span className="sm:hidden">Back</span></button></div>;
}
