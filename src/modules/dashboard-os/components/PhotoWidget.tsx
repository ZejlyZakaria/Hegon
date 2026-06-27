import Image from "next/image";

// Personal photo widget (S) — a user-set image that gives the dashboard taste.
// Static for now; becomes user-configurable (and rotatable) via Settings.
const RIM = {
  boxShadow:
    "inset 0 1px 0 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.08), 0 10px 34px -10px rgba(0,0,0,0.6)",
} as const;

export function PhotoWidget({ src = "/tennis-court-sunset.jpg" }: { src?: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[22px]" style={RIM}>
      <Image src={src} alt="" fill sizes="158px" unoptimized className="object-cover" />
    </div>
  );
}
