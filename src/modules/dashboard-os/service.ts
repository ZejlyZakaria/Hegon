import { createClient } from "@/infrastructure/supabase/client";

// Upload a custom home wallpaper to the public `posters` bucket → returns its URL.
// Same bucket + user-scoped path as Watching posters / book covers (policies are
// already in place there), under a `wallpapers/` subfolder.
export async function uploadWallpaper(file: File): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `${user.id}/wallpapers/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("posters").upload(filePath, file);
  if (error) return null;
  const { data } = supabase.storage.from("posters").getPublicUrl(filePath);
  return data.publicUrl;
}
