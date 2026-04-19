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

const ACCENT = "var(--color-accent-habits)";

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
  })
  .refine(
    (data) => {
      if (data.frequency === "weekly")
        return (data.custom_days?.length ?? 0) === 1;
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
    },
  });

  const frequency = form.watch("frequency");

  useEffect(() => {
    if (open && habit) {
      form.reset({
        title: habit.title,
        description: habit.description ?? "",
        frequency: habit.frequency,
        custom_days: habit.custom_days ?? null,
        icon: habit.icon ?? "star",
        goal_id: habit.goal_id ?? null,
      });
    } else if (open && !habit) {
      form.reset({
        title: "",
        description: "",
        frequency: "daily",
        custom_days: null,
        icon: "star",
        goal_id: null,
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
      custom_days:
        data.frequency === "daily" ? null : (data.custom_days ?? null),
      icon: data.icon,
      color,
      goal_id: data.goal_id || null,
    };

    if (isEdit && habit) {
      await updateHabit.mutateAsync({ id: habit.id, ...input });
    } else {
      await createHabit.mutateAsync(input);
    }

    handleOpenChange(false);
  };

  const isPending = createHabit.isPending || updateHabit.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#1a1a1d] border-white/11">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-[#e2e2e6]">
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
                  <FormLabel className="text-xs font-medium text-[#a0a0a8]">
                    Title <span style={{ color: ACCENT }}>*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      variant="tasks"
                      placeholder="e.g. Morning run"
                      autoFocus
                      className="bg-[#1f1f22] focus:border-white/20"
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
                  <FormLabel className="text-xs font-medium text-[#a0a0a8]">
                    Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      variant="tasks"
                      placeholder="Why does this habit matter?"
                      rows={2}
                      className="bg-[#1f1f22] focus:border-white/20"
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
                    <FormLabel className="text-xs font-medium text-[#a0a0a8]">
                      Frequency
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger
                          variant="tasks"
                          className="w-full bg-[#1f1f22] focus:border-white/20"
                        >
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="tasks">
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
                    <FormLabel className="text-xs font-medium text-[#a0a0a8]">
                      Linked goal
                    </FormLabel>
                    <Select
                      onValueChange={(v) =>
                        field.onChange(v === "none" ? null : v)
                      }
                      value={field.value ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger
                          variant="tasks"
                          className="w-full bg-[#1f1f22] focus:border-white/20"
                        >
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="tasks">
                        <SelectItem value="none">No goal</SelectItem>
                        {goals
                          .filter((g) => g.status === "active")
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
                      <p className="mb-2 text-xs font-medium text-[#a0a0a8]">
                        {frequency === "weekly" ? "Which day?" : "Which days?"}
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
                                "flex-1 h-8 rounded-lg text-xs font-semibold transition-all",
                                isSelected
                                  ? "text-white"
                                  : "bg-[#141416] text-[#71717a] hover:text-[#e2e2e6] hover:bg-[#1f1f22]",
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

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-xs font-medium text-[#a0a0a8]">
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
                className="h-8 px-3 border-white/[0.07] text-[#a0a0a8] hover:text-[#e2e2e6] hover:bg-[#141416]"
              >
                Cancel
              </Button>
              <Button
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
