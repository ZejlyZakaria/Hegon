// app/(main)/layout.tsx
// all protected routes live under this layout — sidebar always present
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@/infrastructure/supabase/server";
import { LIVE_MODULES, modulePrefix } from "@/shared/constants/modules";
import Dock from "@/shared/components/navigation/Dock";
import TopBar from "@/shared/components/layout/TopBar";
import { DemoBanner } from "@/shared/components/layout/DemoBanner";
import { CommandCenterProvider } from "@/modules/command-center/components/CommandCenterProvider";

// Demo curation — server-side, so a demo visitor on a non-exposed module gets
// the 404 decided BEFORE render (no flash). Also reports `isDemo` so we can drop
// the ⌘K command palette for the demo (it navigates client-side, which would
// otherwise bypass this gate). Privacy is RLS; this is UX/curation.
async function resolveDemoContext(pathname: string): Promise<{ isDemo: boolean }> {
  const supabase = await createServerClient();
  // Middleware already validated auth before we get here, so getSession (cookie,
  // no network round-trip) is enough and avoids a second getUser() latency hit.
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { isDemo: false };

  const { data: profile } = await supabase
    .from("profiles").select("is_demo").eq("id", userId).maybeSingle();
  if (!profile?.is_demo) return { isDemo: false };

  const { data: settings } = await supabase
    .from("user_settings").select("hidden_modules").eq("user_id", userId).maybeSingle();
  const hidden = new Set<string>(settings?.hidden_modules ?? []);
  const allowed = LIVE_MODULES.filter((m) => !hidden.has(m.key)).map(modulePrefix);

  if (pathname && !allowed.some((prefix) => pathname.startsWith(prefix))) notFound();
  return { isDemo: true };
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const { isDemo } = await resolveDemoContext(pathname);

  return (
    <div className="flex h-dvh bg-[#09090b] overflow-hidden custom-scrollbar">
      <Dock />
      <div className="flex-1 flex flex-col overflow-hidden">
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
