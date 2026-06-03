/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  User, SlidersHorizontal, LayoutGrid, Loader2, Camera, Check, LogOut, Share2,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";
import { toast } from "@/shared/utils/toast";
import { signOut } from "@/infrastructure/auth/actions";
import { DASHBOARD_MODULE, LIVE_MODULES } from "@/shared/constants/modules";
import {
  useProfile, useUpdateProfile, useUploadAvatar,
  useUserSettings, useUpdateUserSettings,
  useIsDemo, useDemoModules, useSetDemoModules,
} from "@/modules/settings/hooks/useSettings";
import type { DateFormat, WeekStart } from "@/modules/settings/types";

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "DD/MM/YYYY", label: "31/12/2026" },
  { value: "MM/DD/YYYY", label: "12/31/2026" },
  { value: "YYYY-MM-DD", label: "2026-12-31" },
];

const HOME_OPTIONS = [DASHBOARD_MODULE, ...LIVE_MODULES];

// ── Building blocks ─────────────────────────────────────────────────────────

function Section({
  icon, title, description, children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-1 p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-text-tertiary">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {description && <p className="text-xs text-text-tertiary">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Toggle({
  checked, onChange, accent, disabled, label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  accent?: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          "h-5 w-9 rounded-full transition-colors duration-150",
          !checked && "bg-surface-overlay border border-border-default",
        )}
        style={checked ? { backgroundColor: accent ?? "var(--color-text-secondary)" } : undefined}
      />
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-150",
          checked ? "left-4" : "left-0.5",
        )}
      />
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-caption uppercase text-text-tertiary">{children}</label>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: settings } = useUserSettings();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const updateSettings = useUpdateUserSettings();
  const isDemo = useIsDemo();
  const { data: demoVisible = [], isError: demoError } = useDemoModules();
  const setDemoModules = useSetDemoModules();

  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  // Sync the local name field once the profile loads.
  useEffect(() => {
    if (profile) setName(profile.full_name ?? "");
  }, [profile]);

  const nameDirty = profile != null && name.trim() !== (profile.full_name ?? "");

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar.mutateAsync(file);
      await updateProfile.mutateAsync({ avatar_url: url });
      toast.success("Photo updated.");
    } catch {
      /* hooks already toast on error */
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveName() {
    if (!nameDirty) return;
    await updateProfile.mutateAsync({ full_name: name.trim() || null });
    toast.success("Name updated.");
  }

  const hidden = new Set(settings?.hidden_modules ?? []);
  const initial = (profile?.full_name || profile?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-tertiary">Manage your profile and how HEGON behaves.</p>
      </div>

      {/* ── Profile ── */}
      <Section icon={<User size={15} />} title="Profile">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full"
            aria-label="Change profile photo"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-linear-to-br from-violet-500 to-indigo-600 text-xl font-bold text-white">
                {initial}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <Camera size={18} className="text-white" />
              )}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarPick} className="hidden" />

          {/* Name + email */}
          <div className="flex-1 space-y-4">
            <div>
              <FieldLabel>Display name</FieldLabel>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
                  placeholder="Your name"
                  className="h-9 flex-1 rounded-lg border border-border-subtle bg-surface-overlay px-3 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-border-focus focus:outline-none"
                />
                <Button
                  onClick={handleSaveName}
                  disabled={!nameDirty || updateProfile.isPending}
                  className="shrink-0"
                >
                  {updateProfile.isPending ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <p className="text-sm text-text-secondary">
                {profileLoading ? "…" : (profile?.email ?? "—")}
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Preferences ── */}
      <Section icon={<SlidersHorizontal size={15} />} title="Preferences">
        <div className="space-y-4">
          {/* Home module */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-text-primary">Home screen</p>
              <p className="text-xs text-text-tertiary">Where HEGON opens by default.</p>
            </div>
            <Select
              value={settings?.default_module ?? "dashboard"}
              onValueChange={(v) => updateSettings.mutate({ default_module: v })}
            >
              <SelectTrigger className="w-44 bg-surface-overlay border-border-subtle text-sm text-text-secondary focus:ring-0 focus:ring-offset-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-border-strong text-text-secondary">
                {HOME_OPTIONS.map((m) => (
                  <SelectItem key={m.key} value={m.key} className="text-sm focus:bg-surface-2 focus:text-text-primary cursor-pointer">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Week start */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-text-primary">Start of week</p>
              <p className="text-xs text-text-tertiary">Used across calendars and habit grids.</p>
            </div>
            <div className="flex rounded-lg border border-border-subtle bg-surface-overlay p-0.5">
              {(["monday", "sunday"] as WeekStart[]).map((d) => {
                const active = (settings?.week_start ?? "monday") === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateSettings.mutate({ week_start: d })}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                      active ? "bg-surface-2 text-text-primary" : "text-text-tertiary hover:text-text-secondary",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date format */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-text-primary">Date format</p>
              <p className="text-xs text-text-tertiary">How dates are displayed.</p>
            </div>
            <Select
              value={settings?.date_format ?? "DD/MM/YYYY"}
              onValueChange={(v) => updateSettings.mutate({ date_format: v as DateFormat })}
            >
              <SelectTrigger className="w-44 bg-surface-overlay border-border-subtle text-sm text-text-secondary focus:ring-0 focus:ring-offset-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-border-strong text-text-secondary">
                {DATE_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-sm focus:bg-surface-2 focus:text-text-primary cursor-pointer">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* ── Modules ── */}
      <Section
        icon={<LayoutGrid size={15} />}
        title="Modules"
        description="Hide the modules you don't use from the sidebar."
      >
        <div className="space-y-0.5">
          {LIVE_MODULES.map((m) => {
            const visible = !hidden.has(m.key);
            return (
              <div key={m.key} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: m.accent }} />
                <span className="flex-1 text-sm text-text-secondary">{m.label}</span>
                <span className="text-caption uppercase text-text-disabled">{m.group}</span>
                <Toggle
                  checked={visible}
                  accent={m.accent}
                  label={`Show ${m.label} in the sidebar`}
                  onChange={(v) => {
                    const next = new Set(hidden);
                    if (v) next.delete(m.key); else next.add(m.key);
                    updateSettings.mutate({ hidden_modules: [...next] });
                  }}
                />
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Demo & Sharing ── (owner only) */}
      {!isDemo && (
        <Section
          icon={<Share2 size={15} />}
          title="Demo & Sharing"
          description="Which modules the public read-only demo exposes. Add demo data before exposing a module, or it shows empty."
        >
          {demoError ? (
            <p className="text-xs text-text-tertiary">
              Apply the latest migration to manage the demo account.
            </p>
          ) : (
            <div className="space-y-0.5">
              {LIVE_MODULES.map((m) => {
                const shared = demoVisible.includes(m.key);
                return (
                  <div key={m.key} className="flex items-center gap-3 rounded-lg px-2 py-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: m.accent }} />
                    <span className="flex-1 text-sm text-text-secondary">{m.label}</span>
                    <Toggle
                      checked={shared}
                      accent={m.accent}
                      label={`Expose ${m.label} in the demo`}
                      onChange={(v) => {
                        const next = v
                          ? [...demoVisible, m.key]
                          : demoVisible.filter((k) => k !== m.key);
                        setDemoModules.mutate(next);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* ── Account ── */}
      <Section icon={<Check size={15} />} title="Account">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-text-primary">Signed in</p>
            <p className="text-xs text-text-tertiary">{profile?.email ?? "—"}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-overlay px-3 py-2 text-sm text-text-secondary transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </Section>
    </div>
  );
}
