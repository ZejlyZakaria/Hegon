import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as SettingsService from "../service";
import { SETTINGS_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import type { Profile, UserSettings, UserSettingsPatch } from "../types";

// ── Profile ────────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({
    queryKey: SETTINGS_KEYS.profile(),
    queryFn:  () => SettingsService.getProfile(),
    staleTime: 1000 * 60 * 5, // profile rarely changes
  });
}

// Demo status with readiness, so consumers can avoid a flash before the query
// resolves. Its own query → degrades gracefully before the demo migration.
export function useDemoStatus(): { isDemo: boolean; isReady: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: [...SETTINGS_KEYS.all, "is-demo"],
    queryFn:  SettingsService.getIsDemo,
    staleTime: 1000 * 60 * 30,
  });
  return { isDemo: data ?? false, isReady: !isLoading };
}

// True when the signed-in account is the read-only demo (showcase) account.
export function useIsDemo(): boolean {
  return useDemoStatus().isDemo;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { full_name?: string | null; avatar_url?: string | null }) =>
      SettingsService.updateProfile(patch),
    onSuccess: (profile) => {
      queryClient.setQueryData<Profile>(SETTINGS_KEYS.profile(), profile);
    },
    onError: () => toast.error("Couldn't save your profile. Try again."),
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: (file: File) => SettingsService.uploadAvatar(file),
    onError: () => toast.error("Couldn't upload the image. Try again."),
  });
}

// ── Preferences ──────────────────────────────────────────────────────────────

export function useUserSettings() {
  return useQuery({
    queryKey: SETTINGS_KEYS.preferences(),
    queryFn:  () => SettingsService.getUserSettings(),
    staleTime: 1000 * 60 * 5,
  });
}

// ── Demo module control (owner) ──────────────────────────────────────────────

export function useDemoModules() {
  return useQuery({
    queryKey: [...SETTINGS_KEYS.all, "demo-modules"],
    queryFn:  SettingsService.getDemoVisibleModules,
    staleTime: 1000 * 60,
    retry: false, // RPC may not exist before the migration is applied
  });
}

export function useSetDemoModules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (visible: string[]) => SettingsService.setDemoVisibleModules(visible),
    onMutate: async (visible) => {
      const key = [...SETTINGS_KEYS.all, "demo-modules"];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<string[]>(key);
      queryClient.setQueryData<string[]>(key, visible);
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.key, ctx.prev);
      toast.error("Couldn't update demo modules. Apply the latest migration?");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...SETTINGS_KEYS.all, "demo-modules"] });
    },
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UserSettingsPatch) => SettingsService.updateUserSettings(patch),
    // Optimistic: settings toggles should feel instant.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_KEYS.preferences() });
      const prev = queryClient.getQueryData<UserSettings>(SETTINGS_KEYS.preferences());
      if (prev) queryClient.setQueryData<UserSettings>(SETTINGS_KEYS.preferences(), { ...prev, ...patch });
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(SETTINGS_KEYS.preferences(), ctx.prev);
      toast.error("Couldn't save your preferences. Try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.preferences() });
    },
  });
}
