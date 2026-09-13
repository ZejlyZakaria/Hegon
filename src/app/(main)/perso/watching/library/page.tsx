// app/perso/watching/library/page.tsx
import { createServerClient } from "@/infrastructure/supabase/server";
import LibraryClient from "@/modules/watching/components/library/LibraryClient";
import { getLibraryMedia } from "@/modules/watching/service";

export default async function LibraryPage() {
  const supabase = await createServerClient();
  // Local JWT verification — the middleware already did it for this request. See lists/page.tsx
  // for the measurement (78.5ms of network against 0.47ms local).
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  if (!userId) {
    return <div className="p-8 text-zinc-500">Sign in to access your library.</div>;
  }

  // THE SAME READ the client hook re-runs — not a copy of it. This page used to inline the query
  // and share only the column list with `getLibraryMedia`; the service now takes the client, so
  // the server and the browser run one implementation (decisions.md 2026-07-21, audit 2026-09-13).
  const initialItems = await getLibraryMedia(userId, supabase);

  return (
    <div className="p-6">
      <LibraryClient initialItems={initialItems} userId={userId} />
    </div>
  );
}
