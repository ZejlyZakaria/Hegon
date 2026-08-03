"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Check, ChevronDown } from "lucide-react";

import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Calendar as DatePicker } from "@/shared/components/ui/calendar";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import { cn } from "@/shared/utils/utils";

import { useUpdateGoal } from "../hooks/useGoals";
import { CATEGORY_COLOR } from "../constants";
import type { Goal, GoalCategory, GoalPriority, MetricModule, MetricPeriod, UpdateGoalInput } from "../types";

const CATEGORIES: { value: GoalCategory | "none"; label: string }[] = [
  { value: "none",      label: "No category" },
  { value: "career",    label: "Career" },
  { value: "health",    label: "Health" },
  { value: "finance",   label: "Finance" },
  { value: "growth",    label: "Growth" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "other",     label: "Other" },
];
const PRIORITIES: GoalPriority[] = ["low", "medium", "high", "critical"];
const TRACKING = [
  { value: "manual",   label: "Manually" },
  { value: "tasks",    label: "From linked tasks" },
  { value: "activity", label: "From an activity" },
] as const;
type Tracking = (typeof TRACKING)[number]["value"];
const WATCHING_KEYS = [
  { value: "films",  label: "Films" },
  { value: "series", label: "TV Shows" },
  { value: "anime",  label: "Animes" },
  { value: "titles", label: "Any title" },
];
const FOOTBALL_KEYS = [
  { value: "matches", label: "Matches" },
  { value: "stadium", label: "Stadium visits" },
];
const PERIODS: { value: MetricPeriod; label: string }[] = [
  { value: "year",     label: "This year" },
  { value: "all_time", label: "All time" },
];

interface Props {
  open:    boolean;
  onClose: () => void;
  goal?:   Goal;
}

// The goal edit experience — inline autosave (no Save button), mirroring the
// Tasks detail panel: text fields save on blur, every picker patches on select.
export function GoalEditPanel({ open, onClose, goal }: Props) {
  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      width="wide"
      title="Edit Goal"
    >
      {goal && <EditBody key={goal.id} goal={goal} />}
    </SlidingPanel>
  );
}

// ── Reusable property row ──
function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-b border-border-subtle py-2 last:border-0">
      <span className="shrink-0 text-xs text-text-tertiary">{label}</span>
      {children}
    </div>
  );
}

// ── Reusable menu picker (trigger + option list, autosave on select) ──
function Menu({
  trigger, children, width = "w-48",
}: {
  trigger: ReactNode; children: (close: () => void) => ReactNode; width?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-control px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-3"
        >
          {trigger}
          <ChevronDown size={12} className="text-text-tertiary" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className={cn("p-1 bg-surface-3 border-border-strong", width)}>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

function Option({
  selected, onClick, children,
}: {
  selected: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
        selected ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
      )}
    >
      {children}
      {selected && <Check size={11} className="ml-auto shrink-0" />}
    </button>
  );
}

