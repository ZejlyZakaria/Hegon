import { getWallpaper } from "../config";

// Full-bleed wallpaper behind the home screen. CSS preset by default; a
// user-supplied image URL plugs in later (Settings). Sits at the very back so
// the glass dock + widgets refract it.

export function HomeWallpaper({ id, imageUrl, blur }: { id?: string; imageUrl?: string; blur?: boolean }) {
  const wp = getWallpaper(id);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          // blur bleeds past the edges → scale up a touch so no transparent rim shows
          style={blur ? { filter: "blur(22px)", transform: "scale(1.08)" } : undefined}
        />
      ) : (
        <div className="h-full w-full" style={{ background: wp.css }} />
      )}
      {/* soft vignette — keeps edges grounded, centre luminous */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(125% 95% at 50% 30%, transparent 55%, rgba(0,0,0,0.32))",
        }}
      />
    </div>
  );
}
