// app/perso/watching/library/page.tsx
import { createServerClient } from "@/infrastructure/supabase/server";
import LibraryClient from "@/modules/watching/components/library/LibraryClient";

export default async function LibraryPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="p-8 text-zinc-500">Connecte-toi pour accéder à ta bibliothèque.</div>;
  }

  const { data } = await supabase
    .schema("watching")
    .from("media_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("watched", true)
    .order("watched_at", { ascending: false });

  return (
    <div className="p-6">
      <LibraryClient initialItems={data ?? []} />
    </div>
  );
}