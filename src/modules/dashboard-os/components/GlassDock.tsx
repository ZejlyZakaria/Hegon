import Image from "next/image";
import { AppTile } from "./AppTile";
import { OS_APPS, DOCK_APP_KEYS } from "../config";

// iPad-style frosted dock — same pill as the iPad bottom dock, stood up on the
// LEFT. A floating glass rail of app tiles. (Mockup: standalone. Once validated
// this replaces the global Dock styling.)

export function GlassDock() {
  const apps = DOCK_APP_KEYS.map((k) => OS_APPS[k]).filter(Boolean);

  return (
    <div className="flex h-full items-center pl-3">
      <nav className="glass flex flex-col items-center gap-3 rounded-[26px] px-2.5 py-3.5">
        <div className="relative h-7 w-7 opacity-90">
          <Image src="/logo/Hegon_white_logo.png" alt="HEGON" fill sizes="28px" className="object-contain" />
        </div>
        <div className="h-px w-7 bg-white/15" />
        {apps.map((app) => (
          <AppTile key={app.key} app={app} size="dock" />
        ))}
      </nav>
    </div>
  );
}
