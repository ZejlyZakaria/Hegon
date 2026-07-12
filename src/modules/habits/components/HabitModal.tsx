/* eslint-disable react-hooks/incompatible-library */
"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
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
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";
import { IconPicker } from "@/shared/components/ui/icon-picker";
import { resolveIcon } from "@/shared/constants/icons";

import { useCreateHabit, useUpdateHabit } from "../hooks/useHabits";
import { useGoals } from "@/modules/goals/hooks/useGoals";
import type { Habit } from "../types";

const ACCENT = "var(--color-accent-habits-vivid)";

const DAYS = [
  { label: "Su", value: 0 },
  { label: "Mo", value: 1 },
  { label: "Tu", value: 2 },
  { label: "We", value: 3 },
  { label: "Th", value: 4 },
  { label: "Fr", value: 5 },
  { label: "Sa", value: 6 },
];

const habitSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(255),
    description: z.string().optional(),
    frequency: z.enum(["daily", "weekly", "custom"]),
    custom_days: z.array(z.number()).optional().nullable(),
    icon: z.string(),
    goal_id: z.string().optional().nullable(),
    source_module: z.enum(["watching"]).nullable().optional(),
    source_key: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      // weekly: 0 days = "any day this week" (allowed), 1 = a specific day.
      if (data.frequency === "weekly")
        return (data.custom_days?.length ?? 0) <= 1;
      if (data.frequency === "custom")
        return (data.custom_days?.length ?? 0) >= 1;
      return true;
    },
    {
      message: "Select at least one day",
      path: ["custom_days"],
    },
  );

type HabitFormData = z.infer<typeof habitSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  habit?: Habit;
}

