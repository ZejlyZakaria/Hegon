import type { ComponentType } from "react";
import {
  WeatherWidget, EventsWidget, NowWatchingWidget, TodayWidget,
  HabitsWidget, BooksWidget, JournalWidget,
} from "./components/Widgets";
import { PhotoWidget } from "./components/PhotoWidget";
import { SportWidget } from "./components/sport/SportWidget";

// ─── Layout model ─────────────────────────────────────────────────────────────
// The home grid renders from this ordered list (the single source of truth the
// Customize mode mutates). It is purely LOGICAL: it knows an item's identity and
// its abstract size — NOT its pixels. The breakpoint profile turns a size into a
// cell footprint, and the pure layout engine turns footprints into positions.
// Order = array index.

export type ItemSize = "S" | "M" | "L";

// Per-item rules for the layout engine. All optional — the deliberate seam for
// pin / lock / preferred-column / float; unused for now, but typing them means
// adding the behaviour later needs no change to the model or engine signature.
export interface LayoutConstraints {
  pinned?: boolean;          // keeps its slot while others reflow
  locked?: boolean;          // can't be moved or removed in Customize
  preferredColumn?: number;  // hint for where it likes to sit
}

// Every widget that can live on the home grid, keyed for the registry below.
export type WidgetKey =
  | "weather" | "photo" | "sport" | "nowWatching"
  | "today" | "events" | "habits" | "books" | "journal";

export const WIDGET_REGISTRY: Record<WidgetKey, ComponentType> = {
  weather: WeatherWidget,
  photo: PhotoWidget,
  sport: SportWidget,
  nowWatching: NowWatchingWidget,
  today: TodayWidget,
  events: EventsWidget,
  habits: HabitsWidget,
  books: BooksWidget,
  journal: JournalWidget,
};

// One placed thing on the grid — a widget or an app launcher.
export interface LayoutItem {
  id: string;                       // stable unique id (drag key)
  kind: "widget" | "app";
  ref: string;                      // WidgetKey for widgets, OS_APPS key for apps
  size: ItemSize;
  constraints?: LayoutConstraints;  // future rules (pin/lock/…); unused for now
}

const w = (ref: WidgetKey, size: ItemSize): LayoutItem => ({ id: `w:${ref}`, kind: "widget", ref, size });
const a = (ref: string): LayoutItem => ({ id: `app:${ref}`, kind: "app", ref, size: "S" });

// Default arrangement — authored to read well in the auto-flow grid. Fully
// reorderable once the Customize mode lands; this is just the seed.
export const DEFAULT_LAYOUT: LayoutItem[] = [
  // hero widgets
  w("weather", "S"),
  w("photo", "S"),
  w("sport", "M"),
  w("nowWatching", "M"),
  // the "you" row
  w("habits", "S"),
  w("books", "S"),
  w("journal", "S"),
  // glanceable lists
  w("events", "M"),
  w("today", "M"),
  // app launchers — Life · Perso · Pro
  a("goals"), a("habits"), a("journal"), a("books"),
  a("sport"), a("watching"), a("travel"),
  a("tasks"), a("jobhunt"), a("tech"),
];