function EditBody({ goal }: { goal: Goal }) {
  const updateGoal = useUpdateGoal();
  const currentYear = new Date().getFullYear();

  const [title, setTitle] = useState(goal.title);
  const [desc, setDesc]   = useState(goal.description ?? "");
  const [why, setWhy]     = useState(goal.why ?? "");
  const [targetInput, setTargetInput] = useState(goal.metric_target != null ? String(goal.metric_target) : "");
  const savedTitle = useRef(goal.title);
  const savedDesc  = useRef(goal.description ?? "");
  const savedWhy   = useRef(goal.why ?? "");
  const titleEl = useRef<HTMLTextAreaElement>(null);
  const [dateOpen, setDateOpen] = useState(false);

  // Auto-grow the title field.
  useEffect(() => {
    if (!titleEl.current) return;
    titleEl.current.style.height = "auto";
    titleEl.current.style.height = `${titleEl.current.scrollHeight}px`;
  }, [title]);

  function patch(fields: Partial<Omit<UpdateGoalInput, "id">>) {
    updateGoal.mutate({ id: goal.id, ...fields });
  }

  function saveTitle() {
    const t = title.trim();
    if (!t) { setTitle(savedTitle.current); return; }
    if (t !== savedTitle.current) { savedTitle.current = t; patch({ title: t }); }
  }
  function saveDesc() {
    const next = desc.trim() || null;
    if ((next ?? "") !== savedDesc.current) { savedDesc.current = next ?? ""; patch({ description: next }); }
  }
  function saveWhy() {
    const next = why.trim() || null;
    if ((next ?? "") !== savedWhy.current) { savedWhy.current = next ?? ""; patch({ why: next }); }
  }
  function saveTarget() {
    const n = Number(targetInput);
    if (targetInput && n > 0 && n !== goal.metric_target) patch({ metric_target: n });
    else if (!targetInput) setTargetInput(goal.metric_target != null ? String(goal.metric_target) : "");
  }

  const tracking: Tracking = goal.metric_module ? "activity" : goal.progress_mode === "auto" ? "tasks" : "manual";

  function setTracking(t: Tracking) {
    if (t === "manual") {
      patch({ progress_mode: "manual", metric_module: null, metric_key: null, metric_period: null, metric_year: null, metric_target: null });
    } else if (t === "tasks") {
      patch({ progress_mode: "auto", metric_module: null, metric_key: null, metric_period: null, metric_year: null, metric_target: null });
    } else {
      const period = goal.metric_period ?? "year";
      patch({
        progress_mode: "auto",
        metric_module: goal.metric_module ?? "watching",
        metric_key:    goal.metric_module === "books" ? "books" : goal.metric_key ?? "films",
        metric_period: period,
        metric_year:   period === "year" ? currentYear : null,
        metric_target: goal.metric_target ?? 10,
      });
    }
  }

  function setSource(src: MetricModule) {
    const valid = src === "football" ? ["matches", "stadium"] : ["films", "series", "anime", "titles"];
    const key = goal.metric_key && valid.includes(goal.metric_key) ? goal.metric_key : valid[0];
    patch({ metric_module: src, metric_key: src === "books" ? "books" : key });
  }
  function setPeriod(p: MetricPeriod) {
    patch({ metric_period: p, metric_year: p === "year" ? currentYear : null });
  }

  const categoryLabel = CATEGORIES.find((c) => c.value === (goal.category ?? "none"))!.label;
  const activeKeys = goal.metric_module === "football" ? FOOTBALL_KEYS : WATCHING_KEYS;
  const keyLabel = activeKeys.find((k) => k.value === goal.metric_key)?.label ?? activeKeys[0].label;

  return (
    <div className="flex flex-col">
      {/* Title + rich text */}
      <div className="space-y-2 p-4">
        <textarea
          ref={titleEl}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          rows={1}
          placeholder="Goal title"
          className="w-full resize-none overflow-hidden bg-transparent text-[17px] font-semibold leading-snug text-text-primary outline-none placeholder:text-text-tertiary"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={saveDesc}
          rows={2}
          placeholder="What does success look like?"
          className="w-full resize-none bg-transparent text-sm leading-relaxed text-text-secondary outline-none placeholder:text-text-tertiary"
        />
      </div>

      {/* Why */}
      <div className="border-t border-border-subtle px-4 py-3">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Why this matters</label>
        <textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          onBlur={saveWhy}
          rows={2}
          placeholder="Your north star — why do you really want this?"
          className="w-full resize-none bg-transparent text-sm italic leading-relaxed text-text-secondary outline-none placeholder:text-text-tertiary"
        />
      </div>

      {/* Properties */}
      <div className="border-t border-border-subtle px-4">
        {/* Category */}
        <Prop label="Category">
          <Menu trigger={
            <span className="flex items-center gap-2">
              {goal.category && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[goal.category] }} />}
              {categoryLabel}
            </span>
          }>
            {(close) => CATEGORIES.map((c) => (
              <Option key={c.value} selected={(goal.category ?? "none") === c.value}
                onClick={() => { patch({ category: c.value === "none" ? null : c.value }); close(); }}>
                {c.value !== "none" && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[c.value as GoalCategory] }} />}
                {c.label}
              </Option>
            ))}
          </Menu>
        </Prop>

        {/* Priority */}
        <Prop label="Priority">
          <Menu trigger={<span className="flex items-center gap-1.5 capitalize"><PriorityIcon priority={goal.priority} />{goal.priority}</span>} width="w-40">
            {(close) => PRIORITIES.map((p) => (
              <Option key={p} selected={goal.priority === p} onClick={() => { patch({ priority: p }); close(); }}>
                <PriorityIcon priority={p} /><span className="capitalize">{p}</span>
              </Option>
            ))}
          </Menu>
        </Prop>

        {/* Target date */}
        <Prop label="Target date">
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={cn("flex items-center gap-1.5 rounded-control px-2 py-1 text-xs transition-colors hover:bg-surface-3", goal.target_date ? "text-text-secondary" : "text-text-tertiary")}>
                <CalendarIcon size={13} />
                {goal.target_date ? format(new Date(goal.target_date), "MMM d, yyyy") : "No date"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0 bg-surface-3 border-border-strong">
              <DatePicker
                mode="single"
                selected={goal.target_date ? new Date(goal.target_date) : undefined}
                onSelect={(d) => { patch({ target_date: d ? d.toISOString().split("T")[0] : null }); setDateOpen(false); }}
                className="bg-surface-3"
              />
              {goal.target_date && (
                <div className="border-t border-border-subtle p-2">
                  <button type="button" onClick={() => { patch({ target_date: null }); setDateOpen(false); }} className="w-full rounded px-2 py-1 text-left text-xs text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary">
                    Clear date
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </Prop>

        {/* Tracking */}
        <Prop label="Track progress">
          <Menu trigger={<span>{TRACKING.find((t) => t.value === tracking)!.label}</span>} width="w-44">
            {(close) => TRACKING.map((t) => (
              <Option key={t.value} selected={tracking === t.value} onClick={() => { setTracking(t.value); close(); }}>
                {t.label}
              </Option>
            ))}
          </Menu>
        </Prop>

        {/* Activity metric sub-rows */}
        {tracking === "activity" && (
          <>
            <Prop label="Source">
              <Menu trigger={<span className="capitalize">{goal.metric_module ?? "watching"}</span>} width="w-40">
                {(close) => (["watching", "books", "football"] as MetricModule[]).map((src) => (
                  <Option key={src} selected={(goal.metric_module ?? "watching") === src} onClick={() => { setSource(src); close(); }}>
                    <span className="capitalize">{src}</span>
                  </Option>
                ))}
              </Menu>
            </Prop>

            {goal.metric_module !== "books" && (
              <Prop label="Count">
                <Menu trigger={<span>{keyLabel}</span>} width="w-40">
                  {(close) => activeKeys.map((k) => (
                    <Option key={k.value} selected={goal.metric_key === k.value} onClick={() => { patch({ metric_key: k.value }); close(); }}>
                      {k.label}
                    </Option>
                  ))}
                </Menu>
              </Prop>
            )}

            <Prop label="Target">
              <input
                type="number"
                min={1}
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onBlur={saveTarget}
                placeholder="50"
                className="w-20 rounded-control bg-surface-2 px-2 py-1 text-right text-xs text-text-primary outline-none transition-colors focus:bg-surface-3"
              />
            </Prop>

            <Prop label="Period">
              <Menu trigger={<span>{PERIODS.find((p) => p.value === (goal.metric_period ?? "year"))!.label}</span>} width="w-40">
                {(close) => PERIODS.map((p) => (
                  <Option key={p.value} selected={(goal.metric_period ?? "year") === p.value} onClick={() => { setPeriod(p.value); close(); }}>
                    {p.label}
                  </Option>
                ))}
              </Menu>
            </Prop>
          </>
        )}
      </div>
    </div>
  );
}
