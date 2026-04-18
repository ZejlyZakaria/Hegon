"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

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

// ─── Schema ───────────────────────────────────────────────────────────────────

const goalSchema = z.object({
  title:       z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().optional(),
  category:    z.enum(["personal", "work", "health", "learning", "finance", "other", "none"]),
  priority:    z.enum(["low", "medium", "high", "critical"]),
  target_date: z.date().optional().nullable(),
});

type GoalFormData = {
  title:       string;
  description?: string;
  category:    "personal" | "work" | "health" | "learning" | "finance" | "other" | "none";
  priority:    "low" | "medium" | "high" | "critical";
  target_date?: Date | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
  goal?:   Goal;
}

const ACCENT = "#18ad9d";

export function GoalModal({ open, onClose, goal }: Props) {
  const isEdit = !!goal;
  const [calendarOpen, setCalendarOpen] = useState(false);

  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title:       "",
      description: "",
      category:    "none",
      priority:    "medium",
      target_date: null,
    },
  });

  // Populate in edit mode
  useEffect(() => {
    if (open && goal) {
      form.reset({
        title:       goal.title,
        description: goal.description ?? "",
        category:    goal.category ?? "none",
        priority:    goal.priority,
        target_date: goal.target_date ? new Date(goal.target_date) : null,
      });
    } else if (open && !goal) {
      form.reset({
        title:       "",
        description: "",
        category:    "none",
        priority:    "medium",
        target_date: null,
      });
    }
  }, [open, goal, form]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      form.reset();
      onClose();
    }
  };

  const onSubmit = async (data: GoalFormData) => {
    const input = {
      title:       data.title,
      description: data.description || null,
      category:    data.category === "none" ? null : data.category as GoalCategory,
      priority:    data.priority as GoalPriority,
      target_date: data.target_date ? data.target_date.toISOString().split("T")[0] : null,
    };

    if (isEdit && goal) {
      await updateGoal.mutateAsync({ id: goal.id, ...input });
    } else {
      await createGoal.mutateAsync(input);
    }
    handleOpenChange(false);
  };

  const isPending = createGoal.isPending || updateGoal.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-zinc-100">
            {isEdit ? "Edit Goal" : "New Goal"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-zinc-400">
                    Title <span style={{ color: ACCENT }}>*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      variant="tasks"
                      placeholder="e.g. Launch HEGON beta"
                      autoFocus
                      className="focus:ring-[#18ad9d] focus:border-[#18ad9d]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-zinc-400">
                    Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      variant="tasks"
                      placeholder="What does success look like?"
                      rows={2}
                      className="focus:ring-[#18ad9d] focus:border-[#18ad9d]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-zinc-400">
                      Category
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger variant="tasks" className="w-full focus:ring-[#18ad9d]">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="tasks">
                        <SelectItem value="none">No category</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="work">Work</SelectItem>
                        <SelectItem value="health">Health</SelectItem>
                        <SelectItem value="learning">Learning</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
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
                    <FormLabel className="text-xs font-medium text-zinc-400">
                      Priority
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger variant="tasks" className="w-full focus:ring-[#18ad9d]">
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

            {/* Target date */}
            <FormField
              control={form.control}
              name="target_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-zinc-400">
                    Target date
                  </FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            "bg-zinc-800/50 border border-zinc-700/50",
                            "text-zinc-100 hover:bg-zinc-800/50 hover:text-zinc-100",
                            "focus-visible:ring-1 focus-visible:ring-[#18ad9d]",
                            !field.value && "text-zinc-600"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "MMM d, yyyy") : "Pick a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={(date) => {
                          field.onChange(date ?? null);
                          setCalendarOpen(false);
                        }}
                        initialFocus
                        className="bg-zinc-900"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="border-zinc-700/50 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                style={{ backgroundColor: ACCENT }}
                className="text-white hover:opacity-90 disabled:opacity-50"
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
