import { downscaleImage } from "@/shared/utils/downscale-image";
import { createClient } from "@/infrastructure/supabase/client";
import { DEFAULT_USER_SETTINGS } from "./types";
import type { Profile, UserSettings, UserSettingsPatch } from "./types";

// =====================================================
// SETTINGS SERVICE (SUPABASE)
// =====================================================

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateProfile(
  patch: { full_name?: string | null; avatar_url?: string | null },
): Promise<Profile> {
  const supabase = createClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, email, full_name, avatar_url")
    .single();
  if (error) throw error;
  return data as Profile;
}

// Separate + resilient: `is_demo` only exists once the demo migration is applied.
// Returns false on any error so the rest of the app is never coupled to it.
export async function getIsDemo(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("is_demo")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return false;
  return Boolean((data as { is_demo?: boolean } | null)?.is_demo);
}

// Uploads to the user's own folder in the public `avatars` bucket, returns the URL.
export async function uploadAvatar(file: File): Promise<string> {
  const supabase = createClient();
  const userId = await requireUserId();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  // Shrunk on this device first (see downscaleImage) — an avatar renders at 40px.
  const { error } = await supabase.storage.from("avatars").upload(path, await downscaleImage(file), { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

// ── Preferences ──────────────────────────────────────────────────────────────

export async function getUserSettings(): Promise<UserSettings> {
  const supabase = createClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  // No row yet → return defaults (first save will upsert).
  return (data as UserSettings | null)
    ?? { user_id: userId, ...DEFAULT_USER_SETTINGS, updated_at: new Date(0).toISOString() };
}

// ── Demo module control (owner-side; backed by SECURITY DEFINER RPCs) ────────

export async function getDemoVisibleModules(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_demo_visible_modules");
  if (error) throw error;
  return (data as string[] | null) ?? [];
}

export async function setDemoVisibleModules(visible: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_demo_visible_modules", { p_visible: visible });
  if (error) throw error;
}

export async function updateUserSettings(patch: UserSettingsPatch): Promise<UserSettings> {
  const supabase = createClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as UserSettings;
}
