/* eslint-disable react-hooks/incompatible-library */
"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Target } from "lucide-react";

import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { cn } from "@/shared/utils/utils";

import { useCreateGoal, useUpdateGoal } from "../hooks/useGoals";
import type { Goal, GoalCategory, GoalPriority } from "../types";

const goalSchema = z
  .object({
    title:       z.string().min(1, "Title is required").max(255, "Title too long"),
    description: z.string().optional(),
    why:         z.string().optional(),
    category:    z.enum(["career", "health", "finance", "growth", "lifestyle", "other", "none"]),
    priority:    z.enum(["low", "medium", "high", "critical"]),
    target_date: z.date().optional().nullable(),
    tracking:      z.enum(["manual", "tasks", "activity"]),
    metric_source: z.enum(["watching", "books"]).optional(),
    metric_key:    z.enum(["films", "series", "anime", "titles", "books"]).optional(),
    metric_period: z.enum(["year", "all_time"]).optional(),
    metric_target: z.string().optional(),
  })
  .refine(
    (d) =>
      d.tracking !== "activity" ||
      (!!d.metric_period && !!d.metric_target && Number(d.metric_target) > 0 &&
        (d.metric_source === "books" || !!d.metric_key)),
    { message: "Choose what to count and a target", path: ["metric_target"] },
  );

type GoalFormData = {
  title:       string;
  description?: string;
  why?:        string;
  category:    "career" | "health" | "finance" | "growth" | "lifestyle" | "other" | "none";
  priority:    "low" | "medium" | "high" | "critical";
  target_date?: Date | null;
  tracking:      "manual" | "tasks" | "activity";
  metric_source?: "watching" | "books";
  metric_key?:   "films" | "series" | "anime" | "titles" | "books";
  metric_period?: "year" | "all_time";
  metric_target?: string;
};

interface Props {
  open:    boolean;
  onClose: () => void;
  goal?:   Goal;
}

const ACCENT = "var(--color-accent-goals)";
const FORM_ID = "goal-form";

const trackingOf = (g: Goal): "manual" | "tasks" | "activity" =>
  g.metric_module ? "activity" : g.progress_mode === "auto" ? "tasks" : "manual";

const EMPTY: GoalFormData = {
  title:       "",
  description: "",
  why:         "",
  category:    "none",
  priority:    "medium",
  target_date: null,
  tracking:      "manual",
  metric_source: "watching",
  metric_key:    "films",
  metric_period: "year",
  metric_target: "",
};

