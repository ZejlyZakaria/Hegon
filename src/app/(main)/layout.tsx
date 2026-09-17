// app/(main)/layout.tsx
// all protected routes live under this layout — sidebar always present
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@/infrastructure/supabase/server";
import { DASHBOARD_MODULE, LIVE_MODULES, modulePrefix } from "@/shared/constants/modules";
import Dock from "@/shared/components/navigation/Dock";
import TopBar from "@/shared/components/layout/TopBar";
import { DemoBanner } from "@/shared/components/layout/DemoBanner";
import { CommandCenterProvider } from "@/modules/command-center/components/CommandCenterProvider";
import { DashboardWallpaper } from "@/modules/dashboard-os/components/DashboardWallpaper";

// Demo curation — server-side, so a demo visitor on a non-exposed module gets
// the 404 decided BEFORE render (no flash). Also reports `isDemo` so we can drop
// the ⌘K command palette for the demo (it navigates client-side, which would
// otherwise bypass this gate). Privacy is RLS; this is UX/curation.
//
// `hiddenModules` is read here for EVERYONE and handed to the Dock: the dock used to wait for two
// client queries (settings + demo status) after hydration before drawing its icons, so every
// reload showed a bare logo and then the icons popping in (owner, 2026-09-17). The shell is the
// one thing that must never flicker; the server already knows the answer.
async function resolveDemoContext(pathname: string): Promise<{ isDemo: boolean; hiddenModules: string[] }> {
  const supabase = await createServerClient();
  // Middleware already validated auth before we get here, so getSession (cookie,
  // no network round-trip) is enough and avoids a second getUser() latency hit.
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { isDemo: false, hiddenModules: [] };

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("is_demo").eq("id", userId).maybeSingle(),
    supabase.from("user_settings").select("hidden_modules").eq("user_id", userId).maybeSingle(),
  ]);
  const hiddenModules: string[] = settings?.hidden_modules ?? [];
  if (!profile?.is_demo) return { isDemo: false, hiddenModules };

  const hidden = new Set(hiddenModules);
  const allowed = [DASHBOARD_MODULE, ...LIVE_MODULES].filter((m) => !hidden.has(m.key)).map(modulePrefix);

  if (pathname && !allowed.some((prefix) => pathname.startsWith(prefix))) notFound();
  return { isDemo: true, hiddenModules };
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const { isDemo, hiddenModules } = await resolveDemoContext(pathname);

  return (
    <div className="relative flex h-dvh bg-surface-0 overflow-hidden custom-scrollbar">
      {/* Dashboard OS — full-bleed wallpaper behind the glass dock + home.
          Client-gated on pathname so it never bleeds into other modules. */}
      <DashboardWallpaper />
      <Dock hiddenModules={hiddenModules} />
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <DemoBanner />
        <TopBar />
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="max-w-400 mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
      {/* No command palette for the demo — ⌘K navigates client-side and would
          bypass the server-side route gate above. */}
      {!isDemo && <CommandCenterProvider />}
    </div>
  );
}