export function HabitModal({ open, onClose, habit }: Props) {
  const isEdit = !!habit;

  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const { data: goals = [] } = useGoals();

  const form = useForm<HabitFormData>({
    resolver: zodResolver(habitSchema),
    defaultValues: {
      title: "",
      description: "",
      frequency: "daily",
      custom_days: null,
      icon: "star",
      goal_id: null,
      source_module: null,
      source_key: null,
    },
  });

  const frequency = form.watch("frequency");
  const sourceModule = form.watch("source_module");

  useEffect(() => {
    if (open && habit) {
      form.reset({
        title: habit.title,
        description: habit.description ?? "",
        frequency: habit.frequency,
        custom_days: habit.custom_days ?? null,
        icon: habit.icon ?? "star",
        goal_id: habit.goal_id ?? null,
        source_module: habit.source_module === "watching" ? "watching" : null,
        source_key: habit.source_key ?? null,
      });
    } else if (open && !habit) {
      form.reset({
        title: "",
        description: "",
        frequency: "daily",
        custom_days: null,
        icon: "star",
        goal_id: null,
        source_module: null,
        source_key: null,
      });
    }
  }, [open, habit, form]);

  useEffect(() => {
    if (frequency === "daily") {
      form.setValue("custom_days", null);
    }
  }, [frequency, form]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      form.reset();
      onClose();
    }
  };

  const onSubmit = async (data: HabitFormData) => {
    const { color } = resolveIcon(data.icon);

    const input = {
      title: data.title,
      description: data.description || null,
      frequency: data.frequency,
      // daily → no days; weekly with no day picked → null = "any day this week".
      custom_days:
        data.frequency === "daily"
          ? null
          : data.custom_days && data.custom_days.length > 0
            ? data.custom_days
            : null,
      icon: data.icon,
      color,
      goal_id: data.goal_id || null,
      source_module: data.source_module ?? null,
      // type filter only makes sense when an activity source is set
      source_key: data.source_module ? (data.source_key ?? null) : null,
    };

    try {
      if (isEdit && habit) {
        await updateHabit.mutateAsync({ id: habit.id, ...input });
      } else {
        await createHabit.mutateAsync(input);
      }
      handleOpenChange(false);
    } catch {
      // mutation onError handles the toast
    }
  };

  const isPending = createHabit.isPending || updateHabit.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[87dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-text-primary">
            {isEdit ? "Edit Habit" : "New Habit"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      placeholder="e.g. Morning run"
                      autoFocus
                      className="bg-surface-2 focus:border-border-focus"
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
                      placeholder="Why does this habit matter?"
                      rows={2}
                      className="bg-surface-2 focus:border-border-focus"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">
                      Frequency
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger variant="legacy"
                          className="w-full bg-surface-2 focus:border-border-focus"
                        >
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="legacy" >
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="custom">Custom days</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="goal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">
                      Linked goal
                    </FormLabel>
                    <Select
                      onValueChange={(v) =>
                        field.onChange(v === "none" ? null : v)
                      }
                      value={field.value ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger variant="legacy"
                          className="w-full min-w-0 bg-surface-2 focus:border-border-focus **:data-[slot=select-value]:min-w-0"
                        >
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="legacy" >
                        <SelectItem value="none">No goal</SelectItem>
                        {goals
                          .filter((g) => g.status !== "abandoned")
                          .map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {frequency !== "daily" && (
              <Controller
                control={form.control}
                name="custom_days"
                render={({ field, fieldState }) => {
                  const selected = field.value ?? [];

                  const toggle = (day: number) => {
                    if (frequency === "weekly") {
                      field.onChange(selected.includes(day) ? [] : [day]);
                    } else {
                      field.onChange(
                        selected.includes(day)
                          ? selected.filter((d) => d !== day)
                          : [...selected, day],
                      );
                    }
                  };

                  return (
                    <div>
                      <p className="mb-2 text-xs font-medium text-text-secondary">
                        {frequency === "weekly" ? "Which day? (optional)" : "Which days?"}
                      </p>

                      <div className="flex gap-1.5">
                        {DAYS.map((d) => {
                          const isSelected = selected.includes(d.value);

                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => toggle(d.value)}
                              className={cn(
                                "flex-1 h-8 rounded-control text-xs font-semibold transition-[background-color,color]",
                                isSelected
                                  ? "text-white"
                                  : "bg-surface-2 text-text-tertiary hover:text-text-primary hover:bg-surface-3",
                              )}
                              style={
                                isSelected
                                  ? { backgroundColor: ACCENT }
                                  : undefined
                              }
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>

                      {frequency === "weekly" && selected.length === 0 && (
                        <p className="mt-1.5 text-xs text-text-tertiary">
                          No day selected = once a week, any day.
                        </p>
                      )}

                      {fieldState.error && (
                        <p className="mt-1 text-xs text-red-400">
                          {fieldState.error.message}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
            )}

            {/* Auto-track from another module — a matching activity auto-completes
                the habit for its period (flexible: any day of the period counts). */}
            <div className="grid grid-cols-2 gap-3 *:min-w-0">
              <FormField
                control={form.control}
                name="source_module"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">
                      Auto-track
                    </FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "manual" ? null : v)}
                      value={field.value ?? "manual"}
                    >
                      <FormControl>
                        <SelectTrigger variant="legacy"
                          className="w-full bg-surface-2 focus:border-border-focus"
                        >
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="legacy" >
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="watching">From Watching</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {sourceModule === "watching" && (
                <FormField
                  control={form.control}
                  name="source_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-text-secondary">
                        Counts
                      </FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "any" ? null : v)}
                        value={field.value ?? "any"}
                      >
                        <FormControl>
                          <SelectTrigger variant="legacy"
                            className="w-full bg-surface-2 focus:border-border-focus"
                          >
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent variant="legacy" >
                          <SelectItem value="any">Anything</SelectItem>
                          <SelectItem value="film">Films</SelectItem>
                          <SelectItem value="serie">Series</SelectItem>
                          <SelectItem value="anime">Animes</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {sourceModule === "watching" && (
              <p className="-mt-1 text-xs text-text-tertiary">
                Watching a matching title auto-completes this habit for its period.
                You can still check it manually.
              </p>
            )}

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-text-secondary">
                    Icon
                  </FormLabel>
                  <FormControl>
                    <IconPicker
                      value={field.value}
                      onChange={(key) => field.onChange(key)}
                      accentColor={ACCENT}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="h-8 px-3 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-2"
              >
                Cancel
              </Button>
              <Button variant="legacy"
                type="submit"
                disabled={isPending}
                className="h-8 px-3 text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {isPending ? "Saving…" : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
