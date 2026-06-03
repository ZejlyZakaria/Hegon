// =====================================================
// SETTINGS TYPES
// =====================================================

export type WeekStart = "monday" | "sunday";
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface UserSettings {
  user_id: string;
  default_module: string;
  week_start: WeekStart;
  date_format: DateFormat;
  hidden_modules: string[]; // Dock module keys the user hid
  updated_at: string;
}

export type UserSettingsPatch = Partial<Omit<UserSettings, "user_id" | "updated_at">>;

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, "user_id" | "updated_at"> = {
  default_module: "dashboard",
  week_start: "monday",
  date_format: "DD/MM/YYYY",
  hidden_modules: [],
};