export function GoalPanel({ open, onClose, goal }: Props) {
  const isEdit = !!goal;
  const currentYear = new Date().getFullYear();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  // Edit values are applied via RHF's reactive `values` prop (at render time, not
  // in an effect) so the Radix Selects show the goal's saved category/priority/
  // tracking from the very first render — no post-mount flash of the defaults.
  const editValues = useMemo<GoalFormData | undefined>(() => {
    if (!goal) return undefined;
    return {
      title:       goal.title,
      description: goal.description ?? "",
      why:         goal.why ?? "",
      category:    goal.category ?? "none",
      priority:    goal.priority,
      target_date: goal.target_date ? new Date(goal.target_date) : null,
      tracking:      trackingOf(goal),
      metric_source: (goal.metric_module as GoalFormData["metric_source"]) ?? "watching",
      metric_key:    (goal.metric_key as GoalFormData["metric_key"]) ?? "films",
      metric_period: (goal.metric_period as GoalFormData["metric_period"]) ?? "year",
      metric_target: goal.metric_target != null ? String(goal.metric_target) : "",
    };
  }, [goal]);

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: EMPTY,
    values: editValues,
  });

  const tracking = form.watch("tracking");
  const metricSource = form.watch("metric_source");

  const handleClose = () => {
    // Revert any unsaved edits — create clears, edit snaps back to the goal.
    form.reset(editValues ?? EMPTY);
    onClose();
  };

  const onSubmit = async (data: GoalFormData) => {
    const isActivity = data.tracking === "activity";
    const source     = data.metric_source ?? "watching";
    // Books have a single key; Watching picks films/series/anime/titles.
    const metricKey  = source === "books" ? "books" : data.metric_key ?? null;
    const input = {
      title:         data.title,
      description:   data.description || null,
      why:           data.why || null,
      category:      data.category === "none" ? null : (data.category as GoalCategory),
      priority:      data.priority as GoalPriority,
      target_date:   data.target_date ? data.target_date.toISOString().split("T")[0] : null,
      progress_mode: (data.tracking === "manual" ? "manual" : "auto") as "manual" | "auto",
      metric_module: isActivity ? source : null,
      metric_key:    isActivity ? metricKey : null,
      metric_period: isActivity ? data.metric_period ?? null : null,
      metric_year:   isActivity && data.metric_period === "year" ? currentYear : null,
      metric_target: isActivity && data.metric_target ? Number(data.metric_target) : null,
    };

    if (isEdit && goal) {
      await updateGoal.mutateAsync({ id: goal.id, ...input });
    } else {
      await createGoal.mutateAsync(input);
    }
    handleClose();
  };

  const isPending = createGoal.isPending || updateGoal.isPending;

  return (
    <SlidingPanel
      open={open}
      onClose={handleClose}
      width="wide"
      icon={<Target size={14} style={{ color: ACCENT }} />}
      title={isEdit ? "Edit Goal" : "New Goal"}
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="h-8 px-3 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-3"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={isPending}
            className="h-8 px-3 text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {isPending ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-text-secondary">
                  Title <span style={{ color: ACCENT }}>*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    variant="tasks"
                    placeholder="e.g. Launch HEGON beta"
                    autoFocus
                    className="bg-surface-overlay focus:border-border-focus"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-text-secondary">
                  Description
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    variant="tasks"
                    placeholder="What does success look like?"
                    rows={2}
                    className="bg-surface-overlay focus:border-border-focus"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="why"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-text-secondary">
                  Why this matters
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    variant="tasks"
                    placeholder="Your north star — why do you really want this?"
                    rows={2}
                    className="bg-surface-overlay focus:border-border-focus"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-text-secondary">
                    Category
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger variant="tasks" className="w-full bg-surface-overlay focus:border-border-focus">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent variant="tasks">
                      <SelectItem value="none">No category</SelectItem>
                      <SelectItem value="career">Career</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="lifestyle">Lifestyle</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-text-secondary">
                    Priority
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger variant="tasks" className="w-full bg-surface-overlay focus:border-border-focus">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent variant="tasks">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Target date + tracking — side by side on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="target_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-text-secondary">
                    Target date
                  </FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-8 justify-start text-left font-normal",
                            "bg-surface-overlay border-border-default",
                            "text-text-primary hover:bg-surface-overlay hover:border-border-focus",
                            "focus-visible:border-border-focus",
                            !field.value && "text-text-tertiary"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "MMM d, yyyy") : "Pick a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-surface-3 border-border-strong" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={(date) => {
                          field.onChange(date ?? null);
                          setCalendarOpen(false);
                        }}
                        initialFocus
                        className="bg-surface-3"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Progress tracking — manual / from tasks / from a Watching activity */}
            <FormField
              control={form.control}
              name="tracking"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-text-secondary">
                    Track progress
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger variant="tasks" className="w-full bg-surface-overlay focus:border-border-focus">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent variant="tasks">
                      <SelectItem value="manual">Manually</SelectItem>
                      <SelectItem value="tasks">From linked tasks</SelectItem>
                      <SelectItem value="activity">From an activity</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {tracking === "activity" && (
            <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-overlay/40 p-3">
              <FormField
                control={form.control}
                name="metric_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">Source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? "watching"}>
                      <FormControl>
                        <SelectTrigger variant="tasks" className="w-full bg-surface-overlay focus:border-border-focus">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="tasks">
                        <SelectItem value="watching">Watching</SelectItem>
                        <SelectItem value="books">Books</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {metricSource === "books" ? (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">Count</FormLabel>
                    <div className="flex h-8 items-center rounded-md border border-border-default bg-surface-overlay px-3 text-xs text-text-secondary">
                      Books
                    </div>
                  </FormItem>
                ) : (
                  <FormField
                    control={form.control}
                    name="metric_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-text-secondary">Count</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? "films"}>
                          <FormControl>
                            <SelectTrigger variant="tasks" className="w-full bg-surface-overlay focus:border-border-focus">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent variant="tasks">
                            <SelectItem value="films">Films</SelectItem>
                            <SelectItem value="series">TV Shows</SelectItem>
                            <SelectItem value="anime">Animes</SelectItem>
                            <SelectItem value="titles">Any title</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="metric_target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-text-secondary">Target</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          variant="tasks"
                          placeholder="50"
                          className="bg-surface-overlay focus:border-border-focus"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="metric_period"
                  render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                      <FormLabel className="text-xs font-medium text-text-secondary">Period</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "year"}>
                        <FormControl>
                          <SelectTrigger variant="tasks" className="w-full bg-surface-overlay focus:border-border-focus">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent variant="tasks">
                          <SelectItem value="year">This year ({currentYear})</SelectItem>
                          <SelectItem value="all_time">All time</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-[11px] leading-snug text-text-tertiary">
                {metricSource === "books"
                  ? "Progress fills automatically as you mark books read."
                  : "Progress fills automatically as you mark titles watched."}
              </p>
            </div>
          )}
        </form>
      </Form>
    </SlidingPanel>
  );
}
